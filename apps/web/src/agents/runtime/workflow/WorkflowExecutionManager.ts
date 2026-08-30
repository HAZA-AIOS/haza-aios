import type { Workflow, WorkflowStep, Task, WorkflowExecutionContext } from "./workflow.types";
import { WorkflowService } from "./WorkflowService";
import { StepExecutors } from "./StepExecutors";

export class WorkflowExecutionManagerClass {
  private activeTasks: Map<string, Promise<void>> = new Map();

  async startTask(task: Task, workflow: Workflow, steps: WorkflowStep[], userId: string): Promise<void> {
    const taskId = task.id;

    const executionPromise = (async () => {
      try {
        let currentContext: WorkflowExecutionContext = {
          organizationId: task.organizationId,
          userId,
          agentInstanceId: workflow.agentInstanceId,
          taskId: task.id,
          workflow,
          steps,
          previousResults: {},
          variables: { ...task.input }
        };

        // Execution loop
        for (const step of steps) {
          // If task was cancelled externally, break
          const latestTask = await WorkflowService.getTask(task.id, task.organizationId);
          if (latestTask?.status === "cancelled") {
            throw new Error("Task cancelled");
          }

          // Update task current step
          task.currentStepId = step.id;
          await WorkflowService.saveTask(task);

          // Execute step with retry policy
          const maxAttempts = step.retryPolicy?.maxAttempts || 1;
          const delay = step.retryPolicy?.delay || 1000;
          let attempt = 0;
          let stepResult;
          
          while (attempt < maxAttempts) {
            attempt++;
            
            switch (step.type) {
              case "agent":
                stepResult = await StepExecutors.executeAgentStep(step, currentContext);
                break;
              case "tool":
                stepResult = await StepExecutors.executeToolStep(step, currentContext);
                break;
              case "knowledge":
                stepResult = await StepExecutors.executeKnowledgeStep(step, currentContext);
                break;
              case "condition":
                stepResult = await StepExecutors.executeConditionStep(step, currentContext);
                break;
              default:
                stepResult = {
                  stepId: step.id,
                  success: true,
                  status: "skipped" as const,
                  startedAt: new Date().toISOString(),
                  completedAt: new Date().toISOString(),
                  data: { message: `Step type ${step.type} not implemented` }
                };
            }

            if (stepResult.success || !step.retryPolicy) break;
            if (!stepResult.success && attempt < maxAttempts) {
              await new Promise(r => setTimeout(r, delay));
            }
          }

          // Save step result
          task.stepResults[step.id] = stepResult!;
          
          // Make result available to next steps via ID or Name
          if (stepResult!.success) {
            currentContext.previousResults[step.id] = stepResult!.data;
            currentContext.previousResults[step.name] = stepResult!.data;
          }

          // If Condition failed (it resolved to success=false), we can decide to break or halt. 
          // For Epic 19, if a step strictly fails, we fail the task.
          if (!stepResult!.success && step.type !== "condition") {
            throw new Error(`Step ${step.name} failed: ${stepResult!.error}`);
          }
          if (step.type === "condition" && !stepResult!.success) {
            throw new Error(`Condition ${step.name} not met. Halting workflow.`);
          }
        }

        // Complete task
        task.status = "completed";
        task.completedAt = new Date().toISOString();
        // Return the data of the last step as the task output
        const lastStep = steps[steps.length - 1];
        if (lastStep && task.stepResults[lastStep.id]) {
          task.output = task.stepResults[lastStep.id].data;
        }
        await WorkflowService.saveTask(task);

      } catch (error: any) {
        task.status = "failed";
        task.error = error.message;
        task.completedAt = new Date().toISOString();
        await WorkflowService.saveTask(task);
      } finally {
        this.activeTasks.delete(taskId);
      }
    })();

    this.activeTasks.set(taskId, executionPromise);
  }

  async cancelTask(taskId: string, organizationId: string): Promise<void> {
    const task = await WorkflowService.getTask(taskId, organizationId);
    if (task && (task.status === "running" || task.status === "pending" || task.status === "waiting")) {
      task.status = "cancelled";
      task.completedAt = new Date().toISOString();
      await WorkflowService.saveTask(task);
    }
  }
}

export const WorkflowExecutionManager = new WorkflowExecutionManagerClass();
