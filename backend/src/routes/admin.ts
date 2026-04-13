import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { updateAgentTierSchema, updateAgentRoleSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";
import { hasSyncTables } from "../lib/syncCheck";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Admin role check helper ───────────────────────────────────────────────

async function isAdmin(userId: number): Promise<boolean> {
  const ambassador = await prisma.ambassador.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return ambassador?.role === "ADMIN";
}

// ─── GET /api/admin/stats ──────────────────────────────────────────────────

router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({
        success: false,
        error: "Only administrators can access system stats.",
      });
      return;
    }

    const syncAvailable = await hasSyncTables();

    let totalClients = 0, activePolicies = 0, pendingQA = 0, totalRevenue = 0, totalCommissions = 0, activeAgents = 0, totalAmbassadors = 0;

    if (syncAvailable) {
      const [clientsResult, activePoliciesResult, pendingQAResult, revenueResult, agentsResult, ambassadorsResult] = await Promise.all([
        prisma.$queryRawUnsafe<[{ n: bigint }]>(`SELECT COUNT(DISTINCT "IDNumber") as n FROM sync_sales_data WHERE "IDNumber" IS NOT NULL AND "IDNumber" != ''`),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(`SELECT COUNT(*) as n FROM sync_sales_data WHERE "Status" NOT ILIKE '%cancel%' AND "Status" NOT ILIKE '%delet%' AND "Status" IS NOT NULL`),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(`SELECT COUNT(*) as n FROM sync_sales_data WHERE "Status" ILIKE '%qa%'`),
        prisma.$queryRawUnsafe<[{ total: string | null }]>(`SELECT COALESCE(SUM("Amount"::numeric), 0) as total FROM sync_sagepay_transactions WHERE "Amount" ~ '^[0-9]+(\.[0-9]+)?$'`),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(`SELECT COUNT(DISTINCT TRIM("SalesAgentUserName")) as n FROM sync_sales_data WHERE "SalesAgentUserName" IS NOT NULL AND TRIM("SalesAgentUserName") != ''`),
        Promise.resolve([{ n: BigInt(0) }]),
      ]);
      totalClients = Number(clientsResult[0].n);
      activePolicies = Number(activePoliciesResult[0].n);
      pendingQA = Number(pendingQAResult[0].n);
      totalRevenue = Number(revenueResult[0].total) || 0;
      activeAgents = Number(agentsResult[0].n);
      totalAmbassadors = Number(ambassadorsResult[0].n);
    } else {
      const [clientsResult, policiesResult, qaResult, revenueResult, agentsResult, ambassadorsResult] = await Promise.all([
        prisma.client.count(),
        prisma.policy.count({ where: { status: { not: "CANCELLED" } } }),
        prisma.qualityCheck.count({ where: { status: "PENDING" } }),
        prisma.payment.aggregate({ _sum: { amount: true } }),
        prisma.ambassador.count({ where: { isActive: true } }),
        prisma.ambassador.count(),
      ]);
      totalClients = clientsResult;
      activePolicies = policiesResult;
      pendingQA = qaResult;
      totalRevenue = Number(revenueResult._sum.amount ?? 0);
      activeAgents = agentsResult;
      totalAmbassadors = ambassadorsResult;
    }

    res.json({
      success: true,
      data: {
        clients: { total: totalClients },
        policies: { total: activePolicies, active: activePolicies },
        sales: { active: pendingQA },
        revenue: { total: totalRevenue },
        commissions: {
          total: totalCommissions,
          pending: 0,
        },
        ambassadors: { total: totalAmbassadors, active: activeAgents },
      },
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/admin/audit-log ──────────────────────────────────────────────

router.get("/audit-log", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({
        success: false,
        error: "Only administrators can access the audit log.",
      });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;

    const where: Record<string, unknown> = {};

    if (action) {
      where.action = action;
    }
    if (userId) {
      where.userId = userId;
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        auditLogs: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Audit log error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── GET /api/admin/agents ─────────────────────────────────────────────────

router.get("/agents", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({
        success: false,
        error: "Only administrators can access agent listings.",
      });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const syncAvailableForAgents = await hasSyncTables();

    let agentList: any[] = [];
    let total = 0;

    if (syncAvailableForAgents) {
      const [syncAgentRows, countRow, ambassadors] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT TRIM("SalesAgentUserName") as full_name,
            COUNT(*)::integer as sale_count,
            COUNT(CASE WHEN "Status" = 'Active Client' OR "Status" ILIKE 'active%' THEN 1 END)::integer as active_sales,
            COUNT(CASE WHEN "Status" ILIKE '%cancel%' THEN 1 END)::integer as cancelled_sales,
            MAX(_synced_at) as last_sale_at
           FROM sync_sales_data
           WHERE "SalesAgentUserName" IS NOT NULL AND TRIM("SalesAgentUserName") != ''
           GROUP BY TRIM("SalesAgentUserName")
           ORDER BY sale_count DESC LIMIT $1 OFFSET $2`,
          limit, skip
        ),
        prisma.$queryRawUnsafe<[{ n: bigint }]>(
          `SELECT COUNT(DISTINCT TRIM("SalesAgentUserName")) as n
           FROM sync_sales_data WHERE "SalesAgentUserName" IS NOT NULL AND TRIM("SalesAgentUserName") != ''`
        ),
        prisma.ambassador.findMany({
          select: { id: true, firstName: true, lastName: true, mobileNo: true, role: true, tier: true, isActive: true, createdAt: true },
        }),
      ]);
      total = Number(countRow[0].n);
      const ambassadorMap = new Map<string, typeof ambassadors[0]>();
      for (const amb of ambassadors) {
        const key = `${amb.firstName} ${amb.lastName}`.toLowerCase().trim();
        ambassadorMap.set(key, amb);
      }
      agentList = syncAgentRows.map((row, idx) => {
        const nameParts = (row.full_name as string).split(" ");
        const firstName = nameParts[0] || "Agent";
        const lastName = nameParts.slice(1).join(" ") || String(idx + 1);
        const amb = ambassadorMap.get(row.full_name.toLowerCase());
        const earnings = Number(row.sale_count) * 109;
        return {
          id: amb?.id ?? (10000 + idx),
          firstName, lastName,
          mobileNo: amb?.mobileNo ?? "",
          role: amb?.role ?? "AMBASSADOR",
          tier: amb?.tier ?? "Bronze",
          referralCount: 0, leadCount: 0,
          saleCount: Number(row.sale_count),
          totalEarnings: earnings,
          status: Number(row.sale_count) > 0 ? "active" : "inactive",
          createdAt: amb?.createdAt ?? row.last_sale_at,
          _count: { sales: Number(row.sale_count), leads: 0, referralBatches: 0 },
          metrics: { totalCommission: earnings, approvedSales: Number(row.active_sales) },
        };
      });
    } else {
      const [ambassadors, ambCount] = await Promise.all([
        prisma.ambassador.findMany({
          skip, take: limit,
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { sales: true, leads: true, referralBatches: true } } },
        }),
        prisma.ambassador.count(),
      ]);
      total = ambCount;
      agentList = ambassadors.map((a: any) => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        mobileNo: a.mobileNo,
        role: a.role,
        tier: a.tier ?? "Bronze",
        referralCount: a._count?.referralBatches ?? 0,
        leadCount: a._count?.leads ?? 0,
        saleCount: a._count?.sales ?? 0,
        totalEarnings: (a._count?.sales ?? 0) * 109,
        status: a.isActive ? "active" : "inactive",
        createdAt: a.createdAt,
        _count: { sales: a._count?.sales ?? 0, leads: a._count?.leads ?? 0, referralBatches: a._count?.referralBatches ?? 0 },
        metrics: { totalCommission: (a._count?.sales ?? 0) * 109, approvedSales: 0 },
      }));
    }

    res.json({
      success: true,
      data: {
        agents: agentList,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("List agents error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/admin/agents/:id/tier ────────────────────────────────────────

router.put("/agents/:id/tier", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({
        success: false,
        error: "Only administrators can update agent tiers.",
      });
      return;
    }

    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid agent ID." });
      return;
    }

    const validation = updateAgentTierSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    const existing = await prisma.ambassador.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Agent not found." });
      return;
    }

    const agent = await prisma.ambassador.update({
      where: { id },
      data: { tier: validation.data.tier },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        tier: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "UPDATE_TIER",
        entity: "Ambassador",
        entityId: String(id),
        details: { oldTier: existing.tier, newTier: validation.data.tier },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: agent });
  } catch (error) {
    console.error("Update agent tier error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

// ─── PUT /api/admin/agents/:id/role ────────────────────────────────────────

router.put("/agents/:id/role", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({
        success: false,
        error: "Only administrators can update user roles.",
      });
      return;
    }

    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid agent ID." });
      return;
    }

    const validation = updateAgentRoleSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validation.error.flatten().fieldErrors,
      });
      return;
    }

    // Prevent self-demotion
    if (id === req.ambassador!.id) {
      res.status(400).json({
        success: false,
        error: "You cannot change your own role.",
      });
      return;
    }

    const existing = await prisma.ambassador.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: "Agent not found." });
      return;
    }

    const agent = await prisma.ambassador.update({
      where: { id },
      data: { role: validation.data.role },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        tier: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "UPDATE_ROLE",
        entity: "Ambassador",
        entityId: String(id),
        details: { oldRole: existing.role, newRole: validation.data.role },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: agent });
  } catch (error) {
    console.error("Update agent role error:", error);
    res.status(500).json({
      success: false,
      error: "An unexpected error occurred.",
    });
  }
});

export default router;
