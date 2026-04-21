import { Router, Response } from "express";
import prisma from "../lib/prisma";
import {
  createSaleSchema,
  updateSaleStatusSchema,
  createCampaignSchema,
  updateCampaignSchema,
} from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";
import { hasSyncTables } from "../lib/syncCheck";
import {
  FOXPRO_STATUS_CASE_SQL,
  FOXPRO_STATUS_DEFINITIONS,
  FoxProStatusGroup,
  foxProStatusLabel,
} from "../lib/foxproStatus";

const router = Router();

async function canViewOperations(userId: number): Promise<boolean> {
  const ambassador = await prisma.ambassador.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return ambassador?.role === "ADMIN" || ambassador?.role === "QA_OFFICER";
}

const nativeSalesStatusToFoxProGroup: Record<string, string> = {
  NEW: "new",
  QA_PENDING: "qa_pending",
  QA_APPROVED: "qa_passed",
  QA_REJECTED: "repair",
  ACTIVE: "qlink_uploaded",
  CANCELLED: "cancelled",
};

const foxProGroupToNativeSalesStatus: Record<string, string[]> = {
  new: ["NEW"],
  qa_pending: ["QA_PENDING"],
  qa_passed: ["QA_APPROVED"],
  exported_awaiting_outcome: ["QA_APPROVED"],
  qlink_uploaded: ["ACTIVE"],
  repair: ["QA_REJECTED"],
  cancelled: ["CANCELLED"],
};

function productPremiumAmount(productName?: string | null, fallback?: number | string | null) {
  const name = (productName ?? "").toLowerCase();
  if (name.includes("24") && name.includes("basic")) return 259;
  if (name.includes("24") && name.includes("plus")) return 349;
  if (name.includes("legal") && name.includes("basic")) return 179;
  if (name.includes("legal") && name.includes("plus")) return 299;
  if (name.includes("five-in-one") || name.includes("five in one")) return 199;
  if (name.includes("life saver 24") || name.includes("lifesaver 24")) return 199;
  if (name.includes("legal")) return 129;
  const numeric = Number(fallback ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function productPremiumSql(alias = "s") {
  return `CASE
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%24%basic%' THEN 259
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%24%plus%' THEN 349
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%legal%basic%' THEN 179
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%legal%plus%' THEN 299
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%five-in-one%' OR COALESCE(${alias}."ProductName", '') ILIKE '%five in one%' THEN 199
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%life saver 24%' OR COALESCE(${alias}."ProductName", '') ILIKE '%lifesaver 24%' THEN 199
    WHEN COALESCE(${alias}."ProductName", '') ILIKE '%legal%' THEN 129
    ELSE 0
  END`;
}

// All routes require authentication
router.use(authenticate);

// ─── POST /api/sales ───────────────────────────────────────────────────────

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const validation = createSaleSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { clientId, productId, source } = validation.data;
    const agentId = req.ambassador!.id;

    // Verify client and product exist
    const [client, product] = await Promise.all([
      prisma.client.findUnique({ where: { id: clientId } }),
      prisma.product.findUnique({ where: { id: productId } }),
    ]);

    if (!client) {
      res.status(404).json({ success: false, error: "Client not found." });
      return;
    }
    if (!product) {
      res.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    const sale = await prisma.sale.create({
      data: {
        clientId,
        productId,
        agentId,
        source: source ?? null,
        capturedBy: `${req.ambassador!.mobileNo}`,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        product: { select: { id: true, name: true, code: true } },
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(agentId),
        action: "CREATE",
        entity: "Sale",
        entityId: String(sale.id),
        details: { clientId, productId, source: source ?? null },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: sale });
  } catch (error) {
    console.error("Create sale error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/sales ────────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const status = req.query.status as string | undefined;
    const agentId = req.query.agentId ? parseInt(req.query.agentId as string) : undefined;
    const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;

    // ── Native Prisma path (production — no sync tables) ──────────────────
    if (!(await hasSyncTables())) {
      const where: any = {};
      if (status) {
        const mappedStatuses = foxProGroupToNativeSalesStatus[status] ?? [status.toUpperCase()];
        where.status = { in: mappedStatuses };
      }
      if (agentId && !isNaN(agentId)) where.agentId = agentId;
      if (productId && !isNaN(productId)) where.productId = productId;

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            client: { select: { id: true, firstName: true, lastName: true } },
            product: { select: { id: true, name: true, premiumAmount: true } },
            agent: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.sale.count({ where }),
      ]);

      const mapped = sales.map((s: any) => ({
        id: s.id,
        clientId: s.clientId,
        clientName: `${s.client.firstName} ${s.client.lastName}`,
        productId: s.productId,
        productName: s.product.name,
        agentId: s.agentId,
        agentName: `${s.agent.firstName} ${s.agent.lastName}`,
        premiumAmount: Number(s.product.premiumAmount ?? 129),
        status: nativeSalesStatusToFoxProGroup[s.status] ?? 'new',
        campaignId: null,
        campaignName: null,
        createdAt: s.createdAt,
      }));

      res.json({
        success: true,
        data: {
          sales: mapped,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        },
      });
      return;
    }

    // ── Sync path (ETL environment) ───────────────────────────────────────

    // Build dynamic WHERE from sync_sales_data columns
    let whereClauses: string[] = [];
    const params: (string | number)[] = [];
    let p = 1;

    if (status) {
      const groupedStatus = FOXPRO_STATUS_DEFINITIONS.some((item) => item.group === status)
        ? status
        : status === "active" || status === "approved"
          ? "qlink_uploaded"
          : null;

      if (groupedStatus) {
        whereClauses.push(`(${FOXPRO_STATUS_CASE_SQL}) = $${p}`);
        params.push(groupedStatus);
        p++;
      } else {
        whereClauses.push(`"Status" ILIKE $${p}`);
        params.push(`%${status}%`);
        p++;
      }
    }

    if (agentId && !isNaN(agentId)) {
      whereClauses.push(`"SalesAgentId" = $${p}`);
      params.push(agentId);
      p++;
    }
    if (productId && !isNaN(productId)) {
      whereClauses.push(`"CampaignID" = $${p}`);
      params.push(productId);
      p++;
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [salesRows, countRow] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT _sync_id::integer as id,
                0 as "clientId",
                CONCAT("FirstName", ' ', "LastName") as "clientName",
                COALESCE("CampaignID", 0)::integer as "productId",
                COALESCE("ProductName", 'Unknown') as "productName",
                COALESCE("SalesAgentId", 0)::integer as "agentId",
                COALESCE("SalesAgentUserName", '') as "agentName",
                COALESCE(
                  NULLIF(
                    (SELECT CASE WHEN sp."Amount" ~ '^[0-9]+(\\.[0-9]+)?$' THEN sp."Amount"::numeric ELSE 0 END
                     FROM sync_sagepay_transactions sp WHERE sp."IdNumber" = "IDNumber" AND sp."Amount" IS NOT NULL AND sp."Amount" != '' LIMIT 1),
                    0
                  ),
                  CASE COALESCE("ProductName",'') WHEN 'Life Saver Legal' THEN 129 WHEN 'LegalNet' THEN 129 WHEN 'Life Saver 24' THEN 199 WHEN 'Five-In-One' THEN 199 ELSE 129 END
                ) as "premiumAmount",
                ${FOXPRO_STATUS_CASE_SQL} as status,
                COALESCE("CampaignID", 0)::bigint as "campaignId",
                COALESCE("ClientGroupName", "DataSource", '') as "campaignName",
                COALESCE("Status", 'Unknown') as "rawStatus",
                _synced_at as "createdAt"
         FROM sync_sales_data
         ${whereSQL}
         ORDER BY _synced_at DESC
         LIMIT $${p} OFFSET $${p + 1}`,
        ...params, limit, skip
      ),
      prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(*) as n FROM sync_sales_data ${whereSQL}`,
        ...params
      ),
    ]);

    const total = Number(countRow[0].n);

    res.json({
      success: true,
      data: {
        sales: salesRows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List sales error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/sales/status-dictionary ───────────────────────────────────────

router.get("/status-dictionary", async (req: AuthRequest, res: Response) => {
  if (!(await canViewOperations(req.ambassador!.id))) {
    res.status(403).json({ success: false, error: "Only operations users can access the status dictionary." });
    return;
  }
  res.json({ success: true, data: { statuses: FOXPRO_STATUS_DEFINITIONS } });
});

// ─── GET /api/sales/export-status ───────────────────────────────────────────

router.get("/export-status", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await canViewOperations(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "Only operations users can access export status." });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const group = (req.query.group as string | undefined) || "";
    const isFoxProStatusGroup = (value: string): value is FoxProStatusGroup =>
      FOXPRO_STATUS_DEFINITIONS.some((item) => item.group === value);

    if (await hasSyncTables()) {
      const caseSQL = FOXPRO_STATUS_CASE_SQL.replaceAll('"Status"', 's."Status"');
      const premiumSQL = productPremiumSql("s");
      const hasGroupFilter = group && isFoxProStatusGroup(group);
      const whereSQL = hasGroupFilter ? `WHERE (${caseSQL}) = $1` : "";
      const limitPlaceholder = hasGroupFilter ? "$2" : "$1";
      const offsetPlaceholder = hasGroupFilter ? "$3" : "$2";
      const statusParams = hasGroupFilter ? [group, limit, skip] : [limit, skip];
      const countParams = hasGroupFilter ? [group] : [];

      const [summaryRows, productRows, returnRows, statusRows, countRow] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT export_group as "group", COUNT(*)::integer as count
           FROM (SELECT ${caseSQL} as export_group FROM sync_sales_data s) grouped
           GROUP BY export_group
           ORDER BY count DESC`
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT COALESCE(s."ProductName", 'Unknown') as "productName",
                  ${premiumSQL}::numeric as "premiumAmount",
                  COUNT(*)::integer as count
           FROM sync_sales_data s
           GROUP BY COALESCE(s."ProductName", 'Unknown'), ${premiumSQL}
           ORDER BY "productName"`
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT return_group as "statusGroup",
                  COALESCE(NULLIF("lastOutcome", ''), NULLIF("subStatus", ''), NULLIF("rawStatus", ''), 'Returned') as reason,
                  COUNT(*)::integer as count
           FROM (
             SELECT ${caseSQL} as return_group,
                    COALESCE(s."Status", '') as "rawStatus",
                    COALESCE(s."SubStatus", '') as "subStatus",
                    COALESCE(s."LastOutcome", '') as "lastOutcome"
             FROM sync_sales_data s
           ) returns
           WHERE return_group IN ('repair', 'cancelled')
           GROUP BY return_group, reason
           ORDER BY count DESC
           LIMIT 5`
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT s._sync_id::integer as id,
                  CONCAT(COALESCE(s."FirstName", ''), ' ', COALESCE(s."LastName", '')) as "clientName",
                  COALESCE(s."ProductName", 'Unknown') as "productName",
                  COALESCE(s."SalesAgentUserName", '') as "agentName",
                  COALESCE(s."Status", 'Unknown') as "rawStatus",
                  COALESCE(s."SubStatus", '') as "subStatus",
                  ${caseSQL} as "statusGroup",
                  s."LastOutcome" as "lastOutcome",
                  s."LastUpdated" as "lastUpdated",
                  s."DateLoaded" as "dateLoaded",
                  s._synced_at as "syncedAt"
           FROM sync_sales_data s
           ${whereSQL}
           ORDER BY s."LastUpdated" DESC NULLS LAST, s._synced_at DESC
           LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
          ...statusParams
        ),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(
          `SELECT COUNT(*) as n FROM sync_sales_data s ${whereSQL}`,
          ...countParams
        ),
      ]);

      const summary = summaryRows.map((row) => ({
        ...row,
        label: foxProStatusLabel(row.group),
      }));

      res.json({
        success: true,
        data: {
          summary,
          productRows: productRows.map((row) => ({
            productName: row.productName,
            premiumAmount: Number(row.premiumAmount ?? 0),
            count: Number(row.count ?? 0),
          })),
          returnRows: returnRows.map((row) => ({
            statusGroup: row.statusGroup,
            reason: row.reason,
            count: Number(row.count ?? 0),
            action: "Switch to Debit Order",
          })),
          statuses: statusRows.map((row) => ({
            ...row,
            label: foxProStatusLabel(row.statusGroup),
          })),
          pagination: { page, limit, total: Number(countRow[0].n), totalPages: Math.ceil(Number(countRow[0].n) / limit) },
        },
      });
      return;
    }

    const nativeWhere: any = {};
    if (group && isFoxProStatusGroup(group)) {
      nativeWhere.status = { in: foxProGroupToNativeSalesStatus[group] ?? [] };
    }
    const [nativeRows, nativeStatusRows, nativeTotal] = await Promise.all([
      prisma.sale.groupBy({ by: ["status"], _count: { status: true } }),
      prisma.sale.findMany({
        where: nativeWhere,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { firstName: true, lastName: true } },
          product: { select: { name: true, premiumAmount: true } },
          agent: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.sale.count({ where: nativeWhere }),
    ]);
    const summaryMap = new Map<string, number>();
    const productMap = new Map<string, { productName: string; premiumAmount: number; count: number }>();
    const returnMap = new Map<string, { statusGroup: string; reason: string; count: number; action: string }>();
    for (const row of nativeRows) {
      const grouped = nativeSalesStatusToFoxProGroup[String(row.status)] ?? "new";
      summaryMap.set(grouped, (summaryMap.get(grouped) ?? 0) + row._count.status);
    }
    for (const sale of nativeStatusRows) {
      const productName = sale.product?.name ?? "Unknown";
      const premiumAmount = productPremiumAmount(productName, sale.product?.premiumAmount ?? 0);
      const productKey = `${productName}|${premiumAmount}`;
      const productRow = productMap.get(productKey) ?? { productName, premiumAmount, count: 0 };
      productRow.count += 1;
      productMap.set(productKey, productRow);
      const statusGroup = nativeSalesStatusToFoxProGroup[String(sale.status)] ?? "new";
      if (statusGroup === "repair" || statusGroup === "cancelled") {
        const reason = statusGroup === "repair" ? "Returned QA repair required" : "Returned client cancelled";
        const returnRow = returnMap.get(reason) ?? { statusGroup, reason, count: 0, action: "Switch to Debit Order" };
        returnRow.count += 1;
        returnMap.set(reason, returnRow);
      }
    }
    const summary = [...summaryMap.entries()].map(([statusGroup, count]) => ({
      group: statusGroup,
      label: foxProStatusLabel(statusGroup),
      count,
    }));
    res.json({
      success: true,
      data: {
        summary,
        productRows: [...productMap.values()].sort((a, b) => a.productName.localeCompare(b.productName)),
        returnRows: [...returnMap.values()].sort((a, b) => b.count - a.count),
        statuses: nativeStatusRows.map((sale) => {
          const statusGroup = nativeSalesStatusToFoxProGroup[String(sale.status)] ?? "new";
          return {
            id: sale.id,
            clientName: sale.client ? `${sale.client.firstName} ${sale.client.lastName}` : "Unknown",
            productName: sale.product?.name ?? "Unknown",
            agentName: sale.agent ? `${sale.agent.firstName} ${sale.agent.lastName}` : "",
            rawStatus: String(sale.status),
            subStatus: "",
            statusGroup,
            label: foxProStatusLabel(statusGroup),
            lastOutcome: null,
            lastUpdated: sale.updatedAt,
            dateLoaded: sale.createdAt,
            syncedAt: sale.createdAt,
          };
        }),
        pagination: { page, limit, total: nativeTotal, totalPages: Math.ceil(nativeTotal / limit) },
      },
    });
  } catch (error) {
    console.error("Export status error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/sales/:id/status ─────────────────────────────────────────────

router.put("/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid sale ID." });
      return;
    }

    const validation = updateSaleStatusSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.sale.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Sale not found." });
      return;
    }

    const sale = await prisma.sale.update({
      where: { id },
      data: { status: validation.data.status },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        product: { select: { id: true, name: true } },
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "STATUS_CHANGE",
        entity: "Sale",
        entityId: String(id),
        details: { oldStatus: existing.status, newStatus: validation.data.status },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: sale });
  } catch (error) {
    console.error("Update sale status error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/sales/campaigns ──────────────────────────────────────────────

router.get("/campaigns", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.salesCampaign.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { assignedAmbassadors: true } },
        },
      }),
      prisma.salesCampaign.count(),
    ]);

    res.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List campaigns error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/sales/campaigns ─────────────────────────────────────────────

router.post("/campaigns", async (req: AuthRequest, res: Response) => {
  try {
    // Check admin role
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });

    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: "Only administrators can create campaigns.",
      });
      return;
    }

    const validation = createCampaignSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    const campaign = await prisma.salesCampaign.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    console.error("Create campaign error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/sales/campaigns/:id ──────────────────────────────────────────

router.put("/campaigns/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid campaign ID." });
      return;
    }

    // Check admin role
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });

    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: "Only administrators can update campaigns.",
      });
      return;
    }

    const validation = updateCampaignSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.salesCampaign.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Campaign not found." });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (validation.data.name !== undefined) updateData.name = validation.data.name;
    if (validation.data.description !== undefined) updateData.description = validation.data.description;
    if (validation.data.startDate !== undefined) updateData.startDate = new Date(validation.data.startDate);
    if (validation.data.endDate !== undefined) updateData.endDate = validation.data.endDate ? new Date(validation.data.endDate) : null;
    if (validation.data.isActive !== undefined) updateData.isActive = validation.data.isActive;

    const campaign = await prisma.salesCampaign.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, data: campaign });
  } catch (error) {
    console.error("Update campaign error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
