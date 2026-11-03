import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  agentWorkflowDefinitions,
  agentWorkflowSteps,
  agentWorkflowRuns,
  agentWorkflowStepRuns,
  agentWorkflowArtifacts,
  agentWorkflowEvents,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AgentWorkflowArtifactRecord,
  AgentWorkflowDefinitionRecord,
  AgentWorkflowEventRecord,
  AgentWorkflowRunRecord,
  AgentWorkflowStepRecord,
  AgentWorkflowStepRunRecord,
  CreateWorkflowDefinitionInput,
  WorkflowDefinitionStatus,
  WorkflowRunStatus,
  WorkflowStepRunStatus,
} from "../orchestration.types.js";

export class AgentWorkflowRepository {
  constructor(private readonly context: RepositoryContext) {}

  async createDefinition(input: CreateWorkflowDefinitionInput): Promise<AgentWorkflowDefinitionRecord> {
    const definitionId = randomUUID();

    await this.context.db.insert(agentWorkflowDefinitions).values({
      id: definitionId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      teamId: input.teamId || null,
      name: input.name,
      description: input.description,
      pattern: input.pattern || "sequential",
      status: "draft",
      version: input.version || "1.0.0",
      revision: 1,
      inputSchema: input.inputSchema || { type: "object" },
      outputSchema: input.outputSchema || null,
      configuration: input.configuration || {},
      createdBy: input.createdBy,
    });

    if (input.steps.length > 0) {
      await this.context.db.insert(agentWorkflowSteps).values(
        input.steps.map((s, idx) => ({
          id: randomUUID(),
          workflowDefinitionId: definitionId,
          organizationId: input.organizationId,
          stepKey: s.stepKey,
          name: s.name,
          description: s.description,
          stepOrder: s.stepOrder ?? idx,
          assignedRole: s.assignedRole,
          assignedAgentId: s.assignedAgentId || null,
          dependsOnStepKeys: s.dependsOnStepKeys || [],
          requiresApproval: Boolean(s.requiresApproval),
          approvalRoles: s.approvalRoles || [],
          inputMapping: s.inputMapping || {},
          outputKey: s.outputKey,
          maxRetries: s.maxRetries ?? 2,
          timeoutSeconds: s.timeoutSeconds ?? 300,
          configuration: s.configuration || {},
        })),
      );
    }

    const created = await this.getDefinition(input.organizationId, definitionId);
    if (!created) {
      throw new Error(`Failed to load newly created workflow definition ${definitionId}`);
    }
    return created;
  }

  async getDefinition(
    organizationId: string,
    definitionId: string,
  ): Promise<AgentWorkflowDefinitionRecord | null> {
    const [defRow] = await this.context.db
      .select()
      .from(agentWorkflowDefinitions)
      .where(
        and(
          eq(agentWorkflowDefinitions.organizationId, organizationId),
          eq(agentWorkflowDefinitions.id, definitionId),
        ),
      );

    if (!defRow) return null;

    const stepRows = await this.context.db
      .select()
      .from(agentWorkflowSteps)
      .where(
        and(
          eq(agentWorkflowSteps.organizationId, organizationId),
          eq(agentWorkflowSteps.workflowDefinitionId, definitionId),
        ),
      )
      .orderBy(agentWorkflowSteps.stepOrder);

    const steps: AgentWorkflowStepRecord[] = stepRows.map((r) => ({
      id: r.id,
      workflowDefinitionId: r.workflowDefinitionId,
      organizationId: r.organizationId,
      stepKey: r.stepKey,
      name: r.name,
      description: r.description,
      stepOrder: r.stepOrder,
      assignedRole: r.assignedRole as any,
      assignedAgentId: r.assignedAgentId,
      dependsOnStepKeys: (r.dependsOnStepKeys as string[]) || [],
      requiresApproval: r.requiresApproval,
      approvalRoles: (r.approvalRoles as string[]) || [],
      inputMapping: (r.inputMapping as Record<string, unknown>) || {},
      outputKey: r.outputKey,
      maxRetries: r.maxRetries,
      timeoutSeconds: r.timeoutSeconds,
      configuration: (r.configuration as Record<string, unknown>) || {},
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      id: defRow.id,
      organizationId: defRow.organizationId,
      workspaceId: defRow.workspaceId,
      teamId: defRow.teamId,
      name: defRow.name,
      description: defRow.description,
      pattern: defRow.pattern as any,
      status: defRow.status as any,
      version: defRow.version,
      revision: defRow.revision,
      inputSchema: (defRow.inputSchema as Record<string, unknown>) || {},
      outputSchema: (defRow.outputSchema as Record<string, unknown>) || null,
      configuration: (defRow.configuration as Record<string, unknown>) || {},
      createdBy: defRow.createdBy,
      createdAt: defRow.createdAt.toISOString(),
      updatedAt: defRow.updatedAt.toISOString(),
      steps,
    };
  }

  async listDefinitions(
    organizationId: string,
    workspaceId?: string,
  ): Promise<AgentWorkflowDefinitionRecord[]> {
    const conditions = [eq(agentWorkflowDefinitions.organizationId, organizationId)];
    if (workspaceId) {
      conditions.push(eq(agentWorkflowDefinitions.workspaceId, workspaceId));
    }

    const rows = await this.context.db
      .select()
      .from(agentWorkflowDefinitions)
      .where(and(...conditions))
      .orderBy(desc(agentWorkflowDefinitions.createdAt));

    const result: AgentWorkflowDefinitionRecord[] = [];
    for (const defRow of rows) {
      const stepRows = await this.context.db
        .select()
        .from(agentWorkflowSteps)
        .where(
          and(
            eq(agentWorkflowSteps.organizationId, organizationId),
            eq(agentWorkflowSteps.workflowDefinitionId, defRow.id),
          ),
        )
        .orderBy(agentWorkflowSteps.stepOrder);

      result.push({
        id: defRow.id,
        organizationId: defRow.organizationId,
        workspaceId: defRow.workspaceId,
        teamId: defRow.teamId,
        name: defRow.name,
        description: defRow.description,
        pattern: defRow.pattern as any,
        status: defRow.status as any,
        version: defRow.version,
        revision: defRow.revision,
        inputSchema: (defRow.inputSchema as Record<string, unknown>) || {},
        outputSchema: (defRow.outputSchema as Record<string, unknown>) || null,
        configuration: (defRow.configuration as Record<string, unknown>) || {},
        createdBy: defRow.createdBy,
        createdAt: defRow.createdAt.toISOString(),
        updatedAt: defRow.updatedAt.toISOString(),
        steps: stepRows.map((r) => ({
          id: r.id,
          workflowDefinitionId: r.workflowDefinitionId,
          organizationId: r.organizationId,
          stepKey: r.stepKey,
          name: r.name,
          description: r.description,
          stepOrder: r.stepOrder,
          assignedRole: r.assignedRole as any,
          assignedAgentId: r.assignedAgentId,
          dependsOnStepKeys: (r.dependsOnStepKeys as string[]) || [],
          requiresApproval: r.requiresApproval,
          approvalRoles: (r.approvalRoles as string[]) || [],
          inputMapping: (r.inputMapping as Record<string, unknown>) || {},
          outputKey: r.outputKey,
          maxRetries: r.maxRetries,
          timeoutSeconds: r.timeoutSeconds,
          configuration: (r.configuration as Record<string, unknown>) || {},
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      });
    }

    return result;
  }

  async updateDefinitionStatus(
    organizationId: string,
    definitionId: string,
    status: WorkflowDefinitionStatus,
  ): Promise<AgentWorkflowDefinitionRecord | null> {
    await this.context.db
      .update(agentWorkflowDefinitions)
      .set({ status })
      .where(
        and(
          eq(agentWorkflowDefinitions.organizationId, organizationId),
          eq(agentWorkflowDefinitions.id, definitionId),
        ),
      );
    return this.getDefinition(organizationId, definitionId);
  }

  async createRun(input: {
    organizationId: string;
    workspaceId: string;
    workflowDefinitionId: string;
    teamId?: string | null;
    workflowRevision?: number;
    initiatorUserId: string;
    initialInput: Record<string, unknown>;
    idempotencyKey?: string | null;
  }): Promise<AgentWorkflowRunRecord> {
    const runId = randomUUID();

    await this.context.db.insert(agentWorkflowRuns).values({
      id: runId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      workflowDefinitionId: input.workflowDefinitionId,
      teamId: input.teamId || null,
      workflowRevision: input.workflowRevision || 1,
      initiatorUserId: input.initiatorUserId,
      status: "queued",
      idempotencyKey: input.idempotencyKey || null,
      initialInput: input.initialInput,
      sharedContext: { initialInput: input.initialInput },
      totalDurationMs: 0,
      totalEstimatedCostUsd: "0.000000",
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
    });

    const run = await this.getRun(input.organizationId, runId);
    if (!run) throw new Error(`Failed to load newly created workflow run ${runId}`);
    return run;
  }

  async getRun(organizationId: string, runId: string): Promise<AgentWorkflowRunRecord | null> {
    const [row] = await this.context.db
      .select()
      .from(agentWorkflowRuns)
      .where(
        and(
          eq(agentWorkflowRuns.organizationId, organizationId),
          eq(agentWorkflowRuns.id, runId),
        ),
      );

    if (!row) return null;

    const stepRuns = await this.listStepRuns(runId);
    const artifacts = await this.listArtifacts(runId);

    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      workflowDefinitionId: row.workflowDefinitionId,
      teamId: row.teamId,
      workflowRevision: row.workflowRevision,
      initiatorUserId: row.initiatorUserId,
      status: row.status as WorkflowRunStatus,
      idempotencyKey: row.idempotencyKey,
      initialInput: (row.initialInput as Record<string, unknown>) || {},
      finalOutput: (row.finalOutput as Record<string, unknown>) || null,
      sharedContext: (row.sharedContext as Record<string, unknown>) || {},
      currentStepKey: row.currentStepKey,
      totalDurationMs: row.totalDurationMs,
      totalEstimatedCostUsd: String(row.totalEstimatedCostUsd),
      totalPromptTokens: row.totalPromptTokens,
      totalCompletionTokens: row.totalCompletionTokens,
      safeErrorMessage: row.safeErrorMessage,
      startedAt: row.startedAt?.toISOString() || null,
      completedAt: row.completedAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      stepRuns,
      artifacts,
    };
  }

  async listRuns(
    organizationId: string,
    filter?: { definitionId?: string; status?: WorkflowRunStatus; workspaceId?: string },
  ): Promise<AgentWorkflowRunRecord[]> {
    const conditions = [eq(agentWorkflowRuns.organizationId, organizationId)];
    if (filter?.definitionId) {
      conditions.push(eq(agentWorkflowRuns.workflowDefinitionId, filter.definitionId));
    }
    if (filter?.status) {
      conditions.push(eq(agentWorkflowRuns.status, filter.status));
    }
    if (filter?.workspaceId) {
      conditions.push(eq(agentWorkflowRuns.workspaceId, filter.workspaceId));
    }

    const rows = await this.context.db
      .select()
      .from(agentWorkflowRuns)
      .where(and(...conditions))
      .orderBy(desc(agentWorkflowRuns.createdAt));

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      workflowDefinitionId: row.workflowDefinitionId,
      teamId: row.teamId,
      workflowRevision: row.workflowRevision,
      initiatorUserId: row.initiatorUserId,
      status: row.status as WorkflowRunStatus,
      idempotencyKey: row.idempotencyKey,
      initialInput: (row.initialInput as Record<string, unknown>) || {},
      finalOutput: (row.finalOutput as Record<string, unknown>) || null,
      sharedContext: (row.sharedContext as Record<string, unknown>) || {},
      currentStepKey: row.currentStepKey,
      totalDurationMs: row.totalDurationMs,
      totalEstimatedCostUsd: String(row.totalEstimatedCostUsd),
      totalPromptTokens: row.totalPromptTokens,
      totalCompletionTokens: row.totalCompletionTokens,
      safeErrorMessage: row.safeErrorMessage,
      startedAt: row.startedAt?.toISOString() || null,
      completedAt: row.completedAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async updateRun(
    organizationId: string,
    runId: string,
    patch: {
      status?: WorkflowRunStatus;
      finalOutput?: Record<string, unknown> | null;
      sharedContext?: Record<string, unknown>;
      currentStepKey?: string | null;
      totalDurationMs?: number;
      totalEstimatedCostUsd?: string;
      totalPromptTokens?: number;
      totalCompletionTokens?: number;
      safeErrorMessage?: string | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    },
  ): Promise<AgentWorkflowRunRecord | null> {
    const updateValues: Record<string, unknown> = {};
    if (patch.status !== undefined) updateValues.status = patch.status;
    if (patch.finalOutput !== undefined) updateValues.finalOutput = patch.finalOutput;
    if (patch.sharedContext !== undefined) updateValues.sharedContext = patch.sharedContext;
    if (patch.currentStepKey !== undefined) updateValues.currentStepKey = patch.currentStepKey;
    if (patch.totalDurationMs !== undefined) updateValues.totalDurationMs = patch.totalDurationMs;
    if (patch.totalEstimatedCostUsd !== undefined) updateValues.totalEstimatedCostUsd = patch.totalEstimatedCostUsd;
    if (patch.totalPromptTokens !== undefined) updateValues.totalPromptTokens = patch.totalPromptTokens;
    if (patch.totalCompletionTokens !== undefined) updateValues.totalCompletionTokens = patch.totalCompletionTokens;
    if (patch.safeErrorMessage !== undefined) updateValues.safeErrorMessage = patch.safeErrorMessage;
    if (patch.startedAt !== undefined) updateValues.startedAt = patch.startedAt;
    if (patch.completedAt !== undefined) updateValues.completedAt = patch.completedAt;

    if (Object.keys(updateValues).length > 0) {
      await this.context.db
        .update(agentWorkflowRuns)
        .set(updateValues)
        .where(
          and(
            eq(agentWorkflowRuns.organizationId, organizationId),
            eq(agentWorkflowRuns.id, runId),
          ),
        );
    }

    return this.getRun(organizationId, runId);
  }

  async createStepRun(input: {
    workflowRunId: string;
    stepId: string;
    stepKey: string;
    organizationId: string;
    assignedAgentId?: string | null;
    agentRunId?: string | null;
    status?: WorkflowStepRunStatus;
    attempt?: number;
    inputPayload: Record<string, unknown>;
  }): Promise<AgentWorkflowStepRunRecord> {
    const stepRunId = randomUUID();

    await this.context.db.insert(agentWorkflowStepRuns).values({
      id: stepRunId,
      workflowRunId: input.workflowRunId,
      stepId: input.stepId,
      stepKey: input.stepKey,
      organizationId: input.organizationId,
      assignedAgentId: input.assignedAgentId || null,
      agentRunId: input.agentRunId || null,
      status: input.status || "pending",
      attempt: input.attempt || 1,
      inputPayload: input.inputPayload,
      durationMs: 0,
      startedAt: new Date(),
    });

    const [row] = await this.context.db
      .select()
      .from(agentWorkflowStepRuns)
      .where(eq(agentWorkflowStepRuns.id, stepRunId));

    return {
      id: row.id,
      workflowRunId: row.workflowRunId,
      stepId: row.stepId,
      stepKey: row.stepKey,
      organizationId: row.organizationId,
      assignedAgentId: row.assignedAgentId,
      agentRunId: row.agentRunId,
      status: row.status as WorkflowStepRunStatus,
      attempt: row.attempt,
      inputPayload: (row.inputPayload as Record<string, unknown>) || {},
      outputPayload: (row.outputPayload as Record<string, unknown>) || null,
      stepArtifacts: (row.stepArtifacts as Array<Record<string, unknown>>) || null,
      safeErrorMessage: row.safeErrorMessage,
      durationMs: row.durationMs,
      startedAt: row.startedAt?.toISOString() || null,
      completedAt: row.completedAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listStepRuns(workflowRunId: string): Promise<AgentWorkflowStepRunRecord[]> {
    const rows = await this.context.db
      .select()
      .from(agentWorkflowStepRuns)
      .where(eq(agentWorkflowStepRuns.workflowRunId, workflowRunId))
      .orderBy(agentWorkflowStepRuns.createdAt);

    return rows.map((row) => ({
      id: row.id,
      workflowRunId: row.workflowRunId,
      stepId: row.stepId,
      stepKey: row.stepKey,
      organizationId: row.organizationId,
      assignedAgentId: row.assignedAgentId,
      agentRunId: row.agentRunId,
      status: row.status as WorkflowStepRunStatus,
      attempt: row.attempt,
      inputPayload: (row.inputPayload as Record<string, unknown>) || {},
      outputPayload: (row.outputPayload as Record<string, unknown>) || null,
      stepArtifacts: (row.stepArtifacts as Array<Record<string, unknown>>) || null,
      safeErrorMessage: row.safeErrorMessage,
      durationMs: row.durationMs,
      startedAt: row.startedAt?.toISOString() || null,
      completedAt: row.completedAt?.toISOString() || null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async updateStepRun(
    stepRunId: string,
    patch: {
      status?: WorkflowStepRunStatus;
      agentRunId?: string | null;
      outputPayload?: Record<string, unknown> | null;
      stepArtifacts?: Array<Record<string, unknown>> | null;
      safeErrorMessage?: string | null;
      durationMs?: number;
      completedAt?: Date | null;
    },
  ): Promise<void> {
    const updateValues: Record<string, unknown> = {};
    if (patch.status !== undefined) updateValues.status = patch.status;
    if (patch.agentRunId !== undefined) updateValues.agentRunId = patch.agentRunId;
    if (patch.outputPayload !== undefined) updateValues.outputPayload = patch.outputPayload;
    if (patch.stepArtifacts !== undefined) updateValues.stepArtifacts = patch.stepArtifacts;
    if (patch.safeErrorMessage !== undefined) updateValues.safeErrorMessage = patch.safeErrorMessage;
    if (patch.durationMs !== undefined) updateValues.durationMs = patch.durationMs;
    if (patch.completedAt !== undefined) updateValues.completedAt = patch.completedAt;

    if (Object.keys(updateValues).length > 0) {
      await this.context.db
        .update(agentWorkflowStepRuns)
        .set(updateValues)
        .where(eq(agentWorkflowStepRuns.id, stepRunId));
    }
  }

  async createArtifact(input: {
    workflowRunId: string;
    stepRunId?: string | null;
    organizationId: string;
    workspaceId: string;
    artifactType: string;
    name: string;
    content: Record<string, unknown>;
    provenance: Record<string, unknown>;
    citations?: Array<Record<string, unknown>> | null;
    visibility?: "private" | "workspace" | "organization";
    createdBy?: string | null;
  }): Promise<AgentWorkflowArtifactRecord> {
    const artifactId = randomUUID();

    await this.context.db.insert(agentWorkflowArtifacts).values({
      id: artifactId,
      workflowRunId: input.workflowRunId,
      stepRunId: input.stepRunId || null,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      artifactType: input.artifactType,
      name: input.name,
      content: input.content,
      provenance: input.provenance,
      citations: input.citations || [],
      visibility: input.visibility || "workspace",
      createdBy: input.createdBy || null,
    });

    const [row] = await this.context.db
      .select()
      .from(agentWorkflowArtifacts)
      .where(eq(agentWorkflowArtifacts.id, artifactId));

    return {
      id: row.id,
      workflowRunId: row.workflowRunId,
      stepRunId: row.stepRunId,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      artifactType: row.artifactType,
      name: row.name,
      content: (row.content as Record<string, unknown>) || {},
      provenance: (row.provenance as any) || {},
      citations: (row.citations as Array<Record<string, unknown>>) || null,
      visibility: row.visibility as any,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listArtifacts(workflowRunId: string): Promise<AgentWorkflowArtifactRecord[]> {
    const rows = await this.context.db
      .select()
      .from(agentWorkflowArtifacts)
      .where(eq(agentWorkflowArtifacts.workflowRunId, workflowRunId))
      .orderBy(agentWorkflowArtifacts.createdAt);

    return rows.map((row) => ({
      id: row.id,
      workflowRunId: row.workflowRunId,
      stepRunId: row.stepRunId,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      artifactType: row.artifactType,
      name: row.name,
      content: (row.content as Record<string, unknown>) || {},
      provenance: (row.provenance as any) || {},
      citations: (row.citations as Array<Record<string, unknown>>) || null,
      visibility: row.visibility as any,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async recordEvent(input: {
    workflowRunId: string;
    stepRunId?: string | null;
    organizationId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<AgentWorkflowEventRecord> {
    const eventId = randomUUID();

    await this.context.db.insert(agentWorkflowEvents).values({
      id: eventId,
      workflowRunId: input.workflowRunId,
      stepRunId: input.stepRunId || null,
      organizationId: input.organizationId,
      eventType: input.eventType,
      payload: input.payload,
    });

    const [row] = await this.context.db
      .select()
      .from(agentWorkflowEvents)
      .where(eq(agentWorkflowEvents.id, eventId));

    return {
      id: row.id,
      workflowRunId: row.workflowRunId,
      stepRunId: row.stepRunId,
      organizationId: row.organizationId,
      eventType: row.eventType,
      payload: (row.payload as Record<string, unknown>) || {},
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listEvents(workflowRunId: string): Promise<AgentWorkflowEventRecord[]> {
    const rows = await this.context.db
      .select()
      .from(agentWorkflowEvents)
      .where(eq(agentWorkflowEvents.workflowRunId, workflowRunId))
      .orderBy(agentWorkflowEvents.createdAt);

    return rows.map((row) => ({
      id: row.id,
      workflowRunId: row.workflowRunId,
      stepRunId: row.stepRunId,
      organizationId: row.organizationId,
      eventType: row.eventType,
      payload: (row.payload as Record<string, unknown>) || {},
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
