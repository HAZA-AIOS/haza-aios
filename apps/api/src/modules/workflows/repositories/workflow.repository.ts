import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  workflowDefinitions,
  workflowRuns,
  workflowStepRuns,
  workflowSteps,
  workflowTasks,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  CreateWorkflowInput,
  CreateWorkflowRunInput,
  CreateWorkflowTaskInput,
  JsonRecord,
  UpdateWorkflowInput,
  UpdateWorkflowRunInput,
  UpdateWorkflowTaskInput,
  WorkflowRecord,
  WorkflowRunRecord,
  WorkflowStepInput,
  WorkflowStepRecord,
  WorkflowStepRunRecord,
  WorkflowTaskRecord,
} from "../workflow.types.js";

export class WorkflowRepository {
  constructor(private readonly context: RepositoryContext) {}

  async listWorkflows(organizationId: string): Promise<WorkflowRecord[]> {
    const rows = await this.context.db
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.organizationId, organizationId))
      .orderBy(desc(workflowDefinitions.updatedAt));
    return rows.map(normalizeWorkflow);
  }

  async getWorkflow(organizationId: string, workflowId: string): Promise<WorkflowRecord | null> {
    const rows = await this.context.db
      .select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.organizationId, organizationId),
          eq(workflowDefinitions.id, workflowId),
        ),
      )
      .limit(1);
    return rows[0] ? normalizeWorkflow(rows[0]) : null;
  }

  async createWorkflow(input: CreateWorkflowInput): Promise<WorkflowRecord> {
    const id = input.id ?? randomUUID();
    const now = new Date();
    await this.context.db.insert(workflowDefinitions).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      agentId: input.agentId ?? null,
      name: input.name,
      description: input.description,
      status: input.status,
      version: input.version,
      revision: 1,
      configuration: input.configuration,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getWorkflow(input.organizationId, id);
    if (!created) throw new Error("Workflow create failed.");
    return created;
  }

  async updateWorkflow(
    organizationId: string,
    workflowId: string,
    expectedRevision: number,
    updates: UpdateWorkflowInput,
  ): Promise<WorkflowRecord | null> {
    const result = await this.context.db
      .update(workflowDefinitions)
      .set({
        ...updates,
        revision: sql`${workflowDefinitions.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workflowDefinitions.organizationId, organizationId),
          eq(workflowDefinitions.id, workflowId),
          eq(workflowDefinitions.revision, expectedRevision),
        ),
      );
    if (result[0].affectedRows === 0) return null;
    return this.getWorkflow(organizationId, workflowId);
  }

  async listSteps(
    organizationId: string,
    workflowId: string,
    revision: number,
  ): Promise<WorkflowStepRecord[]> {
    const rows = await this.context.db
      .select()
      .from(workflowSteps)
      .where(
        and(
          eq(workflowSteps.organizationId, organizationId),
          eq(workflowSteps.workflowId, workflowId),
          eq(workflowSteps.revision, revision),
        ),
      )
      .orderBy(workflowSteps.stepOrder);
    return rows.map(normalizeStep);
  }

  async replaceSteps(
    organizationId: string,
    workflowId: string,
    revision: number,
    steps: WorkflowStepInput[],
  ): Promise<WorkflowStepRecord[]> {
    if (steps.length) {
      const now = new Date();
      await this.context.db.insert(workflowSteps).values(
        steps.map((step) => ({
          id: randomUUID(),
          organizationId,
          workflowId,
          name: step.name,
          type: step.type,
          stepOrder: step.order,
          revision,
          configuration: step.configuration,
          timeoutSeconds: step.timeoutSeconds ?? null,
          maxAttempts: step.retryPolicy?.maxAttempts ?? 1,
          retryDelayMs: step.retryPolicy?.delay ?? 1000,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }
    return this.listSteps(organizationId, workflowId, revision);
  }

  async listRuns(organizationId: string, workflowId?: string): Promise<WorkflowRunRecord[]> {
    const condition = workflowId
      ? and(
          eq(workflowRuns.organizationId, organizationId),
          eq(workflowRuns.workflowId, workflowId),
        )
      : eq(workflowRuns.organizationId, organizationId);
    const rows = await this.context.db
      .select()
      .from(workflowRuns)
      .where(condition)
      .orderBy(desc(workflowRuns.createdAt));
    return rows.map(normalizeRun);
  }

  async getRun(organizationId: string, runId: string): Promise<WorkflowRunRecord | null> {
    const rows = await this.context.db
      .select()
      .from(workflowRuns)
      .where(and(eq(workflowRuns.organizationId, organizationId), eq(workflowRuns.id, runId)))
      .limit(1);
    return rows[0] ? normalizeRun(rows[0]) : null;
  }

  async createRun(
    input: CreateWorkflowRunInput,
    workspaceId: string,
    workflow: WorkflowRecord,
    steps: WorkflowStepRecord[],
  ): Promise<WorkflowRunRecord> {
    if (input.idempotencyKey) {
      const existing = await this.context.db
        .select()
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.workspaceId, workspaceId),
            eq(workflowRuns.workflowId, input.workflowId),
            eq(workflowRuns.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing[0]) return normalizeRun(existing[0]);
    }
    const id = input.id ?? randomUUID();
    const now = new Date();
    await this.context.db.insert(workflowRuns).values({
      id,
      organizationId: input.organizationId,
      workspaceId,
      workflowId: input.workflowId,
      workflowRevision: workflow.revision,
      agentRunId: input.agentRunId ?? null,
      requestedBy: input.requestedBy,
      status: "pending",
      idempotencyKey: input.idempotencyKey ?? null,
      input: input.input,
      output: null,
      executionContext: input.executionContext,
      definitionSnapshot: {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        version: workflow.version,
        revision: workflow.revision,
        agentId: workflow.agentId,
        configuration: workflow.configuration,
      },
      stepsSnapshot: steps.map((step) => ({
        id: step.id,
        name: step.name,
        type: step.type,
        order: step.stepOrder,
        configuration: step.configuration,
        timeoutSeconds: step.timeoutSeconds,
        maxAttempts: step.maxAttempts,
        retryDelayMs: step.retryDelayMs,
      })),
      executionAuthority: "client_reported",
      currentStepId: null,
      safeErrorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getRun(input.organizationId, id);
    if (!created) throw new Error("Workflow run create failed.");
    return created;
  }

  async updateRun(
    organizationId: string,
    runId: string,
    expectedStatus: WorkflowRunRecord["status"],
    updates: Omit<UpdateWorkflowRunInput, "stepResults" | "error" | "reportedBy"> & {
      safeErrorMessage?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    },
  ): Promise<WorkflowRunRecord | null> {
    const result = await this.context.db
      .update(workflowRuns)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(workflowRuns.organizationId, organizationId),
          eq(workflowRuns.id, runId),
          eq(workflowRuns.status, expectedStatus),
        ),
      );
    if (result[0].affectedRows === 0) return null;
    return this.getRun(organizationId, runId);
  }

  async upsertStepRun(
    input: Omit<WorkflowStepRunRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<void> {
    const existing = await this.context.db
      .select({ id: workflowStepRuns.id })
      .from(workflowStepRuns)
      .where(
        and(
          eq(workflowStepRuns.organizationId, input.organizationId),
          eq(workflowStepRuns.workflowRunId, input.workflowRunId),
          eq(workflowStepRuns.workflowStepId, input.workflowStepId),
          eq(workflowStepRuns.attempt, input.attempt),
        ),
      )
      .limit(1);
    const now = new Date();
    if (existing[0]) {
      await this.context.db
        .update(workflowStepRuns)
        .set({ ...input, updatedAt: now })
        .where(eq(workflowStepRuns.id, existing[0].id));
      return;
    }
    await this.context.db
      .insert(workflowStepRuns)
      .values({ ...input, id: randomUUID(), createdAt: now, updatedAt: now });
  }

  async listStepRuns(
    organizationId: string,
    workflowRunId: string,
  ): Promise<WorkflowStepRunRecord[]> {
    const rows = await this.context.db
      .select()
      .from(workflowStepRuns)
      .where(
        and(
          eq(workflowStepRuns.organizationId, organizationId),
          eq(workflowStepRuns.workflowRunId, workflowRunId),
        ),
      )
      .orderBy(workflowStepRuns.createdAt);
    return rows.map((row) => ({
      ...row,
      input: record(row.input),
      output: row.output ? record(row.output) : null,
      metadata: record(row.metadata),
    }));
  }

  async listTasks(organizationId: string, workflowRunId?: string): Promise<WorkflowTaskRecord[]> {
    const condition = workflowRunId
      ? and(
          eq(workflowTasks.organizationId, organizationId),
          eq(workflowTasks.workflowRunId, workflowRunId),
        )
      : eq(workflowTasks.organizationId, organizationId);
    const rows = await this.context.db
      .select()
      .from(workflowTasks)
      .where(condition)
      .orderBy(desc(workflowTasks.createdAt));
    return rows.map(normalizeTask);
  }

  async getTask(organizationId: string, taskId: string): Promise<WorkflowTaskRecord | null> {
    const rows = await this.context.db
      .select()
      .from(workflowTasks)
      .where(and(eq(workflowTasks.organizationId, organizationId), eq(workflowTasks.id, taskId)))
      .limit(1);
    return rows[0] ? normalizeTask(rows[0]) : null;
  }

  async createTask(
    input: CreateWorkflowTaskInput,
    workspaceId: string,
  ): Promise<WorkflowTaskRecord> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(workflowTasks).values({
      ...input,
      id,
      workspaceId,
      assignedUserId: input.assignedUserId ?? null,
      assignedRole: input.assignedRole ?? null,
      assignedAgentId: input.assignedAgentId ?? null,
      output: null,
      status:
        input.assignedUserId || input.assignedRole || input.assignedAgentId
          ? "assigned"
          : "pending",
      dueAt: input.dueAt ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getTask(input.organizationId, id);
    if (!created) throw new Error("Workflow task create failed.");
    return created;
  }

  async updateTask(
    organizationId: string,
    taskId: string,
    expectedStatus: WorkflowTaskRecord["status"],
    updates: UpdateWorkflowTaskInput & { startedAt?: Date | null; completedAt?: Date | null },
  ): Promise<WorkflowTaskRecord | null> {
    const result = await this.context.db
      .update(workflowTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(workflowTasks.organizationId, organizationId),
          eq(workflowTasks.id, taskId),
          eq(workflowTasks.status, expectedStatus),
        ),
      );
    if (result[0].affectedRows === 0) return null;
    return this.getTask(organizationId, taskId);
  }
}

function record(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      return record(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}
function normalizeWorkflow(row: typeof workflowDefinitions.$inferSelect): WorkflowRecord {
  return { ...row, configuration: record(row.configuration) };
}
function normalizeStep(row: typeof workflowSteps.$inferSelect): WorkflowStepRecord {
  return { ...row, configuration: record(row.configuration) };
}
function normalizeRun(row: typeof workflowRuns.$inferSelect): WorkflowRunRecord {
  return {
    ...row,
    input: record(row.input),
    output: row.output ? record(row.output) : null,
    executionContext: record(row.executionContext),
    definitionSnapshot: record(row.definitionSnapshot),
    stepsSnapshot: Array.isArray(row.stepsSnapshot) ? (row.stepsSnapshot as JsonRecord[]) : [],
  };
}
function normalizeTask(row: typeof workflowTasks.$inferSelect): WorkflowTaskRecord {
  return {
    ...row,
    input: record(row.input),
    output: row.output ? record(row.output) : null,
    metadata: record(row.metadata),
  };
}
