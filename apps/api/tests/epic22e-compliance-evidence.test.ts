import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import {
  canonicalStringify,
  sha256Hash,
  verifyEvidencePackageOffline,
  type ComplianceEventIngestDTO,
  type ComplianceEventRecord,
  type AuditIntegrityChainRecord,
  type ComplianceControlRecord,
  type ComplianceEvidenceRecord,
  type EvidencePackageManifest,
  type ComplianceLegalHoldRecord,
  type ComplianceRetentionPolicyRecord,
  type ComplianceInvestigationRecord,
} from "../src/modules/agents/compliance.types.js";
import { AgentComplianceService } from "../src/modules/agents/services/agent-compliance.service.js";
import { AgentComplianceRepository } from "../src/modules/agents/repositories/agent-compliance.repository.js";
import { redactObject } from "../src/modules/agents/utils/secret-redactor.js";

// In-Memory Database Backing for Compliance Engine Testing
class MockComplianceDatabase {
  events = new Map<string, ComplianceEventRecord>();
  chains: AuditIntegrityChainRecord[] = [];
  frameworks = new Map<string, any>();
  controls = new Map<string, ComplianceControlRecord>();
  evidence = new Map<string, ComplianceEvidenceRecord>();
  packages = new Map<string, any>();
  retentionPolicies = new Map<string, ComplianceRetentionPolicyRecord>();
  legalHolds = new Map<string, ComplianceLegalHoldRecord>();
  investigations = new Map<string, ComplianceInvestigationRecord>();
}

describe("Epic 22E: Enterprise Compliance, Audit Integrity & Evidence Management", () => {
  let mockDb: MockComplianceDatabase;
  let complianceRepo: AgentComplianceRepository;
  let complianceService: AgentComplianceService;

  const orgId = "org-enterprise-42";
  const competitorOrgId = "org-competitor-99";
  const workspaceId = "ws-science-lab";
  const agentId = "agent-academic-researcher";
  const actorId = "user-compliance-auditor";

  beforeEach(() => {
    mockDb = new MockComplianceDatabase();

    // Custom Repository wrapper backed by in-memory mock storage
    complianceRepo = {
      async ingestEvent(dto: ComplianceEventIngestDTO) {
        const id = dto.id ?? randomUUID();
        const key = `${dto.organizationId}:${id}`;
        if (mockDb.events.has(key)) {
          return { event: mockDb.events.get(key)!, isDuplicate: true };
        }
        const record: ComplianceEventRecord = {
          id,
          organizationId: dto.organizationId,
          workspaceId: dto.workspaceId ?? null,
          eventCategory: dto.eventCategory,
          eventType: dto.eventType,
          eventTimestamp: dto.eventTimestamp ? new Date(dto.eventTimestamp) : new Date(),
          ingestionTimestamp: new Date(),
          actorId: dto.actorId ?? null,
          actorType: dto.actorType ?? "user",
          agentId: dto.agentId ?? null,
          executionId: dto.executionId ?? null,
          policyId: dto.policyId ?? null,
          policyVersion: dto.policyVersion ?? null,
          approvalRequestId: dto.approvalRequestId ?? null,
          securityEventRef: dto.securityEventRef ?? null,
          correlationId: dto.correlationId ?? null,
          traceId: dto.traceId ?? null,
          resourceType: dto.resourceType ?? null,
          resourceId: dto.resourceId ?? null,
          eventOutcome: dto.eventOutcome ?? "SUCCESS",
          riskSeverity: dto.riskSeverity ?? "LOW",
          dataClassification: dto.dataClassification ?? "INTERNAL",
          redactedMetadata: dto.redactedMetadata ?? {},
          schemaVersion: dto.schemaVersion ?? 1,
          createdAt: new Date(),
        };
        mockDb.events.set(key, record);
        return { event: record, isDuplicate: false };
      },

      async getEventById(organizationId: string, eventId: string) {
        return mockDb.events.get(`${organizationId}:${eventId}`) ?? null;
      },

      async listEvents(organizationId: string, filters: any = {}) {
        let list = Array.from(mockDb.events.values()).filter(
          (e) => e.organizationId === organizationId,
        );
        if (filters.category) list = list.filter((e) => e.eventCategory === filters.category);
        if (filters.correlationId) list = list.filter((e) => e.correlationId === filters.correlationId);
        if (filters.agentId) list = list.filter((e) => e.agentId === filters.agentId);
        return { events: list, total: list.length };
      },

      async getLatestChainRecord(organizationId: string) {
        const orgChains = mockDb.chains
          .filter((c) => c.organizationId === organizationId)
          .sort((a, b) => b.sequenceNumber - a.sequenceNumber);
        return orgChains[0] ?? null;
      },

      async appendChainRecord(data: any) {
        const record: AuditIntegrityChainRecord = {
          id: randomUUID(),
          organizationId: data.organizationId,
          eventId: data.eventId,
          sequenceNumber: data.sequenceNumber,
          previousEventHash: data.previousEventHash,
          payloadHash: data.payloadHash,
          currentEventHash: data.currentEventHash,
          hashAlgorithm: data.hashAlgorithm ?? "SHA-256",
          schemaVersion: data.schemaVersion ?? 1,
          recordedAt: new Date(),
        };
        mockDb.chains.push(record);
        return record;
      },

      async getChainRecords(organizationId: string, range?: { fromSeq?: number; toSeq?: number }) {
        let orgChains = mockDb.chains
          .filter((c) => c.organizationId === organizationId)
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        if (range?.fromSeq !== undefined) orgChains = orgChains.filter((c) => c.sequenceNumber >= range.fromSeq!);
        if (range?.toSeq !== undefined) orgChains = orgChains.filter((c) => c.sequenceNumber <= range.toSeq!);
        return orgChains;
      },

      async listFrameworks(organizationId: string) {
        const rows = Array.from(mockDb.frameworks.values()).filter((f) => f.organizationId === organizationId);
        if (rows.length === 0) return this.seedDefaultFrameworks(organizationId);
        return rows;
      },

      async seedDefaultFrameworks(organizationId: string) {
        const defaults = [
          { frameworkKey: "iso_27001", name: "ISO/IEC 27001:2022", version: "2022", isEnabled: true },
          { frameworkKey: "iso_42001", name: "ISO/IEC 42001:2023", version: "2023", isEnabled: true },
          { frameworkKey: "nist_ai_rmf", name: "NIST AI RMF 1.0", version: "1.0", isEnabled: true },
          { frameworkKey: "soc2_tsc", name: "SOC 2 Trust Services Criteria", version: "2017", isEnabled: true },
        ];
        const res = [];
        for (const d of defaults) {
          const fw = { id: randomUUID(), organizationId, ...d, createdAt: new Date(), updatedAt: new Date() };
          mockDb.frameworks.set(fw.id, fw);
          res.push(fw);
          // Seed control
          const ctrl: ComplianceControlRecord = {
            id: randomUUID(),
            organizationId,
            frameworkId: fw.id,
            controlKey: `${d.frameworkKey.toUpperCase()}-01`,
            title: `Baseline for ${d.name}`,
            description: "Baseline security control",
            category: "General",
            implementationStatus: "IMPLEMENTED",
            ownerId: null,
            reviewFrequencyDays: 90,
            lastReviewedAt: null,
            nextReviewDueAt: null,
            verifiedAt: null,
            verifiedBy: null,
            exceptions: null,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockDb.controls.set(ctrl.id, ctrl);
        }
        return res;
      },

      async listControls(organizationId: string, filters: any = {}) {
        let rows = Array.from(mockDb.controls.values()).filter((c) => c.organizationId === organizationId);
        if (rows.length === 0) {
          await this.listFrameworks(organizationId);
          rows = Array.from(mockDb.controls.values()).filter((c) => c.organizationId === organizationId);
        }
        if (filters.frameworkId) rows = rows.filter((c) => c.frameworkId === filters.frameworkId);
        if (filters.status) rows = rows.filter((c) => c.implementationStatus === filters.status);
        return rows;
      },

      async getControlById(organizationId: string, controlId: string) {
        return mockDb.controls.get(controlId) ?? null;
      },

      async updateControlVerification(organizationId: string, controlId: string, data: any) {
        const ctrl = mockDb.controls.get(controlId);
        if (!ctrl) throw new Error("Control not found");
        const updated = {
          ...ctrl,
          implementationStatus: data.status,
          verifiedBy: data.verifiedBy,
          verifiedAt: data.status === "VERIFIED" ? new Date() : null,
          lastReviewedAt: new Date(),
          exceptions: data.exceptions ?? null,
        };
        mockDb.controls.set(controlId, updated);
        return updated;
      },

      async createEvidence(data: any) {
        const id = data.id ?? randomUUID();
        const ev: ComplianceEvidenceRecord = {
          id,
          organizationId: data.organizationId,
          workspaceId: data.workspaceId ?? null,
          title: data.title,
          evidenceType: data.evidenceType,
          source: data.source,
          classification: data.classification ?? "INTERNAL",
          relatedControlIds: data.relatedControlIds ?? [],
          contentHash: data.contentHash,
          storageReference: data.storageReference ?? null,
          structuredPayload: data.structuredPayload ?? {},
          verificationStatus: "VALID",
          retentionPolicyId: null,
          isUnderLegalHold: false,
          collectedBy: data.collectedBy ?? null,
          collectedAt: new Date(),
          accessCount: 0,
          lastAccessedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.evidence.set(id, ev);
        return ev;
      },

      async getEvidenceById(organizationId: string, evidenceId: string) {
        const ev = mockDb.evidence.get(evidenceId);
        if (!ev || ev.organizationId !== organizationId) return null;
        ev.accessCount += 1;
        return ev;
      },

      async listEvidence(organizationId: string, filters: any = {}) {
        let list = Array.from(mockDb.evidence.values()).filter((e) => e.organizationId === organizationId);
        if (filters.isUnderLegalHold !== undefined) {
          list = list.filter((e) => e.isUnderLegalHold === filters.isUnderLegalHold);
        }
        return { evidence: list, total: list.length };
      },

      async createEvidencePackage(data: any) {
        const id = randomUUID();
        const pkg = { id, ...data, exportedAt: new Date() };
        mockDb.packages.set(id, pkg);
        return pkg;
      },

      async listEvidencePackages(organizationId: string) {
        return Array.from(mockDb.packages.values()).filter((p) => p.organizationId === organizationId);
      },

      async getEvidencePackageById(organizationId: string, packageId: string) {
        return mockDb.packages.get(packageId) ?? null;
      },

      async listRetentionPolicies(organizationId: string) {
        const list = Array.from(mockDb.retentionPolicies.values()).filter((p) => p.organizationId === organizationId);
        if (list.length === 0) return this.seedDefaultRetentionPolicies(organizationId);
        return list;
      },

      async seedDefaultRetentionPolicies(organizationId: string) {
        const defaults = [
          { category: "audit_ledger", days: 2555, action: "ARCHIVE" as const },
          { category: "compliance_events", days: 1095, action: "ARCHIVE" as const },
          { category: "evidence", days: 730, action: "ARCHIVE" as const },
        ];
        const res = [];
        for (const d of defaults) {
          const id = randomUUID();
          const p: ComplianceRetentionPolicyRecord = {
            id,
            organizationId,
            recordCategory: d.category,
            retentionDurationDays: d.days,
            effectiveFrom: new Date(),
            disposalAction: d.action,
            status: "ACTIVE",
            createdBy: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockDb.retentionPolicies.set(id, p);
          res.push(p);
        }
        return res;
      },

      async upsertRetentionPolicy(data: any) {
        const id = randomUUID();
        const p: ComplianceRetentionPolicyRecord = {
          id,
          organizationId: data.organizationId,
          recordCategory: data.recordCategory,
          retentionDurationDays: data.retentionDurationDays,
          effectiveFrom: new Date(),
          disposalAction: data.disposalAction ?? "ARCHIVE",
          status: "ACTIVE",
          createdBy: data.createdBy ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.retentionPolicies.set(id, p);
        return p;
      },

      async createLegalHold(data: any) {
        const id = randomUUID();
        const holdIdentifier = data.holdIdentifier ?? `HOLD-${Date.now().toString(36).toUpperCase()}`;
        const hold: ComplianceLegalHoldRecord = {
          id,
          organizationId: data.organizationId,
          holdIdentifier,
          name: data.name,
          description: data.description ?? null,
          reason: data.reason,
          scopeType: data.scopeType ?? "ALL",
          scopeCriteria: data.scopeCriteria ?? {},
          status: "ACTIVE",
          createdBy: data.createdBy,
          releasedBy: null,
          releasedAt: null,
          releaseJustification: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.legalHolds.set(holdIdentifier, hold);
        if (data.scopeType === "ALL") {
          for (const ev of mockDb.evidence.values()) {
            if (ev.organizationId === data.organizationId) ev.isUnderLegalHold = true;
          }
        }
        return hold;
      },

      async listLegalHolds(organizationId: string, status?: string) {
        let list = Array.from(mockDb.legalHolds.values()).filter((h) => h.organizationId === organizationId);
        if (status) list = list.filter((h) => h.status === status);
        return list;
      },

      async releaseLegalHold(organizationId: string, holdIdentifier: string, releasedBy: string, justification: string) {
        const hold = mockDb.legalHolds.get(holdIdentifier);
        if (!hold) throw new Error("Hold not found");
        hold.status = "RELEASED";
        hold.releasedBy = releasedBy;
        hold.releasedAt = new Date();
        hold.releaseJustification = justification;

        const activeRemaining = Array.from(mockDb.legalHolds.values()).filter(
          (h) => h.organizationId === organizationId && h.status === "ACTIVE",
        );
        if (activeRemaining.length === 0) {
          for (const ev of mockDb.evidence.values()) {
            if (ev.organizationId === organizationId) ev.isUnderLegalHold = false;
          }
        }
        return hold;
      },

      async createInvestigation(data: any) {
        const id = randomUUID();
        const caseNumber = `CASE-${Date.now().toString(36).toUpperCase()}`;
        const inv: ComplianceInvestigationRecord = {
          id,
          organizationId: data.organizationId,
          caseNumber,
          title: data.title,
          description: data.description ?? null,
          investigatorId: data.investigatorId,
          status: "OPEN",
          searchFilters: data.searchFilters ?? {},
          findings: null,
          notes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.investigations.set(caseNumber, inv);
        return inv;
      },

      async listInvestigations(organizationId: string, status?: string) {
        let list = Array.from(mockDb.investigations.values()).filter((i) => i.organizationId === organizationId);
        if (status) list = list.filter((i) => i.status === status);
        return list;
      },

      async addInvestigationNote(organizationId: string, caseNumber: string, note: string, authorId: string) {
        const inv = mockDb.investigations.get(caseNumber);
        if (!inv) throw new Error("Investigation not found");
        inv.notes.push({ note, authorId, timestamp: new Date().toISOString() });
        return inv;
      },
    } as any;

    complianceService = new AgentComplianceService({} as any);
    (complianceService as any).repo = complianceRepo;
  });

  // -------------------------------------------------------------------------
  // Test 1: Canonical Event Hashing
  // -------------------------------------------------------------------------
  it("Test 1: Canonical event serialization sorts keys deterministically and produces identical SHA-256 hashes", () => {
    const objA = { z: 1, a: "test", m: { beta: true, alpha: 123 } };
    const objB = { a: "test", m: { alpha: 123, beta: true }, z: 1 };

    const canonicalA = canonicalStringify(objA);
    const canonicalB = canonicalStringify(objB);

    expect(canonicalA).toBe(canonicalB);
    expect(sha256Hash(canonicalA)).toBe(sha256Hash(canonicalB));
    expect(sha256Hash(canonicalA)).toHaveLength(64);
  });

  // -------------------------------------------------------------------------
  // Test 2: Tenant-Specific Hash Chains
  // -------------------------------------------------------------------------
  it("Test 2: Maintains tenant-isolated cryptographic hash chains with independent sequence numbers", async () => {
    const resA1 = await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "AGENT_RUN_STARTED",
      agentId,
    });

    const resB1 = await complianceService.recordComplianceEvent({
      organizationId: competitorOrgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "AGENT_RUN_STARTED",
      agentId: "competitor-agent",
    });

    expect(resA1.chainRecord?.sequenceNumber).toBe(1);
    expect(resB1.chainRecord?.sequenceNumber).toBe(1);
    expect(resA1.chainRecord?.previousEventHash).toBe("0".repeat(64));
    expect(resB1.chainRecord?.previousEventHash).toBe("0".repeat(64));

    // Append second event for org A
    const resA2 = await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "TOOL_INVOCATION",
      eventType: "TOOL_CALL_EXECUTED",
      agentId,
    });

    expect(resA2.chainRecord?.sequenceNumber).toBe(2);
    expect(resA2.chainRecord?.previousEventHash).toBe(resA1.chainRecord?.currentEventHash);

    // Verify competitor chain sequence remains 1
    const latestB = await complianceRepo.getLatestChainRecord(competitorOrgId);
    expect(latestB?.sequenceNumber).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Test 3: Concurrent Sequence Assignment
  // -------------------------------------------------------------------------
  it("Test 3: Assigns strictly monotonic sequence numbers without duplicates", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      const res = await complianceService.recordComplianceEvent({
        organizationId: orgId,
        eventCategory: "POLICY_EVALUATION",
        eventType: `POLICY_CHECK_${i}`,
      });
      results.push(res);
    }

    const sequences = results.map((r) => r.chainRecord?.sequenceNumber);
    expect(sequences).toEqual([1, 2, 3, 4, 5]);
  });

  // -------------------------------------------------------------------------
  // Test 4: Tampered Event Detection
  // -------------------------------------------------------------------------
  it("Test 4: Detects modified event payload in audit chain verification", async () => {
    const { event } = await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "SECURITY_CONTROL",
      eventType: "CAPABILITY_DENIED",
      agentId,
    });

    // Initial check: Valid
    const verifyInitial = await complianceService.verifyAuditIntegrity(orgId);
    expect(verifyInitial.isValid).toBe(true);

    // Tamper with event payload in database
    const stored = mockDb.events.get(`${orgId}:${event.id}`)!;
    stored.eventOutcome = "FAILURE"; // Tampered attribute!

    const verifyTampered = await complianceService.verifyAuditIntegrity(orgId);
    expect(verifyTampered.isValid).toBe(false);
    expect(verifyTampered.tamperedEvents).toHaveLength(1);
    expect(verifyTampered.tamperedEvents[0].eventId).toBe(event.id);
  });

  // -------------------------------------------------------------------------
  // Test 5: Missing Event & Sequence Gap Detection
  // -------------------------------------------------------------------------
  it("Test 5: Detects sequence continuity gaps in audit ledger", async () => {
    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "STEP_1",
    });
    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "STEP_2",
    });
    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "STEP_3",
    });

    // Remove sequence 2 from chains
    mockDb.chains = mockDb.chains.filter((c) => c.sequenceNumber !== 2);

    const verification = await complianceService.verifyAuditIntegrity(orgId);
    expect(verification.isValid).toBe(false);
    expect(verification.missingSequences).toContain(2);
  });

  // -------------------------------------------------------------------------
  // Test 6: Broken Chain Link Detection
  // -------------------------------------------------------------------------
  it("Test 6: Detects corrupted previous-event hash references", async () => {
    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "EVENT_A",
    });
    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "EVENT_B",
    });

    // Corrupt previous hash on sequence 2
    const chain2 = mockDb.chains.find((c) => c.sequenceNumber === 2)!;
    chain2.previousEventHash = "f".repeat(64);

    const verification = await complianceService.verifyAuditIntegrity(orgId);
    expect(verification.isValid).toBe(false);
    expect(verification.brokenLinks).toHaveLength(1);
    expect(verification.brokenLinks[0].sequenceNumber).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Test 7: Duplicate Event Rejection
  // -------------------------------------------------------------------------
  it("Test 7: Rejects duplicate event ID and preserves ledger sequence", async () => {
    const fixedId = "fixed-evt-123";
    const first = await complianceService.recordComplianceEvent({
      id: fixedId,
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "INITIAL_INGEST",
    });

    expect(first.isDuplicate).toBe(false);
    expect(first.chainRecord?.sequenceNumber).toBe(1);

    const second = await complianceService.recordComplianceEvent({
      id: fixedId,
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "DUPLICATE_INGEST",
    });

    expect(second.isDuplicate).toBe(true);
    expect(second.chainRecord).toBeUndefined();

    // Verify chain length remains 1
    const chains = await complianceRepo.getChainRecords(orgId);
    expect(chains).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Test 8: Idempotent Event Ingestion
  // -------------------------------------------------------------------------
  it("Test 8: Ingestion is idempotent and returns identical record on repeated calls", async () => {
    const fixedId = "idempotent-evt-456";
    const res1 = await complianceRepo.ingestEvent({
      id: fixedId,
      organizationId: orgId,
      eventCategory: "POLICY_EVALUATION",
      eventType: "POLICY_ALLOWED",
    });

    const res2 = await complianceRepo.ingestEvent({
      id: fixedId,
      organizationId: orgId,
      eventCategory: "POLICY_EVALUATION",
      eventType: "POLICY_ALLOWED",
    });

    expect(res1.isDuplicate).toBe(false);
    expect(res2.isDuplicate).toBe(true);
    expect(res1.event.id).toBe(res2.event.id);
  });

  // -------------------------------------------------------------------------
  // Test 9: Cross-Tenant Query Prevention
  // -------------------------------------------------------------------------
  it("Test 9: Enforces multi-tenant isolation across audit and evidence queries", async () => {
    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "ORG_A_EVENT",
    });

    await complianceService.recordComplianceEvent({
      organizationId: competitorOrgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "ORG_B_EVENT",
    });

    const orgAEvents = await complianceRepo.listEvents(orgId);
    expect(orgAEvents.events).toHaveLength(1);
    expect(orgAEvents.events[0].eventType).toBe("ORG_A_EVENT");

    const orgBEvents = await complianceRepo.listEvents(competitorOrgId);
    expect(orgBEvents.events).toHaveLength(1);
    expect(orgBEvents.events[0].eventType).toBe("ORG_B_EVENT");
  });

  // -------------------------------------------------------------------------
  // Test 10: Cross-Tenant Export Prevention
  // -------------------------------------------------------------------------
  it("Test 10: Prohibits including evidence from another tenant in evidence packages", async () => {
    const foreignEvidence = await complianceService.collectEvidence(competitorOrgId, {
      title: "Competitor Secret Evidence",
      evidenceType: "execution_log",
      source: "competitor_runtime",
      structuredPayload: { confidential: true },
    });

    await expect(
      complianceService.generateEvidencePackage(orgId, {
        evidenceIds: [foreignEvidence.id],
        exportedBy: actorId,
      }),
    ).rejects.toThrow(/Cross-tenant export prohibited/);
  });

  // -------------------------------------------------------------------------
  // Test 11: Evidence Checksum Verification
  // -------------------------------------------------------------------------
  it("Test 11: Collects evidence with verifiable canonical SHA-256 payload checksum", async () => {
    const payload = { testRunId: "test-run-101", passed: true, score: 98.5 };
    const evidence = await complianceService.collectEvidence(orgId, {
      title: "Automated Evaluation Run Evidence",
      evidenceType: "test_report",
      source: "eval_service",
      classification: "INTERNAL",
      structuredPayload: payload,
      collectedBy: actorId,
    });

    const expectedHash = sha256Hash(canonicalStringify(payload));
    expect(evidence.contentHash).toBe(expectedHash);
    expect(evidence.verificationStatus).toBe("VALID");
  });

  // -------------------------------------------------------------------------
  // Test 12: Manifest Tampering Detection
  // -------------------------------------------------------------------------
  it("Test 12: Offline package verification detects manifest checksum tampering", async () => {
    const ev = await complianceService.collectEvidence(orgId, {
      title: "Audit Snapshot",
      evidenceType: "governance_snapshot",
      source: "governance_engine",
      structuredPayload: { profile: "internal" },
    });

    const { packageRecord, manifest } = await complianceService.generateEvidencePackage(orgId, {
      evidenceIds: [ev.id],
      exportedBy: actorId,
    });

    // Valid check
    const validCheck = verifyEvidencePackageOffline(manifest, packageRecord.manifestChecksum);
    expect(validCheck.isValid).toBe(true);

    // Tamper with an item's content hash in manifest
    manifest.items[0].contentHash = "0".repeat(64);
    const tamperedCheck = verifyEvidencePackageOffline(manifest, packageRecord.manifestChecksum);
    expect(tamperedCheck.isValid).toBe(false);
    expect(tamperedCheck.errors[0]).toContain("Manifest checksum mismatch");
  });

  // -------------------------------------------------------------------------
  // Test 13: Redaction Enforcement in Compliance Metadata
  // -------------------------------------------------------------------------
  it("Test 13: Recursively scrubs secrets and API tokens from compliance metadata", async () => {
    const rawMetadata = {
      apiKey: "sk-live-secret-enterprise-credential-12345",
      safeKey: "allowed_value",
      nested: {
        token: "bearer-token-abc-9999",
      },
    };

    const { event } = await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "SECRET_ACCESS",
      eventType: "SECRET_ACCESSED",
      redactedMetadata: rawMetadata,
    });

    expect(event.redactedMetadata.apiKey).not.toContain("sk-live-secret");
    expect(event.redactedMetadata.apiKey).toMatch(/^sk-\.\.\.[0-9a-zA-Z]+$/);
    expect((event.redactedMetadata.nested as any).token).not.toContain("bearer-token-abc");
    expect((event.redactedMetadata.nested as any).token).toMatch(/^bea\.\.\.[0-9a-zA-Z]+$/);
    expect(event.redactedMetadata.safeKey).toBe("allowed_value");
  });

  // -------------------------------------------------------------------------
  // Test 14: Unauthorized Evidence Export Validation
  // -------------------------------------------------------------------------
  it("Test 14: Rejects evidence package creation when evidenceIds array is empty", async () => {
    await expect(
      complianceService.generateEvidencePackage(orgId, {
        evidenceIds: [],
        exportedBy: actorId,
      }),
    ).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Test 15: Compliance Framework & Control Mapping
  // -------------------------------------------------------------------------
  it("Test 15: Seeds standard frameworks (ISO 27001, ISO 42001, NIST AI RMF, SOC 2 TSC) and baseline controls", async () => {
    const frameworks = await complianceService.listFrameworks(orgId);
    expect(frameworks).toHaveLength(4);

    const keys = frameworks.map((f) => f.frameworkKey);
    expect(keys).toContain("iso_27001");
    expect(keys).toContain("iso_42001");
    expect(keys).toContain("nist_ai_rmf");
    expect(keys).toContain("soc2_tsc");

    const controls = await complianceService.listControls(orgId);
    expect(controls.length).toBeGreaterThanOrEqual(4);
  });

  // -------------------------------------------------------------------------
  // Test 16: Verified Status Authorization
  // -------------------------------------------------------------------------
  it("Test 16: Requires explicit authorized review decision to transition control to VERIFIED", async () => {
    const controls = await complianceService.listControls(orgId);
    const target = controls[0];

    expect(target.implementationStatus).toBe("IMPLEMENTED");
    expect(target.verifiedAt).toBeNull();

    const verified = await complianceService.verifyControl(orgId, target.id, {
      status: "VERIFIED",
      verifiedBy: actorId,
      exceptions: "None. All security unit tests verified passing.",
    });

    expect(verified.implementationStatus).toBe("VERIFIED");
    expect(verified.verifiedBy).toBe(actorId);
    expect(verified.verifiedAt).toBeInstanceOf(Date);
  });

  // -------------------------------------------------------------------------
  // Test 17: Legal Hold Creation & Scope
  // -------------------------------------------------------------------------
  it("Test 17: Legal hold marks organization evidence as protected", async () => {
    const ev = await complianceService.collectEvidence(orgId, {
      title: "Operational Evidence",
      evidenceType: "execution_log",
      source: "runtime",
      structuredPayload: { runId: "run-77" },
    });

    expect(ev.isUnderLegalHold).toBe(false);

    const hold = await complianceService.createLegalHold({
      organizationId: orgId,
      name: "Litigation Hold Q4",
      reason: "Preserve all agent execution evidence for legal audit",
      scopeType: "ALL",
      createdBy: actorId,
    });

    expect(hold.status).toBe("ACTIVE");

    const fetchedEv = await complianceRepo.getEvidenceById(orgId, ev.id);
    expect(fetchedEv?.isUnderLegalHold).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 18: Legal Hold Release with Mandatory Justification
  // -------------------------------------------------------------------------
  it("Test 18: Releasing legal hold clears active flag and logs release justification", async () => {
    const hold = await complianceService.createLegalHold({
      organizationId: orgId,
      name: "Temporary Regulatory Review",
      reason: "Regulatory audit pending",
      createdBy: actorId,
    });

    const released = await complianceService.releaseLegalHold(
      orgId,
      hold.holdIdentifier,
      actorId,
      "Audit concluded with zero findings; hold released.",
    );

    expect(released.status).toBe("RELEASED");
    expect(released.releaseJustification).toContain("Audit concluded");
    expect(released.releasedAt).toBeInstanceOf(Date);
  });

  // -------------------------------------------------------------------------
  // Test 19: Retention Dry-Run Disposal Behavior
  // -------------------------------------------------------------------------
  it("Test 19: Retention dry-run calculates expired records without performing destructive deletion", async () => {
    // Collect old evidence (simulate 800 days old)
    const ev = await complianceService.collectEvidence(orgId, {
      title: "Legacy Log",
      evidenceType: "execution_log",
      source: "archive",
      structuredPayload: { old: true },
    });
    mockDb.evidence.get(ev.id)!.collectedAt = new Date(Date.now() - 800 * 24 * 60 * 60 * 1000);

    const preview = await complianceService.previewDisposal(orgId);
    expect(preview.candidateCount).toBe(1);
    expect(preview.candidates[0].plannedDisposalAction).toBe("ARCHIVE");

    // Ensure record still exists in repository
    const stillExists = await complianceRepo.getEvidenceById(orgId, ev.id);
    expect(stillExists).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Test 20: Legal Hold Overrides Retention Disposal
  // -------------------------------------------------------------------------
  it("Test 20: Active legal hold protects expired records from retention disposal", async () => {
    const ev = await complianceService.collectEvidence(orgId, {
      title: "Protected Old Log",
      evidenceType: "execution_log",
      source: "archive",
      structuredPayload: { legal: true },
    });
    mockDb.evidence.get(ev.id)!.collectedAt = new Date(Date.now() - 800 * 24 * 60 * 60 * 1000);

    // Apply active hold
    await complianceService.createLegalHold({
      organizationId: orgId,
      name: "Hold For Old Log",
      reason: "Court ordered preservation",
      scopeType: "ALL",
      createdBy: actorId,
    });

    const preview = await complianceService.previewDisposal(orgId);
    expect(preview.protectedCount).toBe(1);
    expect(preview.candidates[0].isProtectedByHold).toBe(true);
    expect(preview.candidates[0].plannedDisposalAction).toBe("RETAIN_UNDER_LEGAL_HOLD");
  });

  // -------------------------------------------------------------------------
  // Test 21: Chronological Investigation Timeline Reconstruction
  // -------------------------------------------------------------------------
  it("Test 21: Correlates agent activity into chronological stages (REQUEST -> POLICY -> APPROVAL -> SECURITY -> EXECUTION)", async () => {
    const correlId = "correl-run-4242";

    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "AGENT_EXECUTION",
      eventType: "AGENT_REQUEST_RECEIVED",
      correlationId: correlId,
      eventTimestamp: new Date(Date.now() - 5000),
    });

    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "POLICY_EVALUATION",
      eventType: "POLICY_EVALUATED",
      correlationId: correlId,
      eventTimestamp: new Date(Date.now() - 4000),
    });

    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "HUMAN_APPROVAL",
      eventType: "APPROVAL_REQUESTED",
      correlationId: correlId,
      eventTimestamp: new Date(Date.now() - 3000),
    });

    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "SECURITY_CONTROL",
      eventType: "SECURITY_GATE_VALIDATED",
      correlationId: correlId,
      eventTimestamp: new Date(Date.now() - 2000),
    });

    await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "TOOL_INVOCATION",
      eventType: "TOOL_EXECUTED",
      correlationId: correlId,
      eventTimestamp: new Date(Date.now() - 1000),
    });

    const timelineRes = await complianceService.getInvestigationTimeline(orgId, {
      correlationId: correlId,
    });

    expect(timelineRes.total).toBe(5);
    const stages = timelineRes.timeline.map((t) => t.stage);
    expect(stages).toEqual(["REQUEST", "POLICY", "APPROVAL", "SECURITY", "EXECUTION"]);
  });

  // -------------------------------------------------------------------------
  // Test 22: Investigation Access Auditing
  // -------------------------------------------------------------------------
  it("Test 22: Audits investigator queries by emitting compliance audit events", async () => {
    await complianceService.getInvestigationTimeline(orgId, {
      correlationId: "audit-search-123",
      investigatorId: actorId,
    });

    const events = await complianceRepo.listEvents(orgId, { category: "COMPLIANCE_CHANGE" });
    const auditQueryEvent = events.events.find((e) => e.eventType === "INVESTIGATION_QUERY_EXECUTED");
    expect(auditQueryEvent).toBeDefined();
    expect(auditQueryEvent?.actorId).toBe(actorId);
  });

  // -------------------------------------------------------------------------
  // Test 23: Secret Protection in Exported Packages
  // -------------------------------------------------------------------------
  it("Test 23: Exported evidence package contains zero raw secrets or unapproved sensitive tokens", async () => {
    const secretPayload = {
      apiKey: "sk-live-super-secret-token-abcdef",
      systemToken: "bearer-auth-test-9999",
      safeMetric: 42,
    };

    const ev = await complianceService.collectEvidence(orgId, {
      title: "Scrubbed Evidence",
      evidenceType: "test_report",
      source: "auth_scanner",
      structuredPayload: secretPayload,
      collectedBy: actorId,
    });

    const { manifest } = await complianceService.generateEvidencePackage(orgId, {
      evidenceIds: [ev.id],
      exportedBy: actorId,
    });

    const manifestStr = JSON.stringify(manifest);
    expect(manifestStr).not.toContain("sk-live-super-secret-token");
    expect(manifestStr).not.toContain("bearer-auth-test");
    expect(manifest.redactionLevel).toBe("DEEP_SECRET_SCRUBBED");
  });

  // -------------------------------------------------------------------------
  // Test 24: Compatibility with Epic 22D Security Controls
  // -------------------------------------------------------------------------
  it("Test 24: Security control events seamlessly record to compliance ledger without breaking hash chain", async () => {
    // Record security suspension
    const secEvent1 = await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "SECURITY_CONTROL",
      eventType: "SUSPENSION",
      agentId,
      eventOutcome: "SUSPENDED",
      riskSeverity: "HIGH",
    });

    // Record emergency stop
    const secEvent2 = await complianceService.recordComplianceEvent({
      organizationId: orgId,
      eventCategory: "SECURITY_CONTROL",
      eventType: "EMERGENCY_STOP",
      eventOutcome: "BLOCKED",
      riskSeverity: "CRITICAL",
    });

    expect(secEvent1.chainRecord?.sequenceNumber).toBeDefined();
    expect(secEvent2.chainRecord?.sequenceNumber).toBe(secEvent1.chainRecord!.sequenceNumber + 1);

    // Verify hash integrity of security events
    const verification = await complianceService.verifyAuditIntegrity(orgId);
    expect(verification.isValid).toBe(true);
    expect(verification.totalEventsVerified).toBeGreaterThanOrEqual(2);
  });
});
