import { Router, Response } from "express";
import prisma from "../lib/prisma";
import {
  createDebitOrderSchema,
  updateDebitOrderStatusSchema,
  createPaymentSchema,
} from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── POST /api/payments/debit-orders ───────────────────────────────────────

router.post("/debit-orders", async (req: AuthRequest, res: Response) => {
  try {
    const validation = createDebitOrderSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    // Verify client and policy exist
    const [client, policy] = await Promise.all([
      prisma.client.findUnique({ where: { id: data.clientId } }),
      prisma.policy.findUnique({ where: { id: data.policyId } }),
    ]);

    if (!client) {
      res.status(404).json({ success: false, error: "Client not found." });
      return;
    }
    if (!policy) {
      res.status(404).json({ success: false, error: "Policy not found." });
      return;
    }

    const debitOrder = await prisma.debitOrder.create({
      data: {
        clientId: data.clientId,
        policyId: data.policyId,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        branchCode: data.branchCode,
        accountType: data.accountType,
        amount: data.amount,
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        policy: { select: { id: true, policyNumber: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "CREATE",
        entity: "DebitOrder",
        entityId: String(debitOrder.id),
        details: { clientId: data.clientId, policyId: data.policyId },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: debitOrder });
  } catch (error) {
    console.error("Create debit order error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/payments/debit-orders ────────────────────────────────────────

router.get("/debit-orders", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (status && ["ACTIVE", "PAUSED", "CANCELLED", "FAILED"].includes(status)) {
      where.status = status;
    }

    const [debitOrders, total] = await Promise.all([
      prisma.debitOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          policy: { select: { id: true, policyNumber: true } },
        },
      }),
      prisma.debitOrder.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        debitOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List debit orders error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/payments/debit-orders/:id ────────────────────────────────────

router.put("/debit-orders/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid debit order ID." });
      return;
    }

    const validation = updateDebitOrderStatusSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.debitOrder.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Debit order not found." });
      return;
    }

    const debitOrder = await prisma.debitOrder.update({
      where: { id },
      data: { status: validation.data.status },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "STATUS_CHANGE",
        entity: "DebitOrder",
        entityId: String(id),
        details: { oldStatus: existing.status, newStatus: validation.data.status },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: debitOrder });
  } catch (error) {
    console.error("Update debit order error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/payments ────────────────────────────────────────────────────

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const validation = createPaymentSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const data = validation.data;

    // Verify policy and client exist
    const [policy, client] = await Promise.all([
      prisma.policy.findUnique({ where: { id: data.policyId } }),
      prisma.client.findUnique({ where: { id: data.clientId } }),
    ]);

    if (!policy) {
      res.status(404).json({ success: false, error: "Policy not found." });
      return;
    }
    if (!client) {
      res.status(404).json({ success: false, error: "Client not found." });
      return;
    }

    const payment = await prisma.payment.create({
      data: {
        policyId: data.policyId,
        clientId: data.clientId,
        amount: data.amount,
        paymentDate: new Date(data.paymentDate),
        gateway: data.gateway,
        reference: data.reference ?? null,
        status: "PENDING",
      },
    });

    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error("Record payment error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/payments ─────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const status = req.query.status as string | undefined;
    const gateway = req.query.gateway as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const where: Record<string, unknown> = {};

    if (status && ["PENDING", "SUCCESSFUL", "FAILED", "REVERSED"].includes(status)) {
      where.status = status;
    }
    if (gateway && ["SAGEPAY", "NETCASH", "MANUAL"].includes(gateway)) {
      where.gateway = gateway;
    }
    if (dateFrom || dateTo) {
      where.paymentDate = {};
      if (dateFrom) {
        (where.paymentDate as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.paymentDate as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: "desc" },
        include: {
          policy: { select: { id: true, policyNumber: true } },
          client: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List payments error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/payments/summary ─────────────────────────────────────────────

router.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const [totalCollected, totalPending, totalFailed] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: "SUCCESSFUL" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: "FAILED" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    res.json({
      success: true,
      data: {
        collected: {
          total: totalCollected._sum.amount || 0,
          count: totalCollected._count,
        },
        pending: {
          total: totalPending._sum.amount || 0,
          count: totalPending._count,
        },
        failed: {
          total: totalFailed._sum.amount || 0,
          count: totalFailed._count,
        },
      },
    });
  } catch (error) {
    console.error("Payment summary error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
