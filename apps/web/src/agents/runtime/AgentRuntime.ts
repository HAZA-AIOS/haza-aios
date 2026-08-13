import type { AgentExecutionRequest, AgentRun, AgentInstance } from "../agent.types";
import { ExecutionManager } from "./ExecutionManager";
import { AgentServiceClass } from "../agent-service";

export class AgentRuntime {
  private executionManager = new ExecutionManager();
  
  // Dependency injection would be better, but we directly use AgentServiceClass static methods 
  // since it's our central data store in this frontend mock architecture.
  
  /**
   * Main entrypoint for agent execution
   */
  async requestExecution(request: AgentExecutionRequest, instance: AgentInstance, getService: () => typeof import("../agent-service").AgentService): Promise<AgentRun> {
    const AgentService = getService();
    
    // 1. Validation & Authorization
    if (instance.organizationId !== request.organizationId) {
      throw new Error("AuthorizationError: Agent does not belong to this organization");
    }
    if (instance.status !== "active" && instance.status !== "configured") {
      throw new Error("AgentInactiveError: Cannot execute inactive agent");
    }

    // 2. Create Run Record
    const newRun: AgentRun = {
      id: "run_" + Math.random().toString(36).substr(2, 9),
      organizationId: request.organizationId,
      agentInstanceId: request.agentInstanceId,
      status: "queued",
      input: request.input,
      startedAt: new Date().toISOString(),
      requestedBy: request.requestedBy,
      metadata: request.metadata
    };

    // Save run to history via AgentService
    await AgentService.saveAgentRun(newRun);

    // 3. Queue Execution
    // We pass a callback for the ExecutionManager to update the run status in our central store
    this.executionManager.dispatch(newRun, instance, async (runId, updates) => {
      await AgentService.updateAgentRun(runId, updates);
    });

    return newRun;
  }

  /**
   * Cancels a running execution
   */
  async cancelExecution(runId: string, getService: () => typeof import("../agent-service").AgentService): Promise<void> {
    const AgentService = getService();
    await this.executionManager.cancelRun(runId, async (id, updates) => {
      await AgentService.updateAgentRun(id, updates);
    });
  }
}

export const Runtime = new AgentRuntime();
