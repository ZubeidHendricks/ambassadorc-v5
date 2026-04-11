import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { workflowEngine } from "../workflows/engine";
import type { WorkflowTrigger } from "@prisma/client";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Helpers ────────────────────────────────────────────────────────────────

const VALID_TRIGGERS: WorkflowTrigger[] = [
  "MANUAL",
  "ON_REGISTRATION",
  "ON_SALE_CREATED",
  "ON_QA_APPROVED",
  "ON_POLICY_ACTIVATED",
  "ON_PAYMENT_FAILED",
  "ON_PREMIUM_CHANGE",
  "SCHEDULED",
];

const VALID_ACTION_TYPES = [
  "SEND_SMS",
  "SEND_EMAIL",
  "RUN_AGENT",
  "UPDATE_STATUS",
  "WAIT",
  "APPROVAL",
  "WEBHOOK",
];

async function requireAdminOrQA(req: AuthRequest, res: Response): Promise<boolean> {
  const ambassador = await prisma.ambassador.findUnique({
    where: { id: req.ambassador!.id },
    select: { role: true },
  });

  if (!ambassador || !["ADMIN", "QA_OFFICER"].includes(ambassador.role)) {
    res.status(403).json({
      success: false,
      error: "Only administrators and QA officers can perform this action.",
    });
    return false;
  }
  return true;
}

// ─── GET /api/workflows — List all workflow templates ───────────────────────

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { steps: true, instances: true } },
        },
      }),
      prisma.workflow.count(),
    ]);

    res.json({
      success: true,
      data: {
        workflows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List workflows error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/workflows — Create new workflow with steps ───────────────────

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdminOrQA(req, res))) return;

    const { name, description, trigger, isActive, steps } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ success: false, error: "name is required." });
      return;
    }
    if (!trigger || !VALID_TRIGGERS.includes(trigger)) {
      res.status(400).json({
        success: false,
        error: `trigger must be one of: ${VALID_TRIGGERS.join(", ")}`,
      });
      return;
    }

    const stepsData = Array.isArray(steps) ? steps : [];

    for (const step of stepsData) {
      if (!step.name || !step.actionType || !VALID_ACTION_TYPES.includes(step.actionType)) {
        res.status(400).json({
          success: false,
          error: `Each step requires name and valid actionType (${VALID_ACTION_TYPES.join(", ")}).`,
        });
        return;
      }
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description: description ?? null,
        trigger,
        isActive: isActive !== false,
        steps: {
          create: stepsData.map((step: any, index: number) => ({
            order: step.order ?? index + 1,
            name: step.name,
            actionType: step.actionType,
            config: step.config ?? {},
          })),
        },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "CREATE",
        entity: "Workflow",
        entityId: String(workflow.id),
        details: { name, trigger, stepCount: stepsData.length },
        ipAddress: req.ip ?? null,
      },
    });

    res.status(201).json({ success: true, data: workflow });
  } catch (error) {
    console.error("Create workflow error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/workflows/stats — Workflow statistics ─────────────────────────

router.get("/stats", async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalWorkflows,
      activeWorkflows,
      activeInstances,
      pausedInstances,
      completedInstances,
      failedInstances,
      cancelledInstances,
    ] = await Promise.all([
      prisma.workflow.count(),
      prisma.workflow.count({ where: { isActive: true } }),
      prisma.workflowInstance.count({ where: { status: "ACTIVE" } }),
      prisma.workflowInstance.count({ where: { status: "PAUSED" } }),
      prisma.workflowInstance.count({ where: { status: "COMPLETED" } }),
      prisma.workflowInstance.count({ where: { status: "FAILED" } }),
      prisma.workflowInstance.count({ where: { status: "CANCELLED" } }),
    ]);

    res.json({
      success: true,
      data: {
        workflows: { total: totalWorkflows, active: activeWorkflows },
        instances: {
          active: activeInstances,
          paused: pausedInstances,
          completed: completedInstances,
          failed: failedInstances,
          cancelled: cancelledInstances,
          total:
            activeInstances +
            pausedInstances +
            completedInstances +
            failedInstances +
            cancelledInstances,
        },
      },
    });
  } catch (error) {
    console.error("Workflow stats error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/workflows/instances — List all instances ──────────────────────

router.get("/instances", async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (req.query.status) {
      where.status = req.query.status;
    }
    if (req.query.workflowId) {
      where.workflowId = parseInt(req.query.workflowId as string);
    }
    if (req.query.entityType) {
      where.entityType = req.query.entityType;
    }
    if (req.query.entityId) {
      where.entityId = parseInt(req.query.entityId as string);
    }

    const [instances, total] = await Promise.all([
      prisma.workflowInstance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: "desc" },
        include: {
          workflow: { select: { id: true, name: true, trigger: true } },
          _count: { select: { steps: true } },
        },
      }),
      prisma.workflowInstance.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        instances,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("List instances error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/workflows/process — Process all pending instances ────────────

router.post("/process", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdminOrQA(req, res))) return;

    const stats = await workflowEngine.processAll();

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "WORKFLOW_PROCESS_ALL",
        entity: "WorkflowEngine",
        entityId: "0",
        details: stats,
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error("Process workflows error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── GET /api/workflows/:id — Get workflow detail with steps ────────────────

router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid workflow ID." });
      return;
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: "asc" } },
        _count: { select: { instances: true } },
      },
    });

    if (!workflow) {
      res.status(404).json({ success: false, error: "Workflow not found." });
      return;
    }

    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error("Get workflow error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/workflows/:id — Update workflow ───────────────────────────────

router.put("/:id", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdminOrQA(req, res))) return;

    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid workflow ID." });
      return;
    }

    const existing = await prisma.workflow.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Workflow not found." });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;

    const workflow = await prisma.workflow.update({
      where: { id },
      data: updateData,
      include: { steps: { orderBy: { order: "asc" } } },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "UPDATE",
        entity: "Workflow",
        entityId: String(id),
        details: updateData,
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error("Update workflow error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/workflows/:id/steps — Add step to workflow ───────────────────

router.post("/:id/steps", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdminOrQA(req, res))) return;

    const workflowId = parseInt(req.params.id);

    if (isNaN(workflowId)) {
      res.status(400).json({ success: false, error: "Invalid workflow ID." });
      return;
    }

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      res.status(404).json({ success: false, error: "Workflow not found." });
      return;
    }

    const { name, actionType, config, order } = req.body;

    if (!name || !actionType || !VALID_ACTION_TYPES.includes(actionType)) {
      res.status(400).json({
        success: false,
        error: `name and valid actionType required (${VALID_ACTION_TYPES.join(", ")}).`,
      });
      return;
    }

    // If no order specified, append at the end
    let stepOrder = order;
    if (stepOrder === undefined) {
      const lastStep = await prisma.workflowStep.findFirst({
        where: { workflowId },
        orderBy: { order: "desc" },
      });
      stepOrder = (lastStep?.order ?? 0) + 1;
    }

    const step = await prisma.workflowStep.create({
      data: {
        workflowId,
        order: stepOrder,
        name,
        actionType,
        config: config ?? {},
      },
    });

    res.status(201).json({ success: true, data: step });
  } catch (error) {
    console.error("Add workflow step error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── PUT /api/workflows/steps/:stepId — Update step ────────────────────────

router.put("/steps/:stepId", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdminOrQA(req, res))) return;

    const stepId = parseInt(req.params.stepId);

    if (isNaN(stepId)) {
      res.status(400).json({ success: false, error: "Invalid step ID." });
      return;
    }

    const existing = await prisma.workflowStep.findUnique({ where: { id: stepId } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Workflow step not found." });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.order !== undefined) updateData.order = req.body.order;
    if (req.body.config !== undefined) updateData.config = req.body.config;
    if (req.body.actionType !== undefined) {
      if (!VALID_ACTION_TYPES.includes(req.body.actionType)) {
        res.status(400).json({
          success: false,
          error: `actionType must be one of: ${VALID_ACTION_TYPES.join(", ")}`,
        });
        return;
      }
      updateData.actionType = req.body.actionType;
    }

    const step = await prisma.workflowStep.update({
      where: { id: stepId },
      data: updateData,
    });

    res.json({ success: true, data: step });
  } catch (error) {
    console.error("Update workflow step error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── DELETE /api/workflows/steps/:stepId — Remove step ──────────────────────

router.delete("/steps/:stepId", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdminOrQA(req, res))) return;

    const stepId = parseInt(req.params.stepId);

    if (isNaN(stepId)) {
      res.status(400).json({ success: false, error: "Invalid step ID." });
      return;
    }

    const existing = await prisma.workflowStep.findUnique({ where: { id: stepId } });
    if (!existing) {
      res.status(404).json({ success: false, error: "Workflow step not found." });
      return;
    }

    await prisma.workflowStep.delete({ where: { id: stepId } });

    res.json({ success: true, data: { deleted: true, stepId } });
  } catch (error) {
    console.error("Delete workflow step error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/workflows/:id/trigger — Manually trigger workflow ────────────

router.post("/:id/trigger", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdminOrQA(req, res))) return;

    const workflowId = parseInt(req.params.id);

    if (isNaN(workflowId)) {
      res.status(400).json({ success: false, error: "Invalid workflow ID." });
      return;
    }

    const { entityType, entityId, context } = req.body;

    if (!entityType || typeof entityType !== "string") {
      res.status(400).json({ success: false, error: "entityType is required." });
      return;
    }
    if (!entityId || isNaN(parseInt(entityId))) {
      res.status(400).json({ success: false, error: "entityId is required and must be a number." });
      return;
    }

    // Enrich context with entity metadata for template interpolation
    const enrichedContext: Record<string, unknown> = {
      _entityType: entityType,
      _entityId: parseInt(entityId),
      ...(context ?? {}),
    };

    const instance = await workflowEngine.startWorkflow(
      workflowId,
      entityType,
      parseInt(entityId),
      enrichedContext
    );

    res.status(201).json({ success: true, data: instance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Trigger workflow error:", error);
    res.status(400).json({ success: false, error: message });
  }
});

// ─── GET /api/workflows/instances/:id — Instance detail with step statuses ──

router.get("/instances/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid instance ID." });
      return;
    }

    const instance = await prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        workflow: { select: { id: true, name: true, trigger: true } },
        steps: {
          include: {
            step: { select: { id: true, order: true, name: true, actionType: true } },
          },
          orderBy: { step: { order: "asc" } },
        },
      },
    });

    if (!instance) {
      res.status(404).json({ success: false, error: "Workflow instance not found." });
      return;
    }

    res.json({ success: true, data: instance });
  } catch (error) {
    console.error("Get instance error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

// ─── POST /api/workflows/instances/:id/resume — Resume paused instance ──────

router.post("/instances/:id/resume", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdminOrQA(req, res))) return;

    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid instance ID." });
      return;
    }

    const { approved } = req.body;

    if (typeof approved !== "boolean") {
      res.status(400).json({
        success: false,
        error: "approved (boolean) is required in request body.",
      });
      return;
    }

    await workflowEngine.resumeInstance(id, approved);

    const instance = await prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        workflow: { select: { id: true, name: true } },
        steps: {
          include: { step: { select: { id: true, name: true, actionType: true } } },
          orderBy: { step: { order: "asc" } },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: approved ? "WORKFLOW_APPROVED" : "WORKFLOW_REJECTED",
        entity: "WorkflowInstance",
        entityId: String(id),
        details: { approved },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: instance });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Resume instance error:", error);
    res.status(400).json({ success: false, error: message });
  }
});

// ─── POST /api/workflows/instances/:id/cancel — Cancel active instance ──────

router.post("/instances/:id/cancel", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdminOrQA(req, res))) return;

    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid instance ID." });
      return;
    }

    const instance = await prisma.workflowInstance.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!instance) {
      res.status(404).json({ success: false, error: "Workflow instance not found." });
      return;
    }

    if (instance.status === "COMPLETED" || instance.status === "CANCELLED") {
      res.status(400).json({
        success: false,
        error: `Cannot cancel instance with status ${instance.status}.`,
      });
      return;
    }

    // Skip all pending/in-progress steps
    const pendingStepIds = instance.steps
      .filter((s) => s.status === "PENDING" || s.status === "IN_PROGRESS")
      .map((s) => s.id);

    if (pendingStepIds.length > 0) {
      await prisma.workflowStepInstance.updateMany({
        where: { id: { in: pendingStepIds } },
        data: { status: "SKIPPED" },
      });
    }

    const cancelled = await prisma.workflowInstance.update({
      where: { id },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
        error: "Cancelled by user",
      },
      include: {
        workflow: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: String(req.ambassador!.id),
        action: "WORKFLOW_CANCELLED",
        entity: "WorkflowInstance",
        entityId: String(id),
        details: { cancelledSteps: pendingStepIds.length },
        ipAddress: req.ip ?? null,
      },
    });

    res.json({ success: true, data: cancelled });
  } catch (error) {
    console.error("Cancel instance error:", error);
    res.status(500).json({ success: false, error: "An unexpected error occurred." });
  }
});

export default router;
