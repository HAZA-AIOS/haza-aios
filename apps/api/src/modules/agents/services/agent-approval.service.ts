import { randomUUID } from "node:crypto";
import { ApiError } from "../../../common/errors/api-error.js";
import type { AgentApprovalRepository } from "../repositories/agent-approval.repository.js";
import type { AgentGovernanceRepository } from "../repositories/agent-governance.repository.js";
import {
  type AgentApprovalRequestEntity,
  type AgentApprovalDecisionEntity,
  type AgentApprovalEscalationEntity,
  type CreateApprovalRequestInput,
  type DecideApprovalRequestInput,
  type EscalateApprovalRequestInput,
  type ApprovalListFilters,
  type ApprovalDetailsResult,
  computePayloadFingerprint,
} from "../governance-approval.types.js";

export class AgentApprovalService {
  constructor(
    private readonly approvalRepo: AgentApprovalRepository,
    private readonly governanceRepo?: AgentGovernanceRepository,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. CREATE APPROVAL REQUEST
  // ---------------------------------------------------------------------------

  async createApprovalRequest(
    input: CreateApprovalRequestInput,
  ): Promise<AgentApprovalRequestEntity> {
    const fingerprint = computePayloadFingerprint(input.payload);
    const idempotencyKey =
      input.idempotencyKey ||
      `appr-${input.organizationId}-${input.agentId}-${input.actionTarget}-${fingerprint.slice(0, 16)}-${Date.now()}-${randomUUID().slice(0, 8)}`;

    // Check for existing request with same idempotency key
    const existing = await this.approvalRepo.getRequestByIdempotencyKey(
      input.organizationId,
      idempotencyKey,
    );
    if (existing) {
      return existing;
    }

    const now = new Date();
    const expiresInMs = (input.expiresInMinutes ?? 60) * 60 * 1000;
    const expiresAt = new Date(now.getTime() + expiresInMs);

    const id = randomUUID();
    const entity: AgentApprovalRequestEntity = {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId ?? null,
      agentId: input.agentId,
      executionId: input.executionId ?? null,
      correlationId: input.correlationId ?? null,
      traceId: input.traceId ?? null,
      spanId: input.spanId ?? null,
      actionType: input.actionType,
      actionTarget: input.actionTarget,
      resourceId: input.resourceId ?? null,
      requestingActorId: input.requestingActorId,
      requestingActorType: input.requestingActorType ?? "user",
      canonicalPayloadFingerprint: fingerprint,
      payload: input.payload,
      matchedPolicyId: input.matchedPolicyId ?? null,
      matchedPolicyVersion: input.matchedPolicyVersion ?? null,
      approvalReason: input.approvalReason,
      riskClassification: input.riskClassification ?? "medium",
      securityClassification: input.securityClassification ?? "internal",
      assignedReviewerId: input.assignedReviewerId ?? null,
      assignedRole: input.assignedRole ?? null,
      status: "pending",
      decisionId: null,
      consumedAt: null,
      consumedBy: null,
      idempotencyKey,
      expiresAt: expiresAt.toISOString(),
      metadata: input.metadata ?? {},
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const created = await this.approvalRepo.createRequest(entity);

    // Audit log
    if (this.governanceRepo) {
      try {
        await this.governanceRepo.createAuditLog({
          organizationId: input.organizationId,
          workspaceId: input.workspaceId ?? undefined,
          actorId: input.requestingActorId,
          action: "approval_request.created",
          targetType: "approval_request",
          targetId: id,
          afterState: {
            id,
            agentId: input.agentId,
            actionType: input.actionType,
            actionTarget: input.actionTarget,
            riskClassification: entity.riskClassification,
            expiresAt: entity.expiresAt,
          },
          metadata: {
            reason: input.approvalReason,
            matchedPolicyId: input.matchedPolicyId,
          },
        });
      } catch {
        // Non-blocking audit error
      }
    }

    return created;
  }

  // ---------------------------------------------------------------------------
  // 2. DECIDE APPROVAL REQUEST (APPROVE, REJECT, REVOKE)
  // ---------------------------------------------------------------------------

  async decideApprovalRequest(
    input: DecideApprovalRequestInput,
  ): Promise<{ request: AgentApprovalRequestEntity; decision: AgentApprovalDecisionEntity }> {
    const request = await this.approvalRepo.getRequestById(
      input.organizationId,
      input.approvalRequestId,
    );

    if (!request) {
      throw new ApiError(404, "NOT_FOUND", "Approval request not found");
    }

    // Tenant check
    if (request.organizationId !== input.organizationId) {
      throw new ApiError(403, "FORBIDDEN", "Cross-tenant approval is forbidden");
    }

    // State check
    if (request.status !== "pending") {
      throw new ApiError(
        409,
        "BAD_REQUEST",
        `Approval request is already in '${request.status}' status and cannot be decided`,
      );
    }

    // Expiry check
    if (new Date(request.expiresAt).getTime() <= Date.now()) {
      await this.approvalRepo.updateRequestStatus({
        organizationId: input.organizationId,
        id: request.id,
        expectedStatus: "pending",
        newStatus: "expired",
      });
      throw new ApiError(400, "BAD_REQUEST", "Approval request has expired");
    }

    // Reviewer Authorization checks (Step 4):
    // 1. No agent self-approval
    if (input.actorId === request.agentId) {
      throw new ApiError(403, "FORBIDDEN", "Agents cannot self-approve requests");
    }

    // 2. Revoke action rules vs Approve/Reject rules
    if (input.decision === "revoked") {
      const isRequester = input.actorId === request.requestingActorId;
      const isAdmin = input.userPermissions?.includes("agent.manage");
      if (!isRequester && !isAdmin) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "Only the original requester or an administrator can revoke an approval request",
        );
      }
    } else {
      // Approve / Reject decisions:
      // 3. No requester self-approval for sensitive actions (high/critical risk)
      const isRequester = input.actorId === request.requestingActorId;
      if (isRequester) {
        const isHighRisk =
          request.riskClassification === "high" || request.riskClassification === "critical";
        if (isHighRisk) {
          throw new ApiError(
            403,
            "FORBIDDEN",
            `Requester self-approval is forbidden for ${request.riskClassification}-risk operations`,
          );
        }
      }

      // 4. Check reviewer permissions / role assignment
      const hasManagePerm = input.userPermissions?.includes("agent.manage");
      const isExplicitReviewer = request.assignedReviewerId === input.actorId;

      let isOwnerOrDelegated = false;
      if (this.governanceRepo) {
        try {
          const ownership = await this.governanceRepo.getOwnershipByAgentId(
            input.organizationId,
            request.agentId,
          );
          if (ownership) {
            if (
              ownership.primaryOwnerId === input.actorId ||
              ownership.technicalOwnerId === input.actorId ||
              ownership.businessOwnerId === input.actorId ||
              ownership.delegatedApproverIds.includes(input.actorId)
            ) {
              // Ensure owner assignment cannot bypass required RBAC privileges on high/critical actions
              const isHighOrCritical = request.riskClassification === "high" || request.riskClassification === "critical";
              if (isHighOrCritical && !hasManagePerm && !input.userPermissions?.includes("agent.approve")) {
                isOwnerOrDelegated = false;
              } else {
                isOwnerOrDelegated = true;
              }
            }
          }
        } catch {
          // ignore lookup error
        }
      }

      if (!hasManagePerm && !isExplicitReviewer && !isOwnerOrDelegated) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          "You are not authorized to decide this approval request. Requires agent.manage, assigned reviewer, or agent ownership",
        );
      }
    }

    // Justification check for high/critical decisions
    if (
      (input.decision === "approved" || input.decision === "rejected") &&
      (request.riskClassification === "high" || request.riskClassification === "critical") &&
      !input.justification
    ) {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        `Justification is mandatory when deciding ${request.riskClassification}-risk requests`,
      );
    }

    // Concurrency-safe atomic compare-and-set transition:
    const decisionId = randomUUID();
    const updated = await this.approvalRepo.updateRequestStatus({
      organizationId: input.organizationId,
      id: request.id,
      expectedStatus: "pending",
      newStatus: input.decision,
      decisionId,
    });

    if (!updated || updated.status !== input.decision) {
      throw new ApiError(
        409,
        "BAD_REQUEST",
        "Approval request was concurrently modified or decided by another reviewer",
      );
    }

    // Create immutable historical decision record
    const decisionEntity: AgentApprovalDecisionEntity = {
      id: decisionId,
      approvalRequestId: request.id,
      organizationId: input.organizationId,
      decision: input.decision,
      decidedByActorId: input.actorId,
      decidedByActorType: input.actorType ?? "user",
      reason: input.reason ?? null,
      justification: input.justification ?? null,
      policySnapshot: {
        matchedPolicyId: request.matchedPolicyId,
        matchedPolicyVersion: request.matchedPolicyVersion,
        riskClassification: request.riskClassification,
        securityClassification: request.securityClassification,
      },
      metadata: {},
      createdAt: new Date().toISOString(),
    };

    await this.approvalRepo.createDecision(decisionEntity);

    // Audit log
    if (this.governanceRepo) {
      try {
        await this.governanceRepo.createAuditLog({
          organizationId: input.organizationId,
          workspaceId: request.workspaceId ?? undefined,
          actorId: input.actorId,
          action: `approval_request.${input.decision}`,
          targetType: "approval_request",
          targetId: request.id,
          beforeState: { status: "pending" },
          afterState: { status: input.decision, decisionId },
          metadata: {
            justification: input.justification,
            reason: input.reason,
          },
        });
      } catch {
        // Non-blocking
      }
    }

    return { request: updated, decision: decisionEntity };
  }

  // ---------------------------------------------------------------------------
  // 3. ESCALATE APPROVAL REQUEST
  // ---------------------------------------------------------------------------

  async escalateApprovalRequest(
    input: EscalateApprovalRequestInput,
  ): Promise<{ request: AgentApprovalRequestEntity; escalation: AgentApprovalEscalationEntity }> {
    const request = await this.approvalRepo.getRequestById(
      input.organizationId,
      input.approvalRequestId,
    );

    if (!request) {
      throw new ApiError(404, "NOT_FOUND", "Approval request not found");
    }

    if (request.status !== "pending") {
      throw new ApiError(
        409,
        "BAD_REQUEST",
        `Only pending requests can be escalated (current: ${request.status})`,
      );
    }

    if (new Date(request.expiresAt).getTime() <= Date.now()) {
      await this.approvalRepo.updateRequestStatus({
        organizationId: input.organizationId,
        id: request.id,
        expectedStatus: "pending",
        newStatus: "expired",
      });
      throw new ApiError(400, "BAD_REQUEST", "Approval request has expired");
    }

    let escalationContact: string | null = null;
    if (this.governanceRepo) {
      try {
        const ownership = await this.governanceRepo.getOwnershipByAgentId(
          input.organizationId,
          request.agentId,
        );
        if (ownership) {
          escalationContact = ownership.escalationContact;
        }
      } catch {
        // ignore
      }
    }

    const escalationId = randomUUID();
    const escalationEntity: AgentApprovalEscalationEntity = {
      id: escalationId,
      approvalRequestId: request.id,
      organizationId: input.organizationId,
      escalatedByActorId: input.actorId,
      previousReviewerId: request.assignedReviewerId ?? null,
      escalatedToReviewerId: input.escalatedToReviewerId ?? null,
      escalationContact,
      reason: input.reason,
      status: "escalated",
      metadata: {},
      createdAt: new Date().toISOString(),
    };

    await this.approvalRepo.createEscalation(escalationEntity);

    // Update assigned reviewer if a new reviewer was targeted
    let updatedRequest = request;
    if (input.escalatedToReviewerId) {
      const res = await this.approvalRepo.updateRequestStatus({
        organizationId: input.organizationId,
        id: request.id,
        expectedStatus: "pending",
        newStatus: "pending",
        assignedReviewerId: input.escalatedToReviewerId,
      });
      if (res) updatedRequest = res;
    }

    // Audit log
    if (this.governanceRepo) {
      try {
        await this.governanceRepo.createAuditLog({
          organizationId: input.organizationId,
          workspaceId: request.workspaceId ?? undefined,
          actorId: input.actorId,
          action: "approval_request.escalated",
          targetType: "approval_request",
          targetId: request.id,
          metadata: {
            reason: input.reason,
            escalatedToReviewerId: input.escalatedToReviewerId,
            escalationContact,
          },
        });
      } catch {
        // Non-blocking
      }
    }

    return { request: updatedRequest, escalation: escalationEntity };
  }

  // ---------------------------------------------------------------------------
  // 4. GET APPROVAL DETAILS
  // ---------------------------------------------------------------------------

  async getApprovalDetails(
    organizationId: string,
    approvalRequestId: string,
  ): Promise<ApprovalDetailsResult> {
    const request = await this.approvalRepo.getRequestById(organizationId, approvalRequestId);
    if (!request) {
      throw new ApiError(404, "NOT_FOUND", "Approval request not found");
    }

    const [decisions, escalations] = await Promise.all([
      this.approvalRepo.listDecisionsForRequest(organizationId, approvalRequestId),
      this.approvalRepo.listEscalationsForRequest(organizationId, approvalRequestId),
    ]);

    return { request, decisions, escalations };
  }

  // ---------------------------------------------------------------------------
  // 5. LIST APPROVALS
  // ---------------------------------------------------------------------------

  async listApprovals(
    organizationId: string,
    filters?: ApprovalListFilters,
  ): Promise<AgentApprovalRequestEntity[]> {
    return await this.approvalRepo.listRequests(organizationId, filters);
  }

  // ---------------------------------------------------------------------------
  // 6. SWEEP EXPIRED APPROVALS
  // ---------------------------------------------------------------------------

  async sweepExpiredApprovals(organizationId: string): Promise<AgentApprovalRequestEntity[]> {
    return await this.approvalRepo.expirePendingRequests(organizationId);
  }
}
