import type { AgentRun, AgentInstance } from "../agent.types";
import { AgentExecutor } from "./AgentExecutor";

export class ExecutionManager {
  private activeRuns: Map<string, Promise<void>> = new Map();
  private executor = new AgentExecutor();
  private maxRetries = 2;

  /**
   * Dispatches a run for execution
   */
  async dispatch(run: AgentRun, instance: AgentInstance, updateRunCallback: (runId: string, updates: Partial<AgentRun>) => Promise<void>): Promise<void> {
    const runId = run.id;
    
    // In a real implementation this would push to a queue (Redis/SQS)
    // For this dev implementation, we execute immediately in an async closure.

    const executionPromise = (async () => {
      let attempts = 0;
      let success = false;

      while (attempts <= this.maxRetries && !success) {
        attempts++;
        try {
          await this.executor.execute(run, instance, async (status, data) => {
            await updateRunCallback(runId, {
              status,
              ...data,
              ...(status === "completed" || status === "failed" || status === "cancelled" ? { completedAt: new Date().toISOString() } : {})
            });
          });
          success = true;
        } catch (error: any) {
          if (attempts > this.maxRetries) {
            await updateRunCallback(runId, {
              status: "failed",
              error: `Execution failed after ${attempts} attempts: ${error.message}`,
              completedAt: new Date().toISOString()
            });
          }
        }
      }
      
      this.activeRuns.delete(runId);
    })();

    this.activeRuns.set(runId, executionPromise);
  }

  /**
   * Cancels an active run
   */
  async cancelRun(runId: string, updateRunCallback: (runId: string, updates: Partial<AgentRun>) => Promise<void>): Promise<void> {
    const activeRun = this.activeRuns.get(runId);
    if (activeRun) {
      // In a real implementation we would send a cancellation signal (AbortController) to the executor
      await updateRunCallback(runId, {
        status: "cancelled",
        completedAt: new Date().toISOString()
      });
      this.activeRuns.delete(runId);
    }
  }
}
