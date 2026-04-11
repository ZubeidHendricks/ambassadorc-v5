import { Router, Response } from "express";
import prisma from "../lib/prisma";
import {
  createWelcomePackSchema,
  recordSignatureSchema,
  requestCallbackSchema,
} from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

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
