import { Router, Response } from "express";
import prisma from "../lib/prisma";
import {
  createWelcomePackSchema,
  recordSignatureSchema,
  requestCallbackSchema,
} from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";
import { hasSyncTables } from "../lib/syncCheck";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── GET /api/documents/welcome-pack ──────────────────────────────────────

router.get("/welcome-pack", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const syncAvailable = await hasSyncTables();

    if (syncAvailable) {
      const [rows, countRow] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `WITH paged AS (
             SELECT _sync_id, _synced_at, "MobileNumber", "ProductEndPoint", "SmartbillState", "Date",
                    '0' || SUBSTRING("MobileNumber", 3) AS local_phone
             FROM sync_welcome_pack_history
             ORDER BY "Date" DESC NULLS LAST LIMIT $1 OFFSET $2
           )
           SELECT p._sync_id::integer as id, sd._sync_id::integer as "clientId",
             COALESCE(CONCAT(sd."FirstName", ' ', sd."LastName"), p."MobileNumber") as "clientName",
             0 as "productId",
             COALESCE(p."ProductEndPoint", sd."ProductName", 'Unknown') as "productName",
             CASE WHEN p."SmartbillState" ILIKE '%sign%' THEN 'signed'
                  WHEN p."SmartbillState" ILIKE '%view%' OR p."SmartbillState" ILIKE '%open%' THEN 'viewed' ELSE 'sent' END as status,
             p."Date" as "sentAt", NULL::timestamptz as "viewedAt", NULL::timestamptz as "signedAt",
             NULL::text as "downloadUrl", p._synced_at as "createdAt"
           FROM paged p LEFT JOIN sync_sales_data sd ON sd."CellPhone" = p.local_phone`,
          limit, skip
        ),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(`SELECT COUNT(*) as n FROM sync_welcome_pack_history`),
      ]);
      const total = Number(countRow[0].n);
      return res.json({ success: true, data: { documents: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
    }

    // Native Prisma path — use minimal select to avoid schema mismatch
    const [docs, total] = await Promise.all([
      prisma.welcomePack.findMany({
        skip, take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, clientId: true, status: true, sentAt: true, viewedAt: true, signedAt: true, createdAt: true,
          client: { select: { firstName: true, lastName: true } } },
      }),
      prisma.welcomePack.count(),
    ]);
    const rows = (docs as any[]).map((d) => ({
      id: d.id,
      clientId: d.clientId,
      clientName: d.client ? `${d.client.firstName} ${d.client.lastName}` : "Unknown",
      productId: 0,
      productName: "Unknown",
      status: d.status?.toLowerCase() ?? "sent",
      sentAt: d.sentAt, viewedAt: d.viewedAt, signedAt: d.signedAt,
      downloadUrl: null, createdAt: d.createdAt,
    }));
    res.json({ success: true, data: { documents: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    console.error("List documents error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/documents/welcome-pack ──────────────────────────────────────

router.post("/welcome-pack", async (req: AuthRequest, res: Response) => {
  try {
    const validation = createWelcomePackSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { clientId, policyId, templateName, type } = validation.data;

    // Verify client and policy exist and are linked
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        product: { select: { id: true, name: true } },
      },
    });

    if (!policy) {
      res.status(404).json({ success: false, error: "Policy not found." });
      return;
    }

    if (policy.clientId !== clientId) {
      res.status(400).json({
        success: false,
        error: "The policy does not belong to the specified client.",
      });
      return;
    }

    const welcomePack = await prisma.welcomePack.create({
      data: {
        clientId,
        policyId,
        type: type || "HTML",
        templateName: templateName || "default",
        sentAt: new Date(),
        status: "SENT",
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        policy: {
          select: {
            id: true,
            policyNumber: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "CREATE",
        entity: "WelcomePack",
        entityId: String(welcomePack.id),
        details: { clientId, policyId, templateName },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: welcomePack });
  } catch (error) {
    console.error("Generate welcome pack error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/documents/welcome-pack/:id ───────────────────────────────────

router.get("/welcome-pack/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid welcome pack ID." });
      return;
    }

    const welcomePack = await prisma.welcomePack.findUnique({
      where: { id },
      include: {
        client: true,
        policy: {
          include: {
            product: true,
          },
        },
        documentViews: {
          orderBy: { viewedAt: "desc" },
          take: 10,
        },
        eSignatures: {
          orderBy: { signedAt: "desc" },
          take: 5,
        },
      },
    });

    if (!welcomePack) {
      res.status(404).json({ success: false, error: "Welcome pack not found." });
      return;
    }

    // Return the welcome pack data (in a real system, this could render HTML)
    res.json({ success: true, data: welcomePack });
  } catch (error) {
    console.error("Get welcome pack error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/documents/welcome-pack/:id/view ────────────────────────────

router.post("/welcome-pack/:id/view", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid welcome pack ID." });
      return;
    }

    const welcomePack = await prisma.welcomePack.findUnique({ where: { id } });

    if (!welcomePack) {
      res.status(404).json({ success: false, error: "Welcome pack not found." });
      return;
    }

    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

    // Record the view
    const view = await prisma.documentView.create({
      data: {
        welcomePackId: id,
        clientId: welcomePack.clientId,
        ipAddress: ipAddress.substring(0, 45),
      },
    });

    // Update welcome pack status if first view
    if (welcomePack.status === "SENT") {
      await prisma.welcomePack.update({
        where: { id },
        data: {
          status: "VIEWED",
          viewedAt: new Date(),
        },
      });
    }

    res.status(201).json({ success: true, data: view });
  } catch (error) {
    console.error("Record document view error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/documents/welcome-pack/:id/sign ────────────────────────────

router.post("/welcome-pack/:id/sign", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid welcome pack ID." });
      return;
    }

    const welcomePack = await prisma.welcomePack.findUnique({ where: { id } });

    if (!welcomePack) {
      res.status(404).json({ success: false, error: "Welcome pack not found." });
      return;
    }

    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

    const signature = await prisma.eSignature.create({
      data: {
        welcomePackId: id,
        clientId: welcomePack.clientId,
        ipAddress: ipAddress.substring(0, 45),
      },
    });

    // Update welcome pack status
    await prisma.welcomePack.update({
      where: { id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "SIGN",
        entity: "WelcomePack",
        entityId: String(id),
        details: { clientId: welcomePack.clientId, ipAddress },
        ipAddress: ipAddress.substring(0, 45),
      },
    });

    res.status(201).json({ success: true, data: signature });
  } catch (error) {
    console.error("Record e-signature error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/documents/welcome-pack/:id/callback ─────────────────────────

router.post("/welcome-pack/:id/callback", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid welcome pack ID." });
      return;
    }

    const validation = requestCallbackSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const welcomePack = await prisma.welcomePack.findUnique({ where: { id } });

    if (!welcomePack) {
      res.status(404).json({ success: false, error: "Welcome pack not found." });
      return;
    }

    const callback = await prisma.callbackRequest.create({
      data: {
        clientId: welcomePack.clientId,
        requestedBy: validation.data.requestedBy || String(req.ambassador!.id),
        staffEmail: validation.data.staffEmail ?? null,
        notes: validation.data.notes ?? null,
      },
    });

    res.status(201).json({ success: true, data: callback });
  } catch (error) {
    console.error("Request callback error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
