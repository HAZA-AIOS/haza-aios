import { and, desc, eq, inArray, lte } from "drizzle-orm";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import {
  agentApprovalRequests,
  agentApprovalDecisions,
  agentApprovalEscalations,
} from "../../../database/schema.js";
import type {
  AgentApprovalRequestEntity,
  AgentApprovalDecisionEntity,
  AgentApprovalEscalationEntity,
  ApprovalRequestStatus,
  ApprovalListFilters,
} from "../governance-approval.types.js";

export class AgentApprovalRepository {
  constructor(private readonly context: RepositoryContext) {}

  // ---------------------------------------------------------------------------
  // APPROVAL REQUESTS
  // ---------------------------------------------------------------------------

  async createRequest(
    data: AgentApprovalRequestEntity,
  ): Promise<AgentApprovalRequestEntity> {
    await this.context.db.insert(agentApprovalRequests).values({
      id: data.id,
      organizationId: data.organizationId,
      workspaceId: data.workspaceId ?? null,
      agentId: data.agentId,
      executionId: data.executionId ?? null,
      correlationId: data.correlationId ?? null,
      traceId: data.traceId ?? null,
      spanId: data.spanId ?? null,
      actionType: data.actionType,
      actionTarget: data.actionTarget,
      resourceId: data.resourceId ?? null,
      requestingActorId: data.requestingActorId,
      requestingActorType: data.requestingActorType,
      canonicalPayloadFingerprint: data.canonicalPayloadFingerprint,
      payload: data.payload,
      matchedPolicyId: data.matchedPolicyId ?? null,
      matchedPolicyVersion: data.matchedPolicyVersion ?? null,
      approvalReason: data.approvalReason,
      riskClassification: data.riskClassification,
      securityClassification: data.securityClassification,
      assignedReviewerId: data.assignedReviewerId ?? null,
      assignedRole: data.assignedRole ?? null,
      status: data.status,
      decisionId: data.decisionId ?? null,
      consumedAt: data.consumedAt ? new Date(data.consumedAt) : null,
      consumedBy: data.consumedBy ?? null,
      idempotencyKey: data.idempotencyKey,
      expiresAt: new Date(data.expiresAt),
      metadata: data.metadata,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });

    return data;
  }

  async getRequestById(
    organizationId: string,
    id: string,
  ): Promise<AgentApprovalRequestEntity | null> {
    const rows = await this.context.db
      .select()
      .from(agentApprovalRequests)
      .where(
        and(
          eq(agentApprovalRequests.organizationId, organizationId),
          eq(agentApprovalRequests.id, id),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapRequestRow(rows[0]);
  }

  async getRequestByIdempotencyKey(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<AgentApprovalRequestEntity | null> {
    const rows = await this.context.db
      .select()
      .from(agentApprovalRequests)
      .where(
        and(
          eq(agentApprovalRequests.organizationId, organizationId),
          eq(agentApprovalRequests.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapRequestRow(rows[0]);
  }

  async listRequests(
    organizationId: string,
    filters?: ApprovalListFilters,
  ): Promise<AgentApprovalRequestEntity[]> {
    const conditions = [eq(agentApprovalRequests.organizationId, organizationId)];

    if (filters?.status) {
      conditions.push(eq(agentApprovalRequests.status, filters.status));
    }
    if (filters?.agentId) {
      conditions.push(eq(agentApprovalRequests.agentId, filters.agentId));
    }
    if (filters?.riskClassification) {
      conditions.push(eq(agentApprovalRequests.riskClassification, filters.riskClassification));
    }
    if (filters?.assignedReviewerId) {
      conditions.push(eq(agentApprovalRequests.assignedReviewerId, filters.assignedReviewerId));
    }

    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const offset = Math.max(filters?.offset ?? 0, 0);

    const rows = await this.context.db
      .select()
      .from(agentApprovalRequests)
      .where(and(...conditions))
      .orderBy(desc(agentApprovalRequests.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((r) => this.mapRequestRow(r));
  }

  /**
   * Concurrency-safe atomic compare-and-set update.
   * Only transitions if current status matches expectedStatus.
   */
  async updateRequestStatus(params: {
    organizationId: string;
    id: string;
    expectedStatus: ApprovalRequestStatus | ApprovalRequestStatus[];
    newStatus: ApprovalRequestStatus;
    decisionId?: string | null;
    consumedAt?: string | null;
    consumedBy?: string | null;
    assignedReviewerId?: string | null;
  }): Promise<AgentApprovalRequestEntity | null> {
    const expected = Array.isArray(params.expectedStatus)
      ? params.expectedStatus
      : [params.expectedStatus];

    const updatePayload: Record<string, unknown> = {
      status: params.newStatus,
      updatedAt: new Date(),
    };

    if (params.decisionId !== undefined) {
      updatePayload.decisionId = params.decisionId;
    }
    if (params.consumedAt !== undefined) {
      updatePayload.consumedAt = params.consumedAt ? new Date(params.consumedAt) : null;
    }
    if (params.consumedBy !== undefined) {
      updatePayload.consumedBy = params.consumedBy;
    }
    if (params.assignedReviewerId !== undefined) {
      updatePayload.assignedReviewerId = params.assignedReviewerId;
    }

    await this.context.db
      .update(agentApprovalRequests)
      .set(updatePayload)
      .where(
        and(
          eq(agentApprovalRequests.organizationId, params.organizationId),
          eq(agentApprovalRequests.id, params.id),
          inArray(agentApprovalRequests.status, expected),
        ),
      );

    return await this.getRequestById(params.organizationId, params.id);
  }

  // ---------------------------------------------------------------------------
  // DECISIONS
  // ---------------------------------------------------------------------------

  async createDecision(
    data: AgentApprovalDecisionEntity,
  ): Promise<AgentApprovalDecisionEntity> {
    await this.context.db.insert(agentApprovalDecisions).values({
      id: data.id,
      approvalRequestId: data.approvalRequestId,
      organizationId: data.organizationId,
      decision: data.decision,
      decidedByActorId: data.decidedByActorId,
      decidedByActorType: data.decidedByActorType,
      reason: data.reason ?? null,
      justification: data.justification ?? null,
      policySnapshot: data.policySnapshot,
      metadata: data.metadata,
      createdAt: new Date(data.createdAt),
    });

    return data;
  }

  async listDecisionsForRequest(
    organizationId: string,
    approvalRequestId: string,
  ): Promise<AgentApprovalDecisionEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentApprovalDecisions)
      .where(
        and(
          eq(agentApprovalDecisions.organizationId, organizationId),
          eq(agentApprovalDecisions.approvalRequestId, approvalRequestId),
        ),
      )
      .orderBy(desc(agentApprovalDecisions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      approvalRequestId: r.approvalRequestId,
      organizationId: r.organizationId,
      decision: r.decision as AgentApprovalDecisionEntity["decision"],
      decidedByActorId: r.decidedByActorId,
      decidedByActorType: r.decidedByActorType,
      reason: r.reason,
      justification: r.justification,
      policySnapshot: (r.policySnapshot as Record<string, unknown>) ?? {},
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  }

  // ---------------------------------------------------------------------------
  // ESCALATIONS
  // ---------------------------------------------------------------------------

  async createEscalation(
    data: AgentApprovalEscalationEntity,
  ): Promise<AgentApprovalEscalationEntity> {
    await this.context.db.insert(agentApprovalEscalations).values({
      id: data.id,
      approvalRequestId: data.approvalRequestId,
      organizationId: data.organizationId,
      escalatedByActorId: data.escalatedByActorId,
      previousReviewerId: data.previousReviewerId ?? null,
      escalatedToReviewerId: data.escalatedToReviewerId ?? null,
      escalationContact: data.escalationContact ?? null,
      reason: data.reason,
      status: data.status,
      metadata: data.metadata,
      createdAt: new Date(data.createdAt),
    });

    return data;
  }

  async listEscalationsForRequest(
    organizationId: string,
    approvalRequestId: string,
  ): Promise<AgentApprovalEscalationEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentApprovalEscalations)
      .where(
        and(
          eq(agentApprovalEscalations.organizationId, organizationId),
          eq(agentApprovalEscalations.approvalRequestId, approvalRequestId),
        ),
      )
      .orderBy(desc(agentApprovalEscalations.createdAt));

    return rows.map((r) => ({
      id: r.id,
      approvalRequestId: r.approvalRequestId,
      organizationId: r.organizationId,
      escalatedByActorId: r.escalatedByActorId,
      previousReviewerId: r.previousReviewerId,
      escalatedToReviewerId: r.escalatedToReviewerId,
      escalationContact: r.escalationContact,
      reason: r.reason,
      status: r.status as AgentApprovalEscalationEntity["status"],
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));
  }

  // ---------------------------------------------------------------------------
  // EXPIRY PROCESSING
  // ---------------------------------------------------------------------------

  async expirePendingRequests(
    organizationId: string,
    nowDate: Date = new Date(),
  ): Promise<AgentApprovalRequestEntity[]> {
    const pendingRows = await this.context.db
      .select()
      .from(agentApprovalRequests)
      .where(
        and(
          eq(agentApprovalRequests.organizationId, organizationId),
          eq(agentApprovalRequests.status, "pending"),
          lte(agentApprovalRequests.expiresAt, nowDate),
        ),
      );

    const expiredList: AgentApprovalRequestEntity[] = [];
    for (const row of pendingRows) {
      await this.updateRequestStatus({
        organizationId,
        id: row.id,
        expectedStatus: "pending",
        newStatus: "expired",
      });
      const updated = await this.getRequestById(organizationId, row.id);
      if (updated) expiredList.push(updated);
    }

    return expiredList;
  }

  // ---------------------------------------------------------------------------
  // MAPPING
  // ---------------------------------------------------------------------------

  private mapRequestRow(r: typeof agentApprovalRequests.$inferSelect): AgentApprovalRequestEntity {
    return {
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      agentId: r.agentId,
      executionId: r.executionId,
      correlationId: r.correlationId,
      traceId: r.traceId,
      spanId: r.spanId,
      actionType: r.actionType,
      actionTarget: r.actionTarget,
      resourceId: r.resourceId,
      requestingActorId: r.requestingActorId,
      requestingActorType: r.requestingActorType,
      canonicalPayloadFingerprint: r.canonicalPayloadFingerprint,
      payload: (r.payload as Record<string, unknown>) ?? {},
      matchedPolicyId: r.matchedPolicyId,
      matchedPolicyVersion: r.matchedPolicyVersion,
      approvalReason: r.approvalReason,
      riskClassification: r.riskClassification as AgentApprovalRequestEntity["riskClassification"],
      securityClassification: r.securityClassification as AgentApprovalRequestEntity["securityClassification"],
      assignedReviewerId: r.assignedReviewerId,
      assignedRole: r.assignedRole,
      status: r.status as ApprovalRequestStatus,
      decisionId: r.decisionId,
      consumedAt: r.consumedAt ? (r.consumedAt instanceof Date ? r.consumedAt.toISOString() : String(r.consumedAt)) : null,
      consumedBy: r.consumedBy,
      idempotencyKey: r.idempotencyKey,
      expiresAt: r.expiresAt instanceof Date ? r.expiresAt.toISOString() : String(r.expiresAt),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    };
  }
}
