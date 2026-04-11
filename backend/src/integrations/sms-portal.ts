/**
 * SMS Portal Integration Service
 *
 * Handles communication with the SMS Portal API for transactional
 * and bulk SMS messaging. Uses Bearer token authentication with
 * automatic re-authentication on expiry.
 *
 * Supports templated messages (WELCOME, QA_VERIFY, PREMIUM_INCREASE, etc.)
 * and delivery report polling.
 *
 * Configuration is read from IntegrationConfig (name = "SMS_PORTAL").
 */

import prisma from "../lib/prisma.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface SmsConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  senderId: string;
}

export interface BulkResult {
  batchId: string;
  totalSent: number;
  totalFailed: number;
  messageIds: string[];
}

export interface DeliveryStatus {
  messageId: string;
  destination: string;
  status: string; // DELIVERED, SENT, FAILED, EXPIRED
  deliveredAt?: string;
}

// ── SMS Templates ──────────────────────────────────────────────────────────

const SMS_TEMPLATES: Record<string, string> = {
  WELCOME:
    "Welcome {name}! Your {product} policy ({policyNumber}) is now active. Keep this SMS for your records. Ref: {regId}",
  QA_VERIFY:
    "Hi {name}, we are verifying your {product} policy. An agent will contact you shortly. Ref: {regId}",
  PREMIUM_INCREASE:
    "Dear {name}, your {product} premium will change from R{oldPremium} to R{newPremium} effective {effectiveDate}. Contact us for queries.",
  CALLBACK:
    "Hi {name}, you have requested a callback. An agent will contact you within 24 hours. Ref: {refId}",
  AMBASSADOR:
    "Hi {name}, your referral batch has been submitted. Track your rewards in the Ambassador app.",
  AGENT_CAPTURE:
    "New sale captured by agent {agentName} for client {clientName}. Policy: {policyNumber}. Awaiting QA review.",
};

// ── Service ────────────────────────────────────────────────────────────────

export class SmsPortalService {
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  // ── Config ──

  async getConfig(): Promise<SmsConfig> {
    const row = await prisma.integrationConfig.findUnique({
      where: { name: "SMS_PORTAL" },
    });

    if (!row || row.status !== "ACTIVE") {
      throw new Error("SMS Portal integration is not configured or inactive");
    }

    const creds = row.credentials as Record<string, any>;
    return {
      baseUrl: row.baseUrl,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      senderId: creds.senderId ?? "AmbassadorC",
    };
  }

  // ── Authentication ──

  async authenticate(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.cachedToken;
    }

    const cfg = await this.getConfig();

    const res = await fetch(`${cfg.baseUrl}/Authentication/Login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SMS Portal authentication failed: ${body}`);
    }

    const data = await res.json();
    this.cachedToken = data.token ?? data.Token;
    // Default 60-minute expiry
    this.tokenExpiresAt = Date.now() + (data.expiresIn ?? 3600) * 1000;

    return this.cachedToken!;
  }

  // ── Send Single SMS ──

  async sendSms(
    destination: string,
    content: string
  ): Promise<{ messageId: string }> {
    const cfg = await this.getConfig();
    const token = await this.authenticate();

    const res = await fetch(`${cfg.baseUrl}/BulkMessages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        SenderId: cfg.senderId,
        Messages: [
          {
            Content: content,
            Destination: this.normalizeNumber(destination),
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      await this.audit("SMS_SEND_FAIL", { destination: this.maskNumber(destination), error: data });
      throw new Error(`SMS send failed: ${JSON.stringify(data)}`);
    }

    const messageId = data.CostEstimation?.Messages?.[0]?.MessageId ?? data.MessageId ?? `sms-${Date.now()}`;

    // Log to SmsMessage table
    await prisma.smsMessage.create({
      data: {
        recipientNumber: destination,
        messageBody: content,
        status: "SENT",
        type: "WELCOME", // Default; overridden by sendFromTemplate
        sentAt: new Date(),
      },
    });

    await this.audit("SMS_SENT", { destination: this.maskNumber(destination), messageId });

    return { messageId };
  }

  // ── Send Bulk SMS ──

  async sendBulkSms(
    messages: { destination: string; content: string }[]
  ): Promise<BulkResult> {
    const cfg = await this.getConfig();
    const token = await this.authenticate();
    const batchId = `SMSBATCH-${Date.now()}`;

    // Create batch record
    await prisma.smsBatch.create({
      data: {
        name: batchId,
        template: "CUSTOM",
        totalCount: messages.length,
        status: "PROCESSING",
      },
    });

    // SMS Portal typically accepts up to 500 messages per request
    const CHUNK_SIZE = 500;
    const messageIds: string[] = [];
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      const chunk = messages.slice(i, i + CHUNK_SIZE);

      try {
        const res = await fetch(`${cfg.baseUrl}/BulkMessages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            SenderId: cfg.senderId,
            Messages: chunk.map((m) => ({
              Content: m.content,
              Destination: this.normalizeNumber(m.destination),
            })),
          }),
        });

        const data = await res.json();

        if (res.ok) {
          const ids =
            data.CostEstimation?.Messages?.map((m: any) => m.MessageId) ?? [];
          messageIds.push(...ids);
          totalSent += chunk.length;
        } else {
          totalFailed += chunk.length;
        }
      } catch {
        totalFailed += chunk.length;
      }
    }

    // Update batch record
    await prisma.smsBatch.update({
      where: { id: (await prisma.smsBatch.findFirst({ where: { name: batchId } }))!.id },
      data: {
        sentCount: totalSent,
        failedCount: totalFailed,
        status: totalFailed === 0 ? "COMPLETED" : totalSent === 0 ? "FAILED" : "COMPLETED",
        completedAt: new Date(),
      },
    });

    await this.audit("SMS_BULK_SENT", { batchId, totalSent, totalFailed });

    return { batchId, totalSent, totalFailed, messageIds };
  }

  // ── Delivery Report ──

  async getDeliveryReport(messageId: string): Promise<DeliveryStatus> {
    const cfg = await this.getConfig();
    const token = await this.authenticate();

    const res = await fetch(`${cfg.baseUrl}/BulkMessages/${messageId}/DeliveryReport`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();

    return {
      messageId,
      destination: data.Destination ?? "",
      status: data.Status ?? "UNKNOWN",
      deliveredAt: data.DeliveredAt,
    };
  }

  // ── Template-based Sending ──

  async sendFromTemplate(
    template: string,
    destination: string,
    vars: Record<string, string>
  ): Promise<void> {
    const templateStr = SMS_TEMPLATES[template];
    if (!templateStr) {
      throw new Error(`Unknown SMS template: ${template}`);
    }

    let content = templateStr;
    for (const [key, value] of Object.entries(vars)) {
      content = content.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }

    const { messageId } = await this.sendSms(destination, content);

    // Update the SmsMessage record with correct type
    const smsType = template as any;
    const validTypes = ["WELCOME", "QA_VERIFY", "PREMIUM_INCREASE", "CALLBACK", "AMBASSADOR", "AGENT_CAPTURE"];
    if (validTypes.includes(template)) {
      await prisma.smsMessage.updateMany({
        where: { recipientNumber: destination, messageBody: content },
        data: { type: smsType },
      });
    }
  }

  // ── Private Helpers ──

  private normalizeNumber(number: string): string {
    let n = number.replace(/[\s\-()]/g, "");
    if (n.startsWith("0")) {
      n = "27" + n.substring(1);
    }
    if (!n.startsWith("+")) {
      n = "+" + n;
    }
    return n;
  }

  private maskNumber(number: string): string {
    if (number.length <= 4) return "****";
    return "***" + number.slice(-4);
  }

  private async audit(action: string, details: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity: "Integration",
          entityId: "SMS_PORTAL",
          details,
        },
      });
    } catch {
      // Never throw from audit
    }
  }
}

export const smsPortalService = new SmsPortalService();
