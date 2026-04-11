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

    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (status && ["PENDING", "PASSED", "FAILED", "ESCALATED"].includes(status)) {
      where.status = status;
    }

    const [checks, total] = await Promise.all([
      prisma.qualityCheck.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
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
    console.error("List QA checks error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
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
