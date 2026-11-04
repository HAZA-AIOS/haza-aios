import { and, desc, eq, lte, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  autonomousTaskPolicies,
  autonomousTaskDefinitions,
  autonomousTaskTriggers,
  autonomousTaskRuns,
  autonomousTaskCheckpoints,
  autonomousTaskEvents,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AutonomousEventType,
  AutonomousTaskCheckpointEntity,
  AutonomousTaskDefinitionEntity,
  AutonomousTaskEventEntity,
  AutonomousTaskPolicyEntity,
  AutonomousTaskRunEntity,
  AutonomousTaskTriggerEntity,
  AutonomyLevel,
  CheckpointType,
  CreateTaskDefinitionDto,
  CreateTaskTriggerDto,
  MissedSchedulePolicy,
  PlanAdaptation,
  TaskApprovalPolicy,
  TaskExecutionPolicy,
  TaskLimits,
  TaskRunStatus,
  TaskStatus,
  TaskTargetType,
  TriggerType,
  UpdateTaskDefinitionDto,
} from "../autonomous.types.js";

export class AutonomousTaskRepository {
  constructor(private readonly context: RepositoryContext) {}

  // -------------------------------------------------------------
  // 1. POLICIES
  // -------------------------------------------------------------
  async getPolicy(organizationId: string, workspaceId: string): Promise<AutonomousTaskPolicyEntity | null> {
    const rows = await this.context.db
      .select()
      .from(autonomousTaskPolicies)
      .where(
        and(
          eq(autonomousTaskPolicies.organizationId, organizationId),
          eq(autonomousTaskPolicies.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!rows || rows.length === 0) return null;
    return this.mapPolicyRow(rows[0]);
  }

  async upsertPolicy(input: {
    organizationId: string;
    workspaceId: string;
    maxActiveTasks?: number;
    maxGlobalConcurrency?: number;
    defaultAutonomyLevel?: AutonomyLevel;
    allowedAutonomyLevels?: AutonomyLevel[];
    emergencyStopAll?: boolean;
    emergencyStoppedBy?: string | null;
  }): Promise<AutonomousTaskPolicyEntity> {
    const existing = await this.getPolicy(input.organizationId, input.workspaceId);
    const now = new Date();

    if (existing) {
      await this.context.db
        .update(autonomousTaskPolicies)
        .set({
          maxActiveTasks: input.maxActiveTasks ?? existing.maxActiveTasks,
          maxGlobalConcurrency: input.maxGlobalConcurrency ?? existing.maxGlobalConcurrency,
          defaultAutonomyLevel: input.defaultAutonomyLevel ?? existing.defaultAutonomyLevel,
          allowedAutonomyLevels: input.allowedAutonomyLevels ?? existing.allowedAutonomyLevels,
          emergencyStopAll: input.emergencyStopAll ?? existing.emergencyStopAll,
          emergencyStoppedAt: input.emergencyStopAll ? now : null,
          emergencyStoppedBy: input.emergencyStopAll ? input.emergencyStoppedBy ?? null : null,
          updatedAt: now,
        })
        .where(eq(autonomousTaskPolicies.id, existing.id));

      return (await this.getPolicy(input.organizationId, input.workspaceId))!;
    }

    const id = randomUUID();
    await this.context.db.insert(autonomousTaskPolicies).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      maxActiveTasks: input.maxActiveTasks ?? 10,
      maxGlobalConcurrency: input.maxGlobalConcurrency ?? 5,
      defaultAutonomyLevel: input.defaultAutonomyLevel ?? "L1",
      allowedAutonomyLevels: input.allowedAutonomyLevels ?? ["L0", "L1", "L2", "L3"],
      emergencyStopAll: input.emergencyStopAll ?? false,
      emergencyStoppedAt: input.emergencyStopAll ? now : null,
      emergencyStoppedBy: input.emergencyStoppedBy ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getPolicy(input.organizationId, input.workspaceId))!;
  }

  // -------------------------------------------------------------
  // 2. TASK DEFINITIONS
  // -------------------------------------------------------------
  async createDefinition(
    organizationId: string,
    workspaceId: string,
    input: CreateTaskDefinitionDto,
    createdBy?: string,
  ): Promise<AutonomousTaskDefinitionEntity> {
    const id = randomUUID();
    const now = new Date();

    const executionPolicy: TaskExecutionPolicy = {
      maxRuntimeSeconds: input.executionPolicy?.maxRuntimeSeconds ?? 3600,
      maxRetries: input.executionPolicy?.maxRetries ?? 3,
      timeoutSeconds: input.executionPolicy?.timeoutSeconds ?? 300,
      maxConcurrency: input.executionPolicy?.maxConcurrency ?? 2,
      retryDelaySeconds: input.executionPolicy?.retryDelaySeconds ?? 30,
    };

    const approvalPolicy: TaskApprovalPolicy = {
      requireApprovalForMutations: input.approvalPolicy?.requireApprovalForMutations ?? true,
      requireApprovalOnReplanning: input.approvalPolicy?.requireApprovalOnReplanning ?? true,
      allowedApproverRoles: input.approvalPolicy?.allowedApproverRoles ?? ["Admin", "Owner"],
    };

    const limits: TaskLimits = {
      maxDailyRuns: input.limits?.maxDailyRuns ?? 50,
      maxTokensPerRun: input.limits?.maxTokensPerRun ?? 100000,
      maxCostUsdPerRun: input.limits?.maxCostUsdPerRun ?? 2.0,
    };

    await this.context.db.insert(autonomousTaskDefinitions).values({
      id,
      organizationId,
      workspaceId,
      name: input.name,
      description: input.description,
      autonomyLevel: input.autonomyLevel ?? "L1",
      targetType: input.targetType,
      workflowDefinitionId: input.workflowDefinitionId || null,
      agentId: input.agentId || null,
      status: "active",
      executionPolicy,
      approvalPolicy,
      limits,
      defaultInput: input.defaultInput || {},
      createdBy: createdBy || null,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getDefinitionById(organizationId, id))!;
  }

  async getDefinitionById(
    organizationId: string,
    id: string,
  ): Promise<AutonomousTaskDefinitionEntity | null> {
    const rows = await this.context.db
      .select()
      .from(autonomousTaskDefinitions)
      .where(
        and(
          eq(autonomousTaskDefinitions.organizationId, organizationId),
          eq(autonomousTaskDefinitions.id, id),
        ),
      )
      .limit(1);

    if (!rows || rows.length === 0) return null;
    return this.mapDefinitionRow(rows[0]);
  }

  async listDefinitions(
    organizationId: string,
    workspaceId?: string,
    status?: TaskStatus,
  ): Promise<AutonomousTaskDefinitionEntity[]> {
    const conditions = [eq(autonomousTaskDefinitions.organizationId, organizationId)];
    if (workspaceId) conditions.push(eq(autonomousTaskDefinitions.workspaceId, workspaceId));
    if (status) conditions.push(eq(autonomousTaskDefinitions.status, status));

    const rows = await this.context.db
      .select()
      .from(autonomousTaskDefinitions)
      .where(and(...conditions))
      .orderBy(desc(autonomousTaskDefinitions.createdAt));

    return rows.map((r) => this.mapDefinitionRow(r));
  }

  async updateDefinition(
    organizationId: string,
    id: string,
    updates: UpdateTaskDefinitionDto,
  ): Promise<AutonomousTaskDefinitionEntity | null> {
    const existing = await this.getDefinitionById(organizationId, id);
    if (!existing) return null;

    const valuesToUpdate: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) valuesToUpdate.name = updates.name;
    if (updates.description !== undefined) valuesToUpdate.description = updates.description;
    if (updates.autonomyLevel !== undefined) valuesToUpdate.autonomyLevel = updates.autonomyLevel;
    if (updates.status !== undefined) valuesToUpdate.status = updates.status;
    if (updates.defaultInput !== undefined) valuesToUpdate.defaultInput = updates.defaultInput;

    if (updates.executionPolicy) {
      valuesToUpdate.executionPolicy = {
        ...existing.executionPolicy,
        ...updates.executionPolicy,
      };
    }
    if (updates.approvalPolicy) {
      valuesToUpdate.approvalPolicy = {
        ...existing.approvalPolicy,
        ...updates.approvalPolicy,
      };
    }
    if (updates.limits) {
      valuesToUpdate.limits = {
        ...existing.limits,
        ...updates.limits,
      };
    }

    await this.context.db
      .update(autonomousTaskDefinitions)
      .set(valuesToUpdate)
      .where(
        and(
          eq(autonomousTaskDefinitions.organizationId, organizationId),
          eq(autonomousTaskDefinitions.id, id),
        ),
      );

    return await this.getDefinitionById(organizationId, id);
  }

  async setEmergencyStop(
    organizationId: string,
    id: string,
    stoppedBy?: string,
    reason?: string,
  ): Promise<AutonomousTaskDefinitionEntity | null> {
    const now = new Date();
    await this.context.db
      .update(autonomousTaskDefinitions)
      .set({
        status: "paused",
        emergencyStoppedAt: now,
        emergencyStoppedBy: stoppedBy || null,
        emergencyStopReason: reason || "Administrative emergency stop",
        updatedAt: now,
      })
      .where(
        and(
          eq(autonomousTaskDefinitions.organizationId, organizationId),
          eq(autonomousTaskDefinitions.id, id),
        ),
      );

    return await this.getDefinitionById(organizationId, id);
  }

  async clearEmergencyStop(
    organizationId: string,
    id: string,
  ): Promise<AutonomousTaskDefinitionEntity | null> {
    const now = new Date();
    await this.context.db
      .update(autonomousTaskDefinitions)
      .set({
        status: "active",
        emergencyStoppedAt: null,
        emergencyStoppedBy: null,
        emergencyStopReason: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(autonomousTaskDefinitions.organizationId, organizationId),
          eq(autonomousTaskDefinitions.id, id),
        ),
      );

    return await this.getDefinitionById(organizationId, id);
  }

  // -------------------------------------------------------------
  // 3. TRIGGERS
  // -------------------------------------------------------------
  async createTrigger(
    organizationId: string,
    workspaceId: string,
    input: CreateTaskTriggerDto,
  ): Promise<AutonomousTaskTriggerEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(autonomousTaskTriggers).values({
      id,
      taskDefinitionId: input.taskDefinitionId,
      organizationId,
      workspaceId,
      name: input.name,
      triggerType: input.triggerType,
      scheduleType: input.scheduleType || null,
      cronExpression: input.cronExpression || null,
      timezone: input.timezone || "UTC",
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      nextRunAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      eventPattern: input.eventPattern || null,
      missedSchedulePolicy: input.missedSchedulePolicy || "run_once",
      isEnabled: true,
      configuration: input.configuration || {},
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getTriggerById(organizationId, id))!;
  }

  async getTriggerById(
    organizationId: string,
    id: string,
  ): Promise<AutonomousTaskTriggerEntity | null> {
    const rows = await this.context.db
      .select()
      .from(autonomousTaskTriggers)
      .where(
        and(
          eq(autonomousTaskTriggers.organizationId, organizationId),
          eq(autonomousTaskTriggers.id, id),
        ),
      )
      .limit(1);

    if (!rows || rows.length === 0) return null;
    return this.mapTriggerRow(rows[0]);
  }

  async listTriggers(
    organizationId: string,
    taskDefinitionId?: string,
  ): Promise<AutonomousTaskTriggerEntity[]> {
    const conditions = [eq(autonomousTaskTriggers.organizationId, organizationId)];
    if (taskDefinitionId) {
      conditions.push(eq(autonomousTaskTriggers.taskDefinitionId, taskDefinitionId));
    }

    const rows = await this.context.db
      .select()
      .from(autonomousTaskTriggers)
      .where(and(...conditions))
      .orderBy(desc(autonomousTaskTriggers.createdAt));

    return rows.map((r) => this.mapTriggerRow(r));
  }

  async listTriggersDue(now: Date = new Date()): Promise<AutonomousTaskTriggerEntity[]> {
    const rows = await this.context.db
      .select()
      .from(autonomousTaskTriggers)
      .where(
        and(
          eq(autonomousTaskTriggers.isEnabled, true),
          lte(autonomousTaskTriggers.nextRunAt, now),
        ),
      )
      .orderBy(autonomousTaskTriggers.nextRunAt)
      .limit(50);

    return rows.map((r) => this.mapTriggerRow(r));
  }

  async updateTrigger(
    organizationId: string,
    id: string,
    updates: Partial<{
      name: string;
      isEnabled: boolean;
      nextRunAt: Date | null;
      lastRunAt: Date | null;
      cronExpression: string | null;
      timezone: string;
    }>,
  ): Promise<AutonomousTaskTriggerEntity | null> {
    const valuesToUpdate: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (updates.name !== undefined) valuesToUpdate.name = updates.name;
    if (updates.isEnabled !== undefined) valuesToUpdate.isEnabled = updates.isEnabled;
    if (updates.nextRunAt !== undefined) valuesToUpdate.nextRunAt = updates.nextRunAt;
    if (updates.lastRunAt !== undefined) valuesToUpdate.lastRunAt = updates.lastRunAt;
    if (updates.cronExpression !== undefined) valuesToUpdate.cronExpression = updates.cronExpression;
    if (updates.timezone !== undefined) valuesToUpdate.timezone = updates.timezone;

    await this.context.db
      .update(autonomousTaskTriggers)
      .set(valuesToUpdate)
      .where(
        and(
          eq(autonomousTaskTriggers.organizationId, organizationId),
          eq(autonomousTaskTriggers.id, id),
        ),
      );

    return await this.getTriggerById(organizationId, id);
  }

  async deleteTrigger(organizationId: string, id: string): Promise<boolean> {
    await this.context.db
      .delete(autonomousTaskTriggers)
      .where(
        and(
          eq(autonomousTaskTriggers.organizationId, organizationId),
          eq(autonomousTaskTriggers.id, id),
        ),
      );
    return true;
  }

  // -------------------------------------------------------------
  // 4. RUNS & LEASING
  // -------------------------------------------------------------
  async createRun(input: {
    taskDefinitionId: string;
    triggerId?: string | null;
    organizationId: string;
    workspaceId: string;
    autonomyLevel: AutonomyLevel;
    idempotencyKey: string;
    inputPayload?: Record<string, unknown>;
    maxRetries?: number;
  }): Promise<AutonomousTaskRunEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(autonomousTaskRuns).values({
      id,
      taskDefinitionId: input.taskDefinitionId,
      triggerId: input.triggerId || null,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      status: "queued",
      idempotencyKey: input.idempotencyKey,
      autonomyLevel: input.autonomyLevel,
      inputPayload: input.inputPayload || {},
      maxRetries: input.maxRetries ?? 3,
      retryCount: 0,
      adaptationHistory: [],
      currentPlanRevision: 0,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getRunById(input.organizationId, id))!;
  }

  async getRunById(organizationId: string, id: string): Promise<AutonomousTaskRunEntity | null> {
    const rows = await this.context.db
      .select()
      .from(autonomousTaskRuns)
      .where(
        and(
          eq(autonomousTaskRuns.organizationId, organizationId),
          eq(autonomousTaskRuns.id, id),
        ),
      )
      .limit(1);

    if (!rows || rows.length === 0) return null;
    return this.mapRunRow(rows[0]);
  }

  async listRuns(
    organizationId: string,
    filters?: {
      taskDefinitionId?: string;
      status?: TaskRunStatus;
      workspaceId?: string;
      limit?: number;
    },
  ): Promise<AutonomousTaskRunEntity[]> {
    const conditions = [eq(autonomousTaskRuns.organizationId, organizationId)];
    if (filters?.taskDefinitionId) {
      conditions.push(eq(autonomousTaskRuns.taskDefinitionId, filters.taskDefinitionId));
    }
    if (filters?.status) {
      conditions.push(eq(autonomousTaskRuns.status, filters.status));
    }
    if (filters?.workspaceId) {
      conditions.push(eq(autonomousTaskRuns.workspaceId, filters.workspaceId));
    }

    const rows = await this.context.db
      .select()
      .from(autonomousTaskRuns)
      .where(and(...conditions))
      .orderBy(desc(autonomousTaskRuns.createdAt))
      .limit(filters?.limit ?? 50);

    return rows.map((r) => this.mapRunRow(r));
  }

  async leaseNextQueuedRun(
    workerId: string,
    leaseDurationSeconds: number = 60,
  ): Promise<AutonomousTaskRunEntity | null> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationSeconds * 1000);

    // Atomically find 1 queued run
    const candidateRows = await this.context.db
      .select()
      .from(autonomousTaskRuns)
      .where(eq(autonomousTaskRuns.status, "queued"))
      .orderBy(autonomousTaskRuns.createdAt)
      .limit(1);

    if (!candidateRows || candidateRows.length === 0) return null;
    const candidate = candidateRows[0];

    // Atomically claim lease if still queued
    await this.context.db
      .update(autonomousTaskRuns)
      .set({
        status: "leased",
        workerId,
        leasedAt: now,
        leaseExpiresAt,
        heartbeatAt: now,
        startedAt: candidate.startedAt || now,
        updatedAt: now,
      })
      .where(
        and(
          eq(autonomousTaskRuns.id, candidate.id),
          eq(autonomousTaskRuns.status, "queued"),
        ),
      );

    return await this.getRunById(candidate.organizationId, candidate.id);
  }

  async heartbeat(runId: string, workerId: string, extensionSeconds: number = 60): Promise<boolean> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + extensionSeconds * 1000);

    await this.context.db
      .update(autonomousTaskRuns)
      .set({
        heartbeatAt: now,
        leaseExpiresAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(autonomousTaskRuns.id, runId),
          eq(autonomousTaskRuns.workerId, workerId),
        ),
      );

    return true;
  }

  async updateRun(
    organizationId: string,
    runId: string,
    updates: Partial<{
      status: TaskRunStatus;
      workflowRunId: string | null;
      agentRunId: string | null;
      outputPayload: Record<string, unknown> | null;
      errorDetails: Record<string, unknown> | null;
      adaptationHistory: PlanAdaptation[];
      currentPlanRevision: number;
      retryCount: number;
      workerId: string | null;
      leaseExpiresAt: Date | null;
      completedAt: Date | null;
    }>,
  ): Promise<AutonomousTaskRunEntity | null> {
    const valuesToUpdate: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (updates.status !== undefined) valuesToUpdate.status = updates.status;
    if (updates.workflowRunId !== undefined) valuesToUpdate.workflowRunId = updates.workflowRunId;
    if (updates.agentRunId !== undefined) valuesToUpdate.agentRunId = updates.agentRunId;
    if (updates.outputPayload !== undefined) valuesToUpdate.outputPayload = updates.outputPayload;
    if (updates.errorDetails !== undefined) valuesToUpdate.errorDetails = updates.errorDetails;
    if (updates.adaptationHistory !== undefined) valuesToUpdate.adaptationHistory = updates.adaptationHistory;
    if (updates.currentPlanRevision !== undefined) valuesToUpdate.currentPlanRevision = updates.currentPlanRevision;
    if (updates.retryCount !== undefined) valuesToUpdate.retryCount = updates.retryCount;
    if (updates.workerId !== undefined) valuesToUpdate.workerId = updates.workerId;
    if (updates.leaseExpiresAt !== undefined) valuesToUpdate.leaseExpiresAt = updates.leaseExpiresAt;
    if (updates.completedAt !== undefined) valuesToUpdate.completedAt = updates.completedAt;

    await this.context.db
      .update(autonomousTaskRuns)
      .set(valuesToUpdate)
      .where(
        and(
          eq(autonomousTaskRuns.organizationId, organizationId),
          eq(autonomousTaskRuns.id, runId),
        ),
      );

    return await this.getRunById(organizationId, runId);
  }

  async reclaimStaleLeases(now: Date = new Date()): Promise<number> {
    // Find runs where status in ('leased', 'running') and leaseExpiresAt < now
    const staleRuns = await this.context.db
      .select()
      .from(autonomousTaskRuns)
      .where(
        and(
          or(eq(autonomousTaskRuns.status, "leased"), eq(autonomousTaskRuns.status, "running")),
          lte(autonomousTaskRuns.leaseExpiresAt, now),
        ),
      );

    let reclaimedCount = 0;
    for (const r of staleRuns) {
      if (r.retryCount < r.maxRetries) {
        await this.context.db
          .update(autonomousTaskRuns)
          .set({
            status: "queued",
            workerId: null,
            leaseExpiresAt: null,
            heartbeatAt: null,
            retryCount: r.retryCount + 1,
            updatedAt: now,
          })
          .where(eq(autonomousTaskRuns.id, r.id));
      } else {
        await this.context.db
          .update(autonomousTaskRuns)
          .set({
            status: "timed_out",
            workerId: null,
            leaseExpiresAt: null,
            completedAt: now,
            errorDetails: { reason: "Lease expired and max retries exceeded (Worker crash recovery)" },
            updatedAt: now,
          })
          .where(eq(autonomousTaskRuns.id, r.id));
      }
      reclaimedCount++;
    }

    return reclaimedCount;
  }

  // -------------------------------------------------------------
  // 5. CHECKPOINTS
  // -------------------------------------------------------------
  async createCheckpoint(input: {
    taskRunId: string;
    organizationId: string;
    checkpointType: CheckpointType;
    stepPointer?: string | null;
    stateSnapshot: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<AutonomousTaskCheckpointEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(autonomousTaskCheckpoints).values({
      id,
      taskRunId: input.taskRunId,
      organizationId: input.organizationId,
      checkpointType: input.checkpointType,
      stepPointer: input.stepPointer || null,
      stateSnapshot: input.stateSnapshot,
      metadata: input.metadata || {},
      createdAt: now,
    });

    return {
      id,
      taskRunId: input.taskRunId,
      organizationId: input.organizationId,
      checkpointType: input.checkpointType,
      stepPointer: input.stepPointer || null,
      stateSnapshot: input.stateSnapshot,
      metadata: input.metadata || {},
      createdAt: now,
    };
  }

  async getLatestCheckpoint(
    organizationId: string,
    taskRunId: string,
  ): Promise<AutonomousTaskCheckpointEntity | null> {
    const rows = await this.context.db
      .select()
      .from(autonomousTaskCheckpoints)
      .where(
        and(
          eq(autonomousTaskCheckpoints.organizationId, organizationId),
          eq(autonomousTaskCheckpoints.taskRunId, taskRunId),
        ),
      )
      .orderBy(desc(autonomousTaskCheckpoints.createdAt))
      .limit(1);

    if (!rows || rows.length === 0) return null;
    return rows[0] as AutonomousTaskCheckpointEntity;
  }

  // -------------------------------------------------------------
  // 6. EVENTS
  // -------------------------------------------------------------
  async createEvent(input: {
    taskRunId: string;
    organizationId: string;
    eventType: AutonomousEventType;
    payload?: Record<string, unknown>;
  }): Promise<AutonomousTaskEventEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(autonomousTaskEvents).values({
      id,
      taskRunId: input.taskRunId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      payload: input.payload || {},
      createdAt: now,
    });

    return {
      id,
      taskRunId: input.taskRunId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      payload: input.payload || {},
      createdAt: now,
    };
  }

  async listEvents(organizationId: string, taskRunId: string): Promise<AutonomousTaskEventEntity[]> {
    const rows = await this.context.db
      .select()
      .from(autonomousTaskEvents)
      .where(
        and(
          eq(autonomousTaskEvents.organizationId, organizationId),
          eq(autonomousTaskEvents.taskRunId, taskRunId),
        ),
      )
      .orderBy(desc(autonomousTaskEvents.createdAt))
      .limit(100);

    return rows as AutonomousTaskEventEntity[];
  }

  // Helper row mappers
  private mapPolicyRow(row: any): AutonomousTaskPolicyEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      maxActiveTasks: row.maxActiveTasks,
      maxGlobalConcurrency: row.maxGlobalConcurrency,
      defaultAutonomyLevel: row.defaultAutonomyLevel as AutonomyLevel,
      allowedAutonomyLevels: row.allowedAutonomyLevels as AutonomyLevel[],
      emergencyStopAll: Boolean(row.emergencyStopAll),
      emergencyStoppedAt: row.emergencyStoppedAt ? new Date(row.emergencyStoppedAt) : null,
      emergencyStoppedBy: row.emergencyStoppedBy,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapDefinitionRow(row: any): AutonomousTaskDefinitionEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      name: row.name,
      description: row.description,
      autonomyLevel: row.autonomyLevel as AutonomyLevel,
      targetType: row.targetType as TaskTargetType,
      workflowDefinitionId: row.workflowDefinitionId,
      agentId: row.agentId,
      status: row.status as TaskStatus,
      executionPolicy: row.executionPolicy as TaskExecutionPolicy,
      approvalPolicy: row.approvalPolicy as TaskApprovalPolicy,
      limits: row.limits as TaskLimits,
      defaultInput: (row.defaultInput || {}) as Record<string, unknown>,
      createdBy: row.createdBy,
      emergencyStoppedAt: row.emergencyStoppedAt ? new Date(row.emergencyStoppedAt) : null,
      emergencyStoppedBy: row.emergencyStoppedBy,
      emergencyStopReason: row.emergencyStopReason,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapTriggerRow(row: any): AutonomousTaskTriggerEntity {
    return {
      id: row.id,
      taskDefinitionId: row.taskDefinitionId,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      name: row.name,
      triggerType: row.triggerType as TriggerType,
      scheduleType: row.scheduleType,
      cronExpression: row.cronExpression,
      timezone: row.timezone || "UTC",
      scheduledAt: row.scheduledAt ? new Date(row.scheduledAt) : null,
      nextRunAt: row.nextRunAt ? new Date(row.nextRunAt) : null,
      lastRunAt: row.lastRunAt ? new Date(row.lastRunAt) : null,
      eventPattern: row.eventPattern,
      missedSchedulePolicy: (row.missedSchedulePolicy || "run_once") as MissedSchedulePolicy,
      isEnabled: Boolean(row.isEnabled),
      configuration: (row.configuration || {}) as Record<string, unknown>,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapRunRow(row: any): AutonomousTaskRunEntity {
    return {
      id: row.id,
      taskDefinitionId: row.taskDefinitionId,
      triggerId: row.triggerId,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      workflowRunId: row.workflowRunId,
      agentRunId: row.agentRunId,
      status: row.status as TaskRunStatus,
      idempotencyKey: row.idempotencyKey,
      autonomyLevel: row.autonomyLevel as AutonomyLevel,
      workerId: row.workerId,
      leasedAt: row.leasedAt ? new Date(row.leasedAt) : null,
      leaseExpiresAt: row.leaseExpiresAt ? new Date(row.leaseExpiresAt) : null,
      heartbeatAt: row.heartbeatAt ? new Date(row.heartbeatAt) : null,
      retryCount: row.retryCount,
      maxRetries: row.maxRetries,
      inputPayload: (row.inputPayload || {}) as Record<string, unknown>,
      outputPayload: row.outputPayload as Record<string, unknown> | null,
      errorDetails: row.errorDetails as Record<string, unknown> | null,
      adaptationHistory: (row.adaptationHistory || []) as PlanAdaptation[],
      currentPlanRevision: row.currentPlanRevision,
      startedAt: row.startedAt ? new Date(row.startedAt) : null,
      completedAt: row.completedAt ? new Date(row.completedAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
