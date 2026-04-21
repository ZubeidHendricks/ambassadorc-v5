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

function paymentNote(existing: string | null, next: string): string {
  const combined = [existing, next].filter(Boolean).join(" | ");
  return combined.length > 500 ? combined.slice(combined.length - 500) : combined;
}

function toCsvValue(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function completePayment(id: number, userId: number, ipAddress?: string | null) {
  const existing = await prisma.ambassadorPayment.findUnique({ where: { id } });

  const payment = await prisma.ambassadorPayment.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt: new Date(),
      notes: paymentNote(existing?.notes ?? null, "Paid file imported and ambassador backend table updated"),
    },
    include: {
      ambassador: { select: { firstName: true, lastName: true, mobileNo: true } },
    },
  });

  await prisma.lead.updateMany({
    where: { ambassadorPaymentId: id, type: "MEMBER_SIGNUP" },
    data: { status: "PAID", datePaid: new Date() },
  });

  await prisma.smsMessage.create({
    data: {
      recipientNumber: payment.ambassador.mobileNo,
      messageBody: `Hi ${payment.ambassador.firstName}, your Ambassador payment of R${Number(payment.amount).toFixed(2)} has been processed.`,
      status: "QUEUED",
      type: "AMBASSADOR",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: String(userId),
      action: "AMBASSADOR_PAYMENT_IMPORTED",
      entity: "AmbassadorPayment",
      entityId: String(id),
      details: { amount: Number(payment.amount), ambassadorId: payment.ambassadorId },
      ipAddress: ipAddress ?? null,
    },
  });

  return payment;
}

async function getOperationalRows() {
  const ambassadors = await prisma.ambassador.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      mobileNo: true,
      referrals: { select: { id: true, status: true } },
      leads: { select: { id: true, type: true, status: true } },
      ambassadorPayments: {
        select: {
          id: true,
          amount: true,
          status: true,
          type: true,
          reference: true,
          batchRef: true,
          paidAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return ambassadors.map((ambassador) => {
    const referralLeadCount =
      ambassador.referrals.length + ambassador.leads.filter((lead) => lead.type === "REFERRAL_LEAD").length;
    const confirmedNumbers =
      ambassador.referrals.filter((referral) => ["CONTACTED", "CONVERTED"].includes(referral.status)).length +
      ambassador.leads.filter((lead) => lead.type === "REFERRAL_LEAD" && ["CONTACTED", "PAID"].includes(lead.status)).length;
    const memberSignupCount = ambassador.leads.filter((lead) => lead.type === "MEMBER_SIGNUP").length;
    const salesCount = ambassador.leads.filter((lead) => lead.type === "MEMBER_SIGNUP" && lead.status === "PAID").length;
    const referralValue = Math.floor(referralLeadCount / 10) * 100;
    const memberSignupValue = salesCount * 100;
    const bonus = salesCount >= 10 ? 1000 : 0;
    const totalEarned = referralValue + memberSignupValue + bonus;
    const paid = ambassador.ambassadorPayments
      .filter((payment) => payment.status === "PAID")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const pending = ambassador.ambassadorPayments
      .filter((payment) => payment.status === "PENDING")
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const amountDue = Math.max(0, totalEarned - paid - pending);
    const latestPayment = ambassador.ambassadorPayments
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    return {
      ambassadorId: ambassador.id,
      name: ambassador.firstName,
      surname: ambassador.lastName,
      mobileNo: ambassador.mobileNo,
      referrals: referralLeadCount,
      confirmedNumbers,
      memberSignup: memberSignupCount,
      sales: salesCount,
      valueRands: referralValue + memberSignupValue,
      bonus,
      totalForPayment: totalEarned,
      alreadyPaid: paid,
      pendingPayment: pending,
      amountDue,
      paymentStatus: amountDue > 0 ? "DUE" : pending > 0 ? "PENDING" : totalEarned > 0 ? "YES" : "NO ACTIVITY",
      latestPayment,
    };
  });
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

router.get("/operations", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = await getOperationalRows();
    const summary = rows.reduce(
      (acc, row) => ({
        referrals: acc.referrals + row.referrals,
        memberSignups: acc.memberSignups + row.memberSignup,
        sales: acc.sales + row.sales,
        totalEarned: acc.totalEarned + row.totalForPayment,
        pendingPayment: acc.pendingPayment + row.pendingPayment,
        amountDue: acc.amountDue + row.amountDue,
      }),
      { referrals: 0, memberSignups: 0, sales: 0, totalEarned: 0, pendingPayment: 0, amountDue: 0 }
    );

    res.json({ success: true, data: { rows, summary } });
  } catch (error) {
    console.error("Ambassador operations error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

router.post("/generate-due", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const rows = (await getOperationalRows()).filter((row) => row.amountDue > 0);
    const batchRef = `AMB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const created = [];

    for (const row of rows) {
      const payment = await prisma.ambassadorPayment.create({
        data: {
          ambassadorId: row.ambassadorId,
          amount: row.amountDue,
          type: "MANUAL",
          status: "PENDING",
          reference: `AMB-${row.ambassadorId}-${Date.now()}`,
          batchRef,
          notes: `Generated from ambassador backend: ${row.referrals} referral leads, ${row.memberSignup} member signups, ${row.sales} successful sales`,
        },
      });
      created.push({ ...payment, amount: Number(payment.amount) });
    }

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "AMBASSADOR_PAYMENT_BATCH_CREATED",
        entity: "AmbassadorPayment",
        entityId: batchRef,
        details: { count: created.length, total: created.reduce((sum, payment) => sum + Number(payment.amount), 0) },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: { batchRef, payments: created } });
  } catch (error) {
    console.error("Generate ambassador payments error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

router.get("/export-fnb.csv", async (req: AuthRequest, res: Response) => {
  if (!requireAdmin(req, res)) return;

  try {
    const payments = await prisma.ambassadorPayment.findMany({
      where: { status: "PENDING" },
      include: { ambassador: { select: { firstName: true, lastName: true, mobileNo: true } } },
      orderBy: { createdAt: "asc" },
    });

    const header = ["Date Submitted", "Name", "Surname", "Mobile Number", "Amount", "Reference", "Batch", "Status"];
    const rows = payments.map((payment) => [
      payment.createdAt.toISOString().slice(0, 10),
      payment.ambassador.firstName,
      payment.ambassador.lastName,
      payment.ambassador.mobileNo,
      Number(payment.amount).toFixed(2),
      payment.reference ?? `AMB-${payment.id}`,
      payment.batchRef ?? "",
      "PENDING",
    ]);

    const csv = [header, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="Ambassador_FNB_Payments_${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error("Export FNB CSV error:", error);
    res.status(500).json({ success: false, error: "Failed to export payment CSV." });
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

    const payment = await completePayment(id, req.ambassador!.id, req.ip ?? null);

    res.json({ success: true, data: { ...payment, amount: Number(payment.amount) } });
  } catch (error) {
    console.error("Mark payment paid error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

router.put("/:id/authorise", async (req: AuthRequest, res: Response) => {
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
    if (existing.status !== "PENDING") {
      res.status(400).json({ success: false, error: "Only pending payments can be authorised." });
      return;
    }

    const payment = await prisma.ambassadorPayment.update({
      where: { id },
      data: {
        reference: existing.reference ?? `AUTH-${id}-${Date.now()}`,
        notes: paymentNote(existing.notes, "FNB payment authorised"),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "AMBASSADOR_PAYMENT_AUTHORISED",
        entity: "AmbassadorPayment",
        entityId: String(id),
        details: { amount: Number(payment.amount), ambassadorId: payment.ambassadorId },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: { ...payment, amount: Number(payment.amount) } });
  } catch (error) {
    console.error("Authorise ambassador payment error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

router.put("/:id/import-paid", async (req: AuthRequest, res: Response) => {
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
    if (existing.status !== "PENDING") {
      res.status(400).json({ success: false, error: "Only pending payments can be imported as paid." });
      return;
    }

    const payment = await completePayment(id, req.ambassador!.id, req.ip ?? null);
    res.json({ success: true, data: { ...payment, amount: Number(payment.amount) } });
  } catch (error) {
    console.error("Import paid ambassador payment error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

export default router;
