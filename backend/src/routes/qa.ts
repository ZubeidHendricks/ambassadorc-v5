import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { createQaCheckSchema, updateQaCheckSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";
import { hasSyncTables } from "../lib/syncCheck";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── GET /api/qa ───────────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const statusFilter = (req.query.status as string | undefined)?.toLowerCase();

    const syncAvailable = await hasSyncTables();

    if (syncAvailable) {
      const qaStatusFilter = `(s."Status" ILIKE '%qa%' OR s."Status" ILIKE '%quality%' OR s."Status" ILIKE '%validation%' OR s."Status" ILIKE '%awaiting%')`;
      let verdictFilter = "";
      if (statusFilter === "passed") verdictFilter = ` AND (s."Status" ILIKE '%passed%' OR s."Status" ILIKE '%ok%')`;
      else if (statusFilter === "failed") verdictFilter = ` AND s."Status" ILIKE '%fail%'`;
      else if (statusFilter === "escalated") verdictFilter = ` AND s."Status" ILIKE '%escalat%'`;
      else if (statusFilter === "pending") verdictFilter = ` AND (s."Status" ILIKE '%pending%' OR s."Status" ILIKE '%awaiting%' OR s."Status" ILIKE '%capture%')`;
      const whereSQL = `WHERE ${qaStatusFilter}${verdictFilter}`;

      const [rows, countRow] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT s._sync_id::integer as id, s._sync_id::integer as "saleId",
                  CONCAT(s."FirstName", ' ', s."LastName") as "clientName",
                  COALESCE(s."ProductName", 'Unknown') as "productName",
                  COALESCE(s."SalesAgentUserName", '') as "agentName",
                  COALESCE(NULLIF((SELECT CASE WHEN sp."Amount" ~ '^[0-9]+(\\.[0-9]+)?$' THEN sp."Amount"::numeric ELSE 0 END
                   FROM sync_sagepay_transactions sp WHERE sp."IdNumber" = s."IDNumber" AND sp."Amount" IS NOT NULL AND sp."Amount" != '' LIMIT 1), 0),
                   CASE COALESCE(s."ProductName",'') WHEN 'Life Saver Legal' THEN 129 WHEN 'LegalNet' THEN 129 WHEN 'Life Saver 24' THEN 199 WHEN 'Five-In-One' THEN 199 ELSE 129 END
                  ) as "premiumAmount",
                  CASE WHEN s."Status" ILIKE '%passed%' OR s."Status" ILIKE '%ok%' THEN 'passed'
                       WHEN s."Status" ILIKE '%fail%' THEN 'failed'
                       WHEN s."Status" ILIKE '%escalat%' THEN 'escalated' ELSE 'pending' END as status,
                  s."Status" as verdict, NULL::text as notes, NULL::text as "reviewedBy", NULL::text as "reviewedAt",
                  s._synced_at as "createdAt"
           FROM sync_sales_data s ${whereSQL} ORDER BY s._synced_at DESC LIMIT $1 OFFSET $2`,
          limit, skip
        ),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(`SELECT COUNT(*) as n FROM sync_sales_data s ${whereSQL}`),
      ]);
      const total = Number(countRow[0].n);
      return res.json({ success: true, data: { qualityChecks: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
    }

    // Native Prisma path
    const where: any = statusFilter
      ? { status: statusFilter === "passed" ? "PASSED" : statusFilter === "failed" ? "FAILED" : statusFilter === "escalated" ? "ESCALATED" : "PENDING" }
      : {};
    const [checks, total] = await Promise.all([
      prisma.qualityCheck.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: { sale: { include: { client: { select: { firstName: true, lastName: true } }, product: { select: { name: true } }, agent: { select: { firstName: true, lastName: true } } } }, checker: { select: { firstName: true, lastName: true } } },
      }),
      prisma.qualityCheck.count({ where }),
    ]);
    const rows = checks.map((c: any) => ({
      id: c.id, saleId: c.saleId,
      clientName: c.sale?.client ? `${c.sale.client.firstName} ${c.sale.client.lastName}` : "Unknown",
      productName: c.sale?.product?.name ?? "Unknown",
      agentName: c.sale?.agent ? `${c.sale.agent.firstName} ${c.sale.agent.lastName}` : "Unknown",
      premiumAmount: 129,
      status: c.status?.toLowerCase() ?? "pending",
      verdict: c.verdict,
      notes: c.notes,
      reviewedBy: c.checker ? `${c.checker.firstName} ${c.checker.lastName}` : null,
      reviewedAt: c.updatedAt,
      createdAt: c.createdAt,
    }));
    res.json({ success: true, data: { qualityChecks: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    console.error("List QA checks error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/qa/pending ───────────────────────────────────────────────────

router.get("/pending", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const where = { status: "PENDING" as const };

    const [checks, total] = await Promise.all([
      prisma.qualityCheck.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "asc" }, // oldest first for priority
        include: {
          sale: {
            include: {
              client: { select: { id: true, firstName: true, lastName: true } },
              product: { select: { id: true, name: true, code: true } },
              agent: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          checker: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.qualityCheck.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        qualityChecks: checks,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List pending QA checks error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/qa ──────────────────────────────────────────────────────────

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const validation = createQaCheckSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { saleId } = validation.data;
    const checkerId = req.ambassador!.id;

    // Verify sale exists
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });

    if (!sale) {
      res.status(404).json({ success: false, error: "Sale not found." });
      return;
    }

    // Check for existing pending QA check
    const existingCheck = await prisma.qualityCheck.findFirst({
      where: { saleId, status: "PENDING" },
    });

    if (existingCheck) {
      res.status(409).json({
        success: false,
        error: "A pending QA check already exists for this sale.",
      });
      return;
    }

    const check = await prisma.qualityCheck.create({
      data: {
        saleId,
        checkerId,
      },
      include: {
        sale: {
          include: {
            client: { select: { id: true, firstName: true, lastName: true } },
            product: { select: { id: true, name: true } },
          },
        },
        checker: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update sale status to QA_PENDING
    await prisma.sale.update({
      where: { id: saleId },
      data: { status: "QA_PENDING" },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(checkerId),
        action: "CREATE",
        entity: "QualityCheck",
        entityId: String(check.id),
        details: { saleId },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: check });
  } catch (error) {
    console.error("Create QA check error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/qa/:id ──────────────────────────────────────────────────────

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid QA check ID." });
      return;
    }

    const validation = updateQaCheckSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.qualityCheck.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "QA check not found." });
      return;
    }

    if (existing.status !== "PENDING") {
      res.status(400).json({
        success: false,
        error: "This QA check has already been processed.",
      });
      return;
    }

    const { status, notes } = validation.data;

    const check = await prisma.qualityCheck.update({
      where: { id },
      data: {
        status,
        notes: notes ?? null,
        checkedAt: new Date(),
      },
      include: {
        sale: {
          include: {
            client: { select: { id: true, firstName: true, lastName: true } },
            product: { select: { id: true, name: true } },
          },
        },
        checker: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update sale status based on QA result
    let newSaleStatus: string;
    if (status === "PASSED") {
      newSaleStatus = "QA_APPROVED";
    } else if (status === "FAILED") {
      newSaleStatus = "QA_REJECTED";
    } else {
      newSaleStatus = "QA_PENDING"; // ESCALATED stays pending
    }

    await prisma.sale.update({
      where: { id: existing.saleId },
      data: { status: newSaleStatus as any },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "QA_REVIEW",
        entity: "QualityCheck",
        entityId: String(id),
        details: { saleId: existing.saleId, result: status, notes },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: check });
  } catch (error) {
    console.error("Update QA check error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
