import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { createLeadSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── POST /api/leads ────────────────────────────────────────────────────────

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const validation = createLeadSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { firstName, lastName, contactNo, preferredContact } = validation.data;
    const ambassadorId = req.ambassador!.id;

    // Check for duplicate contact number for this ambassador
    const existingLead = await prisma.lead.findFirst({
      where: {
        ambassadorId,
        contactNo,
      },
    });

    if (existingLead) {
      res.status(409).json({
        success: false,
        error: "You have already submitted a lead with this contact number.",
      });
      return;
    }

    const lead = await prisma.lead.create({
      data: {
        ambassadorId,
        firstName,
        lastName,
        contactNo,
        preferredContact: preferredContact ?? null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        contactNo: true,
        preferredContact: true,
        status: true,
        datePaid: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    console.error("Create lead error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/leads ─────────────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const ambassadorId = req.ambassador!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Optional status filter
    const statusFilter = req.query.status as string | undefined;
    const where: Record<string, unknown> = { ambassadorId };

    if (statusFilter && ["NEW", "CONTACTED", "PAID", "CLOSED"].includes(statusFilter)) {
      where.status = statusFilter;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          contactNo: true,
          preferredContact: true,
          status: true,
          datePaid: true,
          createdAt: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        leads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List leads error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
