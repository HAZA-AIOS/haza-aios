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
}

export const agentGovernanceService = new AgentGovernanceService();
