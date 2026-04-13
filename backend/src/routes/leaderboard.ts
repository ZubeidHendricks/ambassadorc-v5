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

    // Both paths: show registered ambassadors, enhanced with FoxPro sales by name match
    let dateFilter = "";
    if (period === "this_week") {
      dateFilter = `AND _synced_at >= NOW() - INTERVAL '7 days'`;
    } else if (period === "this_month") {
      dateFilter = `AND _synced_at >= DATE_TRUNC('month', NOW())`;
    }

    const ambassadors = await prisma.ambassador.findMany({
      where: { isActive: true },
      include: { _count: { select: { sales: true, leads: true, referralBatches: true } } },
      take: 50,
    });

    // FoxPro name-matched sales + lead-to-client conversion counts
    const [foxproRows, convertedRows] = await Promise.all([
      syncAvailable
        ? prisma.$queryRawUnsafe<{ name_key: string; sale_count: number }[]>(
            `SELECT
               LOWER(TRIM("SalesAgentUserName")) as name_key,
               COUNT(*)::integer as sale_count
             FROM sync_sales_data
             WHERE "SalesAgentUserName" IS NOT NULL
               AND TRIM("SalesAgentUserName") != ''
               ${dateFilter}
             GROUP BY LOWER(TRIM("SalesAgentUserName"))`
          )
        : Promise.resolve([] as { name_key: string; sale_count: number }[]),
      syncAvailable && ambassadors.length > 0
        ? prisma.$queryRawUnsafe<{ ambassador_id: bigint; cnt: number }[]>(
            `SELECT l."ambassadorId" as ambassador_id, COUNT(DISTINCT l.id)::integer as cnt
             FROM leads l
             INNER JOIN sync_sales_data sd
               ON REGEXP_REPLACE(COALESCE(sd."CellPhone", ''), '[^0-9]', '', 'g')
                = REGEXP_REPLACE(COALESCE(l."contactNo", ''), '[^0-9]', '', 'g')
               AND LENGTH(REGEXP_REPLACE(COALESCE(l."contactNo", ''), '[^0-9]', '', 'g')) >= 9
               AND (sd."Status" ILIKE '%active%' OR sd."Status" = 'Active Client')
             WHERE l."ambassadorId" = ANY($1::int[])
             GROUP BY l."ambassadorId"`,
            ambassadors.map((a: any) => a.id)
          )
        : Promise.resolve([] as { ambassador_id: bigint; cnt: number }[]),
    ]);

    const foxproMap = new Map<string, number>();
    for (const row of foxproRows) {
      foxproMap.set(row.name_key, Number(row.sale_count));
    }
    const convertedMap = new Map<number, number>();
    for (const row of convertedRows) {
      convertedMap.set(Number(row.ambassador_id), Number(row.cnt));
    }

    const ranked = ambassadors
      .map((a: any) => {
        const nameKey = `${a.firstName} ${a.lastName}`.toLowerCase().trim();
        const sales = Math.max(
          a._count?.sales ?? 0,
          foxproMap.get(nameKey) ?? 0,
          convertedMap.get(a.id) ?? 0
        );
        return {
          name: `${a.firstName} ${a.lastName}`,
          referrals: a._count?.referralBatches ?? 0,
          leads: a._count?.leads ?? 0,
          sales,
          earnings: sales * 109,
          tier: a.tier ?? "Bronze",
          trend: "same" as const,
        };
      })
      .sort((a: any, b: any) => b.sales - a.sales || b.earnings - a.earnings)
      .map((a: any, i: number) => ({ ...a, rank: i + 1 }));

    res.json({ success: true, data: ranked });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

export default router;
