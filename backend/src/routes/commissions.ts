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
    const statusFilter = (req.query.status as string | undefined)?.toLowerCase();

    // Derive commissions from sync_sales_data — one record per active/approved sale
    // Status mapping: cancelled/deleted → 'cancelled', qa-passed → 'paid', rest → 'pending'
    let whereSQL = `WHERE "Status" NOT ILIKE '%delet%' AND "Status" IS NOT NULL`;
    if (statusFilter === "paid") {
      whereSQL += ` AND ("Status" ILIKE '%passed%' OR "Status" ILIKE '%active%' OR "Status" ILIKE '%ok%')`;
    } else if (statusFilter === "cancelled") {
      whereSQL += ` AND ("Status" ILIKE '%cancel%' OR "Status" ILIKE '%lapse%')`;
    } else if (statusFilter === "pending") {
      whereSQL += ` AND "Status" NOT ILIKE '%passed%' AND "Status" NOT ILIKE '%cancel%' AND "Status" NOT ILIKE '%lapse%' AND "Status" NOT ILIKE '%active%'`;
    }

    const [rows, countRow] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT _sync_id::integer as id,
                0 as "agentId",
                COALESCE("SalesAgentUserName", 'Unknown') as "agentName",
                _sync_id::integer as "saleId",
                CONCAT("FirstName", ' ', "LastName") as "clientName",
                COALESCE("ProductName", 'Unknown') as "productName",
                0 as amount,
                CASE
                  WHEN "Status" ILIKE '%passed%' OR "Status" ILIKE '%active%' OR "Status" ILIKE '%ok%' THEN 'paid'
                  WHEN "Status" ILIKE '%cancel%' OR "Status" ILIKE '%lapse%' THEN 'cancelled'
                  ELSE 'pending'
                END as status,
                NULL::text as "paidAt",
                _synced_at as "createdAt"
         FROM sync_sales_data
         ${whereSQL}
         ORDER BY _synced_at DESC
         LIMIT $1 OFFSET $2`,
        limit, skip
      ),
      prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(*) as n FROM sync_sales_data ${whereSQL}`
      ),
    ]);

    const total = Number(countRow[0].n);

    res.json({
      success: true,
      data: {
        commissions: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List commissions error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/commissions/summary ──────────────────────────────────────────

router.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const [totalRow, pendingRow, paidRow] = await Promise.all([
      prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(*) as n FROM sync_sales_data WHERE "Status" NOT ILIKE '%delet%' AND "Status" IS NOT NULL`
      ),
      prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(*) as n FROM sync_sales_data
         WHERE "Status" NOT ILIKE '%passed%' AND "Status" NOT ILIKE '%cancel%'
           AND "Status" NOT ILIKE '%lapse%' AND "Status" NOT ILIKE '%active%'
           AND "Status" NOT ILIKE '%delet%' AND "Status" IS NOT NULL`
      ),
      prisma.$queryRawUnsafe<[{ n: bigint }]>(
        `SELECT COUNT(*) as n FROM sync_sales_data
         WHERE ("Status" ILIKE '%passed%' OR "Status" ILIKE '%active%' OR "Status" ILIKE '%ok%')
           AND "Status" NOT ILIKE '%delet%'`
      ),
    ]);

    res.json({
      success: true,
      data: {
        total: { amount: 0, count: Number(totalRow[0].n) },
        pending: { amount: 0, count: Number(pendingRow[0].n) },
        paid: { amount: 0, count: Number(paidRow[0].n) },
      },
    });
  } catch (error) {
    console.error("Commission summary error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
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
