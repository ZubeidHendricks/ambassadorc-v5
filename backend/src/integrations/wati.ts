/**
 * WATI (WhatsApp) Integration Service
 *
 * Sends template-based WhatsApp messages via the WATI API for
 * welcome packs, notifications, and client communications.
 *
 * Configuration is read from IntegrationConfig (name = "WATI").
 */

import prisma from "../lib/prisma.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WatiConfig {
  baseUrl: string;
  apiToken: string;
}

// ── Service ────────────────────────────────────────────────────────────────

export class WatiService {
  // ── Config ──

  async getConfig(): Promise<WatiConfig> {
    const row = await prisma.integrationConfig.findUnique({
      where: { name: "WATI" },
    });

    if (!row || row.status !== "ACTIVE") {
      throw new Error("WATI integration is not configured or inactive");
    }

    const creds = row.credentials as Record<string, any>;
    return {
      baseUrl: row.baseUrl,
      apiToken: creds.apiToken,
    };
  }

  // ── Send Template Message ──

  async sendTemplateMessage(
    number: string,
    templateName: string,
    params: string[]
  ): Promise<void> {
    const cfg = await this.getConfig();
    const whatsappNumber = this.normalizeNumber(number);

    const body: Record<string, any> = {
      template_name: templateName,
      broadcast_name: `ambassadorc_${Date.now()}`,
    };

    // WATI expects parameters as indexed objects
    if (params.length > 0) {
      body.parameters = params.map((value, index) => ({
        name: `${index + 1}`,
        value,
      }));
    }

    const res = await fetch(
      `${cfg.baseUrl}/api/v1/sendTemplateMessage?whatsappNumber=${whatsappNumber}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiToken}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await res.json();

    if (!res.ok || data.result === false) {
      await this.audit("WATI_TEMPLATE_SEND_FAIL", {
        number: this.maskNumber(number),
        templateName,
        error: data.info ?? data.message ?? JSON.stringify(data),
      });
      throw new Error(
        `WATI template send failed: ${data.info ?? data.message ?? res.status}`
      );
    }

    await this.audit("WATI_TEMPLATE_SENT", {
      number: this.maskNumber(number),
      templateName,
    });
  }

  // ── Send Welcome Message (convenience) ──

  async sendWelcomeMessage(
    number: string,
    name: string,
    regId: string
  ): Promise<void> {
    await this.sendTemplateMessage(number, "welcome_pack", [name, regId]);

    // Log to WelcomePackLog
    await prisma.welcomePackLog.create({
      data: {
        mobileNumber: number,
        productEndpoint: "WATI",
        batchId: `wati-${Date.now()}`,
        status: "SENT",
        sentAt: new Date(),
      },
    });
  }

  // ── Private Helpers ──

  private normalizeNumber(number: string): string {
    let n = number.replace(/[\s\-()]/g, "");
    if (n.startsWith("+")) n = n.substring(1);
    if (n.startsWith("0")) n = "27" + n.substring(1);
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
          entityId: "WATI",
          details,
        },
      });
    } catch {
      // Never throw from audit
    }
  }
}

export const watiService = new WatiService();
