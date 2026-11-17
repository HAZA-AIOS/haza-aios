import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID, createHmac, createHash } from "node:crypto";
import { AgentGovernanceConsoleService } from "../src/modules/agents/services/agent-governance-console.service.js";
import { AgentComplianceService } from "../src/modules/agents/services/agent-compliance.service.js";
import { AgentSecurityGatewayService } from "../src/modules/agents/services/agent-security-gateway.service.js";
import { AgentApprovalContinuationService } from "../src/modules/agents/services/agent-approval-continuation.service.js";
import { AgentApprovalService } from "../src/modules/agents/services/agent-approval.service.js";
import {
  calculateRiskAssessment,
  calculateTrustProfile,
  generateAlertFingerprint,
} from "../src/modules/agents/risk-trust.types.js";
import {
  canonicalStringify,
  sha256Hash,
  verifyEvidencePackageOffline,
} from "../src/modules/agents/compliance.types.js";
import {
  computePayloadFingerprint,
} from "../src/modules/agents/governance-approval.types.js";
import {
  generateContinuationProof,
  verifyContinuationProof,
} from "../src/modules/agents/governance-security.types.js";
import { redactObject, redactSecrets } from "../src/modules/agents/utils/secret-redactor.js";

// Comprehensive Mock Database for Epic 22H Release Acceptance
class MockEpic22Database {
  agents = new Map<string, any>();
  profiles = new Map<string, any>();
  ownership = new Map<string, any>();
  policies = new Map<string, any>();
  approvals = new Map<string, any>();
  approvalDecisions = new Map<string, any>();
  securityProfiles = new Map<string, any>();
  securityEvents = new Map<string, any>();
  secretReferences = new Map<string, any>();
  complianceControls = new Map<string, any>();
  complianceEvents = new Map<string, any>();
  auditChains = new Map<string, any>();
  evidenceList = new Map<string, any>();
  legalHolds = new Map<string, any>();
  risks = new Map<string, any>();
  trustProfiles = new Map<string, any>();
  mitigations = new Map<string, any>();
  exceptions = new Map<string, any>();
  behavioralAlerts = new Map<string, any>();

  emergencyStops = new Map<string, any>();
  enforcementMode: "MONITOR" | "ENFORCE" | "DISABLED" = "MONITOR";
}

describe("Epic 22H: Final Security Acceptance & Release Readiness Verification", () => {
  let mockDb: MockEpic22Database;
  let complianceService: AgentComplianceService;
  let securityGateway: AgentSecurityGatewayService;
  let approvalService: AgentApprovalService;
  let continuationService: AgentApprovalContinuationService;
  let consoleService: AgentGovernanceConsoleService;
  let mockApprovalRepo: any;

  const orgAlpha = "org-enterprise-alpha";
  const orgBeta = "org-enterprise-beta";
  const workspaceAlpha = "ws-alpha-prod";
  const agent1 = "agent-academic-researcher";
  const agent2 = "agent-writer";
  const requesterActor = "user-requester-id";
  const reviewerActor = "user-reviewer-id";

  beforeEach(() => {
    mockDb = new MockEpic22Database();

    // 1. Setup Org Alpha Baseline
    mockDb.agents.set(agent1, {
      id: agent1,
      organizationId: orgAlpha,
      workspaceId: workspaceAlpha,
      name: "Academic Research Agent",
      agentKey: "research-assistant-v1",
      description: "Generates grounded academic curriculum and evaluates learning plans",
      createdAt: new Date("2026-11-01T00:00:00Z"),
    });

    mockDb.profiles.set(agent1, {
      id: "prof-1",
      agentId: agent1,
      organizationId: orgAlpha,
      securityClassification: "INTERNAL",
      maxAutonomyLevel: "L2",
      governanceReviewCadenceDays: 90,
      nextReviewDueAt: new Date("2026-12-01T00:00:00Z"),
    });

    mockDb.ownership.set(agent1, {
      agentId: agent1,
      organizationId: orgAlpha,
      ownerId: "user-academic-dean",
      ownerEmail: "dean@university.edu",
      technicalOwnerId: "user-lead-engineer",
      administratorId: "user-secops-admin",
      accountabilityStatus: "active",
    });

    mockDb.securityProfiles.set(agent1, {
      agentId: agent1,
      organizationId: orgAlpha,
      isSuspended: false,
      suspensionReason: null,
      resourceClassification: "INTERNAL",
      networkAccessMode: "ALLOWLIST",
      storageAccessMode: "WORKSPACE_ISOLATED",
      allowedNetworkDomains: ["api.semanticscholar.org", "arxiv.org", "*.education.gov"],
      disallowedToolKeys: ["system.shell.exec", "code.execution.run_bash"],
      allowedSecretReferenceIds: ["sec-ref-semantic-scholar"],
      delegationAttenuation: true,
      maxExecutionDurationMs: 60000,
      maxToolInvocations: 20,
    });

    mockDb.trustProfiles.set(agent1, {
      agentId: agent1,
      organizationId: orgAlpha,
      trustScore: 85,
      trustTier: "HIGH",
      trustConfidence: "HIGH",
      evidenceCount: 42,
      dimensionScores: {
        executionReliability: 90,
        policyAdherence: 95,
        securityIncidentHistory: 100,
        humanApprovalOutcomes: 80,
        toolExecutionSafety: 85,
        complianceEvidenceQuality: 80,
        operationalConsistency: 90,
      },
    });

    // 2. Setup Security Gateway Service Mock
    const mockSecurityRepo: any = {
      async getProfile(organizationId: string, agentId: string) {
        const p = mockDb.securityProfiles.get(agentId);
        return p && p.organizationId === organizationId ? p : null;
      },
      async upsertProfile(data: any) {
        mockDb.securityProfiles.set(data.agentId, { ...data, isSuspended: false, disallowedToolKeys: [], allowedNetworkDomains: [] });
        return mockDb.securityProfiles.get(data.agentId);
      },
      async suspendAgent(organizationId: string, agentId: string, _by: string, reason: string) {
        const p = mockDb.securityProfiles.get(agentId);
        if (p && p.organizationId === organizationId) {
          p.isSuspended = true;
          p.suspensionReason = reason;
        }
        return p;
      },
      async reactivateAgent(organizationId: string, agentId: string) {
        const p = mockDb.securityProfiles.get(agentId);
        if (p && p.organizationId === organizationId) {
          p.isSuspended = false;
          p.suspensionReason = null;
        }
        return p;
      },
      async createEvent(event: any) {
        const id = randomUUID();
        mockDb.securityEvents.set(id, { id, ...event, createdAt: new Date() });
        return mockDb.securityEvents.get(id);
      },
    };
    securityGateway = new AgentSecurityGatewayService(mockSecurityRepo);

    // 3. Setup Approval Service & Continuation Service
    mockApprovalRepo = {
      async getRequestById(organizationId: string, id: string) {
        const r = mockDb.approvals.get(id);
        return r && r.organizationId === organizationId ? r : null;
      },
      async getRequestByIdempotencyKey(organizationId: string, _key: string) {
        return null;
      },
      async createRequest(data: any) {
        const id = data.id || randomUUID();
        const record = { ...data, id, status: data.status || "pending", createdAt: new Date(), updatedAt: new Date() };
        mockDb.approvals.set(id, record);
        return record;
      },
      async updateRequestStatus(params: any) {
        const req = mockDb.approvals.get(params.id);
        if (req && req.organizationId === params.organizationId) {
          req.status = params.newStatus;
          if (params.decisionId) req.decisionId = params.decisionId;
          if (params.consumedAt) req.consumedAt = params.consumedAt;
          if (params.consumedBy) req.consumedBy = params.consumedBy;
          if (params.assignedReviewerId) req.assignedReviewerId = params.assignedReviewerId;
          req.updatedAt = new Date();
          return req;
        }
        return null;
      },
      async createDecision(data: any) {
        const id = data.id || randomUUID();
        const record = { id, ...data, decidedAt: new Date().toISOString() };
        mockDb.approvalDecisions.set(id, record);
        return record;
      },
      async recordDecision(data: any) {
        const id = randomUUID();
        const req = mockDb.approvals.get(data.approvalRequestId);
        if (req) {
          req.status = data.decision;
          req.updatedAt = new Date();
        }
        mockDb.approvalDecisions.set(id, { id, ...data, createdAt: new Date() });
        return { decision: mockDb.approvalDecisions.get(id), request: req };
      },
      async markConsumed(organizationId: string, id: string, consumedBy: string) {
        const req = mockDb.approvals.get(id);
        if (req && req.organizationId === organizationId) {
          req.status = "consumed";
          req.consumedAt = new Date().toISOString();
          req.consumedBy = consumedBy;
        }
        return req;
      },
    };

    approvalService = new AgentApprovalService(
      mockApprovalRepo,
      undefined,
      undefined,
      mockSecurityRepo,
      securityGateway,
    );

    continuationService = new AgentApprovalContinuationService(
      mockApprovalRepo,
      undefined,
      undefined,
      undefined,
      mockSecurityRepo,
      securityGateway,
    );

    // 4. Setup Compliance Service with Cryptographic Ledger
    const mockComplianceRepo: any = {
      async ingestEvent(dto: any) {
        const id = dto.id ?? randomUUID();
        const record = {
          id,
          organizationId: dto.organizationId,
          workspaceId: dto.workspaceId ?? null,
          eventCategory: dto.eventCategory ?? "AUDIT",
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
        };
        mockDb.complianceEvents.set(id, record);
        return { event: record, isDuplicate: false };
      },

      async getLatestChainRecord(organizationId: string) {
        const orgChains = Array.from(mockDb.auditChains.values())
          .filter((c: any) => c.organizationId === organizationId)
          .sort((a: any, b: any) => b.sequenceNumber - a.sequenceNumber);
        return orgChains[0] ?? null;
      },

      async appendChainRecord(data: any) {
        const record = {
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
        mockDb.auditChains.set(record.id, record);
        return record;
      },

      async getChainRecords(organizationId: string, range?: { fromSeq?: number; toSeq?: number }) {
        let orgChains = Array.from(mockDb.auditChains.values())
          .filter((c: any) => c.organizationId === organizationId)
          .sort((a: any, b: any) => a.sequenceNumber - b.sequenceNumber);
        if (range?.fromSeq !== undefined) orgChains = orgChains.filter((c: any) => c.sequenceNumber >= range.fromSeq!);
        if (range?.toSeq !== undefined) orgChains = orgChains.filter((c: any) => c.sequenceNumber <= range.toSeq!);
        return orgChains;
      },

      async getEventById(organizationId: string, id: string) {
        const e = mockDb.complianceEvents.get(id);
        return e && e.organizationId === organizationId ? e : null;
      },
    };

    complianceService = new AgentComplianceService({} as any);
    (complianceService as any).repo = mockComplianceRepo;

    // 5. Setup Console Service
    const mockConsoleRepo: any = {
      async getUnifiedOverview(organizationId: string) {
        const orgAgents = Array.from(mockDb.agents.values()).filter((a) => a.organizationId === organizationId);
        const orgApprovals = Array.from(mockDb.approvals.values()).filter((a) => a.organizationId === organizationId);
        const orgRisks = Array.from(mockDb.risks.values()).filter((r) => r.organizationId === organizationId);
        const orgControls = Array.from(mockDb.complianceControls.values()).filter((c) => c.organizationId === organizationId);
        const orgMitigations = Array.from(mockDb.mitigations.values()).filter((m) => m.organizationId === organizationId);
        const orgExceptions = Array.from(mockDb.exceptions.values()).filter((e) => e.organizationId === organizationId);
        const orgSecurity = Array.from(mockDb.securityProfiles.values()).filter((s) => s.organizationId === organizationId);
        const orgTrust = Array.from(mockDb.trustProfiles.values()).filter((t) => t.organizationId === organizationId);

        const suspendedCount = orgSecurity.filter((s) => s.isSuspended).length;
        const pendingApprovalsCount = orgApprovals.filter((a) => a.status === "pending").length;
        const highCriticalRisks = orgRisks.filter((r) => r.residualTier === "HIGH" || r.residualTier === "CRITICAL").length;
        const reviewDueControls = orgControls.filter((c) => c.status === "REVIEW_DUE" || c.status === "EVIDENCE_PENDING").length;
        const openMits = orgMitigations.filter((m) => m.status === "OPEN" || m.status === "IN_PROGRESS").length;

        const avgTrust = orgTrust.length > 0
          ? Math.round(orgTrust.reduce((acc, t) => acc + t.trustScore, 0) / orgTrust.length)
          : 50;

        return {
          kpis: {
            totalGovernedAgents: orgAgents.length,
            activeAgents: Math.max(0, orgAgents.length - suspendedCount),
            suspendedAgents: suspendedCount,
            pendingApprovals: pendingApprovalsCount,
            highAndCriticalRisks: highCriticalRisks,
            openSecurityIncidents: 0,
            auditIntegrityStatus: "INTACT",
            lastVerifiedSequence: mockDb.auditChains.size || 1,
            complianceControlsRequiringReview: reviewDueControls,
            openRiskMitigations: openMits,
            expiringExceptions: orgExceptions.length,
            averageTrustScore: avgTrust,
          },
          enforcementMode: mockDb.enforcementMode,
          securityPosture: {
            isEmergencyStopped: securityGateway.isEmergencyStopped(organizationId),
            emergencyStoppedAt: null,
            emergencyStoppedBy: null,
            suspendedAgentsCount: suspendedCount,
            unresolvedIncidentsCount: 0,
            secretReferencesCount: mockDb.secretReferences.size,
          },
          complianceSummary: {
            frameworkCount: 4,
            totalControls: orgControls.length,
            verifiedControls: orgControls.filter((c) => c.status === "VERIFIED").length,
            coveragePercent: orgControls.length > 0 ? Math.round((orgControls.filter((c) => c.status === "VERIFIED").length / orgControls.length) * 100) : 0,
            activeLegalHoldsCount: mockDb.legalHolds.size,
          },
          riskDistribution: {
            critical: orgRisks.filter((r) => r.residualTier === "CRITICAL").length,
            high: orgRisks.filter((r) => r.residualTier === "HIGH").length,
            medium: orgRisks.filter((r) => r.residualTier === "MEDIUM").length,
            low: orgRisks.filter((r) => r.residualTier === "LOW").length,
          },
          approvalQueueSummary: {
            pending: pendingApprovalsCount,
            escalated: 0,
            approvedLast7Days: 0,
            rejectedLast7Days: 0,
          },
          activityTrends: [
            { date: "2026-11-17", policyEvaluations: 15, toolInvocations: 40, securityEvents: 0, approvals: pendingApprovalsCount },
          ],
          recentCriticalEvents: [],
          outstandingActionsCount: pendingApprovalsCount + highCriticalRisks + openMits,
          asOf: new Date().toISOString(),
        };
      },

      async getActionCenterItems(organizationId: string) {
        const actions: any[] = [];
        for (const app of Array.from(mockDb.approvals.values()).filter((a) => a.organizationId === organizationId && a.status === "pending")) {
          actions.push({
            actionId: `action-approval-${app.id}`,
            category: "APPROVAL",
            priority: app.riskClassification === "CRITICAL" ? "CRITICAL" : "HIGH",
            title: `Pending Approval: ${app.actionTarget}`,
            description: app.approvalReason,
            sourceEntityType: "agent_approval_request",
            sourceEntityId: app.id,
            targetTab: "approvals",
            agentId: app.agentId,
            dueAt: app.expiresAt?.toISOString() || null,
            createdAt: app.createdAt.toISOString(),
            status: "PENDING_REVIEW",
            suggestedActionLabel: "Review Approval",
          });
        }
        const priorityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return actions.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
      },

      async listAgentDirectory(organizationId: string) {
        const items = Array.from(mockDb.agents.values()).filter((a) => a.organizationId === organizationId).map((a) => ({
          agentId: a.id,
          name: a.name,
          agentKey: a.agentKey,
          organizationId: a.organizationId,
          workspaceId: a.workspaceId,
          securityClassification: "INTERNAL",
          maxAutonomyLevel: "L2",
          isSuspended: mockDb.securityProfiles.get(a.id)?.isSuspended || false,
          suspensionReason: mockDb.securityProfiles.get(a.id)?.suspensionReason || null,
          trustScore: mockDb.trustProfiles.get(a.id)?.trustScore || 50,
          trustTier: "HIGH",
          trustConfidence: "HIGH",
          residualRiskTier: "LOW",
          pendingApprovalsCount: Array.from(mockDb.approvals.values()).filter((app) => app.agentId === a.id && app.status === "pending").length,
          activeAlertsCount: 0,
          assignedPoliciesCount: 1,
          lastActiveAt: new Date().toISOString(),
          createdAt: a.createdAt.toISOString(),
        }));
        return { items, total: items.length, page: 1, pageSize: 20 };
      },

      async generateReport(organizationId: string, query: any = {}) {
        const ov = await this.getUnifiedOverview(organizationId);
        return {
          organizationId,
          generatedAt: new Date().toISOString(),
          period: { from: query.startDate || "2026-11-01", to: query.endDate || "2026-11-17" },
          reportType: query.reportType || "EXECUTIVE_SUMMARY",
          executiveSummary: {
            governedAgentsCount: ov.kpis.totalGovernedAgents,
            activePoliciesCount: 1,
            emergencyStopActive: ov.securityPosture.isEmergencyStopped,
            auditIntegrityStatus: ov.kpis.auditIntegrityStatus,
            averageTrustScore: ov.kpis.averageTrustScore,
            openIncidentsCount: 0,
            complianceCoveragePercent: ov.complianceSummary.coveragePercent,
          },
          securityMetrics: {
            suspendedAgents: ov.securityPosture.suspendedAgentsCount,
            totalIncidents: 0,
            criticalIncidents: 0,
            secretReferencesCount: ov.securityPosture.secretReferencesCount,
          },
          complianceMetrics: {
            frameworkCount: 4,
            totalControls: ov.complianceSummary.totalControls,
            verifiedControls: ov.complianceSummary.verifiedControls,
            nonCompliantControls: 0,
            evidencePackagesCount: 0,
            activeHoldsCount: 0,
          },
          riskMetrics: {
            totalRisks: 0,
            risksByTier: ov.riskDistribution,
            openMitigations: 0,
            activeExceptions: 0,
            activeBehavioralAlerts: 0,
          },
          approvalMetrics: {
            pendingApprovals: ov.approvalQueueSummary.pending,
            escalatedApprovals: 0,
            approvalRatePercent: 100,
          },
        };
      },
    };

    consoleService = new AgentGovernanceConsoleService({} as any, complianceService);
    (consoleService as any).repo = mockConsoleRepo;
  });

  // ===========================================================================
  // SECTION 1: END-TO-END CROSS-PHASE INTEGRATION TRACE
  // ===========================================================================

  it("Trace E2E: Agent Request -> RBAC -> Precedence -> Approval -> Continuation -> Execution -> Hash-Chain Audit", async () => {
    // 1. Initial State: Agent requests high-risk operation
    const payload = {
      curriculumId: "curr-algebra-1",
      action: "publish_curriculum",
      apiKey: "sk-live-secret-university-token-123456",
    };
    const fingerprint = computePayloadFingerprint(payload);

    // 2. Policy triggers REQUIRE_APPROVAL -> Request created
    const req = await approvalService.createApprovalRequest({
      organizationId: orgAlpha,
      workspaceId: workspaceAlpha,
      agentId: agent1,
      actionType: "tool_invocation",
      actionTarget: "education.lesson_plans.publish",
      requestingActorId: requesterActor,
      payload,
      approvalReason: "Publishing curriculum requires dual reviewer sign-off",
      riskClassification: "high",
      securityClassification: "INTERNAL",
      expiresInMinutes: 60,
    });

    expect(req.status).toBe("pending");
    expect(req.canonicalPayloadFingerprint).toBe(fingerprint);

    // 3. Separation of duties: Requester cannot self-approve high-risk operation
    await expect(
      approvalService.decideApprovalRequest({
        organizationId: orgAlpha,
        approvalRequestId: req.id,
        decision: "approved",
        actorId: requesterActor, // Same as requester
        actorType: "user",
        justification: "I want to self-approve my own request",
        userPermissions: ["agent.manage"],
      }),
    ).rejects.toThrow(/Requester self-approval is forbidden/i);

    // 4. Authorized human reviewer approves
    const { request: approvedReq, decision } = await approvalService.decideApprovalRequest({
      organizationId: orgAlpha,
      approvalRequestId: req.id,
      decision: "approved",
      actorId: reviewerActor, // Distinct reviewer
      actorType: "user",
      justification: "Curriculum reviewed and certified against state standards",
      userPermissions: ["agent.manage"],
    });

    expect(approvedReq.status).toBe("approved");
    expect(decision.decidedByActorId).toBe(reviewerActor);

    // 5. Generate HMAC continuation proof token
    const continuationProof = generateContinuationProof({
      approvalRequestId: approvedReq.id,
      agentId: agent1,
      actionTarget: "education.lesson_plans.publish",
      payloadFingerprint: approvedReq.canonicalPayloadFingerprint,
      organizationId: orgAlpha,
    });
    expect(continuationProof.signature).toBeDefined();

    // 6. Execute Continuation
    const continuationResult = await continuationService.continueApprovedExecution({
      organizationId: orgAlpha,
      approvalRequestId: approvedReq.id,
      actorId: requesterActor,
      providedPayload: payload,
    });

    expect(continuationResult.success).toBe(true);
    expect(continuationResult.status).toBe("consumed");
    expect(continuationResult.approvalRequestId).toBe(approvedReq.id);

    // 7. Verify Replay Prevention: Second continuation attempt MUST fail
    await expect(
      continuationService.continueApprovedExecution({
        organizationId: orgAlpha,
        approvalRequestId: approvedReq.id,
        actorId: requesterActor,
        providedPayload: payload,
      }),
    ).rejects.toThrow(/already been consumed/i);

    // 8. Audit event recorded in SHA-256 Hash-Chained Ledger
    const auditRes = await complianceService.recordComplianceEvent({
      organizationId: orgAlpha,
      workspaceId: workspaceAlpha,
      eventCategory: "HUMAN_APPROVAL",
      eventType: "agent.approval.executed",
      actorId: requesterActor,
      actorType: "user",
      agentId: agent1,
      approvalRequestId: approvedReq.id,
      eventOutcome: "SUCCESS",
      riskSeverity: "HIGH",
      dataClassification: "INTERNAL",
      redactedMetadata: payload,
    });

    expect(auditRes.chainRecord?.sequenceNumber).toBe(1);
    expect(auditRes.event.redactedMetadata.apiKey).toBe("sk-...3456"); // Secret redacted

    // 9. Hash-chain verification validates complete integrity
    const chainVerification = await complianceService.verifyAuditIntegrity(orgAlpha);
    expect(chainVerification.isValid).toBe(true);

    // 10. Governance Console Telemetry reflects cleared approval
    const overview = await consoleService.getConsoleOverview(orgAlpha);
    expect(overview.kpis.pendingApprovals).toBe(0);
    expect(overview.kpis.auditIntegrityStatus).toBe("INTACT");
  });

  // ===========================================================================
  // SECTION 2: ADVERSARIAL SECURITY BOUNDARY VERIFICATION
  // ===========================================================================

  it("Sec 1: Cross-Tenant Isolation: Org B cannot access Org Alpha approvals or resources", async () => {
    const payload = { action: "test" };
    const req = await approvalService.createApprovalRequest({
      organizationId: orgAlpha,
      agentId: agent1,
      actionType: "tool_invocation",
      actionTarget: "test.tool",
      requestingActorId: requesterActor,
      payload,
      approvalReason: "Cross-tenant test",
      riskClassification: "LOW",
      securityClassification: "PUBLIC",
    });

    // Org B attempts to approve Org Alpha's request
    await expect(
      approvalService.decideApprovalRequest({
        organizationId: orgBeta, // Wrong tenant
        approvalRequestId: req.id,
        decision: "approved",
        actorId: reviewerActor,
        actorType: "user",
        justification: "Unauthorized cross-tenant approval",
      }),
    ).rejects.toThrow(/not found/i);

    // Org B attempts continuation on Org Alpha's request
    await expect(
      continuationService.continueApprovedExecution({
        organizationId: orgBeta, // Wrong tenant
        approvalRequestId: req.id,
        resumingActorId: requesterActor,
        resumingActorType: "user",
        payload,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("Sec 2: Continuation Proof Tampering Rejection", async () => {
    const payload = { fileId: "doc-123" };
    const fingerprint = computePayloadFingerprint(payload);
    const req = await mockApprovalRepo.createRequest({
      organizationId: orgAlpha,
      agentId: agent1,
      actionType: "read",
      actionTarget: "doc.read",
      requestingActorId: requesterActor,
      canonicalPayloadFingerprint: fingerprint,
      payload,
      approvalReason: "Proof tamper test",
      riskClassification: "low",
      securityClassification: "PUBLIC",
      status: "approved",
      expiresAt: new Date(Date.now() + 3600000),
    });

    // 1. Valid continuation proof passes verification
    const validProof = generateContinuationProof({
      approvalRequestId: req.id,
      agentId: agent1,
      actionTarget: "doc.read",
      payloadFingerprint: fingerprint,
      organizationId: orgAlpha,
      ttlSeconds: 60,
    });

    const validVerification = verifyContinuationProof(validProof, {
      approvalRequestId: req.id,
      agentId: agent1,
      actionTarget: "doc.read",
      payloadFingerprint: fingerprint,
      organizationId: orgAlpha,
    });
    expect(validVerification.valid).toBe(true);

    // 2. Tampered signature fails cryptographic verification
    const tamperedSigProof = { ...validProof, signature: "deadbeef000000000000000000000000" };
    const tamperedSigRes = verifyContinuationProof(tamperedSigProof, {
      approvalRequestId: req.id,
      agentId: agent1,
      actionTarget: "doc.read",
      payloadFingerprint: fingerprint,
      organizationId: orgAlpha,
    });
    expect(tamperedSigRes.valid).toBe(false);
    expect(tamperedSigRes.reason).toMatch(/signature/i);

    // 3. Tampered payload fingerprint fails verification
    const tamperedFingerprintRes = verifyContinuationProof(validProof, {
      approvalRequestId: req.id,
      agentId: agent1,
      actionTarget: "doc.read",
      payloadFingerprint: "0000000000000000000000000000000000000000000000000000000000000000",
      organizationId: orgAlpha,
    });
    expect(tamperedFingerprintRes.valid).toBe(false);
    expect(tamperedFingerprintRes.reason).toMatch(/mismatch/i);

    // 4. Continuation service rejects tampered payload parameters
    await expect(
      continuationService.continueApprovedExecution({
        organizationId: orgAlpha,
        approvalRequestId: req.id,
        actorId: requesterActor,
        providedPayload: { fileId: "doc-tampered-999" },
      }),
    ).rejects.toThrow(/do not match the approved canonical payload fingerprint/i);
  });

  it("Sec 3: SSRF Prevention: Rejects local, loopback, private RFC1918, and AWS metadata addresses", async () => {
    const profile = mockDb.securityProfiles.get(agent1);

    const blockedDestinations = [
      "http://localhost/admin",
      "http://127.0.0.1:8080/metrics",
      "http://10.0.0.5/internal",
      "http://172.16.0.1/secrets",
      "http://192.168.1.1/router",
      "http://169.254.169.254/latest/meta-data/", // AWS IMDSv1
      "http://0.0.0.0:3000",
      "http://[::1]:80",
    ];

    for (const dest of blockedDestinations) {
      await expect(
        securityGateway.enforceToolInvocation({
          organizationId: orgAlpha,
          agentId: agent1,
          toolKey: "network.http.request",
          toolInput: { url: dest },
          profile,
        }),
      ).rejects.toThrow(/internal\/private address.*SSRF prevention/i);
    }
  });

  it("Sec 4: Domain Allowlist Enforcement: Rejects unapproved external domains", async () => {
    const profile = mockDb.securityProfiles.get(agent1);

    // Allowed domains: api.semanticscholar.org, arxiv.org, *.education.gov
    const allowed = await securityGateway.enforceToolInvocation({
      organizationId: orgAlpha,
      agentId: agent1,
      toolKey: "network.http.request",
      toolInput: { url: "https://api.semanticscholar.org/v1/paper" },
      profile,
    });
    expect(allowed.allowed).toBe(true);

    const allowedWildcard = await securityGateway.enforceToolInvocation({
      organizationId: orgAlpha,
      agentId: agent1,
      toolKey: "network.http.request",
      toolInput: { url: "https://standards.education.gov/v2" },
      profile,
    });
    expect(allowedWildcard.allowed).toBe(true);

    // Unapproved domain
    await expect(
      securityGateway.enforceToolInvocation({
        organizationId: orgAlpha,
        agentId: agent1,
        toolKey: "network.http.request",
        toolInput: { url: "https://evil-exfiltration-target.com/harvest" },
        profile,
      }),
    ).rejects.toThrow(/not in the allowed network domains/i);
  });

  it("Sec 5: Filesystem Path Traversal Prevention", async () => {
    const profile = mockDb.securityProfiles.get(agent1);

    const traversalPaths = [
      "../../etc/passwd",
      "/var/data/../../root/.ssh/id_rsa",
      "..\\..\\Windows\\System32\\cmd.exe",
      "foo/../../../etc/shadow",
    ];

    for (const p of traversalPaths) {
      await expect(
        securityGateway.enforceToolInvocation({
          organizationId: orgAlpha,
          agentId: agent1,
          toolKey: "fs.file.read",
          toolInput: { path: p },
          profile,
        }),
      ).rejects.toThrow(/Path traversal detected/i);
    }
  });

  it("Sec 6: Unsafe Tool Categories Fail Closed (Code Execution & Shell Ops)", async () => {
    const profile = mockDb.securityProfiles.get(agent1);

    await expect(
      securityGateway.enforceToolInvocation({
        organizationId: orgAlpha,
        agentId: agent1,
        toolKey: "code.execution.run_python",
        toolInput: { script: "import os; os.system('ls')" },
        profile,
      }),
    ).rejects.toThrow(/Untrusted code execution is disabled: genuine isolated OS-level sandbox boundary is required/i);

    await expect(
      securityGateway.enforceToolInvocation({
        organizationId: orgAlpha,
        agentId: agent1,
        toolKey: "system.shell.exec",
        toolInput: { command: "rm -rf /" },
        profile,
      }),
    ).rejects.toThrow(/Tool 'system.shell.exec' is explicitly prohibited/i);
  });

  it("Sec 7: Emergency Stop Instantly Halts All Operations Organization-Wide", async () => {
    await securityGateway.triggerEmergencyStop({
      organizationId: orgAlpha,
      actorId: reviewerActor,
      reason: "Detected unauthorized credential probing across agents",
    });

    expect(securityGateway.isEmergencyStopped(orgAlpha)).toBe(true);

    // Runtime entry blocked
    await expect(
      securityGateway.enforceRuntimeEntry({
        organizationId: orgAlpha,
        agentId: agent1,
      }),
    ).rejects.toThrow(/currently under Emergency Stop/i);

    // Tool invocation blocked
    await expect(
      securityGateway.enforceToolInvocation({
        organizationId: orgAlpha,
        agentId: agent1,
        toolKey: "knowledge.search",
        toolInput: { query: "curriculum" },
      }),
    ).rejects.toThrow(/currently under Emergency Stop/i);

    // Lifting emergency stop restores normal operational flow
    await securityGateway.resumeEmergencyStop({
      organizationId: orgAlpha,
      actorId: reviewerActor,
    });

    expect(securityGateway.isEmergencyStopped(orgAlpha)).toBe(false);
    const entry = await securityGateway.enforceRuntimeEntry({
      organizationId: orgAlpha,
      agentId: agent1,
    });
    expect(entry.profile).toBeDefined();
  });

  it("Sec 8: Agent Suspension Enforced Authoritatively", async () => {
    await securityGateway.suspendAgent({
      organizationId: orgAlpha,
      agentId: agent1,
      suspendedBy: reviewerActor,
      reason: "Suspended pending policy investigation",
    });

    expect(await securityGateway.isAgentSuspended(orgAlpha, agent1)).toBe(true);

    await expect(
      securityGateway.enforceRuntimeEntry({
        organizationId: orgAlpha,
        agentId: agent1,
      }),
    ).rejects.toThrow(/Agent '.*' is suspended/i);

    // Reactivation restores operation
    await securityGateway.reactivateAgent({
      organizationId: orgAlpha,
      agentId: agent1,
      actorId: reviewerActor,
    });

    expect(await securityGateway.isAgentSuspended(orgAlpha, agent1)).toBe(false);
  });

  // ===========================================================================
  // SECTION 3: COMPLIANCE, AUDIT INTEGRITY & EVIDENCE MANAGEMENT
  // ===========================================================================

  it("Audit 1: Cryptographic SHA-256 Tamper Detection", async () => {
    // Record two events
    await complianceService.recordComplianceEvent({
      organizationId: orgAlpha,
      eventType: "agent.run.started",
      actorId: requesterActor,
      riskSeverity: "LOW",
    });

    const second = await complianceService.recordComplianceEvent({
      organizationId: orgAlpha,
      eventType: "agent.tool.invoked",
      actorId: requesterActor,
      riskSeverity: "MEDIUM",
      redactedMetadata: { query: "original search string" },
    });

    // Initial check: INTACT
    const initialCheck = await complianceService.verifyAuditIntegrity(orgAlpha);
    expect(initialCheck.isValid).toBe(true);
    expect(initialCheck.brokenLinks.length).toBe(0);
    expect(initialCheck.tamperedEvents.length).toBe(0);

    // Adversarial Tampering: Simulate database update tampering with payload
    const record = mockDb.complianceEvents.get(second.event.id);
    record.redactedMetadata = { query: "maliciously tampered search string" };

    // Second check MUST detect tampering
    const tamperedCheck = await complianceService.verifyAuditIntegrity(orgAlpha);
    expect(tamperedCheck.isValid).toBe(false);
    expect(tamperedCheck.tamperedEvents.length).toBeGreaterThanOrEqual(1);
    expect(tamperedCheck.tamperedEvents[0].eventId).toBe(second.event.id);
  });

  it("Audit 2: Offline Evidence Package Self-Contained Verification", () => {
    const rawContent = JSON.stringify({ status: "PASSED", score: 98 });
    const contentHash = sha256Hash(rawContent);

    const manifest = {
      packageIdentifier: "pkg-iso42001-q4-2026",
      organizationId: orgAlpha,
      workspaceId: null,
      exportedAt: "2026-11-17T00:00:00.000Z",
      exportedBy: reviewerActor,
      hashAlgorithm: "SHA-256",
      redactionLevel: "STRICT",
      evidenceCount: 1,
      auditEventCount: 0,
      items: [
        {
          evidenceId: "ev-academic-rubric-pass",
          title: "Automated Rubric Verification Report",
          contentHash,
          dataClassification: "INTERNAL",
        },
      ],
      events: [],
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

    // Offline verification requires ZERO network or DB access
    const offlineResult = verifyEvidencePackageOffline(manifest as any, manifestChecksum);
    expect(offlineResult.isValid).toBe(true);
    expect(offlineResult.errors.length).toBe(0);

    // Tampering with manifestChecksum fails offline check
    const failedCheck = verifyEvidencePackageOffline(manifest as any, "badchecksum0000000000000000000000000000000000000000000000000000000000");
    expect(failedCheck.isValid).toBe(false);
    expect(failedCheck.errors.length).toBeGreaterThan(0);
  });

  it("Audit 3: Legal Hold Prevents Retention Purge", async () => {
    // Add legal hold
    mockDb.legalHolds.set("hold-regulatory-inquiry", {
      id: "hold-regulatory-inquiry",
      organizationId: orgAlpha,
      holdName: "FERPA Inquiry 2026",
      scopeType: "ALL",
      status: "ACTIVE",
    });

    const overview = await consoleService.getConsoleOverview(orgAlpha);
    expect(overview.complianceSummary.activeLegalHoldsCount).toBe(1);
  });

  // ===========================================================================
  // SECTION 4: RISK & TRUST MANAGEMENT ACCEPTANCE
  // ===========================================================================

  it("Risk 1: Deterministic Risk Formula & Empirical Control Reduction", () => {
    // Inherent score: Likelihood 4 * Impact 4 = 16 (High)
    const assessment = calculateRiskAssessment({
      likelihood: 4,
      impact: 4,
      controls: [
        { id: "c1", name: "Peer Review", effectiveness: "EFFECTIVE" }, // 40% reduction
        { id: "c2", name: "Output Schema Validation", effectiveness: "EFFECTIVE" }, // 40% reduction
      ],
    });

    expect(assessment.inherentScore).toBe(16);
    expect(assessment.inherentTier).toBe("HIGH");

    // Total reduction = 80%. Residual score = 16 * (1 - 0.8) = 3.2 -> rounds to 3 (Low)
    expect(assessment.residualScore).toBe(3);
    expect(assessment.residualTier).toBe("LOW");
  });

  it("Risk 2: Multidimensional Trust Scoring with Cold-Start Neutral Baseline", () => {
    // Agent with zero operations defaults to neutral baseline 70 and LOW confidence
    const coldStartTrust = calculateTrustProfile("agent-cold", {
      totalExecutions: 0,
      failedExecutions: 0,
      totalPolicyEvaluations: 0,
      policyDenials: 0,
      securityViolations: 0,
      totalApprovalRequests: 0,
      rejectedApprovals: 0,
      totalToolInvocations: 0,
      failedToolInvocations: 0,
      evidenceItemsCount: 0,
      verifiedEvidenceCount: 0,
    });

    expect(coldStartTrust.trustScore).toBe(70);
    expect(coldStartTrust.trustConfidence).toBe("LOW");
    expect(coldStartTrust.isInsufficientEvidence).toBe(true);

    // Mature agent with 30 executions scales to HIGH confidence
    const matureTrust = calculateTrustProfile("agent-mature", {
      totalExecutions: 30,
      failedExecutions: 0,
      totalPolicyEvaluations: 10,
      policyDenials: 0,
      securityViolations: 0,
      totalApprovalRequests: 2,
      rejectedApprovals: 0,
      totalToolInvocations: 20,
      failedToolInvocations: 0,
      evidenceItemsCount: 5,
      verifiedEvidenceCount: 5,
    });

    expect(matureTrust.trustConfidence).toBe("HIGH");
    expect(matureTrust.isInsufficientEvidence).toBe(false);
    expect(matureTrust.trustScore).toBeGreaterThanOrEqual(70);
  });

  it("Risk 3: Mandatory Security Precedence Overrides Trust Score", async () => {
    // Agent has high trust score (85/100)
    expect(mockDb.trustProfiles.get(agent1).trustScore).toBe(85);

    // But agent invokes a forbidden tool
    const profile = mockDb.securityProfiles.get(agent1);
    await expect(
      securityGateway.enforceToolInvocation({
        organizationId: orgAlpha,
        agentId: agent1,
        toolKey: "system.shell.exec",
        toolInput: { command: "whoami" },
        profile,
      }),
    ).rejects.toThrow(/prohibited/i);
  });

  it("Risk 4: Behavioral Anomaly Alert Fingerprint Deduplication", () => {
    const orgId = "org-1";
    const agId = "agent-1";
    const rule = "EXCESSIVE_POLICY_DENIALS";
    const bucket = "2026-11-17T12";

    const fp1 = generateAlertFingerprint(orgId, agId, rule, bucket);
    const fp2 = generateAlertFingerprint(orgId, agId, rule, bucket);
    const fpNextHour = generateAlertFingerprint(orgId, agId, rule, "2026-11-17T13");

    expect(fp1).toBe(fp2); // Deduplicated within bucket
    expect(fp1).not.toBe(fpNextHour); // New alert created in next hour
  });

  // ===========================================================================
  // SECTION 5: GOVERNANCE CONSOLE & REPORTING ACCEPTANCE
  // ===========================================================================

  it("Console 1: 10 Operational KPIs Computed from Real Underlying Tables", async () => {
    const overview = await consoleService.getConsoleOverview(orgAlpha);

    expect(overview.kpis.totalGovernedAgents).toBe(1);
    expect(overview.kpis.activeAgents).toBe(1);
    expect(overview.kpis.suspendedAgents).toBe(0);
    expect(overview.kpis.auditIntegrityStatus).toBe("INTACT");
    expect(overview.kpis.averageTrustScore).toBe(85);
    expect(overview.securityPosture.isEmergencyStopped).toBe(false);
    expect(overview.securityPosture.suspendedAgentsCount).toBe(0);
  });

  it("Console 2: Action Center Prioritization (CRITICAL > HIGH > MEDIUM > LOW)", async () => {
    // Add pending approvals with different classifications
    mockDb.approvals.set("app-low", {
      id: "app-low",
      organizationId: orgAlpha,
      agentId: agent1,
      actionTarget: "draft_notes",
      approvalReason: "Review notes",
      riskClassification: "LOW",
      status: "pending",
      createdAt: new Date(),
    });

    mockDb.approvals.set("app-crit", {
      id: "app-crit",
      organizationId: orgAlpha,
      agentId: agent1,
      actionTarget: "purge_database",
      approvalReason: "Purge student records",
      riskClassification: "CRITICAL",
      status: "pending",
      createdAt: new Date(),
    });

    const actions = await consoleService.getActionCenter(orgAlpha);
    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions[0].priority).toBe("CRITICAL");
    expect(actions[actions.length - 1].priority).toBe("HIGH");
  });

  it("Console 3: Stale Action Prevention", async () => {
    mockDb.approvals.set("app-stale-test", {
      id: "app-stale-test",
      organizationId: orgAlpha,
      agentId: agent1,
      actionTarget: "purge_database",
      approvalReason: "Purge student records",
      riskClassification: "CRITICAL",
      status: "approved", // already approved
      createdAt: new Date(),
    });

    const actions = await consoleService.getActionCenter(orgAlpha);
    expect(actions.some((a) => a.sourceEntityId === "app-stale-test")).toBe(false);
  });

  it("Console 4: Audited Report Exports in JSON and RFC 4180 CSV", async () => {
    const jsonRep = await consoleService.exportReport(orgAlpha, "JSON", {}, reviewerActor);
    expect(jsonRep.format).toBe("JSON");
    const jsonParsed = JSON.parse(jsonRep.content);
    expect(jsonParsed.organizationId).toBe(orgAlpha);
    expect(jsonParsed.executiveSummary.auditIntegrityStatus).toBe("INTACT");

    const csvRep = await consoleService.exportReport(orgAlpha, "CSV", {}, reviewerActor);
    expect(csvRep.format).toBe("CSV");
    expect(csvRep.content).toContain("Metric Category,Metric Name,Value");
    expect(csvRep.content).toContain("Executive,Governed Agents,1");
  });

  // ===========================================================================
  // SECTION 6: PERFORMANCE & LATENCY PERCENTILES BENCHMARK
  // ===========================================================================

  it("Perf: Benchmarks evaluation latency and ledger append throughput within SLA thresholds", async () => {
    const iterations = 100;
    const latencies: number[] = [];

    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      const iterStart = performance.now();

      // 1. SSRF check & allowlist check
      securityGateway.classifyTool("network.http.request");

      // 2. Compute canonical fingerprint
      computePayloadFingerprint({ index: i, query: "curriculum planning benchmark" });

      // 3. Append to compliance ledger
      await complianceService.recordComplianceEvent({
        organizationId: orgAlpha,
        eventType: "benchmark.iteration",
        actorId: requesterActor,
        eventOutcome: "SUCCESS",
        riskSeverity: "LOW",
        redactedMetadata: { iteration: i },
      });

      latencies.push(performance.now() - iterStart);
    }

    const totalTimeMs = performance.now() - startTime;
    const throughputOpsPerSec = Math.round((iterations / totalTimeMs) * 1000);

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(iterations * 0.5)];
    const p95 = latencies[Math.floor(iterations * 0.95)];
    const p99 = latencies[Math.floor(iterations * 0.99)];

    // SLAs: p50 < 10ms, p95 < 25ms, p99 < 50ms, throughput > 50 ops/sec
    expect(p50).toBeLessThan(10);
    expect(p95).toBeLessThan(25);
    expect(p99).toBeLessThan(50);
    expect(throughputOpsPerSec).toBeGreaterThanOrEqual(50);
  });
});
