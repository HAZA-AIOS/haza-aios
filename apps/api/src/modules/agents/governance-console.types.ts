/**
 * HAZA-AIOS — Epic 22G: Enterprise Governance Console & Unified Operations Types
 */

export type GovernanceTabKey =
  | "overview"
  | "agents"
  | "policies"
  | "approvals"
  | "security"
  | "compliance"
  | "risk"
  | "activity"
  | "actions"
  | "reports"
  | "settings";

export type AuditIntegrityStatus = "INTACT" | "COMPROMISED" | "UNCHECKED";

export interface UnifiedGovernanceKpis {
  totalGovernedAgents: number;
  activeAgents: number;
  suspendedAgents: number;
  pendingApprovals: number;
  highAndCriticalRisks: number;
  openSecurityIncidents: number;
  auditIntegrityStatus: AuditIntegrityStatus;
  lastVerifiedSequence: number;
  complianceControlsRequiringReview: number;
  openRiskMitigations: number;
  expiringExceptions: number;
  averageTrustScore: number;
}

export interface ActivityTrendPoint {
  date: string;
  policyEvaluations: number;
  toolInvocations: number;
  securityEvents: number;
  approvals: number;
}

export interface RiskTierDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ApprovalQueueSummary {
  pending: number;
  escalated: number;
  approvedLast7Days: number;
  rejectedLast7Days: number;
}

export interface SecurityPostureSummary {
  isEmergencyStopped: boolean;
  emergencyStoppedAt?: string | null;
  emergencyStoppedBy?: string | null;
  suspendedAgentsCount: number;
  unresolvedIncidentsCount: number;
  secretReferencesCount: number;
}

export interface ComplianceCoverageSummary {
  frameworkCount: number;
  totalControls: number;
  verifiedControls: number;
  coveragePercent: number;
  activeLegalHoldsCount: number;
}

export interface CriticalGovernanceEventItem {
  id: string;
  category: string;
  eventType: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  timestamp: string;
  description: string;
  agentId?: string | null;
  agentName?: string | null;
  actorId?: string | null;
}

export interface UnifiedGovernanceOverviewDTO {
  kpis: UnifiedGovernanceKpis;
  enforcementMode: "MONITOR" | "ENFORCE" | "DISABLED";
  securityPosture: SecurityPostureSummary;
  complianceSummary: ComplianceCoverageSummary;
  riskDistribution: RiskTierDistribution;
  approvalQueueSummary: ApprovalQueueSummary;
  activityTrends: ActivityTrendPoint[];
  recentCriticalEvents: CriticalGovernanceEventItem[];
  outstandingActionsCount: number;
  asOf: string;
}

export interface AgentDirectoryItemDTO {
  agentId: string;
  name: string;
  agentKey: string;
  organizationId: string;
  workspaceId: string | null;
  workspaceName?: string | null;
  ownerId: string | null;
  ownerEmail?: string | null;
  technicalOwnerId?: string | null;
  administratorId: string | null;
  profileId: string | null;
  securityClassification: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "RESTRICTED";
  maxAutonomyLevel: "L0" | "L1" | "L2" | "L3";
  isSuspended: boolean;
  suspensionReason: string | null;
  trustScore: number;
  trustTier: string;
  trustConfidence: string;
  residualRiskTier: string;
  pendingApprovalsCount: number;
  activeAlertsCount: number;
  assignedPoliciesCount: number;
  lastActiveAt: string | null;
  createdAt: string;
}

export interface AgentDirectoryFilter {
  workspaceId?: string;
  search?: string;
  status?: "all" | "active" | "suspended";
  riskTier?: string;
  trustTier?: string;
  page?: number;
  pageSize?: number;
}

export interface AgentDirectoryDetailDTO extends AgentDirectoryItemDTO {
  description: string;
  networkAccessMode: string;
  storageAccessMode: string;
  databaseOperations: string[];
  allowedDomains: string[];
  allowedToolKeys: string[];
  disallowedToolKeys: string[];
  allowedSecretReferenceIds: string[];
  delegationAttenuation: boolean;
  governanceReviewCadenceDays: number;
  nextReviewDueAt: string | null;
  recentRunsCount: number;
  recentAuditLogsCount: number;
  effectivePolicyKeys: string[];
}

export interface UnifiedActivityFilter {
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
  agentId?: string;
  actorId?: string;
  category?: string;
  severity?: string;
  outcome?: string;
  correlationId?: string;
  traceId?: string;
  page?: number;
  pageSize?: number;
}

export interface UnifiedActivityItemDTO {
  id: string;
  sourceDomain: "COMPLIANCE" | "SECURITY" | "POLICY" | "APPROVAL" | "EXECUTION" | "RISK";
  category: string;
  eventType: string;
  timestamp: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  actorId: string | null;
  actorType: string;
  agentId: string | null;
  agentName?: string | null;
  workspaceId: string | null;
  outcome: "SUCCESS" | "FAILED" | "DENIED" | "APPROVED" | "REJECTED" | "FLAGGED";
  correlationId: string | null;
  traceId: string | null;
  summary: string;
  redactedMetadata: Record<string, unknown>;
}

export type ActionItemCategory =
  | "APPROVAL"
  | "RISK"
  | "SECURITY"
  | "MITIGATION"
  | "COMPLIANCE"
  | "EXCEPTION"
  | "INTEGRITY";

export type ActionItemPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface GovernanceActionItemDTO {
  actionId: string;
  category: ActionItemCategory;
  priority: ActionItemPriority;
  title: string;
  description: string;
  sourceEntityType: string;
  sourceEntityId: string;
  targetTab: GovernanceTabKey;
  agentId?: string | null;
  agentName?: string | null;
  dueAt: string | null;
  createdAt: string;
  status: string;
  suggestedActionLabel: string;
}

export interface GovernanceReportQuery {
  startDate?: string;
  endDate?: string;
  workspaceId?: string;
  reportType?: "EXECUTIVE_SUMMARY" | "SECURITY_POSTURE" | "COMPLIANCE_AUDIT" | "RISK_TRUST";
}

export interface GovernanceReportDTO {
  organizationId: string;
  generatedAt: string;
  period: { from: string; to: string };
  reportType: string;
  executiveSummary: {
    governedAgentsCount: number;
    activePoliciesCount: number;
    emergencyStopActive: boolean;
    auditIntegrityStatus: AuditIntegrityStatus;
    averageTrustScore: number;
    openIncidentsCount: number;
    complianceCoveragePercent: number;
  };
  securityMetrics: {
    suspendedAgents: number;
    totalIncidents: number;
    criticalIncidents: number;
    secretReferencesCount: number;
  };
  complianceMetrics: {
    frameworkCount: number;
    totalControls: number;
    verifiedControls: number;
    nonCompliantControls: number;
    evidencePackagesCount: number;
    activeHoldsCount: number;
  };
  riskMetrics: {
    totalRisks: number;
    risksByTier: RiskTierDistribution;
    openMitigations: number;
    activeExceptions: number;
    activeBehavioralAlerts: number;
  };
  approvalMetrics: {
    pendingApprovals: number;
    escalatedApprovals: number;
    approvalRatePercent: number;
  };
}
