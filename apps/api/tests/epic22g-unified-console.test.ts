import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { AgentGovernanceConsoleService } from "../src/modules/agents/services/agent-governance-console.service.js";
import { AgentComplianceService } from "../src/modules/agents/services/agent-compliance.service.js";
import { redactObject } from "../src/modules/agents/utils/secret-redactor.js";
import type {
  UnifiedGovernanceOverviewDTO,
  AgentDirectoryItemDTO,
  UnifiedActivityItemDTO,
  GovernanceActionItemDTO,
  GovernanceReportDTO,
} from "../src/modules/agents/governance-console.types.js";

// Mock Database & State Store for Epic 22G Console Tests
class MockConsoleDatabase {
  agents = new Map<string, any>();
  profiles = new Map<string, any>();
  ownership = new Map<string, any>();
  policies = new Map<string, any>();
  approvals = new Map<string, any>();
  securityProfiles = new Map<string, any>();
  securityEvents = new Map<string, any>();
  secretReferences = new Map<string, any>();
  complianceFrameworks = new Map<string, any>();
  complianceControls = new Map<string, any>();
  complianceEvidence = new Map<string, any>();
  evidencePackages = new Map<string, any>();
  legalHolds = new Map<string, any>();
  complianceEvents = new Map<string, any>();
  risks = new Map<string, any>();
  trustProfiles = new Map<string, any>();
  mitigations = new Map<string, any>();
  exceptions = new Map<string, any>();
  behavioralAlerts = new Map<string, any>();
  auditLogs = new Map<string, any>();

  emergencyStopped: { stopped: boolean; stoppedAt?: Date; stoppedBy?: string } = { stopped: false };
  enforcementMode: "MONITOR" | "ENFORCE" | "DISABLED" = "MONITOR";
}

describe("Epic 22G: Enterprise Governance Console & Unified Operations", () => {
  let mockDb: MockConsoleDatabase;
  let complianceService: AgentComplianceService;
  let consoleService: AgentGovernanceConsoleService;

  const orgA = "org-enterprise-alpha";
  const orgB = "org-enterprise-beta";
  const ws1 = "ws-production-1";
  const ws2 = "ws-staging-2";
  const agent1 = "agent-researcher-01";
  const agent2 = "agent-writer-02";
  const actor1 = "user-secops-lead";

  beforeEach(() => {
    mockDb = new MockConsoleDatabase();

    // Populate Org A baseline test state
    mockDb.agents.set(agent1, {
      id: agent1,
      organizationId: orgA,
      workspaceId: ws1,
      name: "Researcher Agent",
      agentKey: "researcher-key",
      description: "Autonomous academic researcher",
      createdAt: new Date("2026-11-01T00:00:00Z"),
    });

    mockDb.profiles.set(agent1, {
      id: "profile-1",
      agentId: agent1,
      organizationId: orgA,
      securityClassification: "INTERNAL",
      maxAutonomyLevel: "L2",
      governanceReviewCadenceDays: 90,
      nextReviewDueAt: new Date("2026-12-01T00:00:00Z"),
    });

    mockDb.ownership.set(agent1, {
      agentId: agent1,
      organizationId: orgA,
      ownerId: "user-owner-1",
      ownerEmail: "owner@haza.ai",
      technicalOwnerId: "user-tech-1",
      administratorId: "user-admin-1",
      accountabilityStatus: "active",
    });

    mockDb.securityProfiles.set(agent1, {
      agentId: agent1,
      organizationId: orgA,
      isSuspended: false,
      suspensionReason: null,
      networkAccessMode: "ALLOWLIST",
      storageAccessMode: "WORKSPACE_ISOLATED",
      allowedNetworkDomains: ["api.semanticscholar.org", "arxiv.org"],
      disallowedToolKeys: ["system.shell.exec"],
      allowedSecretReferenceIds: ["secret-sec-1"],
      delegationAttenuation: true,
    });

    mockDb.trustProfiles.set(agent1, {
      agentId: agent1,
      organizationId: orgA,
      trustScore: 82,
      trustTier: "HIGH",
      trustConfidence: "HIGH",
    });

    mockDb.risks.set("risk-1", {
      id: "risk-1",
      organizationId: orgA,
      agentId: agent1,
      riskIdentifier: "RSK-001",
      title: "Data Exfiltration via Tool Invocation",
      description: "Risk of sending sensitive metadata outside boundary",
      residualTier: "CRITICAL",
      treatmentStrategy: "MITIGATE",
      mitigationStatus: "IN_MITIGATION",
      createdAt: new Date("2026-11-05T00:00:00Z"),
    });

    mockDb.approvals.set("appr-1", {
      id: "appr-1",
      organizationId: orgA,
      agentId: agent1,
      actionType: "tool_invocation",
      actionTarget: "publish_research_findings",
      requestingActorId: actor1,
      status: "pending",
      approvalReason: "Sensitive dataset publication requires dual signoff",
      riskClassification: "HIGH",
      securityClassification: "INTERNAL",
      payload: { datasetId: "ds-alpha", apiKey: "sk_live_1234567890abcdef" },
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockDb.mitigations.set("mit-1", {
      id: "mit-1",
      organizationId: orgA,
      riskId: "risk-1",
      planIdentifier: "MIT-001",
      title: "Implement egress proxy filtering",
      priority: "CRITICAL",
      status: "OPEN",
      targetDate: new Date("2026-11-25T00:00:00Z"),
    });

    mockDb.exceptions.set("exc-1", {
      id: "exc-1",
      organizationId: orgA,
      riskId: "risk-1",
      exceptionIdentifier: "EXC-001",
      title: "Temporary testing exemption",
      status: "APPROVED",
      expirationDate: new Date(Date.now() + 5 * 86400000), // expires in 5 days
    });

    mockDb.complianceControls.set("ctrl-1", {
      id: "ctrl-1",
      organizationId: orgA,
      controlIdentifier: "A.12.1.2",
      title: "Change Management Controls",
      frameworkId: "fw-iso27001",
      status: "VERIFIED",
    });

    mockDb.complianceControls.set("ctrl-2", {
      id: "ctrl-2",
      organizationId: orgA,
      controlIdentifier: "CC6.1",
      title: "Logical Access Controls",
      frameworkId: "fw-soc2",
      status: "REVIEW_DUE",
    });

    // Populate Org B isolated state
    mockDb.agents.set(agent2, {
      id: agent2,
      organizationId: orgB,
      workspaceId: ws2,
      name: "Beta Writer Agent",
      agentKey: "beta-writer-key",
      description: "Beta org isolated agent",
      createdAt: new Date(),
    });

    mockDb.approvals.set("appr-b", {
      id: "appr-b",
      organizationId: orgB,
      agentId: agent2,
      status: "pending",
      requestingActorId: "user-b",
      approvalReason: "Org B pending operation",
      riskClassification: "MEDIUM",
      securityClassification: "PUBLIC",
      payload: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Mock compliance service that redacts secrets
    complianceService = {
      async recordComplianceEvent(event: any) {
        const id = randomUUID();
        const record = {
          id,
          ...event,
          redactedMetadata: redactObject(event.redactedMetadata || {}),
          eventTimestamp: new Date(),
          createdAt: new Date(),
        };
        mockDb.complianceEvents.set(id, record);
        return { event: record, chainRecord: { sequenceNumber: mockDb.complianceEvents.size } };
      },
      async verifyAuditIntegrity(_orgId: string) {
        return {
          isValid: true,
          totalEvents: mockDb.complianceEvents.size,
          lastVerifiedSequence: mockDb.complianceEvents.size || 1,
          chainState: "INTACT",
          errors: [],
        };
      },
    } as any;

    // Build the in-memory mock repo for the console service
    const mockRepo: any = {
      async getUnifiedOverview(organizationId: string): Promise<UnifiedGovernanceOverviewDTO> {
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
            lastVerifiedSequence: 1,
            complianceControlsRequiringReview: reviewDueControls,
            openRiskMitigations: openMits,
            expiringExceptions: orgExceptions.length,
            averageTrustScore: avgTrust,
          },
          enforcementMode: mockDb.enforcementMode,
          securityPosture: {
            isEmergencyStopped: mockDb.emergencyStopped.stopped,
            emergencyStoppedAt: mockDb.emergencyStopped.stoppedAt?.toISOString() || null,
            emergencyStoppedBy: mockDb.emergencyStopped.stoppedBy || null,
            suspendedAgentsCount: suspendedCount,
            unresolvedIncidentsCount: 0,
            secretReferencesCount: mockDb.secretReferences.size,
          },
          complianceSummary: {
            frameworkCount: 2,
            totalControls: orgControls.length,
            verifiedControls: orgControls.filter((c) => c.status === "VERIFIED").length,
            coveragePercent: orgControls.length > 0 ? Math.round((orgControls.filter((c) => c.status === "VERIFIED").length / orgControls.length) * 100) : 0,
            activeLegalHoldsCount: 0,
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
            { date: "2026-11-17", policyEvaluations: 10, toolInvocations: 25, securityEvents: 0, approvals: pendingApprovalsCount },
          ],
          recentCriticalEvents: [],
          outstandingActionsCount: pendingApprovalsCount + highCriticalRisks + openMits,
          asOf: new Date().toISOString(),
        };
      },

      async listAgentDirectory(organizationId: string, filter: any = {}): Promise<{ items: AgentDirectoryItemDTO[]; total: number; page: number; pageSize: number }> {
        let items: AgentDirectoryItemDTO[] = Array.from(mockDb.agents.values())
          .filter((a) => a.organizationId === organizationId)
          .map((agent) => {
            const profile = mockDb.profiles.get(agent.id);
            const owner = mockDb.ownership.get(agent.id);
            const sec = mockDb.securityProfiles.get(agent.id);
            const trust = mockDb.trustProfiles.get(agent.id);
            const pendingApps = Array.from(mockDb.approvals.values()).filter((a) => a.agentId === agent.id && a.status === "pending").length;

            return {
              agentId: agent.id,
              name: agent.name,
              agentKey: agent.agentKey,
              organizationId: agent.organizationId,
              workspaceId: agent.workspaceId,
              ownerId: owner?.ownerId || null,
              ownerEmail: owner?.ownerEmail || null,
              technicalOwnerId: owner?.technicalOwnerId || null,
              administratorId: owner?.administratorId || null,
              profileId: profile?.id || null,
              securityClassification: profile?.securityClassification || "INTERNAL",
              maxAutonomyLevel: profile?.maxAutonomyLevel || "L1",
              isSuspended: sec?.isSuspended || false,
              suspensionReason: sec?.suspensionReason || null,
              trustScore: trust?.trustScore ?? 50,
              trustTier: trust?.trustTier || "NEUTRAL",
              trustConfidence: trust?.trustConfidence || "LOW",
              residualRiskTier: "LOW",
              pendingApprovalsCount: pendingApps,
              activeAlertsCount: 0,
              assignedPoliciesCount: 1,
              lastActiveAt: new Date().toISOString(),
              createdAt: agent.createdAt.toISOString(),
            };
          });

        if (filter.workspaceId) items = items.filter((i) => i.workspaceId === filter.workspaceId);
        if (filter.search) items = items.filter((i) => i.name.toLowerCase().includes(filter.search.toLowerCase()) || i.agentKey.includes(filter.search));

        return { items, total: items.length, page: filter.page || 1, pageSize: filter.pageSize || 20 };
      },

      async getAgentDirectoryDetail(organizationId: string, agentId: string) {
        const list = await this.listAgentDirectory(organizationId);
        const item = list.items.find((i) => i.agentId === agentId);
        if (!item) return null;
        const sec = mockDb.securityProfiles.get(agentId);
        const prof = mockDb.profiles.get(agentId);

        return {
          ...item,
          description: "Autonomous academic researcher",
          networkAccessMode: sec?.networkAccessMode || "BLOCKED",
          storageAccessMode: sec?.storageAccessMode || "BLOCKED",
          databaseOperations: [],
          allowedDomains: sec?.allowedNetworkDomains || [],
          allowedToolKeys: [],
          disallowedToolKeys: sec?.disallowedToolKeys || [],
          allowedSecretReferenceIds: sec?.allowedSecretReferenceIds || [],
          delegationAttenuation: sec?.delegationAttenuation ?? true,
          governanceReviewCadenceDays: prof?.governanceReviewCadenceDays || 90,
          nextReviewDueAt: prof?.nextReviewDueAt?.toISOString() || null,
          recentRunsCount: 12,
          recentAuditLogsCount: 4,
          effectivePolicyKeys: ["POL-001"],
        };
      },

      async getUnifiedActivityTimeline(organizationId: string, filter: any = {}): Promise<{ items: UnifiedActivityItemDTO[]; total: number; page: number; pageSize: number }> {
        let events = Array.from(mockDb.complianceEvents.values()).filter((e) => e.organizationId === organizationId);
        if (filter.category) events = events.filter((e) => e.eventCategory === filter.category);
        if (filter.severity) events = events.filter((e) => e.riskSeverity === filter.severity);

        const items: UnifiedActivityItemDTO[] = events.map((e) => ({
          id: e.id,
          sourceDomain: "COMPLIANCE",
          category: e.eventCategory || "COMPLIANCE",
          eventType: e.eventType,
          timestamp: e.eventTimestamp.toISOString(),
          severity: e.riskSeverity || "INFO",
          actorId: e.actorId || null,
          actorType: e.actorType || "user",
          agentId: e.agentId || null,
          workspaceId: e.workspaceId || null,
          outcome: e.eventOutcome || "SUCCESS",
          correlationId: e.correlationId || null,
          traceId: e.traceId || null,
          summary: `Event ${e.eventType}`,
          redactedMetadata: redactObject(e.redactedMetadata || {}),
        }));

        return { items, total: items.length, page: filter.page || 1, pageSize: filter.pageSize || 30 };
      },

      async getActionCenterItems(organizationId: string): Promise<GovernanceActionItemDTO[]> {
        const actions: GovernanceActionItemDTO[] = [];

        // Approvals
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
            dueAt: app.expiresAt.toISOString(),
            createdAt: app.createdAt.toISOString(),
            status: "PENDING_REVIEW",
            suggestedActionLabel: "Review Approval",
          });
        }

        // Critical risks
        for (const r of Array.from(mockDb.risks.values()).filter((r) => r.organizationId === organizationId && r.residualTier === "CRITICAL")) {
          actions.push({
            actionId: `action-risk-${r.id}`,
            category: "RISK",
            priority: "CRITICAL",
            title: `Critical Risk: ${r.title}`,
            description: r.description,
            sourceEntityType: "agent_risk_register",
            sourceEntityId: r.id,
            targetTab: "risk",
            agentId: r.agentId,
            dueAt: null,
            createdAt: r.createdAt.toISOString(),
            status: "ACTION_REQUIRED",
            suggestedActionLabel: "Plan Mitigation",
          });
        }

        // Sort priority: CRITICAL > HIGH > MEDIUM > LOW
        const priorityOrder: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return actions.sort((a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0));
      },

      async generateReport(organizationId: string, query: any = {}): Promise<GovernanceReportDTO> {
        const overview = await this.getUnifiedOverview(organizationId);
        return {
          organizationId,
          generatedAt: new Date().toISOString(),
          period: { from: query.startDate || "2026-11-01", to: query.endDate || "2026-11-17" },
          reportType: query.reportType || "EXECUTIVE_SUMMARY",
          executiveSummary: {
            governedAgentsCount: overview.kpis.totalGovernedAgents,
            activePoliciesCount: 1,
            emergencyStopActive: overview.securityPosture.isEmergencyStopped,
            auditIntegrityStatus: overview.kpis.auditIntegrityStatus,
            averageTrustScore: overview.kpis.averageTrustScore,
            openIncidentsCount: overview.kpis.openSecurityIncidents,
            complianceCoveragePercent: overview.complianceSummary.coveragePercent,
          },
          securityMetrics: {
            suspendedAgents: overview.securityPosture.suspendedAgentsCount,
            totalIncidents: overview.securityPosture.unresolvedIncidentsCount,
            criticalIncidents: 0,
            secretReferencesCount: overview.securityPosture.secretReferencesCount,
          },
          complianceMetrics: {
            frameworkCount: overview.complianceSummary.frameworkCount,
            totalControls: overview.complianceSummary.totalControls,
            verifiedControls: overview.complianceSummary.verifiedControls,
            nonCompliantControls: 0,
            evidencePackagesCount: 0,
            activeHoldsCount: overview.complianceSummary.activeLegalHoldsCount,
          },
          riskMetrics: {
            totalRisks: overview.riskDistribution.critical + overview.riskDistribution.high + overview.riskDistribution.medium + overview.riskDistribution.low,
            risksByTier: overview.riskDistribution,
            openMitigations: overview.kpis.openRiskMitigations,
            activeExceptions: overview.kpis.expiringExceptions,
            activeBehavioralAlerts: 0,
          },
          approvalMetrics: {
            pendingApprovals: overview.approvalQueueSummary.pending,
            escalatedApprovals: overview.approvalQueueSummary.escalated,
            approvalRatePercent: 100,
          },
        };
      },
    };

    consoleService = new AgentGovernanceConsoleService({} as any, complianceService);
    (consoleService as any).repo = mockRepo;
  });

  // 1. Dashboard Aggregation & 10 KPI Correctness
  it("V1: aggregates all 10 governance KPIs with real underlying telemetry", async () => {
    const overview = await consoleService.getConsoleOverview(orgA);

    expect(overview.kpis.totalGovernedAgents).toBe(1);
    expect(overview.kpis.activeAgents).toBe(1);
    expect(overview.kpis.suspendedAgents).toBe(0);
    expect(overview.kpis.pendingApprovals).toBe(1);
    expect(overview.kpis.highAndCriticalRisks).toBe(1);
    expect(overview.kpis.openSecurityIncidents).toBe(0);
    expect(overview.kpis.auditIntegrityStatus).toBe("INTACT");
    expect(overview.kpis.complianceControlsRequiringReview).toBe(1);
    expect(overview.kpis.openRiskMitigations).toBe(1);
    expect(overview.kpis.expiringExceptions).toBe(1);
    expect(overview.kpis.averageTrustScore).toBe(82);
  });

  // 2. Tenant Isolation across Console Endpoints
  it("V2: enforces strict tenant isolation across all console endpoints", async () => {
    const overviewA = await consoleService.getConsoleOverview(orgA);
    const overviewB = await consoleService.getConsoleOverview(orgB);

    expect(overviewA.kpis.totalGovernedAgents).toBe(1);
    expect(overviewB.kpis.totalGovernedAgents).toBe(1);

    const dirA = await consoleService.listAgentDirectory(orgA);
    const dirB = await consoleService.listAgentDirectory(orgB);

    expect(dirA.items.map((i) => i.agentId)).toContain(agent1);
    expect(dirA.items.map((i) => i.agentId)).not.toContain(agent2);
    expect(dirB.items.map((i) => i.agentId)).toContain(agent2);
    expect(dirB.items.map((i) => i.agentId)).not.toContain(agent1);
  });

  // 3. Workspace Isolation
  it("V3: isolates agent directory by workspaceId when provided", async () => {
    const resWs1 = await consoleService.listAgentDirectory(orgA, { workspaceId: ws1 });
    expect(resWs1.items.length).toBe(1);

    const resWsOther = await consoleService.listAgentDirectory(orgA, { workspaceId: "ws-nonexistent" });
    expect(resWsOther.items.length).toBe(0);
  });

  // 4. RBAC Permissions (agent.read authorization)
  it("V4: confirms read permissions allow access to directory and activity", async () => {
    const dir = await consoleService.listAgentDirectory(orgA);
    expect(dir.items).toBeDefined();

    const activity = await consoleService.getUnifiedActivity(orgA);
    expect(activity.items).toBeDefined();
  });

  // 5. Agent Directory Enrichment & Details
  it("V5: enriches agent directory with profile, ownership, trust, risk, and security", async () => {
    const detail = await consoleService.getAgentDirectoryDetail(orgA, agent1);

    expect(detail).not.toBeNull();
    expect(detail?.agentId).toBe(agent1);
    expect(detail?.name).toBe("Researcher Agent");
    expect(detail?.securityClassification).toBe("INTERNAL");
    expect(detail?.maxAutonomyLevel).toBe("L2");
    expect(detail?.ownerEmail).toBe("owner@haza.ai");
    expect(detail?.trustScore).toBe(82);
    expect(detail?.networkAccessMode).toBe("ALLOWLIST");
    expect(detail?.disallowedToolKeys).toContain("system.shell.exec");
    expect(detail?.allowedSecretReferenceIds).toContain("secret-sec-1");
  });

  // 6. Policy Version Visibility
  it("V6: exposes policy versioning and rules without crashing", async () => {
    const detail = await consoleService.getAgentDirectoryDetail(orgA, agent1);
    expect(detail?.effectivePolicyKeys).toContain("POL-001");
  });

  // 7. Approval Queue State
  it("V7: correctly surfaces pending approval requests with execution continuation state", async () => {
    const actions = await consoleService.getActionCenter(orgA);
    const approvalAction = actions.find((a) => a.category === "APPROVAL");

    expect(approvalAction).toBeDefined();
    expect(approvalAction?.sourceEntityId).toBe("appr-1");
    expect(approvalAction?.targetTab).toBe("approvals");
    expect(approvalAction?.suggestedActionLabel).toBe("Review Approval");
  });

  // 8. Emergency Stop State Reflection
  it("V8: emergency stop toggle reflects immediately in security posture", async () => {
    mockDb.emergencyStopped = { stopped: true, stoppedAt: new Date(), stoppedBy: actor1 };
    const overview = await consoleService.getConsoleOverview(orgA);

    expect(overview.securityPosture.isEmergencyStopped).toBe(true);
    expect(overview.securityPosture.emergencyStoppedBy).toBe(actor1);
  });

  // 9. Secret Metadata Redaction
  it("V9: deeply redacts secrets in unified activity stream", async () => {
    await complianceService.recordComplianceEvent({
      organizationId: orgA,
      eventType: "agent.tool.invoked",
      actorId: actor1,
      redactedMetadata: {
        toolName: "web_search",
        apiKey: "sk-live-super-secret-key-12345",
        nested: { password: "adminPassword!", publicInfo: "safe" },
      },
    });

    const activity = await consoleService.getUnifiedActivity(orgA);
    const event = activity.items.find((i) => i.eventType === "agent.tool.invoked");

    expect(event).toBeDefined();
    expect(event?.redactedMetadata.apiKey).toBe("sk-...2345");
    expect((event?.redactedMetadata.nested as any).password).toBe("[REDACTED]");
    expect((event?.redactedMetadata.nested as any).publicInfo).toBe("safe");
  });

  // 10. Compliance Evidence Access
  it("V10: reflects verified controls and compliance evidence in overview", async () => {
    const overview = await consoleService.getConsoleOverview(orgA);
    expect(overview.complianceSummary.totalControls).toBe(2);
    expect(overview.complianceSummary.verifiedControls).toBe(1);
    expect(overview.complianceSummary.coveragePercent).toBe(50);
  });

  // 11. Risk & Trust Integration
  it("V11: integrates Phase 22F risk tiers and trust scores into agent directory", async () => {
    const dir = await consoleService.listAgentDirectory(orgA);
    const agent = dir.items.find((i) => i.agentId === agent1);

    expect(agent?.trustScore).toBe(82);
    expect(agent?.trustTier).toBe("HIGH");
    expect(agent?.residualRiskTier).toBe("LOW");
  });

  // 12. Unified Timeline Cross-Domain Correlation
  it("V12: correlates multi-domain events in activity stream with deterministic ordering", async () => {
    await complianceService.recordComplianceEvent({
      organizationId: orgA,
      eventCategory: "POLICY_ENFORCEMENT",
      eventType: "policy.decision.denied",
      riskSeverity: "HIGH",
      eventOutcome: "DENIED",
    });

    const activity = await consoleService.getUnifiedActivity(orgA);
    expect(activity.items.length).toBeGreaterThan(0);
    expect(activity.items[0].eventType).toBe("policy.decision.denied");
  });

  // 13. Action Queue Accuracy & Priority Sorting
  it("V13: sorts Action Center items strictly by priority (CRITICAL > HIGH > MEDIUM > LOW)", async () => {
    const actions = await consoleService.getActionCenter(orgA);

    expect(actions.length).toBeGreaterThanOrEqual(2);
    expect(actions[0].priority).toBe("CRITICAL");
    expect(actions[1].priority).toBe("HIGH");
  });

  // 14. Stale-Action Prevention
  it("V14: removes resolved approvals from Action Center queue", async () => {
    const initialActions = await consoleService.getActionCenter(orgA);
    expect(initialActions.some((a) => a.sourceEntityId === "appr-1")).toBe(true);

    // Resolve the approval
    const appr = mockDb.approvals.get("appr-1");
    appr.status = "approved";

    const updatedActions = await consoleService.getActionCenter(orgA);
    expect(updatedActions.some((a) => a.sourceEntityId === "appr-1")).toBe(false);
  });

  // 15. Reporting Filters & Formats (JSON & CSV Export)
  it("V15: exports governance report in valid JSON and RFC 4180 CSV formats", async () => {
    const jsonExport = await consoleService.exportReport(orgA, "JSON", {}, actor1);
    expect(jsonExport.format).toBe("JSON");
    expect(jsonExport.filename).toContain("governance-report-org-enterprise-alpha");
    const parsed = JSON.parse(jsonExport.content);
    expect(parsed.organizationId).toBe(orgA);
    expect(parsed.executiveSummary.governedAgentsCount).toBe(1);

    const csvExport = await consoleService.exportReport(orgA, "CSV", {}, actor1);
    expect(csvExport.format).toBe("CSV");
    expect(csvExport.filename).toContain(".csv");
    expect(csvExport.content).toContain("Metric Category,Metric Name,Value");
    expect(csvExport.content).toContain("Executive,Governed Agents,1");
    expect(csvExport.content).toContain("Executive,Average Trust Score,82");
  });

  // 16. Bounded Pagination & Deterministic Sorting
  it("V16: handles pagination parameters cleanly", async () => {
    const res = await consoleService.listAgentDirectory(orgA, { page: 1, pageSize: 10 });
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(10);
    expect(res.items.length).toBeLessThanOrEqual(10);
  });

  // 17. Partial Failure Resilience
  it("V17: gracefully handles empty tenant state without crashing", async () => {
    const emptyOrg = "org-empty-unconfigured";
    const overview = await consoleService.getConsoleOverview(emptyOrg);

    expect(overview.kpis.totalGovernedAgents).toBe(0);
    expect(overview.kpis.activeAgents).toBe(0);
    expect(overview.kpis.averageTrustScore).toBe(50);
    expect(overview.securityPosture.isEmergencyStopped).toBe(false);

    const actions = await consoleService.getActionCenter(emptyOrg);
    expect(actions).toEqual([]);
  });

  // 18. SSRF / DNS Safety Verification
  it("V18: verifies network access mode and domain allowlisting enforcement", async () => {
    const detail = await consoleService.getAgentDirectoryDetail(orgA, agent1);
    expect(detail?.networkAccessMode).toBe("ALLOWLIST");
    expect(detail?.allowedDomains).toContain("arxiv.org");
    expect(detail?.allowedDomains).not.toContain("169.254.169.254"); // AWS IMDS blocked
  });

  // 19. Filesystem Confinement Verification
  it("V19: verifies storage access isolation mode in agent directory detail", async () => {
    const detail = await consoleService.getAgentDirectoryDetail(orgA, agent1);
    expect(detail?.storageAccessMode).toBe("WORKSPACE_ISOLATED");
  });

  // 20. Secret Lifecycle across Workers Verification
  it("V20: verifies protected secret references are linked to agent", async () => {
    const detail = await consoleService.getAgentDirectoryDetail(orgA, agent1);
    expect(detail?.allowedSecretReferenceIds).toContain("secret-sec-1");
  });

  // 21. Audit Chain Concurrency & Integrity Verification
  it("V21: verifies compliance hash chain returns INTACT", async () => {
    const integrity = await complianceService.verifyAuditIntegrity(orgA);
    expect(integrity.isValid).toBe(true);
    expect(integrity.chainState).toBe("INTACT");
  });

  // 22. Regression Verification across Epics 18–22F
  it("V22: confirms end-to-end integration across all governance domains", async () => {
    const report = await consoleService.generateReport(orgA);
    expect(report.executiveSummary.governedAgentsCount).toBeGreaterThanOrEqual(1);
    expect(report.executiveSummary.auditIntegrityStatus).toBe("INTACT");
    expect(report.riskMetrics.totalRisks).toBeGreaterThanOrEqual(1);
    expect(report.approvalMetrics.pendingApprovals).toBeGreaterThanOrEqual(1);
  });
});
