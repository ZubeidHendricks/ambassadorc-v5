import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { updateAmbassadorSchema, changeMobileSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── GET /api/ambassadors ───────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [ambassadors, total] = await Promise.all([
      prisma.ambassador.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mobileNo: true,
          province: true,
          department: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ambassador.count(),
    ]);

    res.json({
      success: true,
      data: {
        ambassadors,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List ambassadors error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/ambassadors/:id ───────────────────────────────────────────────

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid ambassador ID." });
      return;
    }

    const ambassador = await prisma.ambassador.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNo: true,
        email: true,
        province: true,
        department: true,
        shopSteward: true,
        union: true,
        town: true,
        location: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!ambassador) {
      res.status(404).json({ success: false, error: "Ambassador not found." });
      return;
    }

    res.json({ success: true, data: ambassador });
  } catch (error) {
    console.error("Get ambassador error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/ambassadors/:id ───────────────────────────────────────────────

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid ambassador ID." });
      return;
    }

    // Only allow ambassadors to update their own profile
    if (req.ambassador!.id !== id) {
      res.status(403).json({
        success: false,
        error: "You can only update your own profile.",
      });
      return;
    }

    const validation = updateAmbassadorSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const ambassador = await prisma.ambassador.update({
      where: { id },
      data: validation.data,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobileNo: true,
        email: true,
        province: true,
        department: true,
        shopSteward: true,
        union: true,
        town: true,
        location: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: ambassador });
  } catch (error) {
    console.error("Update ambassador error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── POST /api/ambassadors/change-mobile ────────────────────────────────────

router.post("/change-mobile", async (req: AuthRequest, res: Response) => {
  try {
    const validation = changeMobileSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { oldNumber, newNumber } = validation.data;

    // Verify old number matches the authenticated ambassador
    if (req.ambassador!.mobileNo !== oldNumber) {
      res.status(400).json({
        success: false,
        error: "Old number does not match your current mobile number.",
      });
      return;
    }

    // Check if new number is already in use
    const existingWithNewNumber = await prisma.ambassador.findUnique({
      where: { mobileNo: newNumber },
    });

    if (existingWithNewNumber) {
      res.status(409).json({
        success: false,
        error: "The new mobile number is already registered to another ambassador.",
      });
      return;
    }

    // Check for pending request
    const pendingRequest = await prisma.numberChangeRequest.findFirst({
      where: {
        ambassadorId: req.ambassador!.id,
        status: "PENDING",
      },
    });

    if (pendingRequest) {
      res.status(409).json({
        success: false,
        error: "You already have a pending number change request.",
      });
      return;
    }

    const request = await prisma.numberChangeRequest.create({
      data: {
        ambassadorId: req.ambassador!.id,
        oldNumber,
        newNumber,
      },
    });

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Change mobile error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
