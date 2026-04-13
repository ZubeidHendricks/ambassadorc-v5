import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { hasSyncTables } from "../lib/syncCheck";

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

    const syncAvailable = await hasSyncTables();

    if (syncAvailable) {
      let whereSQL = `WHERE "Status" NOT ILIKE '%delet%' AND "Status" IS NOT NULL`;
      if (statusFilter === "paid") whereSQL += ` AND ("Status" ILIKE '%passed%' OR "Status" ILIKE '%active%' OR "Status" ILIKE '%ok%')`;
      else if (statusFilter === "cancelled") whereSQL += ` AND ("Status" ILIKE '%cancel%' OR "Status" ILIKE '%lapse%')`;
      else if (statusFilter === "pending") whereSQL += ` AND "Status" NOT ILIKE '%passed%' AND "Status" NOT ILIKE '%cancel%' AND "Status" NOT ILIKE '%lapse%' AND "Status" NOT ILIKE '%active%'`;

      const [rows, countRow] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT s._sync_id::integer as id, 0 as "agentId",
                  COALESCE(s."SalesAgentUserName", 'Unknown') as "agentName",
                  s._sync_id::integer as "saleId",
                  CONCAT(s."FirstName", ' ', s."LastName") as "clientName",
                  COALESCE(s."ProductName", 'Unknown') as "productName",
                  COALESCE(NULLIF((SELECT CASE WHEN sp."Amount" ~ '^[0-9]+(\\.[0-9]+)?$' THEN sp."Amount"::numeric ELSE 0 END
                   FROM sync_sagepay_transactions sp WHERE sp."IdNumber" = s."IDNumber" AND sp."Amount" IS NOT NULL AND sp."Amount" != '' LIMIT 1), 0),
                   CASE COALESCE(s."ProductName",'') WHEN 'Life Saver Legal' THEN 129 WHEN 'LegalNet' THEN 129 WHEN 'Life Saver 24' THEN 199 WHEN 'Five-In-One' THEN 199 ELSE 129 END
                  ) as amount,
                  CASE WHEN s."Status" ILIKE '%passed%' OR s."Status" ILIKE '%active%' OR s."Status" ILIKE '%ok%' THEN 'paid'
                       WHEN s."Status" ILIKE '%cancel%' OR s."Status" ILIKE '%lapse%' THEN 'cancelled' ELSE 'pending' END as status,
                  NULL::text as "paidAt", s._synced_at as "createdAt"
           FROM sync_sales_data s ${whereSQL} ORDER BY s._synced_at DESC LIMIT $1 OFFSET $2`,
          limit, skip
        ),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(`SELECT COUNT(*) as n FROM sync_sales_data s ${whereSQL}`),
      ]);
      const total = Number(countRow[0].n);
      return res.json({ success: true, data: { commissions: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
    }

    // Native Prisma path
    const where: any = statusFilter
      ? { status: statusFilter === "paid" ? "PAID" : statusFilter === "cancelled" ? "CANCELLED" : "PENDING" }
      : {};
    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          ambassador: { select: { id: true, firstName: true, lastName: true } },
          sale: { include: { product: { select: { name: true } }, client: { select: { firstName: true, lastName: true } } } },
        },
      }),
      prisma.commission.count({ where }),
    ]);
    const rows = commissions.map((c: any) => ({
      id: c.id,
      agentId: c.ambassadorId,
      agentName: c.ambassador ? `${c.ambassador.firstName} ${c.ambassador.lastName}` : "Unknown",
      saleId: c.saleId,
      clientName: c.sale?.client ? `${c.sale.client.firstName} ${c.sale.client.lastName}` : "Unknown",
      productName: c.sale?.product?.name ?? "Unknown",
      amount: Number(c.amount ?? 0),
      status: c.status?.toLowerCase() ?? "pending",
      paidAt: c.paidAt,
      createdAt: c.createdAt,
    }));
    res.json({ success: true, data: { commissions: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    console.error("List commissions error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/commissions/summary ──────────────────────────────────────────

router.get("/summary", async (req: AuthRequest, res: Response) => {
  try {
    const syncAvail = await hasSyncTables();

    if (syncAvail) {
      const premiumExpr = `CASE COALESCE("ProductName",'') WHEN 'Life Saver Legal' THEN 129 WHEN 'LegalNet' THEN 129 WHEN 'Life Saver 24' THEN 199 WHEN 'Five-In-One' THEN 199 ELSE 129 END`;
      const [totalRow, pendingRow, paidRow] = await Promise.all([
        prisma.$queryRawUnsafe<[{ n: bigint; amt: string }]>(`SELECT COUNT(*) as n, SUM(${premiumExpr}) as amt FROM sync_sales_data WHERE "Status" NOT ILIKE '%delet%' AND "Status" IS NOT NULL`),
        prisma.$queryRawUnsafe<[{ n: bigint; amt: string }]>(`SELECT COUNT(*) as n, SUM(${premiumExpr}) as amt FROM sync_sales_data WHERE "Status" NOT ILIKE '%passed%' AND "Status" NOT ILIKE '%cancel%' AND "Status" NOT ILIKE '%lapse%' AND "Status" NOT ILIKE '%active%' AND "Status" NOT ILIKE '%delet%' AND "Status" IS NOT NULL`),
        prisma.$queryRawUnsafe<[{ n: bigint; amt: string }]>(`SELECT COUNT(*) as n, SUM(${premiumExpr}) as amt FROM sync_sales_data WHERE ("Status" ILIKE '%passed%' OR "Status" ILIKE '%active%' OR "Status" ILIKE '%ok%') AND "Status" NOT ILIKE '%delet%'`),
      ]);
      return res.json({ success: true, data: {
        total:   { amount: Number(totalRow[0].amt)   || 0, count: Number(totalRow[0].n) },
        pending: { amount: Number(pendingRow[0].amt) || 0, count: Number(pendingRow[0].n) },
        paid:    { amount: Number(paidRow[0].amt)    || 0, count: Number(paidRow[0].n) },
      }});
    }

    // Native path
    const [totalRow, pendingRow, paidRow] = await Promise.all([
      prisma.commission.aggregate({ _sum: { amount: true }, _count: true }),
      prisma.commission.aggregate({ where: { status: "PENDING" }, _sum: { amount: true }, _count: true }),
      prisma.commission.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: true }),
    ]);
    res.json({ success: true, data: {
      total:   { amount: Number(totalRow._sum.amount   ?? 0), count: totalRow._count },
      pending: { amount: Number(pendingRow._sum.amount ?? 0), count: pendingRow._count },
      paid:    { amount: Number(paidRow._sum.amount    ?? 0), count: paidRow._count },
    }});
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
