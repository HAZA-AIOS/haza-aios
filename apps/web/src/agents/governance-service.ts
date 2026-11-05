
export type GovernanceEnforcementMode = "DISABLED" | "MONITOR" | "ENFORCE";
export type PolicyDecisionType = "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "NOT_APPLICABLE";

export interface WebPolicyEvaluationContext {
  organizationId?: string;
  workspaceId?: string | null;
  actorId?: string;
  actorRoles?: string[];
  agentId?: string | null;
  toolKey?: string | null;
  action?: string | null;
  resourceClassification?: string | null;
  autonomyLevel?: string | number | null;
  riskTier?: string | null;
}

export interface WebPolicyDecisionResult {
  decision: PolicyDecisionType;
  effectiveDecision: PolicyDecisionType;
  enforcementMode: GovernanceEnforcementMode;
  reasonCode: string;
  reasonDetails: string;
  matchedPolicies: string[];
  matchedPolicyVersions: number[];
  mandatoryRestrictionViolated: boolean;
  requiredApprovalRoles?: string[];
  correlationId: string;
  timestamp: string;
  simulated: boolean;
}

export interface WebPolicySimulationResult {
  simulated: true;
  decision: PolicyDecisionType;
  effectiveDecision: PolicyDecisionType;
  enforcementMode: GovernanceEnforcementMode;
  precedenceLevel: number;
  precedenceDescription: string;
  matchedPolicies: Array<{
    id: string;
    policyKey: string;
    name: string;
    version: number;
    severity: string;
    enforcementAction: string;
    matchedRule: string;
  }>;
  reasonCode: string;
  reasonDetails: string;
  wouldRequireHumanApproval: boolean;
  requiredApprovalRoles: string[];
  simulatedAt: string;
  correlationId: string;
}

export interface WebPolicyVersionComparisonResult {
  policyId: string;
  v1: {
    version: number;
    lifecycleState: string;
    rules: Record<string, unknown>;
    changeSummary?: string | null;
  };
  v2: {
    version: number;
    lifecycleState: string;
    rules: Record<string, unknown>;
    changeSummary?: string | null;
  };
  diff: {
    addedRules: string[];
    removedRules: string[];
    modifiedRules: Array<{ key: string; oldValue: unknown; newValue: unknown }>;
  };
}
import { apiClient } from "../api/api-client";
import { readStoredAuth } from "../auth/auth-storage";

export type SecurityClassification = "public" | "internal" | "confidential" | "restricted";
export type RiskTier = "low" | "medium" | "high" | "critical";
export type ComplianceStatus = "compliant" | "pending_review" | "non_compliant" | "exempt";
export type PolicyLifecycleState = "draft" | "review" | "active" | "deprecated" | "archived";
export type PolicySeverity = "low" | "medium" | "high" | "critical";
export type PolicyScopeType = "organization" | "workspace" | "agent";
export type PolicyEnforcementAction = "audit" | "warn" | "block" | "require_approval";

export interface WebAgentGovernanceProfile {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  securityClassification: SecurityClassification;
  riskTier: RiskTier;
  complianceFrameworks: string[];
  maxAutonomyLevel: number;
  requireApprovalForTools: boolean;
  approvalPolicy: Record<string, unknown>;
  reviewCadenceDays: number;
  lastReviewedAt: string | null;
  nextReviewDueAt: string | null;
  complianceStatus: ComplianceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebAgentOwnershipAssignment {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  primaryOwnerId: string;
  technicalOwnerId: string | null;
  businessOwnerId: string | null;
  escalationContact: string;
  accountabilityStatus: "active" | "orphaned" | "transferred";
  assignedAt: string;
  assignedBy: string;
  updatedAt: string;
}

export interface WebAgentGovernancePolicy {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  name: string;
  policyKey: string;
  description: string | null;
  policyType: string;
  scopeType: PolicyScopeType;
  targetRefId: string | null;
  severity: PolicySeverity;
  enforcementAction: PolicyEnforcementAction;
  lifecycleState: PolicyLifecycleState;
  currentVersion: number;
  rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebAgentGovernancePolicyVersion {
  id: string;
  organizationId: string;
  policyId: string;
  version: number;
  lifecycleState: PolicyLifecycleState;
  rulesSnapshot: Record<string, unknown>;
  changeSummary: string | null;
  createdBy: string;
  createdAt: string;
}

export interface WebAgentGovernanceAuditLog {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WebGovernanceOverviewStats {
  totalProfiles: number;
  totalPolicies: number;
  activePolicies: number;
  orphanedAgents: number;
  pendingReviews: number;
  riskTierDistribution: Record<RiskTier, number>;
  complianceDistribution: Record<ComplianceStatus, number>;
}

export interface UpsertProfilePayload {
  workspaceId?: string | null;
  securityClassification?: SecurityClassification;
  riskTier?: RiskTier;
  complianceFrameworks?: string[];
  maxAutonomyLevel?: number;
  requireApprovalForTools?: boolean;
  approvalPolicy?: Record<string, unknown>;
  reviewCadenceDays?: number;
  complianceStatus?: ComplianceStatus;
  notes?: string;
}

export interface AssignOwnershipPayload {
  workspaceId?: string | null;
  primaryOwnerId: string;
  technicalOwnerId?: string | null;
  businessOwnerId?: string | null;
  escalationContact: string;
  accountabilityStatus?: "active" | "orphaned" | "transferred";
}

export interface CreatePolicyPayload {
  workspaceId?: string | null;
  name: string;
  policyKey: string;
  description?: string;
  policyType: string;
  scopeType: PolicyScopeType;
  targetRefId?: string | null;
  severity?: PolicySeverity;
  enforcementAction?: PolicyEnforcementAction;
  lifecycleState?: PolicyLifecycleState;
  rules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type WebApprovalRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "revoked"
  | "consumed";

export interface WebAgentApprovalRequest {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  agentId: string;
  actionType: string;
  actionTarget: string;
  resourceId?: string | null;
  requestingActorId: string;
  canonicalPayloadFingerprint: string;
  payload: Record<string, unknown>;
  approvalReason: string;
  riskClassification: string;
  securityClassification: string;
  assignedReviewerId?: string | null;
  assignedRole?: string | null;
  status: WebApprovalRequestStatus;
  decisionId?: string | null;
  consumedAt?: string | null;
  consumedBy?: string | null;
  expiresAt: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WebAgentApprovalDecision {
  id: string;
  approvalRequestId: string;
  organizationId: string;
  decision: "approved" | "rejected" | "revoked";
  decidedByActorId: string;
  decidedByActorType: string;
  reason?: string | null;
  justification?: string | null;
  policySnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface WebAgentApprovalEscalation {
  id: string;
  approvalRequestId: string;
  organizationId: string;
  escalatedByActorId: string;
  previousReviewerId?: string | null;
  escalatedToReviewerId?: string | null;
  escalationContact?: string | null;
  reason: string;
  status: string;
  createdAt: string;
}

export interface WebApprovalDetailsResult {
  request: WebAgentApprovalRequest;
  decisions: WebAgentApprovalDecision[];
  escalations: WebAgentApprovalEscalation[];
}

export class AgentGovernanceService {
  private getAuthToken(): string | undefined {
    return readStoredAuth()?.session?.accessToken ?? undefined;
  }

  // --- Overview ---
  async getOverview(organizationId: string): Promise<WebGovernanceOverviewStats> {
    const res = await apiClient.request<{ overview: WebGovernanceOverviewStats }>(
      `/api/v1/organizations/${organizationId}/agent-governance/overview`,
      { authToken: this.getAuthToken() },
    );
    return res.overview;
  }

  // --- Profiles ---
  async listProfiles(
    organizationId: string,
    filters?: { riskTier?: string; complianceStatus?: string },
  ): Promise<WebAgentGovernanceProfile[]> {
    const params = new URLSearchParams();
    if (filters?.riskTier) params.set("riskTier", filters.riskTier);
    if (filters?.complianceStatus) params.set("complianceStatus", filters.complianceStatus);
    const qs = params.toString() ? `?${params.toString()}` : "";

    const res = await apiClient.request<{ profiles: WebAgentGovernanceProfile[] }>(
      `/api/v1/organizations/${organizationId}/agent-governance/profiles${qs}`,
      { authToken: this.getAuthToken() },
    );
    return res.profiles;
  }

  async getProfile(
    organizationId: string,
    agentId: string,
  ): Promise<{
    profile: WebAgentGovernanceProfile | null;
    ownership: WebAgentOwnershipAssignment | null;
  }> {
    return await apiClient.request<{
      profile: WebAgentGovernanceProfile | null;
      ownership: WebAgentOwnershipAssignment | null;
    }>(`/api/v1/organizations/${organizationId}/agent-governance/profiles/${agentId}`, {
      authToken: this.getAuthToken(),
    });
  }

  async upsertProfile(
    organizationId: string,
    agentId: string,
    payload: UpsertProfilePayload,
  ): Promise<WebAgentGovernanceProfile> {
    const res = await apiClient.request<{ profile: WebAgentGovernanceProfile }>(
      `/api/v1/organizations/${organizationId}/agent-governance/profiles/${agentId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
        authToken: this.getAuthToken(),
      },
    );
    return res.profile;
  }

  async recordReview(
    organizationId: string,
    agentId: string,
    payload: { notes?: string; complianceStatus?: ComplianceStatus; nextReviewDueAt?: string },
  ): Promise<WebAgentGovernanceProfile> {
    const res = await apiClient.request<{ profile: WebAgentGovernanceProfile }>(
      `/api/v1/organizations/${organizationId}/agent-governance/profiles/${agentId}/review`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        authToken: this.getAuthToken(),
      },
    );
    return res.profile;
  }

  // --- Ownership ---
  async listOwnership(organizationId: string): Promise<WebAgentOwnershipAssignment[]> {
    const res = await apiClient.request<{ ownershipAssignments: WebAgentOwnershipAssignment[] }>(
      `/api/v1/organizations/${organizationId}/agent-governance/ownership`,
      { authToken: this.getAuthToken() },
    );
    return res.ownershipAssignments;
  }

  async assignOwnership(
    organizationId: string,
    agentId: string,
    payload: AssignOwnershipPayload,
  ): Promise<WebAgentOwnershipAssignment> {
    const res = await apiClient.request<{ ownership: WebAgentOwnershipAssignment }>(
      `/api/v1/organizations/${organizationId}/agent-governance/ownership/${agentId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
        authToken: this.getAuthToken(),
      },
    );
    return res.ownership;
  }

  // --- Policies ---
  async listPolicies(
    organizationId: string,
    filters?: { policyType?: string; lifecycleState?: string; severity?: string; scopeType?: string },
  ): Promise<WebAgentGovernancePolicy[]> {
    const params = new URLSearchParams();
    if (filters?.policyType) params.set("policyType", filters.policyType);
    if (filters?.lifecycleState) params.set("lifecycleState", filters.lifecycleState);
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.scopeType) params.set("scopeType", filters.scopeType);
    const qs = params.toString() ? `?${params.toString()}` : "";

    const res = await apiClient.request<{ policies: WebAgentGovernancePolicy[] }>(
      `/api/v1/organizations/${organizationId}/agent-governance/policies${qs}`,
      { authToken: this.getAuthToken() },
    );
    return res.policies;
  }

  async getPolicy(
    organizationId: string,
    policyId: string,
  ): Promise<{
    policy: WebAgentGovernancePolicy;
    versions: WebAgentGovernancePolicyVersion[];
  }> {
    return await apiClient.request<{
      policy: WebAgentGovernancePolicy;
      versions: WebAgentGovernancePolicyVersion[];
    }>(`/api/v1/organizations/${organizationId}/agent-governance/policies/${policyId}`, {
      authToken: this.getAuthToken(),
    });
  }

  async createPolicy(
    organizationId: string,
    payload: CreatePolicyPayload,
  ): Promise<WebAgentGovernancePolicy> {
    const res = await apiClient.request<{ policy: WebAgentGovernancePolicy }>(
      `/api/v1/organizations/${organizationId}/agent-governance/policies`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        authToken: this.getAuthToken(),
      },
    );
    return res.policy;
  }

  async updatePolicy(
    organizationId: string,
    policyId: string,
    payload: Partial<CreatePolicyPayload> & { changeSummary?: string },
  ): Promise<WebAgentGovernancePolicy> {
    const res = await apiClient.request<{ policy: WebAgentGovernancePolicy }>(
      `/api/v1/organizations/${organizationId}/agent-governance/policies/${policyId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
        authToken: this.getAuthToken(),
      },
    );
    return res.policy;
  }

  async transitionPolicyLifecycle(
    organizationId: string,
    policyId: string,
    targetState: PolicyLifecycleState,
  ): Promise<WebAgentGovernancePolicy> {
    const res = await apiClient.request<{ policy: WebAgentGovernancePolicy }>(
      `/api/v1/organizations/${organizationId}/agent-governance/policies/${policyId}/lifecycle`,
      {
        method: "PATCH",
        body: JSON.stringify({ targetState }),
        authToken: this.getAuthToken(),
      },
    );
    return res.policy;
  }

  // --- Audit Logs ---

  // --- Phase 22B: Enforcement Mode & Policy Engine ---
  async getEnforcementMode(organizationId: string): Promise<GovernanceEnforcementMode> {
    const res = await apiClient.request<{ enforcementMode: GovernanceEnforcementMode }>(
      `/api/v1/organizations/${organizationId}/agent-governance/mode`,
      { authToken: this.getAuthToken() },
    );
    return res.enforcementMode;
  }

  async setEnforcementMode(
    organizationId: string,
    mode: GovernanceEnforcementMode,
  ): Promise<GovernanceEnforcementMode> {
    const res = await apiClient.request<{ enforcementMode: GovernanceEnforcementMode }>(
      `/api/v1/organizations/${organizationId}/agent-governance/mode`,
      {
        method: "PUT",
        body: JSON.stringify({ mode }),
        authToken: this.getAuthToken(),
      },
    );
    return res.enforcementMode;
  }

  async evaluatePolicy(
    organizationId: string,
    context: WebPolicyEvaluationContext,
  ): Promise<WebPolicyDecisionResult> {
    const res = await apiClient.request<{ decision: WebPolicyDecisionResult }>(
      `/api/v1/organizations/${organizationId}/agent-governance/evaluate`,
      {
        method: "POST",
        body: JSON.stringify(context),
        authToken: this.getAuthToken(),
      },
    );
    return res.decision;
  }

  async simulatePolicy(
    organizationId: string,
    context: WebPolicyEvaluationContext,
  ): Promise<WebPolicySimulationResult> {
    const res = await apiClient.request<{ simulation: WebPolicySimulationResult }>(
      `/api/v1/organizations/${organizationId}/agent-governance/simulate`,
      {
        method: "POST",
        body: JSON.stringify(context),
        authToken: this.getAuthToken(),
      },
    );
    return res.simulation;
  }

  async listDecisions(
    organizationId: string,
    limit: number = 50,
  ): Promise<WebAgentGovernanceAuditLog[]> {
    const res = await apiClient.request<{ decisions: WebAgentGovernanceAuditLog[] }>(
      `/api/v1/organizations/${organizationId}/agent-governance/decisions?limit=${limit}`,
      { authToken: this.getAuthToken() },
    );
    return res.decisions;
  }

  async comparePolicyVersions(
    organizationId: string,
    policyId: string,
    v1: number,
    v2: number,
  ): Promise<WebPolicyVersionComparisonResult> {
    const res = await apiClient.request<{ comparison: WebPolicyVersionComparisonResult }>(
      `/api/v1/organizations/${organizationId}/agent-governance/policies/${policyId}/versions/compare?v1=${v1}&v2=${v2}`,
      { authToken: this.getAuthToken() },
    );
    return res.comparison;
  }

  async listAuditLogs(
    organizationId: string,
    filters?: { targetType?: string; targetId?: string; limit?: number },
  ): Promise<WebAgentGovernanceAuditLog[]> {
    const params = new URLSearchParams();
    if (filters?.targetType) params.set("targetType", filters.targetType);
    if (filters?.targetId) params.set("targetId", filters.targetId);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString() ? `?${params.toString()}` : "";

    const res = await apiClient.request<{ auditLogs: WebAgentGovernanceAuditLog[] }>(
      `/api/v1/organizations/${organizationId}/agent-governance/audit-logs${qs}`,
      { authToken: this.getAuthToken() },
    );
    return res.auditLogs;
  }

  // ---------------------------------------------------------------------------
  // HUMAN APPROVAL WORKFLOWS (Phase 22C)
  // ---------------------------------------------------------------------------

  async listApprovals(
    organizationId: string,
    filters?: { status?: string; agentId?: string; riskClassification?: string; limit?: number },
  ): Promise<WebAgentApprovalRequest[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== "all") params.set("status", filters.status);
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.riskClassification) params.set("riskClassification", filters.riskClassification);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const qs = params.toString() ? `?${params.toString()}` : "";

    const res = await apiClient.request<{ approvals: WebAgentApprovalRequest[] }>(
      `/api/v1/organizations/${organizationId}/agent-governance/approvals${qs}`,
      { authToken: this.getAuthToken() },
    );
    return res.approvals;
  }

  async getApprovalDetails(
    organizationId: string,
    approvalId: string,
  ): Promise<WebApprovalDetailsResult> {
    const res = await apiClient.request<{ details: WebApprovalDetailsResult }>(
      `/api/v1/organizations/${organizationId}/agent-governance/approvals/${approvalId}`,
      { authToken: this.getAuthToken() },
    );
    return res.details;
  }

  async approveRequest(
    organizationId: string,
    approvalId: string,
    justification?: string,
    reason?: string,
  ): Promise<{ request: WebAgentApprovalRequest; decision: WebAgentApprovalDecision }> {
    return await apiClient.request<{ request: WebAgentApprovalRequest; decision: WebAgentApprovalDecision }>(
      `/api/v1/organizations/${organizationId}/agent-governance/approvals/${approvalId}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ justification, reason }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async rejectRequest(
    organizationId: string,
    approvalId: string,
    justification?: string,
    reason?: string,
  ): Promise<{ request: WebAgentApprovalRequest; decision: WebAgentApprovalDecision }> {
    return await apiClient.request<{ request: WebAgentApprovalRequest; decision: WebAgentApprovalDecision }>(
      `/api/v1/organizations/${organizationId}/agent-governance/approvals/${approvalId}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ justification, reason }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async revokeRequest(
    organizationId: string,
    approvalId: string,
    reason?: string,
  ): Promise<{ request: WebAgentApprovalRequest; decision: WebAgentApprovalDecision }> {
    return await apiClient.request<{ request: WebAgentApprovalRequest; decision: WebAgentApprovalDecision }>(
      `/api/v1/organizations/${organizationId}/agent-governance/approvals/${approvalId}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async escalateRequest(
    organizationId: string,
    approvalId: string,
    reason: string,
    escalatedToReviewerId?: string,
  ): Promise<{ request: WebAgentApprovalRequest; escalation: WebAgentApprovalEscalation }> {
    return await apiClient.request<{ request: WebAgentApprovalRequest; escalation: WebAgentApprovalEscalation }>(
      `/api/v1/organizations/${organizationId}/agent-governance/approvals/${approvalId}/escalate`,
      {
        method: "POST",
        body: JSON.stringify({ reason, escalatedToReviewerId }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async continueApprovedExecution(
    organizationId: string,
    approvalId: string,
    providedPayload?: Record<string, unknown>,
  ): Promise<{ continuation: any }> {
    return await apiClient.request<{ continuation: any }>(
      `/api/v1/organizations/${organizationId}/agent-governance/approvals/${approvalId}/continue`,
      {
        method: "POST",
        body: JSON.stringify({ providedPayload }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async sweepExpiredApprovals(organizationId: string): Promise<{ expiredCount: number }> {
    return await apiClient.request<{ expiredCount: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/approvals/expire-sweep`,
      {
        method: "POST",
        authToken: this.getAuthToken(),
      },
    );
  }
}

export const agentGovernanceService = new AgentGovernanceService();
