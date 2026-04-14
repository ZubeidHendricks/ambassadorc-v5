import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

router.use(authenticate);

function requireAdmin(req: Request, res: Response): boolean {
  const user = (req as any).ambassador;
  if (!user || user.role !== "ADMIN") {
    res.status(403).json({ success: false, error: "Admin access required" });
    return false;
  }
  return true;
}

// ─── GET /api/ambassador-payments — List payments for the logged-in ambassador

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const ambassadorId = req.ambassador!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.ambassadorPayment.findMany({
        where: { ambassadorId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          type: true,
          status: true,
          reference: true,
          batchRef: true,
          periodStart: true,
          periodEnd: true,
          paidAt: true,
          notes: true,
          createdAt: true,
        },
      }),
      prisma.ambassadorPayment.count({ where: { ambassadorId } }),
    ]);

    const totalPaid = await prisma.ambassadorPayment.aggregate({
      where: { ambassadorId, status: "PAID" },
      _sum: { amount: true },
    });

    const totalPending = await prisma.ambassadorPayment.aggregate({
      where: { ambassadorId, status: "PENDING" },
      _sum: { amount: true },
    });

    res.json({
      success: true,
      data: {
        payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
        summary: {
          totalPaid: Number(totalPaid._sum.amount ?? 0),
          totalPending: Number(totalPending._sum.amount ?? 0),
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List ambassador payments error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/ambassador-payments/all — Admin: all ambassadors' payments ─────

router.get("/all", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status as string | undefined;

    const where: any = {};
    if (statusFilter && ["PENDING", "PAID", "CANCELLED"].includes(statusFilter.toUpperCase())) {
      where.status = statusFilter.toUpperCase();
    }

    const [payments, total] = await Promise.all([
      prisma.ambassadorPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          ambassador: { select: { id: true, firstName: true, lastName: true, mobileNo: true } },
        },
      }),
      prisma.ambassadorPayment.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        payments: payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List all ambassador payments error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/ambassador-payments — Admin: create a payment record ──────────

router.post("/", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const { ambassadorId, amount, type, reference, batchRef, periodStart, periodEnd, notes, leadIds } =
      req.body;

    if (!ambassadorId || !amount || !type) {
      res.status(400).json({ success: false, error: "ambassadorId, amount and type are required." });
      return;
    }

    const payment = await prisma.ambassadorPayment.create({
      data: {
        ambassadorId,
        amount,
        type,
        reference: reference ?? null,
        batchRef: batchRef ?? null,
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        notes: notes ?? null,
        status: "PENDING",
      },
    });

    // If leadIds provided, link them to this payment
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      await prisma.lead.updateMany({
        where: { id: { in: leadIds }, ambassadorId },
        data: { ambassadorPaymentId: payment.id },
      });
    }

    res.status(201).json({ success: true, data: { ...payment, amount: Number(payment.amount) } });
  } catch (error) {
    console.error("Create ambassador payment error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/ambassador-payments/:id/mark-paid — Admin: mark as paid ────────

router.put("/:id/mark-paid", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid payment ID." });
      return;
    }

    const existing = await prisma.ambassadorPayment.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Payment not found." });
      return;
    }

    const payment = await prisma.ambassadorPayment.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date() },
    });

    // If member signup payment, mark linked leads as PAID
    if (payment.type === "MEMBER_SIGNUP_CONVERSION") {
      await prisma.lead.updateMany({
        where: { ambassadorPaymentId: id },
        data: { status: "PAID", datePaid: new Date() },
      });
    }

    res.json({ success: true, data: { ...payment, amount: Number(payment.amount) } });
  } catch (error) {
    console.error("Mark payment paid error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

export default router;
