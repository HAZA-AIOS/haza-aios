import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorkflowExecutionManager } from "../WorkflowExecutionManager";
import { WorkflowService } from "../WorkflowService";
import type { Workflow, WorkflowStep, Task } from "../workflow.types";
import { StepExecutors } from "../StepExecutors";

describe("WorkflowExecutionManager", () => {
  let mockWorkflow: Workflow;
  let mockSteps: WorkflowStep[];

  beforeEach(() => {
    mockWorkflow = {
      id: "wf-1",
      organizationId: "org-1",
      name: "Education Demo Workflow",
      description: "Test workflow",
      status: "active",
      version: "1.0",
      configuration: {},
      createdBy: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockSteps = [
      {
        id: "step-1",
        workflowId: "wf-1",
        name: "Retrieve Curriculum",
        type: "knowledge",
        order: 0,
        configuration: {
          query: "Grade 5 Science"
        }
      },
      {
        id: "step-2",
        workflowId: "wf-1",
        name: "Generate Worksheet",
        type: "agent",
        order: 1,
        configuration: {
          agentInstanceId: "worksheet-agent-1",
          input: "{{Retrieve Curriculum}}",
          requireJson: true
        }
      },
      {
        id: "step-3",
        workflowId: "wf-1",
        name: "Validation Condition",
        type: "condition",
        order: 2,
        configuration: {
          variable: "Generate Worksheet",
          operator: "exists",
          value: true
        }
      }
    ];

    vi.restoreAllMocks();
    vi.spyOn(StepExecutors, "executeKnowledgeStep").mockResolvedValue({
      stepId: "step-1",
      success: true,
      status: "completed",
      data: "Grade 5 Science curriculum",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    });
    vi.spyOn(StepExecutors, "executeAgentStep").mockResolvedValue({
      stepId: "step-2",
      success: true,
      status: "completed",
      data: { questions: [] },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    });
    vi.spyOn(StepExecutors, "executeConditionStep").mockResolvedValue({
      stepId: "step-3",
      success: true,
      status: "completed",
      data: { matched: true },
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    });
  });

  it("should execute steps sequentially and pass context", async () => {
    const task: Task = {
      id: "task-1",
      organizationId: "org-1",
      workflowId: "wf-1",
      status: "pending",
      input: {},
      stepResults: {},
      startedAt: new Date().toISOString()
    };

    // We can't await directly because startTask starts a background promise and returns immediately.
    // In our implementation, startTask doesn't return the promise, but for test we can wait a bit.
    
    // Using a mock to intercept saveTask to know when it finishes
    let taskCompleted = false;
    let finalTask: Task | null = null;
    vi.spyOn(WorkflowService, "saveTask").mockImplementation(async (t) => {
      if (t.status === "completed" || t.status === "failed") {
        taskCompleted = true;
        finalTask = t;
      }
      return t;
    });

    await WorkflowExecutionManager.startTask(task, mockWorkflow, mockSteps, "user-1");

    // Wait for completion
    while (!taskCompleted) {
      await new Promise(r => setTimeout(r, 100));
    }

    expect(finalTask).toBeDefined();
    expect(finalTask?.status).toBe("completed");
    expect(finalTask?.stepResults["step-1"]).toBeDefined();
    expect(finalTask?.stepResults["step-1"].success).toBe(true);
    expect(finalTask?.stepResults["step-3"].success).toBe(true);
  });
});
