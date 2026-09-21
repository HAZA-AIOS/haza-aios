import { and, eq } from "drizzle-orm";
import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import {
  aiAgentDefinitions,
  aiAgentRuns,
  organizationMemberships,
  roles,
  workflowSteps,
  workspaces,
} from "../../../database/schema.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { withTransaction } from "../../../database/transactions.js";
import { WorkflowRepository } from "../repositories/workflow.repository.js";
import { OperationalService } from "../../operations/services/operational.service.js";
import type {
  CreateWorkflowInput,
  CreateWorkflowRunInput,
  CreateWorkflowTaskInput,
  UpdateWorkflowRequest,
  UpdateWorkflowRunInput,
  UpdateWorkflowTaskInput,
  WorkflowRecord,
  WorkflowRunRecord,
  WorkflowRunStatus,
  WorkflowStepInput,
  WorkflowStepRecord,
  WorkflowTaskRecord,
  WorkflowTaskStatus,
} from "../workflow.types.js";

const runTransitions: Record<WorkflowRunStatus, WorkflowRunStatus[]> = {
  pending: ["running", "failed", "cancelled"],
  running: ["waiting", "completed", "failed", "cancelled"],
  waiting: ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};
const taskTransitions: Record<WorkflowTaskStatus, WorkflowTaskStatus[]> = {
  pending: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "blocked", "waiting", "cancelled"],
  in_progress: ["blocked", "waiting", "completed", "failed", "cancelled"],
  blocked: ["assigned", "in_progress", "waiting", "cancelled"],
  waiting: ["assigned", "in_progress", "completed", "cancelled"],
  completed: [],
  cancelled: [],
  failed: [],
};

export class WorkflowService {
  constructor(private readonly database: DatabaseClient) {}

  listWorkflows(organizationId: string): Promise<WorkflowRecord[]> {
    return this.repository().listWorkflows(organizationId);
  }

  async getWorkflow(organizationId: string, workflowId: string): Promise<WorkflowRecord> {
    const workflow = await this.repository().getWorkflow(organizationId, workflowId);
    if (!workflow) throw new ApiError(404, "NOT_FOUND", "Workflow not found.");
    return workflow;
  }

  async createWorkflow(input: CreateWorkflowInput): Promise<WorkflowRecord> {
    await this.assertWorkspace(input.organizationId, input.workspaceId);
    if (input.agentId)
      await this.assertAgent(input.organizationId, input.agentId, input.workspaceId);
    return this.repository().createWorkflow(input);
  }

  async updateWorkflow(
    organizationId: string,
    workflowId: string,
    input: UpdateWorkflowRequest,
  ): Promise<WorkflowRecord> {
    const existing = await this.getWorkflow(organizationId, workflowId);
    if (existing.revision !== input.expectedRevision)
      throw new ApiError(409, "VALIDATION_FAILED", "Workflow revision conflict.");
    if (existing.status === "archived" && input.status && input.status !== "archived")
      throw new ApiError(409, "VALIDATION_FAILED", "Archived workflows cannot be reactivated.");
    if (input.agentId) await this.assertAgent(organizationId, input.agentId, existing.workspaceId);
    const { expectedRevision, ...updates } = input;
    const updated = await this.repository().updateWorkflow(
      organizationId,
      workflowId,
      expectedRevision,
      updates,
    );
    if (!updated) throw new ApiError(409, "VALIDATION_FAILED", "Workflow revision conflict.");
    return updated;
  }

  async listSteps(organizationId: string, workflowId: string): Promise<WorkflowStepRecord[]> {
    const workflow = await this.getWorkflow(organizationId, workflowId);
    return this.repository().listSteps(organizationId, workflowId, workflow.revision);
  }

  async replaceSteps(
    organizationId: string,
    workflowId: string,
    expectedRevision: number,
    steps: WorkflowStepInput[],
  ): Promise<WorkflowStepRecord[]> {
    return withTransaction(this.database, async ({ tx }) => {
      const repository = new WorkflowRepository(createRepositoryContext(tx));
      const workflow = await repository.getWorkflow(organizationId, workflowId);
      if (!workflow) throw new ApiError(404, "NOT_FOUND", "Workflow not found.");
      if (workflow.revision !== expectedRevision)
        throw new ApiError(409, "VALIDATION_FAILED", "Workflow revision conflict.");
      const updated = await repository.updateWorkflow(
        organizationId,
        workflowId,
        expectedRevision,
        {},
      );
      if (!updated) throw new ApiError(409, "VALIDATION_FAILED", "Workflow revision conflict.");
      return repository.replaceSteps(organizationId, workflowId, updated.revision, steps);
    });
  }

  listRuns(organizationId: string, workflowId?: string): Promise<WorkflowRunRecord[]> {
    return this.repository().listRuns(organizationId, workflowId);
  }

  async getRun(organizationId: string, runId: string): Promise<WorkflowRunRecord> {
    const run = await this.repository().getRun(organizationId, runId);
    if (!run) throw new ApiError(404, "NOT_FOUND", "Workflow run not found.");
    return run;
  }

  async getRunState(organizationId: string, runId: string) {
    const run = await this.getRun(organizationId, runId);
    return {
      run,
      stepRuns: await this.repository().listStepRuns(organizationId, runId),
    };
  }

  async createRun(input: CreateWorkflowRunInput): Promise<WorkflowRunRecord> {
    const workflow = await this.getWorkflow(input.organizationId, input.workflowId);
    if (workflow.status === "archived")
      throw new ApiError(409, "VALIDATION_FAILED", "Archived workflows cannot be executed.");
    if (input.agentRunId) await this.assertAgentRun(input.organizationId, input.agentRunId);
    const steps = await this.repository().listSteps(
      input.organizationId,
      workflow.id,
      workflow.revision,
    );
    return this.repository().createRun(input, workflow.workspaceId, workflow, steps);
  }

  async updateRun(
    organizationId: string,
    runId: string,
    input: UpdateWorkflowRunInput,
  ): Promise<{
    run: WorkflowRunRecord;
    stepRuns: Awaited<ReturnType<WorkflowRepository["listStepRuns"]>>;
  }> {
    const existing = await this.getRun(organizationId, runId);
    if (
      input.status !== existing.status &&
      !runTransitions[existing.status].includes(input.status)
    ) {
      throw new ApiError(
        409,
        "VALIDATION_FAILED",
        `Workflow run cannot transition from ${existing.status} to ${input.status}.`,
      );
    }
    if (input.currentStepId)
      await this.assertStep(
        organizationId,
        existing.workflowId,
        input.currentStepId,
        existing.workflowRevision,
      );
    const now = new Date();
    return withTransaction(this.database, async ({ tx }) => {
      const repository = new WorkflowRepository(createRepositoryContext(tx));
      if (input.stepResults) {
        for (const [stepId, result] of Object.entries(input.stepResults)) {
          await this.assertStep(
            organizationId,
            existing.workflowId,
            stepId,
            existing.workflowRevision,
            tx,
          );
          await repository.upsertStepRun({
            organizationId,
            workflowRunId: runId,
            workflowStepId: stepId,
            status: result.status,
            attempt: 1,
            input: {},
            output:
              result.data && typeof result.data === "object" && !Array.isArray(result.data)
                ? (result.data as Record<string, unknown>)
                : result.data === undefined
                  ? null
                  : { value: result.data },
            metadata: result.metadata ?? {},
            safeErrorMessage: result.error ? sanitize(result.error) : null,
            reportedBy: input.reportedBy,
            startedAt: parseDate(result.startedAt),
            completedAt: parseDate(result.completedAt),
          });
        }
      }
      const startedAt =
        input.status === "running" && !existing.startedAt ? now : existing.startedAt;
      const completedAt = ["completed", "failed", "cancelled"].includes(input.status)
        ? now
        : existing.completedAt;
      const run = await repository.updateRun(organizationId, runId, existing.status, {
        status: input.status,
        currentStepId: input.currentStepId,
        output: input.output,
        executionContext: input.executionContext,
        safeErrorMessage:
          input.status === "failed"
            ? sanitize(input.error ?? "Workflow run failed.")
            : existing.safeErrorMessage,
        startedAt,
        completedAt,
      });
      if (!run)
        throw new ApiError(409, "VALIDATION_FAILED", "Workflow run state changed concurrently.");
      if (
        input.status !== existing.status &&
        ["completed", "failed", "cancelled"].includes(input.status)
      ) {
        const operations = new OperationalService(this.database);
        await operations.emitDomainEvent(
          {
            organizationId,
            workspaceId: run.workspaceId,
            eventType: `workflow.${input.status}`,
            aggregateType: "workflow_run",
            aggregateId: run.id,
            actorUserId: input.reportedBy,
            payload: { workflowId: run.workflowId, status: run.status },
            correlationId: run.id,
            idempotencyKey: `workflow-run:${run.id}:${input.status}`,
          },
          tx,
        );
        await operations.recordAudit(
          {
            organizationId,
            workspaceId: run.workspaceId,
            actorUserId: input.reportedBy,
            action: `workflow.run.${input.status}`,
            resourceType: "workflow_run",
            resourceId: run.id,
            operation: "update",
            correlationId: run.id,
            beforeSnapshot: { status: existing.status },
            afterSnapshot: { status: run.status },
            changedFields: ["status"],
          },
          tx,
        );
        if (input.status === "failed") {
          await operations.recordOperationalEvent(
            {
              organizationId,
              workspaceId: run.workspaceId,
              severity: "error",
              component: "workflow",
              eventType: "workflow.execution.failed",
              status: "failed",
              resourceType: "workflow_run",
              resourceId: run.id,
              workflowRunId: run.id,
              correlationId: run.id,
              summary: "Workflow execution failed.",
              safeErrorMessage: run.safeErrorMessage,
              metadata: { workflowId: run.workflowId },
            },
            tx,
          );
        }
      }
      return { run, stepRuns: await repository.listStepRuns(organizationId, runId) };
    });
  }

  listTasks(organizationId: string, workflowRunId?: string): Promise<WorkflowTaskRecord[]> {
    return this.repository().listTasks(organizationId, workflowRunId);
  }

  async createTask(input: CreateWorkflowTaskInput): Promise<WorkflowTaskRecord> {
    const run = await this.getRun(input.organizationId, input.workflowRunId);
    await this.assertStep(
      input.organizationId,
      run.workflowId,
      input.workflowStepId,
      run.workflowRevision,
    );
    await this.assertAssignments(
      input.organizationId,
      run.workspaceId,
      input.assignedUserId,
      input.assignedRole,
      input.assignedAgentId,
    );
    return withTransaction(this.database, async ({ tx }) => {
      const task = await new WorkflowRepository(createRepositoryContext(tx)).createTask(
        input,
        run.workspaceId,
      );
      const operations = new OperationalService(this.database);
      const event = await operations.emitDomainEvent(
        {
          organizationId: input.organizationId,
          workspaceId: run.workspaceId,
          eventType: "workflow.task.assigned",
          aggregateType: "workflow_task",
          aggregateId: task.id,
          actorUserId: input.createdBy,
          payload: {
            workflowRunId: task.workflowRunId,
            workflowStepId: task.workflowStepId,
            assignedUserId: task.assignedUserId,
            assignedRole: task.assignedRole,
          },
          correlationId: run.id,
          idempotencyKey: `workflow-task:${task.id}:assigned`,
        },
        tx,
      );
      await operations.recordAudit(
        {
          organizationId: input.organizationId,
          workspaceId: run.workspaceId,
          actorUserId: input.createdBy,
          action: "workflow.task.assigned",
          resourceType: "workflow_task",
          resourceId: task.id,
          operation: "create",
          correlationId: run.id,
          afterSnapshot: {
            status: task.status,
            assignedUserId: task.assignedUserId,
            assignedRole: task.assignedRole,
          },
        },
        tx,
      );
      if (task.assignedUserId && event) {
        await operations.createUserNotification(
          {
            organizationId: input.organizationId,
            workspaceId: run.workspaceId,
            recipientUserId: task.assignedUserId,
            notificationType: "workflow.task.assigned",
            title: task.title,
            message: task.description ?? "A workflow task requires your attention.",
            priority: task.priority,
            sourceEventId: event.id,
            relatedResourceType: "workflow_task",
            relatedResourceId: task.id,
            actionPath: `/workspace/workflows/runs/${run.id}`,
          },
          tx,
        );
      }
      return task;
    });
  }

  async updateTask(
    organizationId: string,
    taskId: string,
    input: UpdateWorkflowTaskInput,
  ): Promise<WorkflowTaskRecord> {
    const existing = await this.repository().getTask(organizationId, taskId);
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Workflow task not found.");
    if (
      input.status !== existing.status &&
      !taskTransitions[existing.status].includes(input.status)
    ) {
      throw new ApiError(
        409,
        "VALIDATION_FAILED",
        `Workflow task cannot transition from ${existing.status} to ${input.status}.`,
      );
    }
    await this.assertAssignments(
      organizationId,
      existing.workspaceId,
      input.assignedUserId ?? undefined,
      input.assignedRole ?? undefined,
      input.assignedAgentId ?? undefined,
    );
    const now = new Date();
    const updated = await this.repository().updateTask(organizationId, taskId, existing.status, {
      ...input,
      startedAt: input.status === "in_progress" && !existing.startedAt ? now : existing.startedAt,
      completedAt: ["completed", "failed", "cancelled"].includes(input.status)
        ? now
        : existing.completedAt,
    });
    if (!updated)
      throw new ApiError(409, "VALIDATION_FAILED", "Workflow task state changed concurrently.");
    return updated;
  }

  private repository() {
    return new WorkflowRepository(createRepositoryContext(this.database.db));
  }

  private async assertWorkspace(organizationId: string, workspaceId: string): Promise<void> {
    const rows = await this.database.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.organizationId, organizationId), eq(workspaces.id, workspaceId)))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Workspace not found.");
  }
  private async assertAgent(
    organizationId: string,
    agentId: string,
    workspaceId?: string,
  ): Promise<void> {
    const rows = await this.database.db
      .select({ id: aiAgentDefinitions.id, workspaceId: aiAgentDefinitions.workspaceId })
      .from(aiAgentDefinitions)
      .where(
        and(
          eq(aiAgentDefinitions.organizationId, organizationId),
          eq(aiAgentDefinitions.id, agentId),
        ),
      )
      .limit(1);
    if (!rows[0] || (workspaceId && rows[0].workspaceId !== workspaceId))
      throw new ApiError(404, "NOT_FOUND", "Agent not found.");
  }
  private async assertAgentRun(organizationId: string, agentRunId: string): Promise<void> {
    const rows = await this.database.db
      .select({ id: aiAgentRuns.id })
      .from(aiAgentRuns)
      .where(and(eq(aiAgentRuns.organizationId, organizationId), eq(aiAgentRuns.id, agentRunId)))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Agent run not found.");
  }
  private async assertStep(
    organizationId: string,
    workflowId: string,
    stepId: string,
    revision?: number,
    db = this.database.db,
  ): Promise<void> {
    const rows = await db
      .select({ id: workflowSteps.id })
      .from(workflowSteps)
      .where(
        and(
          eq(workflowSteps.organizationId, organizationId),
          eq(workflowSteps.workflowId, workflowId),
          eq(workflowSteps.id, stepId),
          ...(revision === undefined ? [] : [eq(workflowSteps.revision, revision)]),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Workflow step not found.");
  }
  private async assertAssignments(
    organizationId: string,
    workspaceId: string,
    userId?: string | null,
    roleName?: string | null,
    agentId?: string | null,
  ): Promise<void> {
    if (userId) {
      const rows = await this.database.db
        .select({ id: organizationMemberships.id })
        .from(organizationMemberships)
        .where(
          and(
            eq(organizationMemberships.organizationId, organizationId),
            eq(organizationMemberships.userId, userId),
            eq(organizationMemberships.status, "active"),
          ),
        )
        .limit(1);
      if (!rows[0])
        throw new ApiError(404, "NOT_FOUND", "Assigned user is not an active organization member.");
    }
    if (roleName) {
      const rows = await this.database.db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, organizationId),
            eq(roles.name, roleName),
            eq(roles.scope, "organization"),
          ),
        )
        .limit(1);
      if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Assigned role not found.");
    }
    if (agentId) await this.assertAgent(organizationId, agentId, workspaceId);
  }
}

function sanitize(value: string): string {
  return value
    .replace(/(authorization|api[_-]?key|password|secret|token)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 1000);
}
function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
