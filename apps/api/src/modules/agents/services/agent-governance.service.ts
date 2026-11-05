import { ApiError } from "../../../common/errors/api-error.js";
import type { AgentGovernanceRepository } from "../repositories/agent-governance.repository.js";
import type {
  AgentGovernanceProfileEntity,
  AgentOwnershipAssignmentEntity,
  AgentGovernancePolicyEntity,
  AgentGovernancePolicyVersionEntity,
  AgentGovernanceAuditLogEntity,
  GovernanceOverviewStats,
  UpsertGovernanceProfileInput,
  AssignOwnershipInput,
  CreateGovernancePolicyInput,
  UpdateGovernancePolicyInput,
  RecordReviewInput,
  PolicyLifecycleState,
} from "../governance.types.js";

const VALID_CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"];
const VALID_RISK_TIERS = ["low", "medium", "high", "critical"];
const VALID_POLICY_TYPES = [
  "security",
  "compliance",
  "behavioral",
  "data_access",
  "model_restriction",
  "tool_restriction",
];
const VALID_LIFECYCLE_STATES: PolicyLifecycleState[] = [
  "draft",
  "review",
  "active",
  "deprecated",
  "archived",
];

const ALLOWED_LIFECYCLE_TRANSITIONS: Record<PolicyLifecycleState, PolicyLifecycleState[]> = {
  draft: ["review", "archived"],
  review: ["active", "draft", "archived"],
  active: ["deprecated", "review", "archived"],
  deprecated: ["active", "archived"],
  archived: ["draft"],
};

export class AgentGovernanceService {
  constructor(private readonly repository: AgentGovernanceRepository) {}

  // ---------------------------------------------------------------------------
  // 1. OVERVIEW & METRICS
  // ---------------------------------------------------------------------------

  async getGovernanceOverview(organizationId: string): Promise<GovernanceOverviewStats> {
    return await this.repository.getOverviewStats(organizationId);
  }

  // ---------------------------------------------------------------------------
  // 2. AGENT GOVERNANCE PROFILES
  // ---------------------------------------------------------------------------

  async getAgentProfile(
    organizationId: string,
    agentId: string,
  ): Promise<{
    profile: AgentGovernanceProfileEntity | null;
    ownership: AgentOwnershipAssignmentEntity | null;
  }> {
    const profile = await this.repository.getProfileByAgentId(organizationId, agentId);
    const ownership = await this.repository.getOwnershipByAgentId(organizationId, agentId);
    return { profile, ownership };
  }

  async listProfiles(
    organizationId: string,
    filters?: { riskTier?: string; complianceStatus?: string },
  ): Promise<AgentGovernanceProfileEntity[]> {
    return await this.repository.listProfiles(organizationId, filters);
  }

  async upsertProfile(
    input: UpsertGovernanceProfileInput,
  ): Promise<AgentGovernanceProfileEntity> {
    if (
      input.securityClassification &&
      !VALID_CLASSIFICATIONS.includes(input.securityClassification)
    ) {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        `Security classification must be one of: ${VALID_CLASSIFICATIONS.join(", ")}`,
      );
    }
    if (input.riskTier && !VALID_RISK_TIERS.includes(input.riskTier)) {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        `Risk tier must be one of: ${VALID_RISK_TIERS.join(", ")}`,
      );
    }

    const previous = await this.repository.getProfileByAgentId(
      input.organizationId,
      input.agentId,
    );
    const profile = await this.repository.upsertProfile(input);

    await this.repository.createAuditLog({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      actorId: input.userId,
      action: previous ? "profile_updated" : "profile_created",
      targetType: "agent_profile",
      targetId: profile.id,
      beforeState: previous ? (previous as unknown as Record<string, unknown>) : null,
      afterState: profile as unknown as Record<string, unknown>,
      metadata: { agentId: input.agentId },
    });

    return profile;
  }

  async recordAgentReview(input: RecordReviewInput): Promise<AgentGovernanceProfileEntity> {
    const previous = await this.repository.getProfileByAgentId(
      input.organizationId,
      input.agentId,
    );
    if (!previous) {
      throw new ApiError(404, "NOT_FOUND", `Governance profile for agent ${input.agentId} not found`);
    }

    const updated = await this.repository.recordReview(input);

    await this.repository.createAuditLog({
      organizationId: input.organizationId,
      workspaceId: previous.workspaceId,
      actorId: input.reviewedBy,
      action: "compliance_review_completed",
      targetType: "agent_profile",
      targetId: updated.id,
      beforeState: {
        complianceStatus: previous.complianceStatus,
        lastReviewedAt: previous.lastReviewedAt,
        nextReviewDueAt: previous.nextReviewDueAt,
      },
      afterState: {
        complianceStatus: updated.complianceStatus,
        lastReviewedAt: updated.lastReviewedAt,
        nextReviewDueAt: updated.nextReviewDueAt,
      },
      metadata: { notes: input.notes, agentId: input.agentId },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // 3. OWNERSHIP & ACCOUNTABILITY
  // ---------------------------------------------------------------------------

  async getAgentOwnership(
    organizationId: string,
    agentId: string,
  ): Promise<AgentOwnershipAssignmentEntity | null> {
    return await this.repository.getOwnershipByAgentId(organizationId, agentId);
  }

  async listOwnership(
    organizationId: string,
  ): Promise<AgentOwnershipAssignmentEntity[]> {
    return await this.repository.listOwnershipAssignments(organizationId);
  }

  async assignOwnership(
    input: AssignOwnershipInput,
  ): Promise<AgentOwnershipAssignmentEntity> {
    if (!input.primaryOwnerId) {
      throw new ApiError(400, "BAD_REQUEST", "Primary owner ID is required for ownership assignment");
    }
    if (!input.escalationContact || !input.escalationContact.trim()) {
      throw new ApiError(400, "BAD_REQUEST", "Escalation contact is required for ownership assignment");
    }

    const previous = await this.repository.getOwnershipByAgentId(
      input.organizationId,
      input.agentId,
    );
    const assignment = await this.repository.assignOwnership(input);

    await this.repository.createAuditLog({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      actorId: input.assignedBy,
      action: "ownership_assigned",
      targetType: "ownership",
      targetId: assignment.id,
      beforeState: previous ? (previous as unknown as Record<string, unknown>) : null,
      afterState: assignment as unknown as Record<string, unknown>,
      metadata: { agentId: input.agentId, primaryOwnerId: input.primaryOwnerId },
    });

    return assignment;
  }

  // ---------------------------------------------------------------------------
  // 4. GOVERNANCE POLICY REGISTRY
  // ---------------------------------------------------------------------------

  async getPolicy(
    organizationId: string,
    policyId: string,
  ): Promise<{
    policy: AgentGovernancePolicyEntity;
    versions: AgentGovernancePolicyVersionEntity[];
  }> {
    const policy = await this.repository.getPolicyById(organizationId, policyId);
    if (!policy) {
      throw new ApiError(404, "NOT_FOUND", `Policy ${policyId} not found`);
    }
    const versions = await this.repository.listPolicyVersions(organizationId, policyId);
    return { policy, versions };
  }

  async listPolicies(
    organizationId: string,
    filters?: { policyType?: string; lifecycleState?: string; severity?: string; scopeType?: string },
  ): Promise<AgentGovernancePolicyEntity[]> {
    return await this.repository.listPolicies(organizationId, filters);
  }

  async createPolicy(
    input: CreateGovernancePolicyInput,
  ): Promise<AgentGovernancePolicyEntity> {
    if (!input.name || !input.name.trim()) {
      throw new ApiError(400, "BAD_REQUEST", "Policy name is required");
    }
    if (!input.policyKey || !input.policyKey.trim()) {
      throw new ApiError(400, "BAD_REQUEST", "Policy key is required");
    }
    if (!VALID_POLICY_TYPES.includes(input.policyType)) {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        `Policy type must be one of: ${VALID_POLICY_TYPES.join(", ")}`,
      );
    }

    const existing = await this.repository.getPolicyByKey(input.organizationId, input.policyKey);
    if (existing) {
      throw new ApiError(
        409,
        "DATABASE_UNIQUE_CONSTRAINT",
        `A policy with key '${input.policyKey}' already exists in this organization`,
      );
    }

    const policy = await this.repository.createPolicy(input);

    await this.repository.createAuditLog({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      actorId: input.createdBy,
      action: "policy_created",
      targetType: "policy",
      targetId: policy.id,
      beforeState: null,
      afterState: policy as unknown as Record<string, unknown>,
      metadata: { policyKey: policy.policyKey, version: 1 },
    });

    return policy;
  }

  async updatePolicy(
    organizationId: string,
    policyId: string,
    input: UpdateGovernancePolicyInput,
  ): Promise<AgentGovernancePolicyEntity> {
    const existing = await this.repository.getPolicyById(organizationId, policyId);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Policy ${policyId} not found`);
    }

    if (input.policyType && !VALID_POLICY_TYPES.includes(input.policyType)) {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        `Policy type must be one of: ${VALID_POLICY_TYPES.join(", ")}`,
      );
    }

    const updated = await this.repository.updatePolicy(organizationId, policyId, input);

    await this.repository.createAuditLog({
      organizationId,
      workspaceId: existing.workspaceId,
      actorId: input.updatedBy,
      action: "policy_updated",
      targetType: "policy",
      targetId: policyId,
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
      metadata: {
        changeSummary: input.changeSummary,
        newVersion: updated.currentVersion,
      },
    });

    return updated;
  }

  async transitionPolicyLifecycle(
    organizationId: string,
    policyId: string,
    targetState: PolicyLifecycleState,
    userId: string,
  ): Promise<AgentGovernancePolicyEntity> {
    if (!VALID_LIFECYCLE_STATES.includes(targetState)) {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        `Lifecycle state must be one of: ${VALID_LIFECYCLE_STATES.join(", ")}`,
      );
    }

    const existing = await this.repository.getPolicyById(organizationId, policyId);
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Policy ${policyId} not found`);
    }

    const allowed = ALLOWED_LIFECYCLE_TRANSITIONS[existing.lifecycleState] || [];
    if (!allowed.includes(targetState)) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Cannot transition policy from '${existing.lifecycleState}' to '${targetState}'. Allowed transitions: ${allowed.join(", ") || "none"}`,
      );
    }

    const updated = await this.repository.updateLifecycleState(
      organizationId,
      policyId,
      targetState,
      userId,
    );

    await this.repository.createAuditLog({
      organizationId,
      workspaceId: existing.workspaceId,
      actorId: userId,
      action: "policy_state_changed",
      targetType: "policy",
      targetId: policyId,
      beforeState: { lifecycleState: existing.lifecycleState },
      afterState: { lifecycleState: updated.lifecycleState },
      metadata: { from: existing.lifecycleState, to: targetState },
    });

    return updated;
  }

  async listPolicyVersions(
    organizationId: string,
    policyId: string,
  ): Promise<AgentGovernancePolicyVersionEntity[]> {
    const policy = await this.repository.getPolicyById(organizationId, policyId);
    if (!policy) {
      throw new ApiError(404, "NOT_FOUND", `Policy ${policyId} not found`);
    }
    return await this.repository.listPolicyVersions(organizationId, policyId);
  }

  // ---------------------------------------------------------------------------
  // 5. AUDIT LOGS
  // ---------------------------------------------------------------------------

  async listAuditLogs(
    organizationId: string,
    filters?: { targetType?: string; targetId?: string; limit?: number },
  ): Promise<AgentGovernanceAuditLogEntity[]> {
    return await this.repository.listAuditLogs(organizationId, filters);
  }
}
