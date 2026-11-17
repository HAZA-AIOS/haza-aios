
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

  // =========================================================================
  // EPIC 22D — SECURITY CONTROLS, SANDBOXING & SECRETS CLIENT METHODS
  // =========================================================================

  async getSecurityPosture(organizationId: string): Promise<WebSecurityPostureSummary> {
    return await apiClient.request<WebSecurityPostureSummary>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/posture`,
      { authToken: this.getAuthToken() },
    );
  }

  async listSecurityProfiles(
    organizationId: string,
    isSuspended?: boolean,
  ): Promise<{ items: WebAgentSecurityProfile[]; total: number }> {
    const query = isSuspended !== undefined ? `?isSuspended=${isSuspended}` : "";
    return await apiClient.request<{ items: WebAgentSecurityProfile[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/capabilities${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async getSecurityProfile(
    organizationId: string,
    agentId: string,
  ): Promise<WebAgentSecurityProfile> {
    return await apiClient.request<WebAgentSecurityProfile>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/capabilities/${agentId}`,
      { authToken: this.getAuthToken() },
    );
  }

  async updateSecurityProfile(
    organizationId: string,
    agentId: string,
    data: Partial<WebAgentSecurityProfile>,
  ): Promise<WebAgentSecurityProfile> {
    return await apiClient.request<WebAgentSecurityProfile>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/capabilities/${agentId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async suspendAgent(
    organizationId: string,
    agentId: string,
    reason: string,
  ): Promise<WebAgentSecurityProfile> {
    return await apiClient.request<WebAgentSecurityProfile>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/agents/${agentId}/suspend`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async reactivateAgent(
    organizationId: string,
    agentId: string,
  ): Promise<WebAgentSecurityProfile> {
    return await apiClient.request<WebAgentSecurityProfile>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/agents/${agentId}/reactivate`,
      {
        method: "POST",
        authToken: this.getAuthToken(),
      },
    );
  }

  async triggerEmergencyStop(
    organizationId: string,
    workspaceId?: string,
    reason?: string,
  ): Promise<{ status: string; stoppedAt: string; stoppedBy: string }> {
    return await apiClient.request<{ status: string; stoppedAt: string; stoppedBy: string }>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/emergency-stop`,
      {
        method: "POST",
        body: JSON.stringify({ workspaceId, reason }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async resumeEmergencyStop(
    organizationId: string,
    workspaceId?: string,
  ): Promise<{ status: string; resumedAt: string; resumedBy: string }> {
    return await apiClient.request<{ status: string; resumedAt: string; resumedBy: string }>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/emergency-resume`,
      {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async listSecretReferences(
    organizationId: string,
    status?: string,
    agentId?: string,
  ): Promise<{ items: WebAgentSecretReference[]; total: number }> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (agentId) params.set("agentId", agentId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebAgentSecretReference[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/secrets${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async createSecretReference(
    organizationId: string,
    data: {
      secretIdentifier: string;
      name: string;
      description?: string;
      allowedAgentIds?: string[];
      allowedToolKeys?: string[];
      initialValue?: string;
    },
  ): Promise<WebAgentSecretReference> {
    return await apiClient.request<WebAgentSecretReference>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/secrets`,
      {
        method: "POST",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async revokeSecretReference(
    organizationId: string,
    secretId: string,
  ): Promise<WebAgentSecretReference> {
    return await apiClient.request<WebAgentSecretReference>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/secrets/${secretId}/revoke`,
      {
        method: "POST",
        authToken: this.getAuthToken(),
      },
    );
  }

  async rotateSecretReference(
    organizationId: string,
    secretId: string,
    newValue?: string,
  ): Promise<WebAgentSecretReference> {
    return await apiClient.request<WebAgentSecretReference>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/secrets/${secretId}/rotate`,
      {
        method: "POST",
        body: JSON.stringify({ newValue }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async listSecurityEvents(
    organizationId: string,
    filters?: { agentId?: string; eventType?: string; severity?: string; limit?: number },
  ): Promise<{ items: WebAgentSecurityEvent[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.eventType) params.set("eventType", filters.eventType);
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebAgentSecurityEvent[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/security/events${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  // =========================================================================
  // Epic 22E: Compliance, Audit Integrity & Evidence Management
  // =========================================================================

  async getComplianceOverview(organizationId: string): Promise<WebComplianceOverview> {
    return await apiClient.request<WebComplianceOverview>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/overview`,
      { authToken: this.getAuthToken() },
    );
  }

  async listComplianceFrameworks(organizationId: string): Promise<{ items: WebComplianceFramework[]; total: number }> {
    return await apiClient.request<{ items: WebComplianceFramework[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/frameworks`,
      { authToken: this.getAuthToken() },
    );
  }

  async listComplianceControls(
    organizationId: string,
    filters?: { frameworkId?: string; category?: string; status?: string },
  ): Promise<{ items: WebComplianceControl[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.frameworkId) params.set("frameworkId", filters.frameworkId);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.status) params.set("status", filters.status);
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebComplianceControl[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/controls${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async verifyComplianceControl(
    organizationId: string,
    controlId: string,
    data: { status: string; exceptions?: string },
  ): Promise<WebComplianceControl> {
    return await apiClient.request<WebComplianceControl>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/controls/${controlId}/verify`,
      {
        method: "POST",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async listComplianceAuditEvents(
    organizationId: string,
    filters?: { category?: string; eventType?: string; agentId?: string; correlationId?: string; limit?: number },
  ): Promise<{ items: WebComplianceAuditEvent[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.eventType) params.set("eventType", filters.eventType);
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.correlationId) params.set("correlationId", filters.correlationId);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebComplianceAuditEvent[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/audit/events${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async verifyAuditIntegrity(
    organizationId: string,
    range?: { fromSeq?: number; toSeq?: number },
  ): Promise<WebAuditChainVerification> {
    const params = new URLSearchParams();
    if (range?.fromSeq !== undefined) params.set("fromSeq", String(range.fromSeq));
    if (range?.toSeq !== undefined) params.set("toSeq", String(range.toSeq));
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<WebAuditChainVerification>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/audit/verify${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async listEvidence(
    organizationId: string,
    filters?: { evidenceType?: string; classification?: string; isUnderLegalHold?: boolean; limit?: number },
  ): Promise<{ items: WebComplianceEvidence[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.evidenceType) params.set("evidenceType", filters.evidenceType);
    if (filters?.classification) params.set("classification", filters.classification);
    if (filters?.isUnderLegalHold !== undefined) params.set("isUnderLegalHold", String(filters.isUnderLegalHold));
    if (filters?.limit) params.set("limit", String(filters.limit));
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebComplianceEvidence[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/evidence${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async collectEvidence(
    organizationId: string,
    data: {
      workspaceId?: string | null;
      title: string;
      evidenceType: string;
      source: string;
      classification?: string;
      relatedControlIds?: string[];
      structuredPayload?: Record<string, unknown>;
    },
  ): Promise<WebComplianceEvidence> {
    return await apiClient.request<WebComplianceEvidence>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/evidence`,
      {
        method: "POST",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async listEvidencePackages(organizationId: string): Promise<{ items: WebEvidencePackage[]; total: number }> {
    return await apiClient.request<{ items: WebEvidencePackage[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/packages`,
      { authToken: this.getAuthToken() },
    );
  }

  async generateEvidencePackage(
    organizationId: string,
    data: {
      workspaceId?: string | null;
      packageIdentifier?: string;
      evidenceIds: string[];
      auditEventIds?: string[];
      redactionLevel?: string;
    },
  ): Promise<{ packageRecord: WebEvidencePackage; manifest: any }> {
    return await apiClient.request<{ packageRecord: WebEvidencePackage; manifest: any }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/packages`,
      {
        method: "POST",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async listRetentionPolicies(organizationId: string): Promise<{ items: WebRetentionPolicy[]; total: number }> {
    return await apiClient.request<{ items: WebRetentionPolicy[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/retention/policies`,
      { authToken: this.getAuthToken() },
    );
  }

  async upsertRetentionPolicy(
    organizationId: string,
    data: { recordCategory: string; retentionDurationDays: number; disposalAction?: string },
  ): Promise<WebRetentionPolicy> {
    return await apiClient.request<WebRetentionPolicy>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/retention/policies`,
      {
        method: "PUT",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async previewDisposal(organizationId: string): Promise<any> {
    return await apiClient.request<any>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/retention/preview`,
      { authToken: this.getAuthToken() },
    );
  }

  async listLegalHolds(organizationId: string, status?: string): Promise<{ items: WebLegalHold[]; total: number }> {
    const query = status ? `?status=${status}` : "";
    return await apiClient.request<{ items: WebLegalHold[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/holds${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async createLegalHold(
    organizationId: string,
    data: { name: string; reason: string; scopeType?: string; scopeCriteria?: Record<string, unknown>; description?: string },
  ): Promise<WebLegalHold> {
    return await apiClient.request<WebLegalHold>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/holds`,
      {
        method: "POST",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async releaseLegalHold(
    organizationId: string,
    holdIdentifier: string,
    justification: string,
  ): Promise<WebLegalHold> {
    return await apiClient.request<WebLegalHold>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/holds/${holdIdentifier}/release`,
      {
        method: "POST",
        body: JSON.stringify({ justification }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async listInvestigations(organizationId: string, status?: string): Promise<{ items: WebComplianceInvestigation[]; total: number }> {
    const query = status ? `?status=${status}` : "";
    return await apiClient.request<{ items: WebComplianceInvestigation[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/investigations${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async createInvestigation(
    organizationId: string,
    data: { title: string; description?: string; searchFilters?: Record<string, unknown> },
  ): Promise<WebComplianceInvestigation> {
    return await apiClient.request<WebComplianceInvestigation>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/investigations`,
      {
        method: "POST",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async getInvestigationTimeline(
    organizationId: string,
    query?: { correlationId?: string; traceId?: string; agentId?: string },
  ): Promise<{ timeline: WebInvestigationTimeline[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.correlationId) params.set("correlationId", query.correlationId);
    if (query?.traceId) params.set("traceId", query.traceId);
    if (query?.agentId) params.set("agentId", query.agentId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ timeline: WebInvestigationTimeline[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/investigations/timeline${qs}`,
      { authToken: this.getAuthToken() },
    );
  }

  async addInvestigationNote(
    organizationId: string,
    caseNumber: string,
    note: string,
  ): Promise<WebComplianceInvestigation> {
    return await apiClient.request<WebComplianceInvestigation>(
      `/api/v1/organizations/${organizationId}/agent-governance/compliance/investigations/${caseNumber}/notes`,
      {
        method: "POST",
        body: JSON.stringify({ note }),
        authToken: this.getAuthToken(),
      },
    );
  }

  // =========================================================================
  // EPIC 22F: ENTERPRISE AGENT RISK & TRUST MANAGEMENT
  // =========================================================================

  async getRiskOverview(organizationId: string): Promise<WebRiskOverview> {
    return await apiClient.request<WebRiskOverview>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/overview`,
      { authToken: this.getAuthToken() },
    );
  }

  async getRiskConfiguration(organizationId: string): Promise<WebRiskConfiguration> {
    return await apiClient.request<WebRiskConfiguration>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/configuration`,
      { authToken: this.getAuthToken() },
    );
  }

  async updateRiskConfiguration(
    organizationId: string,
    data: Partial<WebRiskConfiguration>,
  ): Promise<WebRiskConfiguration> {
    return await apiClient.request<WebRiskConfiguration>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/configuration`,
      {
        method: "PUT",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async listRisks(
    organizationId: string,
    filters?: { category?: string; residualTier?: string; agentId?: string; status?: string },
  ): Promise<{ items: WebRiskRegisterItem[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", filters.category);
    if (filters?.residualTier) params.set("residualTier", filters.residualTier);
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.status) params.set("status", filters.status);
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebRiskRegisterItem[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/register${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async getRisk(organizationId: string, riskId: string): Promise<WebRiskRegisterItem> {
    return await apiClient.request<WebRiskRegisterItem>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/register/${riskId}`,
      { authToken: this.getAuthToken() },
    );
  }

  async createRisk(organizationId: string, data: any): Promise<WebRiskRegisterItem> {
    return await apiClient.request<WebRiskRegisterItem>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/register`,
      {
        method: "POST",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async updateRisk(organizationId: string, riskId: string, data: any): Promise<WebRiskRegisterItem> {
    return await apiClient.request<WebRiskRegisterItem>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/register/${riskId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async deleteRisk(organizationId: string, riskId: string): Promise<{ success: boolean }> {
    return await apiClient.request<{ success: boolean }>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/register/${riskId}`,
      {
        method: "DELETE",
        authToken: this.getAuthToken(),
      },
    );
  }

  async assessRisk(organizationId: string, riskId: string, input: any): Promise<WebRiskAssessmentResult> {
    return await apiClient.request<WebRiskAssessmentResult>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/register/${riskId}/assessments`,
      {
        method: "POST",
        body: JSON.stringify(input),
        authToken: this.getAuthToken(),
      },
    );
  }

  async getRiskMatrix(organizationId: string): Promise<{ matrix: WebRiskMatrixCell[] }> {
    return await apiClient.request<{ matrix: WebRiskMatrixCell[] }>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/matrix`,
      { authToken: this.getAuthToken() },
    );
  }

  async listTrustProfiles(
    organizationId: string,
    filters?: { tier?: string; confidence?: string },
  ): Promise<{ items: WebAgentTrustProfile[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.tier) params.set("tier", filters.tier);
    if (filters?.confidence) params.set("confidence", filters.confidence);
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebAgentTrustProfile[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/trust-profiles${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async getTrustProfile(organizationId: string, agentId: string): Promise<WebAgentTrustProfile> {
    return await apiClient.request<WebAgentTrustProfile>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/trust-profiles/${agentId}`,
      { authToken: this.getAuthToken() },
    );
  }

  async evaluateAgentTrust(organizationId: string, agentId: string): Promise<WebAgentTrustProfile> {
    return await apiClient.request<WebAgentTrustProfile>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/trust-profiles/${agentId}/evaluate`,
      {
        method: "POST",
        authToken: this.getAuthToken(),
      },
    );
  }

  async listBehavioralAlerts(
    organizationId: string,
    filters?: { agentId?: string; status?: string; severity?: string },
  ): Promise<{ items: WebBehavioralRiskAlert[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.agentId) params.set("agentId", filters.agentId);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.severity) params.set("severity", filters.severity);
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebBehavioralRiskAlert[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/alerts${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async detectBehavioralAlerts(
    organizationId: string,
    agentId?: string,
  ): Promise<{ items: WebBehavioralRiskAlert[]; detected: number }> {
    return await apiClient.request<{ items: WebBehavioralRiskAlert[]; detected: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/alerts/detect`,
      {
        method: "POST",
        body: JSON.stringify({ agentId }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async acknowledgeBehavioralAlert(organizationId: string, alertId: string): Promise<WebBehavioralRiskAlert> {
    return await apiClient.request<WebBehavioralRiskAlert>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/alerts/${alertId}/acknowledge`,
      {
        method: "POST",
        authToken: this.getAuthToken(),
      },
    );
  }

  async acknowledgeAlert(organizationId: string, alertId: string): Promise<WebBehavioralRiskAlert> {
    return this.acknowledgeBehavioralAlert(organizationId, alertId);
  }

  async resolveBehavioralAlert(
    organizationId: string,
    alertId: string,
    notes?: string,
  ): Promise<WebBehavioralRiskAlert> {
    return await apiClient.request<WebBehavioralRiskAlert>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/alerts/${alertId}/resolve`,
      {
        method: "POST",
        body: JSON.stringify({ notes }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async resolveAlert(
    organizationId: string,
    alertId: string,
    notes?: string,
  ): Promise<WebBehavioralRiskAlert> {
    return this.resolveBehavioralAlert(organizationId, alertId, notes);
  }

  async listMitigations(
    organizationId: string,
    filters?: { riskId?: string; status?: string },
  ): Promise<{ items: WebRiskMitigationPlan[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.riskId) params.set("riskId", filters.riskId);
    if (filters?.status) params.set("status", filters.status);
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebRiskMitigationPlan[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/mitigations${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async createMitigationPlan(organizationId: string, data: any): Promise<WebRiskMitigationPlan> {
    return await apiClient.request<WebRiskMitigationPlan>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/mitigations`,
      {
        method: "POST",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async verifyMitigationPlan(
    organizationId: string,
    mitigationId: string,
    notes: string,
    evidenceIds?: string[],
  ): Promise<WebRiskMitigationPlan> {
    return await apiClient.request<WebRiskMitigationPlan>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/mitigations/${mitigationId}/verify`,
      {
        method: "POST",
        body: JSON.stringify({ notes, evidenceIds }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async listExceptions(
    organizationId: string,
    filters?: { riskId?: string; status?: string },
  ): Promise<{ items: WebRiskException[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.riskId) params.set("riskId", filters.riskId);
    if (filters?.status) params.set("status", filters.status);
    const query = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebRiskException[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/exceptions${query}`,
      { authToken: this.getAuthToken() },
    );
  }

  async requestException(organizationId: string, data: any): Promise<WebRiskException> {
    return await apiClient.request<WebRiskException>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/exceptions`,
      {
        method: "POST",
        body: JSON.stringify(data),
        authToken: this.getAuthToken(),
      },
    );
  }

  async approveException(organizationId: string, exceptionId: string, notes?: string): Promise<WebRiskException> {
    return await apiClient.request<WebRiskException>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/exceptions/${exceptionId}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ notes }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async revokeException(organizationId: string, exceptionId: string, reason: string): Promise<WebRiskException> {
    return await apiClient.request<WebRiskException>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/exceptions/${exceptionId}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async simulateRiskDecision(
    organizationId: string,
    agentId: string,
    context?: any,
  ): Promise<WebRiskGovernanceRecommendation> {
    return await apiClient.request<WebRiskGovernanceRecommendation>(
      `/api/v1/organizations/${organizationId}/agent-governance/risk/simulate`,
      {
        method: "POST",
        body: JSON.stringify({ agentId, ...context }),
        authToken: this.getAuthToken(),
      },
    );
  }

  // --- Epic 22G: Unified Governance Console Operations ---
  async getConsoleOverview(organizationId: string): Promise<WebConsoleOverview> {
    return await apiClient.request<WebConsoleOverview>(
      `/api/v1/organizations/${organizationId}/agent-governance/console/overview`,
      { authToken: this.getAuthToken() },
    );
  }

  async getAgentDirectory(
    organizationId: string,
    filter?: {
      search?: string;
      workspaceId?: string;
      status?: string;
      riskTier?: string;
      trustTier?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{ items: WebAgentDirectoryItem[]; total: number; page: number; pageSize: number }> {
    const params = new URLSearchParams();
    if (filter?.search) params.set("search", filter.search);
    if (filter?.workspaceId) params.set("workspaceId", filter.workspaceId);
    if (filter?.status) params.set("status", filter.status);
    if (filter?.riskTier) params.set("riskTier", filter.riskTier);
    if (filter?.trustTier) params.set("trustTier", filter.trustTier);
    if (filter?.page) params.set("page", String(filter.page));
    if (filter?.pageSize) params.set("pageSize", String(filter.pageSize));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebAgentDirectoryItem[]; total: number; page: number; pageSize: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/console/directory${qs}`,
      { authToken: this.getAuthToken() },
    );
  }

  async getAgentDirectoryDetail(organizationId: string, agentId: string): Promise<WebAgentDirectoryDetail> {
    return await apiClient.request<WebAgentDirectoryDetail>(
      `/api/v1/organizations/${organizationId}/agent-governance/console/directory/${agentId}`,
      { authToken: this.getAuthToken() },
    );
  }

  async getUnifiedActivity(
    organizationId: string,
    filter?: {
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
    },
  ): Promise<{ items: WebUnifiedActivityItem[]; total: number; page: number; pageSize: number }> {
    const params = new URLSearchParams();
    if (filter?.startDate) params.set("startDate", filter.startDate);
    if (filter?.endDate) params.set("endDate", filter.endDate);
    if (filter?.workspaceId) params.set("workspaceId", filter.workspaceId);
    if (filter?.agentId) params.set("agentId", filter.agentId);
    if (filter?.actorId) params.set("actorId", filter.actorId);
    if (filter?.category) params.set("category", filter.category);
    if (filter?.severity) params.set("severity", filter.severity);
    if (filter?.outcome) params.set("outcome", filter.outcome);
    if (filter?.correlationId) params.set("correlationId", filter.correlationId);
    if (filter?.traceId) params.set("traceId", filter.traceId);
    if (filter?.page) params.set("page", String(filter.page));
    if (filter?.pageSize) params.set("pageSize", String(filter.pageSize));
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<{ items: WebUnifiedActivityItem[]; total: number; page: number; pageSize: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/console/activity${qs}`,
      { authToken: this.getAuthToken() },
    );
  }

  async getActionCenter(organizationId: string): Promise<{ items: WebGovernanceActionItem[]; total: number }> {
    return await apiClient.request<{ items: WebGovernanceActionItem[]; total: number }>(
      `/api/v1/organizations/${organizationId}/agent-governance/console/actions`,
      { authToken: this.getAuthToken() },
    );
  }

  async getGovernanceReports(
    organizationId: string,
    query?: { startDate?: string; endDate?: string; reportType?: string },
  ): Promise<WebGovernanceReport> {
    const params = new URLSearchParams();
    if (query?.startDate) params.set("startDate", query.startDate);
    if (query?.endDate) params.set("endDate", query.endDate);
    if (query?.reportType) params.set("reportType", query.reportType);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.request<WebGovernanceReport>(
      `/api/v1/organizations/${organizationId}/agent-governance/console/reports${qs}`,
      { authToken: this.getAuthToken() },
    );
  }

  async exportGovernanceReport(
    organizationId: string,
    format: "JSON" | "CSV",
    query?: { startDate?: string; endDate?: string; reportType?: string },
  ): Promise<{ format: string; content: string; filename: string }> {
    return await apiClient.request<{ format: string; content: string; filename: string }>(
      `/api/v1/organizations/${organizationId}/agent-governance/console/reports/export`,
      {
        method: "POST",
        body: JSON.stringify({ format, query }),
        authToken: this.getAuthToken(),
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Epic 22E Web Types
// ---------------------------------------------------------------------------

export interface WebComplianceOverview {
  organizationId: string;
  totalControls: number;
  implementedControls: number;
  verifiedControls: number;
  evidencePendingControls: number;
  noncompliantControls: number;
  frameworkCoveragePercent: number;
  activeHoldsCount: number;
  totalEvidenceCount: number;
  totalPackagesCount: number;
  auditIntegrityStatus: {
    isValid: boolean;
    totalEvents: number;
    lastVerifiedAt: string;
  };
}

export interface WebComplianceFramework {
  id: string;
  frameworkKey: string;
  name: string;
  version: string;
  description: string | null;
  isEnabled: boolean;
}

export interface WebComplianceControl {
  id: string;
  frameworkId: string;
  controlKey: string;
  title: string;
  description: string | null;
  category: string;
  implementationStatus: string;
  reviewFrequencyDays: number;
  lastReviewedAt: string | null;
  nextReviewDueAt: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  exceptions: string | null;
}

export interface WebComplianceAuditEvent {
  id: string;
  eventCategory: string;
  eventType: string;
  eventTimestamp: string;
  actorId: string | null;
  agentId: string | null;
  eventOutcome: string;
  riskSeverity: string;
  dataClassification: string;
  redactedMetadata: Record<string, unknown>;
}

export interface WebAuditChainVerification {
  organizationId: string;
  isValid: boolean;
  totalEventsVerified: number;
  sequenceRange: { from: number; to: number } | null;
  brokenLinks: any[];
  tamperedEvents: any[];
  missingSequences: number[];
  verifiedAt: string;
  details: string;
}

export interface WebComplianceEvidence {
  id: string;
  title: string;
  evidenceType: string;
  source: string;
  classification: string;
  relatedControlIds: string[];
  contentHash: string;
  verificationStatus: string;
  isUnderLegalHold: boolean;
  collectedAt: string;
  accessCount: number;
}

export interface WebEvidencePackage {
  id: string;
  packageIdentifier: string;
  manifestChecksum: string;
  hashAlgorithm: string;
  evidenceIds: string[];
  auditEventIds: string[];
  redactionLevel: string;
  status: string;
  exportedAt: string;
}

export interface WebRetentionPolicy {
  id: string;
  recordCategory: string;
  retentionDurationDays: number;
  disposalAction: string;
  status: string;
}

export interface WebLegalHold {
  id: string;
  holdIdentifier: string;
  name: string;
  reason: string;
  scopeType: string;
  status: string;
  createdAt: string;
  releasedAt: string | null;
}

export interface WebComplianceInvestigation {
  id: string;
  caseNumber: string;
  title: string;
  description: string | null;
  status: string;
  notes: Array<{ note: string; authorId: string; timestamp: string }>;
  createdAt: string;
}

export interface WebInvestigationTimeline {
  stage: string;
  eventId: string;
  eventTimestamp: string;
  eventType: string;
  actorId: string | null;
  agentId: string | null;
  outcome: string;
  details: Record<string, unknown>;
}

export interface WebAgentSecurityProfile {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  resourceClassification: string;
  networkAccessMode: string;
  allowedNetworkDomains: string[];
  disallowedNetworkDomains: string[];
  storageAccessMode: string;
  allowedStoragePaths: string[];
  disallowedStoragePaths: string[];
  databaseOperations: string[];
  maxExecutionDurationMs: number;
  maxToolInvocations: number;
  maxMemoryBytes: number;
  maxAutonomyLevel: string;
  allowAutonomousExecution: boolean;
  delegationAttenuation: boolean;
  allowedToolKeys: string[];
  disallowedToolKeys: string[];
  allowedSecretReferenceIds: string[];
  isSuspended: boolean;
  suspendedAt: string | null;
  suspendedBy: string | null;
  suspensionReason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WebAgentSecretReference {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  secretIdentifier: string;
  name: string;
  description: string | null;
  allowedAgentIds: string[];
  allowedToolKeys: string[];
  status: "active" | "revoked" | "rotated";
  version: number;
  lastRotatedAt: string | null;
  createdBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WebAgentSecurityEvent {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string | null;
  actorId: string | null;
  eventType: string;
  severity: "low" | "medium" | "high" | "critical";
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface WebSecurityPostureSummary {
  overallStatus: "HEALTHY" | "SUSPENDED" | "EMERGENCY_STOPPED" | "DEGRADED";
  isEmergencyStopped: boolean;
  emergencyStoppedAt?: string | null;
  emergencyStoppedBy?: string | null;
  activeAgentsCount: number;
  suspendedAgentsCount: number;
  totalSecretReferencesCount: number;
  activeSecretReferencesCount: number;
  revokedSecretReferencesCount: number;
  securityEventsCount24h: number;
  criticalEventsCount24h: number;
}

// ---------------------------------------------------------------------------
// Epic 22F Web Types
// ---------------------------------------------------------------------------

export interface WebRiskOverview {
  totalRisks: number;
  lowCount: number;
  mediumCount: number;
  highCount: number;
  criticalCount: number;
  averageTrustScore: number;
  totalAgentsEvaluated: number;
  activeAlertCount: number;
  criticalAlertCount: number;
  pendingMitigationsCount: number;
  activeExceptionsCount: number;
  riskEnforcementEnabled: boolean;
  riskEnforcementMode: string;
}

export interface WebRiskConfiguration {
  id: string;
  organizationId: string;
  riskScoringModel: string;
  lowThresholdMax: number;
  mediumThresholdMax: number;
  highThresholdMax: number;
  criticalThresholdMin: number;
  riskEnforcementEnabled: boolean;
  riskEnforcementMode: string;
  trustEvaluationWindowDays: number;
  minOperationsForConfidence: number;
  behavioralDetectionEnabled: boolean;
}

export interface WebRiskRegisterItem {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  riskIdentifier: string;
  title: string;
  description: string | null;
  agentId: string | null;
  riskCategory: string;
  riskSource: string;
  likelihood: number;
  impact: number;
  inherentScore: number;
  inherentTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  existingControls: Array<{ id: string; name: string; effectiveness: string; reductionFactor?: number }>;
  residualScore: number;
  residualTier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  ownerId: string | null;
  treatmentStrategy: "MITIGATE" | "ACCEPT" | "AVOID" | "TRANSFER";
  mitigationStatus: "IDENTIFIED" | "ASSESSED" | "TREATMENT_PLANNED" | "IN_MITIGATION" | "MITIGATED" | "ACCEPTED" | "CLOSED";
  reviewFrequency: string;
  nextReviewDate: string | null;
  linkedSecurityEvents: string[];
  linkedComplianceControls: string[];
  linkedEvidenceIds: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebRiskAssessmentResult {
  inherentScore: number;
  inherentTier: string;
  residualScore: number;
  residualTier: string;
  scoringModel: string;
  modelVersion: string;
  controlsEvaluated: Array<{
    id: string;
    name: string;
    effectiveness: string;
    appliedReduction: number;
  }>;
  explanation: {
    inherentFormula: string;
    totalControlReduction: number;
    residualFormula: string;
    summary: string;
  };
}

export interface WebAgentTrustProfile {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string;
  trustScore: number;
  trustConfidence: "LOW" | "MEDIUM" | "HIGH";
  trustTier: "VERY_LOW" | "LOW" | "NEUTRAL" | "HIGH" | "VERY_HIGH";
  dimensionScores: Record<string, number>;
  evidenceCount: number;
  isInsufficientEvidence: boolean;
  contributingFactors: Array<{ dimension: string; score: number; weight: number; explanation: string }>;
  modelVersion: string;
  lastEvaluatedAt: string;
}

export interface WebBehavioralRiskAlert {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  agentId: string | null;
  alertIdentifier: string;
  detectionRule: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "ACKNOWLEDGED" | "SUPPRESSED" | "RESOLVED";
  title: string;
  description: string;
  evidenceRefs: Array<Record<string, unknown>>;
  occurrenceCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolutionNotes?: string | null;
}

export interface WebRiskMitigationPlan {
  id: string;
  organizationId: string;
  riskId: string;
  planIdentifier: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  targetDate: string | null;
  correctiveActions: Array<{ actionId: string; description: string; status: string; assignedTo?: string; completedAt?: string }>;
  evidenceAttachments: string[];
  status: "OPEN" | "IN_PROGRESS" | "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "CLOSED";
  verifiedBy: string | null;
  verifiedAt: string | null;
  verificationNotes: string | null;
}

export interface WebRiskException {
  id: string;
  organizationId: string;
  riskId: string;
  exceptionIdentifier: string;
  title: string;
  justification: string;
  scopeType: string;
  scopeTarget: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED";
  requestedBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  expirationDate: string;
  compensatingControls: Array<{ controlName: string; description: string; verified: boolean }>;
}

export interface WebRiskMatrixCell {
  likelihood: number;
  impact: number;
  inherentScore: number;
  count: number;
  risks: Array<{ id: string; title: string; tier: string }>;
}

export interface WebRiskGovernanceRecommendation {
  agentId: string;
  recommendation: "ALLOW" | "MONITOR" | "REQUIRE_APPROVAL" | "RESTRICT" | "SUSPEND";
  riskTier: string;
  trustScore: number;
  trustTier: string;
  activeAlertCount: number;
  criticalAlertCount: number;
  isRiskEnforcementEnabled: boolean;
  reasons: string[];
  mandatorySecurityOverrideApplied: boolean;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Epic 22G Web Types
// ---------------------------------------------------------------------------

export interface WebGovernanceKpis {
  totalGovernedAgents: number;
  activeAgents: number;
  suspendedAgents: number;
  pendingApprovals: number;
  highAndCriticalRisks: number;
  openSecurityIncidents: number;
  auditIntegrityStatus: "INTACT" | "COMPROMISED" | "UNCHECKED";
  lastVerifiedSequence: number;
  complianceControlsRequiringReview: number;
  openRiskMitigations: number;
  expiringExceptions: number;
  averageTrustScore: number;
}

export interface WebActivityTrendPoint {
  date: string;
  policyEvaluations: number;
  toolInvocations: number;
  securityEvents: number;
  approvals: number;
}

export interface WebCriticalGovernanceEvent {
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

export interface WebConsoleOverview {
  kpis: WebGovernanceKpis;
  enforcementMode: "MONITOR" | "ENFORCE" | "DISABLED";
  securityPosture: {
    isEmergencyStopped: boolean;
    emergencyStoppedAt?: string | null;
    emergencyStoppedBy?: string | null;
    suspendedAgentsCount: number;
    unresolvedIncidentsCount: number;
    secretReferencesCount: number;
  };
  complianceSummary: {
    frameworkCount: number;
    totalControls: number;
    verifiedControls: number;
    coveragePercent: number;
    activeLegalHoldsCount: number;
  };
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  approvalQueueSummary: {
    pending: number;
    escalated: number;
    approvedLast7Days: number;
    rejectedLast7Days: number;
  };
  activityTrends: WebActivityTrendPoint[];
  recentCriticalEvents: WebCriticalGovernanceEvent[];
  outstandingActionsCount: number;
  asOf: string;
}

export interface WebAgentDirectoryItem {
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

export interface WebAgentDirectoryDetail extends WebAgentDirectoryItem {
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

export interface WebUnifiedActivityItem {
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

export interface WebGovernanceActionItem {
  actionId: string;
  category: "APPROVAL" | "RISK" | "SECURITY" | "MITIGATION" | "COMPLIANCE" | "EXCEPTION" | "INTEGRITY";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  sourceEntityType: string;
  sourceEntityId: string;
  targetTab: string;
  agentId?: string | null;
  agentName?: string | null;
  dueAt: string | null;
  createdAt: string;
  status: string;
  suggestedActionLabel: string;
}

export interface WebGovernanceReport {
  organizationId: string;
  generatedAt: string;
  period: { from: string; to: string };
  reportType: string;
  executiveSummary: {
    governedAgentsCount: number;
    activePoliciesCount: number;
    emergencyStopActive: boolean;
    auditIntegrityStatus: "INTACT" | "COMPROMISED" | "UNCHECKED";
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
    risksByTier: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
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

export const agentGovernanceService = new AgentGovernanceService();
