/**
 * QLink Integration Service
 *
 * Handles communication with the QLink API for government debit-order processing.
 * Operations include member enquiry, batch export, affordability updates (QNAU),
 * batch status polling, and automatic password rotation (every 60 days).
 *
 * All configuration is read from the IntegrationConfig table (name = "QLINK").
 */

import prisma from "../lib/prisma.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface QLinkConfig {
  baseUrl: string;
  username: string;
  password: string;
  institutionId: string;
  payrollIdentifier: string;
  testMode: boolean;
}

export interface MemberEnquiryResult {
  found: boolean;
  memberId?: string;
  fullName?: string;
  idNumber?: string;
  employer?: string;
  affordability?: number;
  deductions?: { code: string; amount: number; description: string }[];
  rawXml?: string;
}

export interface BatchExportResult {
  batchId: string;
  recordCount: number;
}

export interface BatchStatusResult {
  batchId: string;
  status: string;
  processed: number;
  failed: number;
  errors: { memberId: string; errorCode: string; message: string }[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSoapEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ql="http://www.qlink.co.za/webservice">
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
}

function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : undefined;
}

// ── Service ────────────────────────────────────────────────────────────────

export class QLinkService {
  // ── Config ──

  async getConfig(): Promise<QLinkConfig> {
    const row = await prisma.integrationConfig.findUnique({
      where: { name: "QLINK" },
    });

    if (!row || row.status !== "ACTIVE") {
      throw new Error("QLink integration is not configured or inactive");
    }

    const creds = row.credentials as Record<string, any>;
    return {
      baseUrl: row.baseUrl,
      username: creds.username,
      password: creds.password,
      institutionId: creds.institutionId ?? "",
      payrollIdentifier: creds.payrollIdentifier ?? "",
      testMode: (row.settings as any)?.testMode ?? true,
    };
  }

  // ── Connectivity Test ──

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const cfg = await this.getConfig();
      const xml = buildSoapEnvelope(`
        <ql:TestConnection>
          <ql:Username>${escapeXml(cfg.username)}</ql:Username>
          <ql:Password>${escapeXml(cfg.password)}</ql:Password>
          <ql:InstitutionId>${escapeXml(cfg.institutionId)}</ql:InstitutionId>
        </ql:TestConnection>
      `);

      const res = await fetch(`${cfg.baseUrl}/Service.asmx`, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "http://www.qlink.co.za/webservice/TestConnection",
        },
        body: xml,
      });

      const body = await res.text();

      await this.audit("QLINK_TEST", body);

      if (!res.ok) {
        return { success: false, message: `HTTP ${res.status}: ${body.substring(0, 200)}` };
      }

      return { success: true, message: "QLink connection successful" };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  // ── Member Enquiry ──

  async memberEnquiry(idNumber: string): Promise<MemberEnquiryResult> {
    const cfg = await this.getConfig();

    const xml = buildSoapEnvelope(`
      <ql:MemberEnquiry>
        <ql:Username>${escapeXml(cfg.username)}</ql:Username>
        <ql:Password>${escapeXml(cfg.password)}</ql:Password>
        <ql:InstitutionId>${escapeXml(cfg.institutionId)}</ql:InstitutionId>
        <ql:PayrollIdentifier>${escapeXml(cfg.payrollIdentifier)}</ql:PayrollIdentifier>
        <ql:IdNumber>${escapeXml(idNumber)}</ql:IdNumber>
      </ql:MemberEnquiry>
    `);

    const res = await fetch(`${cfg.baseUrl}/Service.asmx`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://www.qlink.co.za/webservice/MemberEnquiry",
      },
      body: xml,
    });

    const body = await res.text();
    await this.audit("QLINK_MEMBER_ENQUIRY", { idNumber, statusCode: res.status });

    if (!res.ok) {
      throw new Error(`QLink MemberEnquiry failed: HTTP ${res.status}`);
    }

    const memberId = extractTag(body, "MemberId");
    if (!memberId) {
      return { found: false, rawXml: body };
    }

    const deductions: MemberEnquiryResult["deductions"] = [];
    const deductionMatches = body.matchAll(
      /<Deduction>[\s\S]*?<Code>(.*?)<\/Code>[\s\S]*?<Amount>(.*?)<\/Amount>[\s\S]*?<Description>(.*?)<\/Description>[\s\S]*?<\/Deduction>/gi
    );
    for (const m of deductionMatches) {
      deductions.push({
        code: m[1],
        amount: parseFloat(m[2]),
        description: m[3],
      });
    }

    return {
      found: true,
      memberId,
      fullName: extractTag(body, "FullName"),
      idNumber: extractTag(body, "IdNumber") ?? idNumber,
      employer: extractTag(body, "Employer"),
      affordability: parseFloat(extractTag(body, "Affordability") ?? "0"),
      deductions,
      rawXml: body,
    };
  }

  // ── Batch Export ──

  async exportBatch(policyIds: number[]): Promise<BatchExportResult> {
    const cfg = await this.getConfig();

    // Fetch policies with client data
    const policies = await prisma.policy.findMany({
      where: { id: { in: policyIds }, status: "ACTIVE" },
      include: { client: true, product: true },
    });

    if (policies.length === 0) {
      throw new Error("No active policies found for the given IDs");
    }

    const batchId = `QLBATCH-${Date.now()}`;

    // Build member records XML
    const memberRecords = policies
      .map((p) => {
        return `
        <ql:MemberRecord>
          <ql:IdNumber>${escapeXml(p.client.idNumber)}</ql:IdNumber>
          <ql:FirstName>${escapeXml(p.client.firstName)}</ql:FirstName>
          <ql:LastName>${escapeXml(p.client.lastName)}</ql:LastName>
          <ql:Amount>${p.premiumAmount.toString()}</ql:Amount>
          <ql:Reference>${escapeXml(p.policyNumber)}</ql:Reference>
          <ql:ProductCode>${escapeXml(p.product.code)}</ql:ProductCode>
        </ql:MemberRecord>`;
      })
      .join("");

    const xml = buildSoapEnvelope(`
      <ql:SubmitBatch>
        <ql:Username>${escapeXml(cfg.username)}</ql:Username>
        <ql:Password>${escapeXml(cfg.password)}</ql:Password>
        <ql:InstitutionId>${escapeXml(cfg.institutionId)}</ql:InstitutionId>
        <ql:BatchId>${escapeXml(batchId)}</ql:BatchId>
        <ql:Members>${memberRecords}</ql:Members>
      </ql:SubmitBatch>
    `);

    const res = await fetch(`${cfg.baseUrl}/Service.asmx`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://www.qlink.co.za/webservice/SubmitBatch",
      },
      body: xml,
    });

    const body = await res.text();

    if (!res.ok) {
      await this.audit("QLINK_BATCH_EXPORT_FAIL", { batchId, error: body.substring(0, 500) });
      throw new Error(`QLink batch submission failed: HTTP ${res.status}`);
    }

    // Persist batch record
    await prisma.qLinkBatch.create({
      data: {
        batchId,
        product: policies[0].product.code,
        description: `Export of ${policies.length} policies`,
        recordCount: policies.length,
        status: "PENDING",
      },
    });

    await this.audit("QLINK_BATCH_EXPORT", { batchId, recordCount: policies.length });

    return { batchId, recordCount: policies.length };
  }

  // ── Batch Status ──

  async getBatchStatus(batchId: string): Promise<BatchStatusResult> {
    const cfg = await this.getConfig();

    const xml = buildSoapEnvelope(`
      <ql:GetBatchStatus>
        <ql:Username>${escapeXml(cfg.username)}</ql:Username>
        <ql:Password>${escapeXml(cfg.password)}</ql:Password>
        <ql:BatchId>${escapeXml(batchId)}</ql:BatchId>
      </ql:GetBatchStatus>
    `);

    const res = await fetch(`${cfg.baseUrl}/Service.asmx`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://www.qlink.co.za/webservice/GetBatchStatus",
      },
      body: xml,
    });

    const body = await res.text();

    if (!res.ok) {
      throw new Error(`QLink GetBatchStatus failed: HTTP ${res.status}`);
    }

    const status = extractTag(body, "Status") ?? "UNKNOWN";
    const processed = parseInt(extractTag(body, "Processed") ?? "0", 10);
    const failed = parseInt(extractTag(body, "Failed") ?? "0", 10);

    const errors: BatchStatusResult["errors"] = [];
    const errorMatches = body.matchAll(
      /<Error>[\s\S]*?<MemberId>(.*?)<\/MemberId>[\s\S]*?<ErrorCode>(.*?)<\/ErrorCode>[\s\S]*?<Message>(.*?)<\/Message>[\s\S]*?<\/Error>/gi
    );
    for (const m of errorMatches) {
      errors.push({ memberId: m[1], errorCode: m[2], message: m[3] });
    }

    // Update local batch record
    const prismaStatus =
      status === "COMPLETED" ? "COMPLETED" : status === "FAILED" ? "FAILED" : "PROCESSING";

    await prisma.qLinkBatch.update({
      where: { batchId },
      data: {
        status: prismaStatus,
        result: { status, processed, failed, errors } as any,
        processedAt: prismaStatus === "COMPLETED" || prismaStatus === "FAILED" ? new Date() : undefined,
      },
    });

    return { batchId, status, processed, failed, errors };
  }

  // ── Affordability Update (QNAU) ──

  async updateAffordability(
    memberId: string,
    premium: number
  ): Promise<{ success: boolean; responseCode?: string; message?: string }> {
    const cfg = await this.getConfig();

    const xml = buildSoapEnvelope(`
      <ql:UpdateAffordability>
        <ql:Username>${escapeXml(cfg.username)}</ql:Username>
        <ql:Password>${escapeXml(cfg.password)}</ql:Password>
        <ql:InstitutionId>${escapeXml(cfg.institutionId)}</ql:InstitutionId>
        <ql:MemberId>${escapeXml(memberId)}</ql:MemberId>
        <ql:NewAmount>${premium.toFixed(2)}</ql:NewAmount>
      </ql:UpdateAffordability>
    `);

    const res = await fetch(`${cfg.baseUrl}/Service.asmx`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://www.qlink.co.za/webservice/UpdateAffordability",
      },
      body: xml,
    });

    const body = await res.text();
    const responseCode = extractTag(body, "ResponseCode");
    const message = extractTag(body, "ResponseMessage");

    await this.audit("QLINK_AFFORDABILITY_UPDATE", { memberId, premium, responseCode });

    return {
      success: res.ok && responseCode === "00",
      responseCode,
      message,
    };
  }

  // ── Password Rotation (every 60 days) ──

  async rotatePassword(): Promise<{ newPassword: string }> {
    const cfg = await this.getConfig();

    const newPassword = this.generatePassword();

    const xml = buildSoapEnvelope(`
      <ql:ChangePassword>
        <ql:Username>${escapeXml(cfg.username)}</ql:Username>
        <ql:OldPassword>${escapeXml(cfg.password)}</ql:OldPassword>
        <ql:NewPassword>${escapeXml(newPassword)}</ql:NewPassword>
        <ql:InstitutionId>${escapeXml(cfg.institutionId)}</ql:InstitutionId>
      </ql:ChangePassword>
    `);

    const res = await fetch(`${cfg.baseUrl}/Service.asmx`, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "http://www.qlink.co.za/webservice/ChangePassword",
      },
      body: xml,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`QLink password rotation failed: ${body.substring(0, 300)}`);
    }

    // Persist updated password
    const row = await prisma.integrationConfig.findUnique({ where: { name: "QLINK" } });
    const creds = (row!.credentials as Record<string, any>);
    creds.password = newPassword;

    await prisma.integrationConfig.update({
      where: { name: "QLINK" },
      data: { credentials: creds },
    });

    await this.audit("QLINK_PASSWORD_ROTATED", { username: cfg.username });

    return { newPassword };
  }

  // ── Sync Pending Batches ──

  async syncPendingBatches(): Promise<{ processed: number; failed: number }> {
    const pending = await prisma.qLinkBatch.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] } },
    });

    let processed = 0;
    let failed = 0;

    for (const batch of pending) {
      try {
        const result = await this.getBatchStatus(batch.batchId);
        if (result.status === "COMPLETED") processed++;
        if (result.status === "FAILED") failed++;
      } catch (err: any) {
        console.error(`Failed to sync QLink batch ${batch.batchId}:`, err.message);
        failed++;
      }
    }

    // Update lastSyncAt on the integration config
    await prisma.integrationConfig.update({
      where: { name: "QLINK" },
      data: { lastSyncAt: new Date() },
    });

    return { processed, failed };
  }

  // ── Private Helpers ──

  private generatePassword(length = 16): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let pw = "";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      pw += chars[b % chars.length];
    }
    return pw;
  }

  private async audit(action: string, details: any): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action,
          entity: "Integration",
          entityId: "QLINK",
          details: typeof details === "string" ? { raw: details.substring(0, 2000) } : details,
        },
      });
    } catch {
      // Audit logging should never throw to callers
    }
  }
}

export const qlinkService = new QLinkService();
