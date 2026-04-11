import prisma from "../lib/prisma";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentResult {
  agentName: string;
  success: boolean;
  processed: number;
  actions: string[];
  errors: string[];
  duration: number;
}

export type AgentFunction = () => Promise<AgentResult>;

interface RegisteredAgent {
  name: string;
  description: string;
  fn: AgentFunction;
  lastRun: Date | null;
  lastResult: AgentResult | null;
  isRunning: boolean;
}

// ─── Agent Orchestrator ─────────────────────────────────────────────────────

export class AgentOrchestrator {
  private agents: Map<string, RegisteredAgent> = new Map();
  private scheduledIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register an agent function with the orchestrator.
   */
  register(name: string, description: string, fn: AgentFunction): void {
    if (this.agents.has(name)) {
      throw new Error(`Agent "${name}" is already registered.`);
    }

    this.agents.set(name, {
      name,
      description,
      fn,
      lastRun: null,
      lastResult: null,
      isRunning: false,
    });

    console.log(`[AgentOrchestrator] Registered agent: ${name}`);
  }

  /**
   * Run a specific agent by name. Prevents concurrent execution of the same agent.
   */
  async run(name: string): Promise<AgentResult> {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new Error(`Agent "${name}" is not registered.`);
    }

    if (agent.isRunning) {
      return {
        agentName: name,
        success: false,
        processed: 0,
        actions: [],
        errors: [`Agent "${name}" is already running. Skipping concurrent execution.`],
        duration: 0,
      };
    }

    agent.isRunning = true;
    const startTime = Date.now();

    let result: AgentResult;

    try {
      result = await agent.fn();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result = {
        agentName: name,
        success: false,
        processed: 0,
        actions: [],
        errors: [errorMessage],
        duration: Date.now() - startTime,
      };
    }

    result.duration = Date.now() - startTime;
    agent.lastRun = new Date();
    agent.lastResult = result;
    agent.isRunning = false;

    // Persist run to AuditLog
    await this.logAgentRun(result);

    return result;
  }

  /**
   * Run all registered agents sequentially.
   */
  async runAll(): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    for (const [name] of this.agents) {
      const result = await this.run(name);
      results.push(result);
    }

    return results;
  }

  /**
   * Schedule an agent to run on an interval (in milliseconds).
   */
  schedule(name: string, intervalMs: number): void {
    if (!this.agents.has(name)) {
      throw new Error(`Agent "${name}" is not registered.`);
    }

    // Clear any existing schedule
    this.unschedule(name);

    const interval = setInterval(async () => {
      try {
        await this.run(name);
      } catch (err) {
        console.error(`[AgentOrchestrator] Scheduled run failed for "${name}":`, err);
      }
    }, intervalMs);

    this.scheduledIntervals.set(name, interval);
    console.log(
      `[AgentOrchestrator] Scheduled agent "${name}" every ${Math.round(intervalMs / 1000)}s`
    );
  }

  /**
   * Remove a scheduled interval for an agent.
   */
  unschedule(name: string): void {
    const existing = this.scheduledIntervals.get(name);
    if (existing) {
      clearInterval(existing);
      this.scheduledIntervals.delete(name);
    }
  }

  /**
   * Stop all scheduled agents.
   */
  stopAll(): void {
    for (const [name] of this.scheduledIntervals) {
      this.unschedule(name);
    }
    console.log("[AgentOrchestrator] All scheduled agents stopped.");
  }

  /**
   * List all registered agents with their current status.
   */
  listAgents(): Array<{
    name: string;
    description: string;
    isRunning: boolean;
    lastRun: Date | null;
    lastResult: AgentResult | null;
    isScheduled: boolean;
  }> {
    const list: Array<{
      name: string;
      description: string;
      isRunning: boolean;
      lastRun: Date | null;
      lastResult: AgentResult | null;
      isScheduled: boolean;
    }> = [];

    for (const [name, agent] of this.agents) {
      list.push({
        name,
        description: agent.description,
        isRunning: agent.isRunning,
        lastRun: agent.lastRun,
        lastResult: agent.lastResult,
        isScheduled: this.scheduledIntervals.has(name),
      });
    }

    return list;
  }

  /**
   * Get a specific agent's status.
   */
  getAgent(name: string): RegisteredAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Persist agent run results to the AuditLog table.
   */
  private async logAgentRun(result: AgentResult): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: "SYSTEM_AGENT",
          action: "AGENT_RUN",
          entity: "Agent",
          entityId: result.agentName,
          details: {
            success: result.success,
            processed: result.processed,
            actions: result.actions,
            errors: result.errors,
            duration: result.duration,
          },
        },
      });
    } catch (err) {
      console.error(
        `[AgentOrchestrator] Failed to log run for "${result.agentName}":`,
        err
      );
    }
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

export const orchestrator = new AgentOrchestrator();
