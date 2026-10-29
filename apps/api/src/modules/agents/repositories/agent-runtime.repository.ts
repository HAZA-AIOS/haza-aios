import { and, desc, eq, lt, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  aiAgentApprovalDecisions,
  aiAgentApprovalRequests,
  aiAgentConversations,
  aiAgentMessages,
  aiAgentRunAttempts,
  aiAgentRunEvents,
  aiAgentRuns,
  aiAgentRuntimeUsage,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AgentApprovalDecisionRecord,
  AgentApprovalRequestRecord,
  AgentApprovalStatus,
  AgentConversationRecord,
  AgentMessageRecord,
  AgentRunAttemptRecord,
  AgentRunEventRecord,
  AgentRunEventType,
  AgentRunRecord,
  AgentRunStatus,
  AgentRuntimeUsageRecord,
  JsonRecord,
  PaginationInput,
  RuntimeMonitoringMetrics,
} from "../agent.types.js";

export class AgentRuntimeRepository {
  constructor(private readonly context: RepositoryContext) {}

  async listRuns(
    organizationId: string,
    agentId?: string,
    userId?: string,
    pagination: PaginationInput = { limit: 50, offset: 0 },
    status?: AgentRunStatus,
  ): Promise<AgentRunRecord[]> {
    const conditions = [eq(aiAgentRuns.organizationId, organizationId)];
    if (agentId) {
      conditions.push(eq(aiAgentRuns.agentId, agentId));
    }
    if (userId) {
      conditions.push(eq(aiAgentRuns.requestedBy, userId));
    }
    if (status) {
      conditions.push(eq(aiAgentRuns.status, status));
    }

    const rows = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(and(...conditions))
      .orderBy(desc(aiAgentRuns.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
    return rows.map(normalizeRun);
  }

  async getRun(
    organizationId: string,
    runId: string,
    userId?: string,
  ): Promise<AgentRunRecord | null> {
    const conditions = [
      eq(aiAgentRuns.organizationId, organizationId),
      eq(aiAgentRuns.id, runId),
    ];
    if (userId) {
      conditions.push(eq(aiAgentRuns.requestedBy, userId));
    }

    const rows = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(and(...conditions))
      .limit(1);
    return rows[0] ? normalizeRun(rows[0]) : null;
  }

  async getRunById(runId: string): Promise<AgentRunRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(eq(aiAgentRuns.id, runId))
      .limit(1);
    return rows[0] ? normalizeRun(rows[0]) : null;
  }

  async getRunForConversation(
    organizationId: string,
    runId: string,
    conversationId: string,
    userId?: string,
  ): Promise<AgentRunRecord | null> {
    const conditions = [
      eq(aiAgentRuns.organizationId, organizationId),
      eq(aiAgentRuns.id, runId),
      eq(aiAgentRuns.conversationId, conversationId),
    ];
    if (userId) {
      conditions.push(eq(aiAgentRuns.requestedBy, userId));
    }
    const rows = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(and(...conditions))
      .limit(1);
    return rows[0] ? normalizeRun(rows[0]) : null;
  }

  async createRun(
    input: Omit<
      AgentRunRecord,
      | "id"
      | "status"
      | "output"
      | "errorCode"
      | "safeErrorMessage"
      | "completedAt"
      | "durationMs"
      | "createdAt"
      | "updatedAt"
    >,
  ): Promise<AgentRunRecord> {
    if (input.idempotencyKey) {
      const existing = await this.getRunByIdempotencyKey(
        input.workspaceId,
        input.agentId,
        input.idempotencyKey,
        input.requestedBy,
      );
      if (existing) return existing;
    }
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentRuns).values({
      ...input,
      id,
      status: "queued",
      attemptCount: input.attemptCount ?? 0,
      maxAttempts: input.maxAttempts ?? 3,
      priority: input.priority ?? 0,
      totalInputTokens: input.totalInputTokens ?? 0,
      totalOutputTokens: input.totalOutputTokens ?? 0,
      totalCostMicros: input.totalCostMicros ?? 0,
      output: null,
      errorCode: null,
      safeErrorMessage: null,
      completedAt: null,
      durationMs: null,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getRun(input.organizationId, id);
    if (!created) throw new Error("Agent run create failed.");
    return created;
  }

  async updateRun(
    organizationId: string,
    runId: string,
    updates: Partial<AgentRunRecord>,
  ): Promise<AgentRunRecord | null> {
    const dbUpdates: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };
    delete dbUpdates.id;
    delete dbUpdates.organizationId;
    delete dbUpdates.workspaceId;

    await this.context.db
      .update(aiAgentRuns)
      .set(dbUpdates)
      .where(
        and(
          eq(aiAgentRuns.organizationId, organizationId),
          eq(aiAgentRuns.id, runId),
        ),
      );
    return this.getRun(organizationId, runId);
  }

  async claimQueuedRun(
    workerId: string,
    leaseDurationSeconds = 300,
    organizationId?: string,
  ): Promise<{ run: AgentRunRecord; leaseToken: string; attemptNumber: number } | null> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationSeconds * 1000);
    const leaseToken = randomUUID();

    const candidateConditions = [
      or(
        eq(aiAgentRuns.status, "queued"),
        and(
          eq(aiAgentRuns.status, "running"),
          lt(aiAgentRuns.leaseExpiresAt, now),
        ),
      ),
    ];
    if (organizationId) {
      candidateConditions.push(eq(aiAgentRuns.organizationId, organizationId));
    }

    const candidates = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(and(...candidateConditions))
      .orderBy(desc(aiAgentRuns.priority), aiAgentRuns.createdAt)
      .limit(1);

    if (!candidates[0]) {
      return null;
    }

    const candidate = candidates[0];
    const nextAttemptNumber = (candidate.attemptCount ?? 0) + 1;

    // Fencing update: only succeed if candidate is still queued or has the same expired lease
    await this.context.db
      .update(aiAgentRuns)
      .set({
        status: "running",
        workerId,
        leaseToken,
        leaseExpiresAt,
        attemptCount: nextAttemptNumber,
        updatedAt: now,
      })
      .where(
        and(
          eq(aiAgentRuns.id, candidate.id),
          or(
            eq(aiAgentRuns.status, "queued"),
            and(
              eq(aiAgentRuns.status, "running"),
              eq(aiAgentRuns.leaseToken, candidate.leaseToken ?? ""),
            ),
          ),
        ),
      );

    const claimed = await this.getRun(candidate.organizationId, candidate.id);
    if (!claimed || claimed.leaseToken !== leaseToken) {
      return null;
    }

    return {
      run: claimed,
      leaseToken,
      attemptNumber: nextAttemptNumber,
    };
  }

  async extendLease(
    runId: string,
    leaseToken: string,
    additionalSeconds = 300,
  ): Promise<boolean> {
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + additionalSeconds * 1000);
    await this.context.db
      .update(aiAgentRuns)
      .set({
        leaseExpiresAt: newExpiresAt,
        updatedAt: now,
      })
      .where(
        and(
          eq(aiAgentRuns.id, runId),
          eq(aiAgentRuns.leaseToken, leaseToken),
          eq(aiAgentRuns.status, "running"),
        ),
      );
    return true;
  }

  // --- Attempts ---

  async createAttempt(
    input: Omit<AgentRunAttemptRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<AgentRunAttemptRecord> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentRunAttempts).values({
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    });
    const attempt = await this.getAttempt(input.runId, input.attemptNumber);
    if (!attempt) throw new Error("Run attempt create failed.");
    return attempt;
  }

  async getAttempt(runId: string, attemptNumber: number): Promise<AgentRunAttemptRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentRunAttempts)
      .where(
        and(
          eq(aiAgentRunAttempts.runId, runId),
          eq(aiAgentRunAttempts.attemptNumber, attemptNumber),
        ),
      )
      .limit(1);
    return rows[0] ? normalizeAttempt(rows[0]) : null;
  }

  async listAttempts(runId: string): Promise<AgentRunAttemptRecord[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentRunAttempts)
      .where(eq(aiAgentRunAttempts.runId, runId))
      .orderBy(aiAgentRunAttempts.attemptNumber);
    return rows.map(normalizeAttempt);
  }

  async updateAttempt(
    id: string,
    updates: Partial<AgentRunAttemptRecord>,
  ): Promise<void> {
    const dbUpdates: Record<string, unknown> = {
      ...updates,
      updatedAt: new Date(),
    };
    delete dbUpdates.id;
    delete dbUpdates.organizationId;
    delete dbUpdates.workspaceId;
    delete dbUpdates.runId;

    await this.context.db
      .update(aiAgentRunAttempts)
      .set(dbUpdates)
      .where(eq(aiAgentRunAttempts.id, id));
  }

  // --- Events ---

  async recordEvent(
    input: {
      organizationId: string;
      workspaceId: string;
      runId: string;
      attemptId?: string | null;
      eventType: AgentRunEventType;
      payload: JsonRecord;
    },
  ): Promise<AgentRunEventRecord> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentRunEvents).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      runId: input.runId,
      attemptId: input.attemptId ?? null,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: now,
    });
    return {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      runId: input.runId,
      attemptId: input.attemptId ?? null,
      eventType: input.eventType,
      payload: input.payload,
      createdAt: now,
    };
  }

  async listEvents(runId: string): Promise<AgentRunEventRecord[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentRunEvents)
      .where(eq(aiAgentRunEvents.runId, runId))
      .orderBy(aiAgentRunEvents.createdAt);
    return rows.map(normalizeEvent);
  }

  // --- Human Approval Requests & Decisions ---

  async createApprovalRequest(
    input: Omit<AgentApprovalRequestRecord, "id" | "status" | "createdAt" | "updatedAt">,
  ): Promise<AgentApprovalRequestRecord> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentApprovalRequests).values({
      ...input,
      id,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getApprovalRequest(input.organizationId, id);
    if (!created) throw new Error("Approval request create failed.");
    return created;
  }

  async getApprovalRequest(
    organizationId: string,
    requestId: string,
  ): Promise<AgentApprovalRequestRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentApprovalRequests)
      .where(
        and(
          eq(aiAgentApprovalRequests.organizationId, organizationId),
          eq(aiAgentApprovalRequests.id, requestId),
        ),
      )
      .limit(1);
    return rows[0] ? normalizeApprovalRequest(rows[0]) : null;
  }

  async listApprovalRequests(
    organizationId: string,
    status?: AgentApprovalStatus,
    pagination: PaginationInput = { limit: 50, offset: 0 },
  ): Promise<AgentApprovalRequestRecord[]> {
    const conditions = [eq(aiAgentApprovalRequests.organizationId, organizationId)];
    if (status) {
      conditions.push(eq(aiAgentApprovalRequests.status, status));
    }
    const rows = await this.context.db
      .select()
      .from(aiAgentApprovalRequests)
      .where(and(...conditions))
      .orderBy(desc(aiAgentApprovalRequests.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
    return rows.map(normalizeApprovalRequest);
  }

  async resolveApprovalRequest(
    organizationId: string,
    workspaceId: string,
    requestId: string,
    decision: "approved" | "rejected",
    decidedBy: string,
    reason?: string | null,
  ): Promise<{
    request: AgentApprovalRequestRecord;
    decision: AgentApprovalDecisionRecord;
  }> {
    const now = new Date();
    const decisionId = randomUUID();

    await this.context.db
      .update(aiAgentApprovalRequests)
      .set({
        status: decision,
        updatedAt: now,
      })
      .where(
        and(
          eq(aiAgentApprovalRequests.organizationId, organizationId),
          eq(aiAgentApprovalRequests.id, requestId),
          eq(aiAgentApprovalRequests.status, "pending"),
        ),
      );

    await this.context.db.insert(aiAgentApprovalDecisions).values({
      id: decisionId,
      organizationId,
      workspaceId,
      approvalRequestId: requestId,
      decision,
      reason: reason ?? null,
      decidedBy,
      decidedAt: now,
      createdAt: now,
    });

    const updatedRequest = await this.getApprovalRequest(organizationId, requestId);
    if (!updatedRequest) throw new Error("Approval request resolve failed.");

    return {
      request: updatedRequest,
      decision: {
        id: decisionId,
        organizationId,
        workspaceId,
        approvalRequestId: requestId,
        decision,
        reason: reason ?? null,
        decidedBy,
        decidedAt: now,
        createdAt: now,
      },
    };
  }

  async getDecisionForRequest(
    approvalRequestId: string,
  ): Promise<AgentApprovalDecisionRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentApprovalDecisions)
      .where(eq(aiAgentApprovalDecisions.approvalRequestId, approvalRequestId))
      .limit(1);
    return rows[0] ? normalizeApprovalDecision(rows[0]) : null;
  }

  // --- Runtime Usage ---

  async recordUsage(
    input: Omit<AgentRuntimeUsageRecord, "id" | "createdAt">,
  ): Promise<AgentRuntimeUsageRecord> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentRuntimeUsage).values({
      ...input,
      id,
      createdAt: now,
    });
    return {
      ...input,
      id,
      createdAt: now,
    };
  }

  async getUsageForRun(runId: string): Promise<AgentRuntimeUsageRecord[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentRuntimeUsage)
      .where(eq(aiAgentRuntimeUsage.runId, runId))
      .orderBy(aiAgentRuntimeUsage.createdAt);
    return rows.map(normalizeUsage);
  }

  async getMonitoringMetrics(organizationId: string): Promise<RuntimeMonitoringMetrics> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const runs = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(eq(aiAgentRuns.organizationId, organizationId));

    let queueDepth = 0;
    let activeRunningRuns = 0;
    let awaitingApprovalCount = 0;
    let completedLast24h = 0;
    let failedLast24h = 0;
    let totalLatencyMs = 0;
    let latencyCount = 0;
    let totalTokensLast24h = 0;
    let totalCostMicrosLast24h = 0;

    for (const r of runs) {
      if (r.status === "queued") queueDepth++;
      if (r.status === "running") activeRunningRuns++;
      if (r.status === "awaiting_approval") awaitingApprovalCount++;

      const createdAt = new Date(r.createdAt);
      if (createdAt >= dayAgo) {
        if (r.status === "completed") completedLast24h++;
        if (r.status === "failed") failedLast24h++;
        if (r.durationMs) {
          totalLatencyMs += Number(r.durationMs);
          latencyCount++;
        }
        totalTokensLast24h += (r.totalInputTokens ?? 0) + (r.totalOutputTokens ?? 0);
        totalCostMicrosLast24h += Number(r.totalCostMicros ?? 0);
      }
    }

    const totalFinished24h = completedLast24h + failedLast24h;
    const successRatePercentage =
      totalFinished24h > 0 ? Math.round((completedLast24h / totalFinished24h) * 100) : 100;
    const averageLatencyMs = latencyCount > 0 ? Math.round(totalLatencyMs / latencyCount) : 0;

    return {
      queueDepth,
      activeRunningRuns,
      awaitingApprovalCount,
      completedLast24h,
      failedLast24h,
      averageLatencyMs,
      totalTokensLast24h,
      totalCostMicrosLast24h,
      successRatePercentage,
    };
  }

  // --- Conversations & Messages ---

  async listConversations(
    organizationId: string,
    userId: string,
    pagination: PaginationInput,
    agentId?: string,
  ): Promise<AgentConversationRecord[]> {
    const condition = agentId
      ? and(
          eq(aiAgentConversations.organizationId, organizationId),
          eq(aiAgentConversations.userId, userId),
          eq(aiAgentConversations.agentId, agentId),
        )
      : and(
          eq(aiAgentConversations.organizationId, organizationId),
          eq(aiAgentConversations.userId, userId),
        );
    const rows = await this.context.db
      .select()
      .from(aiAgentConversations)
      .where(condition)
      .orderBy(desc(aiAgentConversations.updatedAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
    return rows.map(normalizeConversation);
  }

  async getConversation(
    organizationId: string,
    conversationId: string,
    userId: string,
  ): Promise<AgentConversationRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentConversations)
      .where(
        and(
          eq(aiAgentConversations.organizationId, organizationId),
          eq(aiAgentConversations.id, conversationId),
          eq(aiAgentConversations.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] ? normalizeConversation(rows[0]) : null;
  }

  async createConversation(
    input: Omit<
      AgentConversationRecord,
      "id" | "status" | "lastMessageAt" | "createdAt" | "updatedAt"
    >,
  ): Promise<AgentConversationRecord> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentConversations).values({
      ...input,
      id,
      status: "active",
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getConversation(input.organizationId, id, input.userId);
    if (!created) throw new Error("Conversation create failed.");
    return created;
  }

  async listMessages(
    organizationId: string,
    conversationId: string,
    userId: string,
    pagination: PaginationInput,
  ): Promise<AgentMessageRecord[]> {
    const conversation = await this.getConversation(organizationId, conversationId, userId);
    if (!conversation) return [];
    const rows = await this.context.db
      .select()
      .from(aiAgentMessages)
      .where(
        and(
          eq(aiAgentMessages.organizationId, organizationId),
          eq(aiAgentMessages.conversationId, conversationId),
        ),
      )
      .orderBy(aiAgentMessages.sequence)
      .limit(pagination.limit)
      .offset(pagination.offset);
    return rows.map(normalizeMessage);
  }

  async createMessage(
    input: Omit<AgentMessageRecord, "id" | "sequence" | "createdAt">,
  ): Promise<AgentMessageRecord> {
    const id = randomUUID();
    const now = new Date();
    const last = await this.context.db
      .select()
      .from(aiAgentMessages)
      .where(eq(aiAgentMessages.conversationId, input.conversationId))
      .orderBy(desc(aiAgentMessages.sequence))
      .limit(1);
    const sequence = (last[0]?.sequence ?? 0) + 1;
    await this.context.db
      .insert(aiAgentMessages)
      .values({ ...input, id, sequence, createdAt: now });
    await this.context.db
      .update(aiAgentConversations)
      .set({ lastMessageAt: now, updatedAt: now })
      .where(eq(aiAgentConversations.id, input.conversationId));
    const rows = await this.context.db
      .select()
      .from(aiAgentMessages)
      .where(eq(aiAgentMessages.id, id))
      .limit(1);
    if (!rows[0]) throw new Error("Message create failed.");
    return normalizeMessage(rows[0]);
  }

  private async getRunByIdempotencyKey(
    workspaceId: string,
    agentId: string,
    idempotencyKey: string,
    userId: string,
  ): Promise<AgentRunRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(
        and(
          eq(aiAgentRuns.workspaceId, workspaceId),
          eq(aiAgentRuns.agentId, agentId),
          eq(aiAgentRuns.idempotencyKey, idempotencyKey),
          eq(aiAgentRuns.requestedBy, userId),
        ),
      )
      .limit(1);
    return rows[0] ? normalizeRun(rows[0]) : null;
  }
}

function normalizeRun(row: any): AgentRunRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    agentId: row.agentId,
    conversationId: row.conversationId ?? null,
    requestedBy: row.requestedBy,
    status: row.status as AgentRunStatus,
    executionMode: row.executionMode,
    idempotencyKey: row.idempotencyKey ?? null,
    input: normalizeRecord(row.input),
    output: row.output ? normalizeRecord(row.output) : null,
    provider: row.provider ?? null,
    model: row.model ?? null,
    errorCode: row.errorCode ?? null,
    safeErrorMessage: row.safeErrorMessage ?? null,
    metadata: normalizeRecord(row.metadata),
    configurationRevisionId: row.configurationRevisionId ?? null,
    configurationSnapshot: row.configurationSnapshot
      ? normalizeRecord(row.configurationSnapshot)
      : null,
    attemptCount: Number(row.attemptCount ?? 0),
    maxAttempts: Number(row.maxAttempts ?? 3),
    leaseToken: row.leaseToken ?? null,
    leaseExpiresAt: row.leaseExpiresAt ? new Date(row.leaseExpiresAt) : null,
    workerId: row.workerId ?? null,
    priority: Number(row.priority ?? 0),
    totalInputTokens: Number(row.totalInputTokens ?? 0),
    totalOutputTokens: Number(row.totalOutputTokens ?? 0),
    totalCostMicros: Number(row.totalCostMicros ?? 0),
    cancelledBy: row.cancelledBy ?? null,
    cancelledAt: row.cancelledAt ? new Date(row.cancelledAt) : null,
    cancellationReason: row.cancellationReason ?? null,
    startedAt: new Date(row.startedAt),
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
    durationMs:
      row.durationMs !== null && row.durationMs !== undefined ? Number(row.durationMs) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function normalizeAttempt(row: any): AgentRunAttemptRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    runId: row.runId,
    attemptNumber: Number(row.attemptNumber),
    status: row.status,
    workerId: row.workerId,
    leaseToken: row.leaseToken,
    startedAt: new Date(row.startedAt),
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
    durationMs:
      row.durationMs !== null && row.durationMs !== undefined ? Number(row.durationMs) : null,
    errorCode: row.errorCode ?? null,
    errorMessage: row.errorMessage ?? null,
    errorDetails: row.errorDetails ? normalizeRecord(row.errorDetails) : null,
    inputTokens: Number(row.inputTokens ?? 0),
    outputTokens: Number(row.outputTokens ?? 0),
    metadata: normalizeRecord(row.metadata),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function normalizeEvent(row: any): AgentRunEventRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    runId: row.runId,
    attemptId: row.attemptId ?? null,
    eventType: row.eventType as AgentRunEventType,
    payload: normalizeRecord(row.payload),
    createdAt: new Date(row.createdAt),
  };
}

function normalizeApprovalRequest(row: any): AgentApprovalRequestRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    runId: row.runId,
    attemptId: row.attemptId ?? null,
    actionName: row.actionName,
    actionType: row.actionType,
    actionPayload: normalizeRecord(row.actionPayload),
    riskLevel: row.riskLevel,
    policy: row.policy,
    requiredRoles: Array.isArray(row.requiredRoles) ? row.requiredRoles : [],
    status: row.status as AgentApprovalStatus,
    requestedBy: row.requestedBy,
    expiresAt: row.expiresAt ? new Date(row.expiresAt) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function normalizeApprovalDecision(row: any): AgentApprovalDecisionRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    approvalRequestId: row.approvalRequestId,
    decision: row.decision,
    reason: row.reason ?? null,
    decidedBy: row.decidedBy,
    decidedAt: new Date(row.decidedAt),
    createdAt: new Date(row.createdAt),
  };
}

function normalizeUsage(row: any): AgentRuntimeUsageRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    runId: row.runId,
    agentId: row.agentId,
    provider: row.provider,
    model: row.model,
    inputTokens: Number(row.inputTokens ?? 0),
    outputTokens: Number(row.outputTokens ?? 0),
    totalTokens: Number(row.totalTokens ?? 0),
    durationMs: Number(row.durationMs ?? 0),
    costMicros: Number(row.costMicros ?? 0),
    createdAt: new Date(row.createdAt),
  };
}

function normalizeConversation(row: AgentConversationRecord): AgentConversationRecord {
  return row;
}

function normalizeMessage(row: AgentMessageRecord): AgentMessageRecord {
  return {
    ...row,
    metadata: row.metadata ? normalizeRecord(row.metadata) : null,
  };
}

function normalizeRecord(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      return normalizeRecord(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  return {};
}
