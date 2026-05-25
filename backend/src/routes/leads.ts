import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { createLeadSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";
import { sendUltraMsgWhatsApp } from "../integrations/ultramsg.js";

const router = Router();

router.use(authenticate);

// ─── Daily lead quota helpers ───────────────────────────────────────────────
// "Leads/day" allocation (5/10/15/20). The day boundary is South African time
// (SAST = UTC+2) so the quota resets at local midnight.
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

function startOfTodaySAST(): Date {
  const sastNow = new Date(Date.now() + SAST_OFFSET_MS);
  sastNow.setUTCHours(0, 0, 0, 0);
  return new Date(sastNow.getTime() - SAST_OFFSET_MS);
}

async function assignedTodayCount(agentId: number): Promise<number> {
  return prisma.lead.count({
    where: { assignedAgentId: agentId, assignedAt: { gte: startOfTodaySAST() } },
  });
}

// ─── Helper: require ADMIN or AGENT role ────────────────────────────────────

async function requireAdminRole(req: AuthRequest, res: Response): Promise<boolean> {
  if (!req.ambassador) {
    res.status(401).json({ success: false, error: "Not authenticated." });
    return false;
  }
  const user = await prisma.ambassador.findUnique({
    where: { id: req.ambassador.id },
    select: { role: true },
  });
  if (!user || !["ADMIN", "QA_OFFICER"].includes(user.role)) {
    res.status(403).json({ success: false, error: "Admin access required." });
    return false;
  }
  return true;
}

// ─── POST /api/leads — Ambassador submits a lead ────────────────────────────

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

    const { firstName, lastName, contactNo, preferredContact, type, employerName, idNumber, notes } =
      validation.data;
    const ambassadorId = req.ambassador!.id;

    const existingLead = await prisma.lead.findFirst({ where: { ambassadorId, contactNo } });

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
        type: type ?? "REFERRAL_LEAD",
        employerName: employerName ?? null,
        idNumber: idNumber ?? null,
        notes: notes ?? null,
      },
      select: {
        id: true, firstName: true, lastName: true, contactNo: true,
        preferredContact: true, status: true, type: true,
        employerName: true, idNumber: true, notes: true, datePaid: true, createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: lead });

    // ── Auto-fire WhatsApp for MEMBER_SIGNUP (async, non-blocking) ──────────
    if ((type ?? "REFERRAL_LEAD") === "MEMBER_SIGNUP") {
      setImmediate(async () => {
        try {
          const ambassador = await prisma.ambassador.findUnique({
            where: { id: ambassadorId },
            select: { mobileNo: true, firstName: true },
          });
          if (ambassador?.mobileNo) {
            await sendUltraMsgWhatsApp(ambassador.mobileNo, "member_signup", ambassador.firstName);
            console.log(`[WhatsApp] Member Signup sent to ambassador ${ambassadorId}`);
          }
        } catch (err) {
          console.error("[WhatsApp] Failed to send Member Signup:", err);
        }
      });
    }
  } catch (error) {
    console.error("Create lead error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/leads — Ambassador's own leads ────────────────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const ambassadorId = req.ambassador!.id;
    const page = Math.max(1, parseInt(String(req.query.page) || "1") || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit) || "20") || 20));
    const skip = (page - 1) * limit;

    const statusFilter = req.query.status as string | undefined;
    const typeFilter = req.query.type as string | undefined;
    const where: Record<string, unknown> = { ambassadorId };

    if (statusFilter && ["NEW", "CONTACTED", "PAID", "CLOSED"].includes(statusFilter)) {
      where.status = statusFilter;
    }
    if (typeFilter && ["REFERRAL_LEAD", "MEMBER_SIGNUP"].includes(typeFilter)) {
      where.type = typeFilter;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, firstName: true, lastName: true, contactNo: true,
          preferredContact: true, status: true, type: true,
          employerName: true, idNumber: true, notes: true, datePaid: true,
          callOutcome: true, callNotes: true, dialledAt: true, createdAt: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        leads,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List leads error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/leads/admin/all — Admin: all leads across all ambassadors ─────

router.get("/admin/all", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdminRole(req, res);
    if (!isAdmin) return;

    const page = Math.max(1, parseInt(String(req.query.page) || "1") || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit) || "50") || 50));
    const skip = (page - 1) * limit;

    const typeFilter = req.query.type as string | undefined;
    const statusFilter = req.query.status as string | undefined;
    const assignedFilter = req.query.assigned as string | undefined;

    const where: Record<string, unknown> = {};
    if (typeFilter && ["REFERRAL_LEAD", "MEMBER_SIGNUP"].includes(typeFilter)) where.type = typeFilter;
    if (statusFilter && ["NEW", "CONTACTED", "PAID", "CLOSED"].includes(statusFilter)) where.status = statusFilter;
    if (assignedFilter === "unassigned") where.assignedAgentId = null;
    if (assignedFilter === "assigned") where.NOT = { assignedAgentId: null };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, firstName: true, lastName: true, contactNo: true,
          preferredContact: true, status: true, type: true,
          employerName: true, idNumber: true, notes: true,
          callOutcome: true, callNotes: true, dialledAt: true,
          assignedAt: true, datePaid: true, createdAt: true,
          ambassador: { select: { id: true, firstName: true, lastName: true, mobileNo: true } },
          assignedAgent: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        leads,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("Admin list leads error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/leads/admin/agents — List agents for assignment dropdown ───────

router.get("/admin/agents", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdminRole(req, res);
    if (!isAdmin) return;

    const agents = await prisma.ambassador.findMany({
      where: { role: { in: ["AGENT", "ADMIN"] }, isActive: true },
      select: {
        id: true, firstName: true, lastName: true, dailyLeadQuota: true,
        _count: { select: { assignedLeads: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    // Count today's assignments per agent (SAST day) in one query.
    const since = startOfTodaySAST();
    const todayGroups = await prisma.lead.groupBy({
      by: ["assignedAgentId"],
      where: { assignedAt: { gte: since }, assignedAgentId: { not: null } },
      _count: { _all: true },
    });
    const todayMap = new Map<number, number>();
    for (const g of todayGroups) if (g.assignedAgentId != null) todayMap.set(g.assignedAgentId, g._count._all);

    res.json({
      success: true,
      data: agents.map((a) => {
        const assignedToday = todayMap.get(a.id) ?? 0;
        return {
          id: a.id,
          name: `${a.firstName} ${a.lastName}`,
          assignedCount: a._count.assignedLeads,
          dailyLeadQuota: a.dailyLeadQuota,
          assignedToday,
          remainingToday: Math.max(0, a.dailyLeadQuota - assignedToday),
        };
      }),
    });
  } catch (error) {
    console.error("List agents error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/leads/admin/agents/:id/quota — set an agent's leads/day ─────────

router.put("/admin/agents/:id/quota", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdminRole(req, res);
    if (!isAdmin) return;

    const agentId = parseInt(String(req.params.id));
    const quota = parseInt(String((req.body || {}).quota));
    if (isNaN(agentId) || isNaN(quota) || quota < 0 || quota > 200) {
      res.status(400).json({ success: false, error: "Quota must be an integer between 0 and 200." });
      return;
    }

    const agent = await prisma.ambassador.update({
      where: { id: agentId },
      data: { dailyLeadQuota: quota },
      select: { id: true, firstName: true, lastName: true, dailyLeadQuota: true },
    });

    res.json({ success: true, data: { id: agent.id, name: `${agent.firstName} ${agent.lastName}`, dailyLeadQuota: agent.dailyLeadQuota } });
  } catch (error) {
    console.error("Set quota error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/leads/admin/:id/assign — Assign lead to agent ─────────────────

router.put("/admin/:id/assign", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdminRole(req, res);
    if (!isAdmin) return;

    const leadId = parseInt(String(req.params.id));
    const { agentId } = req.body;

    if (isNaN(leadId)) {
      res.status(400).json({ success: false, error: "Invalid lead ID." });
      return;
    }

    // Enforce the agent's daily quota when assigning (not when unassigning).
    if (agentId) {
      const agent = await prisma.ambassador.findUnique({ where: { id: agentId }, select: { dailyLeadQuota: true } });
      const used = await assignedTodayCount(agentId);
      if (agent && used >= agent.dailyLeadQuota) {
        res.status(409).json({
          success: false,
          error: `Daily quota reached: this agent already has ${used}/${agent.dailyLeadQuota} leads assigned today.`,
        });
        return;
      }
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedAgentId: agentId ?? null,
        assignedAt: agentId ? new Date() : null,
        status: agentId ? "CONTACTED" : "NEW",
      },
      select: {
        id: true, status: true, assignedAgentId: true, assignedAt: true,
        assignedAgent: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json({ success: true, data: lead });
  } catch (error) {
    console.error("Assign lead error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/leads/admin/:id/bulk-assign — Assign multiple leads ────────────

router.put("/admin/bulk-assign", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdminRole(req, res);
    if (!isAdmin) return;

    const { leadIds, agentId } = req.body as { leadIds: number[]; agentId: number };

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      res.status(400).json({ success: false, error: "leadIds must be a non-empty array." });
      return;
    }

    // Cap the assignment to the agent's remaining daily quota.
    const agent = await prisma.ambassador.findUnique({ where: { id: agentId }, select: { dailyLeadQuota: true } });
    if (!agent) {
      res.status(404).json({ success: false, error: "Agent not found." });
      return;
    }
    const used = await assignedTodayCount(agentId);
    const remaining = Math.max(0, agent.dailyLeadQuota - used);
    if (remaining === 0) {
      res.status(409).json({
        success: false,
        error: `Daily quota reached: this agent already has ${used}/${agent.dailyLeadQuota} leads assigned today.`,
      });
      return;
    }

    const idsToAssign = leadIds.slice(0, remaining);
    await prisma.lead.updateMany({
      where: { id: { in: idsToAssign } },
      data: {
        assignedAgentId: agentId,
        assignedAt: new Date(),
        status: "CONTACTED",
      },
    });

    res.json({
      success: true,
      data: {
        assigned: idsToAssign.length,
        requested: leadIds.length,
        capped: leadIds.length - idsToAssign.length,
        quota: agent.dailyLeadQuota,
        remainingToday: remaining - idsToAssign.length,
        agentId,
      },
    });
  } catch (error) {
    console.error("Bulk assign error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/leads/admin/:id — Admin: single lead detail ───────────────────

router.get("/admin/:id", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdminRole(req, res);
    if (!isAdmin) return;

    const leadId = parseInt(String(req.params.id));
    if (isNaN(leadId)) {
      res.status(400).json({ success: false, error: "Invalid lead ID." });
      return;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true, firstName: true, lastName: true, contactNo: true,
        preferredContact: true, status: true, type: true,
        employerName: true, idNumber: true, notes: true,
        callOutcome: true, callNotes: true, dialledAt: true,
        assignedAt: true, datePaid: true, createdAt: true,
        ambassador: { select: { id: true, firstName: true, lastName: true, mobileNo: true } },
        assignedAgent: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!lead) {
      res.status(404).json({ success: false, error: "Lead not found." });
      return;
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    console.error("Get lead detail error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/leads/:id/outcome — Record call outcome ───────────────────────

router.put("/:id/outcome", async (req: AuthRequest, res: Response) => {
  try {
    const leadId = parseInt(String(req.params.id));
    const ambassadorId = req.ambassador!.id;
    const { callOutcome, callNotes } = req.body as { callOutcome: string; callNotes?: string };

    if (isNaN(leadId)) {
      res.status(400).json({ success: false, error: "Invalid lead ID." });
      return;
    }

    const validOutcomes = ["SALE_MADE", "COULD_NOT_REACH", "NOT_INTERESTED", "CALLBACK_SCHEDULED"];
    if (!validOutcomes.includes(callOutcome)) {
      res.status(400).json({ success: false, error: "Invalid call outcome." });
      return;
    }

    // Agent can only update leads assigned to them (or admin can update any)
    const user = await prisma.ambassador.findUnique({
      where: { id: ambassadorId },
      select: { role: true },
    });

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      res.status(404).json({ success: false, error: "Lead not found." });
      return;
    }

    const isAdmin = user?.role === "ADMIN" || user?.role === "QA_OFFICER";
    if (!isAdmin && lead.assignedAgentId !== ambassadorId) {
      res.status(403).json({ success: false, error: "This lead is not assigned to you." });
      return;
    }

    const newStatus = callOutcome === "SALE_MADE" ? "PAID" : "CONTACTED";

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        callOutcome: callOutcome as any,
        callNotes: callNotes ?? null,
        dialledAt: new Date(),
        status: newStatus,
      },
      select: {
        id: true, status: true, callOutcome: true, callNotes: true, dialledAt: true,
        firstName: true, lastName: true,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Record outcome error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/leads/agent/get-leads — Agent self-pull up to daily quota ─────
// Mirrors the FoxPro "Get Leads" button: assigns the agent the next batch of
// unassigned leads, capped by their remaining daily quota (5/10/15/20).

router.post("/agent/get-leads", async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.ambassador!.id;
    const body = (req.body || {}) as { count?: number; type?: string };

    const agent = await prisma.ambassador.findUnique({
      where: { id: agentId },
      select: { dailyLeadQuota: true },
    });
    const quota = agent?.dailyLeadQuota ?? 10;
    const used = await assignedTodayCount(agentId);
    const remaining = Math.max(0, quota - used);

    if (remaining === 0) {
      res.json({
        success: true,
        data: { assigned: 0, quota, assignedToday: used, remainingToday: 0, message: `Daily quota reached (${used}/${quota}). Come back tomorrow.` },
      });
      return;
    }

    const requested = Number.isFinite(body.count) && body.count! > 0 ? Math.min(body.count!, remaining) : remaining;

    const typeFilter = body.type && ["REFERRAL_LEAD", "MEMBER_SIGNUP"].includes(body.type) ? body.type : undefined;

    // Pick the next unassigned leads, then assign only those still unassigned
    // (guards against two agents pulling the same lead concurrently).
    const candidates = await prisma.lead.findMany({
      where: { assignedAgentId: null, status: "NEW", ...(typeFilter ? { type: typeFilter as any } : {}) },
      orderBy: { createdAt: "asc" },
      take: requested,
      select: { id: true },
    });

    let assigned = 0;
    if (candidates.length > 0) {
      const result = await prisma.lead.updateMany({
        where: { id: { in: candidates.map((c) => c.id) }, assignedAgentId: null },
        data: { assignedAgentId: agentId, assignedAt: new Date(), status: "CONTACTED" },
      });
      assigned = result.count;
    }

    res.json({
      success: true,
      data: {
        assigned,
        quota,
        assignedToday: used + assigned,
        remainingToday: Math.max(0, remaining - assigned),
        message:
          assigned > 0
            ? `Pulled ${assigned} lead${assigned === 1 ? "" : "s"}. You have ${Math.max(0, remaining - assigned)} of ${quota} left today.`
            : "No unassigned leads are available right now.",
      },
    });
  } catch (error) {
    console.error("Get leads error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/leads/agent/diallist — Agent: see my assigned leads ────────────

router.get("/agent/diallist", async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.ambassador!.id;
    const outcomeFilter = req.query.outcome as string | undefined;

    const where: Record<string, unknown> = { assignedAgentId: agentId };
    if (outcomeFilter === "pending") where.callOutcome = null;
    if (outcomeFilter === "completed") where.NOT = { callOutcome: null };

    const leads = await prisma.lead.findMany({
      where,
      orderBy: [{ callOutcome: "asc" }, { assignedAt: "asc" }],
      select: {
        id: true, firstName: true, lastName: true, contactNo: true,
        preferredContact: true, type: true, status: true,
        employerName: true, notes: true,
        callOutcome: true, callNotes: true, dialledAt: true, assignedAt: true,
        ambassador: { select: { firstName: true, lastName: true } },
      },
    });

    const total = leads.length;
    const pending = leads.filter((l) => !l.callOutcome).length;
    const completed = total - pending;
    const sales = leads.filter((l) => l.callOutcome === "SALE_MADE").length;

    res.json({
      success: true,
      data: {
        leads,
        summary: { total, pending, completed, sales },
      },
    });
  } catch (error) {
    console.error("Agent diallist error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

export default router;
