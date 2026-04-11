import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { createReferralBatchSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── POST /api/referrals/batch ──────────────────────────────────────────────

router.post("/batch", async (req: AuthRequest, res: Response) => {
  try {
    const validation = createReferralBatchSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const { batchName, referrals } = validation.data;
    const ambassadorId = req.ambassador!.id;

    // Check for duplicate contact numbers within the submitted batch
    const contactNos = referrals.map((r) => r.refContactNo);
    const uniqueContactNos = new Set(contactNos);

    if (uniqueContactNos.size !== contactNos.length) {
      res.status(400).json({
        success: false,
        error: "Duplicate contact numbers found within this batch.",
      });
      return;
    }

    // Check for contact numbers already submitted by this ambassador
    const existingReferrals = await prisma.referral.findMany({
      where: {
        ambassadorId,
        refContactNo: { in: contactNos },
      },
      select: { refContactNo: true },
    });

    if (existingReferrals.length > 0) {
      const duplicates = existingReferrals.map((r) => r.refContactNo);
      res.status(409).json({
        success: false,
        error: "Some contact numbers have already been referred by you.",
        data: { duplicateContacts: duplicates },
      });
      return;
    }

    // Create batch and referrals in a transaction for atomicity
    const batch = await prisma.$transaction(async (tx) => {
      const newBatch = await tx.referralBatch.create({
        data: {
          ambassadorId,
          batchName,
        },
      });

      await tx.referral.createMany({
        data: referrals.map((r) => ({
          batchId: newBatch.id,
          ambassadorId,
          refName: r.refName,
          refContactNo: r.refContactNo,
          status: "PENDING" as const,
        })),
      });

      return tx.referralBatch.findUnique({
        where: { id: newBatch.id },
        include: {
          referrals: {
            select: {
              id: true,
              refName: true,
              refContactNo: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });
    });

    res.status(201).json({
      success: true,
      data: batch,
    });
  } catch (error) {
    console.error("Create referral batch error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/referrals/batches ─────────────────────────────────────────────

router.get("/batches", async (req: AuthRequest, res: Response) => {
  try {
    const ambassadorId = req.ambassador!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [batches, total] = await Promise.all([
      prisma.referralBatch.findMany({
        where: { ambassadorId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { referrals: true },
          },
        },
      }),
      prisma.referralBatch.count({ where: { ambassadorId } }),
    ]);

    res.json({
      success: true,
      data: {
        batches: batches.map((b) => ({
          id: b.id,
          batchName: b.batchName,
          referralCount: b._count.referrals,
          createdAt: b.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List referral batches error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/referrals/batch/:id ───────────────────────────────────────────

router.get("/batch/:id", async (req: AuthRequest, res: Response) => {
  try {
    const batchId = parseInt(req.params.id);

    if (isNaN(batchId)) {
      res.status(400).json({ success: false, error: "Invalid batch ID." });
      return;
    }

    const batch = await prisma.referralBatch.findFirst({
      where: {
        id: batchId,
        ambassadorId: req.ambassador!.id,
      },
      include: {
        referrals: {
          select: {
            id: true,
            refName: true,
            refContactNo: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!batch) {
      res.status(404).json({ success: false, error: "Referral batch not found." });
      return;
    }

    res.json({ success: true, data: batch });
  } catch (error) {
    console.error("Get referral batch error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
