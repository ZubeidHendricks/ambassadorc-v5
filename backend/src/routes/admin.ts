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
      // Base: registered ambassadors with native leads/referrals.
      // Sales = max(native sales, FoxPro name-match, lead phone-to-active-client conversions).
      const [ambassadors, ambCount] = await Promise.all([
        prisma.ambassador.findMany({
          skip, take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { sales: true, leads: true, referralBatches: true } },
            assignedCampaign: { select: { id: true, name: true } },
          },
        }),
        prisma.ambassador.count(),
      ]);
      total = ambCount;

      // FoxPro name-matched sales (for ambassadors who are also FoxPro agents)
      const foxproSalesByName = await prisma.$queryRawUnsafe<{ name_key: string; sale_count: number; active_sales: number }[]>(
        `SELECT
           LOWER(TRIM("SalesAgentUserName")) as name_key,
           COUNT(*)::integer as sale_count,
           COUNT(CASE WHEN "Status" ILIKE '%active%' OR "Status" = 'Active Client' THEN 1 END)::integer as active_sales
         FROM sync_sales_data
         WHERE "SalesAgentUserName" IS NOT NULL AND TRIM("SalesAgentUserName") != ''
         GROUP BY LOWER(TRIM("SalesAgentUserName"))`
      );
      const foxproMap = new Map<string, { sale_count: number; active_sales: number }>();
      for (const row of foxproSalesByName) {
        foxproMap.set(row.name_key, { sale_count: Number(row.sale_count), active_sales: Number(row.active_sales) });
      }

      // Lead-to-active-client conversions: leads whose contactNo matches an active FoxPro client
      const ambIds = ambassadors.map((a: any) => a.id);
      let convertedMap = new Map<number, number>();
      if (ambIds.length > 0) {
        const converted = await prisma.$queryRawUnsafe<{ ambassador_id: bigint; cnt: number }[]>(
          `SELECT l."ambassadorId" as ambassador_id, COUNT(DISTINCT l.id)::integer as cnt
           FROM leads l
           INNER JOIN sync_sales_data sd
             ON REGEXP_REPLACE(COALESCE(sd."CellPhone", ''), '[^0-9]', '', 'g')
              = REGEXP_REPLACE(COALESCE(l."contactNo", ''), '[^0-9]', '', 'g')
             AND LENGTH(REGEXP_REPLACE(COALESCE(l."contactNo", ''), '[^0-9]', '', 'g')) >= 9
             AND (sd."Status" ILIKE '%active%' OR sd."Status" = 'Active Client')
           WHERE l."ambassadorId" = ANY($1::int[])
           GROUP BY l."ambassadorId"`,
          ambIds
        );
        for (const row of converted) {
          convertedMap.set(Number(row.ambassador_id), Number(row.cnt));
        }
      }

      agentList = ambassadors.map((a: any) => {
        const nameKey = `${a.firstName} ${a.lastName}`.toLowerCase().trim();
        const fox = foxproMap.get(nameKey);
        const saleCount = Math.max(
          a._count?.sales ?? 0,
          fox?.sale_count ?? 0,
          convertedMap.get(a.id) ?? 0
        );
        const earnings = saleCount * 109;
        return {
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          mobileNo: a.mobileNo,
          role: a.role,
          tier: a.tier ?? "Bronze",
          referralCount: a._count?.referralBatches ?? 0,
          leadCount: a._count?.leads ?? 0,
          saleCount,
          totalEarnings: earnings,
          status: a.isActive ? "active" : "inactive",
          assignedCampaignId: a.assignedCampaignId,
          assignedCampaignName: a.assignedCampaign?.name ?? null,
          createdAt: a.createdAt,
          _count: { sales: saleCount, leads: a._count?.leads ?? 0, referralBatches: a._count?.referralBatches ?? 0 },
          metrics: { totalCommission: earnings, approvedSales: fox?.active_sales ?? convertedMap.get(a.id) ?? 0 },
        };
      });
    } else {
      const [ambassadors, ambCount] = await Promise.all([
        prisma.ambassador.findMany({
          skip, take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { sales: true, leads: true, referralBatches: true } },
            assignedCampaign: { select: { id: true, name: true } },
          },
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
        assignedCampaignId: a.assignedCampaignId,
        assignedCampaignName: a.assignedCampaign?.name ?? null,
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

// ─── PUT /api/admin/agents/:id/campaign ─────────────────────────────────────

router.put("/agents/:id/campaign", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isAdmin(req.ambassador!.id))) {
      res.status(403).json({ success: false, error: "Only administrators can assign campaigns." });
      return;
    }

    const id = parseInt(req.params.id);
    const campaignId = req.body?.campaignId === null || req.body?.campaignId === "" ? null : parseInt(String(req.body?.campaignId));
    if (isNaN(id) || (campaignId !== null && isNaN(campaignId))) {
      res.status(400).json({ success: false, error: "Invalid agent or campaign ID." });
      return;
    }

    const existing = await prisma.ambassador.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Agent not found." });
      return;
    }

    if (campaignId !== null) {
      const campaign = await prisma.salesCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign) {
        res.status(404).json({ success: false, error: "Campaign not found." });
        return;
      }
    }

    const agent = await prisma.ambassador.update({
      where: { id },
      data: { assignedCampaignId: campaignId },
      include: { assignedCampaign: { select: { id: true, name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "ASSIGN_CAMPAIGN",
        entity: "Ambassador",
        entityId: String(id),
        details: { oldCampaignId: existing.assignedCampaignId, newCampaignId: campaignId },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: { ...agent, assignedCampaignName: agent.assignedCampaign?.name ?? null } });
  } catch (error) {
    console.error("Assign campaign error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
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
