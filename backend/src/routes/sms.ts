import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { sendSmsSchema, bulkSmsSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── POST /api/sms/send ────────────────────────────────────────────────────

router.post("/send", async (req: AuthRequest, res: Response) => {
  try {
    const validation = sendSmsSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { recipientNumber, message, type } = validation.data;

    const sms = await prisma.smsMessage.create({
      data: {
        recipientNumber,
        messageBody: message,
        type,
        status: "QUEUED",
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "SEND_SMS",
        entity: "SmsMessage",
        entityId: String(sms.id),
        details: { recipientNumber, type },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: sms });
  } catch (error) {
    console.error("Send SMS error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/sms/bulk ────────────────────────────────────────────────────

router.post("/bulk", async (req: AuthRequest, res: Response) => {
  try {
    const validation = bulkSmsSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { numbers, message, type } = validation.data;

    const smsRecords = numbers.map((number) => ({
      recipientNumber: number,
      messageBody: message,
      type,
      status: "QUEUED" as const,
    }));

    const result = await prisma.smsMessage.createMany({
      data: smsRecords,
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "BULK_SMS",
        entity: "SmsMessage",
        entityId: "bulk",
        details: { recipientCount: numbers.length, type },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        queued: result.count,
        message: `${result.count} SMS messages queued for delivery.`,
      },
    });
  } catch (error) {
    console.error("Bulk SMS error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/sms ──────────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};

    if (type && ["WELCOME", "QA_VERIFY", "PREMIUM_INCREASE", "CALLBACK", "AMBASSADOR", "AGENT_CAPTURE"].includes(type)) {
      where.type = type;
    }
    if (status && ["QUEUED", "SENT", "DELIVERED", "FAILED"].includes(status)) {
      where.status = status;
    }

    const [messages, total] = await Promise.all([
      prisma.smsMessage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.smsMessage.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List SMS messages error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/sms/templates ────────────────────────────────────────────────

router.get("/templates", (_req: AuthRequest, res: Response) => {
  const templates = [
    { id: "welcome", name: "Welcome Message", body: "Welcome to AmbassadorC! Your policy is now active. For queries call 0800 000 000." },
    { id: "qa_verify", name: "QA Verification", body: "Hi {name}, your sale is currently under Quality Assurance review. We will contact you shortly." },
    { id: "premium_increase", name: "Premium Increase Notice", body: "Dear {name}, please note your monthly premium will increase to R{amount} effective {date}." },
    { id: "payment_reminder", name: "Payment Reminder", body: "Hi {name}, your premium of R{amount} is due on {date}. Please ensure sufficient funds are available." },
    { id: "callback", name: "Callback Confirmation", body: "Hi {name}, a consultant will call you back within 24 hours. Thank you for your patience." },
    { id: "cancellation", name: "Cancellation Notice", body: "Dear {name}, your policy cancellation has been processed. Contact us if this was in error." },
  ];
  res.json({ success: true, data: { templates } });
});

// ─── POST /api/sms/premium-increase ────────────────────────────────────────

router.post("/premium-increase", async (req: AuthRequest, res: Response) => {
  try {
    // Check admin role
    const ambassador = await prisma.ambassador.findUnique({
      where: { id: req.ambassador!.id },
      select: { role: true },
    });

    if (ambassador?.role !== "ADMIN") {
      res.status(403).json({
        success: false,
        error: "Only administrators can send premium increase notifications.",
      });
      return;
    }

    // Find all approved premium changes that have not been notified
    const pendingChanges = await prisma.premiumChange.findMany({
      where: {
        status: "APPROVED",
        effectiveDate: { gte: new Date() },
      },
      include: {
        policy: {
          include: {
            client: { select: { id: true, firstName: true, cellphone: true } },
          },
        },
      },
    });

    if (pendingChanges.length === 0) {
      res.json({
        success: true,
        data: { queued: 0, message: "No pending premium changes to notify." },
      });
      return;
    }

    const smsRecords = pendingChanges.map((change) => ({
      recipientNumber: change.policy.client.cellphone,
      messageBody: `Dear ${change.policy.client.firstName}, your premium for policy ${change.policy.policyNumber} will change from R${change.oldAmount} to R${change.newAmount} effective ${change.effectiveDate.toISOString().split("T")[0]}. Contact us for queries.`,
      type: "PREMIUM_INCREASE" as const,
      status: "QUEUED" as const,
    }));

    const result = await prisma.smsMessage.createMany({
      data: smsRecords,
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "PREMIUM_INCREASE_NOTIFICATION",
        entity: "SmsMessage",
        entityId: "bulk",
        details: { notifiedCount: result.count },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        queued: result.count,
        message: `${result.count} premium increase notification(s) queued.`,
      },
    });
  } catch (error) {
    console.error("Premium increase SMS error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
