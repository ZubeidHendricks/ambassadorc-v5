/**
 * ViciDialer Integration Service
 *
 * Uploads lead lists and individual leads to the ViciDialer call-centre
 * system for outbound dialling campaigns.
 *
 * Configuration is read from IntegrationConfig (name = "VICIDIALER").
 */

import prisma from "../lib/prisma.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ViciDialerConfig {
  baseUrl: string;
  apiUser: string;
  apiPass: string;
  listId: string;
  campaignId: string;
}

export interface ViciLead {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  idNumber?: string;
  province?: string;
  source?: string;
  comments?: string;
}

// ── Service ────────────────────────────────────────────────────────────────

export class ViciDialerService {
  // ── Config ──

  async getConfig(): Promise<ViciDialerConfig> {
    const row = await prisma.integrationConfig.findUnique({
      where: { name: "VICIDIALER" },
    });

    if (!row || row.status !== "ACTIVE") {
      throw new Error("ViciDialer integration is not configured or inactive");
    }

    const creds = row.credentials as Record<string, any>;
    const settings = (row.settings ?? {}) as Record<string, any>;

    return {
      baseUrl: row.baseUrl,
      apiUser: creds.apiUser,
      apiPass: creds.apiPass,
      listId: settings.listId ?? "1000",
      campaignId: settings.campaignId ?? "AMBASSADORC",
    };
  }

  // ── Upload Leads (Bulk) ──

  async uploadLeads(leads: ViciLead[]): Promise<{ uploaded: number }> {
    const cfg = await this.getConfig();
    let uploaded = 0;

    for (const lead of leads) {
      try {
        const result = await this.addLeadInternal(cfg, lead);
        if (result) uploaded++;
      } catch (err: any) {
        console.error(`[ViciDialer] Failed to upload lead ${lead.phoneNumber}:`, err.message);
      }
    }

    await this.audit("VICIDIALER_BULK_UPLOAD", {
      totalLeads: leads.length,
      uploaded,
      failed: leads.length - uploaded,
    });

    return { uploaded };
  }

  // ── Add Single Lead ──

  async addLead(lead: ViciLead): Promise<{ success: boolean }> {
    const cfg = await this.getConfig();
    const success = await this.addLeadInternal(cfg, lead);

    await this.audit("VICIDIALER_ADD_LEAD", {
      phoneNumber: this.maskNumber(lead.phoneNumber),
      success,
    });

    return { success };
  }

  // ── Internal ──

  private async addLeadInternal(cfg: ViciDialerConfig, lead: ViciLead): Promise<boolean> {
    // ViciDialer uses a non-agent API endpoint with query string params
    const params = new URLSearchParams({
      source: "add",
      user: cfg.apiUser,
      pass: cfg.apiPass,
      function: "add_lead",
      phone_number: this.normalizePhone(lead.phoneNumber),
      first_name: lead.firstName,
      last_name: lead.lastName,
      list_id: cfg.listId,
      campaign_id: cfg.campaignId,
      ...(lead.province ? { state: lead.province } : {}),
      ...(lead.source ? { vendor_lead_code: lead.source } : {}),
      ...(lead.comments ? { comments: lead.comments } : {}),
      ...(lead.idNumber ? { security_phrase: lead.idNumber } : {}),
    });

    const res = await fetch(
      `${cfg.baseUrl}/vicidial/non_agent_api.php?${params.toString()}`,
      { method: "GET" }
    );

    const body = await res.text();

    // ViciDialer returns text with SUCCESS or ERROR prefix
    return body.toUpperCase().includes("SUCCESS");
  }

  // ── Private Helpers ──

  private normalizePhone(phone: string): string {
    let n = phone.replace(/[\s\-()]/g, "");
    if (n.startsWith("+27")) n = "0" + n.substring(3);
    if (n.startsWith("27") && n.length === 11) n = "0" + n.substring(2);
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
          entityId: "VICIDIALER",
          details,
        },
      });
    } catch {
      // Never throw from audit
    }
  }
}

export const viciDialerService = new ViciDialerService();
