/**
 * Enterprise Agent Risk & Trust Management Types
 * HAZA-AIOS — Epic 22F
 */

import { createHash } from "node:crypto";

// ============================================================================
// Enums & Literal Types
// ============================================================================

export type RiskCategory =
  | "SECURITY"
  | "PRIVACY"
  | "COMPLIANCE"
  | "OPERATIONAL"
  | "FINANCIAL"
  | "RELIABILITY"
  | "AUTONOMY"
  | "DATA_INTEGRITY"
  | "THIRD_PARTY"
  | "REPUTATIONAL";

export type RiskTier = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RiskTreatmentStrategy = "MITIGATE" | "ACCEPT" | "AVOID" | "TRANSFER";

export type RiskMitigationStatus =
  | "IDENTIFIED"
  | "ASSESSED"
  | "TREATMENT_PLANNED"
  | "IN_MITIGATION"
  | "MITIGATED"
  | "ACCEPTED"
  | "CLOSED";

export type RiskSource =
  | "MANUAL_ASSESSMENT"
  | "BEHAVIORAL_DETECTION"
  | "SECURITY_INCIDENT"
  | "AUDIT_FINDING"
  | "POLICY_VIOLATION"
  | "THIRD_PARTY_SCAN";

export type ControlEffectiveness = "EFFECTIVE" | "PARTIALLY_EFFECTIVE" | "INEFFECTIVE";

export type TrustConfidence = "LOW" | "MEDIUM" | "HIGH";

export type TrustTier = "VERY_LOW" | "LOW" | "NEUTRAL" | "HIGH" | "VERY_HIGH";

export type BehavioralDetectionRule =
  | "REPEATED_POLICY_DENIALS"
  | "EXCESSIVE_FAILED_TOOL_INVOCATIONS"
  | "REPEATED_UNAUTHORIZED_ACCESS"
  | "SUDDEN_TOOL_USAGE_SPIKE"
  | "UNUSUAL_EXTERNAL_NETWORK_DESTINATIONS"
  | "REPEATED_APPROVAL_REJECTIONS"
  | "UNEXPECTED_PRIVILEGE_ESCALATION"
  | "SECURITY_CONTROL_VIOLATIONS"
  | "EXCESSIVE_EXECUTION_COST_OR_RUNTIME"
  | "AGENT_EXECUTION_FAILURE_SPIKES";

export type BehavioralAlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "SUPPRESSED" | "RESOLVED";

export type RiskEnforcementMode = "ALLOW" | "MONITOR" | "REQUIRE_APPROVAL" | "RESTRICT" | "SUSPEND";

export type MitigationPlanStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REJECTED"
  | "CLOSED";

export type ExceptionScopeType = "AGENT" | "WORKSPACE" | "TOOL" | "ORGANIZATION";

export type RiskExceptionStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED";

export type RiskReviewType =
  | "INITIAL_ASSESSMENT"
  | "PERIODIC_REVIEW"
  | "MITIGATION_UPDATE"
  | "EXCEPTION_REVIEW"
  | "INCIDENT_POSTMORTEM";

// ============================================================================
// Core Interfaces
// ============================================================================

export interface RiskControlDefinition {
  id: string;
  name: string;
  effectiveness: ControlEffectiveness;
  reductionFactor?: number; // e.g. 0.5 for 50% reduction
  description?: string;
  verifiedAt?: string;
}

export interface RiskThresholdConfig {
  lowMax: number;        // default: 5
  mediumMax: number;     // default: 11
  highMax: number;       // default: 19
  criticalMin: number;   // default: 20
}

export interface RiskAssessmentInput {
  likelihood: number; // 1-5
  impact: number;     // 1-5
  controls?: RiskControlDefinition[];
  rationale?: string;
  assessedBy?: string;
}

export interface RiskAssessmentResult {
  inherentScore: number;
  inherentTier: RiskTier;
  residualScore: number;
  residualTier: RiskTier;
  scoringModel: string;
  modelVersion: string;
  controlsEvaluated: Array<{
    id: string;
    name: string;
    effectiveness: ControlEffectiveness;
    appliedReduction: number;
  }>;
  explanation: {
    inherentFormula: string;
    totalControlReduction: number;
    residualFormula: string;
    summary: string;
  };
}

export interface TrustDimensionScores {
  executionReliability: number;      // 0-100
  policyAdherence: number;           // 0-100
  securityIncidentHistory: number;   // 0-100
  humanApprovalOutcomes: number;     // 0-100
  toolExecutionSafety: number;       // 0-100
  complianceEvidenceQuality: number; // 0-100
  operationalConsistency: number;    // 0-100
}

export interface ContributingFactor {
  dimension: keyof TrustDimensionScores;
  score: number;
  weight: number;
  explanation: string;
}

export interface TrustEvaluationResult {
  agentId: string;
  trustScore: number;
  trustConfidence: TrustConfidence;
  trustTier: TrustTier;
  dimensionScores: TrustDimensionScores;
  evidenceCount: number;
  isInsufficientEvidence: boolean;
  contributingFactors: ContributingFactor[];
  modelVersion: string;
  evaluatedAt: string;
  explanation: string;
}

export interface BehavioralEventSignal {
  eventId: string;
  eventType: string;
  agentId?: string;
  outcome?: string;
  isError?: boolean;
  isSecurityViolation?: boolean;
  isPolicyDenial?: boolean;
  isApprovalRejection?: boolean;
  destinationUrl?: string;
  costCents?: number;
  durationMs?: number;
  timestamp: string | Date;
}

export interface BehavioralDetectionResult {
  rule: BehavioralDetectionRule;
  severity: RiskTier;
  title: string;
  description: string;
  evidenceRefs: Array<Record<string, unknown>>;
  fingerprint: string;
}

export interface RiskGovernanceRecommendation {
  agentId: string;
  recommendation: RiskEnforcementMode;
  riskTier: RiskTier;
  trustScore: number;
  trustTier: TrustTier;
  activeAlertCount: number;
  criticalAlertCount: number;
  isRiskEnforcementEnabled: boolean;
  reasons: string[];
  mandatorySecurityOverrideApplied: boolean;
  evaluatedAt: string;
}

export interface CorrectiveActionItem {
  actionId: string;
  description: string;
  status: "PENDING" | "COMPLETED";
  assignedTo?: string;
  completedAt?: string;
}

export interface CompensatingControlItem {
  controlName: string;
  description: string;
  verified: boolean;
}

// ============================================================================
// Deterministic Calculation Utilities
// ============================================================================

export const DEFAULT_RISK_THRESHOLDS: RiskThresholdConfig = {
  lowMax: 5,
  mediumMax: 11,
  highMax: 19,
  criticalMin: 20,
};

export const TRUST_DIMENSION_WEIGHTS: Record<keyof TrustDimensionScores, number> = {
  executionReliability: 0.20,
  policyAdherence: 0.20,
  securityIncidentHistory: 0.20,
  humanApprovalOutcomes: 0.10,
  toolExecutionSafety: 0.10,
  complianceEvidenceQuality: 0.10,
  operationalConsistency: 0.10,
};

/**
 * Maps a numeric score (1-25) to a RiskTier based on thresholds.
 */
export function determineRiskTier(score: number, thresholds: RiskThresholdConfig = DEFAULT_RISK_THRESHOLDS): RiskTier {
  if (score <= thresholds.lowMax) return "LOW";
  if (score <= thresholds.mediumMax) return "MEDIUM";
  if (score <= thresholds.highMax) return "HIGH";
  return "CRITICAL";
}

/**
 * Maps a numeric trust score (0-100) to a TrustTier.
 */
export function determineTrustTier(score: number): TrustTier {
  if (score < 40) return "VERY_LOW";
  if (score < 60) return "LOW";
  if (score < 75) return "NEUTRAL";
  if (score < 90) return "HIGH";
  return "VERY_HIGH";
}

/**
 * Deterministically evaluates inherent and residual risk.
 * Controls reduce risk ONLY based on their verified effectiveness.
 */
export function calculateRiskAssessment(
  input: RiskAssessmentInput,
  thresholds: RiskThresholdConfig = DEFAULT_RISK_THRESHOLDS,
  modelVersion: string = "v1.0.0"
): RiskAssessmentResult {
  const likelihood = Math.min(5, Math.max(1, Math.round(input.likelihood)));
  const impact = Math.min(5, Math.max(1, Math.round(input.impact)));

  const inherentScore = likelihood * impact;
  const inherentTier = determineRiskTier(inherentScore, thresholds);

  const controls = input.controls ?? [];
  const controlsEvaluated: Array<{
    id: string;
    name: string;
    effectiveness: ControlEffectiveness;
    appliedReduction: number;
  }> = [];

  let cumulativeReduction = 0;

  for (const ctrl of controls) {
    let reduction = 0;
    if (ctrl.effectiveness === "EFFECTIVE") {
      reduction = ctrl.reductionFactor ?? 0.40; // 40% reduction by default for effective control
    } else if (ctrl.effectiveness === "PARTIALLY_EFFECTIVE") {
      reduction = ctrl.reductionFactor ?? 0.20; // 20% reduction
    } else {
      // INEFFECTIVE: 0% reduction! Do not assume control reduces risk just because it exists.
      reduction = 0;
    }

    controlsEvaluated.push({
      id: ctrl.id,
      name: ctrl.name,
      effectiveness: ctrl.effectiveness,
      appliedReduction: reduction,
    });

    cumulativeReduction += reduction;
  }

  // Cap total reduction at 85% - risk can never be 0 through controls alone
  const cappedReduction = Math.min(0.85, cumulativeReduction);
  const residualScore = Math.max(1, Math.round(inherentScore * (1 - cappedReduction)));
  const residualTier = determineRiskTier(residualScore, thresholds);

  const summary =
    controlsEvaluated.length === 0
      ? `Inherent score ${inherentScore} (${inherentTier}). No mitigating controls applied; residual score is ${residualScore} (${residualTier}).`
      : `Inherent score ${inherentScore} (${inherentTier}). Mitigated by ${controlsEvaluated.length} control(s) applying ${Math.round(
          cappedReduction * 100
        )}% reduction, resulting in residual score ${residualScore} (${residualTier}).`;

  return {
    inherentScore,
    inherentTier,
    residualScore,
    residualTier,
    scoringModel: "INHERENT_LIKELIHOOD_IMPACT_V1",
    modelVersion,
    controlsEvaluated,
    explanation: {
      inherentFormula: `Likelihood (${likelihood}) × Impact (${impact}) = ${inherentScore}`,
      totalControlReduction: cappedReduction,
      residualFormula: `${inherentScore} × (1 - ${cappedReduction.toFixed(2)}) = ${residualScore}`,
      summary,
    },
  };
}

/**
 * Calculates per-agent trust profile deterministically from operational signals.
 * Does not classify a new agent as untrustworthy solely due to missing data.
 */
export function calculateTrustProfile(
  agentId: string,
  signals: {
    totalExecutions: number;
    failedExecutions: number;
    totalPolicyEvaluations: number;
    policyDenials: number;
    securityViolations: number;
    totalApprovalRequests: number;
    rejectedApprovals: number;
    totalToolInvocations: number;
    failedToolInvocations: number;
    evidenceItemsCount: number;
    verifiedEvidenceCount: number;
    costVariancePercent?: number;
    runtimeVariancePercent?: number;
  },
  minOperationsForConfidence: number = 5,
  modelVersion: string = "v1.0.0"
): TrustEvaluationResult {
  const isInsufficientEvidence = signals.totalExecutions < minOperationsForConfidence;

  let trustConfidence: TrustConfidence = "LOW";
  if (signals.totalExecutions >= 20) {
    trustConfidence = "HIGH";
  } else if (signals.totalExecutions >= minOperationsForConfidence) {
    trustConfidence = "MEDIUM";
  }

  // When evidence is insufficient, assign neutral baseline (70) rather than penalizing
  if (isInsufficientEvidence) {
    const neutralDimensions: TrustDimensionScores = {
      executionReliability: 70,
      policyAdherence: 70,
      securityIncidentHistory: 80,
      humanApprovalOutcomes: 70,
      toolExecutionSafety: 70,
      complianceEvidenceQuality: 70,
      operationalConsistency: 70,
    };

    const contributingFactors: ContributingFactor[] = [
      {
        dimension: "executionReliability",
        score: 70,
        weight: 0.20,
        explanation: `Insufficient execution history (${signals.totalExecutions}/${minOperationsForConfidence} required). Baseline assigned.`,
      },
      {
        dimension: "policyAdherence",
        score: 70,
        weight: 0.20,
        explanation: "Baseline policy adherence assigned awaiting sample volume.",
      },
      {
        dimension: "securityIncidentHistory",
        score: 80,
        weight: 0.20,
        explanation: "No security violations reported. Baseline assigned.",
      },
      {
        dimension: "humanApprovalOutcomes",
        score: 70,
        weight: 0.10,
        explanation: "Baseline approval score assigned.",
      },
      {
        dimension: "toolExecutionSafety",
        score: 70,
        weight: 0.10,
        explanation: "Baseline tool safety score assigned.",
      },
      {
        dimension: "complianceEvidenceQuality",
        score: 70,
        weight: 0.10,
        explanation: "Baseline compliance score assigned.",
      },
      {
        dimension: "operationalConsistency",
        score: 70,
        weight: 0.10,
        explanation: "Baseline operational consistency assigned.",
      },
    ];

    return {
      agentId,
      trustScore: 70,
      trustConfidence: "LOW",
      trustTier: "NEUTRAL",
      dimensionScores: neutralDimensions,
      evidenceCount: signals.totalExecutions,
      isInsufficientEvidence: true,
      contributingFactors,
      modelVersion,
      evaluatedAt: new Date().toISOString(),
      explanation: `Agent has limited operational telemetry (${signals.totalExecutions} execution(s)). A neutral baseline trust score (70, LOW confidence) is assigned to prevent misleading precision.`,
    };
  }

  // 1. Execution Reliability (0-100)
  const execSuccessRate = signals.totalExecutions > 0
    ? (signals.totalExecutions - signals.failedExecutions) / signals.totalExecutions
    : 1.0;
  const executionReliability = Math.round(execSuccessRate * 100);

  // 2. Policy Adherence (0-100)
  const policyPassRate = signals.totalPolicyEvaluations > 0
    ? (signals.totalPolicyEvaluations - signals.policyDenials) / signals.totalPolicyEvaluations
    : 1.0;
  const policyAdherence = Math.round(policyPassRate * 100);

  // 3. Security Incident History (0-100): Heavy penalty for security violations
  const securityIncidentHistory = Math.max(0, 100 - (signals.securityViolations * 25));

  // 4. Human Approval Outcomes (0-100)
  const approvalPassRate = signals.totalApprovalRequests > 0
    ? (signals.totalApprovalRequests - signals.rejectedApprovals) / signals.totalApprovalRequests
    : 1.0;
  const humanApprovalOutcomes = Math.round(approvalPassRate * 100);

  // 5. Tool Execution Safety (0-100)
  const toolSafetyRate = signals.totalToolInvocations > 0
    ? (signals.totalToolInvocations - signals.failedToolInvocations) / signals.totalToolInvocations
    : 1.0;
  const toolExecutionSafety = Math.round(toolSafetyRate * 100);

  // 6. Compliance Evidence Quality (0-100)
  const evidenceRate = signals.evidenceItemsCount > 0
    ? signals.verifiedEvidenceCount / signals.evidenceItemsCount
    : 0.7; // default moderate rate if no specific evidence requested
  const complianceEvidenceQuality = Math.round(evidenceRate * 100);

  // 7. Operational Consistency (0-100)
  const costVar = signals.costVariancePercent ?? 10;
  const runtimeVar = signals.runtimeVariancePercent ?? 10;
  const avgVar = (costVar + runtimeVar) / 2;
  const operationalConsistency = Math.max(0, Math.min(100, Math.round(100 - avgVar)));

  const dimensionScores: TrustDimensionScores = {
    executionReliability,
    policyAdherence,
    securityIncidentHistory,
    humanApprovalOutcomes,
    toolExecutionSafety,
    complianceEvidenceQuality,
    operationalConsistency,
  };

  // Weighted score calculation
  let weightedSum = 0;
  for (const [dim, weight] of Object.entries(TRUST_DIMENSION_WEIGHTS)) {
    const key = dim as keyof TrustDimensionScores;
    weightedSum += dimensionScores[key] * weight;
  }

  const finalTrustScore = Math.max(0, Math.min(100, Math.round(weightedSum)));
  const trustTier = determineTrustTier(finalTrustScore);

  const contributingFactors: ContributingFactor[] = [
    {
      dimension: "executionReliability",
      score: executionReliability,
      weight: TRUST_DIMENSION_WEIGHTS.executionReliability,
      explanation: `${executionReliability}% execution success rate across ${signals.totalExecutions} runs.`,
    },
    {
      dimension: "policyAdherence",
      score: policyAdherence,
      weight: TRUST_DIMENSION_WEIGHTS.policyAdherence,
      explanation: `${policyAdherence}% policy pass rate across ${signals.totalPolicyEvaluations} evaluations.`,
    },
    {
      dimension: "securityIncidentHistory",
      score: securityIncidentHistory,
      weight: TRUST_DIMENSION_WEIGHTS.securityIncidentHistory,
      explanation: signals.securityViolations === 0
        ? "Zero security violations recorded."
        : `${signals.securityViolations} security violation(s) penalized score.`,
    },
    {
      dimension: "humanApprovalOutcomes",
      score: humanApprovalOutcomes,
      weight: TRUST_DIMENSION_WEIGHTS.humanApprovalOutcomes,
      explanation: `${humanApprovalOutcomes}% approval pass rate across ${signals.totalApprovalRequests} requests.`,
    },
    {
      dimension: "toolExecutionSafety",
      score: toolExecutionSafety,
      weight: TRUST_DIMENSION_WEIGHTS.toolExecutionSafety,
      explanation: `${toolExecutionSafety}% tool invocation success rate across ${signals.totalToolInvocations} calls.`,
    },
    {
      dimension: "complianceEvidenceQuality",
      score: complianceEvidenceQuality,
      weight: TRUST_DIMENSION_WEIGHTS.complianceEvidenceQuality,
      explanation: `${complianceEvidenceQuality}% verified evidence quality.`,
    },
    {
      dimension: "operationalConsistency",
      score: operationalConsistency,
      weight: TRUST_DIMENSION_WEIGHTS.operationalConsistency,
      explanation: `Operational consistency score based on resource predictability.`,
    },
  ];

  return {
    agentId,
    trustScore: finalTrustScore,
    trustConfidence,
    trustTier,
    dimensionScores,
    evidenceCount: signals.totalExecutions,
    isInsufficientEvidence: false,
    contributingFactors,
    modelVersion,
    evaluatedAt: new Date().toISOString(),
    explanation: `Calculated trust score of ${finalTrustScore}/100 (${trustTier}, ${trustConfidence} confidence) across ${signals.totalExecutions} operations.`,
  };
}

/**
 * Generates an SHA-256 fingerprint for deduplicating behavioral risk alerts.
 */
export function generateAlertFingerprint(
  organizationId: string,
  agentId: string | null | undefined,
  rule: BehavioralDetectionRule,
  bucketIdentifier: string
): string {
  const content = `${organizationId}:${agentId ?? "global"}:${rule}:${bucketIdentifier}`;
  return createHash("sha256").update(content, "utf8").digest("hex");
}

