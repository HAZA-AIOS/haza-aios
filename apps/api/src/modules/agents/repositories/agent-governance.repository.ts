import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import {
  agentGovernanceProfiles,
  agentOwnershipAssignments,
  agentGovernancePolicies,
  agentGovernancePolicyVersions,
  agentGovernanceAuditLogs,
} from "../../../database/schema.js";
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

export class AgentGovernanceRepository {
  constructor(private readonly context: RepositoryContext) {}

  // ---------------------------------------------------------------------------
  // 1. GOVERNANCE PROFILES
  // ---------------------------------------------------------------------------

  async getProfileByAgentId(
    organizationId: string,
    agentId: string,
  ): Promise<AgentGovernanceProfileEntity | null> {
    const rows = await this.context.db
      .select()
      .from(agentGovernanceProfiles)
      .where(
        and(
          eq(agentGovernanceProfiles.organizationId, organizationId),
          eq(agentGovernanceProfiles.agentId, agentId),
        ),
      )
      .limit(1);

    return rows.length > 0 ? (rows[0] as unknown as AgentGovernanceProfileEntity) : null;
  }

  async listProfiles(
    organizationId: string,
    filters?: { riskTier?: string; complianceStatus?: string },
  ): Promise<AgentGovernanceProfileEntity[]> {
    const conditions = [eq(agentGovernanceProfiles.organizationId, organizationId)];

    if (filters?.riskTier) {
      conditions.push(eq(agentGovernanceProfiles.riskTier, filters.riskTier));
    }
    if (filters?.complianceStatus) {
      conditions.push(eq(agentGovernanceProfiles.complianceStatus, filters.complianceStatus));
    }

    const rows = await this.context.db
      .select()
      .from(agentGovernanceProfiles)
      .where(and(...conditions))
      .orderBy(desc(agentGovernanceProfiles.updatedAt));

    return rows as unknown as AgentGovernanceProfileEntity[];
  }

  async upsertProfile(
    input: UpsertGovernanceProfileInput,
  ): Promise<AgentGovernanceProfileEntity> {
    const existing = await this.getProfileByAgentId(input.organizationId, input.agentId);
    const now = new Date();
    const reviewCadenceDays = input.reviewCadenceDays ?? existing?.reviewCadenceDays ?? 90;
    const nextReviewDueAt = new Date(now.getTime() + reviewCadenceDays * 86400000);

    if (existing) {
      await this.context.db
        .update(agentGovernanceProfiles)
        .set({
          workspaceId: input.workspaceId !== undefined ? input.workspaceId : existing.workspaceId,
          securityClassification: input.securityClassification ?? existing.securityClassification,
          riskTier: input.riskTier ?? existing.riskTier,
          complianceFrameworks: input.complianceFrameworks ?? existing.complianceFrameworks,
          maxAutonomyLevel: input.maxAutonomyLevel ?? existing.maxAutonomyLevel,
          approvalPolicy: input.approvalPolicy ?? existing.approvalPolicy,
          auditFrequency: input.auditFrequency ?? existing.auditFrequency,
          strictTelemetry: input.strictTelemetry ?? existing.strictTelemetry,
          reviewCadenceDays,
          complianceStatus: input.complianceStatus ?? existing.complianceStatus,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          updatedBy: input.userId,
          updatedAt: now,
        })
        .where(
          and(
            eq(agentGovernanceProfiles.organizationId, input.organizationId),
            eq(agentGovernanceProfiles.agentId, input.agentId),
          ),
        );

      return (await this.getProfileByAgentId(input.organizationId, input.agentId))!;
    }

    const id = randomUUID();
    await this.context.db.insert(agentGovernanceProfiles).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      agentId: input.agentId,
      securityClassification: input.securityClassification || "internal",
      riskTier: input.riskTier || "medium",
      complianceFrameworks: input.complianceFrameworks || [],
      maxAutonomyLevel: input.maxAutonomyLevel || "L2",
      approvalPolicy: input.approvalPolicy || "standard",
      auditFrequency: input.auditFrequency || "quarterly",
      strictTelemetry: input.strictTelemetry ?? true,
      reviewCadenceDays,
      lastReviewedAt: null,
      nextReviewDueAt,
      complianceStatus: input.complianceStatus || "compliant",
      notes: input.notes || null,
      createdBy: input.userId,
      updatedBy: input.userId,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getProfileByAgentId(input.organizationId, input.agentId))!;
  }

  async recordReview(input: RecordReviewInput): Promise<AgentGovernanceProfileEntity> {
    const existing = await this.getProfileByAgentId(input.organizationId, input.agentId);
    if (!existing) {
      throw new Error(`Agent governance profile for ${input.agentId} not found`);
    }

    const now = new Date();
    const nextReviewDueAt = new Date(now.getTime() + existing.reviewCadenceDays * 86400000);

    await this.context.db
      .update(agentGovernanceProfiles)
      .set({
        lastReviewedAt: now,
        nextReviewDueAt,
        complianceStatus: input.complianceStatus,
        notes: input.notes !== undefined ? input.notes : existing.notes,
        updatedBy: input.reviewedBy,
        updatedAt: now,
      })
      .where(
        and(
          eq(agentGovernanceProfiles.organizationId, input.organizationId),
          eq(agentGovernanceProfiles.agentId, input.agentId),
        ),
      );

    return (await this.getProfileByAgentId(input.organizationId, input.agentId))!;
  }

  // ---------------------------------------------------------------------------
  // 2. OWNERSHIP & ACCOUNTABILITY
  // ---------------------------------------------------------------------------

  async getOwnershipByAgentId(
    organizationId: string,
    agentId: string,
  ): Promise<AgentOwnershipAssignmentEntity | null> {
    const rows = await this.context.db
      .select()
      .from(agentOwnershipAssignments)
      .where(
        and(
          eq(agentOwnershipAssignments.organizationId, organizationId),
          eq(agentOwnershipAssignments.agentId, agentId),
        ),
      )
      .limit(1);

    return rows.length > 0 ? (rows[0] as unknown as AgentOwnershipAssignmentEntity) : null;
  }

  async listOwnershipAssignments(
    organizationId: string,
  ): Promise<AgentOwnershipAssignmentEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentOwnershipAssignments)
      .where(eq(agentOwnershipAssignments.organizationId, organizationId))
      .orderBy(desc(agentOwnershipAssignments.updatedAt));

    return rows as unknown as AgentOwnershipAssignmentEntity[];
  }

  async assignOwnership(
    input: AssignOwnershipInput,
  ): Promise<AgentOwnershipAssignmentEntity> {
    const existing = await this.getOwnershipByAgentId(input.organizationId, input.agentId);
    const now = new Date();

    if (existing) {
      await this.context.db
        .update(agentOwnershipAssignments)
        .set({
          workspaceId: input.workspaceId !== undefined ? input.workspaceId : existing.workspaceId,
          primaryOwnerId: input.primaryOwnerId,
          technicalOwnerId: input.technicalOwnerId ?? existing.technicalOwnerId,
          businessOwnerId: input.businessOwnerId ?? existing.businessOwnerId,
          escalationContact: input.escalationContact,
          reviewCadence: input.reviewCadence ?? existing.reviewCadence,
          accountabilityStatus: input.accountabilityStatus ?? existing.accountabilityStatus,
          delegatedApproverIds: input.delegatedApproverIds ?? existing.delegatedApproverIds,
          assignedBy: input.assignedBy,
          updatedAt: now,
        })
        .where(
          and(
            eq(agentOwnershipAssignments.organizationId, input.organizationId),
            eq(agentOwnershipAssignments.agentId, input.agentId),
          ),
        );

      return (await this.getOwnershipByAgentId(input.organizationId, input.agentId))!;
    }

    const id = randomUUID();
    await this.context.db.insert(agentOwnershipAssignments).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      agentId: input.agentId,
      primaryOwnerId: input.primaryOwnerId,
      technicalOwnerId: input.technicalOwnerId || null,
      businessOwnerId: input.businessOwnerId || null,
      escalationContact: input.escalationContact,
      reviewCadence: input.reviewCadence || "quarterly",
      accountabilityStatus: input.accountabilityStatus || "active",
      delegatedApproverIds: input.delegatedApproverIds || [],
      assignedBy: input.assignedBy,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.getOwnershipByAgentId(input.organizationId, input.agentId))!;
  }

  // ---------------------------------------------------------------------------
  // 3. GOVERNANCE POLICY REGISTRY
  // ---------------------------------------------------------------------------

  async getPolicyById(
    organizationId: string,
    policyId: string,
  ): Promise<AgentGovernancePolicyEntity | null> {
    const rows = await this.context.db
      .select()
      .from(agentGovernancePolicies)
      .where(
        and(
          eq(agentGovernancePolicies.organizationId, organizationId),
          eq(agentGovernancePolicies.id, policyId),
        ),
      )
      .limit(1);

    return rows.length > 0 ? (rows[0] as unknown as AgentGovernancePolicyEntity) : null;
  }

  async getPolicyByKey(
    organizationId: string,
    policyKey: string,
  ): Promise<AgentGovernancePolicyEntity | null> {
    const rows = await this.context.db
      .select()
      .from(agentGovernancePolicies)
      .where(
        and(
          eq(agentGovernancePolicies.organizationId, organizationId),
          eq(agentGovernancePolicies.policyKey, policyKey),
        ),
      )
      .limit(1);

    return rows.length > 0 ? (rows[0] as unknown as AgentGovernancePolicyEntity) : null;
  }

  async listPolicies(
    organizationId: string,
    filters?: { policyType?: string; lifecycleState?: string; severity?: string; scopeType?: string },
  ): Promise<AgentGovernancePolicyEntity[]> {
    const conditions = [eq(agentGovernancePolicies.organizationId, organizationId)];

    if (filters?.policyType) {
      conditions.push(eq(agentGovernancePolicies.policyType, filters.policyType));
    }
    if (filters?.lifecycleState) {
      conditions.push(eq(agentGovernancePolicies.lifecycleState, filters.lifecycleState));
    }
    if (filters?.severity) {
      conditions.push(eq(agentGovernancePolicies.severity, filters.severity));
    }
    if (filters?.scopeType) {
      conditions.push(eq(agentGovernancePolicies.scopeType, filters.scopeType));
    }

    const rows = await this.context.db
      .select()
      .from(agentGovernancePolicies)
      .where(and(...conditions))
      .orderBy(desc(agentGovernancePolicies.updatedAt));

    return rows as unknown as AgentGovernancePolicyEntity[];
  }

  async createPolicy(
    input: CreateGovernancePolicyInput,
  ): Promise<AgentGovernancePolicyEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(agentGovernancePolicies).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      name: input.name,
      policyKey: input.policyKey,
      policyType: input.policyType,
      scopeType: input.scopeType || "organization",
      targetAgentIds: input.targetAgentIds || [],
      severity: input.severity || "medium",
      enforcementAction: input.enforcementAction || "log",
      lifecycleState: input.lifecycleState || "draft",
      currentVersion: 1,
      description: input.description || null,
      rules: input.rules || {},
      metadata: input.metadata || {},
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // Create version 1 record
    await this.createPolicyVersion(
      id,
      input.organizationId,
      1,
      input.lifecycleState || "draft",
      "Initial policy creation",
      input.rules || {},
      input.createdBy,
    );

    return (await this.getPolicyById(input.organizationId, id))!;
  }

  async updatePolicy(
    organizationId: string,
    policyId: string,
    input: UpdateGovernancePolicyInput,
  ): Promise<AgentGovernancePolicyEntity> {
    const existing = await this.getPolicyById(organizationId, policyId);
    if (!existing) {
      throw new Error(`Policy ${policyId} not found in organization ${organizationId}`);
    }

    const now = new Date();
    const nextVersion = existing.currentVersion + 1;
    const updatedRules = input.rules || existing.rules;

    await this.context.db
      .update(agentGovernancePolicies)
      .set({
        name: input.name ?? existing.name,
        policyType: input.policyType ?? existing.policyType,
        scopeType: input.scopeType ?? existing.scopeType,
        targetAgentIds: input.targetAgentIds ?? existing.targetAgentIds,
        severity: input.severity ?? existing.severity,
        enforcementAction: input.enforcementAction ?? existing.enforcementAction,
        description: input.description !== undefined ? input.description : existing.description,
        rules: updatedRules,
        metadata: input.metadata ?? existing.metadata,
        currentVersion: nextVersion,
        updatedBy: input.updatedBy,
        updatedAt: now,
      })
      .where(
        and(
          eq(agentGovernancePolicies.organizationId, organizationId),
          eq(agentGovernancePolicies.id, policyId),
        ),
      );

    // Record new version
    await this.createPolicyVersion(
      policyId,
      organizationId,
      nextVersion,
      existing.lifecycleState,
      input.changeSummary || `Version ${nextVersion} update`,
      updatedRules,
      input.updatedBy,
    );

    return (await this.getPolicyById(organizationId, policyId))!;
  }

  async updateLifecycleState(
    organizationId: string,
    policyId: string,
    state: PolicyLifecycleState,
    updatedBy: string,
  ): Promise<AgentGovernancePolicyEntity> {
    const existing = await this.getPolicyById(organizationId, policyId);
    if (!existing) {
      throw new Error(`Policy ${policyId} not found in organization ${organizationId}`);
    }

    const now = new Date();
    await this.context.db
      .update(agentGovernancePolicies)
      .set({
        lifecycleState: state,
        updatedBy,
        updatedAt: now,
      })
      .where(
        and(
          eq(agentGovernancePolicies.organizationId, organizationId),
          eq(agentGovernancePolicies.id, policyId),
        ),
      );

    return (await this.getPolicyById(organizationId, policyId))!;
  }

  // ---------------------------------------------------------------------------
  // 4. POLICY VERSIONS
  // ---------------------------------------------------------------------------

  async createPolicyVersion(
    policyId: string,
    organizationId: string,
    version: number,
    lifecycleState: PolicyLifecycleState,
    changeSummary: string,
    rules: Record<string, unknown>,
    createdBy: string,
  ): Promise<AgentGovernancePolicyVersionEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(agentGovernancePolicyVersions).values({
      id,
      policyId,
      organizationId,
      version,
      lifecycleState,
      changeSummary,
      rules,
      createdBy,
      createdAt: now,
    });

    return {
      id,
      policyId,
      organizationId,
      version,
      lifecycleState,
      changeSummary,
      rules,
      createdBy,
      createdAt: now,
    };
  }

  async listPolicyVersions(
    organizationId: string,
    policyId: string,
  ): Promise<AgentGovernancePolicyVersionEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentGovernancePolicyVersions)
      .where(
        and(
          eq(agentGovernancePolicyVersions.organizationId, organizationId),
          eq(agentGovernancePolicyVersions.policyId, policyId),
        ),
      )
      .orderBy(desc(agentGovernancePolicyVersions.version));

    return rows as unknown as AgentGovernancePolicyVersionEntity[];
  }

  // ---------------------------------------------------------------------------
  // 5. GOVERNANCE AUDIT LOGS
  // ---------------------------------------------------------------------------

  async createAuditLog(input: {
    organizationId: string;
    workspaceId?: string | null;
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    metadata?: Record<string, unknown>;
  }): Promise<AgentGovernanceAuditLogEntity> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(agentGovernanceAuditLogs).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeState: input.beforeState || null,
      afterState: input.afterState || null,
      metadata: input.metadata || {},
      createdAt: now,
    });

    return {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeState: input.beforeState || null,
      afterState: input.afterState || null,
      metadata: input.metadata || {},
      createdAt: now,
    };
  }

  async listAuditLogs(
    organizationId: string,
    filters?: { targetType?: string; targetId?: string; limit?: number },
  ): Promise<AgentGovernanceAuditLogEntity[]> {
    const conditions = [eq(agentGovernanceAuditLogs.organizationId, organizationId)];

    if (filters?.targetType) {
      conditions.push(eq(agentGovernanceAuditLogs.targetType, filters.targetType));
    }
    if (filters?.targetId) {
      conditions.push(eq(agentGovernanceAuditLogs.targetId, filters.targetId));
    }

    const rows = await this.context.db
      .select()
      .from(agentGovernanceAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(agentGovernanceAuditLogs.createdAt))
      .limit(filters?.limit || 50);

    return rows as unknown as AgentGovernanceAuditLogEntity[];
  }

  // ---------------------------------------------------------------------------
  // 6. OVERVIEW & AGGREGATED STATS
  // ---------------------------------------------------------------------------

  async getOverviewStats(organizationId: string): Promise<GovernanceOverviewStats> {
    const profiles = await this.listProfiles(organizationId);
    const policies = await this.listPolicies(organizationId);
    const ownerships = await this.listOwnershipAssignments(organizationId);
    const recentAuditLogs = await this.listAuditLogs(organizationId, { limit: 10 });

    const totalGovernedAgents = profiles.length;

    const riskDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    const complianceStatusCounts = {
      compliant: 0,
      needs_review: 0,
      non_compliant: 0,
      exempt: 0,
    };
    const classificationCounts = {
      public: 0,
      internal: 0,
      confidential: 0,
      restricted: 0,
    };

    let overdueReviewsCount = 0;
    const nowTime = Date.now();

    for (const p of profiles) {
      if (p.riskTier in riskDistribution) {
        riskDistribution[p.riskTier]++;
      }
      if (p.complianceStatus in complianceStatusCounts) {
        complianceStatusCounts[p.complianceStatus]++;
      }
      if (p.securityClassification in classificationCounts) {
        classificationCounts[p.securityClassification]++;
      }
      if (p.nextReviewDueAt && new Date(p.nextReviewDueAt).getTime() < nowTime) {
        overdueReviewsCount++;
      }
    }

    const ownedAgentIds = new Set(ownerships.map((o) => o.agentId));
    const unassignedOwnershipCount = profiles.filter((p) => !ownedAgentIds.has(p.agentId)).length;

    let activePoliciesCount = 0;
    const policiesByType: Record<string, number> = {};
    const policiesByState: Record<string, number> = {};

    for (const pol of policies) {
      if (pol.lifecycleState === "active") activePoliciesCount++;
      policiesByType[pol.policyType] = (policiesByType[pol.policyType] || 0) + 1;
      policiesByState[pol.lifecycleState] = (policiesByState[pol.lifecycleState] || 0) + 1;
    }

    return {
      totalGovernedAgents,
      riskDistribution,
      complianceStatusCounts,
      classificationCounts,
      unassignedOwnershipCount,
      activePoliciesCount,
      policiesByType,
      policiesByState,
      overdueReviewsCount,
      recentAuditLogs,
    };
  }
}
