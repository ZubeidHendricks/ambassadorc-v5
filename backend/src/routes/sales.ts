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

const router = Router();

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
      if (status) where.status = status;
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
        status: ({ NEW: 'new', QA_PENDING: 'qa_pending', QA_APPROVED: 'approved', QA_REJECTED: 'cancelled', ACTIVE: 'active', CANCELLED: 'cancelled' } as Record<string, string>)[s.status] ?? 'new',
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
      // Map normalized status back to FoxPro patterns
      if (status === 'cancelled') { whereClauses.push(`("Status" ILIKE '%cancel%' OR "Status" ILIKE '%lapse%' OR "Status" ILIKE '%delet%')`); }
      else if (status === 'active') { whereClauses.push(`("Status" ILIKE '%active%' OR "Status" = 'Active Client')`); }
      else if (status === 'approved') { whereClauses.push(`("Status" ILIKE '%passed%' OR "Status" ILIKE '%approved%' OR "Status" ILIKE '%ok%')`); }
      else if (status === 'qa_pending') { whereClauses.push(`("Status" ILIKE '%qa%' OR "Status" ILIKE '%quality%' OR "Status" ILIKE '%pending%' OR "Status" ILIKE '%awaiting%')`); }
      else if (status === 'new') { whereClauses.push(`("Status" NOT ILIKE '%cancel%' AND "Status" NOT ILIKE '%lapse%' AND "Status" NOT ILIKE '%delet%' AND "Status" NOT ILIKE '%active%' AND "Status" NOT ILIKE '%passed%' AND "Status" NOT ILIKE '%approved%' AND "Status" NOT ILIKE '%qa%' AND "Status" NOT ILIKE '%pending%' AND "Status" NOT ILIKE '%awaiting%')`); }
      else { whereClauses.push(`"Status" ILIKE $${p}`); params.push(`%${status}%`); p++; }
    }

    const whereSQL = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const [salesRows, countRow] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT _sync_id::integer as id,
                0 as "clientId",
                CONCAT("FirstName", ' ', "LastName") as "clientName",
                0 as "productId",
                COALESCE("ProductName", 'Unknown') as "productName",
                0 as "agentId",
                COALESCE("SalesAgentUserName", '') as "agentName",
                COALESCE(
                  NULLIF(
                    (SELECT CASE WHEN sp."Amount" ~ '^[0-9]+(\\.[0-9]+)?$' THEN sp."Amount"::numeric ELSE 0 END
                     FROM sync_sagepay_transactions sp WHERE sp."IdNumber" = "IDNumber" AND sp."Amount" IS NOT NULL AND sp."Amount" != '' LIMIT 1),
                    0
                  ),
                  CASE COALESCE("ProductName",'') WHEN 'Life Saver Legal' THEN 129 WHEN 'LegalNet' THEN 129 WHEN 'Life Saver 24' THEN 199 WHEN 'Five-In-One' THEN 199 ELSE 129 END
                ) as "premiumAmount",
                CASE
                  WHEN "Status" ILIKE '%cancel%' OR "Status" ILIKE '%lapse%' OR "Status" ILIKE '%delet%' THEN 'cancelled'
                  WHEN "Status" ILIKE '%active%' OR "Status" = 'Active Client' THEN 'active'
                  WHEN "Status" ILIKE '%passed%' OR "Status" ILIKE '%approved%' OR "Status" ILIKE '%ok%' THEN 'approved'
                  WHEN "Status" ILIKE '%qa%' OR "Status" ILIKE '%quality%' OR "Status" ILIKE '%pending%' OR "Status" ILIKE '%awaiting%' THEN 'qa_pending'
                  ELSE 'new'
                END as status,
                NULL::bigint as "campaignId",
                NULL::text as "campaignName",
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
