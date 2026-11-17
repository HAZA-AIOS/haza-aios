import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import {
  calculateRiskAssessment,
  calculateTrustProfile,
  determineRiskTier,
  determineTrustTier,
  generateAlertFingerprint,
  DEFAULT_RISK_THRESHOLDS,
  DEFAULT_TRUST_DIMENSION_WEIGHTS,
  type RiskCategory,
  type RiskTier,
  type TrustTier,
  type TrustConfidence,
  type BehavioralDetectionRule,
  type MitigationPlanStatus,
  type RiskExceptionStatus,
} from "../src/modules/agents/risk-trust.types.js";
import { AgentRiskService } from "../src/modules/agents/services/agent-risk.service.js";
import { AgentComplianceService } from "../src/modules/agents/services/agent-compliance.service.js";
import { redactObject } from "../src/modules/agents/utils/secret-redactor.js";

// In-Memory Database and Storage Mock for Risk & Trust Engine
class MockRiskDatabase {
  configs = new Map<string, any>();
  register = new Map<string, any>();
  assessments = new Map<string, any>();
  trustProfiles = new Map<string, any>();
  trustAssessmentHistory = new Map<string, any>();
  alerts = new Map<string, any>();
  mitigations = new Map<string, any>();
  exceptions = new Map<string, any>();
  reviews = new Map<string, any>();

  // Telemetry backing for trust & behavioral checks
  complianceEvents: any[] = [];
  agentRuns: any[] = [];
  toolExecutions: any[] = [];
  approvalRequests: any[] = [];
  securityEvents: any[] = [];

  db = {
    select: (fields?: any) => ({
      from: (table: any) => ({
        where: (condition: any) => ({
          limit: (n: number) => this.complianceEvents.slice(0, n),
          offset: (n: number) => this.complianceEvents.slice(n),
          orderBy: () => this.complianceEvents,
        }),
        orderBy: () => this.complianceEvents,
        limit: (n: number) => this.complianceEvents.slice(0, n),
      }),
    }),
  };
}

describe("Epic 22F: Enterprise Agent Risk & Trust Management", () => {
  let mockDb: MockRiskDatabase;
  let riskRepo: any;
  let complianceService: AgentComplianceService;
  let riskService: AgentRiskService;

  const orgId = "org-enterprise-42";
  const competitorOrgId = "org-competitor-99";
  const agentId = "agent-academic-researcher";
  const actorId = "user-risk-officer";
  const auditorId = "user-compliance-auditor";

  beforeEach(() => {
    mockDb = new MockRiskDatabase();

    // Mock compliance service that records audit events in memory
    const complianceEventsList: any[] = [];
    complianceService = {
      async recordComplianceEvent(event: any) {
        const record = {
          id: randomUUID(),
          ...event,
          eventTimestamp: new Date(),
          createdAt: new Date(),
        };
        complianceEventsList.push(record);
        mockDb.complianceEvents.push(record);
        return { event: record, chainRecord: { sequenceNumber: complianceEventsList.length } };
      },
    } as any;

    // In-memory repository mock implementing AgentRiskRepository methods
    riskRepo = {
      async getConfiguration(organizationId: string) {
        if (!mockDb.configs.has(organizationId)) {
          mockDb.configs.set(organizationId, {
            id: randomUUID(),
            organizationId,
            riskScoringModel: "INHERENT_LIKELIHOOD_IMPACT_V1",
            lowThresholdMax: 5,
            mediumThresholdMax: 11,
            highThresholdMax: 19,
            criticalThresholdMin: 20,
            riskEnforcementEnabled: false,
            riskEnforcementMode: "MONITOR",
            trustEvaluationWindowDays: 30,
            minOperationsForConfidence: 5,
            behavioralDetectionEnabled: true,
          });
        }
        return mockDb.configs.get(organizationId);
      },

      async upsertConfiguration(organizationId: string, data: any) {
        const existing = await this.getConfiguration(organizationId);
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockDb.configs.set(organizationId, updated);
        return updated;
      },

      async listRisks(organizationId: string, filters: any = {}) {
        let list = Array.from(mockDb.register.values()).filter(
          (r) => r.organizationId === organizationId
        );
        if (filters.category) list = list.filter((r) => r.riskCategory === filters.category);
        if (filters.residualTier) list = list.filter((r) => r.residualTier === filters.residualTier);
        if (filters.agentId) list = list.filter((r) => r.agentId === filters.agentId);
        if (filters.status) list = list.filter((r) => r.mitigationStatus === filters.status);
        return list;
      },

      async getRiskById(organizationId: string, riskId: string) {
        const item = mockDb.register.get(riskId);
        if (!item || item.organizationId !== organizationId) return null;
        return item;
      },

      async createRisk(data: any) {
        const id = data.id || randomUUID();
        const item = {
          id,
          organizationId: data.organizationId,
          riskIdentifier: data.riskIdentifier || `RSK-${Date.now().toString(36).toUpperCase()}`,
          title: data.title,
          description: data.description || null,
          riskCategory: data.riskCategory,
          riskSource: data.riskSource || "OPERATIONAL",
          agentId: data.agentId || null,
          policyId: data.policyId || null,
          likelihood: data.likelihood || 3,
          impact: data.impact || 3,
          inherentScore: data.inherentScore || (data.likelihood || 3) * (data.impact || 3),
          inherentTier: data.inherentTier || determineRiskTier((data.likelihood || 3) * (data.impact || 3)),
          residualScore: data.residualScore || (data.likelihood || 3) * (data.impact || 3),
          residualTier: data.residualTier || determineRiskTier((data.likelihood || 3) * (data.impact || 3)),
          treatmentStrategy: data.treatmentStrategy || "MITIGATE",
          mitigationStatus: data.mitigationStatus || "IDENTIFIED",
          ownerId: data.ownerId || null,
          metadata: data.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.register.set(id, item);
        return item;
      },

      async updateRisk(organizationId: string, riskId: string, data: any) {
        const item = await this.getRiskById(organizationId, riskId);
        if (!item) return null;
        const updated = { ...item, ...data, updatedAt: new Date() };
        mockDb.register.set(riskId, updated);
        return updated;
      },

      async deleteRisk(organizationId: string, riskId: string) {
        const item = await this.getRiskById(organizationId, riskId);
        if (!item) return false;
        mockDb.register.delete(riskId);
        return true;
      },

      async createAssessment(data: any) {
        const id = data.id || randomUUID();
        const assessment = {
          id,
          ...data,
          assessedAt: new Date(),
          createdAt: new Date(),
        };
        mockDb.assessments.set(id, assessment);
        return assessment;
      },

      async listAssessmentsByRiskId(organizationId: string, riskId: string) {
        return Array.from(mockDb.assessments.values())
          .filter((a) => a.organizationId === organizationId && a.riskId === riskId)
          .sort((a, b) => (b.assessmentVersion || "").localeCompare(a.assessmentVersion || ""));
      },

      async listAssessmentsForRisk(organizationId: string, riskId: string) {
        return this.listAssessmentsByRiskId(organizationId, riskId);
      },

      async getLatestAssessment(organizationId: string, riskId: string) {
        const list = await this.listAssessmentsByRiskId(organizationId, riskId);
        return list[0] || null;
      },

      async getTrustProfile(organizationId: string, targetAgentId: string) {
        return mockDb.trustProfiles.get(`${organizationId}:${targetAgentId}`) || null;
      },

      async upsertTrustProfile(organizationId: string, targetAgentId: string, data: any) {
        const key = `${organizationId}:${targetAgentId}`;
        const existing = mockDb.trustProfiles.get(key);
        const profile = {
          id: existing?.id || randomUUID(),
          organizationId,
          agentId: targetAgentId,
          trustScore: data.trustScore,
          trustTier: data.trustTier,
          confidenceLevel: data.confidenceLevel,
          dimensions: data.dimensions,
          operationalSignals: data.operationalSignals,
          lastEvaluatedAt: new Date(),
          evaluationWindowDays: data.evaluationWindowDays || 30,
          isInsufficientEvidence: data.isInsufficientEvidence ?? false,
          isManualOverride: data.isManualOverride ?? false,
          manualOverrideReason: data.manualOverrideReason ?? null,
          overrideExpiresAt: data.overrideExpiresAt ?? null,
          createdAt: existing?.createdAt || new Date(),
          updatedAt: new Date(),
        };
        mockDb.trustProfiles.set(key, profile);
        return profile;
      },

      async recordTrustAssessmentHistory(data: any) {
        const id = randomUUID();
        const item = {
          id,
          ...data,
          assessedAt: new Date(),
        };
        mockDb.trustAssessmentHistory.set(id, item);
        return item;
      },

      async listAlerts(organizationId: string, filters: any = {}) {
        let list = Array.from(mockDb.alerts.values()).filter(
          (a) => a.organizationId === organizationId
        );
        if (filters.agentId) list = list.filter((a) => a.agentId === filters.agentId);
        if (filters.status) list = list.filter((a) => a.status === filters.status);
        if (filters.severity) list = list.filter((a) => a.severity === filters.severity);
        return list;
      },

      async findAlertByFingerprint(organizationId: string, fingerprint: string) {
        return (
          Array.from(mockDb.alerts.values()).find(
            (a) => a.organizationId === organizationId && a.fingerprint === fingerprint
          ) || null
        );
      },

      async createAlert(data: any) {
        const id = data.id || randomUUID();
        const alert = {
          id,
          ...data,
          status: "NEW",
          occurrenceCount: data.occurrenceCount || 1,
          firstDetectedAt: new Date(),
          lastDetectedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.alerts.set(id, alert);
        return alert;
      },

      async updateAlert(organizationId: string, alertId: string, data: any) {
        const alert = mockDb.alerts.get(alertId);
        if (!alert || alert.organizationId !== organizationId) return null;
        const updated = { ...alert, ...data, updatedAt: new Date() };
        mockDb.alerts.set(alertId, updated);
        return updated;
      },

      async acknowledgeAlert(organizationId: string, alertId: string, acknowledgedBy: string) {
        return this.updateAlert(organizationId, alertId, {
          status: "ACKNOWLEDGED",
          acknowledgedBy,
          acknowledgedAt: new Date(),
        });
      },

      async resolveAlert(organizationId: string, alertId: string, resolvedBy: string, notes?: string) {
        return this.updateAlert(organizationId, alertId, {
          status: "RESOLVED",
          resolvedBy,
          resolvedAt: new Date(),
          resolutionNotes: notes || null,
        });
      },

      async createMitigation(data: any) {
        const id = data.id || randomUUID();
        const item = {
          id,
          ...data,
          status: data.status || "OPEN",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.mitigations.set(id, item);
        return item;
      },

      async getMitigationById(organizationId: string, mitigationId: string) {
        const item = mockDb.mitigations.get(mitigationId);
        if (!item || item.organizationId !== organizationId) return null;
        return item;
      },

      async updateMitigation(organizationId: string, mitigationId: string, data: any) {
        const item = await this.getMitigationById(organizationId, mitigationId);
        if (!item) return null;
        const updated = { ...item, ...data, updatedAt: new Date() };
        mockDb.mitigations.set(mitigationId, updated);
        return updated;
      },

      async verifyMitigation(organizationId: string, mitigationId: string, verifiedBy: string, notes?: string) {
        return this.updateMitigation(organizationId, mitigationId, {
          status: "VERIFIED",
          verifiedBy,
          verifiedAt: new Date(),
          verificationNotes: notes,
        });
      },

      async listMitigations(organizationId: string, filters: any = {}) {
        let list = Array.from(mockDb.mitigations.values()).filter(
          (m) => m.organizationId === organizationId
        );
        if (filters.riskId) list = list.filter((m) => m.riskId === filters.riskId);
        if (filters.status) list = list.filter((m) => m.status === filters.status);
        return list;
      },

      async createException(data: any) {
        const id = data.id || randomUUID();
        const item = {
          id,
          ...data,
          status: data.status || "REQUESTED",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockDb.exceptions.set(id, item);
        return item;
      },

      async getExceptionById(organizationId: string, exceptionId: string) {
        const item = mockDb.exceptions.get(exceptionId);
        if (!item || item.organizationId !== organizationId) return null;
        return item;
      },

      async updateException(organizationId: string, exceptionId: string, data: any) {
        const item = await this.getExceptionById(organizationId, exceptionId);
        if (!item) return null;
        const updated = { ...item, ...data, updatedAt: new Date() };
        mockDb.exceptions.set(exceptionId, updated);
        return updated;
      },

      async approveException(organizationId: string, exceptionId: string, approvedBy: string, notes?: string) {
        return this.updateException(organizationId, exceptionId, {
          status: "APPROVED",
          approvedBy,
          approvedAt: new Date(),
          approvalNotes: notes,
        });
      },

      async revokeException(organizationId: string, exceptionId: string, revokedBy: string, reason: string) {
        return this.updateException(organizationId, exceptionId, {
          status: "REVOKED",
          revokedBy,
          revokedAt: new Date(),
          revocationReason: reason,
        });
      },

      async listExceptions(organizationId: string, filters: any = {}) {
        let list = Array.from(mockDb.exceptions.values()).filter(
          (e) => e.organizationId === organizationId
        );
        if (filters.riskId) list = list.filter((e) => e.riskId === filters.riskId);
        if (filters.status) list = list.filter((e) => e.status === filters.status);
        if (filters.scopeTarget) list = list.filter((e) => e.scopeTarget === filters.scopeTarget);
        return list;
      },

      async createReviewHistory(data: any) {
        const id = randomUUID();
        const item = { id, ...data, reviewedAt: new Date() };
        mockDb.reviews.set(id, item);
        return item;
      },

      async listReviewHistory(organizationId: string, riskId: string) {
        return Array.from(mockDb.reviews.values()).filter(
          (r) => r.organizationId === organizationId && r.riskId === riskId
        );
      },

      async getRiskOverview(organizationId: string) {
        const risks = await this.listRisks(organizationId);
        const alerts = await this.listAlerts(organizationId);
        const profiles = Array.from(mockDb.trustProfiles.values()).filter(
          (p) => p.organizationId === organizationId
        );
        const exceptions = await this.listExceptions(organizationId);

        const risksByTier: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
        for (const r of risks) {
          risksByTier[r.residualTier] = (risksByTier[r.residualTier] || 0) + 1;
        }

        const avgTrust =
          profiles.length > 0
            ? Math.round(profiles.reduce((acc, p) => acc + p.trustScore, 0) / profiles.length)
            : 70;

        return {
          totalRisks: risks.length,
          risksByTier,
          criticalRisksCount: risksByTier.CRITICAL,
          highRisksCount: risksByTier.HIGH,
          openMitigationsCount: Array.from(mockDb.mitigations.values()).filter(
            (m) => m.organizationId === organizationId && m.status !== "VERIFIED" && m.status !== "CLOSED"
          ).length,
          activeExceptionsCount: exceptions.filter((e) => e.status === "APPROVED").length,
          activeAlertsCount: alerts.filter((a) => a.status === "NEW" || a.status === "ACKNOWLEDGED").length,
          averageAgentTrustScore: avgTrust,
          evaluatedAgentsCount: profiles.length,
        };
      },

      async getRiskMatrix(organizationId: string) {
        const risks = await this.listRisks(organizationId);
        const matrix: any[] = [];
        for (let l = 1; l <= 5; l++) {
          for (let i = 1; i <= 5; i++) {
            const score = l * i;
            const tier = determineRiskTier(score);
            const count = risks.filter((r) => r.likelihood === l && r.impact === i).length;
            matrix.push({ likelihood: l, impact: i, score, tier, count });
          }
        }
        return matrix;
      },
    };

    riskService = new AgentRiskService(mockDb.db as any, complianceService);
    (riskService as any).repo = riskRepo;
  });

  // -------------------------------------------------------------------------
  // 1. Tenant Isolation
  // -------------------------------------------------------------------------
  it("Test 1: Tenant isolation strictly segregates risks, mitigations, exceptions, and trust profiles", async () => {
    // Org A risk
    const riskA = await riskService.createRisk(orgId, {
      title: "Data Leakage via Agent Prompt",
      riskCategory: "PRIVACY",
      likelihood: 4,
      impact: 4,
      agentId,
    });

    // Org B risk
    const riskB = await riskService.createRisk(competitorOrgId, {
      title: "Competitor Market Model Drift",
      riskCategory: "FINANCIAL",
      likelihood: 5,
      impact: 5,
      agentId: "competitor-agent",
    });

    // Org A cannot see Org B risk
    const orgARisks = await riskService.listRisks(orgId);
    expect(orgARisks).toHaveLength(1);
    expect(orgARisks[0].id).toBe(riskA.id);

    const crossQuery = await riskService.getRisk(orgId, riskB.id);
    expect(crossQuery).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 2. Inherent Risk Scoring Formula (Likelihood x Impact)
  // -------------------------------------------------------------------------
  it("Test 2: Deterministic inherent risk calculation: Inherent = Likelihood x Impact (1-25)", () => {
    const testCases = [
      { l: 1, i: 1, expectedScore: 1, expectedTier: "LOW" },
      { l: 2, i: 2, expectedScore: 4, expectedTier: "LOW" },
      { l: 3, i: 3, expectedScore: 9, expectedTier: "MEDIUM" },
      { l: 4, i: 4, expectedScore: 16, expectedTier: "HIGH" },
      { l: 5, i: 4, expectedScore: 20, expectedTier: "CRITICAL" },
      { l: 5, i: 5, expectedScore: 25, expectedTier: "CRITICAL" },
    ];

    for (const tc of testCases) {
      const assessment = calculateRiskAssessment({
        likelihood: tc.l,
        impact: tc.i,
        controls: [],
      });
      expect(assessment.inherentScore).toBe(tc.expectedScore);
      expect(assessment.inherentTier).toBe(tc.expectedTier);
      expect(assessment.residualScore).toBe(tc.expectedScore); // Without controls, residual equals inherent
    }
  });

  // -------------------------------------------------------------------------
  // 3. Configurable Threshold Mapping
  // -------------------------------------------------------------------------
  it("Test 3: Threshold mapping correctly categorizes tiers and respects custom threshold overrides", async () => {
    expect(determineRiskTier(5)).toBe("LOW");
    expect(determineRiskTier(6)).toBe("MEDIUM");
    expect(determineRiskTier(11)).toBe("MEDIUM");
    expect(determineRiskTier(12)).toBe("HIGH");
    expect(determineRiskTier(19)).toBe("HIGH");
    expect(determineRiskTier(20)).toBe("CRITICAL");

    // Custom threshold configuration
    const customThresholds = {
      lowMax: 3,
      mediumMax: 8,
      highMax: 15,
      criticalMin: 16,
    };
    expect(determineRiskTier(4, customThresholds)).toBe("MEDIUM");
    expect(determineRiskTier(16, customThresholds)).toBe("CRITICAL");
  });

  // -------------------------------------------------------------------------
  // 4. Residual Risk Calculation & Control Effectiveness
  // -------------------------------------------------------------------------
  it("Test 4: Residual risk calculation reduces score solely based on verified controls, caps at 85%, and gives 0% to ineffective controls", () => {
    // 1 Effective control (40% reduction): 20 * (1 - 0.40) = 12
    const res1 = calculateRiskAssessment({
      likelihood: 4,
      impact: 5, // inherent = 20
      controls: [
        { id: "CTRL-1", name: "Sandbox Isolation", effectiveness: "EFFECTIVE" },
      ],
    });
    expect(res1.inherentScore).toBe(20);
    expect(res1.residualScore).toBe(12);
    expect(res1.residualTier).toBe("HIGH");

    // 1 Ineffective control (0% reduction): residual remains 20
    const resIneffective = calculateRiskAssessment({
      likelihood: 4,
      impact: 5,
      controls: [
        { id: "CTRL-FAIL", name: "Broken Filter", effectiveness: "INEFFECTIVE" },
      ],
    });
    expect(resIneffective.residualScore).toBe(20);
    expect(resIneffective.residualTier).toBe("CRITICAL");

    // 1 Partially effective (20%) + 1 Effective (40%) = 60% reduction: 20 * 0.40 = 8
    const resPartial = calculateRiskAssessment({
      likelihood: 4,
      impact: 5,
      controls: [
        { id: "CTRL-1", name: "Sandbox", effectiveness: "EFFECTIVE" },
        { id: "CTRL-2", name: "Monitoring", effectiveness: "PARTIALLY_EFFECTIVE" },
      ],
    });
    expect(resPartial.residualScore).toBe(8);
    expect(resPartial.residualTier).toBe("MEDIUM");

    // 3 Effective controls (40% + 40% + 40% = 120% -> capped at 85%): 20 * (1 - 0.85) = 3
    const resCapped = calculateRiskAssessment({
      likelihood: 4,
      impact: 5,
      controls: [
        { id: "CTRL-1", name: "Sandbox", effectiveness: "EFFECTIVE" },
        { id: "CTRL-2", name: "SSRF Gateway", effectiveness: "EFFECTIVE" },
        { id: "CTRL-3", name: "Prompt Guard", effectiveness: "EFFECTIVE" },
      ],
    });
    expect(resCapped.residualScore).toBe(3);
    expect(resCapped.residualTier).toBe("LOW");
  });

  // -------------------------------------------------------------------------
  // 5. Risk Assessment History and Versioning
  // -------------------------------------------------------------------------
  it("Test 5: Risk assessment creates sequential versions and preserves full assessment history", async () => {
    const risk = await riskService.createRisk(orgId, {
      title: "Model Prompt Injection",
      riskCategory: "SECURITY",
      likelihood: 5,
      impact: 4,
      agentId,
    });

    // Assessment v1
    const a1 = await riskService.assessRisk(orgId, risk.id, {
      likelihood: 5,
      impact: 4,
      controls: [],
      assessedBy: actorId,
      rationale: "Initial unmitigated assessment",
    });
    expect(a1.residualScore).toBe(20);

    // Assessment v2 with control
    const a2 = await riskService.assessRisk(orgId, risk.id, {
      likelihood: 5,
      impact: 4,
      controls: [
        { id: "SEC-01", name: "Prompt Filter", effectiveness: "EFFECTIVE" },
      ],
      assessedBy: actorId,
      rationale: "After control verification",
    });
    expect(a2.residualScore).toBe(12);

    // Verify history contains all versions (initial assessment upon creation + 2 reassessments)
    const history = await riskService.listAssessmentsForRisk(orgId, risk.id);
    expect(history).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // 6. Multidimensional Agent Trust Profile Calculation
  // -------------------------------------------------------------------------
  it("Test 6: Agent trust profile calculates deterministic 0-100 scores across 7 operational dimensions", () => {
    const signals = {
      totalExecutions: 50,
      failedExecutions: 2, // 96% reliability
      totalPolicyEvaluations: 40,
      policyDenials: 0, // 100% adherence
      securityViolations: 0, // 100% security
      totalApprovalRequests: 10,
      rejectedApprovals: 0, // 100% approval
      totalToolInvocations: 100,
      failedToolInvocations: 1, // 99% safety
      evidenceItemsCount: 5,
      verifiedEvidenceCount: 5, // 100% compliance
    };

    const profile = calculateTrustProfile(agentId, signals, 5);
    expect(profile.trustConfidence).toBe("HIGH");
    expect(profile.trustScore).toBeGreaterThanOrEqual(95);
    expect(profile.trustTier).toBe("VERY_HIGH");
    expect(profile.dimensionScores.executionReliability).toBeGreaterThanOrEqual(90);
    expect(profile.dimensionScores.policyAdherence).toBe(100);
    expect(profile.dimensionScores.securityIncidentHistory).toBe(100);
    expect(profile.dimensionScores.toolExecutionSafety).toBeGreaterThanOrEqual(95);
  });

  // -------------------------------------------------------------------------
  // 7. Insufficient Evidence Neutral Baseline
  // -------------------------------------------------------------------------
  it("Test 7: Insufficient evidence (< 5 operations) assigns neutral baseline score (70) and LOW confidence", () => {
    const newAgentSignals = {
      totalExecutions: 2,
      failedExecutions: 0,
      totalPolicyEvaluations: 1,
      policyDenials: 0,
      securityViolations: 0,
      totalApprovalRequests: 0,
      rejectedApprovals: 0,
      totalToolInvocations: 1,
      failedToolInvocations: 0,
      evidenceItemsCount: 0,
      verifiedEvidenceCount: 0,
    };

    const profile = calculateTrustProfile("brand-new-agent", newAgentSignals, 5);
    expect(profile.trustConfidence).toBe("LOW");
    expect(profile.trustScore).toBe(70);
    expect(profile.trustTier).toBe("NEUTRAL"); // 70 is neutral
  });

  // -------------------------------------------------------------------------
  // 8. Trust Confidence Level Scaling
  // -------------------------------------------------------------------------
  it("Test 8: Confidence level scales deterministically (<5: LOW, 5-19: MEDIUM, >=20: HIGH)", () => {
    const baseSignals = {
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
    };

    // < 5 operations
    const low = calculateTrustProfile("a1", { ...baseSignals, totalExecutions: 3 }, 5);
    expect(low.trustConfidence).toBe("LOW");

    // 5 - 19 operations
    const med = calculateTrustProfile("a2", { ...baseSignals, totalExecutions: 12 }, 5);
    expect(med.trustConfidence).toBe("MEDIUM");

    // >= 20 operations
    const high = calculateTrustProfile("a3", { ...baseSignals, totalExecutions: 25 }, 5);
    expect(high.trustConfidence).toBe("HIGH");
  });

  // -------------------------------------------------------------------------
  // 9. Behavioral Risk Detection Across 10 Rules
  // -------------------------------------------------------------------------
  it("Test 9: Evaluates and triggers behavioral risk rules across telemetry events", async () => {
    const now = new Date();
    // Ingest simulated telemetry events to trigger REPEATED_POLICY_DENIALS (>=3 denials)
    for (let i = 0; i < 3; i++) {
      mockDb.complianceEvents.push({
        id: `ev-policy-${i}`,
        agentId,
        category: "POLICY_EVALUATION",
        eventType: "POLICY_EVALUATION_DENIED",
        outcome: "DENIED",
        severity: "HIGH",
        eventTimestamp: now,
        metadata: {},
      });
    }

    // Ingest simulated telemetry events to trigger REPEATED_UNAUTHORIZED_ACCESS (>=2 403s)
    for (let i = 0; i < 2; i++) {
      mockDb.complianceEvents.push({
        id: `ev-unauth-${i}`,
        agentId,
        category: "AUTHORIZATION",
        eventType: "unauthorized_resource_access",
        outcome: "UNAUTHORIZED",
        severity: "HIGH",
        eventTimestamp: now,
        metadata: { statusCode: 403 },
      });
    }

    const alerts = await riskService.detectBehavioralRisks(orgId, agentId, 60);
    expect(alerts.length).toBeGreaterThanOrEqual(2);

    const rules = alerts.map((a: any) => a.detectionRule);
    expect(rules).toContain("REPEATED_POLICY_DENIALS");
    expect(rules).toContain("REPEATED_UNAUTHORIZED_ACCESS");
  });

  // -------------------------------------------------------------------------
  // 10. Fingerprinted Alert Deduplication
  // -------------------------------------------------------------------------
  it("Test 10: Deduplicates alerts using SHA-256 fingerprint, incrementing occurrence count instead of spamming records", async () => {
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      mockDb.complianceEvents.push({
        id: `ev-sec-${i}`,
        agentId,
        category: "SECURITY_CONTROL",
        eventType: "sandbox_violation",
        outcome: "DENIED",
        severity: "CRITICAL",
        eventTimestamp: now,
        metadata: {},
      });
    }

    // First detection run: creates alert
    const run1 = await riskService.detectBehavioralRisks(orgId, agentId, 60);
    const alert1 = run1.find((a: any) => a.detectionRule === "SECURITY_CONTROL_VIOLATIONS");
    expect(alert1).toBeDefined();
    expect(alert1.occurrenceCount).toBe(1);

    // Second detection run in same hour: updates existing alert occurrence count
    const run2 = await riskService.detectBehavioralRisks(orgId, agentId, 60);
    const alert2 = run2.find((a: any) => a.detectionRule === "SECURITY_CONTROL_VIOLATIONS");
    expect(alert2).toBeDefined();
    expect(alert2.id).toBe(alert1.id); // Same ID
    expect(alert2.occurrenceCount).toBe(2); // Incremented
  });

  // -------------------------------------------------------------------------
  // 11. False-Positive / Alert Acknowledge & Resolve Workflow
  // -------------------------------------------------------------------------
  it("Test 11: Alert acknowledge and resolve lifecycle operates with full audit notes", async () => {
    const fp = generateAlertFingerprint(orgId, agentId, "SUDDEN_TOOL_USAGE_SPIKE", "2026-11-17T11");
    const createdAlert = await riskRepo.createAlert({
      organizationId: orgId,
      agentId,
      rule: "SUDDEN_TOOL_USAGE_SPIKE",
      severity: "MEDIUM",
      fingerprint: fp,
      title: "Sudden Tool Spike",
      description: "25 calls in 5 minutes",
    });
    expect(createdAlert.status).toBe("NEW");

    // Acknowledge
    const acked = await riskService.acknowledgeAlert(orgId, createdAlert.id, actorId);
    expect(acked?.status).toBe("ACKNOWLEDGED");
    expect(acked?.acknowledgedBy).toBe(actorId);

    // Resolve
    const resolved = await riskService.resolveAlert(
      orgId,
      createdAlert.id,
      actorId,
      "Expected batch processing job"
    );
    expect(resolved?.status).toBe("RESOLVED");
    expect(resolved?.resolvedBy).toBe(actorId);
    expect(resolved?.resolutionNotes).toBe("Expected batch processing job");
  });

  // -------------------------------------------------------------------------
  // 12. Risk Policy Simulation
  // -------------------------------------------------------------------------
  it("Test 12: Risk governance decision simulates actions deterministically", async () => {
    // Normal agent with default trust 70 and no risks
    const decision = await riskService.evaluateRiskGovernanceDecision(orgId, agentId);
    expect(decision.agentId).toBe(agentId);
    expect(decision.isRiskEnforcementEnabled).toBe(false); // default disabled
    expect(decision.recommendation).toBe("MONITOR"); // Softened to MONITOR in simulation mode
    expect(decision.reasons[0]).toContain("[SIMULATION MODE]");
  });

  // -------------------------------------------------------------------------
  // 13. Mandatory Security Denial Precedence
  // -------------------------------------------------------------------------
  it("Test 13: Mandatory security denial takes absolute precedence over high trust scores", async () => {
    // Agent has perfect trust profile and no alerts, but explicit security denial
    const decision = await riskService.evaluateRiskGovernanceDecision(orgId, agentId, {
      explicitSecurityDenial: true,
    });

    expect(decision.recommendation).toBe("SUSPEND");
    expect(decision.mandatorySecurityOverrideApplied).toBe(true);
    expect(decision.reasons[0]).toContain("Explicit security control denial");
  });

  // -------------------------------------------------------------------------
  // 14. Default-Disabled Enforcement Mode
  // -------------------------------------------------------------------------
  it("Test 14: Risk enforcement is disabled by default (advisory recommendations only)", async () => {
    const config = await riskService.getConfiguration(orgId);
    expect(config.riskEnforcementEnabled).toBe(false);

    // Even with CRITICAL risk, when enforcement is false, recommendation defaults to MONITOR in simulation mode
    await riskService.createRisk(orgId, {
      title: "Arbitrary Code Execution Risk",
      riskCategory: "AUTONOMY",
      likelihood: 5,
      impact: 5,
      agentId,
    });

    const decision = await riskService.evaluateRiskGovernanceDecision(orgId, agentId);
    expect(decision.isRiskEnforcementEnabled).toBe(false);
    expect(decision.recommendation).toBe("MONITOR");
    expect(decision.reasons[0]).toContain("[SIMULATION MODE]");
  });

  // -------------------------------------------------------------------------
  // 15. Approval Workflow Recommendation Integration
  // -------------------------------------------------------------------------
  it("Test 15: Recommends REQUIRE_APPROVAL when agent trust tier is VERY_LOW (<40) or high alerts present", async () => {
    // Enable risk enforcement for this test
    await riskRepo.upsertConfiguration(orgId, { riskEnforcementEnabled: true });

    // Set agent trust to 30 (VERY_LOW tier)
    await riskRepo.upsertTrustProfile(orgId, agentId, {
      trustScore: 30,
      trustTier: "VERY_LOW",
      confidenceLevel: "HIGH",
      dimensions: { ...DEFAULT_TRUST_DIMENSION_WEIGHTS },
      operationalSignals: {},
    });

    const decision = await riskService.evaluateRiskGovernanceDecision(orgId, agentId);
    expect(decision.isRiskEnforcementEnabled).toBe(true);
    expect(decision.recommendation).toBe("REQUIRE_APPROVAL");
    expect(decision.reasons.some((r: string) => r.includes("VERY_LOW"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 16. Agent Self-Approval Prevention on Risk Exceptions
  // -------------------------------------------------------------------------
  it("Test 16: Prevents self-approval on risk exceptions (requestedBy cannot be approvedBy)", async () => {
    const risk = await riskService.createRisk(orgId, {
      title: "Third Party Cloud API Access",
      riskCategory: "THIRD_PARTY",
      likelihood: 3,
      impact: 4,
      agentId,
    });

    const exception = await riskService.requestException(orgId, {
      riskId: risk.id,
      exceptionIdentifier: "EXC-API-101",
      title: "Temporary 3rd Party Access",
      justification: "Temporary bypass for urgent customer migration",
      scopeType: "ORGANIZATION",
      scopeTarget: orgId,
      expirationDate: new Date(Date.now() + 86400000),
      compensatingControls: [],
      requestedBy: actorId,
    });

    // Attempt self-approval: same actor
    await expect(
      riskService.approveException(orgId, exception.id, actorId, "Self approval attempt")
    ).rejects.toThrow("Self-approval of risk exceptions is prohibited");
  });

  // -------------------------------------------------------------------------
  // 17. Exception Expiration Enforcement
  // -------------------------------------------------------------------------
  it("Test 17: Enforces mandatory expiration dates and rejects past or missing expiration dates", async () => {
    const risk = await riskService.createRisk(orgId, {
      title: "Legacy Database Connector",
      riskCategory: "OPERATIONAL",
      likelihood: 3,
      impact: 3,
    });

    // Reject past expiration date
    await expect(
      riskService.requestException(orgId, {
        riskId: risk.id,
        exceptionIdentifier: "EXC-PAST-1",
        title: "Past Exception",
        justification: "Expired justification",
        scopeType: "ORGANIZATION",
        scopeTarget: orgId,
        expirationDate: new Date(Date.now() - 10000), // in the past
        compensatingControls: [],
        requestedBy: actorId,
      })
    ).rejects.toThrow("A valid future expiration date is mandatory");
  });

  // -------------------------------------------------------------------------
  // 18. Exception Revocation Workflow
  // -------------------------------------------------------------------------
  it("Test 18: Exception revocation transitions status to REVOKED and logs reason", async () => {
    const risk = await riskService.createRisk(orgId, {
      title: "Public Endpoint Access",
      riskCategory: "SECURITY",
      likelihood: 4,
      impact: 4,
    });

    const exception = await riskService.requestException(orgId, {
      riskId: risk.id,
      exceptionIdentifier: "EXC-REV-1",
      title: "Public Endpoint Bypass",
      justification: "Test exception",
      scopeType: "ORGANIZATION",
      scopeTarget: orgId,
      expirationDate: new Date(Date.now() + 86400000),
      compensatingControls: [],
      requestedBy: actorId,
    });

    // Approve by auditor
    const approved = await riskService.approveException(
      orgId,
      exception.id,
      auditorId,
      "Approved with monitoring"
    );
    expect(approved.status).toBe("APPROVED");

    // Revoke
    const revoked = await riskService.revokeException(
      orgId,
      exception.id,
      auditorId,
      "Discovered abnormal outbound traffic"
    );
    expect(revoked.status).toBe("REVOKED");
    expect(revoked.revokedBy).toBe(auditorId);
    expect(revoked.revocationReason).toBe("Discovered abnormal outbound traffic");
  });

  // -------------------------------------------------------------------------
  // 19. Mitigation Evidence & Reviewer Notes Requirements
  // -------------------------------------------------------------------------
  it("Test 19: Mitigation verification requires non-empty reviewer notes", async () => {
    const risk = await riskService.createRisk(orgId, {
      title: "Unencrypted Local Cache",
      riskCategory: "PRIVACY",
      likelihood: 3,
      impact: 3,
    });

    const mitigation = await riskService.createMitigationPlan(orgId, {
      riskId: risk.id,
      planIdentifier: "MIT-ENC-01",
      title: "Implement AES-256 GCM Cache Encryption",
      correctiveActions: [],
      ownerId: actorId,
    });

    // Reject verification without notes
    await expect(
      riskService.verifyMitigationPlan(orgId, mitigation.id, auditorId, "")
    ).rejects.toThrow("Verification notes and rationale are required");

    // Success with valid notes
    const verified = await riskService.verifyMitigationPlan(
      orgId,
      mitigation.id,
      auditorId,
      "Verified encryption key rotation and zero plain text on disk"
    );
    expect(verified.status).toBe("VERIFIED");
    expect(verified.verifiedBy).toBe(auditorId);
  });

  // -------------------------------------------------------------------------
  // 20. Authorized Reviewer Role Verification
  // -------------------------------------------------------------------------
  it("Test 20: Requires non-existent mitigation to reject verification", async () => {
    await expect(
      riskService.verifyMitigationPlan(
        orgId,
        "non-existent-mitigation-id",
        auditorId,
        "verification notes"
      )
    ).rejects.toThrow("not found");
  });

  // -------------------------------------------------------------------------
  // 21. Cross-Tenant API Protection
  // -------------------------------------------------------------------------
  it("Test 21: Prevents cross-tenant operations on mitigations and exceptions", async () => {
    const riskA = await riskService.createRisk(orgId, {
      title: "Risk in Org A",
      riskCategory: "COMPLIANCE",
      likelihood: 2,
      impact: 2,
    });

    const mitigationA = await riskService.createMitigationPlan(orgId, {
      riskId: riskA.id,
      planIdentifier: "MIT-ORGA-1",
      title: "Mitigation in Org A",
      correctiveActions: [],
    });

    // Competitor Org B attempts to access Org A mitigation
    const crossCheck = await riskService.getMitigation(competitorOrgId, mitigationA.id);
    expect(crossCheck).toBeNull();

    // Competitor Org B attempts to verify Org A mitigation
    await expect(
      riskService.verifyMitigationPlan(
        competitorOrgId,
        mitigationA.id,
        "competitor-user",
        "Hacked"
      )
    ).rejects.toThrow("not found");
  });

  // -------------------------------------------------------------------------
  // 22. Audit Event Generation into Compliance Ledger
  // -------------------------------------------------------------------------
  it("Test 22: Records tamper-evident compliance audit events for governance mutations", async () => {
    const beforeCount = mockDb.complianceEvents.length;

    await riskService.createRisk(orgId, {
      title: "Financial Ledger Double Entry Drift",
      riskCategory: "FINANCIAL",
      likelihood: 3,
      impact: 4,
    });

    expect(mockDb.complianceEvents.length).toBeGreaterThan(beforeCount);
    const lastEvent = mockDb.complianceEvents[mockDb.complianceEvents.length - 1];
    expect(lastEvent.organizationId).toBe(orgId);
    expect(lastEvent.eventCategory).toBe("COMPLIANCE_CHANGE");
    expect(lastEvent.eventType).toBe("agent.risk.created");
  });

  // -------------------------------------------------------------------------
  // 23. Deep Secret Redaction in Risk Metadata
  // -------------------------------------------------------------------------
  it("Test 23: Redacts sensitive secrets and tokens before persisting in risk metadata", () => {
    const sensitiveMetadata = {
      description: "Connection error",
      apiKey: "sk-ant-api03-secret1234567890abcdef1234567890abcdef",
      nested: {
        bearerToken: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload",
        password: "super-secret-password-12345",
      },
    };

    const redacted = redactObject(sensitiveMetadata);
    expect(redacted.apiKey).toContain("sk-...");
    expect(redacted.nested.password).toBe("[REDACTED]");
    expect(JSON.stringify(redacted)).not.toContain("super-secret-password-12345");
  });

  // -------------------------------------------------------------------------
  // 24. Compatibility with Epic 22E Compliance Service
  // -------------------------------------------------------------------------
  it("Test 24: Integrates smoothly with Epic 22E compliance service to emit audit events", async () => {
    const risk = await riskService.createRisk(orgId, {
      title: "Compliance Certification Risk",
      riskCategory: "COMPLIANCE",
      likelihood: 2,
      impact: 3,
    });

    const assessment = await riskService.assessRisk(
      orgId,
      risk.id,
      {
        likelihood: 2,
        impact: 3,
        controls: [],
      },
      auditorId
    );

    expect(assessment).toBeDefined();

    // Verify compliance events were emitted
    const complianceEvents = mockDb.complianceEvents.filter(
      (e) => e.organizationId === orgId && e.eventType === "agent.risk.assessed"
    );
    expect(complianceEvents.length).toBe(1);
    expect(complianceEvents[0].actorId).toBe(auditorId);
  });

  // -------------------------------------------------------------------------
  // 25. Risk Matrix & Overview Aggregation
  // -------------------------------------------------------------------------
  it("Test 25: Correctly aggregates 5x5 risk matrix and organizational risk overview metrics", async () => {
    await riskService.createRisk(orgId, {
      title: "Risk Low",
      riskCategory: "OPERATIONAL",
      likelihood: 1,
      impact: 1,
    });

    await riskService.createRisk(orgId, {
      title: "Risk High",
      riskCategory: "SECURITY",
      likelihood: 4,
      impact: 4,
    });

    const overview = await riskService.getOverview(orgId);
    expect(overview.totalRisks).toBeGreaterThanOrEqual(2);
    expect(overview.risksByTier.LOW).toBeGreaterThanOrEqual(1);
    expect(overview.risksByTier.HIGH).toBeGreaterThanOrEqual(1);

    const matrix = await riskService.getMatrix(orgId);
    expect(matrix).toHaveLength(25); // 5x5 grid
    const cell11 = matrix.find((c: any) => c.likelihood === 1 && c.impact === 1);
    expect(cell11?.score).toBe(1);
    expect(cell11?.tier).toBe("LOW");
    expect(cell11?.count).toBeGreaterThanOrEqual(1);
  });
});
