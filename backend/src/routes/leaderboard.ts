import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { hasSyncTables } from "../lib/syncCheck";

const router = Router();

router.use(authenticate);

// ─── GET /api/leaderboard ───────────────────────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as string | undefined) ?? "all_time";
    const syncAvailable = await hasSyncTables();

    if (syncAvailable) {
      let dateFilter = "";
      if (period === "this_week") {
        dateFilter = `AND _synced_at >= NOW() - INTERVAL '7 days'`;
      } else if (period === "this_month") {
        dateFilter = `AND _synced_at >= DATE_TRUNC('month', NOW())`;
      }

      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
           ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rank,
           TRIM("SalesAgentUserName") as name,
           COUNT(*)::integer as sales,
           0 as referrals,
           0 as leads,
           (COUNT(*) * 109)::integer as earnings,
           'Bronze' as tier
         FROM sync_sales_data
         WHERE "SalesAgentUserName" IS NOT NULL
           AND TRIM("SalesAgentUserName") != ''
           ${dateFilter}
         GROUP BY TRIM("SalesAgentUserName")
         ORDER BY sales DESC
         LIMIT 50`
      );

      return res.json({
        success: true,
        data: rows.map((r: any) => ({
          rank: Number(r.rank),
          name: r.name,
          referrals: Number(r.referrals),
          leads: Number(r.leads),
          sales: Number(r.sales),
          earnings: Number(r.earnings),
          tier: r.tier,
          trend: "same" as const,
        })),
      });
    }

    // Native Prisma path — ambassadors with _count
    const ambassadors = await prisma.ambassador.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { sales: true, leads: true, referralBatches: true } },
      },
      take: 50,
    });

    const ranked = ambassadors
      .map((a: any) => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        referrals: a._count.referralBatches ?? 0,
        leads: a._count.leads ?? 0,
        sales: a._count.sales ?? 0,
        earnings: (a._count.sales ?? 0) * 109,
        tier: a.tier ?? "Bronze",
        trend: "same" as const,
      }))
      .sort((a: any, b: any) => b.sales - a.sales || b.earnings - a.earnings)
      .map((a: any, i: number) => ({ ...a, rank: i + 1 }));

    res.json({ success: true, data: ranked });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

export default router;
