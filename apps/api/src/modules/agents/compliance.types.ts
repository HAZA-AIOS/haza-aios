import { createHash } from "node:crypto";

export type ComplianceEventCategory =
  | "AGENT_EXECUTION"
  | "TOOL_INVOCATION"
  | "POLICY_EVALUATION"
  | "HUMAN_APPROVAL"
  | "SECURITY_CONTROL"
  | "SECRET_ACCESS"
  | "GOVERNANCE_CHANGE"
  | "COMPLIANCE_CHANGE"
  | "EVIDENCE_EXPORT"
  | "RETENTION_ACTION";

export type ComplianceEventOutcome =
  | "SUCCESS"
  | "DENIED"
  | "BLOCKED"
  | "FAILURE"
  | "SUSPENDED"
  | "APPROVED"
  | "REJECTED";

export type ComplianceRiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ComplianceDataClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "RESTRICTED";

export type ComplianceControlStatus =
  | "NOT_IMPLEMENTED"
  | "PLANNED"
  | "IMPLEMENTED"
  | "EVIDENCE_PENDING"
  | "VERIFIED"
  | "NONCOMPLIANT"
  | "NOT_APPLICABLE";

export type ComplianceEvidenceType =
  | "execution_log"
  | "tool_result"
  | "policy_evaluation"
  | "approval_decision"
  | "security_event"
  | "integrity_verification"
  | "governance_snapshot"
  | "test_report"
  | "compliance_review";

export type LegalHoldStatus = "ACTIVE" | "RELEASED";

export type InvestigationStatus = "OPEN" | "IN_REVIEW" | "CLOSED";

export interface ComplianceEventIngestDTO {
  id?: string;
  organizationId: string;
  workspaceId?: string | null;
  eventCategory: ComplianceEventCategory;
  eventType: string;
  eventTimestamp?: Date | string;
  actorId?: string | null;
  actorType?: string;
  agentId?: string | null;
  executionId?: string | null;
  policyId?: string | null;
  policyVersion?: number | null;
  approvalRequestId?: string | null;
  securityEventRef?: string | null;
  correlationId?: string | null;
  traceId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  eventOutcome?: ComplianceEventOutcome;
  riskSeverity?: ComplianceRiskSeverity;
  dataClassification?: ComplianceDataClassification;
  redactedMetadata?: Record<string, unknown>;
  schemaVersion?: number;
}

export interface ComplianceEventRecord {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  eventCategory: ComplianceEventCategory;
  eventType: string;
  eventTimestamp: Date;
  ingestionTimestamp: Date;
  actorId: string | null;
  actorType: string;
  agentId: string | null;
  executionId: string | null;
  policyId: string | null;
  policyVersion: number | null;
  approvalRequestId: string | null;
  securityEventRef: string | null;
  correlationId: string | null;
  traceId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  eventOutcome: ComplianceEventOutcome;
  riskSeverity: ComplianceRiskSeverity;
  dataClassification: ComplianceDataClassification;
  redactedMetadata: Record<string, unknown>;
  schemaVersion: number;
  createdAt: Date;
}

export interface AuditIntegrityChainRecord {
  id: string;
  organizationId: string;
  eventId: string;
  sequenceNumber: number;
  previousEventHash: string;
  payloadHash: string;
  currentEventHash: string;
  hashAlgorithm: string;
  schemaVersion: number;
  recordedAt: Date;
}

export interface AuditChainVerificationResult {
  organizationId: string;
  isValid: boolean;
  totalEventsVerified: number;
  sequenceRange: { from: number; to: number } | null;
  brokenLinks: Array<{
    sequenceNumber: number;
    eventId: string;
    expectedPreviousHash: string;
    actualPreviousHash: string;
  }>;
  tamperedEvents: Array<{
    sequenceNumber: number;
    eventId: string;
    expectedPayloadHash: string;
    recomputedPayloadHash: string;
  }>;
  missingSequences: number[];
  verifiedAt: string;
  details: string;
}

export interface ComplianceFrameworkRecord {
  id: string;
  organizationId: string;
  frameworkKey: string;
  name: string;
  version: string;
  description: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceControlRecord {
  id: string;
  organizationId: string;
  frameworkId: string;
  controlKey: string;
  title: string;
  description: string | null;
  category: string;
  implementationStatus: ComplianceControlStatus;
  ownerId: string | null;
  reviewFrequencyDays: number;
  lastReviewedAt: Date | null;
  nextReviewDueAt: Date | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  exceptions: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceControlMappingRecord {
  id: string;
  organizationId: string;
  controlId: string;
  targetType: string;
  targetKey: string;
  notes: string | null;
  createdAt: Date;
}

export interface ComplianceEvidenceRecord {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  title: string;
  evidenceType: ComplianceEvidenceType;
  source: string;
  classification: ComplianceDataClassification;
  relatedControlIds: string[];
  contentHash: string;
  storageReference: string | null;
  structuredPayload: Record<string, unknown>;
  verificationStatus: "VALID" | "INVALID" | "FLAGGED";
  retentionPolicyId: string | null;
  isUnderLegalHold: boolean;
  collectedBy: string | null;
  collectedAt: Date;
  accessCount: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EvidencePackageManifestItem {
  evidenceId: string;
  title: string;
  evidenceType: string;
  classification: string;
  contentHash: string;
}

export interface EvidencePackageManifestEvent {
  eventId: string;
  eventCategory: string;
  eventType: string;
  eventTimestamp: string;
  payloadHash: string;
}

export interface EvidencePackageManifest {
  packageIdentifier: string;
  organizationId: string;
  workspaceId: string | null;
  exportedAt: string;
  exportedBy: string;
  hashAlgorithm: string;
  redactionLevel: string;
  evidenceCount: number;
  auditEventCount: number;
  items: EvidencePackageManifestItem[];
  events: EvidencePackageManifestEvent[];
  verificationInstructions: string;
}

export interface EvidencePackageRecord {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  packageIdentifier: string;
  manifestChecksum: string;
  hashAlgorithm: string;
  evidenceIds: string[];
  auditEventIds: string[];
  manifestPayload: EvidencePackageManifest;
  redactionLevel: string;
  status: string;
  exportedBy: string;
  exportedAt: Date;
}

export interface ComplianceRetentionPolicyRecord {
  id: string;
  organizationId: string;
  recordCategory: string;
  retentionDurationDays: number;
  effectiveFrom: Date;
  disposalAction: "ARCHIVE" | "PURGE" | "ANONYMIZE";
  status: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceLegalHoldRecord {
  id: string;
  organizationId: string;
  holdIdentifier: string;
  name: string;
  description: string | null;
  reason: string;
  scopeType: "ALL" | "AGENT" | "CONTROL" | "CATEGORY" | "TIME_RANGE";
  scopeCriteria: Record<string, unknown>;
  status: LegalHoldStatus;
  createdBy: string;
  releasedBy: string | null;
  releasedAt: Date | null;
  releaseJustification: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceInvestigationRecord {
  id: string;
  organizationId: string;
  caseNumber: string;
  title: string;
  description: string | null;
  investigatorId: string;
  status: InvestigationStatus;
  searchFilters: Record<string, unknown>;
  findings: string | null;
  notes: Array<{ note: string; authorId: string; timestamp: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvestigationTimelineItem {
  stage: "REQUEST" | "POLICY" | "APPROVAL" | "SECURITY" | "EXECUTION" | "OUTCOME";
  eventId: string;
  eventTimestamp: string;
  eventType: string;
  actorId: string | null;
  agentId: string | null;
  outcome: string;
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Canonical Serialization & Cryptographic Helpers
// ---------------------------------------------------------------------------

/**
 * Deterministically serialize any JavaScript object or primitive into canonical JSON.
 * Sorts object keys recursively to ensure consistent hashing.
 */
export function canonicalStringify(obj: unknown): string {
  if (obj === null || obj === undefined) {
    return "null";
  }
  if (typeof obj === "boolean" || typeof obj === "number") {
    return JSON.stringify(obj);
  }
  if (typeof obj === "string") {
    return JSON.stringify(obj);
  }
  if (obj instanceof Date) {
    return JSON.stringify(obj.toISOString());
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalStringify(item)).join(",") + "]";
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map((key) => {
      const val = (obj as Record<string, unknown>)[key];
      return JSON.stringify(key) + ":" + canonicalStringify(val);
    });
    return "{" + pairs.join(",") + "}";
  }
  return JSON.stringify(obj);
}

/**
 * Compute SHA-256 hash in hex format.
 */
export function sha256Hash(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Offline evidence package verification.
 * Does not require any database or network access.
 */
export function verifyEvidencePackageOffline(
  manifest: EvidencePackageManifest,
  expectedChecksum?: string,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== "object") {
    return { isValid: false, errors: ["Invalid manifest object"] };
  }

  // 1. Verify individual evidence checksum format
  if (!Array.isArray(manifest.items)) {
    errors.push("Missing manifest items array");
  } else {
    for (const item of manifest.items) {
      if (!item.contentHash || item.contentHash.length !== 64) {
        errors.push(`Invalid content hash for evidence item ${item.evidenceId}`);
      }
    }
  }

  // 2. Verify audit events in manifest
  if (!Array.isArray(manifest.events)) {
    errors.push("Missing manifest events array");
  } else {
    for (const event of manifest.events) {
      if (!event.payloadHash || event.payloadHash.length !== 64) {
        errors.push(`Invalid payload hash for audit event ${event.eventId}`);
      }
    }
  }

  // 3. Verify overall manifest checksum if provided
  if (expectedChecksum) {
    const canonicalManifest = canonicalStringify({
      packageIdentifier: manifest.packageIdentifier,
      organizationId: manifest.organizationId,
      workspaceId: manifest.workspaceId,
      exportedAt: manifest.exportedAt,
      exportedBy: manifest.exportedBy,
      hashAlgorithm: manifest.hashAlgorithm,
      redactionLevel: manifest.redactionLevel,
      evidenceCount: manifest.evidenceCount,
      auditEventCount: manifest.auditEventCount,
      items: manifest.items,
      events: manifest.events,
    });
    const computedChecksum = sha256Hash(canonicalManifest);
    if (computedChecksum !== expectedChecksum) {
      errors.push(
        `Manifest checksum mismatch: expected ${expectedChecksum}, calculated ${computedChecksum}`,
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
