/**
 * Integration API Routes
 *
 * Provides REST endpoints for managing external integration configs,
 * triggering sync operations, and invoking individual services.
 *
 * All routes require authentication (via the auth middleware).
 * Admin-only routes enforce role = ADMIN.
 */

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authenticate } from "../middleware/auth.js";
import {
  qlinkService,
  sagePayService,
  smsPortalService,
  netcashService,
  guardRiskService,
  viciDialerService,
  watiService,
  testIntegrationConnection,
} from "../integrations/index.js";

const router = Router();

// All integration routes require authentication
router.use(authenticate);

// ── Helper: check admin role ───────────────────────────────────────────────

function requireAdmin(req: Request, res: Response): boolean {
  const user = (req as any).ambassador;
  if (!user || user.role !== "ADMIN") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return false;
  }
  return true;
}

// ── GET /api/integrations — List all integration configs ───────────────────

router.get("/", async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.integrationConfig.findMany({
      select: {
        id: true,
        name: true,
        displayName: true,
        baseUrl: true,
        status: true,
        lastSyncAt: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        // Deliberately exclude credentials
      },
      orderBy: { name: "asc" },
    });

    res.json({ success: true, data: configs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/integrations/:name — Get specific integration detail ──────────

router.get("/:name", async (req: Request, res: Response) => {
  try {
    const config = await prisma.integrationConfig.findUnique({
      where: { name: req.params.name.toUpperCase() },
    });

    if (!config) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    // Strip sensitive credential fields for non-admin
    const user = (req as any).ambassador;
    const safeConfig = {
      ...config,
      credentials: user?.role === "ADMIN" ? config.credentials : "***REDACTED***",
    };

    res.json({ success: true, data: safeConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/integrations/:name — Update integration config (admin) ────────

router.put("/:name", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const name = req.params.name.toUpperCase();
    const { baseUrl, credentials, settings, status } = req.body;

    const existing = await prisma.integrationConfig.findUnique({ where: { name } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Integration not found" });
    }

    const updated = await prisma.integrationConfig.update({
      where: { name },
      data: {
        ...(baseUrl !== undefined ? { baseUrl } : {}),
        ...(credentials !== undefined ? { credentials } : {}),
        ...(settings !== undefined ? { settings } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: (req as any).ambassador?.id?.toString(),
        action: "INTEGRATION_CONFIG_UPDATED",
        entity: "IntegrationConfig",
        entityId: name,
        details: { fieldsUpdated: Object.keys(req.body) },
      },
    });

    res.json({ success: true, data: { ...updated, credentials: "***REDACTED***" } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/integrations/:name/test — Test connectivity ──────────────────

router.post("/:name/test", async (req: Request, res: Response) => {
  try {
    const result = await testIntegrationConnection(req.params.name);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── QLink Routes ──────────────────────────────────────────────────────────

router.post("/qlink/export", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { policyIds } = req.body;
    if (!Array.isArray(policyIds) || policyIds.length === 0) {
      return res.status(400).json({ success: false, error: "policyIds array is required" });
    }
    const result = await qlinkService.exportBatch(policyIds);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/qlink/batches", async (_req: Request, res: Response) => {
  try {
    const batches = await prisma.qLinkBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ success: true, data: batches });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/qlink/member-enquiry", async (req: Request, res: Response) => {
  try {
    const { idNumber } = req.body;
    if (!idNumber) {
      return res.status(400).json({ success: false, error: "idNumber is required" });
    }
    const result = await qlinkService.memberEnquiry(idNumber);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/qlink/sync", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await qlinkService.syncPendingBatches();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SagePay Routes ────────────────────────────────────────────────────────

router.post("/sagepay/sync", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await sagePayService.syncTransactions();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/sagepay/validate-bank", async (req: Request, res: Response) => {
  try {
    const { accountNumber, branchCode, accountType } = req.body;
    if (!accountNumber || !branchCode || !accountType) {
      return res
        .status(400)
        .json({ success: false, error: "accountNumber, branchCode, and accountType are required" });
    }
    const result = await sagePayService.validateBankAccount(accountNumber, branchCode, accountType);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/sagepay/banks", async (_req: Request, res: Response) => {
  try {
    const banks = await sagePayService.getBankList();
    res.json({ success: true, data: banks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/sagepay/callback", async (req: Request, res: Response) => {
  // Webhook endpoint -- no auth required for payment gateway callbacks
  try {
    await sagePayService.processCallback(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SMS Portal Routes ─────────────────────────────────────────────────────

router.post("/sms/send", async (req: Request, res: Response) => {
  try {
    const { destination, content, template, vars } = req.body;

    if (template && destination) {
      await smsPortalService.sendFromTemplate(template, destination, vars ?? {});
      return res.json({ success: true, data: { sent: true } });
    }

    if (!destination || !content) {
      return res.status(400).json({ success: false, error: "destination and content are required" });
    }

    const result = await smsPortalService.sendSms(destination, content);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/sms/bulk", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "messages array is required" });
    }
    const result = await smsPortalService.sendBulkSms(messages);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Netcash Routes ────────────────────────────────────────────────────────

router.post("/netcash/validate-bank", async (req: Request, res: Response) => {
  try {
    const { accountNumber, branchCode, accountType } = req.body;
    if (!accountNumber || !branchCode || !accountType) {
      return res
        .status(400)
        .json({ success: false, error: "accountNumber, branchCode, and accountType are required" });
    }
    const result = await netcashService.validateBankAccount(accountNumber, branchCode, accountType);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/netcash/validate-id", async (req: Request, res: Response) => {
  try {
    const { idNumber } = req.body;
    if (!idNumber) {
      return res.status(400).json({ success: false, error: "idNumber is required" });
    }
    const result = await netcashService.validateIdNumber(idNumber);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/netcash/banks", async (_req: Request, res: Response) => {
  try {
    const banks = await netcashService.getBankList();
    res.json({ success: true, data: banks });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Guard Risk Routes ─────────────────────────────────────────────────────

router.post("/guardrisk/export", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { policyIds } = req.body;
    if (!Array.isArray(policyIds) || policyIds.length === 0) {
      return res.status(400).json({ success: false, error: "policyIds array is required" });
    }
    const filePath = await guardRiskService.generateExportCsv(policyIds);
    const uploadResult = await guardRiskService.uploadToSftp(filePath);
    res.json({ success: true, data: { filePath, uploaded: uploadResult.success } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/guardrisk/process-pending", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const result = await guardRiskService.processExports();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ViciDialer Routes ─────────────────────────────────────────────────────

router.post("/vicidialer/upload", async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ success: false, error: "leads array is required" });
    }
    const result = await viciDialerService.uploadLeads(leads);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/vicidialer/add-lead", async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body;
    if (!firstName || !lastName || !phoneNumber) {
      return res
        .status(400)
        .json({ success: false, error: "firstName, lastName, and phoneNumber are required" });
    }
    const result = await viciDialerService.addLead(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── WATI Routes ───────────────────────────────────────────────────────────

router.post("/wati/send", async (req: Request, res: Response) => {
  try {
    const { number, templateName, params, name, regId } = req.body;

    // Convenience: if name and regId provided, send welcome message
    if (name && regId && number) {
      await watiService.sendWelcomeMessage(number, name, regId);
      return res.json({ success: true, data: { sent: true, type: "welcome" } });
    }

    if (!number || !templateName) {
      return res
        .status(400)
        .json({ success: false, error: "number and templateName are required" });
    }

    await watiService.sendTemplateMessage(number, templateName, params ?? []);
    res.json({ success: true, data: { sent: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── File Export History ───────────────────────────────────────────────────

router.get("/files", async (req: Request, res: Response) => {
  try {
    const { importType, status, direction } = req.query;

    const where: any = {};
    if (importType) where.importType = String(importType).toUpperCase();
    if (status) where.status = String(status).toUpperCase();
    if (direction) where.direction = String(direction).toUpperCase();

    const files = await prisma.fileExport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    res.json({ success: true, data: files });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
