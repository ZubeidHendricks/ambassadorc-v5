import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { updateAgentTierSchema, updateAgentRoleSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";

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

    const [
      totalClients,
      totalPolicies,
      activePolicies,
      activeSales,
      totalRevenue,
      totalCommissions,
      pendingCommissions,
      totalAmbassadors,
      activeAmbassadors,
    ] = await Promise.all([
      prisma.client.count(),
      prisma.policy.count(),
      prisma.policy.count({ where: { status: "ACTIVE" } }),
      prisma.sale.count({ where: { status: { in: ["NEW", "QA_PENDING"] } } }),
      prisma.payment.aggregate({
        where: { status: "SUCCESSFUL" },
        _sum: { amount: true },
      }),
      prisma.commission.aggregate({
        _sum: { amount: true },
      }),
      prisma.commission.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
      }),
      prisma.ambassador.count(),
      prisma.ambassador.count({ where: { isActive: true } }),
    ]);

    res.json({
      success: true,
      data: {
        clients: { total: totalClients },
        policies: { total: totalPolicies, active: activePolicies },
        sales: { active: activeSales },
        revenue: { total: totalRevenue._sum.amount || 0 },
        commissions: {
          total: totalCommissions._sum.amount || 0,
          pending: pendingCommissions._sum.amount || 0,
        },
        ambassadors: { total: totalAmbassadors, active: activeAmbassadors },
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
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [agents, total] = await Promise.all([
      prisma.ambassador.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mobileNo: true,
          email: true,
          role: true,
          tier: true,
          province: true,
          department: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              sales: true,
              commissions: true,
              leads: true,
              referralBatches: true,
            },
          },
        },
      }),
      prisma.ambassador.count(),
    ]);

    // Enrich with performance metrics
    const agentsWithMetrics = await Promise.all(
      agents.map(async (agent) => {
        const [commissionTotal, salesApproved] = await Promise.all([
          prisma.commission.aggregate({
            where: { ambassadorId: agent.id },
            _sum: { amount: true },
          }),
          prisma.sale.count({
            where: { agentId: agent.id, status: "QA_APPROVED" },
          }),
        ]);

        return {
          ...agent,
          metrics: {
            totalCommission: commissionTotal._sum.amount || 0,
            approvedSales: salesApproved,
          },
        };
      })
    );

    res.json({
      success: true,
      data: {
        agents: agentsWithMetrics,
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
