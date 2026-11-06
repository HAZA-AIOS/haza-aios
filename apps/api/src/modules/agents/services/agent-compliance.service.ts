import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  type AuditChainVerificationResult,
  type AuditIntegrityChainRecord,
  canonicalStringify,
  type ComplianceControlRecord,
  type ComplianceControlStatus,
  type ComplianceEvidenceRecord,
  type ComplianceEvidenceType,
  type ComplianceEventIngestDTO,
  type ComplianceEventRecord,
  type ComplianceFrameworkRecord,
  type ComplianceInvestigationRecord,
  type ComplianceLegalHoldRecord,
  type ComplianceRetentionPolicyRecord,
  type EvidencePackageManifest,
  type EvidencePackageRecord,
  type InvestigationStatus,
  type InvestigationTimelineItem,
  type LegalHoldStatus,
  sha256Hash,
  verifyEvidencePackageOffline,
} from "../compliance.types.js";
import { AgentComplianceRepository } from "../repositories/agent-compliance.repository.js";
import { redactObject } from "./agent-secret-vault.service.js";

const GENESIS_PREVIOUS_HASH = "0".repeat(64);

export class AgentComplianceService {
  private readonly repo: AgentComplianceRepository;

  constructor(db: MySql2Database<any>) {
    this.repo = new AgentComplianceRepository(db);
  }

  // -------------------------------------------------------------------------
  // 1. Unified Event Ingestion & Tamper-Evident Hash Chain
  // -------------------------------------------------------------------------

  /**
   * Ingest a compliance event and atomically append it to the organization's
   * cryptographic hash chain.
   */
  async recordComplianceEvent(dto: ComplianceEventIngestDTO): Promise<{
    event: ComplianceEventRecord;
    chainRecord?: AuditIntegrityChainRecord;
    isDuplicate: boolean;
  }> {
    // Scrub metadata for secrets before ingestion
    const sanitizedMetadata = redactObject(dto.redactedMetadata ?? {});

    const { event, isDuplicate } = await this.repo.ingestEvent({
      ...dto,
      redactedMetadata: sanitizedMetadata,
    });

    if (isDuplicate) {
      return { event, isDuplicate: true };
    }

    // Build tamper-evident hash chain link
    const latestChain = await this.repo.getLatestChainRecord(dto.organizationId);
    const sequenceNumber = latestChain ? latestChain.sequenceNumber + 1 : 1;
    const previousEventHash = latestChain
      ? latestChain.currentEventHash
      : GENESIS_PREVIOUS_HASH;

    // Canonical payload hash
    const canonicalPayload = canonicalStringify({
      id: event.id,
      organizationId: event.organizationId,
      workspaceId: event.workspaceId,
      eventCategory: event.eventCategory,
      eventType: event.eventType,
      eventTimestamp: event.eventTimestamp.toISOString(),
      actorId: event.actorId,
      actorType: event.actorType,
      agentId: event.agentId,
      executionId: event.executionId,
      policyId: event.policyId,
      policyVersion: event.policyVersion,
      approvalRequestId: event.approvalRequestId,
      securityEventRef: event.securityEventRef,
      correlationId: event.correlationId,
      traceId: event.traceId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      eventOutcome: event.eventOutcome,
      riskSeverity: event.riskSeverity,
      dataClassification: event.dataClassification,
      redactedMetadata: event.redactedMetadata,
    });

    const payloadHash = sha256Hash(canonicalPayload);
    const currentEventHash = sha256Hash(
      `${previousEventHash}:${sequenceNumber}:${payloadHash}`,
    );

    const chainRecord = await this.repo.appendChainRecord({
      organizationId: dto.organizationId,
      eventId: event.id,
      sequenceNumber,
      previousEventHash,
      payloadHash,
      currentEventHash,
      hashAlgorithm: "SHA-256",
      schemaVersion: 1,
    });

    return { event, chainRecord, isDuplicate: false };
  }

  /**
   * Verify the mathematical integrity of the organization's audit ledger.
   * Detects modified payloads, broken previous-hash links, and missing sequence numbers.
   */
  async verifyAuditIntegrity(
    organizationId: string,
    range?: { fromSeq?: number; toSeq?: number },
  ): Promise<AuditChainVerificationResult> {
    const chainRecords = await this.repo.getChainRecords(organizationId, range);

    const result: AuditChainVerificationResult = {
      organizationId,
      isValid: true,
      totalEventsVerified: chainRecords.length,
      sequenceRange:
        chainRecords.length > 0
          ? {
              from: chainRecords[0].sequenceNumber,
              to: chainRecords[chainRecords.length - 1].sequenceNumber,
            }
          : null,
      brokenLinks: [],
      tamperedEvents: [],
      missingSequences: [],
      verifiedAt: new Date().toISOString(),
      details: "Audit chain verification passed. All cryptographic links verified.",
    };

    if (chainRecords.length === 0) {
      result.details = "No audit records found in specified range.";
      return result;
    }

    let expectedPrevHash =
      chainRecords[0].sequenceNumber === 1
        ? GENESIS_PREVIOUS_HASH
        : chainRecords[0].previousEventHash;

    let expectedSequence = chainRecords[0].sequenceNumber;

    for (const record of chainRecords) {
      // 1. Check sequence number continuity
      if (record.sequenceNumber !== expectedSequence) {
        result.isValid = false;
        result.missingSequences.push(expectedSequence);
        expectedSequence = record.sequenceNumber;
      }
      expectedSequence++;

      // 2. Check previous hash reference link
      if (record.previousEventHash !== expectedPrevHash) {
        result.isValid = false;
        result.brokenLinks.push({
          sequenceNumber: record.sequenceNumber,
          eventId: record.eventId,
          expectedPreviousHash: expectedPrevHash,
          actualPreviousHash: record.previousEventHash,
        });
      }

      // 3. Fetch source event and verify payload hash
      const sourceEvent = await this.repo.getEventById(
        organizationId,
        record.eventId,
      );

      if (!sourceEvent) {
        result.isValid = false;
        result.tamperedEvents.push({
          sequenceNumber: record.sequenceNumber,
          eventId: record.eventId,
          expectedPayloadHash: record.payloadHash,
          recomputedPayloadHash: "EVENT_MISSING_FROM_DATABASE",
        });
      } else {
        const canonicalPayload = canonicalStringify({
          id: sourceEvent.id,
          organizationId: sourceEvent.organizationId,
          workspaceId: sourceEvent.workspaceId,
          eventCategory: sourceEvent.eventCategory,
          eventType: sourceEvent.eventType,
          eventTimestamp: sourceEvent.eventTimestamp.toISOString(),
          actorId: sourceEvent.actorId,
          actorType: sourceEvent.actorType,
          agentId: sourceEvent.agentId,
          executionId: sourceEvent.executionId,
          policyId: sourceEvent.policyId,
          policyVersion: sourceEvent.policyVersion,
          approvalRequestId: sourceEvent.approvalRequestId,
          securityEventRef: sourceEvent.securityEventRef,
          correlationId: sourceEvent.correlationId,
          traceId: sourceEvent.traceId,
          resourceType: sourceEvent.resourceType,
          resourceId: sourceEvent.resourceId,
          eventOutcome: sourceEvent.eventOutcome,
          riskSeverity: sourceEvent.riskSeverity,
          dataClassification: sourceEvent.dataClassification,
          redactedMetadata: sourceEvent.redactedMetadata,
        });

        const recomputedPayloadHash = sha256Hash(canonicalPayload);
        if (recomputedPayloadHash !== record.payloadHash) {
          result.isValid = false;
          result.tamperedEvents.push({
            sequenceNumber: record.sequenceNumber,
            eventId: record.eventId,
            expectedPayloadHash: record.payloadHash,
            recomputedPayloadHash,
          });
        }

        // Verify current event hash
        const recomputedCurrentHash = sha256Hash(
          `${record.previousEventHash}:${record.sequenceNumber}:${record.payloadHash}`,
        );
        if (recomputedCurrentHash !== record.currentEventHash) {
          result.isValid = false;
          result.tamperedEvents.push({
            sequenceNumber: record.sequenceNumber,
            eventId: record.eventId,
            expectedPayloadHash: record.currentEventHash,
            recomputedPayloadHash: recomputedCurrentHash,
          });
        }
      }

      expectedPrevHash = record.currentEventHash;
    }

    if (!result.isValid) {
      result.details = `Audit chain verification failed: ${result.brokenLinks.length} broken links, ${result.tamperedEvents.length} tampered events, ${result.missingSequences.length} sequence gaps.`;
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // 2. Framework & Control Management
  // -------------------------------------------------------------------------

  async listFrameworks(organizationId: string): Promise<ComplianceFrameworkRecord[]> {
    return this.repo.listFrameworks(organizationId);
  }

  async listControls(
    organizationId: string,
    filters: {
      frameworkId?: string;
      category?: string;
      status?: ComplianceControlStatus;
    } = {},
  ): Promise<ComplianceControlRecord[]> {
    return this.repo.listControls(organizationId, filters);
  }

  async getControl(
    organizationId: string,
    controlId: string,
  ): Promise<ComplianceControlRecord | null> {
    return this.repo.getControlById(organizationId, controlId);
  }

  async verifyControl(
    organizationId: string,
    controlId: string,
    data: {
      status: ComplianceControlStatus;
      verifiedBy: string;
      exceptions?: string;
    },
  ): Promise<ComplianceControlRecord> {
    const updated = await this.repo.updateControlVerification(
      organizationId,
      controlId,
      data,
    );

    // Record compliance change event
    await this.recordComplianceEvent({
      organizationId,
      eventCategory: "COMPLIANCE_CHANGE",
      eventType: "CONTROL_VERIFICATION_UPDATED",
      actorId: data.verifiedBy,
      resourceType: "compliance_control",
      resourceId: controlId,
      eventOutcome: "SUCCESS",
      redactedMetadata: {
        controlKey: updated.controlKey,
        newStatus: data.status,
        exceptions: data.exceptions,
      },
    });

    return updated;
  }

  // -------------------------------------------------------------------------
  // 3. Compliance Evidence Management
  // -------------------------------------------------------------------------

  async collectEvidence(
    organizationId: string,
    data: {
      workspaceId?: string | null;
      title: string;
      evidenceType: ComplianceEvidenceType;
      source: string;
      classification?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
      relatedControlIds?: string[];
      storageReference?: string | null;
      structuredPayload?: Record<string, unknown>;
      collectedBy?: string | null;
    },
  ): Promise<ComplianceEvidenceRecord> {
    const sanitizedPayload = redactObject(data.structuredPayload ?? {});
    const canonicalPayload = canonicalStringify(sanitizedPayload);
    const contentHash = sha256Hash(canonicalPayload);

    const evidence = await this.repo.createEvidence({
      organizationId,
      workspaceId: data.workspaceId,
      title: data.title,
      evidenceType: data.evidenceType,
      source: data.source,
      classification: data.classification ?? "INTERNAL",
      relatedControlIds: data.relatedControlIds ?? [],
      contentHash,
      storageReference: data.storageReference,
      structuredPayload: sanitizedPayload,
      collectedBy: data.collectedBy,
    });

    await this.recordComplianceEvent({
      organizationId,
      workspaceId: data.workspaceId,
      eventCategory: "COMPLIANCE_CHANGE",
      eventType: "EVIDENCE_COLLECTED",
      actorId: data.collectedBy,
      resourceType: "compliance_evidence",
      resourceId: evidence.id,
      eventOutcome: "SUCCESS",
      redactedMetadata: {
        evidenceType: evidence.evidenceType,
        contentHash: evidence.contentHash,
        relatedControlIds: evidence.relatedControlIds,
      },
    });

    return evidence;
  }

  async listEvidence(
    organizationId: string,
    filters: {
      workspaceId?: string;
      evidenceType?: ComplianceEvidenceType;
      classification?: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
      isUnderLegalHold?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ evidence: ComplianceEvidenceRecord[]; total: number }> {
    return this.repo.listEvidence(organizationId, filters);
  }

  async getEvidence(
    organizationId: string,
    evidenceId: string,
  ): Promise<ComplianceEvidenceRecord | null> {
    return this.repo.getEvidenceById(organizationId, evidenceId);
  }

  // -------------------------------------------------------------------------
  // 4. Evidence Packaging & Independent Export
  // -------------------------------------------------------------------------

  async generateEvidencePackage(
    organizationId: string,
    data: {
      workspaceId?: string | null;
      packageIdentifier?: string;
      evidenceIds: string[];
      auditEventIds?: string[];
      exportedBy: string;
      redactionLevel?: string;
    },
  ): Promise<{ packageRecord: EvidencePackageRecord; manifest: EvidencePackageManifest }> {
    if (!Array.isArray(data.evidenceIds) || data.evidenceIds.length === 0) {
      throw new Error("At least one evidence ID is required to generate an evidence package.");
    }

    const pkgIdent =
      data.packageIdentifier ??
      `PKG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Collect and verify evidence items
    const manifestItems = [];
    for (const evId of data.evidenceIds) {
      const ev = await this.repo.getEvidenceById(organizationId, evId);
      if (!ev) {
        throw new Error(
          `Evidence item ${evId} not found in organization ${organizationId}. Cross-tenant export prohibited.`,
        );
      }
      manifestItems.push({
        evidenceId: ev.id,
        title: ev.title,
        evidenceType: ev.evidenceType,
        classification: ev.classification,
        contentHash: ev.contentHash,
      });
    }

    // Collect and verify audit events
    const manifestEvents = [];
    const eventIds = data.auditEventIds ?? [];
    for (const eId of eventIds) {
      const ev = await this.repo.getEventById(organizationId, eId);
      if (!ev) {
        throw new Error(
          `Audit event ${eId} not found in organization ${organizationId}.`,
        );
      }
      const canonicalPayload = canonicalStringify({
        id: ev.id,
        organizationId: ev.organizationId,
        eventCategory: ev.eventCategory,
        eventType: ev.eventType,
        eventTimestamp: ev.eventTimestamp.toISOString(),
      });
      manifestEvents.push({
        eventId: ev.id,
        eventCategory: ev.eventCategory,
        eventType: ev.eventType,
        eventTimestamp: ev.eventTimestamp.toISOString(),
        payloadHash: sha256Hash(canonicalPayload),
      });
    }

    const exportedAt = new Date().toISOString();
    const manifest: EvidencePackageManifest = {
      packageIdentifier: pkgIdent,
      organizationId,
      workspaceId: data.workspaceId ?? null,
      exportedAt,
      exportedBy: data.exportedBy,
      hashAlgorithm: "SHA-256",
      redactionLevel: data.redactionLevel ?? "DEEP_SECRET_SCRUBBED",
      evidenceCount: manifestItems.length,
      auditEventCount: manifestEvents.length,
      items: manifestItems,
      events: manifestEvents,
      verificationInstructions:
        "Verify this manifest offline by calculating sha256 of canonical JSON items and events, or use verifyEvidencePackageOffline().",
    };

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
    const manifestChecksum = sha256Hash(canonicalManifest);

    const packageRecord = await this.repo.createEvidencePackage({
      organizationId,
      workspaceId: data.workspaceId,
      packageIdentifier: pkgIdent,
      manifestChecksum,
      hashAlgorithm: "SHA-256",
      evidenceIds: data.evidenceIds,
      auditEventIds: eventIds,
      manifestPayload: manifest,
      redactionLevel: data.redactionLevel,
      exportedBy: data.exportedBy,
    });

    // Record compliance export event
    await this.recordComplianceEvent({
      organizationId,
      workspaceId: data.workspaceId,
      eventCategory: "EVIDENCE_EXPORT",
      eventType: "PACKAGE_GENERATED",
      actorId: data.exportedBy,
      resourceType: "evidence_package",
      resourceId: packageRecord.id,
      eventOutcome: "SUCCESS",
      redactedMetadata: {
        packageIdentifier: pkgIdent,
        manifestChecksum,
        evidenceCount: manifestItems.length,
      },
    });

    return { packageRecord, manifest };
  }

  async listEvidencePackages(
    organizationId: string,
  ): Promise<EvidencePackageRecord[]> {
    return this.repo.listEvidencePackages(organizationId);
  }

  async getEvidencePackage(
    organizationId: string,
    packageIdentifierOrId: string,
  ): Promise<EvidencePackageRecord | null> {
    return this.repo.getEvidencePackageById(organizationId, packageIdentifierOrId);
  }

  verifyPackageOffline(
    manifest: EvidencePackageManifest,
    expectedChecksum?: string,
  ): { isValid: boolean; errors: string[] } {
    return verifyEvidencePackageOffline(manifest, expectedChecksum);
  }

  // -------------------------------------------------------------------------
  // 5. Retention Policies & Legal Holds
  // -------------------------------------------------------------------------

  async listRetentionPolicies(
    organizationId: string,
  ): Promise<ComplianceRetentionPolicyRecord[]> {
    return this.repo.listRetentionPolicies(organizationId);
  }

  async upsertRetentionPolicy(data: {
    organizationId: string;
    recordCategory: string;
    retentionDurationDays: number;
    disposalAction?: "ARCHIVE" | "PURGE" | "ANONYMIZE";
    createdBy?: string;
  }): Promise<ComplianceRetentionPolicyRecord> {
    const updated = await this.repo.upsertRetentionPolicy(data);

    await this.recordComplianceEvent({
      organizationId: data.organizationId,
      eventCategory: "RETENTION_ACTION",
      eventType: "RETENTION_POLICY_CONFIGURED",
      actorId: data.createdBy,
      resourceType: "retention_policy",
      resourceId: updated.id,
      eventOutcome: "SUCCESS",
      redactedMetadata: {
        recordCategory: data.recordCategory,
        retentionDurationDays: data.retentionDurationDays,
        disposalAction: updated.disposalAction,
      },
    });

    return updated;
  }

  async createLegalHold(data: {
    organizationId: string;
    name: string;
    description?: string;
    reason: string;
    scopeType?: "ALL" | "AGENT" | "CONTROL" | "CATEGORY" | "TIME_RANGE";
    scopeCriteria?: Record<string, unknown>;
    createdBy: string;
  }): Promise<ComplianceLegalHoldRecord> {
    const hold = await this.repo.createLegalHold(data);

    await this.recordComplianceEvent({
      organizationId: data.organizationId,
      eventCategory: "COMPLIANCE_CHANGE",
      eventType: "LEGAL_HOLD_CREATED",
      actorId: data.createdBy,
      resourceType: "legal_hold",
      resourceId: hold.id,
      eventOutcome: "SUCCESS",
      redactedMetadata: {
        holdIdentifier: hold.holdIdentifier,
        scopeType: hold.scopeType,
        reason: hold.reason,
      },
    });

    return hold;
  }

  async listLegalHolds(
    organizationId: string,
    status?: LegalHoldStatus,
  ): Promise<ComplianceLegalHoldRecord[]> {
    return this.repo.listLegalHolds(organizationId, status);
  }

  async releaseLegalHold(
    organizationId: string,
    holdIdentifier: string,
    releasedBy: string,
    justification: string,
  ): Promise<ComplianceLegalHoldRecord> {
    const released = await this.repo.releaseLegalHold(
      organizationId,
      holdIdentifier,
      releasedBy,
      justification,
    );

    await this.recordComplianceEvent({
      organizationId,
      eventCategory: "COMPLIANCE_CHANGE",
      eventType: "LEGAL_HOLD_RELEASED",
      actorId: releasedBy,
      resourceType: "legal_hold",
      resourceId: released.id,
      eventOutcome: "SUCCESS",
      redactedMetadata: {
        holdIdentifier,
        justification,
      },
    });

    return released;
  }

  /**
   * Dry-run disposal calculation.
   * Identifies candidate records for expiration without executing deletion.
   * Confirms active legal holds override disposal.
   */
  async previewDisposal(organizationId: string): Promise<{
    organizationId: string;
    policiesEvaluated: number;
    activeHoldsCount: number;
    candidateCount: number;
    protectedCount: number;
    candidates: Array<{
      category: string;
      recordId: string;
      title: string;
      ageDays: number;
      retentionLimitDays: number;
      isProtectedByHold: boolean;
      plannedDisposalAction: string;
    }>;
  }> {
    const policies = await this.repo.listRetentionPolicies(organizationId);
    const activeHolds = await this.repo.listLegalHolds(organizationId, "ACTIVE");
    const isOrgUnderHold = activeHolds.some((h) => h.scopeType === "ALL");

    const evidenceList = await this.repo.listEvidence(organizationId, { limit: 100 });
    const now = Date.now();
    const candidates = [];

    const evidencePolicy = policies.find((p) => p.recordCategory === "evidence");
    const retentionLimit = evidencePolicy ? evidencePolicy.retentionDurationDays : 730;

    for (const ev of evidenceList.evidence) {
      const ageDays = Math.floor((now - ev.collectedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays >= retentionLimit) {
        const isProtected = isOrgUnderHold || ev.isUnderLegalHold;
        candidates.push({
          category: "evidence",
          recordId: ev.id,
          title: ev.title,
          ageDays,
          retentionLimitDays: retentionLimit,
          isProtectedByHold: isProtected,
          plannedDisposalAction: isProtected ? "RETAIN_UNDER_LEGAL_HOLD" : evidencePolicy?.disposalAction ?? "ARCHIVE",
        });
      }
    }

    const protectedCount = candidates.filter((c) => c.isProtectedByHold).length;

    return {
      organizationId,
      policiesEvaluated: policies.length,
      activeHoldsCount: activeHolds.length,
      candidateCount: candidates.length,
      protectedCount,
      candidates,
    };
  }

  // -------------------------------------------------------------------------
  // 6. Investigations & Timeline Reconstruction
  // -------------------------------------------------------------------------

  async createInvestigation(data: {
    organizationId: string;
    title: string;
    description?: string;
    investigatorId: string;
    searchFilters?: Record<string, unknown>;
  }): Promise<ComplianceInvestigationRecord> {
    const inv = await this.repo.createInvestigation(data);

    await this.recordComplianceEvent({
      organizationId: data.organizationId,
      eventCategory: "COMPLIANCE_CHANGE",
      eventType: "INVESTIGATION_OPENED",
      actorId: data.investigatorId,
      resourceType: "investigation",
      resourceId: inv.id,
      eventOutcome: "SUCCESS",
      redactedMetadata: {
        caseNumber: inv.caseNumber,
        title: inv.title,
      },
    });

    return inv;
  }

  async listInvestigations(
    organizationId: string,
    status?: InvestigationStatus,
  ): Promise<ComplianceInvestigationRecord[]> {
    return this.repo.listInvestigations(organizationId, status);
  }

  async addInvestigationNote(
    organizationId: string,
    caseNumber: string,
    note: string,
    authorId: string,
  ): Promise<ComplianceInvestigationRecord> {
    return this.repo.addInvestigationNote(organizationId, caseNumber, note, authorId);
  }

  /**
   * Chronological reconstruction linking:
   * Request -> Policy Evaluation -> Approval -> Security Validation -> Tool Execution -> Outcome
   */
  async getInvestigationTimeline(
    organizationId: string,
    query: {
      correlationId?: string;
      traceId?: string;
      agentId?: string;
      investigatorId?: string;
      fromTimestamp?: Date;
      toTimestamp?: Date;
    },
  ): Promise<{ timeline: InvestigationTimelineItem[]; total: number }> {
    // Audit investigation search access
    if (query.investigatorId) {
      await this.recordComplianceEvent({
        organizationId,
        eventCategory: "COMPLIANCE_CHANGE",
        eventType: "INVESTIGATION_QUERY_EXECUTED",
        actorId: query.investigatorId,
        eventOutcome: "SUCCESS",
        redactedMetadata: {
          correlationId: query.correlationId,
          agentId: query.agentId,
          traceId: query.traceId,
        },
      });
    }

    const { events, total } = await this.repo.listEvents(organizationId, {
      correlationId: query.correlationId,
      traceId: query.traceId,
      agentId: query.agentId,
      fromTimestamp: query.fromTimestamp,
      toTimestamp: query.toTimestamp,
      limit: 100,
    });

    // Sort chronologically ascending
    const sorted = [...events].sort(
      (a, b) => a.eventTimestamp.getTime() - b.eventTimestamp.getTime(),
    );

    const timeline: InvestigationTimelineItem[] = sorted.map((e) => {
      let stage: InvestigationTimelineItem["stage"] = "EXECUTION";
      if (e.eventCategory === "POLICY_EVALUATION") stage = "POLICY";
      else if (e.eventCategory === "HUMAN_APPROVAL") stage = "APPROVAL";
      else if (e.eventCategory === "SECURITY_CONTROL") stage = "SECURITY";
      else if (e.eventType.includes("REQUEST")) stage = "REQUEST";
      else if (e.eventCategory === "AGENT_EXECUTION" && e.eventOutcome !== "SUCCESS")
        stage = "OUTCOME";

      return {
        stage,
        eventId: e.id,
        eventTimestamp: e.eventTimestamp.toISOString(),
        eventType: e.eventType,
        actorId: e.actorId,
        agentId: e.agentId,
        outcome: e.eventOutcome,
        details: e.redactedMetadata,
      };
    });

    return { timeline, total };
  }

  // -------------------------------------------------------------------------
  // 7. Compliance Overview & Reporting
  // -------------------------------------------------------------------------

  async getComplianceOverview(organizationId: string): Promise<{
    organizationId: string;
    totalControls: number;
    implementedControls: number;
    verifiedControls: number;
    evidencePendingControls: number;
    noncompliantControls: number;
    frameworkCoveragePercent: number;
    activeHoldsCount: number;
    totalEvidenceCount: number;
    totalPackagesCount: number;
    auditIntegrityStatus: {
      isValid: boolean;
      totalEvents: number;
      lastVerifiedAt: string;
    };
  }> {
    const controls = await this.repo.listControls(organizationId);
    const holds = await this.repo.listLegalHolds(organizationId, "ACTIVE");
    const evidence = await this.repo.listEvidence(organizationId, { limit: 1 });
    const packages = await this.repo.listEvidencePackages(organizationId);

    const implemented = controls.filter(
      (c) => c.implementationStatus === "IMPLEMENTED" || c.implementationStatus === "VERIFIED",
    ).length;
    const verified = controls.filter((c) => c.implementationStatus === "VERIFIED").length;
    const pending = controls.filter(
      (c) => c.implementationStatus === "EVIDENCE_PENDING",
    ).length;
    const noncompliant = controls.filter(
      (c) => c.implementationStatus === "NONCOMPLIANT",
    ).length;

    const frameworkCoveragePercent =
      controls.length > 0 ? Math.round((implemented / controls.length) * 100) : 0;

    // Fast integrity verification check
    const integrity = await this.verifyAuditIntegrity(organizationId);

    return {
      organizationId,
      totalControls: controls.length,
      implementedControls: implemented,
      verifiedControls: verified,
      evidencePendingControls: pending,
      noncompliantControls: noncompliant,
      frameworkCoveragePercent,
      activeHoldsCount: holds.length,
      totalEvidenceCount: evidence.total,
      totalPackagesCount: packages.length,
      auditIntegrityStatus: {
        isValid: integrity.isValid,
        totalEvents: integrity.totalEventsVerified,
        lastVerifiedAt: integrity.verifiedAt,
      },
    };
  }
}
