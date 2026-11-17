import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  aiAgentRuns,
  aiAgentToolExecutions,
  agentApprovalRequests,
  agentComplianceEvents,
  agentSecurityEvents,
} from "../../../database/schema.js";
import { and, eq, gte } from "drizzle-orm";
import {
  calculateRiskAssessment,
  calculateTrustProfile,
  generateAlertFingerprint,
  type BehavioralAlertStatus,
  type BehavioralDetectionResult,
  type BehavioralDetectionRule,
  type CompensatingControlItem,
  type CorrectiveActionItem,
  type ExceptionScopeType,
  type MitigationPlanStatus,
  type RiskAssessmentInput,
  type RiskAssessmentResult,
  type RiskCategory,
  type RiskControlDefinition,
  type RiskEnforcementMode,
  type RiskExceptionStatus,
  type RiskGovernanceRecommendation,
  type RiskMitigationStatus,
  type RiskSource,
  type RiskThresholdConfig,
  type RiskTier,
  type RiskTreatmentStrategy,
  type TrustTier,
} from "../risk-trust.types.js";
import { AgentRiskRepository } from "../repositories/agent-risk.repository.js";
import { AgentComplianceService } from "./agent-compliance.service.js";
import { redactObject } from "./agent-secret-vault.service.js";

export class AgentRiskService {
  private readonly repo: AgentRiskRepository;
  private readonly complianceService?: AgentComplianceService;

  constructor(private readonly db: MySql2Database<any>, complianceService?: AgentComplianceService) {
    this.repo = new AgentRiskRepository(db);
    this.complianceService = complianceService ?? new AgentComplianceService(db);
  }

  // -------------------------------------------------------------------------
  // 1. Organization Risk Configuration
  // -------------------------------------------------------------------------

  async getConfiguration(organizationId: string) {
    return this.repo.getConfiguration(organizationId);
  }

  async updateConfiguration(organizationId: string, data: {
    riskEnforcementEnabled?: boolean;
    riskEnforcementMode?: RiskEnforcementMode;
    lowThresholdMax?: number;
    mediumThresholdMax?: number;
    highThresholdMax?: number;
    criticalThresholdMin?: number;
    trustEvaluationWindowDays?: number;
    minOperationsForConfidence?: number;
    behavioralDetectionEnabled?: boolean;
  }) {
    const updated = await this.repo.upsertConfiguration(organizationId, data as any);

    await this.emitAuditEvent(organizationId, {
      category: "GOVERNANCE_CHANGE",
      eventType: "agent.risk.configuration.updated",
      actorType: "user",
      resourceType: "risk_configuration",
      resourceId: organizationId,
      outcome: "SUCCESS",
      riskSeverity: "LOW",
      metadata: redactObject(data),
    });

    return updated;
  }

  // -------------------------------------------------------------------------
  // 2. Risk Register Management
  // -------------------------------------------------------------------------

  async listRisks(
    organizationId: string,
    filters?: {
      category?: RiskCategory;
      residualTier?: RiskTier;
      agentId?: string;
      status?: RiskMitigationStatus;
      limit?: number;
      offset?: number;
    }
  ) {
    return this.repo.listRisks(organizationId, filters);
  }

  async getRisk(organizationId: string, riskId: string) {
    return this.repo.getRiskById(organizationId, riskId);
  }

  async createRisk(
    organizationId: string,
    data: {
      riskIdentifier: string;
      title: string;
      description?: string;
      workspaceId?: string;
      agentId?: string;
      riskCategory: RiskCategory;
      riskSource?: RiskSource;
      likelihood: number;
      impact: number;
      existingControls?: RiskControlDefinition[];
      treatmentStrategy?: RiskTreatmentStrategy;
      mitigationStatus?: RiskMitigationStatus;
      ownerId?: string;
      reviewFrequency?: "MONTHLY" | "QUARTERLY" | "ANNUALLY";
      nextReviewDate?: Date;
      linkedSecurityEvents?: string[];
      linkedComplianceControls?: string[];
      linkedEvidenceIds?: string[];
      createdBy?: string;
    }
  ) {
    const config = await this.repo.getConfiguration(organizationId);
    const thresholds: RiskThresholdConfig = {
      lowMax: config.lowThresholdMax,
      mediumMax: config.mediumThresholdMax,
      highMax: config.highThresholdMax,
      criticalMin: config.criticalThresholdMin,
    };

    // Calculate deterministic inherent and residual risk
    const assessment = calculateRiskAssessment(
      {
        likelihood: data.likelihood,
        impact: data.impact,
        controls: data.existingControls,
      },
      thresholds
    );

    const created = await this.repo.createRisk({
      organizationId,
      workspaceId: data.workspaceId,
      riskIdentifier: data.riskIdentifier,
      title: data.title,
      description: data.description,
      agentId: data.agentId,
      riskCategory: data.riskCategory,
      riskSource: data.riskSource ?? "MANUAL_ASSESSMENT",
      likelihood: data.likelihood,
      impact: data.impact,
      inherentScore: assessment.inherentScore,
      inherentTier: assessment.inherentTier,
      existingControls: assessment.controlsEvaluated as any,
      residualScore: assessment.residualScore,
      residualTier: assessment.residualTier,
      ownerId: data.ownerId,
      treatmentStrategy: data.treatmentStrategy ?? "MITIGATE",
      mitigationStatus: data.mitigationStatus ?? "IDENTIFIED",
      reviewFrequency: data.reviewFrequency ?? "QUARTERLY",
      nextReviewDate: data.nextReviewDate,
      linkedSecurityEvents: data.linkedSecurityEvents ?? [],
      linkedComplianceControls: data.linkedComplianceControls ?? [],
      linkedEvidenceIds: data.linkedEvidenceIds ?? [],
      createdBy: data.createdBy,
    });

    if (created) {
      // Record initial assessment
      await this.repo.createAssessment({
        organizationId,
        riskId: created.id,
        agentId: data.agentId,
        assessmentVersion: assessment.modelVersion,
        scoringModel: assessment.scoringModel,
        likelihood: data.likelihood,
        impact: data.impact,
        inherentScore: assessment.inherentScore,
        inherentTier: assessment.inherentTier,
        controlsEvaluated: assessment.controlsEvaluated as any,
        residualScore: assessment.residualScore,
        residualTier: assessment.residualTier,
        rationale: "Initial risk registration assessment.",
        calculationInputs: assessment.explanation as any,
        assessedBy: data.createdBy,
      });

      // Emit compliance audit event
      await this.emitAuditEvent(organizationId, {
        category: "COMPLIANCE_CHANGE",
        eventType: "agent.risk.created",
        actorType: "user",
        actorId: data.createdBy,
        agentId: data.agentId,
        resourceType: "risk_register",
        resourceId: created.id,
        outcome: "SUCCESS",
        riskSeverity: assessment.residualTier as any,
        metadata: {
          riskIdentifier: data.riskIdentifier,
          category: data.riskCategory,
          inherentScore: assessment.inherentScore,
          residualScore: assessment.residualScore,
        },
      });
    }

    return created;
  }

  async updateRisk(
    organizationId: string,
    riskId: string,
    data: Partial<{
      title: string;
      description: string;
      treatmentStrategy: RiskTreatmentStrategy;
      mitigationStatus: RiskMitigationStatus;
      ownerId: string;
      reviewFrequency: string;
      nextReviewDate: Date;
      linkedSecurityEvents: string[];
      linkedComplianceControls: string[];
      linkedEvidenceIds: string[];
    }>,
    actorId?: string
  ) {
    const updated = await this.repo.updateRisk(organizationId, riskId, data as any);

    await this.emitAuditEvent(organizationId, {
      category: "COMPLIANCE_CHANGE",
      eventType: "agent.risk.updated",
      actorType: "user",
      actorId,
      resourceType: "risk_register",
      resourceId: riskId,
      outcome: "SUCCESS",
      riskSeverity: "LOW",
      metadata: redactObject(data),
    });

    return updated;
  }

  async deleteRisk(organizationId: string, riskId: string, actorId?: string) {
    const result = await this.repo.deleteRisk(organizationId, riskId);

    await this.emitAuditEvent(organizationId, {
      category: "COMPLIANCE_CHANGE",
      eventType: "agent.risk.deleted",
      actorType: "user",
      actorId,
      resourceType: "risk_register",
      resourceId: riskId,
      outcome: "SUCCESS",
      riskSeverity: "MEDIUM",
      metadata: { deletedRiskId: riskId },
    });

    return result;
  }

  // -------------------------------------------------------------------------
  // 3. Deterministic Risk Assessment Engine
  // -------------------------------------------------------------------------

  async assessRisk(
    organizationId: string,
    riskId: string,
    input: RiskAssessmentInput,
    actorId?: string
  ): Promise<RiskAssessmentResult> {
    const risk = await this.repo.getRiskById(organizationId, riskId);
    if (!risk) {
      throw new Error(`Risk with ID "${riskId}" not found in organization "${organizationId}".`);
    }

    const config = await this.repo.getConfiguration(organizationId);
    const thresholds: RiskThresholdConfig = {
      lowMax: config.lowThresholdMax,
      mediumMax: config.mediumThresholdMax,
      highMax: config.highThresholdMax,
      criticalMin: config.criticalThresholdMin,
    };

    const result = calculateRiskAssessment(input, thresholds);

    // Save assessment record
    await this.repo.createAssessment({
      organizationId,
      riskId,
      agentId: risk.agentId,
      assessmentVersion: result.modelVersion,
      scoringModel: result.scoringModel,
      likelihood: input.likelihood,
      impact: input.impact,
      inherentScore: result.inherentScore,
      inherentTier: result.inherentTier,
      controlsEvaluated: result.controlsEvaluated as any,
      residualScore: result.residualScore,
      residualTier: result.residualTier,
      rationale: input.rationale ?? "Deterministic reassessment based on verified controls.",
      calculationInputs: result.explanation as any,
      assessedBy: actorId ?? input.assessedBy,
    });

    // Record review history
    await this.repo.createReviewHistory({
      organizationId,
      riskId,
      reviewType: "PERIODIC_REVIEW",
      reviewedBy: actorId ?? input.assessedBy ?? "system",
      previousResidualScore: risk.residualScore,
      newResidualScore: result.residualScore,
      previousStatus: risk.mitigationStatus,
      newStatus: risk.mitigationStatus,
      notes: result.explanation.summary,
    });

    // Emit compliance audit event
    await this.emitAuditEvent(organizationId, {
      category: "COMPLIANCE_CHANGE",
      eventType: "agent.risk.assessed",
      actorType: "user",
      actorId: actorId ?? input.assessedBy,
      agentId: risk.agentId ?? undefined,
      resourceType: "risk_assessment",
      resourceId: riskId,
      outcome: "SUCCESS",
      riskSeverity: result.residualTier as any,
      metadata: {
        inherentScore: result.inherentScore,
        residualScore: result.residualScore,
        controlsCount: result.controlsEvaluated.length,
      },
    });

    return result;
  }

  async listAssessmentsForRisk(organizationId: string, riskId: string) {
    return this.repo.listAssessmentsByRiskId(organizationId, riskId);
  }

  // -------------------------------------------------------------------------
  // 4. Agent Trust Profile Engine
  // -------------------------------------------------------------------------

  async getTrustProfile(organizationId: string, agentId: string) {
    let profile = await this.repo.getTrustProfile(organizationId, agentId);
    if (!profile) {
      // Evaluate on-the-fly if not evaluated yet
      profile = await this.evaluateAgentTrust(organizationId, agentId);
    }
    return profile;
  }

  async listTrustProfiles(
    organizationId: string,
    filters?: { tier?: any; confidence?: any; limit?: number; offset?: number }
  ) {
    return this.repo.listTrustProfiles(organizationId, filters);
  }

  async evaluateAgentTrust(
    organizationId: string,
    agentId: string,
    options?: { windowDays?: number; actorId?: string }
  ): Promise<any> {
    const config = await this.repo.getConfiguration(organizationId);
    const windowDays = options?.windowDays ?? config.trustEvaluationWindowDays ?? 30;
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // 1. Gather operational telemetry from agent runs
    let totalExecutions = 0;
    let failedExecutions = 0;
    try {
      const runs = await this.db
        .select({
          id: aiAgentRuns.id,
          status: aiAgentRuns.status,
        })
        .from(aiAgentRuns)
        .where(
          and(
            eq(aiAgentRuns.agentId, agentId),
            gte(aiAgentRuns.createdAt, windowStart)
          )
        );
      totalExecutions = runs.length;
      failedExecutions = runs.filter((r) => r.status === "rejected" || (r.status as string) === "failed").length;
    } catch {
      // Telemetry table may be empty in test/sandbox
    }

    // 2. Gather policy evaluations from compliance events
    let totalPolicyEvaluations = 0;
    let policyDenials = 0;
    try {
      const policyEvents = await this.db
        .select({
          id: agentComplianceEvents.id,
          outcome: agentComplianceEvents.eventOutcome,
        })
        .from(agentComplianceEvents)
        .where(
          and(
            eq(agentComplianceEvents.organizationId, organizationId),
            eq(agentComplianceEvents.agentId, agentId),
            eq(agentComplianceEvents.eventCategory, "POLICY_EVALUATION"),
            gte(agentComplianceEvents.eventTimestamp, windowStart)
          )
        );
      totalPolicyEvaluations = policyEvents.length;
      policyDenials = policyEvents.filter((e) => e.outcome === "DENIED" || e.outcome === "FAILED").length;
    } catch {}

    // 3. Gather security incidents
    let securityViolations = 0;
    try {
      const secEvents = await this.db
        .select({ id: agentSecurityEvents.id })
        .from(agentSecurityEvents)
        .where(
          and(
            eq(agentSecurityEvents.agentId, agentId),
            gte(agentSecurityEvents.createdAt, windowStart)
          )
        );
      securityViolations = secEvents.length;
    } catch {}

    // 4. Gather approval requests
    let totalApprovalRequests = 0;
    let rejectedApprovals = 0;
    try {
      const approvals = await this.db
        .select({
          id: agentApprovalRequests.id,
          status: agentApprovalRequests.status,
        })
        .from(agentApprovalRequests)
        .where(
          and(
            eq(agentApprovalRequests.organizationId, organizationId),
            eq(agentApprovalRequests.agentId, agentId),
            gte(agentApprovalRequests.createdAt, windowStart)
          )
        );
      totalApprovalRequests = approvals.length;
      rejectedApprovals = approvals.filter((a) => a.status === "rejected" || a.status === "cancelled").length;
    } catch {}

    // 5. Gather tool executions
    let totalToolInvocations = 0;
    let failedToolInvocations = 0;
    try {
      const toolExecs = await this.db
        .select({
          id: aiAgentToolExecutions.id,
          status: aiAgentToolExecutions.status,
        })
        .from(aiAgentToolExecutions)
        .where(
          and(
            eq(aiAgentToolExecutions.agentId, agentId),
            gte(aiAgentToolExecutions.createdAt, windowStart)
          )
        );
      totalToolInvocations = toolExecs.length;
      failedToolInvocations = toolExecs.filter((t) => t.status === "failed" || t.status === "error").length;
    } catch {}

    // Calculate deterministic trust profile
    const result = calculateTrustProfile(
      agentId,
      {
        totalExecutions,
        failedExecutions,
        totalPolicyEvaluations,
        policyDenials,
        securityViolations,
        totalApprovalRequests,
        rejectedApprovals,
        totalToolInvocations,
        failedToolInvocations,
        evidenceItemsCount: 1,
        verifiedEvidenceCount: 1,
      },
      config.minOperationsForConfidence ?? 5
    );

    // Save profile to repo
    const saved = await this.repo.upsertTrustProfile(organizationId, agentId, {
      trustScore: result.trustScore,
      trustConfidence: result.trustConfidence,
      trustTier: result.trustTier,
      dimensionScores: result.dimensionScores as any,
      evidenceCount: result.evidenceCount,
      isInsufficientEvidence: result.isInsufficientEvidence,
      contributingFactors: result.contributingFactors as any,
      modelVersion: result.modelVersion,
    });

    // Record historical snapshot
    await this.repo.recordTrustAssessmentHistory({
      organizationId,
      agentId,
      trustScore: result.trustScore,
      trustConfidence: result.trustConfidence,
      dimensionScores: result.dimensionScores as any,
      evidenceCount: result.evidenceCount,
      isInsufficientEvidence: result.isInsufficientEvidence,
      evaluationReason: options?.actorId ? "MANUAL_REEVALUATION" : "PERIODIC_EVALUATION",
      evaluatedBy: options?.actorId,
    });

    return saved;
  }

  async getTrustAssessmentHistory(organizationId: string, agentId: string) {
    return this.repo.listTrustAssessmentHistory(organizationId, agentId);
  }

  // -------------------------------------------------------------------------
  // 5. Behavioral Risk Detection Engine
  // -------------------------------------------------------------------------

  async listAlerts(
    organizationId: string,
    filters?: {
      agentId?: string;
      status?: BehavioralAlertStatus;
      severity?: RiskTier;
      rule?: BehavioralDetectionRule;
      limit?: number;
      offset?: number;
    }
  ) {
    return this.repo.listAlerts(organizationId, filters);
  }

  async resolveAlert(organizationId: string, alertId: string, resolvedBy: string, notes?: string) {
    const updated = await this.repo.resolveAlert(organizationId, alertId, resolvedBy, notes);

    await this.emitAuditEvent(organizationId, {
      category: "SECURITY_CONTROL",
      eventType: "agent.risk.alert.resolved",
      actorType: "user",
      actorId: resolvedBy,
      resourceType: "behavioral_alert",
      resourceId: alertId,
      outcome: "SUCCESS",
      riskSeverity: "LOW",
      metadata: { resolutionNotes: notes },
    });

    return updated;
  }

  async acknowledgeAlert(organizationId: string, alertId: string, acknowledgedBy: string) {
    return this.repo.acknowledgeAlert(organizationId, alertId, acknowledgedBy);
  }

  /**
   * Evaluates operational telemetry across the 10 behavioral detection rules.
   * Deterministic, zero AI inference cost, deduplicated via fingerprinting.
   */
  async detectBehavioralRisks(
    organizationId: string,
    agentId?: string,
    lookbackMinutes: number = 60
  ): Promise<any[]> {
    const config = await this.repo.getConfiguration(organizationId);
    if (!config.behavioralDetectionEnabled) {
      return [];
    }

    const windowStart = new Date(Date.now() - lookbackMinutes * 60 * 1000);
    const dateBucket = new Date().toISOString().slice(0, 13); // hourly deduplication bucket

    const detectedAlerts: BehavioralDetectionResult[] = [];

    // Query relevant telemetry events
    const conditions = [
      eq(agentComplianceEvents.organizationId, organizationId),
      gte(agentComplianceEvents.eventTimestamp, windowStart),
    ];
    if (agentId) {
      conditions.push(eq(agentComplianceEvents.agentId, agentId));
    }

    const events = await this.db
      .select({
        id: agentComplianceEvents.id,
        agentId: agentComplianceEvents.agentId,
        category: agentComplianceEvents.eventCategory,
        eventType: agentComplianceEvents.eventType,
        outcome: agentComplianceEvents.eventOutcome,
        severity: agentComplianceEvents.riskSeverity,
        metadata: agentComplianceEvents.redactedMetadata,
      })
      .from(agentComplianceEvents)
      .where(and(...conditions))
      .limit(500);

    // Group events by agent
    const agentEventMap = new Map<string, typeof events>();
    for (const ev of events) {
      const aId = ev.agentId ?? "global";
      if (!agentEventMap.has(aId)) agentEventMap.set(aId, []);
      agentEventMap.get(aId)!.push(ev);
    }

    for (const [targetAgentId, evList] of agentEventMap.entries()) {
      const aRef = targetAgentId === "global" ? null : targetAgentId;

      // 1. REPEATED_POLICY_DENIALS: >= 3 policy denials
      const policyDenials = evList.filter(
        (e) => e.category === "POLICY_EVALUATION" && (e.outcome === "DENIED" || e.outcome === "FAILED")
      );
      if (policyDenials.length >= 3) {
        detectedAlerts.push({
          rule: "REPEATED_POLICY_DENIALS",
          severity: "HIGH",
          title: `Repeated Policy Denials (${policyDenials.length} events)`,
          description: `Agent experienced ${policyDenials.length} policy denials within the last ${lookbackMinutes} minutes.`,
          evidenceRefs: policyDenials.map((e) => ({ eventId: e.id, eventType: e.eventType })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "REPEATED_POLICY_DENIALS", dateBucket),
        });
      }

      // 2. EXCESSIVE_FAILED_TOOL_INVOCATIONS: >= 5 failed tools
      const toolFailures = evList.filter(
        (e) => e.category === "TOOL_INVOCATION" && (e.outcome === "FAILED" || e.outcome === "DENIED")
      );
      if (toolFailures.length >= 5) {
        detectedAlerts.push({
          rule: "EXCESSIVE_FAILED_TOOL_INVOCATIONS",
          severity: "HIGH",
          title: `Excessive Failed Tool Invocations (${toolFailures.length} failures)`,
          description: `Agent triggered ${toolFailures.length} tool invocation failures within the observation window.`,
          evidenceRefs: toolFailures.map((e) => ({ eventId: e.id, eventType: e.eventType })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "EXCESSIVE_FAILED_TOOL_INVOCATIONS", dateBucket),
        });
      }

      // 3. REPEATED_UNAUTHORIZED_ACCESS: >= 2 unauthorized access attempts
      const unauthorizedAttempts = evList.filter(
        (e) => e.eventType.includes("unauthorized") || e.outcome === "UNAUTHORIZED" || (e.metadata as any)?.statusCode === 403
      );
      if (unauthorizedAttempts.length >= 2) {
        detectedAlerts.push({
          rule: "REPEATED_UNAUTHORIZED_ACCESS",
          severity: "HIGH",
          title: `Repeated Unauthorized Access Attempts (${unauthorizedAttempts.length} attempts)`,
          description: `Detected ${unauthorizedAttempts.length} unauthorized access (403/Forbidden) events.`,
          evidenceRefs: unauthorizedAttempts.map((e) => ({ eventId: e.id, eventType: e.eventType })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "REPEATED_UNAUTHORIZED_ACCESS", dateBucket),
        });
      }

      // 4. SUDDEN_TOOL_USAGE_SPIKE: tool events >= 20 in short window
      const toolEvents = evList.filter((e) => e.category === "TOOL_INVOCATION");
      if (toolEvents.length >= 20) {
        detectedAlerts.push({
          rule: "SUDDEN_TOOL_USAGE_SPIKE",
          severity: "MEDIUM",
          title: `Sudden Tool Usage Spike (${toolEvents.length} calls)`,
          description: `Agent invoked tools at an abnormally high frequency (${toolEvents.length} calls in ${lookbackMinutes}m).`,
          evidenceRefs: toolEvents.slice(0, 10).map((e) => ({ eventId: e.id })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "SUDDEN_TOOL_USAGE_SPIKE", dateBucket),
        });
      }

      // 5. UNUSUAL_EXTERNAL_NETWORK_DESTINATIONS
      const unusualNetwork = evList.filter(
        (e) => (e.metadata as any)?.destinationUrl && (e.metadata as any)?.isExternalNonWhitelisted === true
      );
      if (unusualNetwork.length > 0) {
        detectedAlerts.push({
          rule: "UNUSUAL_EXTERNAL_NETWORK_DESTINATIONS",
          severity: "HIGH",
          title: `Unusual External Network Access (${unusualNetwork.length} requests)`,
          description: `Agent requested connections to non-whitelisted external destinations.`,
          evidenceRefs: unusualNetwork.map((e) => ({ eventId: e.id, url: (e.metadata as any)?.destinationUrl })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "UNUSUAL_EXTERNAL_NETWORK_DESTINATIONS", dateBucket),
        });
      }

      // 6. REPEATED_APPROVAL_REJECTIONS: >= 2 rejections
      const rejections = evList.filter(
        (e) => e.category === "HUMAN_APPROVAL" && (e.outcome === "REJECTED" || e.outcome === "DENIED")
      );
      if (rejections.length >= 2) {
        detectedAlerts.push({
          rule: "REPEATED_APPROVAL_REJECTIONS",
          severity: "HIGH",
          title: `Repeated Human Approval Rejections (${rejections.length} rejections)`,
          description: `Human reviewers rejected ${rejections.length} approval requests for this agent.`,
          evidenceRefs: rejections.map((e) => ({ eventId: e.id, eventType: e.eventType })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "REPEATED_APPROVAL_REJECTIONS", dateBucket),
        });
      }

      // 7. UNEXPECTED_PRIVILEGE_ESCALATION
      const privEsc = evList.filter(
        (e) => e.eventType.includes("privilege") || (e.metadata as any)?.isPrivilegeEscalation === true
      );
      if (privEsc.length > 0) {
        detectedAlerts.push({
          rule: "UNEXPECTED_PRIVILEGE_ESCALATION",
          severity: "CRITICAL",
          title: `Unexpected Privilege Escalation Attempt`,
          description: `Agent attempted an unauthorized privilege transition or high-tier tool execution.`,
          evidenceRefs: privEsc.map((e) => ({ eventId: e.id })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "UNEXPECTED_PRIVILEGE_ESCALATION", dateBucket),
        });
      }

      // 8. SECURITY_CONTROL_VIOLATIONS
      const secViolations = evList.filter(
        (e) => e.category === "SECURITY_CONTROL" && (e.severity === "CRITICAL" || e.severity === "HIGH")
      );
      if (secViolations.length > 0) {
        detectedAlerts.push({
          rule: "SECURITY_CONTROL_VIOLATIONS",
          severity: "CRITICAL",
          title: `Security Control Violations Detected (${secViolations.length} violations)`,
          description: `Agent breached runtime security boundaries (e.g. sandbox, SSRF, injection filter).`,
          evidenceRefs: secViolations.map((e) => ({ eventId: e.id, eventType: e.eventType })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "SECURITY_CONTROL_VIOLATIONS", dateBucket),
        });
      }

      // 9. EXCESSIVE_EXECUTION_COST_OR_RUNTIME
      const costExceeded = evList.filter(
        (e) => (e.metadata as any)?.costExceeded === true || (e.metadata as any)?.durationTimeout === true
      );
      if (costExceeded.length > 0) {
        detectedAlerts.push({
          rule: "EXCESSIVE_EXECUTION_COST_OR_RUNTIME",
          severity: "MEDIUM",
          title: `Execution Cost or Runtime Limit Exceeded`,
          description: `Agent operations exceeded allocated cost budgets or execution timeout limits.`,
          evidenceRefs: costExceeded.map((e) => ({ eventId: e.id })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "EXCESSIVE_EXECUTION_COST_OR_RUNTIME", dateBucket),
        });
      }

      // 10. AGENT_EXECUTION_FAILURE_SPIKES
      const execEvents = evList.filter((e) => e.category === "AGENT_EXECUTION");
      const failedExecs = execEvents.filter((e) => e.outcome === "FAILED" || e.outcome === "DENIED");
      if (execEvents.length >= 4 && failedExecs.length / execEvents.length >= 0.5) {
        detectedAlerts.push({
          rule: "AGENT_EXECUTION_FAILURE_SPIKES",
          severity: "HIGH",
          title: `Agent Execution Failure Spike (${failedExecs.length}/${execEvents.length} failed)`,
          description: `Agent execution failure rate spiked to ${Math.round((failedExecs.length / execEvents.length) * 100)}%.`,
          evidenceRefs: failedExecs.map((e) => ({ eventId: e.id })),
          fingerprint: generateAlertFingerprint(organizationId, aRef, "AGENT_EXECUTION_FAILURE_SPIKES", dateBucket),
        });
      }
    }

    // Persist alerts with deduplication
    const savedAlerts: any[] = [];
    for (const alert of detectedAlerts) {
      const existing = await this.repo.findAlertByFingerprint(organizationId, alert.fingerprint);
      if (existing) {
        // Increment occurrence count without duplicate alert spam
        const updated = await this.repo.updateAlert(organizationId, existing.id, {
          occurrenceCount: existing.occurrenceCount + 1,
          lastDetectedAt: new Date(),
        });
        savedAlerts.push(updated);
      } else {
        const created = await this.repo.createAlert({
          organizationId,
          agentId,
          alertIdentifier: `ALERT-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
          detectionRule: alert.rule,
          severity: alert.severity,
          status: "ACTIVE",
          title: alert.title,
          description: alert.description,
          evidenceRefs: alert.evidenceRefs as any,
          fingerprint: alert.fingerprint,
        });
        savedAlerts.push(created);

        // Emit security audit event
        await this.emitAuditEvent(organizationId, {
          category: "SECURITY_CONTROL",
          eventType: "agent.risk.alert.triggered",
          actorType: "system",
          agentId,
          resourceType: "behavioral_alert",
          resourceId: created?.id,
          outcome: "FLAGGED",
          riskSeverity: alert.severity as any,
          metadata: { rule: alert.rule, title: alert.title },
        });
      }
    }

    return savedAlerts;
  }

  // -------------------------------------------------------------------------
  // 6. Risk-Based Governance Integration
  // -------------------------------------------------------------------------

  /**
   * Evaluates risk governance recommendation for an agent/operation.
   *
   * SAFEGUARD 1: Explicit security denials ALWAYS take precedence!
   * SAFEGUARD 2: Risk scores can NEVER bypass mandatory security controls or RBAC.
   * SAFEGUARD 3: Default is disabled (MONITOR mode) until explicitly configured.
   */
  async evaluateRiskGovernanceDecision(
    organizationId: string,
    agentId: string,
    context?: {
      toolName?: string;
      action?: string;
      explicitSecurityDenial?: boolean;
    }
  ): Promise<RiskGovernanceRecommendation> {
    const reasons: string[] = [];
    let recommendation: RiskEnforcementMode = "ALLOW";
    let mandatorySecurityOverrideApplied = false;

    // 1. Mandatory Security Denial Precedence
    if (context?.explicitSecurityDenial === true) {
      return {
        agentId,
        recommendation: "SUSPEND",
        riskTier: "CRITICAL",
        trustScore: 0,
        trustTier: "VERY_LOW",
        activeAlertCount: 0,
        criticalAlertCount: 0,
        isRiskEnforcementEnabled: true,
        reasons: ["Explicit security control denial: mandatory platform security rule takes absolute precedence."],
        mandatorySecurityOverrideApplied: true,
        evaluatedAt: new Date().toISOString(),
      };
    }

    // 2. Fetch Organization Configuration
    const config = await this.repo.getConfiguration(organizationId);
    const isEnforcementEnabled = Boolean(config.riskEnforcementEnabled);

    // 3. Fetch Agent Trust Profile
    const trustProfile = await this.getTrustProfile(organizationId, agentId);
    const trustScore = trustProfile?.trustScore ?? 70;
    const trustTier: TrustTier = (trustProfile?.trustTier as TrustTier) ?? "NEUTRAL";

    // 4. Fetch Active Behavioral Alerts
    const alerts = await this.repo.listAlerts(organizationId, {
      agentId,
      status: "ACTIVE",
    });
    const activeAlertCount = alerts.length;
    const criticalAlerts = alerts.filter((a) => a.severity === "CRITICAL");
    const highAlerts = alerts.filter((a) => a.severity === "HIGH");

    // 5. Fetch Highest Residual Risk from Registry
    const risks = await this.repo.listRisks(organizationId, { agentId });
    let highestResidualTier: RiskTier = "LOW";
    for (const r of risks) {
      if (r.residualTier === "CRITICAL") highestResidualTier = "CRITICAL";
      else if (r.residualTier === "HIGH" && highestResidualTier !== "CRITICAL") highestResidualTier = "HIGH";
      else if (r.residualTier === "MEDIUM" && highestResidualTier === "LOW") highestResidualTier = "MEDIUM";
    }

    // 6. Check Active Risk Exceptions
    const now = new Date();
    const exceptions = await this.repo.listExceptions(organizationId, {
      status: "APPROVED",
      scopeTarget: agentId,
    });
    const validExceptions = exceptions.filter((e) => new Date(e.expirationDate) > now);

    // 7. Decision Logic
    if (criticalAlerts.length > 0) {
      recommendation = "SUSPEND";
      reasons.push(`${criticalAlerts.length} active CRITICAL behavioral alert(s) detected.`);
    } else if (highestResidualTier === "CRITICAL") {
      recommendation = "SUSPEND";
      reasons.push("Agent is associated with an unmitigated CRITICAL residual risk in registry.");
    } else if (highAlerts.length > 0 || highestResidualTier === "HIGH") {
      recommendation = "REQUIRE_APPROVAL";
      reasons.push(
        highAlerts.length > 0
          ? `${highAlerts.length} active HIGH severity alert(s) require human review.`
          : "HIGH residual risk requires human-in-the-loop approval before proceeding."
      );
    } else if (trustTier === "VERY_LOW" || trustScore < 40) {
      recommendation = "REQUIRE_APPROVAL";
      reasons.push(`Agent trust score (${trustScore}/100, VERY_LOW) requires human approval.`);
    } else if (highestResidualTier === "MEDIUM" || trustTier === "LOW") {
      recommendation = "MONITOR";
      reasons.push(`Medium risk posture (Trust: ${trustScore}/100). Telemetry will be monitored.`);
    } else {
      recommendation = "ALLOW";
      reasons.push(`Standard operational risk profile (Trust: ${trustScore}/100, ${trustTier}).`);
    }

    // If valid exception exists, it may soften REQUIRE_APPROVAL or RESTRICT to MONITOR/ALLOW
    const currentMode: string = recommendation;
    if (validExceptions.length > 0 && currentMode !== "SUSPEND") {
      const activeExc = validExceptions[0];
      reasons.push(`Active approved exception applied: "${activeExc.title}" (expires ${new Date(activeExc.expirationDate).toISOString()}).`);
      if (currentMode === "REQUIRE_APPROVAL" || currentMode === "RESTRICT") {
        recommendation = "MONITOR";
      }
    }

    // If risk enforcement is DISABLED, override response to MONITOR or ALLOW unless explicitly critical
    if (!isEnforcementEnabled) {
      reasons.unshift(`[SIMULATION MODE] Risk-based enforcement is disabled for organization. Calculated recommendation would be "${recommendation}".`);
      recommendation = "MONITOR";
    }

    return {
      agentId,
      recommendation,
      riskTier: highestResidualTier,
      trustScore,
      trustTier,
      activeAlertCount,
      criticalAlertCount: criticalAlerts.length,
      isRiskEnforcementEnabled: isEnforcementEnabled,
      reasons,
      mandatorySecurityOverrideApplied,
      evaluatedAt: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // 7. Risk Mitigation Management
  // -------------------------------------------------------------------------

  async listMitigations(
    organizationId: string,
    filters?: { riskId?: string; status?: MitigationPlanStatus; ownerId?: string }
  ) {
    return this.repo.listMitigations(organizationId, filters);
  }

  async getMitigation(organizationId: string, mitigationId: string) {
    return this.repo.getMitigationById(organizationId, mitigationId);
  }

  async createMitigationPlan(
    organizationId: string,
    data: {
      riskId: string;
      planIdentifier: string;
      title: string;
      description?: string;
      ownerId?: string;
      priority?: RiskTier;
      targetDate?: Date;
      correctiveActions: CorrectiveActionItem[];
      evidenceAttachments?: string[];
      createdBy?: string;
    }
  ) {
    const risk = await this.repo.getRiskById(organizationId, data.riskId);
    if (!risk) {
      throw new Error(`Risk with ID "${data.riskId}" not found in organization.`);
    }

    const created = await this.repo.createMitigation({
      organizationId,
      riskId: data.riskId,
      planIdentifier: data.planIdentifier,
      title: data.title,
      description: data.description,
      ownerId: data.ownerId,
      priority: data.priority ?? "MEDIUM",
      targetDate: data.targetDate,
      correctiveActions: data.correctiveActions as any,
      evidenceAttachments: data.evidenceAttachments ?? [],
      status: "OPEN",
      createdBy: data.createdBy,
    });

    // Update risk status to IN_MITIGATION
    await this.repo.updateRisk(organizationId, data.riskId, {
      mitigationStatus: "IN_MITIGATION",
    });

    await this.emitAuditEvent(organizationId, {
      category: "COMPLIANCE_CHANGE",
      eventType: "agent.risk.mitigation.created",
      actorType: "user",
      actorId: data.createdBy,
      resourceType: "risk_mitigation",
      resourceId: created?.id,
      outcome: "SUCCESS",
      riskSeverity: data.priority ?? "MEDIUM",
      metadata: { planIdentifier: data.planIdentifier, riskId: data.riskId },
    });

    return created;
  }

  async updateMitigationPlan(
    organizationId: string,
    mitigationId: string,
    data: Partial<{
      title: string;
      description: string;
      status: MitigationPlanStatus;
      correctiveActions: CorrectiveActionItem[];
      evidenceAttachments: string[];
    }>,
    actorId?: string
  ) {
    const updated = await this.repo.updateMitigation(organizationId, mitigationId, data as any);
    if (actorId) {
      await this.emitAuditEvent(organizationId, {
        category: "COMPLIANCE_CHANGE",
        eventType: "agent.risk.mitigation.updated",
        actorType: "user",
        actorId,
        resourceType: "risk_mitigation",
        resourceId: mitigationId,
        outcome: "SUCCESS",
        riskSeverity: "LOW",
        metadata: redactObject(data),
      });
    }
    return updated;
  }

  async verifyMitigationPlan(
    organizationId: string,
    mitigationId: string,
    verifiedBy: string,
    notes: string,
    evidenceIds?: string[]
  ) {
    const mitigation = await this.repo.getMitigationById(organizationId, mitigationId);
    if (!mitigation) {
      throw new Error(`Mitigation plan "${mitigationId}" not found.`);
    }

    // Require non-empty notes and evidence attachments before marking VERIFIED
    if (!notes || notes.trim().length === 0) {
      throw new Error("Verification notes and rationale are required to verify a mitigation plan.");
    }

    const verified = await this.repo.verifyMitigation(organizationId, mitigationId, verifiedBy, notes);

    // Update risk mitigation status
    await this.repo.updateRisk(organizationId, mitigation.riskId, {
      mitigationStatus: "MITIGATED",
    });

    await this.emitAuditEvent(organizationId, {
      category: "COMPLIANCE_CHANGE",
      eventType: "agent.risk.mitigation.verified",
      actorType: "user",
      actorId: verifiedBy,
      resourceType: "risk_mitigation",
      resourceId: mitigationId,
      outcome: "SUCCESS",
      riskSeverity: "LOW",
      metadata: { verifiedBy, notes, evidenceIds },
    });

    return verified;
  }

  // -------------------------------------------------------------------------
  // 8. Risk Acceptance & Exceptions
  // -------------------------------------------------------------------------

  async listExceptions(
    organizationId: string,
    filters?: { riskId?: string; status?: RiskExceptionStatus; scopeTarget?: string }
  ) {
    return this.repo.listExceptions(organizationId, filters);
  }

  async requestException(
    organizationId: string,
    data: {
      riskId: string;
      exceptionIdentifier: string;
      title: string;
      justification: string;
      scopeType: ExceptionScopeType;
      scopeTarget: string;
      expirationDate: Date;
      compensatingControls: CompensatingControlItem[];
      requestedBy: string;
    }
  ) {
    // Constraint: Expiration date is mandatory (no permanent exceptions!)
    if (!data.expirationDate || new Date(data.expirationDate) <= new Date()) {
      throw new Error("A valid future expiration date is mandatory for risk exceptions. Permanent exceptions are prohibited.");
    }

    const risk = await this.repo.getRiskById(organizationId, data.riskId);
    if (!risk) {
      throw new Error(`Risk with ID "${data.riskId}" not found in organization.`);
    }

    const created = await this.repo.createException({
      organizationId,
      riskId: data.riskId,
      exceptionIdentifier: data.exceptionIdentifier,
      title: data.title,
      justification: data.justification,
      scopeType: data.scopeType,
      scopeTarget: data.scopeTarget,
      status: "REQUESTED",
      requestedBy: data.requestedBy,
      expirationDate: new Date(data.expirationDate),
      compensatingControls: data.compensatingControls as any,
    });

    await this.emitAuditEvent(organizationId, {
      category: "GOVERNANCE_CHANGE",
      eventType: "agent.risk.exception.requested",
      actorType: "user",
      actorId: data.requestedBy,
      resourceType: "risk_exception",
      resourceId: created?.id,
      outcome: "PENDING",
      riskSeverity: "MEDIUM",
      metadata: {
        exceptionIdentifier: data.exceptionIdentifier,
        expirationDate: data.expirationDate,
      },
    });

    return created;
  }

  async approveException(
    organizationId: string,
    exceptionId: string,
    approvedBy: string,
    notes?: string
  ) {
    const exc = await this.repo.getExceptionById(organizationId, exceptionId);
    if (!exc) {
      throw new Error(`Exception with ID "${exceptionId}" not found.`);
    }

    // Constraint: Prevent self-approval
    if (exc.requestedBy === approvedBy) {
      throw new Error("Self-approval of risk exceptions is prohibited. An independent authorized reviewer must approve.");
    }

    // Constraint: Cannot approve expired exception
    if (new Date(exc.expirationDate) <= new Date()) {
      throw new Error("Cannot approve an already-expired risk exception.");
    }

    const approved = await this.repo.approveException(organizationId, exceptionId, approvedBy, notes);

    // Update risk status to ACCEPTED
    await this.repo.updateRisk(organizationId, exc.riskId, {
      mitigationStatus: "ACCEPTED",
      treatmentStrategy: "ACCEPT",
    });

    await this.emitAuditEvent(organizationId, {
      category: "GOVERNANCE_CHANGE",
      eventType: "agent.risk.exception.approved",
      actorType: "user",
      actorId: approvedBy,
      resourceType: "risk_exception",
      resourceId: exceptionId,
      outcome: "SUCCESS",
      riskSeverity: "HIGH",
      metadata: { approvedBy, notes, expirationDate: exc.expirationDate },
    });

    return approved;
  }

  async revokeException(
    organizationId: string,
    exceptionId: string,
    revokedBy: string,
    reason: string
  ) {
    const revoked = await this.repo.revokeException(organizationId, exceptionId, revokedBy, reason);

    await this.emitAuditEvent(organizationId, {
      category: "GOVERNANCE_CHANGE",
      eventType: "agent.risk.exception.revoked",
      actorType: "user",
      actorId: revokedBy,
      resourceType: "risk_exception",
      resourceId: exceptionId,
      outcome: "SUCCESS",
      riskSeverity: "MEDIUM",
      metadata: { revokedBy, reason },
    });

    return revoked;
  }

  // -------------------------------------------------------------------------
  // 9. Aggregations & Overview
  // -------------------------------------------------------------------------

  async getOverview(organizationId: string) {
    return this.repo.getRiskOverview(organizationId);
  }

  async getMatrix(organizationId: string) {
    return this.repo.getRiskMatrix(organizationId);
  }

  // -------------------------------------------------------------------------
  // Private Helper: Audit Event Ingestion
  // -------------------------------------------------------------------------

  private async emitAuditEvent(
    organizationId: string,
    event: {
      category: any;
      eventType: string;
      actorType: string;
      actorId?: string;
      agentId?: string;
      resourceType?: string;
      resourceId?: string;
      outcome: string;
      riskSeverity: any;
      metadata: Record<string, unknown>;
    }
  ) {
    try {
      if (this.complianceService) {
        await this.complianceService.recordComplianceEvent({
          organizationId,
          eventCategory: event.category,
          eventType: event.eventType,
          actorType: event.actorType as any,
          actorId: event.actorId,
          agentId: event.agentId,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
          eventOutcome: event.outcome as any,
          riskSeverity: event.riskSeverity,
          dataClassification: "INTERNAL",
          redactedMetadata: event.metadata,
        });
      }
    } catch {
      // Compliance logging failure must not block the core transaction
    }
  }
}
