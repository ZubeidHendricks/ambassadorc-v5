import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── GET /api/commissions ──────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Check if admin — admins can see all commissions
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });

    const isAdmin = ambassador?.role === "ADMIN";

    const where: Record<string, unknown> = {};

    if (!isAdmin) {
      where.ambassadorId = req.ambassador!.id;
    }

    const status = req.query.status as string | undefined;
    if (status && ["PENDING", "PAID", "CANCELLED"].includes(status)) {
      where.status = status;
    }

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          ambassador: { select: { id: true, firstName: true, lastName: true } },
          sale: {
            include: {
              client: { select: { id: true, firstName: true, lastName: true } },
              product: { select: { id: true, name: true, code: true } },
            },
          },
        },
      }),
      prisma.commission.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        commissions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List commissions error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/commissions/summary ──────────────────────────────────────────

router.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });

    const isAdmin = ambassador?.role === "ADMIN";

    const baseWhere: Record<string, unknown> = {};
    if (!isAdmin) {
      baseWhere.ambassadorId = req.ambassador!.id;
    }

    const [totalEarned, totalPending, totalPaid] = await Promise.all([
      prisma.commission.aggregate({
        where: { ...baseWhere },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.commission.aggregate({
        where: { ...baseWhere, status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.commission.aggregate({
        where: { ...baseWhere, status: "PAID" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        total: {
          amount: totalEarned._sum.amount || 0,
          count: totalEarned._count,
        },
        pending: {
          amount: totalPending._sum.amount || 0,
          count: totalPending._count,
        },
        paid: {
          amount: totalPaid._sum.amount || 0,
          count: totalPaid._count,
        },
      },
    });
  } catch (error) {
    console.error("Commission summary error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/commissions/:id/pay ──────────────────────────────────────────

router.put("/:id/pay", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid commission ID." });
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
        error: "Only administrators can mark commissions as paid.",
      });
      return;
    }

    const existing = await prisma.commission.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Commission not found." });
      return;
    }

    if (existing.status !== "PENDING") {
      res.status(400).json({
        success: false,
        error: "Only pending commissions can be marked as paid.",
      });
      return;
    }

    const commission = await prisma.commission.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
      include: {
        ambassador: { select: { id: true, firstName: true, lastName: true } },
        sale: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "PAY",
        entity: "Commission",
        entityId: String(id),
        details: {
          ambassadorId: existing.ambassadorId,
          amount: existing.amount.toString(),
        },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: commission });
  } catch (error) {
    console.error("Pay commission error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
