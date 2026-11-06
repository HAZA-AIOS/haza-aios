import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  agentAuditIntegrityChains,
  agentComplianceControls,
  agentComplianceEvents,
  agentComplianceEvidence,
  agentComplianceEvidencePackages,
  agentComplianceFrameworks,
  agentComplianceInvestigations,
  agentComplianceLegalHolds,
  agentComplianceRetentionPolicies,
} from "../../../database/schema.js";
import type {
  AuditIntegrityChainRecord,
  ComplianceControlRecord,
  ComplianceControlStatus,
  ComplianceDataClassification,
  ComplianceEventCategory,
  ComplianceEventIngestDTO,
  ComplianceEventOutcome,
  ComplianceEventRecord,
  ComplianceEvidenceRecord,
  ComplianceEvidenceType,
  ComplianceFrameworkRecord,
  ComplianceInvestigationRecord,
  ComplianceLegalHoldRecord,
  ComplianceRetentionPolicyRecord,
  ComplianceRiskSeverity,
  EvidencePackageManifest,
  EvidencePackageRecord,
  InvestigationStatus,
  LegalHoldStatus,
} from "../compliance.types.js";

export class AgentComplianceRepository {
  constructor(private readonly db: MySql2Database<any>) {}

  // -------------------------------------------------------------------------
  // 1. Compliance Events & Audit Ingestion
  // -------------------------------------------------------------------------

  async ingestEvent(dto: ComplianceEventIngestDTO): Promise<{
    event: ComplianceEventRecord;
    isDuplicate: boolean;
  }> {
    const eventId = dto.id ?? randomUUID();

    // Idempotency check: see if event with this ID already exists
    const existing = await this.db
      .select()
      .from(agentComplianceEvents)
      .where(
        and(
          eq(agentComplianceEvents.organizationId, dto.organizationId),
          eq(agentComplianceEvents.id, eventId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        event: this.mapEventRecord(existing[0]),
        isDuplicate: true,
      };
    }

    const eventTimestamp = dto.eventTimestamp
      ? new Date(dto.eventTimestamp)
      : new Date();

    const insertData = {
      id: eventId,
      organizationId: dto.organizationId,
      workspaceId: dto.workspaceId ?? null,
      eventCategory: dto.eventCategory,
      eventType: dto.eventType,
      eventTimestamp,
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

    await this.db.insert(agentComplianceEvents).values(insertData);

    return {
      event: this.mapEventRecord(insertData),
      isDuplicate: false,
    };
  }

  async getEventById(
    organizationId: string,
    eventId: string,
  ): Promise<ComplianceEventRecord | null> {
    const rows = await this.db
      .select()
      .from(agentComplianceEvents)
      .where(
        and(
          eq(agentComplianceEvents.organizationId, organizationId),
          eq(agentComplianceEvents.id, eventId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapEventRecord(rows[0]);
  }

  async listEvents(
    organizationId: string,
    filters: {
      workspaceId?: string;
      category?: ComplianceEventCategory;
      eventType?: string;
      agentId?: string;
      actorId?: string;
      correlationId?: string;
      traceId?: string;
      outcome?: ComplianceEventOutcome;
      severity?: ComplianceRiskSeverity;
      fromTimestamp?: Date;
      toTimestamp?: Date;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ events: ComplianceEventRecord[]; total: number }> {
    const conditions = [eq(agentComplianceEvents.organizationId, organizationId)];

    if (filters.workspaceId) {
      conditions.push(eq(agentComplianceEvents.workspaceId, filters.workspaceId));
    }
    if (filters.category) {
      conditions.push(eq(agentComplianceEvents.eventCategory, filters.category));
    }
    if (filters.eventType) {
      conditions.push(eq(agentComplianceEvents.eventType, filters.eventType));
    }
    if (filters.agentId) {
      conditions.push(eq(agentComplianceEvents.agentId, filters.agentId));
    }
    if (filters.actorId) {
      conditions.push(eq(agentComplianceEvents.actorId, filters.actorId));
    }
    if (filters.correlationId) {
      conditions.push(eq(agentComplianceEvents.correlationId, filters.correlationId));
    }
    if (filters.traceId) {
      conditions.push(eq(agentComplianceEvents.traceId, filters.traceId));
    }
    if (filters.outcome) {
      conditions.push(eq(agentComplianceEvents.eventOutcome, filters.outcome));
    }
    if (filters.severity) {
      conditions.push(eq(agentComplianceEvents.riskSeverity, filters.severity));
    }
    if (filters.fromTimestamp) {
      conditions.push(gte(agentComplianceEvents.eventTimestamp, filters.fromTimestamp));
    }
    if (filters.toTimestamp) {
      conditions.push(lte(agentComplianceEvents.eventTimestamp, filters.toTimestamp));
    }

    const whereClause = and(...conditions);

    const countRes = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(agentComplianceEvents)
      .where(whereClause);
    const total = Number(countRes[0]?.count ?? 0);

    const rows = await this.db
      .select()
      .from(agentComplianceEvents)
      .where(whereClause)
      .orderBy(desc(agentComplianceEvents.eventTimestamp))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);

    return {
      events: rows.map((r) => this.mapEventRecord(r)),
      total,
    };
  }

  // -------------------------------------------------------------------------
  // 2. Audit Integrity Chain
  // -------------------------------------------------------------------------

  async getLatestChainRecord(
    organizationId: string,
  ): Promise<AuditIntegrityChainRecord | null> {
    const rows = await this.db
      .select()
      .from(agentAuditIntegrityChains)
      .where(eq(agentAuditIntegrityChains.organizationId, organizationId))
      .orderBy(desc(agentAuditIntegrityChains.sequenceNumber))
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapChainRecord(rows[0]);
  }

  async appendChainRecord(data: {
    organizationId: string;
    eventId: string;
    sequenceNumber: number;
    previousEventHash: string;
    payloadHash: string;
    currentEventHash: string;
    hashAlgorithm?: string;
    schemaVersion?: number;
  }): Promise<AuditIntegrityChainRecord> {
    const id = randomUUID();
    const insertData = {
      id,
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

    await this.db.insert(agentAuditIntegrityChains).values(insertData);
    return this.mapChainRecord(insertData);
  }

  async getChainRecords(
    organizationId: string,
    range?: { fromSeq?: number; toSeq?: number },
  ): Promise<AuditIntegrityChainRecord[]> {
    const conditions = [eq(agentAuditIntegrityChains.organizationId, organizationId)];

    if (range?.fromSeq !== undefined) {
      conditions.push(gte(agentAuditIntegrityChains.sequenceNumber, range.fromSeq));
    }
    if (range?.toSeq !== undefined) {
      conditions.push(lte(agentAuditIntegrityChains.sequenceNumber, range.toSeq));
    }

    const rows = await this.db
      .select()
      .from(agentAuditIntegrityChains)
      .where(and(...conditions))
      .orderBy(agentAuditIntegrityChains.sequenceNumber);

    return rows.map((r) => this.mapChainRecord(r));
  }

  // -------------------------------------------------------------------------
  // 3. Compliance Frameworks & Controls
  // -------------------------------------------------------------------------

  async listFrameworks(organizationId: string): Promise<ComplianceFrameworkRecord[]> {
    const rows = await this.db
      .select()
      .from(agentComplianceFrameworks)
      .where(eq(agentComplianceFrameworks.organizationId, organizationId));

    if (rows.length === 0) {
      // Seed default industry frameworks for this organization
      return this.seedDefaultFrameworks(organizationId);
    }

    return rows.map((r) => this.mapFrameworkRecord(r));
  }

  async getFrameworkByKey(
    organizationId: string,
    frameworkKey: string,
  ): Promise<ComplianceFrameworkRecord | null> {
    const rows = await this.db
      .select()
      .from(agentComplianceFrameworks)
      .where(
        and(
          eq(agentComplianceFrameworks.organizationId, organizationId),
          eq(agentComplianceFrameworks.frameworkKey, frameworkKey),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapFrameworkRecord(rows[0]);
  }

  async seedDefaultFrameworks(
    organizationId: string,
  ): Promise<ComplianceFrameworkRecord[]> {
    const defaults = [
      {
        frameworkKey: "iso_27001",
        name: "ISO/IEC 27001:2022",
        version: "2022",
        description:
          "Information Security Management System requirements for organizational cybersecurity and data protection.",
      },
      {
        frameworkKey: "iso_42001",
        name: "ISO/IEC 42001:2023",
        version: "2023",
        description:
          "Artificial Intelligence Management System standard for ethical, transparent, and trustworthy AI governance.",
      },
      {
        frameworkKey: "nist_ai_rmf",
        name: "NIST AI RMF 1.0",
        version: "1.0",
        description:
          "NIST Artificial Intelligence Risk Management Framework (Govern, Map, Measure, Manage functions).",
      },
      {
        frameworkKey: "soc2_tsc",
        name: "SOC 2 Trust Services Criteria",
        version: "2017",
        description:
          "AICPA Trust Services Criteria covering Security, Availability, Confidentiality, and Processing Integrity.",
      },
    ];

    const results: ComplianceFrameworkRecord[] = [];
    for (const d of defaults) {
      const id = randomUUID();
      const insert = {
        id,
        organizationId,
        frameworkKey: d.frameworkKey,
        name: d.name,
        version: d.version,
        description: d.description,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.db
        .insert(agentComplianceFrameworks)
        .values(insert)
        .onDuplicateKeyUpdate({
          set: { updatedAt: new Date() },
        });
      results.push(this.mapFrameworkRecord(insert));

      // Also seed baseline controls for each framework
      await this.seedBaselineControls(organizationId, id, d.frameworkKey);
    }

    return results;
  }

  private async seedBaselineControls(
    organizationId: string,
    frameworkId: string,
    frameworkKey: string,
  ): Promise<void> {
    const baselineControlsMap: Record<
      string,
      Array<{
        controlKey: string;
        title: string;
        description: string;
        category: string;
      }>
    > = {
      iso_27001: [
        {
          controlKey: "A.5.15",
          title: "Access Control for Autonomous Agents",
          description:
            "Enforce least privilege and capability bounds on agent execution and tool gateway dispatch.",
          category: "Organizational",
        },
        {
          controlKey: "A.8.15",
          title: "Logging and Monitoring of Agent Runs",
          description:
            "Log agent actions, policy evaluations, and tool calls to tamper-evident audit storage.",
          category: "Technological",
        },
      ],
      iso_42001: [
        {
          controlKey: "B.5.2",
          title: "AI System Impact Assessment",
          description:
            "Assess risk tier, autonomy ceiling, and potential societal impacts of deployed agents.",
          category: "Impact Assessment",
        },
        {
          controlKey: "B.7.3",
          title: "Human Oversight and Approval Routing",
          description:
            "Mandate human-in-the-loop review for high-impact actions and parameter mutations.",
          category: "Human Oversight",
        },
      ],
      nist_ai_rmf: [
        {
          controlKey: "GOVERN-1.1",
          title: "Governance Roles and Accountability",
          description:
            "Establish unambiguous human ownership (technical, business) for each agent profile.",
          category: "GOVERN",
        },
        {
          controlKey: "MANAGE-2.3",
          title: "Emergency Agent Suspension & Disconnect",
          description:
            "Provide instantaneous kill-switch controls to halt malfunctioning agents.",
          category: "MANAGE",
        },
      ],
      soc2_tsc: [
        {
          controlKey: "CC6.1",
          title: "Logical Access Controls & Sandboxing",
          description:
            "Prevent SSRF and file traversal during tool execution; block arbitrary code execution.",
          category: "Common Criteria",
        },
        {
          controlKey: "CC6.6",
          title: "Secret and Credential Protection",
          description:
            "Protect credentials via opaque reference abstraction and deep telemetry redaction.",
          category: "Common Criteria",
        },
      ],
    };

    const controls = baselineControlsMap[frameworkKey] ?? [];
    for (const c of controls) {
      const id = randomUUID();
      await this.db
        .insert(agentComplianceControls)
        .values({
          id,
          organizationId,
          frameworkId,
          controlKey: c.controlKey,
          title: c.title,
          description: c.description,
          category: c.category,
          implementationStatus: "IMPLEMENTED",
          reviewFrequencyDays: 90,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: { updatedAt: new Date() },
        });
    }
  }

  async listControls(
    organizationId: string,
    filters: {
      frameworkId?: string;
      category?: string;
      status?: ComplianceControlStatus;
    } = {},
  ): Promise<ComplianceControlRecord[]> {
    const conditions = [eq(agentComplianceControls.organizationId, organizationId)];

    if (filters.frameworkId) {
      conditions.push(eq(agentComplianceControls.frameworkId, filters.frameworkId));
    }
    if (filters.category) {
      conditions.push(eq(agentComplianceControls.category, filters.category));
    }
    if (filters.status) {
      conditions.push(eq(agentComplianceControls.implementationStatus, filters.status));
    }

    const rows = await this.db
      .select()
      .from(agentComplianceControls)
      .where(and(...conditions))
      .orderBy(agentComplianceControls.controlKey);

    return rows.map((r) => this.mapControlRecord(r));
  }

  async getControlById(
    organizationId: string,
    controlId: string,
  ): Promise<ComplianceControlRecord | null> {
    const rows = await this.db
      .select()
      .from(agentComplianceControls)
      .where(
        and(
          eq(agentComplianceControls.organizationId, organizationId),
          eq(agentComplianceControls.id, controlId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapControlRecord(rows[0]);
  }

  async updateControlVerification(
    organizationId: string,
    controlId: string,
    data: {
      status: ComplianceControlStatus;
      verifiedBy: string;
      exceptions?: string;
    },
  ): Promise<ComplianceControlRecord> {
    const now = new Date();
    const nextReview = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    await this.db
      .update(agentComplianceControls)
      .set({
        implementationStatus: data.status,
        verifiedBy: data.verifiedBy,
        verifiedAt: data.status === "VERIFIED" ? now : null,
        lastReviewedAt: now,
        nextReviewDueAt: nextReview,
        exceptions: data.exceptions ?? null,
        updatedAt: now,
      })
      .where(
        and(
          eq(agentComplianceControls.organizationId, organizationId),
          eq(agentComplianceControls.id, controlId),
        ),
      );

    const updated = await this.getControlById(organizationId, controlId);
    if (!updated) throw new Error(`Control ${controlId} not found`);
    return updated;
  }

  // -------------------------------------------------------------------------
  // 4. Compliance Evidence Management
  // -------------------------------------------------------------------------

  async createEvidence(data: {
    id?: string;
    organizationId: string;
    workspaceId?: string | null;
    title: string;
    evidenceType: ComplianceEvidenceType;
    source: string;
    classification?: ComplianceDataClassification;
    relatedControlIds?: string[];
    contentHash: string;
    storageReference?: string | null;
    structuredPayload?: Record<string, unknown>;
    collectedBy?: string | null;
  }): Promise<ComplianceEvidenceRecord> {
    const id = data.id ?? randomUUID();
    const insertData = {
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
      verificationStatus: "VALID" as const,
      retentionPolicyId: null,
      isUnderLegalHold: false,
      collectedBy: data.collectedBy ?? null,
      collectedAt: new Date(),
      accessCount: 0,
      lastAccessedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(agentComplianceEvidence).values(insertData);
    return this.mapEvidenceRecord(insertData);
  }

  async getEvidenceById(
    organizationId: string,
    evidenceId: string,
  ): Promise<ComplianceEvidenceRecord | null> {
    const rows = await this.db
      .select()
      .from(agentComplianceEvidence)
      .where(
        and(
          eq(agentComplianceEvidence.organizationId, organizationId),
          eq(agentComplianceEvidence.id, evidenceId),
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;

    // Increment access count
    await this.db
      .update(agentComplianceEvidence)
      .set({
        accessCount: sql`${agentComplianceEvidence.accessCount} + 1`,
        lastAccessedAt: new Date(),
      })
      .where(eq(agentComplianceEvidence.id, evidenceId));

    return this.mapEvidenceRecord(rows[0]);
  }

  async listEvidence(
    organizationId: string,
    filters: {
      workspaceId?: string;
      evidenceType?: ComplianceEvidenceType;
      classification?: ComplianceDataClassification;
      isUnderLegalHold?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ evidence: ComplianceEvidenceRecord[]; total: number }> {
    const conditions = [eq(agentComplianceEvidence.organizationId, organizationId)];

    if (filters.workspaceId) {
      conditions.push(eq(agentComplianceEvidence.workspaceId, filters.workspaceId));
    }
    if (filters.evidenceType) {
      conditions.push(eq(agentComplianceEvidence.evidenceType, filters.evidenceType));
    }
    if (filters.classification) {
      conditions.push(eq(agentComplianceEvidence.classification, filters.classification));
    }
    if (filters.isUnderLegalHold !== undefined) {
      conditions.push(
        eq(agentComplianceEvidence.isUnderLegalHold, filters.isUnderLegalHold),
      );
    }

    const whereClause = and(...conditions);
    const countRes = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(agentComplianceEvidence)
      .where(whereClause);
    const total = Number(countRes[0]?.count ?? 0);

    const rows = await this.db
      .select()
      .from(agentComplianceEvidence)
      .where(whereClause)
      .orderBy(desc(agentComplianceEvidence.collectedAt))
      .limit(filters.limit ?? 50)
      .offset(filters.offset ?? 0);

    return {
      evidence: rows.map((r) => this.mapEvidenceRecord(r)),
      total,
    };
  }

  // -------------------------------------------------------------------------
  // 5. Evidence Packages & Export
  // -------------------------------------------------------------------------

  async createEvidencePackage(data: {
    organizationId: string;
    workspaceId?: string | null;
    packageIdentifier: string;
    manifestChecksum: string;
    hashAlgorithm?: string;
    evidenceIds: string[];
    auditEventIds: string[];
    manifestPayload: EvidencePackageManifest;
    redactionLevel?: string;
    exportedBy: string;
  }): Promise<EvidencePackageRecord> {
    const id = randomUUID();
    const insertData = {
      id,
      organizationId: data.organizationId,
      workspaceId: data.workspaceId ?? null,
      packageIdentifier: data.packageIdentifier,
      manifestChecksum: data.manifestChecksum,
      hashAlgorithm: data.hashAlgorithm ?? "SHA-256",
      evidenceIds: data.evidenceIds,
      auditEventIds: data.auditEventIds,
      manifestPayload: data.manifestPayload as unknown as Record<string, unknown>,
      redactionLevel: data.redactionLevel ?? "DEEP_SECRET_SCRUBBED",
      status: "GENERATED",
      exportedBy: data.exportedBy,
      exportedAt: new Date(),
    };

    await this.db.insert(agentComplianceEvidencePackages).values(insertData);
    return this.mapPackageRecord(insertData);
  }

  async listEvidencePackages(
    organizationId: string,
  ): Promise<EvidencePackageRecord[]> {
    const rows = await this.db
      .select()
      .from(agentComplianceEvidencePackages)
      .where(eq(agentComplianceEvidencePackages.organizationId, organizationId))
      .orderBy(desc(agentComplianceEvidencePackages.exportedAt));

    return rows.map((r) => this.mapPackageRecord(r));
  }

  async getEvidencePackageById(
    organizationId: string,
    packageIdentifierOrId: string,
  ): Promise<EvidencePackageRecord | null> {
    const rows = await this.db
      .select()
      .from(agentComplianceEvidencePackages)
      .where(
        and(
          eq(agentComplianceEvidencePackages.organizationId, organizationId),
          sql`(${agentComplianceEvidencePackages.id} = ${packageIdentifierOrId} OR ${agentComplianceEvidencePackages.packageIdentifier} = ${packageIdentifierOrId})`,
        ),
      )
      .limit(1);

    if (rows.length === 0) return null;
    return this.mapPackageRecord(rows[0]);
  }

  // -------------------------------------------------------------------------
  // 6. Retention Policies & Legal Holds
  // -------------------------------------------------------------------------

  async listRetentionPolicies(
    organizationId: string,
  ): Promise<ComplianceRetentionPolicyRecord[]> {
    const rows = await this.db
      .select()
      .from(agentComplianceRetentionPolicies)
      .where(eq(agentComplianceRetentionPolicies.organizationId, organizationId));

    if (rows.length === 0) {
      return this.seedDefaultRetentionPolicies(organizationId);
    }

    return rows.map((r) => this.mapRetentionRecord(r));
  }

  async seedDefaultRetentionPolicies(
    organizationId: string,
  ): Promise<ComplianceRetentionPolicyRecord[]> {
    const defaults = [
      { category: "audit_ledger", days: 2555, action: "ARCHIVE" as const }, // 7 years
      { category: "compliance_events", days: 1095, action: "ARCHIVE" as const }, // 3 years
      { category: "evidence", days: 730, action: "ARCHIVE" as const }, // 2 years
      { category: "evidence_packages", days: 365, action: "ANONYMIZE" as const }, // 1 year
      { category: "investigations", days: 1825, action: "ARCHIVE" as const }, // 5 years
    ];

    const results: ComplianceRetentionPolicyRecord[] = [];
    for (const d of defaults) {
      const id = randomUUID();
      const insert = {
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
      await this.db
        .insert(agentComplianceRetentionPolicies)
        .values(insert)
        .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
      results.push(this.mapRetentionRecord(insert));
    }
    return results;
  }

  async upsertRetentionPolicy(data: {
    organizationId: string;
    recordCategory: string;
    retentionDurationDays: number;
    disposalAction?: "ARCHIVE" | "PURGE" | "ANONYMIZE";
    createdBy?: string;
  }): Promise<ComplianceRetentionPolicyRecord> {
    const id = randomUUID();
    const record = {
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

    await this.db
      .insert(agentComplianceRetentionPolicies)
      .values(record)
      .onDuplicateKeyUpdate({
        set: {
          retentionDurationDays: data.retentionDurationDays,
          disposalAction: data.disposalAction ?? "ARCHIVE",
          updatedAt: new Date(),
        },
      });

    const rows = await this.db
      .select()
      .from(agentComplianceRetentionPolicies)
      .where(
        and(
          eq(agentComplianceRetentionPolicies.organizationId, data.organizationId),
          eq(agentComplianceRetentionPolicies.recordCategory, data.recordCategory),
        ),
      )
      .limit(1);

    return this.mapRetentionRecord(rows[0]);
  }

  async createLegalHold(data: {
    organizationId: string;
    holdIdentifier?: string;
    name: string;
    description?: string;
    reason: string;
    scopeType?: "ALL" | "AGENT" | "CONTROL" | "CATEGORY" | "TIME_RANGE";
    scopeCriteria?: Record<string, unknown>;
    createdBy: string;
  }): Promise<ComplianceLegalHoldRecord> {
    const id = randomUUID();
    const holdIdentifier = data.holdIdentifier ?? `HOLD-${Date.now().toString(36).toUpperCase()}`;

    const insert = {
      id,
      organizationId: data.organizationId,
      holdIdentifier,
      name: data.name,
      description: data.description ?? null,
      reason: data.reason,
      scopeType: data.scopeType ?? "ALL",
      scopeCriteria: data.scopeCriteria ?? {},
      status: "ACTIVE" as const,
      createdBy: data.createdBy,
      releasedBy: null,
      releasedAt: null,
      releaseJustification: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(agentComplianceLegalHolds).values(insert);

    // Apply hold to evidence matching scope
    if (data.scopeType === "ALL") {
      await this.db
        .update(agentComplianceEvidence)
        .set({ isUnderLegalHold: true })
        .where(eq(agentComplianceEvidence.organizationId, data.organizationId));
    }

    return this.mapLegalHoldRecord(insert);
  }

  async listLegalHolds(
    organizationId: string,
    status?: LegalHoldStatus,
  ): Promise<ComplianceLegalHoldRecord[]> {
    const conditions = [eq(agentComplianceLegalHolds.organizationId, organizationId)];
    if (status) {
      conditions.push(eq(agentComplianceLegalHolds.status, status));
    }

    const rows = await this.db
      .select()
      .from(agentComplianceLegalHolds)
      .where(and(...conditions))
      .orderBy(desc(agentComplianceLegalHolds.createdAt));

    return rows.map((r) => this.mapLegalHoldRecord(r));
  }

  async releaseLegalHold(
    organizationId: string,
    holdIdentifier: string,
    releasedBy: string,
    justification: string,
  ): Promise<ComplianceLegalHoldRecord> {
    const now = new Date();
    await this.db
      .update(agentComplianceLegalHolds)
      .set({
        status: "RELEASED",
        releasedBy,
        releasedAt: now,
        releaseJustification: justification,
        updatedAt: now,
      })
      .where(
        and(
          eq(agentComplianceLegalHolds.organizationId, organizationId),
          eq(agentComplianceLegalHolds.holdIdentifier, holdIdentifier),
        ),
      );

    const rows = await this.db
      .select()
      .from(agentComplianceLegalHolds)
      .where(
        and(
          eq(agentComplianceLegalHolds.organizationId, organizationId),
          eq(agentComplianceLegalHolds.holdIdentifier, holdIdentifier),
        ),
      )
      .limit(1);

    if (rows.length === 0) throw new Error(`Legal hold ${holdIdentifier} not found`);

    // Check if there are other active holds; if none, release evidence flags
    const otherActive = await this.listLegalHolds(organizationId, "ACTIVE");
    if (otherActive.length === 0) {
      await this.db
        .update(agentComplianceEvidence)
        .set({ isUnderLegalHold: false })
        .where(eq(agentComplianceEvidence.organizationId, organizationId));
    }

    return this.mapLegalHoldRecord(rows[0]);
  }

  // -------------------------------------------------------------------------
  // 7. Investigations & Cases
  // -------------------------------------------------------------------------

  async createInvestigation(data: {
    organizationId: string;
    caseNumber?: string;
    title: string;
    description?: string;
    investigatorId: string;
    searchFilters?: Record<string, unknown>;
  }): Promise<ComplianceInvestigationRecord> {
    const id = randomUUID();
    const caseNumber =
      data.caseNumber ?? `CASE-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;

    const insert = {
      id,
      organizationId: data.organizationId,
      caseNumber,
      title: data.title,
      description: data.description ?? null,
      investigatorId: data.investigatorId,
      status: "OPEN" as const,
      searchFilters: data.searchFilters ?? {},
      findings: null,
      notes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.insert(agentComplianceInvestigations).values(insert);
    return this.mapInvestigationRecord(insert);
  }

  async listInvestigations(
    organizationId: string,
    status?: InvestigationStatus,
  ): Promise<ComplianceInvestigationRecord[]> {
    const conditions = [
      eq(agentComplianceInvestigations.organizationId, organizationId),
    ];
    if (status) {
      conditions.push(eq(agentComplianceInvestigations.status, status));
    }

    const rows = await this.db
      .select()
      .from(agentComplianceInvestigations)
      .where(and(...conditions))
      .orderBy(desc(agentComplianceInvestigations.createdAt));

    return rows.map((r) => this.mapInvestigationRecord(r));
  }

  async addInvestigationNote(
    organizationId: string,
    caseNumber: string,
    note: string,
    authorId: string,
  ): Promise<ComplianceInvestigationRecord> {
    const rows = await this.db
      .select()
      .from(agentComplianceInvestigations)
      .where(
        and(
          eq(agentComplianceInvestigations.organizationId, organizationId),
          eq(agentComplianceInvestigations.caseNumber, caseNumber),
        ),
      )
      .limit(1);

    if (rows.length === 0) throw new Error(`Investigation ${caseNumber} not found`);

    const inv = rows[0];
    const notes = Array.isArray(inv.notes) ? [...inv.notes] : [];
    notes.push({
      note,
      authorId,
      timestamp: new Date().toISOString(),
    });

    await this.db
      .update(agentComplianceInvestigations)
      .set({
        notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentComplianceInvestigations.organizationId, organizationId),
          eq(agentComplianceInvestigations.caseNumber, caseNumber),
        ),
      );

    return this.mapInvestigationRecord({ ...inv, notes });
  }

  // -------------------------------------------------------------------------
  // Mappers
  // -------------------------------------------------------------------------

  private mapEventRecord(row: any): ComplianceEventRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      eventCategory: row.eventCategory,
      eventType: row.eventType,
      eventTimestamp: new Date(row.eventTimestamp),
      ingestionTimestamp: new Date(row.ingestionTimestamp),
      actorId: row.actorId,
      actorType: row.actorType,
      agentId: row.agentId,
      executionId: row.executionId,
      policyId: row.policyId,
      policyVersion: row.policyVersion,
      approvalRequestId: row.approvalRequestId,
      securityEventRef: row.securityEventRef,
      correlationId: row.correlationId,
      traceId: row.traceId,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      eventOutcome: row.eventOutcome,
      riskSeverity: row.riskSeverity,
      dataClassification: row.dataClassification,
      redactedMetadata: row.redactedMetadata ?? {},
      schemaVersion: row.schemaVersion ?? 1,
      createdAt: new Date(row.createdAt),
    };
  }

  private mapChainRecord(row: any): AuditIntegrityChainRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      eventId: row.eventId,
      sequenceNumber: Number(row.sequenceNumber),
      previousEventHash: row.previousEventHash,
      payloadHash: row.payloadHash,
      currentEventHash: row.currentEventHash,
      hashAlgorithm: row.hashAlgorithm,
      schemaVersion: row.schemaVersion,
      recordedAt: new Date(row.recordedAt),
    };
  }

  private mapFrameworkRecord(row: any): ComplianceFrameworkRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      frameworkKey: row.frameworkKey,
      name: row.name,
      version: row.version,
      description: row.description,
      isEnabled: Boolean(row.isEnabled),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapControlRecord(row: any): ComplianceControlRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      frameworkId: row.frameworkId,
      controlKey: row.controlKey,
      title: row.title,
      description: row.description,
      category: row.category,
      implementationStatus: row.implementationStatus,
      ownerId: row.ownerId,
      reviewFrequencyDays: Number(row.reviewFrequencyDays ?? 90),
      lastReviewedAt: row.lastReviewedAt ? new Date(row.lastReviewedAt) : null,
      nextReviewDueAt: row.nextReviewDueAt ? new Date(row.nextReviewDueAt) : null,
      verifiedAt: row.verifiedAt ? new Date(row.verifiedAt) : null,
      verifiedBy: row.verifiedBy,
      exceptions: row.exceptions,
      metadata: row.metadata ?? {},
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapEvidenceRecord(row: any): ComplianceEvidenceRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      title: row.title,
      evidenceType: row.evidenceType,
      source: row.source,
      classification: row.classification,
      relatedControlIds: Array.isArray(row.relatedControlIds) ? row.relatedControlIds : [],
      contentHash: row.contentHash,
      storageReference: row.storageReference,
      structuredPayload: row.structuredPayload ?? {},
      verificationStatus: row.verificationStatus,
      retentionPolicyId: row.retentionPolicyId,
      isUnderLegalHold: Boolean(row.isUnderLegalHold),
      collectedBy: row.collectedBy,
      collectedAt: new Date(row.collectedAt),
      accessCount: Number(row.accessCount ?? 0),
      lastAccessedAt: row.lastAccessedAt ? new Date(row.lastAccessedAt) : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapPackageRecord(row: any): EvidencePackageRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      packageIdentifier: row.packageIdentifier,
      manifestChecksum: row.manifestChecksum,
      hashAlgorithm: row.hashAlgorithm,
      evidenceIds: Array.isArray(row.evidenceIds) ? row.evidenceIds : [],
      auditEventIds: Array.isArray(row.auditEventIds) ? row.auditEventIds : [],
      manifestPayload: row.manifestPayload,
      redactionLevel: row.redactionLevel,
      status: row.status,
      exportedBy: row.exportedBy,
      exportedAt: new Date(row.exportedAt),
    };
  }

  private mapRetentionRecord(row: any): ComplianceRetentionPolicyRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      recordCategory: row.recordCategory,
      retentionDurationDays: Number(row.retentionDurationDays),
      effectiveFrom: new Date(row.effectiveFrom),
      disposalAction: row.disposalAction,
      status: row.status,
      createdBy: row.createdBy,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapLegalHoldRecord(row: any): ComplianceLegalHoldRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      holdIdentifier: row.holdIdentifier,
      name: row.name,
      description: row.description,
      reason: row.reason,
      scopeType: row.scopeType,
      scopeCriteria: row.scopeCriteria ?? {},
      status: row.status,
      createdBy: row.createdBy,
      releasedBy: row.releasedBy,
      releasedAt: row.releasedAt ? new Date(row.releasedAt) : null,
      releaseJustification: row.releaseJustification,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapInvestigationRecord(row: any): ComplianceInvestigationRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      caseNumber: row.caseNumber,
      title: row.title,
      description: row.description,
      investigatorId: row.investigatorId,
      status: row.status,
      searchFilters: row.searchFilters ?? {},
      findings: row.findings,
      notes: Array.isArray(row.notes) ? row.notes : [],
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
}
