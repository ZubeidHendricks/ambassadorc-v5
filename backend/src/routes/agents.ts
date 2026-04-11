import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { orchestrator } from "../agents/index";

const router = Router();

// All agent routes require authentication
router.use(authenticate);

// ─── Authorization: Only ADMIN users can manage agents ──────────────────────

async function requireAdmin(
  req: AuthRequest,
  res: Response
): Promise<boolean> {
  if (!req.ambassador) {
    res.status(401).json({ success: false, error: "Not authenticated." });
    return false;
  }

  const user = await prisma.ambassador.findUnique({
    where: { id: req.ambassador.id },
    select: { role: true },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "QA_OFFICER")) {
    res.status(403).json({
      success: false,
      error: "Forbidden. Agent management requires ADMIN or QA_OFFICER role.",
    });
    return false;
  }

  return true;
}

// ─── GET /api/agents — List all registered agents with status ───────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdmin(req, res);
    if (!isAdmin) return;

    const agents = orchestrator.listAgents();

    res.json({
      success: true,
      data: agents.map((agent) => ({
        name: agent.name,
        description: agent.description,
        isRunning: agent.isRunning,
        isScheduled: agent.isScheduled,
        lastRun: agent.lastRun,
        lastResult: agent.lastResult
          ? {
              success: agent.lastResult.success,
              processed: agent.lastResult.processed,
              duration: agent.lastResult.duration,
              errorCount: agent.lastResult.errors.length,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("Error listing agents:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list agents.",
    });
  }
});

// ─── GET /api/agents/status — Get last run status for all agents ────────────

router.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdmin(req, res);
    if (!isAdmin) return;

    const agents = orchestrator.listAgents();

    const statusMap: Record<
      string,
      {
        isRunning: boolean;
        lastRun: Date | null;
        lastSuccess: boolean | null;
        lastProcessed: number | null;
        lastDuration: number | null;
        lastErrorCount: number | null;
      }
    > = {};

    for (const agent of agents) {
      statusMap[agent.name] = {
        isRunning: agent.isRunning,
        lastRun: agent.lastRun,
        lastSuccess: agent.lastResult?.success ?? null,
        lastProcessed: agent.lastResult?.processed ?? null,
        lastDuration: agent.lastResult?.duration ?? null,
        lastErrorCount: agent.lastResult?.errors.length ?? null,
      };
    }

    res.json({
      success: true,
      data: statusMap,
    });
  } catch (error) {
    console.error("Error fetching agent status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get agent status.",
    });
  }
});

// ─── POST /api/agents/:name/run — Trigger a specific agent manually ────────

router.post("/:name/run", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdmin(req, res);
    if (!isAdmin) return;

    const { name } = req.params;
    const agent = orchestrator.getAgent(name);

    if (!agent) {
      res.status(404).json({
        success: false,
        error: `Agent "${name}" not found. Use GET /api/agents to list available agents.`,
      });
      return;
    }

    // Run the agent (non-blocking response if it takes long)
    const result = await orchestrator.run(name);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error running agent:", error);
    res.status(500).json({
      success: false,
      error: "Failed to run agent.",
    });
  }
});

// ─── GET /api/agents/:name/history — Get agent run history from AuditLog ───

router.get("/:name/history", async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = await requireAdmin(req, res);
    if (!isAdmin) return;

    const { name } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Verify the agent exists
    const agent = orchestrator.getAgent(name);
    if (!agent) {
      res.status(404).json({
        success: false,
        error: `Agent "${name}" not found.`,
      });
      return;
    }

    const [runs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          action: "AGENT_RUN",
          entity: "Agent",
          entityId: name,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({
        where: {
          action: "AGENT_RUN",
          entity: "Agent",
          entityId: name,
        },
      }),
    ]);

    res.json({
      success: true,
      data: runs.map((run) => ({
        id: run.id,
        timestamp: run.createdAt,
        details: run.details,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching agent history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get agent history.",
    });
  }
});

export default router;
