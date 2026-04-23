import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { createLeadSchema } from "../lib/validators";
import { authenticate, AuthRequest } from "../middleware/auth";
import { sendUltraMsgWhatsApp } from "../integrations/ultramsg.js";

const router = Router();

router.use(authenticate);

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
        id: true, firstName: true, lastName: true,
        _count: { select: { assignedLeads: true } },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    res.json({
      success: true,
      data: agents.map((a) => ({
        id: a.id,
        name: `${a.firstName} ${a.lastName}`,
        assignedCount: a._count.assignedLeads,
      })),
    });
  } catch (error) {
    console.error("List agents error:", error);
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

    await prisma.lead.updateMany({
      where: { id: { in: leadIds } },
      data: {
        assignedAgentId: agentId,
        assignedAt: new Date(),
        status: "CONTACTED",
      },
    });

    res.json({ success: true, data: { assigned: leadIds.length, agentId } });
  } catch (error) {
    console.error("Bulk assign error:", error);
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
