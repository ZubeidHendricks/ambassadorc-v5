import prisma from "../lib/prisma";
import { orchestrator } from "../agents/index";
import type { WorkflowTrigger, WorkflowStepStatus } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StepResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  pause?: boolean; // true if the instance should pause (WAIT or APPROVAL)
}

// ─── Workflow Engine ────────────────────────────────────────────────────────

class WorkflowEngine {
  /**
   * Execute a single workflow step based on its actionType.
   */
  async executeStep(
    stepInstance: { id: number; instanceId: number; startedAt: Date | null },
    step: { id: number; actionType: string; config: unknown },
    context: Record<string, unknown>
  ): Promise<StepResult> {
    const config = (step.config ?? {}) as Record<string, unknown>;

    switch (step.actionType) {
      case "SEND_SMS":
        return this.handleSendSms(config, context);

      case "SEND_EMAIL":
        return this.handleSendEmail(config, context);

      case "RUN_AGENT":
        return this.handleRunAgent(config);

      case "UPDATE_STATUS":
        return this.handleUpdateStatus(config, context);

      case "WAIT":
        return this.handleWait(config, stepInstance);

      case "APPROVAL":
        return this.handleApproval(config);

      case "WEBHOOK":
        return this.handleWebhook(config, context);

      default:
        return { success: false, error: `Unknown action type: ${step.actionType}` };
    }
  }

  /**
   * Process the next pending step of a workflow instance.
   */
  async processInstance(instanceId: number): Promise<void> {
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        steps: {
          include: { step: true },
          orderBy: { step: { order: "asc" } },
        },
        workflow: { include: { steps: { orderBy: { order: "asc" } } } },
      },
    });

    if (!instance || instance.status !== "ACTIVE") {
      return;
    }

    // Find the next pending or in-progress step instance
    const nextStepInstance = instance.steps.find(
      (si) => si.status === "PENDING" || si.status === "IN_PROGRESS"
    );

    if (!nextStepInstance) {
      // All steps completed — mark instance as completed
      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      return;
    }

    // Mark step as in progress
    if (nextStepInstance.status === "PENDING") {
      await prisma.workflowStepInstance.update({
        where: { id: nextStepInstance.id },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
      nextStepInstance.status = "IN_PROGRESS";
      nextStepInstance.startedAt = new Date();
    }

    const context = (instance.context ?? {}) as Record<string, unknown>;

    try {
      const result = await this.executeStep(
        nextStepInstance,
        nextStepInstance.step,
        context
      );

      if (result.pause) {
        // Step needs to wait (WAIT timer not elapsed, or APPROVAL pending)
        await prisma.workflowInstance.update({
          where: { id: instanceId },
          data: {
            status: "PAUSED",
            currentStep: nextStepInstance.step.order,
          },
        });
        return;
      }

      if (result.success) {
        // Merge result data into context for downstream steps
        const updatedContext = { ...context, ...(result.data ?? {}) };

        await prisma.workflowStepInstance.update({
          where: { id: nextStepInstance.id },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            result: (result.data ?? null) as any,
          },
        });

        await prisma.workflowInstance.update({
          where: { id: instanceId },
          data: {
            currentStep: nextStepInstance.step.order + 1,
            context: updatedContext as any,
          },
        });

        // Recursively process the next step
        await this.processInstance(instanceId);
      } else {
        // Step failed — mark instance as failed
        await prisma.workflowStepInstance.update({
          where: { id: nextStepInstance.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            error: result.error ?? "Unknown error",
          },
        });

        await prisma.workflowInstance.update({
          where: { id: instanceId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            error: result.error ?? "Step execution failed",
          },
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      await prisma.workflowStepInstance.update({
        where: { id: nextStepInstance.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: errorMessage,
        },
      });

      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: errorMessage,
        },
      });
    }
  }

  /**
   * Start a new workflow instance for an entity.
   * Creates step instances for every step in the workflow definition.
   */
  async startWorkflow(
    workflowId: number,
    entityType: string,
    entityId: number,
    context?: Record<string, unknown>
  ) {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    if (!workflow || !workflow.isActive) {
      throw new Error(`Workflow ${workflowId} not found or inactive.`);
    }

    if (workflow.steps.length === 0) {
      throw new Error(`Workflow ${workflowId} has no steps.`);
    }

    const instance = await prisma.workflowInstance.create({
      data: {
        workflowId,
        entityType,
        entityId,
        status: "ACTIVE",
        currentStep: 0,
        context: (context ?? {}) as any,
        steps: {
          create: workflow.steps.map((step) => ({
            stepId: step.id,
            status: "PENDING" as WorkflowStepStatus,
          })),
        },
      },
      include: { steps: true },
    });

    // Log the start
    await prisma.auditLog.create({
      data: {
        userId: "WORKFLOW_ENGINE",
        action: "WORKFLOW_STARTED",
        entity: entityType,
        entityId: String(entityId),
        details: {
          workflowId,
          workflowName: workflow.name,
          instanceId: instance.id,
        },
      },
    });

    // Begin processing immediately
    await this.processInstance(instance.id);

    return instance;
  }

  /**
   * Trigger all active workflows matching a specific trigger type.
   */
  async triggerWorkflows(
    trigger: WorkflowTrigger,
    entityType: string,
    entityId: number,
    context?: Record<string, unknown>
  ): Promise<void> {
    const workflows = await prisma.workflow.findMany({
      where: { trigger, isActive: true },
    });

    for (const workflow of workflows) {
      try {
        await this.startWorkflow(workflow.id, entityType, entityId, context);
      } catch (err) {
        console.error(
          `[WorkflowEngine] Failed to start workflow "${workflow.name}" (${workflow.id}):`,
          err
        );
      }
    }
  }

  /**
   * Resume a paused instance (e.g. after manual approval).
   * If approved, continue processing. If rejected, cancel the instance.
   */
  async resumeInstance(instanceId: number, approved: boolean): Promise<void> {
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        steps: {
          include: { step: true },
          orderBy: { step: { order: "asc" } },
        },
      },
    });

    if (!instance || instance.status !== "PAUSED") {
      throw new Error(`Instance ${instanceId} is not paused.`);
    }

    // Find the in-progress step (the one that caused the pause)
    const pausedStep = instance.steps.find((si) => si.status === "IN_PROGRESS");

    if (!pausedStep) {
      throw new Error(`No in-progress step found for instance ${instanceId}.`);
    }

    if (approved) {
      // Complete the paused step and resume processing
      await prisma.workflowStepInstance.update({
        where: { id: pausedStep.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          result: { approved: true },
        },
      });

      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: "ACTIVE",
          currentStep: pausedStep.step.order + 1,
        },
      });

      await this.processInstance(instanceId);
    } else {
      // Rejected — skip the remaining steps and cancel the instance
      await prisma.workflowStepInstance.update({
        where: { id: pausedStep.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          error: "Approval rejected",
        },
      });

      // Skip all remaining pending steps
      const remainingSteps = instance.steps.filter((si) => si.status === "PENDING");
      if (remainingSteps.length > 0) {
        await prisma.workflowStepInstance.updateMany({
          where: {
            id: { in: remainingSteps.map((s) => s.id) },
          },
          data: { status: "SKIPPED" },
        });
      }

      await prisma.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
          error: "Approval rejected by user",
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: "WORKFLOW_ENGINE",
        action: approved ? "WORKFLOW_RESUMED" : "WORKFLOW_REJECTED",
        entity: "WorkflowInstance",
        entityId: String(instanceId),
        details: { approved, stepId: pausedStep.stepId },
      },
    });
  }

  /**
   * Process all active instances that have pending steps.
   * Also re-checks paused WAIT instances to see if their timer has elapsed.
   */
  async processAll(): Promise<{ processed: number; completed: number; failed: number }> {
    const stats = { processed: 0, completed: 0, failed: 0 };

    // Get all active instances
    const activeInstances = await prisma.workflowInstance.findMany({
      where: { status: "ACTIVE" },
    });

    // Get paused instances (WAIT steps may now be ready)
    const pausedInstances = await prisma.workflowInstance.findMany({
      where: { status: "PAUSED" },
      include: {
        steps: {
          include: { step: true },
          where: { status: "IN_PROGRESS" },
        },
      },
    });

    // Check paused WAIT steps — resume if time has elapsed
    for (const instance of pausedInstances) {
      const waitStep = instance.steps.find(
        (si) => si.step.actionType === "WAIT" && si.status === "IN_PROGRESS"
      );

      if (waitStep) {
        const config = (waitStep.step.config ?? {}) as Record<string, unknown>;
        const hours = Number(config.hours) || 0;
        const startedAt = waitStep.startedAt ?? new Date();
        const elapsedMs = Date.now() - startedAt.getTime();

        if (elapsedMs >= hours * 3600 * 1000) {
          // Timer elapsed — resume the instance
          await prisma.workflowStepInstance.update({
            where: { id: waitStep.id },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              result: { waited: hours, elapsedMs },
            },
          });

          await prisma.workflowInstance.update({
            where: { id: instance.id },
            data: {
              status: "ACTIVE",
              currentStep: waitStep.step.order + 1,
            },
          });

          // Add to active processing list
          activeInstances.push(
            (await prisma.workflowInstance.findUnique({ where: { id: instance.id } }))!
          );
        }
      }
    }

    for (const instance of activeInstances) {
      stats.processed++;
      try {
        await this.processInstance(instance.id);

        // Check final status after processing
        const updated = await prisma.workflowInstance.findUnique({
          where: { id: instance.id },
        });

        if (updated?.status === "COMPLETED") stats.completed++;
        if (updated?.status === "FAILED") stats.failed++;
      } catch (err) {
        stats.failed++;
        console.error(
          `[WorkflowEngine] Error processing instance ${instance.id}:`,
          err
        );
      }
    }

    return stats;
  }

  // ─── Action Handlers ────────────────────────────────────────────────────────

  private async handleSendSms(
    config: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<StepResult> {
    const template = String(config.template ?? "");
    const recipientField = String(config.recipientField ?? "cellphone");
    const recipientNumber = String(context[recipientField] ?? config.recipientNumber ?? "");

    if (!recipientNumber) {
      return { success: false, error: `No recipient number found (field: ${recipientField})` };
    }

    // Interpolate template variables from context
    const messageBody = this.interpolateTemplate(template, context);

    await prisma.smsMessage.create({
      data: {
        recipientNumber,
        messageBody,
        status: "QUEUED",
        type: (config.smsType as any) ?? "AMBASSADOR",
      },
    });

    return {
      success: true,
      data: { smsSent: true, recipientNumber, messagePreview: messageBody.substring(0, 100) },
    };
  }

  private async handleSendEmail(
    config: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<StepResult> {
    const subject = this.interpolateTemplate(String(config.subject ?? ""), context);
    const body = this.interpolateTemplate(String(config.body ?? ""), context);
    const recipientEmail = String(context.email ?? config.recipientEmail ?? "");

    if (!recipientEmail) {
      return { success: false, error: "No recipient email address found" };
    }

    // Log email action (integrate with email provider in production)
    await prisma.auditLog.create({
      data: {
        userId: "WORKFLOW_ENGINE",
        action: "EMAIL_QUEUED",
        entity: "Email",
        entityId: "0",
        details: { subject, recipientEmail, bodyPreview: body.substring(0, 200) },
      },
    });

    return {
      success: true,
      data: { emailQueued: true, recipientEmail, subject },
    };
  }

  private async handleRunAgent(config: Record<string, unknown>): Promise<StepResult> {
    const agentName = String(config.agentName ?? "");

    if (!agentName) {
      return { success: false, error: "No agent name specified" };
    }

    const agent = orchestrator.getAgent(agentName);
    if (!agent) {
      return { success: false, error: `Agent "${agentName}" is not registered` };
    }

    try {
      const result = await orchestrator.run(agentName);
      return {
        success: result.success,
        data: {
          agentName: result.agentName,
          processed: result.processed,
          actions: result.actions,
          duration: result.duration,
        },
        error: result.errors.length > 0 ? result.errors.join("; ") : undefined,
      };
    } catch (err) {
      return {
        success: false,
        error: `Agent execution failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async handleUpdateStatus(
    config: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<StepResult> {
    const field = String(config.field ?? "status");
    const value = String(config.value ?? "");
    const entityType = String(context._entityType ?? context.entityType ?? "");
    const entityId = Number(context._entityId ?? context.entityId ?? 0);

    if (!entityType || !entityId) {
      return { success: false, error: "Missing entityType or entityId in context" };
    }

    try {
      const modelMap: Record<string, string> = {
        Client: "client",
        Sale: "sale",
        Policy: "policy",
        Ambassador: "ambassador",
      };

      const modelName = modelMap[entityType];
      if (!modelName) {
        return { success: false, error: `Unknown entity type: ${entityType}` };
      }

      // Use dynamic Prisma model access
      await (prisma as any)[modelName].update({
        where: { id: entityId },
        data: { [field]: value },
      });

      return {
        success: true,
        data: { entityType, entityId, field, value },
      };
    } catch (err) {
      return {
        success: false,
        error: `Status update failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async handleWait(
    config: Record<string, unknown>,
    stepInstance: { id: number; startedAt: Date | null }
  ): Promise<StepResult> {
    const hours = Number(config.hours) || 1;
    const startedAt = stepInstance.startedAt ?? new Date();
    const elapsedMs = Date.now() - startedAt.getTime();
    const requiredMs = hours * 3600 * 1000;

    if (elapsedMs >= requiredMs) {
      // Wait period has elapsed
      return {
        success: true,
        data: { waited: hours, elapsedMs },
      };
    }

    // Not enough time has passed — pause the instance
    return {
      success: true,
      pause: true,
      data: { waitingHours: hours, elapsedMs, remainingMs: requiredMs - elapsedMs },
    };
  }

  private async handleApproval(config: Record<string, unknown>): Promise<StepResult> {
    const approverRole = String(config.approverRole ?? "ADMIN");

    // Always pause — will be resumed by manual approval via API
    return {
      success: true,
      pause: true,
      data: { awaitingApproval: true, approverRole },
    };
  }

  private async handleWebhook(
    config: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<StepResult> {
    const url = String(config.url ?? "");
    const headers = (config.headers ?? {}) as Record<string, string>;

    if (!url) {
      return { success: false, error: "No webhook URL specified" };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          event: "workflow_step",
          context,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      const responseData = await response.text();

      if (!response.ok) {
        return {
          success: false,
          error: `Webhook returned ${response.status}: ${responseData.substring(0, 200)}`,
        };
      }

      return {
        success: true,
        data: { webhookUrl: url, statusCode: response.status, response: responseData.substring(0, 500) },
      };
    } catch (err) {
      return {
        success: false,
        error: `Webhook failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────────

  /**
   * Simple template interpolation: replaces {{key}} with context values.
   */
  private interpolateTemplate(
    template: string,
    context: Record<string, unknown>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return context[key] !== undefined ? String(context[key]) : `{{${key}}}`;
    });
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const workflowEngine = new WorkflowEngine();
export { WorkflowEngine };
