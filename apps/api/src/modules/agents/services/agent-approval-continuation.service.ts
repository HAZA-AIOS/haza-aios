import { ApiError } from "../../../common/errors/api-error.js";
import type { AgentApprovalRepository } from "../repositories/agent-approval.repository.js";
import type { AgentGovernanceRepository } from "../repositories/agent-governance.repository.js";
import type { AgentSecurityRepository } from "../repositories/agent-security.repository.js";
import type { AgentSecurityGatewayService } from "./agent-security-gateway.service.js";
import type { PolicyEvaluationEngine } from "./policy-evaluation-engine.service.js";
import type { AgentToolGatewayService } from "../tools/agent-tool-gateway.service.js";
import {
  type ContinueApprovalExecutionInput,
  type ApprovalContinuationResult,
  computePayloadFingerprint,
} from "../governance-approval.types.js";
import { generateContinuationProof } from "../governance-security.types.js";

export class AgentApprovalContinuationService {
  constructor(
    private readonly approvalRepo: AgentApprovalRepository,
    private readonly policyEngine?: PolicyEvaluationEngine,
    private readonly toolGateway?: AgentToolGatewayService,
    private readonly governanceRepo?: AgentGovernanceRepository,
    private readonly securityRepo?: AgentSecurityRepository,
    private readonly securityGateway?: AgentSecurityGatewayService,
  ) {}

  /**
   * Resumes an approved governed operation after validating identity,
   * exact payload fingerprint, expiration, suspension state, emergency controls,
   * durable execution records, and fresh policy re-evaluation.
   */
  async continueApprovedExecution(
    input: ContinueApprovalExecutionInput,
  ): Promise<ApprovalContinuationResult> {
    const request = await this.approvalRepo.getRequestById(
      input.organizationId,
      input.approvalRequestId,
    );

    if (!request) {
      throw new ApiError(404, "NOT_FOUND", "Approval request not found");
    }

    // 1. Tenant boundary validation
    if (request.organizationId !== input.organizationId) {
      throw new ApiError(403, "FORBIDDEN", "Cross-tenant approval continuation is forbidden");
    }

    // 2. Lifecycle status validation
    if (request.status === "consumed") {
      throw new ApiError(
        409,
        "BAD_REQUEST",
        "Approval request has already been consumed and cannot be re-executed",
      );
    }

    if (request.status === "pending") {
      throw new ApiError(
        409,
        "BAD_REQUEST",
        "Approval request is still pending and has not been approved",
      );
    }

    if (request.status === "rejected") {
      throw new ApiError(403, "FORBIDDEN", "Approval request was rejected");
    }

    if (request.status === "revoked") {
      throw new ApiError(403, "FORBIDDEN", "Approval request was revoked");
    }

    if (request.status === "expired") {
      throw new ApiError(400, "BAD_REQUEST", "Approval request has expired");
    }

    if (request.status !== "approved") {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Approval request is in status '${request.status}' and cannot be continued`,
      );
    }

    // 3. Expiration verification
    if (new Date(request.expiresAt).getTime() <= Date.now()) {
      await this.approvalRepo.updateRequestStatus({
        organizationId: input.organizationId,
        id: request.id,
        expectedStatus: "approved",
        newStatus: "expired",
      });
      throw new ApiError(400, "BAD_REQUEST", "Approval request has expired");
    }

    // 4. Emergency stop and Agent suspension checks (Epic 22D)
    if (this.securityGateway) {
      if (this.securityGateway.isEmergencyStopped(input.organizationId, request.workspaceId)) {
        throw new ApiError(
          503,
          "FORBIDDEN",
          "Execution cannot resume: Organization or Workspace is currently under Emergency Stop",
        );
      }
      const isSuspended = await this.securityGateway.isAgentSuspended(input.organizationId, request.agentId);
      if (isSuspended) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `Agent '${request.agentId}' is suspended and cannot resume execution`,
        );
      }
    }

    // 5. Exact payload fingerprint verification (anti-tampering)
    const effectivePayload = input.providedPayload ?? request.payload;
    const providedFingerprint = computePayloadFingerprint(effectivePayload);

    if (providedFingerprint !== request.canonicalPayloadFingerprint) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "The provided execution parameters do not match the approved canonical payload fingerprint",
      );
    }

    // 6. Fresh policy re-evaluation (anti-stale-policy attack)
    if (this.policyEngine) {
      const freshEvaluation = await this.policyEngine.evaluate({
        organizationId: input.organizationId,
        workspaceId: request.workspaceId ?? null,
        actorId: input.actorId,
        agentId: request.agentId,
        toolKey: request.actionType === "tool_execution" ? request.actionTarget : null,
        action: request.actionType,
        parameters: effectivePayload,
      });

      // If mandatory restrictions now fail or active policy now explicitly blocks
      if (
        freshEvaluation.mandatoryRestrictionViolated ||
        freshEvaluation.decision === "DENY"
      ) {
        throw new ApiError(
          403,
          "FORBIDDEN",
          `Policy rules have changed since approval: ${freshEvaluation.reasonDetails}`,
        );
      }
    }

    // 7. Concurrency-safe atomic claim for single-use consumption
    const consumedAt = new Date().toISOString();
    const updated = await this.approvalRepo.updateRequestStatus({
      organizationId: input.organizationId,
      id: request.id,
      expectedStatus: "approved",
      newStatus: "consumed",
      consumedAt,
      consumedBy: input.actorId,
    });

    if (!updated || updated.status !== "consumed") {
      throw new ApiError(
        409,
        "BAD_REQUEST",
        "Approval request was concurrently claimed or consumed by another process",
      );
    }

    // 8. Durable execution reconciliation record (Epic 22D)
    let continuationRecord: any = null;
    if (this.securityRepo) {
      try {
        continuationRecord = await this.securityRepo.createContinuationRecord({
          approvalRequestId: request.id,
          organizationId: input.organizationId,
          canonicalPayloadFingerprint: request.canonicalPayloadFingerprint,
          executionId: request.executionId || request.id,
          actorId: input.actorId,
          metadata: { actionType: request.actionType, actionTarget: request.actionTarget },
        });
      } catch {
        // Safe continuation if already recorded
      }
    }

    // 9. Generate cryptographically signed continuation proof (Epic 22D)
    const continuationProof = generateContinuationProof({
      approvalRequestId: request.id,
      organizationId: input.organizationId,
      agentId: request.agentId,
      actionTarget: request.actionTarget,
      payloadFingerprint: request.canonicalPayloadFingerprint,
      ttlSeconds: 120,
    });

    // 10. Resume execution through appropriate runtime gateway
    let executionResult: unknown = null;
    try {
      if (request.actionType === "tool_execution" && this.toolGateway) {
        const toolRes = await this.toolGateway.executeTool(
          {
            runId: request.executionId || request.id,
            toolKey: request.actionTarget,
            input: effectivePayload,
          },
          {
            organizationId: input.organizationId,
            workspaceId: request.workspaceId || "ws-default",
            agentId: request.agentId,
            userId: input.actorId,
            continuationProof,
          } as any,
        );
        executionResult = toolRes;
      } else {
        // Agent runtime or generic continuation
        executionResult = {
          resumed: true,
          actionType: request.actionType,
          actionTarget: request.actionTarget,
          consumedAt,
          continuationProofNonce: continuationProof.nonce,
        };
      }

      // Mark durable execution record COMPLETED
      if (this.securityRepo && continuationRecord) {
        try {
          await this.securityRepo.updateContinuationRecord(continuationRecord.id, {
            status: "completed",
            reconciliationStatus: "completed",
            completedAt: new Date(),
          });
        } catch {
          // Non-blocking
        }
      }
    } catch (err: any) {
      // Mark durable execution record FAILED with error details
      if (this.securityRepo && continuationRecord) {
        try {
          await this.securityRepo.updateContinuationRecord(continuationRecord.id, {
            status: "failed",
            reconciliationStatus: "execution_failed",
            errorDetails: err?.message || String(err),
          });
        } catch {
          // Non-blocking
        }
      }

      // Record failure audit log
      if (this.governanceRepo) {
        try {
          await this.governanceRepo.createAuditLog({
            organizationId: input.organizationId,
            workspaceId: request.workspaceId ?? undefined,
            actorId: input.actorId,
            action: "approval_request.execution_failed",
            targetType: "approval_request",
            targetId: request.id,
            metadata: {
              error: err?.message || String(err),
            },
          });
        } catch {
          // ignore
        }
      }
      throw err;
    }

    // 11. Record audit log for successful consumption
    if (this.governanceRepo) {
      try {
        await this.governanceRepo.createAuditLog({
          organizationId: input.organizationId,
          workspaceId: request.workspaceId ?? undefined,
          actorId: input.actorId,
          action: "approval_request.consumed",
          targetType: "approval_request",
          targetId: request.id,
          beforeState: { status: "approved" },
          afterState: { status: "consumed", consumedBy: input.actorId, consumedAt },
          metadata: {
            actionType: request.actionType,
            actionTarget: request.actionTarget,
            continuationProofNonce: continuationProof.nonce,
          },
        });
      } catch {
        // Non-blocking
      }
    }

    return {
      success: true,
      approvalRequestId: request.id,
      status: "consumed",
      actionType: request.actionType,
      actionTarget: request.actionTarget,
      executionResult,
    };
  }
}
