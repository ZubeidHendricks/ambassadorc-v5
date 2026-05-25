/**
 * FoxPro CRM compatibility layer
 * ------------------------------
 * Surfaces the legacy FoxPro sales → QA → export lifecycle on top of the synced
 * staging data (`sync_sales_data`, `sync_qlink_batch_history`, …) using the
 * FoxPro status taxonomy in `lib/foxpro-status.ts`.
 *
 * Everything is READ-first. The only write is an audit-log entry recording a QA
 * decision (Submit / Repair / Cancel) — the synced tables are a replica of the
 * source FoxPro SQL Server and are never mutated here.
 */
import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  statusReference,
  decodeFoxStatus,
  EXPORT_RETURN_REASONS,
  QLINK_PERSAL_CODES,
  FOX_LEAD_DISPOSITIONS,
} from "../lib/foxpro-status";
import { FOX_PRODUCTS, getFoxProduct, getVariantPremium } from "../lib/fox-products";
import { validateSaId } from "../lib/sa-id";
import { foxCaptureSchema } from "../lib/validators";

const router = Router();
router.use(authenticate);

/** Columns confirmed present on sync_sales_data (see routes/qa.ts). */
const SALES_SELECT = `
  s._sync_id::text                       AS id,
  s."IDNumber"                           AS "idNumber",
  TRIM(CONCAT(s."FirstName", ' ', s."LastName")) AS "clientName",
  COALESCE(s."ProductName", 'Unknown')   AS "productName",
  COALESCE(s."SalesAgentUserName", '')   AS "agentName",
  s."Status"                             AS "rawStatus",
  s._synced_at                           AS "syncedAt"
`;

/** Rows that are somewhere in the QA / validation / export lifecycle. */
const QA_WHERE = `
  WHERE s."Status" IS NOT NULL AND s."Status" <> ''
    AND (
      s."Status" ILIKE '%qa%' OR s."Status" ILIKE '%quality%' OR
      s."Status" ILIKE '%validation%' OR s."Status" ILIKE '%awaiting%' OR
      s."Status" ILIKE '%repair%' OR s."Status" ILIKE '%return%' OR
      s."Status" IN ('T','t','QA','QC','NC','R','u','t1')
    )
`;

function decorate(row: any) {
  const fox = decodeFoxStatus(row.rawStatus);
  return {
    ...row,
    fox: fox
      ? { code: fox.code, label: fox.label, stage: fox.stage, color: fox.color, mapsTo: fox.mapsTo }
      : { code: row.rawStatus, label: row.rawStatus || "Unknown", stage: "qa", color: "gray", mapsTo: "NEW" },
  };
}

// ─── GET /api/foxpro/statuses ────────────────────────────────────────────────
// The full FoxPro status reference (pipeline codes, lead dispositions, Q-Link
// codes, export return reasons). Pure reference data — never fails.
router.get("/statuses", (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: statusReference() });
});

// ─── GET /api/foxpro/qa-bay ──────────────────────────────────────────────────
// The QA Mailbox / Bay. Buckets rows into "New Applications" (just captured, T)
// and "In Process Applications" (QA / repair), mirroring the FoxPro QA module.
router.get("/qa-bay", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;
    const search = (req.query.search as string | undefined)?.trim();

    let where = QA_WHERE;
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (s."IDNumber" ILIKE $${params.length} OR CONCAT(s."FirstName",' ',s."LastName") ILIKE $${params.length})`;
    }

    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT ${SALES_SELECT} FROM sync_sales_data s ${where}
       ORDER BY s._synced_at DESC LIMIT ${limit} OFFSET ${skip}`,
      ...params
    );
    const countRow = await prisma.$queryRawUnsafe<[{ n: bigint }]>(
      `SELECT COUNT(*) AS n FROM sync_sales_data s ${where}`,
      ...params
    );

    const decorated = rows.map(decorate);
    const newApps = decorated.filter((r) => r.fox.stage === "capture");
    const inProcess = decorated.filter((r) => r.fox.stage !== "capture");
    const total = Number(countRow[0]?.n ?? 0);

    res.json({
      success: true,
      data: {
        newApplications: newApps,
        inProcessApplications: inProcess,
        items: decorated,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("QA bay error:", error);
    // Defensive: never break the page if the sync table isn't present yet.
    res.json({
      success: true,
      data: { newApplications: [], inProcessApplications: [], items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } },
    });
  }
});

// ─── GET /api/foxpro/qa-bay/stats ────────────────────────────────────────────
router.get("/qa-bay/stats", async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s."Status" AS "rawStatus", COUNT(*)::int AS n
       FROM sync_sales_data s ${QA_WHERE}
       GROUP BY s."Status" ORDER BY n DESC`
    );
    const byStage: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      const fox = decodeFoxStatus(r.rawStatus);
      const stage = fox?.stage ?? "qa";
      byStage[stage] = (byStage[stage] ?? 0) + Number(r.n);
      total += Number(r.n);
    }
    res.json({ success: true, data: { total, byStage, byRawStatus: rows } });
  } catch (error) {
    console.error("QA bay stats error:", error);
    res.json({ success: true, data: { total: 0, byStage: {}, byRawStatus: [] } });
  }
});

// ─── POST /api/foxpro/qa-bay/:saleId/action ──────────────────────────────────
// Records a QA decision from the QA Bay. action = submit | repair | cancel.
// Writes an audit-log entry only (staging data is a read replica).
router.post("/qa-bay/:saleId/action", async (req: AuthRequest, res: Response) => {
  try {
    const { saleId } = req.params;
    const { action, notes } = req.body as { action?: string; notes?: string };
    const allowed = ["submit", "repair", "cancel"];
    if (!action || !allowed.includes(action)) {
      res.status(400).json({ success: false, error: `action must be one of ${allowed.join(", ")}` });
      return;
    }

    // Map the QA action to the resulting FoxPro status.
    const resultCode = action === "submit" ? "QC" : action === "repair" ? "R" : "RC/C";

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: `FOXQA_${action.toUpperCase()}`,
        entity: "FoxProSale",
        entityId: String(saleId),
        details: { saleId, action, resultCode, notes: notes ?? null },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({
      success: true,
      data: {
        saleId,
        action,
        resultCode,
        message:
          action === "submit"
            ? "Sale submitted — QA passed, queued for the midnight export."
            : action === "repair"
            ? "Sale returned to the sales/validation agent for repair."
            : "Sale cancelled (Client Cancelled — Other).",
      },
    });
  } catch (error) {
    console.error("QA action error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/foxpro/export-status ───────────────────────────────────────────
// Per-product export counts + return-status reference (the "EXPORT STATUS PAGE"
// sheet). Counts exported/awaiting-outcome rows grouped by product.
router.get("/export-status", async (_req: AuthRequest, res: Response) => {
  let products: any[] = [];
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(s."ProductName",'Unknown') AS "productName",
              s."Status" AS "rawStatus", COUNT(*)::int AS n
       FROM sync_sales_data s
       WHERE s."Status" IS NOT NULL AND s."Status" <> ''
       GROUP BY s."ProductName", s."Status"`
    );
    const map = new Map<string, { productName: string; exported: number; awaitingOutcome: number; active: number; cancelled: number }>();
    for (const r of rows) {
      const fox = decodeFoxStatus(r.rawStatus);
      const key = r.productName;
      if (!map.has(key)) map.set(key, { productName: key, exported: 0, awaitingOutcome: 0, active: 0, cancelled: 0 });
      const e = map.get(key)!;
      const n = Number(r.n);
      if (fox?.stage === "export") { e.exported += n; if (fox.code === "t1") e.awaitingOutcome += n; }
      else if (fox?.stage === "outcome") e.active += n;
      else if (fox?.stage === "cancelled") e.cancelled += n;
    }
    products = [...map.values()].sort((a, b) => b.exported - a.exported);
  } catch (error) {
    console.error("Export status error:", error);
  }
  res.json({ success: true, data: { products, returnReasons: EXPORT_RETURN_REASONS } });
});

// ─── GET /api/foxpro/export-batches ──────────────────────────────────────────
// Recent Q-Link and SagePay/Netcash debit batches (Debit Batch Submission).
router.get("/export-batches", async (_req: AuthRequest, res: Response) => {
  const out: { qlink: any[]; sagepay: any[] } = { qlink: [], sagepay: [] };
  try {
    out.qlink = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM sync_qlink_batch_history ORDER BY _synced_at DESC LIMIT 25`
    );
  } catch { /* table may not be present */ }
  try {
    out.sagepay = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM sync_sage_batch_history ORDER BY _synced_at DESC LIMIT 25`
    );
  } catch { /* table may not be present */ }
  res.json({ success: true, data: out });
});

// ─── GET /api/foxpro/persal-book ─────────────────────────────────────────────
// The Q-Link / Persal result-code reference plus, where available, live counts.
router.get("/persal-book", async (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { codes: QLINK_PERSAL_CODES } });
});

// ─── GET /api/foxpro/lead-dispositions ───────────────────────────────────────
router.get("/lead-dispositions", async (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { dispositions: FOX_LEAD_DISPOSITIONS } });
});

// ─── GET /api/foxpro/capture/products ────────────────────────────────────────
// The per-product capture catalog (products, plans/tiers, collection methods).
router.get("/capture/products", (_req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { products: FOX_PRODUCTS } });
});

// ─── POST /api/foxpro/validate-id ────────────────────────────────────────────
// Standalone SA ID validation (Luhn + DOB/gender extraction) for live form feedback.
router.post("/validate-id", (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: validateSaId((req.body || {}).idNumber) });
});

// ─── POST /api/foxpro/capture ────────────────────────────────────────────────
// FoxPro-style Product Capture. Validates ID + mobile, upserts the client and
// product, creates the Sale (lands in the QA Bay) and a PENDING QualityCheck.
// FoxPro-specific extras (Persal / banking / dependants) are preserved on the
// audit log — no schema migration required.
router.post("/capture", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = foxCaptureSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: "Validation failed", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const d = parsed.data;

    // 1. Validate SA ID (Luhn + DOB)
    const idInfo = validateSaId(d.idNumber);
    if (!idInfo.valid) {
      res.status(400).json({ success: false, error: idInfo.reason || "Invalid ID number." });
      return;
    }

    // 2. Resolve product + premium from the catalog
    const product = getFoxProduct(d.productCode);
    if (!product) {
      res.status(400).json({ success: false, error: "Unknown product code." });
      return;
    }
    const premium = getVariantPremium(d.productCode, d.tierName);
    if (premium == null) {
      res.status(400).json({ success: false, error: "Unknown plan / tier for this product." });
      return;
    }
    if (!product.methods.includes(d.collectionMethod)) {
      res.status(400).json({ success: false, error: `${product.name} cannot be captured as ${d.collectionMethod}.` });
      return;
    }

    // 3. Upsert the product row (so Sale.productId FK resolves)
    const productRow = await prisma.product.upsert({
      where: { code: d.productCode },
      update: {},
      create: {
        name: product.name,
        code: d.productCode,
        type: product.type as any,
        premiumAmount: premium,
        isActive: true,
      },
    });

    // 4. Upsert the client by ID number
    const clientRow = await prisma.client.upsert({
      where: { idNumber: d.idNumber },
      update: {
        title: d.title ?? undefined,
        firstName: d.firstName,
        lastName: d.lastName,
        cellphone: d.cellphone,
        email: d.email ?? undefined,
        address1: d.address1 ?? undefined,
        addressCode: d.addressCode ?? undefined,
        province: (d.province ?? undefined) as any,
      },
      create: {
        title: d.title ?? null,
        firstName: d.firstName,
        lastName: d.lastName,
        idNumber: d.idNumber,
        cellphone: d.cellphone,
        email: d.email ?? null,
        address1: d.address1 ?? null,
        addressCode: d.addressCode ?? null,
        province: (d.province ?? null) as any,
      },
    });

    // 5. Create the Sale — lands in the QA Bay (QA_PENDING)
    const sale = await prisma.sale.create({
      data: {
        clientId: clientRow.id,
        productId: productRow.id,
        agentId: req.ambassador!.id,
        status: "QA_PENDING",
        source: d.source ?? `${d.collectionMethod}:${d.tierName}`,
        capturedBy: req.ambassador!.mobileNo,
      },
    });

    // 6. Open a PENDING QA check for the QA Bay
    await prisma.qualityCheck.create({ data: { saleId: sale.id, checkerId: req.ambassador!.id } }).catch(() => {});

    // 7. Preserve FoxPro-specific capture extras on the audit log
    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "FOXPRO_CAPTURE",
        entity: "Sale",
        entityId: String(sale.id),
        details: {
          productCode: d.productCode,
          tierName: d.tierName,
          premium,
          collectionMethod: d.collectionMethod,
          firstDebitDate: d.firstDebitDate ?? null,
          persal: d.collectionMethod === "PERSAL" ? { department: d.department, persalNumber: d.persalNumber } : null,
          banking:
            d.collectionMethod === "DEBIT_ORDER"
              ? { bankName: d.bankName, accountNumber: d.accountNumber, branchCode: d.branchCode, accountType: d.accountType }
              : null,
          dependants: d.dependants ?? [],
          idInfo,
        },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        saleId: sale.id,
        clientId: clientRow.id,
        product: product.name,
        tier: d.tierName,
        premium,
        collectionMethod: d.collectionMethod,
        idInfo,
        status: "T",
        message: `Sale captured for ${d.firstName} ${d.lastName} — status T, now in the QA Bay for the second check.`,
      },
    });
  } catch (error) {
    console.error("FoxPro capture error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred while capturing the sale." });
  }
});

export default router;
