import { createHmac, randomBytes } from "node:crypto";

export type ResourceClassification =
  | "CONFIDENTIAL"
  | "RESTRICTED"
  | "INTERNAL"
  | "PUBLIC"
  | "confidential"
  | "restricted"
  | "internal"
  | "public";

export type NetworkAccessMode =
  | "BLOCKED"
  | "ALLOWLIST"
  | "UNRESTRICTED"
  | "blocked"
  | "allowlist"
  | "unrestricted";

export type StorageAccessMode =
  | "BLOCKED"
  | "WORKSPACE_ISOLATED"
  | "TEMPORARY_ONLY"
  | "blocked"
  | "workspace_isolated"
  | "temporary_only";

export type DatabaseOperation =
  | "READ"
  | "WRITE"
  | "DELETE"
  | "SCHEMA"
  | "read"
  | "write"
  | "delete"
  | "schema";

export type AutonomyLevel = "L0" | "L1" | "L2" | "L3" | "l0" | "l1" | "l2" | "l3";

export type ToolRiskCategory =
  | "READ_ONLY_DATA"
  | "CONTROLLED_WRITE"
  | "EXTERNAL_NETWORK"
  | "FILESYSTEM_ACCESS"
  | "CODE_EXECUTION"
  | "SYSTEM_OPERATION";

export type SecurityEventType =
  | "SUSPENSION"
  | "REACTIVATION"
  | "EMERGENCY_STOP"
  | "EMERGENCY_RESUME"
  | "CAPABILITY_DENIED"
  | "UNSAFE_CATEGORY_REJECTED"
  | "SECRET_ACCESS_DENIED"
  | "SECRET_REVOKED"
  | "INJECTION_ATTEMPT_DETECTED"
  | "CONTINUATION_BYPASS_ATTEMPT";

export type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SecretReferenceStatus = "ACTIVE" | "REVOKED" | "ROTATED" | "active" | "revoked" | "rotated";

export type ContinuationStatus =
  | "CLAIMED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "claimed"
  | "executing"
  | "completed"
  | "failed";

export type ReconciliationStatus =
  | "PENDING_EXECUTION"
  | "COMPLETED"
  | "EXECUTION_FAILED"
  | "pending_execution"
  | "completed"
  | "execution_failed";

export interface AgentSecurityProfileEntity {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  resourceClassification: ResourceClassification;
  networkAccessMode: NetworkAccessMode;
  allowedNetworkDomains: string[];
  disallowedNetworkDomains: string[];
  storageAccessMode: StorageAccessMode;
  allowedStoragePaths: string[];
  disallowedStoragePaths: string[];
  databaseOperations: DatabaseOperation[];
  maxExecutionDurationMs: number;
  maxToolInvocations: number;
  maxMemoryBytes: number;
  maxAutonomyLevel: AutonomyLevel;
  allowAutonomousExecution: boolean;
  delegationAttenuation: boolean;
  allowedToolKeys: string[];
  disallowedToolKeys: string[];
  allowedSecretReferenceIds: string[];
  isSuspended: boolean;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSecretReferenceEntity {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  secretIdentifier: string;
  name: string;
  description: string | null;
  allowedAgentIds: string[];
  allowedToolKeys: string[];
  status: SecretReferenceStatus;
  version: number;
  lastRotatedAt: string | null;
  createdBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSecurityEventEntity {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string | null;
  actorId: string | null;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AgentContinuationRecordEntity {
  id: string;
  approvalRequestId: string;
  organizationId: string;
  status: ContinuationStatus;
  reconciliationStatus: ReconciliationStatus;
  canonicalPayloadFingerprint: string;
  executionId: string | null;
  actorId: string;
  attempts: number;
  errorDetails: string | null;
  startedAt: string;
  completedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ContinuationProof {
  approvalRequestId: string;
  organizationId: string;
  agentId: string;
  actionTarget: string;
  payloadFingerprint: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

const INTERNAL_PROOF_SECRET = process.env.AGENT_SECURITY_HMAC_SECRET || "haza-aios-internal-continuation-guard-key-2026";

export function generateContinuationProof(input: {
  approvalRequestId: string;
  organizationId: string;
  agentId: string;
  actionTarget: string;
  payloadFingerprint: string;
  ttlSeconds?: number;
}): ContinuationProof {
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (input.ttlSeconds ?? 300) * 1000;

  const dataToSign = `${input.approvalRequestId}:${input.organizationId}:${input.agentId}:${input.actionTarget}:${input.payloadFingerprint}:${nonce}:${issuedAt}:${expiresAt}`;
  const signature = createHmac("sha256", INTERNAL_PROOF_SECRET).update(dataToSign).digest("hex");

  return {
    approvalRequestId: input.approvalRequestId,
    organizationId: input.organizationId,
    agentId: input.agentId,
    actionTarget: input.actionTarget,
    payloadFingerprint: input.payloadFingerprint,
    nonce,
    issuedAt,
    expiresAt,
    signature,
  };
}

export function verifyContinuationProof(
  proof: ContinuationProof,
  expected: {
    approvalRequestId: string;
    organizationId: string;
    agentId: string;
    actionTarget: string;
    payloadFingerprint: string;
  },
): { valid: boolean; reason?: string } {
  if (!proof || !proof.signature) {
    return { valid: false, reason: "Missing continuation authorization proof" };
  }

  if (Date.now() > proof.expiresAt) {
    return { valid: false, reason: "Continuation authorization proof has expired" };
  }

  if (proof.approvalRequestId !== expected.approvalRequestId) {
    return { valid: false, reason: "Continuation proof approvalRequestId mismatch" };
  }

  if (proof.organizationId !== expected.organizationId) {
    return { valid: false, reason: "Continuation proof organizationId mismatch" };
  }

  if (proof.agentId !== expected.agentId) {
    return { valid: false, reason: "Continuation proof agentId mismatch" };
  }

  if (proof.actionTarget !== expected.actionTarget) {
    return { valid: false, reason: "Continuation proof actionTarget mismatch" };
  }

  if (proof.payloadFingerprint !== expected.payloadFingerprint) {
    return { valid: false, reason: "Continuation proof payloadFingerprint mismatch" };
  }

  const dataToSign = `${proof.approvalRequestId}:${proof.organizationId}:${proof.agentId}:${proof.actionTarget}:${proof.payloadFingerprint}:${proof.nonce}:${proof.issuedAt}:${proof.expiresAt}`;
  const expectedSig = createHmac("sha256", INTERNAL_PROOF_SECRET).update(dataToSign).digest("hex");

  if (proof.signature !== expectedSig) {
    return { valid: false, reason: "Invalid continuation authorization signature" };
  }

  return { valid: true };
}

export interface SecurityPostureSummary {
  overallStatus: "HEALTHY" | "SUSPENDED" | "EMERGENCY_STOPPED" | "DEGRADED";
  isEmergencyStopped: boolean;
  emergencyStoppedAt?: string | null;
  emergencyStoppedBy?: string | null;
  activeAgentsCount: number;
  suspendedAgentsCount: number;
  totalSecretReferencesCount: number;
  activeSecretReferencesCount: number;
  revokedSecretReferencesCount: number;
  securityEventsCount24h: number;
  criticalEventsCount24h: number;
}

