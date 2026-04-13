import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { createQaCheckSchema, updateQaCheckSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

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

    // Map frontend status labels to sync_sales_data Status patterns
    const qaStatusFilter = `("Status" ILIKE '%qa%' OR "Status" ILIKE '%quality%' OR "Status" ILIKE '%validation%' OR "Status" ILIKE '%awaiting%')`;

    let verdictFilter = "";
    if (statusFilter === "passed") {
      verdictFilter = ` AND ("Status" ILIKE '%passed%' OR "Status" ILIKE '%ok%')`;
    } else if (statusFilter === "failed") {
      verdictFilter = ` AND "Status" ILIKE '%fail%'`;
    } else if (statusFilter === "escalated") {
      verdictFilter = ` AND "Status" ILIKE '%escalat%'`;
    } else if (statusFilter === "pending") {
      verdictFilter = ` AND ("Status" ILIKE '%pending%' OR "Status" ILIKE '%awaiting%' OR "Status" ILIKE '%capture%')`;
    }

    const whereSQL = `WHERE ${qaStatusFilter}${verdictFilter}`;

    const [rows, countRow] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT _sync_id::integer as id,
                _sync_id::integer as "saleId",
                CONCAT("FirstName", ' ', "LastName") as "clientName",
                COALESCE("ProductName", 'Unknown') as "productName",
                COALESCE("SalesAgentUserName", '') as "agentName",
                0 as "premiumAmount",
                CASE
                  WHEN "Status" ILIKE '%passed%' OR "Status" ILIKE '%ok%' THEN 'passed'
                  WHEN "Status" ILIKE '%fail%' THEN 'failed'
                  WHEN "Status" ILIKE '%escalat%' THEN 'escalated'
                  ELSE 'pending'
                END as status,
                "Status" as verdict,
                NULL::text as notes,
                NULL::text as "reviewedBy",
                NULL::text as "reviewedAt",
                _synced_at as "createdAt"
         FROM sync_sales_data
         ${whereSQL}
         ORDER BY _synced_at DESC
         LIMIT $1 OFFSET $2`,
        limit, skip
      ),
      prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(*) as n FROM sync_sales_data ${whereSQL}`
      ),
    ]);

    const total = Number(countRow[0].n);

    res.json({
      success: true,
      data: {
        qualityChecks: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
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
