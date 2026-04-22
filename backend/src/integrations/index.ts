/**
 * Integration Registry
 *
 * Exports all integration service singletons and provides a function
 * to seed default IntegrationConfig rows into the database.
 */

import prisma from "../lib/prisma.js";

// ── Re-export singletons ───────────────────────────────────────────────────

export { qlinkService } from "./qlink.js";
export { sagePayService } from "./sagepay.js";
export { smsPortalService } from "./sms-portal.js";
export { netcashService } from "./netcash.js";
export { guardRiskService } from "./guardrisk.js";
export { viciDialerService } from "./vicidialer.js";
export { sendZapierWhatsApp, getZapierWaStatus, ZAPIER_WA_TEMPLATES } from "./zapier-whatsapp.js";
export {
  sendUltraMsgWhatsApp,
  getUltraMsgStatus,
  buildTemplateBody,
  ULTRAMSG_TEMPLATES,
} from "./ultramsg.js";

// ── Default Integration Configs ────────────────────────────────────────────

interface DefaultConfig {
  name: string;
  displayName: string;
  baseUrl: string;
  credentials: Record<string, any>;
  settings?: Record<string, any>;
}

const DEFAULT_CONFIGS: DefaultConfig[] = [
  {
    name: "QLINK",
    displayName: "QLink Government Debit Orders",
    baseUrl: "https://www.qlink.co.za/webservice",
    credentials: {
      username: "",
      password: "",
      institutionId: "",
      payrollIdentifier: "",
    },
    settings: { testMode: true },
  },
  {
    name: "SAGEPAY",
    displayName: "SagePay Payment Gateway",
    baseUrl: "https://www.sagepay.co.za/api/v1",
    credentials: {
      merchantId: "",
      merchantKey: "",
      serviceKey: "",
    },
    settings: { testMode: true },
  },
  {
    name: "NETCASH",
    displayName: "Netcash Bank Validation",
    baseUrl: "https://ws.netcash.co.za/NIWS",
    credentials: {
      serviceKey: "",
      accountNumber: "",
    },
  },
  {
    name: "SMS_PORTAL",
    displayName: "SMS Portal",
    baseUrl: "https://rest.smsportal.com/v1",
    credentials: {
      clientId: "",
      clientSecret: "",
      senderId: "AmbassadorC",
    },
  },
  {
    name: "VICIDIALER",
    displayName: "ViciDialer Call Centre",
    baseUrl: "https://dialer.example.com",
    credentials: {
      apiUser: "",
      apiPass: "",
    },
    settings: { listId: "1000", campaignId: "AMBASSADORC" },
  },
  {
    name: "GUARDRISK",
    displayName: "Guard Risk SFTP",
    baseUrl: "sftp://ftp.guardrisk.co.za",
    credentials: {
      username: "",
      password: "",
      port: 22,
    },
    settings: { remotePath: "/uploads", localExportDir: "/tmp/guardrisk-exports" },
  },
];

// ── Seed Function ──────────────────────────────────────────────────────────

/**
 * Seeds default IntegrationConfig rows into the database.
 * Uses upsert so it is safe to call repeatedly (no-op if already present).
 */
export async function seedIntegrationConfigs(): Promise<void> {
  for (const cfg of DEFAULT_CONFIGS) {
    await prisma.integrationConfig.upsert({
      where: { name: cfg.name },
      create: {
        name: cfg.name,
        displayName: cfg.displayName,
        baseUrl: cfg.baseUrl,
        credentials: cfg.credentials,
        settings: cfg.settings ?? null,
        status: "INACTIVE", // Inactive until credentials are configured
      },
      update: {
        // Only update display name and defaults; never overwrite live credentials
        displayName: cfg.displayName,
      },
    });
  }

  console.log(`[Integrations] Seeded ${DEFAULT_CONFIGS.length} integration configs`);
}

// ── Test Connectivity Helper ───────────────────────────────────────────────

import { qlinkService } from "./qlink.js";
import { sagePayService } from "./sagepay.js";
import { smsPortalService } from "./sms-portal.js";

/**
 * Tests connectivity for a named integration.
 * Returns { success, message }.
 */
export async function testIntegrationConnection(
  name: string
): Promise<{ success: boolean; message: string }> {
  switch (name.toUpperCase()) {
    case "QLINK":
      return qlinkService.testConnection();

    case "SAGEPAY": {
      try {
        const cfg = await sagePayService.getConfig();
        const res = await fetch(`${cfg.baseUrl}/Banks/List`, {
          method: "GET",
          headers: {
            Authorization: `Basic ${Buffer.from(`${cfg.merchantId}:${cfg.merchantKey}`).toString("base64")}`,
          },
        });
        return {
          success: res.ok,
          message: res.ok ? "SagePay connection successful" : `HTTP ${res.status}`,
        };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }

    case "SMS_PORTAL": {
      try {
        await smsPortalService.authenticate();
        return { success: true, message: "SMS Portal authentication successful" };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }

    case "NETCASH":
    case "VICIDIALER":
    case "GUARDRISK": {
      try {
        const row = await prisma.integrationConfig.findUnique({
          where: { name: name.toUpperCase() },
        });
        if (!row) return { success: false, message: "Not configured" };
        if (row.status !== "ACTIVE") return { success: false, message: "Integration is inactive" };
        return { success: true, message: `${row.displayName} config loaded (no live ping available)` };
      } catch (err: any) {
        return { success: false, message: err.message };
      }
    }

    default:
      return { success: false, message: `Unknown integration: ${name}` };
  }
}
