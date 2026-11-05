import { createHash } from "node:crypto";
import type { RiskTier, SecurityClassification } from "./governance.types.js";

export type ApprovalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "revoked"
  | "consumed";

export type ApprovalDecisionType = "approved" | "rejected" | "revoked";

export type ApprovalEscalationStatus = "escalated" | "resolved";

export interface AgentApprovalRequestEntity {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  agentId: string;
  executionId?: string | null;
  correlationId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
  actionType: string;
  actionTarget: string;
  resourceId?: string | null;
  requestingActorId: string;
  requestingActorType: string;
  canonicalPayloadFingerprint: string;
  payload: Record<string, unknown>;
  matchedPolicyId?: string | null;
  matchedPolicyVersion?: number | null;
  approvalReason: string;
  riskClassification: RiskTier;
  securityClassification: SecurityClassification;
  assignedReviewerId?: string | null;
  assignedRole?: string | null;
  status: ApprovalRequestStatus;
  decisionId?: string | null;
  consumedAt?: string | null;
  consumedBy?: string | null;
  idempotencyKey: string;
  expiresAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentApprovalDecisionEntity {
  id: string;
  approvalRequestId: string;
  organizationId: string;
  decision: ApprovalDecisionType;
  decidedByActorId: string;
  decidedByActorType: string;
  reason?: string | null;
  justification?: string | null;
  policySnapshot: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AgentApprovalEscalationEntity {
  id: string;
  approvalRequestId: string;
  organizationId: string;
  escalatedByActorId: string;
  previousReviewerId?: string | null;
  escalatedToReviewerId?: string | null;
  escalationContact?: string | null;
  reason: string;
  status: ApprovalEscalationStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface CreateApprovalRequestInput {
  organizationId: string;
  workspaceId?: string | null;
  agentId: string;
  executionId?: string | null;
  correlationId?: string | null;
  traceId?: string | null;
  spanId?: string | null;
  actionType: string;
  actionTarget: string;
  resourceId?: string | null;
  requestingActorId: string;
  requestingActorType?: string;
  payload: Record<string, unknown>;
  matchedPolicyId?: string | null;
  matchedPolicyVersion?: number | null;
  approvalReason: string;
  riskClassification?: RiskTier;
  securityClassification?: SecurityClassification;
  assignedReviewerId?: string | null;
  assignedRole?: string | null;
  expiresInMinutes?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface DecideApprovalRequestInput {
  approvalRequestId: string;
  organizationId: string;
  decision: ApprovalDecisionType;
  actorId: string;
  actorType?: string;
  userRoles?: string[];
  userPermissions?: string[];
  reason?: string;
  justification?: string;
}

export interface EscalateApprovalRequestInput {
  approvalRequestId: string;
  organizationId: string;
  actorId: string;
  escalatedToReviewerId?: string;
  reason: string;
}

export interface ContinueApprovalExecutionInput {
  approvalRequestId: string;
  organizationId: string;
  actorId: string;
  providedPayload?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface ApprovalContinuationResult {
  success: boolean;
  approvalRequestId: string;
  status: ApprovalRequestStatus;
  actionType: string;
  actionTarget: string;
  executionResult?: unknown;
  error?: string;
  errorCode?: string;
}

export interface ApprovalListFilters {
  status?: ApprovalRequestStatus;
  agentId?: string;
  riskClassification?: RiskTier;
  assignedReviewerId?: string;
  limit?: number;
  offset?: number;
}

export interface ApprovalDetailsResult {
  request: AgentApprovalRequestEntity;
  decisions: AgentApprovalDecisionEntity[];
  escalations: AgentApprovalEscalationEntity[];
}

/**
 * Computes canonical SHA-256 fingerprint of arbitrary payload JSON
 * with keys sorted deterministically.
 */
export function computePayloadFingerprint(payload: Record<string, unknown>): string {
  const normalize = (val: unknown): unknown => {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return val.map(normalize);
    if (typeof val === "object") {
      const sortedKeys = Object.keys(val as Record<string, unknown>).sort();
      const result: Record<string, unknown> = {};
      for (const k of sortedKeys) {
        result[k] = normalize((val as Record<string, unknown>)[k]);
      }
      return result;
    }
    return val;
  };

  const canonicalJson = JSON.stringify(normalize(payload));
  return createHash("sha256").update(canonicalJson).digest("hex");
}
