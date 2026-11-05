import { ApiError } from "../../../common/errors/api-error.js";
import type { AgentApprovalRepository } from "../repositories/agent-approval.repository.js";
import type { AgentGovernanceRepository } from "../repositories/agent-governance.repository.js";
import type { PolicyEvaluationEngine } from "./policy-evaluation-engine.service.js";
import type { AgentToolGatewayService } from "../tools/agent-tool-gateway.service.js";
import {
  type ContinueApprovalExecutionInput,
  type ApprovalContinuationResult,
  computePayloadFingerprint,
} from "../governance-approval.types.js";

export class AgentApprovalContinuationService {
  constructor(
    private readonly approvalRepo: AgentApprovalRepository,
    private readonly policyEngine?: PolicyEvaluationEngine,
    private readonly toolGateway?: AgentToolGatewayService,
    private readonly governanceRepo?: AgentGovernanceRepository,
  ) {}

  /**
   * Resumes an approved governed operation after validating identity,
   * exact payload fingerprint, expiration, and fresh policy re-evaluation.
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

    // 4. Exact payload fingerprint verification (anti-tampering)
    const effectivePayload = input.providedPayload ?? request.payload;
    const providedFingerprint = computePayloadFingerprint(effectivePayload);

    if (providedFingerprint !== request.canonicalPayloadFingerprint) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        "The provided execution parameters do not match the approved canonical payload fingerprint",
      );
    }

    // 5. Fresh policy re-evaluation (anti-stale-policy attack)
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

    // 6. Concurrency-safe atomic claim for single-use consumption
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

    // 7. Resume execution through appropriate runtime gateway
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
            bypassGovernanceApprovalCheck: true,
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
        };
      }
    } catch (err: any) {
      // Record failure
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

    // 8. Record audit log for successful consumption
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
