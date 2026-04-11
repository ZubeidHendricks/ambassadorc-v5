import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── GET /api/dashboard/stats ───────────────────────────────────────────────

router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    const ambassadorId = req.ambassador!.id;

    // Total counts
    const [totalReferrals, totalLeads] = await Promise.all([
      prisma.referral.count({ where: { ambassadorId } }),
      prisma.lead.count({ where: { ambassadorId } }),
    ]);

    // Monthly stats using raw SQL for efficient grouping
    const monthlyReferrals = await prisma.$queryRaw<
      Array<{ month: number; year: number; count: bigint }>
    >`
      SELECT
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        EXTRACT(YEAR FROM "createdAt")::int AS year,
        COUNT(*)::bigint AS count
      FROM referrals
      WHERE "ambassadorId" = ${ambassadorId}
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;

    const monthlyLeads = await prisma.$queryRaw<
      Array<{ month: number; year: number; count: bigint }>
    >`
      SELECT
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        EXTRACT(YEAR FROM "createdAt")::int AS year,
        COUNT(*)::bigint AS count
      FROM leads
      WHERE "ambassadorId" = ${ambassadorId}
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;

    // Merge monthly stats into a unified array
    const monthlyMap = new Map<
      string,
      { month: number; year: number; referralCount: number; leadCount: number }
    >();

    for (const row of monthlyReferrals) {
      const key = `${row.year}-${row.month}`;
      monthlyMap.set(key, {
        month: row.month,
        year: row.year,
        referralCount: Number(row.count),
        leadCount: 0,
      });
    }

    for (const row of monthlyLeads) {
      const key = `${row.year}-${row.month}`;
      const existing = monthlyMap.get(key);
      if (existing) {
        existing.leadCount = Number(row.count);
      } else {
        monthlyMap.set(key, {
          month: row.month,
          year: row.year,
          referralCount: 0,
          leadCount: Number(row.count),
        });
      }
    }

    const monthlyStats = Array.from(monthlyMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    // Yearly total for the current year
    const currentYear = new Date().getFullYear();
    const yearlyTotal = monthlyStats
      .filter((s) => s.year === currentYear)
      .reduce(
        (acc, s) => ({
          referralCount: acc.referralCount + s.referralCount,
          leadCount: acc.leadCount + s.leadCount,
        }),
        { referralCount: 0, leadCount: 0 }
      );

    // Earnings: R100 per 10 referrals submitted, R100 per lead with PAID status
    const paidLeads = await prisma.lead.count({
      where: { ambassadorId, status: "PAID" },
    });

    const convertedReferrals = await prisma.referral.count({
      where: { ambassadorId, status: "CONVERTED" },
    });

    const referralEarnings = Math.floor(totalReferrals / 10) * 100;
    const leadEarnings = paidLeads * 100;

    res.json({
      success: true,
      data: {
        totalReferrals,
        totalLeads,
        monthlyStats,
        yearlyTotal: {
          year: currentYear,
          ...yearlyTotal,
        },
        earnings: {
          referralEarnings,
          leadEarnings,
          totalEarnings: referralEarnings + leadEarnings,
          convertedReferrals,
          paidLeads,
        },
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/dashboard/stats/monthly ───────────────────────────────────────

router.get("/stats/monthly", async (req: AuthRequest, res: Response) => {
  try {
    const ambassadorId = req.ambassador!.id;
    const currentYear = new Date().getFullYear();

    // Detailed monthly breakdown with status counts for the current year
    const monthlyReferrals = await prisma.$queryRaw<
      Array<{
        month: number;
        count: bigint;
        pending: bigint;
        contacted: bigint;
        converted: bigint;
        invalid: bigint;
      }>
    >`
      SELECT
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COUNT(*)::bigint AS count,
        COUNT(*) FILTER (WHERE status = 'PENDING')::bigint AS pending,
        COUNT(*) FILTER (WHERE status = 'CONTACTED')::bigint AS contacted,
        COUNT(*) FILTER (WHERE status = 'CONVERTED')::bigint AS converted,
        COUNT(*) FILTER (WHERE status = 'INVALID')::bigint AS invalid
      FROM referrals
      WHERE "ambassadorId" = ${ambassadorId}
        AND EXTRACT(YEAR FROM "createdAt") = ${currentYear}
      GROUP BY month
      ORDER BY month ASC
    `;

    const monthlyLeads = await prisma.$queryRaw<
      Array<{
        month: number;
        count: bigint;
        new_count: bigint;
        contacted: bigint;
        paid: bigint;
        closed: bigint;
      }>
    >`
      SELECT
        EXTRACT(MONTH FROM "createdAt")::int AS month,
        COUNT(*)::bigint AS count,
        COUNT(*) FILTER (WHERE status = 'NEW')::bigint AS new_count,
        COUNT(*) FILTER (WHERE status = 'CONTACTED')::bigint AS contacted,
        COUNT(*) FILTER (WHERE status = 'PAID')::bigint AS paid,
        COUNT(*) FILTER (WHERE status = 'CLOSED')::bigint AS closed
      FROM leads
      WHERE "ambassadorId" = ${ambassadorId}
        AND EXTRACT(YEAR FROM "createdAt") = ${currentYear}
      GROUP BY month
      ORDER BY month ASC
    `;

    // Build full 12-month array with zero-filled defaults
    const months = Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1;
      const refRow = monthlyReferrals.find((r) => r.month === monthNum);
      const leadRow = monthlyLeads.find((l) => l.month === monthNum);

      return {
        month: monthNum,
        year: currentYear,
        referrals: {
          total: Number(refRow?.count ?? 0),
          pending: Number(refRow?.pending ?? 0),
          contacted: Number(refRow?.contacted ?? 0),
          converted: Number(refRow?.converted ?? 0),
          invalid: Number(refRow?.invalid ?? 0),
        },
        leads: {
          total: Number(leadRow?.count ?? 0),
          new: Number(leadRow?.new_count ?? 0),
          contacted: Number(leadRow?.contacted ?? 0),
          paid: Number(leadRow?.paid ?? 0),
          closed: Number(leadRow?.closed ?? 0),
        },
      };
    });

    res.json({
      success: true,
      data: {
        year: currentYear,
        months,
      },
    });
  } catch (error) {
    console.error("Monthly stats error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
