/**
 * Enterprise Agent Governance Foundation Types
 * HAZA-AIOS Epic 22A — Agent Governance & Security
 */

export type SecurityClassification = "public" | "internal" | "confidential" | "restricted";
export type RiskTier = "low" | "medium" | "high" | "critical";
export type ComplianceStatus = "compliant" | "needs_review" | "non_compliant" | "exempt";
export type MaxAutonomyLevel = "L0" | "L1" | "L2" | "L3";
export type ApprovalPolicy = "none" | "standard" | "strict" | "four_eyes";
export type AuditFrequency = "monthly" | "quarterly" | "biannual" | "annual";

export type PolicyType =
  | "security"
  | "compliance"
  | "behavioral"
  | "data_access"
  | "model_restriction"
  | "tool_restriction"
  | "enforcement_control";

export type PolicySeverity = "low" | "medium" | "high" | "critical";
export type PolicyScopeType = "organization" | "workspace" | "agent_specific";
export type PolicyEnforcementAction = "log" | "notify" | "require_approval" | "redact" | "block";
export type PolicyLifecycleState = "draft" | "review" | "active" | "deprecated" | "archived";

export type GovernanceAction =
  | "profile_created"
  | "profile_updated"
  | "ownership_assigned"
  | "policy_created"
  | "policy_updated"
  | "policy_state_changed"
  | "policy_version_created"
  | "compliance_review_completed";

export type GovernanceTargetType = "agent_profile" | "ownership" | "policy" | "policy_version";

// ---------------------------------------------------------------------------
// Entity Models
// ---------------------------------------------------------------------------

export interface AgentGovernanceProfileEntity {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  securityClassification: SecurityClassification;
  riskTier: RiskTier;
  complianceFrameworks: string[];
  maxAutonomyLevel: MaxAutonomyLevel;
  approvalPolicy: ApprovalPolicy;
  requireApprovalForTools?: boolean;
  auditFrequency: AuditFrequency;
  strictTelemetry: boolean;
  reviewCadenceDays: number;
  lastReviewedAt: Date | null;
  nextReviewDueAt: Date | null;
  complianceStatus: ComplianceStatus;
  notes: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentOwnershipAssignmentEntity {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  primaryOwnerId: string;
  technicalOwnerId: string | null;
  businessOwnerId: string | null;
  escalationContact: string;
  reviewCadence: string;
  accountabilityStatus: "active" | "transferred" | "unassigned" | "vacant" | "orphaned";
  delegatedApproverIds: string[];
  assignedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentGovernancePolicyEntity {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  name: string;
  policyKey: string;
  policyType: PolicyType;
  scopeType: PolicyScopeType;
  targetAgentIds: string[];
  severity: PolicySeverity;
  enforcementAction: PolicyEnforcementAction;
  lifecycleState: PolicyLifecycleState;
  currentVersion: number;
  description: string | null;
  rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentGovernancePolicyVersionEntity {
  id: string;
  policyId: string;
  organizationId: string;
  version: number;
  lifecycleState: PolicyLifecycleState;
  changeSummary: string;
  rules: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
}

export interface AgentGovernanceAuditLogEntity {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  actorId: string;
  action: GovernanceAction | string;
  targetType: GovernanceTargetType | string;
  targetId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Overview & Aggregation DTOs
// ---------------------------------------------------------------------------

export interface GovernanceOverviewStats {
  totalGovernedAgents: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  complianceStatusCounts: {
    compliant: number;
    needs_review: number;
    non_compliant: number;
    exempt: number;
  };
  classificationCounts: {
    public: number;
    internal: number;
    confidential: number;
    restricted: number;
  };
  unassignedOwnershipCount: number;
  activePoliciesCount: number;
  policiesByType: Record<string, number>;
  policiesByState: Record<string, number>;
  overdueReviewsCount: number;
  recentAuditLogs: AgentGovernanceAuditLogEntity[];
}

// ---------------------------------------------------------------------------
// Inputs & Requests
// ---------------------------------------------------------------------------

export interface UpsertGovernanceProfileInput {
  organizationId: string;
  workspaceId?: string | null;
  agentId: string;
  securityClassification?: SecurityClassification;
  riskTier?: RiskTier;
  complianceFrameworks?: string[];
  maxAutonomyLevel?: MaxAutonomyLevel;
  approvalPolicy?: ApprovalPolicy;
  auditFrequency?: AuditFrequency;
  strictTelemetry?: boolean;
  reviewCadenceDays?: number;
  complianceStatus?: ComplianceStatus;
  notes?: string | null;
  userId: string;
}

export interface AssignOwnershipInput {
  organizationId: string;
  workspaceId?: string | null;
  agentId: string;
  primaryOwnerId: string;
  technicalOwnerId?: string | null;
  businessOwnerId?: string | null;
  escalationContact: string;
  reviewCadence?: string;
  accountabilityStatus?: "active" | "transferred" | "unassigned" | "vacant";
  delegatedApproverIds?: string[];
  assignedBy: string;
}

export interface CreateGovernancePolicyInput {
  organizationId: string;
  workspaceId?: string | null;
  name: string;
  policyKey: string;
  policyType: PolicyType;
  scopeType?: PolicyScopeType;
  targetAgentIds?: string[];
  severity?: PolicySeverity;
  enforcementAction?: PolicyEnforcementAction;
  lifecycleState?: PolicyLifecycleState;
  description?: string | null;
  rules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdBy: string;
}

export interface UpdateGovernancePolicyInput {
  name?: string;
  policyType?: PolicyType;
  scopeType?: PolicyScopeType;
  targetAgentIds?: string[];
  severity?: PolicySeverity;
  enforcementAction?: PolicyEnforcementAction;
  description?: string | null;
  rules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  changeSummary?: string;
  updatedBy: string;
}

export interface RecordReviewInput {
  organizationId: string;
  agentId: string;
  reviewedBy: string;
  complianceStatus: ComplianceStatus;
  notes?: string | null;
}
