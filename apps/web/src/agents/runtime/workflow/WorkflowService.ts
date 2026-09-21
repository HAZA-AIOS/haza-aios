import { ApiError, apiClient } from "@/api/api-client";
import { readStoredAuth } from "@/auth/auth-storage";
import type { Workflow, WorkflowStep, Task, StepResult } from "./workflow.types";

type ApiWorkflow = Omit<Workflow, "agentInstanceId"> & {
  workspaceId: string;
  agentId: string | null;
};
type ApiStep = Omit<WorkflowStep, "order" | "retryPolicy"> & {
  stepOrder: number;
  maxAttempts: number;
  retryDelayMs: number;
};
type ApiRun = {
  id: string;
  organizationId: string;
  workflowId: string;
  agentRunId: string | null;
  status: Task["status"];
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  currentStepId: string | null;
  safeErrorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
};
type ApiStepRun = {
  workflowStepId: string;
  status: StepResult["status"];
  output: Record<string, unknown> | null;
  safeErrorMessage: string | null;
  metadata: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
};

export class WorkflowServiceClass {
  private readonly organizationByWorkflow = new Map<string, string>();

  async getWorkflows(organizationId: string): Promise<Workflow[]> {
    const response = await this.request<{ workflows: ApiWorkflow[] }>(organizationId, "/workflows");
    response.workflows.forEach((workflow) =>
      this.organizationByWorkflow.set(workflow.id, organizationId),
    );
    return response.workflows.map(toWorkflow);
  }

  async getWorkflow(id: string, organizationId: string): Promise<Workflow | null> {
    try {
      const response = await this.request<{ workflow: ApiWorkflow }>(
        organizationId,
        `/workflows/${id}`,
      );
      this.organizationByWorkflow.set(id, organizationId);
      return toWorkflow(response.workflow);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async saveWorkflow(workflow: Workflow): Promise<Workflow> {
    const exists = await this.getWorkflow(workflow.id, workflow.organizationId);
    const body = {
      id: workflow.id,
      workspaceId: workflow.workspaceId ?? (await this.resolveWorkspace(workflow.organizationId)),
      agentInstanceId: workflow.agentInstanceId,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      version: workflow.version,
      configuration: workflow.configuration,
      expectedRevision: exists?.revision,
    };
    const response = exists
      ? await this.request<{ workflow: ApiWorkflow }>(
          workflow.organizationId,
          `/workflows/${workflow.id}`,
          { method: "PATCH", body: JSON.stringify(body) },
        )
      : await this.request<{ workflow: ApiWorkflow }>(workflow.organizationId, "/workflows", {
          method: "POST",
          body: JSON.stringify(body),
        });
    this.organizationByWorkflow.set(workflow.id, workflow.organizationId);
    return toWorkflow(response.workflow);
  }

  async getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
    const organizationId = this.requireOrganization(workflowId);
    const response = await this.request<{ steps: ApiStep[] }>(
      organizationId,
      `/workflows/${workflowId}/steps`,
    );
    return response.steps.map(toStep);
  }

  async saveWorkflowSteps(steps: WorkflowStep[], workflowIdContext?: string): Promise<void> {
    const targetWorkflowId = steps[0]?.workflowId ?? workflowIdContext;
    if (!targetWorkflowId) throw new Error("Workflow context is required to save steps.");
    const workflowId = targetWorkflowId;
    if (steps.some((step) => step.workflowId !== workflowId))
      throw new Error("All workflow steps must belong to one workflow.");
    const organizationId = this.requireOrganization(workflowId);
    const workflow = await this.getWorkflow(workflowId, organizationId);
    if (!workflow?.revision) throw new Error("Workflow revision context is missing.");
    await this.request(organizationId, `/workflows/${workflowId}/steps`, {
      method: "PUT",
      body: JSON.stringify({ steps, expectedRevision: workflow.revision }),
    });
  }

  async getTasks(organizationId: string, workflowId?: string): Promise<Task[]> {
    const query = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : "";
    const response = await this.request<{ runs: ApiRun[] }>(
      organizationId,
      `/workflow-runs${query}`,
    );
    return response.runs.map((run) => toTask(run));
  }

  async getTask(id: string, organizationId: string): Promise<Task | null> {
    try {
      const response = await this.request<{ run: ApiRun; stepRuns: ApiStepRun[] }>(
        organizationId,
        `/workflow-runs/${id}`,
      );
      return toTask(response.run, response.stepRuns);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  }

  async saveTask(task: Task): Promise<Task> {
    const existing = await this.getTask(task.id, task.organizationId);
    if (!existing) {
      const response = await this.request<{ run: ApiRun }>(task.organizationId, "/workflow-runs", {
        method: "POST",
        body: JSON.stringify({
          id: task.id,
          workflowId: task.workflowId,
          idempotencyKey: task.id,
          agentRunId: task.agentRunId,
          input: task.input,
        }),
      });
      if (task.status === "pending") return toTask(response.run);
    }
    const response = await this.request<{ run: ApiRun; stepRuns: ApiStepRun[] }>(
      task.organizationId,
      `/workflow-runs/${task.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: task.status,
          currentStepId: task.currentStepId ?? null,
          output: task.output,
          error: task.error,
          stepResults: task.stepResults,
        }),
      },
    );
    return toTask(response.run, response.stepRuns);
  }

  private async resolveWorkspace(organizationId: string): Promise<string> {
    const response = await this.request<{ workspaces: Array<{ id: string }> }>(
      organizationId,
      "/workspaces",
    );
    if (!response.workspaces[0]) throw new Error("Create a workspace before saving a workflow.");
    return response.workspaces[0].id;
  }

  private requireOrganization(workflowId: string): string {
    const organizationId = this.organizationByWorkflow.get(workflowId);
    if (!organizationId) throw new Error("Workflow organization context is missing.");
    return organizationId;
  }

  private request<T>(organizationId: string, path: string, options: RequestInit = {}): Promise<T> {
    return apiClient.request<T>(`/api/v1/organizations/${organizationId}${path}`, {
      ...options,
      authToken: readStoredAuth()?.session.accessToken,
    });
  }
}

function toWorkflow(workflow: ApiWorkflow): Workflow {
  return { ...workflow, agentInstanceId: workflow.agentId ?? undefined };
}
function toStep(step: ApiStep): WorkflowStep {
  return {
    ...step,
    order: step.stepOrder,
    retryPolicy:
      step.maxAttempts > 1
        ? { maxAttempts: step.maxAttempts, delay: step.retryDelayMs }
        : undefined,
  };
}
function toTask(run: ApiRun, stepRuns: ApiStepRun[] = []): Task {
  const stepResults = Object.fromEntries(
    stepRuns.map((step) => [
      step.workflowStepId,
      {
        stepId: step.workflowStepId,
        success: ["completed", "skipped"].includes(step.status),
        status: step.status,
        data: step.output ?? undefined,
        error: step.safeErrorMessage ?? undefined,
        metadata: step.metadata,
        startedAt: step.startedAt ?? new Date().toISOString(),
        completedAt: step.completedAt ?? new Date().toISOString(),
      } satisfies StepResult,
    ]),
  );
  return {
    id: run.id,
    organizationId: run.organizationId,
    workflowId: run.workflowId,
    agentRunId: run.agentRunId ?? undefined,
    status: run.status,
    input: run.input,
    output: run.output ?? undefined,
    currentStepId: run.currentStepId ?? undefined,
    startedAt: run.startedAt ?? undefined,
    completedAt: run.completedAt ?? undefined,
    error: run.safeErrorMessage ?? undefined,
    stepResults,
  };
}

export const WorkflowService = new WorkflowServiceClass();
