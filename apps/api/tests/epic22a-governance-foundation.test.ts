import { describe, expect, it, beforeEach } from "vitest";
import { AgentGovernanceService } from "../src/modules/agents/services/agent-governance.service.js";
import type {
  AgentGovernanceProfileEntity,
  AgentOwnershipAssignmentEntity,
  AgentGovernancePolicyEntity,
  AgentGovernancePolicyVersionEntity,
  AgentGovernanceAuditLogEntity,
  UpsertGovernanceProfileInput,
  AssignOwnershipInput,
  CreateGovernancePolicyInput,
  UpdateGovernancePolicyInput,
  RecordReviewInput,
  CreateAuditLogInput,
  PolicyLifecycleState,
} from "../src/modules/agents/governance.types.js";

describe("Epic 22A: Enterprise Agent Governance Foundation", () => {
  const ORG_A = "00000000-0000-4801-a000-000000000001";
  const ORG_B = "00000000-0000-4801-b000-000000000002";
  const WORKSPACE_ID = "00000000-0000-4801-w000-000000000001";
  const USER_ID = "00000000-0000-4801-u000-000000000001";
  const AGENT_1 = "agent-academic-advisor-001";
  const AGENT_2 = "agent-financial-analyst-002";

  // In-Memory Storage
  let profileStore: Map<string, AgentGovernanceProfileEntity>;
  let ownershipStore: Map<string, AgentOwnershipAssignmentEntity>;
  let policyStore: Map<string, AgentGovernancePolicyEntity>;
  let versionStore: AgentGovernancePolicyVersionEntity[];
  let auditLogStore: AgentGovernanceAuditLogEntity[];

  let mockRepo: any;
  let governanceService: AgentGovernanceService;

  beforeEach(() => {
    profileStore = new Map();
    ownershipStore = new Map();
    policyStore = new Map();
    versionStore = [];
    auditLogStore = [];

    mockRepo = {
      // 1. Profiles
      getProfileByAgentId: async (orgId: string, agentId: string) => {
        const key = `${orgId}:${agentId}`;
        return profileStore.get(key) || null;
      },

      listProfiles: async (
        orgId: string,
        filters?: { riskTier?: string; complianceStatus?: string },
      ) => {
        return Array.from(profileStore.values()).filter((p) => {
          if (p.organizationId !== orgId) return false;
          if (filters?.riskTier && p.riskTier !== filters.riskTier) return false;
          if (filters?.complianceStatus && p.complianceStatus !== filters.complianceStatus)
            return false;
          return true;
        });
      },

      upsertProfile: async (input: UpsertGovernanceProfileInput) => {
        const key = `${input.organizationId}:${input.agentId}`;
        const existing = profileStore.get(key);
        const now = new Date();
        const cadence = input.reviewCadenceDays ?? existing?.reviewCadenceDays ?? 90;
        const entity: AgentGovernanceProfileEntity = {
          id: existing ? existing.id : `prof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || existing?.workspaceId || null,
          agentId: input.agentId,
          securityClassification: input.securityClassification || existing?.securityClassification || "internal",
          riskTier: input.riskTier || existing?.riskTier || "medium",
          complianceFrameworks: input.complianceFrameworks || existing?.complianceFrameworks || [],
          maxAutonomyLevel: input.maxAutonomyLevel ?? existing?.maxAutonomyLevel ?? 2,
          requireApprovalForTools: input.requireApprovalForTools ?? existing?.requireApprovalForTools ?? true,
          approvalPolicy: input.approvalPolicy || existing?.approvalPolicy || { mode: "default" },
          reviewCadenceDays: cadence,
          lastReviewedAt: existing?.lastReviewedAt || null,
          nextReviewDueAt: existing?.nextReviewDueAt || new Date(now.getTime() + cadence * 86400000),
          complianceStatus: input.complianceStatus || existing?.complianceStatus || "pending_review",
          notes: input.notes !== undefined ? input.notes : existing?.notes || null,
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        };
        profileStore.set(key, entity);
        return entity;
      },

      recordReview: async (input: RecordReviewInput) => {
        const key = `${input.organizationId}:${input.agentId}`;
        const existing = profileStore.get(key);
        if (!existing) throw new Error("Profile not found");
        const now = new Date();
        const nextDue = input.nextReviewDueAt
          ? new Date(input.nextReviewDueAt)
          : new Date(now.getTime() + existing.reviewCadenceDays * 86400000);
        const updated: AgentGovernanceProfileEntity = {
          ...existing,
          complianceStatus: input.complianceStatus || "compliant",
          lastReviewedAt: now,
          nextReviewDueAt: nextDue,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          updatedAt: now,
        };
        profileStore.set(key, updated);
        return updated;
      },

      // 2. Ownership
      getOwnershipByAgentId: async (orgId: string, agentId: string) => {
        const key = `${orgId}:${agentId}`;
        return ownershipStore.get(key) || null;
      },

      listOwnershipAssignments: async (orgId: string) => {
        return Array.from(ownershipStore.values()).filter((o) => o.organizationId === orgId);
      },

      assignOwnership: async (input: AssignOwnershipInput) => {
        const key = `${input.organizationId}:${input.agentId}`;
        const existing = ownershipStore.get(key);
        const now = new Date();
        const entity: AgentOwnershipAssignmentEntity = {
          id: existing ? existing.id : `own-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || existing?.workspaceId || null,
          agentId: input.agentId,
          primaryOwnerId: input.primaryOwnerId,
          technicalOwnerId: input.technicalOwnerId !== undefined ? input.technicalOwnerId : existing?.technicalOwnerId || null,
          businessOwnerId: input.businessOwnerId !== undefined ? input.businessOwnerId : existing?.businessOwnerId || null,
          escalationContact: input.escalationContact,
          accountabilityStatus: input.accountabilityStatus || existing?.accountabilityStatus || "active",
          assignedAt: existing?.assignedAt || now,
          assignedBy: input.assignedBy,
          updatedAt: now,
        };
        ownershipStore.set(key, entity);
        return entity;
      },

      // 3. Policies
      getPolicyById: async (orgId: string, policyId: string) => {
        const p = policyStore.get(policyId);
        if (!p || p.organizationId !== orgId) return null;
        return p;
      },

      getPolicyByKey: async (orgId: string, policyKey: string) => {
        return (
          Array.from(policyStore.values()).find(
            (p) => p.organizationId === orgId && p.policyKey === policyKey,
          ) || null
        );
      },

      listPolicies: async (
        orgId: string,
        filters?: { policyType?: string; lifecycleState?: string; severity?: string; scopeType?: string },
      ) => {
        return Array.from(policyStore.values()).filter((p) => {
          if (p.organizationId !== orgId) return false;
          if (filters?.policyType && p.policyType !== filters.policyType) return false;
          if (filters?.lifecycleState && p.lifecycleState !== filters.lifecycleState) return false;
          if (filters?.severity && p.severity !== filters.severity) return false;
          if (filters?.scopeType && p.scopeType !== filters.scopeType) return false;
          return true;
        });
      },

      createPolicy: async (input: CreateGovernancePolicyInput) => {
        const now = new Date();
        const policyId = `pol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const entity: AgentGovernancePolicyEntity = {
          id: policyId,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || null,
          name: input.name,
          policyKey: input.policyKey,
          description: input.description || null,
          policyType: input.policyType,
          scopeType: input.scopeType || "organization",
          targetRefId: input.targetRefId || null,
          severity: input.severity || "medium",
          enforcementAction: input.enforcementAction || "warn",
          lifecycleState: input.lifecycleState || "draft",
          currentVersion: 1,
          rules: input.rules || {},
          metadata: input.metadata || {},
          createdBy: input.createdBy,
          updatedBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        };
        policyStore.set(policyId, entity);

        versionStore.push({
          id: `pv-${Date.now()}`,
          organizationId: input.organizationId,
          policyId,
          version: 1,
          lifecycleState: entity.lifecycleState,
          rulesSnapshot: entity.rules,
          changeSummary: "Initial version created",
          createdBy: input.createdBy,
          createdAt: now,
        });

        return entity;
      },

      updatePolicy: async (
        orgId: string,
        policyId: string,
        input: UpdateGovernancePolicyInput,
      ) => {
        const existing = policyStore.get(policyId);
        if (!existing || existing.organizationId !== orgId) throw new Error("Not found");
        const now = new Date();
        const newVersion = existing.currentVersion + 1;
        const updated: AgentGovernancePolicyEntity = {
          ...existing,
          name: input.name || existing.name,
          description: input.description !== undefined ? input.description : existing.description,
          policyType: input.policyType || existing.policyType,
          scopeType: input.scopeType || existing.scopeType,
          targetRefId: input.targetRefId !== undefined ? input.targetRefId : existing.targetRefId,
          severity: input.severity || existing.severity,
          enforcementAction: input.enforcementAction || existing.enforcementAction,
          currentVersion: newVersion,
          rules: input.rules || existing.rules,
          metadata: input.metadata || existing.metadata,
          updatedBy: input.updatedBy,
          updatedAt: now,
        };
        policyStore.set(policyId, updated);

        versionStore.push({
          id: `pv-${Date.now()}-${newVersion}`,
          organizationId: orgId,
          policyId,
          version: newVersion,
          lifecycleState: updated.lifecycleState,
          rulesSnapshot: updated.rules,
          changeSummary: input.changeSummary || `Version ${newVersion} update`,
          createdBy: input.updatedBy,
          createdAt: now,
        });

        return updated;
      },

      updateLifecycleState: async (
        orgId: string,
        policyId: string,
        targetState: PolicyLifecycleState,
        userId: string,
      ) => {
        const existing = policyStore.get(policyId);
        if (!existing || existing.organizationId !== orgId) throw new Error("Not found");
        const now = new Date();
        const updated: AgentGovernancePolicyEntity = {
          ...existing,
          lifecycleState: targetState,
          updatedBy: userId,
          updatedAt: now,
        };
        policyStore.set(policyId, updated);
        return updated;
      },

      listPolicyVersions: async (orgId: string, policyId: string) => {
        return versionStore.filter(
          (v) => v.organizationId === orgId && v.policyId === policyId,
        );
      },

      // 4. Audit Logs
      createAuditLog: async (input: CreateAuditLogInput) => {
        const log: AgentGovernanceAuditLogEntity = {
          id: `glog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || null,
          actorId: input.actorId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          beforeState: input.beforeState || null,
          afterState: input.afterState || null,
          metadata: input.metadata || {},
          createdAt: new Date(),
        };
        auditLogStore.push(log);
        return log;
      },

      listAuditLogs: async (
        orgId: string,
        filters?: { targetType?: string; targetId?: string; limit?: number },
      ) => {
        let logs = auditLogStore.filter((l) => l.organizationId === orgId);
        if (filters?.targetType) logs = logs.filter((l) => l.targetType === filters.targetType);
        if (filters?.targetId) logs = logs.filter((l) => l.targetId === filters.targetId);
        if (filters?.limit) logs = logs.slice(0, filters.limit);
        return logs;
      },

      // 5. Overview Stats
      getOverviewStats: async (orgId: string) => {
        const orgProfiles = Array.from(profileStore.values()).filter(
          (p) => p.organizationId === orgId,
        );
        const orgPolicies = Array.from(policyStore.values()).filter(
          (p) => p.organizationId === orgId,
        );
        const orgOwnership = Array.from(ownershipStore.values()).filter(
          (o) => o.organizationId === orgId,
        );

        const assignedAgentIds = new Set(
          orgOwnership.filter((o) => o.primaryOwnerId).map((o) => o.agentId),
        );
        const orphaned = orgProfiles.filter((p) => !assignedAgentIds.has(p.agentId)).length;

        const now = Date.now();
        const pendingReviews = orgProfiles.filter(
          (p) =>
            p.complianceStatus === "pending_review" ||
            (p.nextReviewDueAt && new Date(p.nextReviewDueAt).getTime() <= now),
        ).length;

        const riskTierDistribution: Record<string, number> = {
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        };
        for (const p of orgProfiles) {
          riskTierDistribution[p.riskTier] = (riskTierDistribution[p.riskTier] || 0) + 1;
        }

        const complianceDistribution: Record<string, number> = {
          compliant: 0,
          pending_review: 0,
          non_compliant: 0,
          exempt: 0,
        };
        for (const p of orgProfiles) {
          complianceDistribution[p.complianceStatus] =
            (complianceDistribution[p.complianceStatus] || 0) + 1;
        }

        return {
          totalProfiles: orgProfiles.length,
          totalPolicies: orgPolicies.length,
          activePolicies: orgPolicies.filter((p) => p.lifecycleState === "active").length,
          orphanedAgents: orphaned,
          pendingReviews,
          riskTierDistribution,
          complianceDistribution,
        };
      },
    };

    governanceService = new AgentGovernanceService(mockRepo);
  });

  // =========================================================================
  // 1. AGENT GOVERNANCE PROFILES & RISK CLASSIFICATION
  // =========================================================================

  describe("Agent Governance Profiles", () => {
    it("creates an agent governance profile with risk tier and compliance frameworks", async () => {
      const profile = await governanceService.upsertProfile({
        organizationId: ORG_A,
        workspaceId: WORKSPACE_ID,
        agentId: AGENT_1,
        userId: USER_ID,
        securityClassification: "confidential",
        riskTier: "high",
        complianceFrameworks: ["SOC2", "HIPAA"],
        maxAutonomyLevel: 2,
        requireApprovalForTools: true,
        reviewCadenceDays: 60,
      });

      expect(profile).toBeDefined();
      expect(profile.agentId).toBe(AGENT_1);
      expect(profile.securityClassification).toBe("confidential");
      expect(profile.riskTier).toBe("high");
      expect(profile.complianceFrameworks).toEqual(["SOC2", "HIPAA"]);
      expect(profile.maxAutonomyLevel).toBe(2);
      expect(profile.requireApprovalForTools).toBe(true);
      expect(profile.complianceStatus).toBe("pending_review");

      // Verify audit log emission
      const logs = await governanceService.listAuditLogs(ORG_A);
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe("profile_created");
      expect(logs[0].actorId).toBe(USER_ID);
    });

    it("rejects invalid security classification and invalid risk tier", async () => {
      await expect(
        governanceService.upsertProfile({
          organizationId: ORG_A,
          agentId: AGENT_1,
          userId: USER_ID,
          securityClassification: "top-secret-super-classified" as any,
        }),
      ).rejects.toThrow("Security classification must be one of");

      await expect(
        governanceService.upsertProfile({
          organizationId: ORG_A,
          agentId: AGENT_1,
          userId: USER_ID,
          riskTier: "extreme_danger" as any,
        }),
      ).rejects.toThrow("Risk tier must be one of");
    });

    it("records a compliance review and calculates the next review due date", async () => {
      await governanceService.upsertProfile({
        organizationId: ORG_A,
        agentId: AGENT_1,
        userId: USER_ID,
        reviewCadenceDays: 90,
      });

      const reviewed = await governanceService.recordAgentReview({
        organizationId: ORG_A,
        agentId: AGENT_1,
        reviewedBy: USER_ID,
        complianceStatus: "compliant",
        notes: "Passed annual SOC2 Type II automated controls check",
      });

      expect(reviewed.complianceStatus).toBe("compliant");
      expect(reviewed.lastReviewedAt).toBeDefined();
      expect(reviewed.nextReviewDueAt).toBeDefined();
      expect(reviewed.notes).toContain("SOC2 Type II");

      // Verify audit log
      const logs = await governanceService.listAuditLogs(ORG_A);
      const reviewLog = logs.find((l) => l.action === "compliance_review_completed");
      expect(reviewLog).toBeDefined();
      expect(reviewLog?.beforeState).toEqual(expect.objectContaining({ complianceStatus: "pending_review" }));
      expect(reviewLog?.afterState).toEqual(expect.objectContaining({ complianceStatus: "compliant" }));
    });
  });

  // =========================================================================
  // 2. AGENT OWNERSHIP & ACCOUNTABILITY
  // =========================================================================

  describe("Agent Ownership & Accountability", () => {
    it("assigns primary, technical, and business owners with escalation contacts", async () => {
      const assignment = await governanceService.assignOwnership({
        organizationId: ORG_A,
        workspaceId: WORKSPACE_ID,
        agentId: AGENT_1,
        assignedBy: USER_ID,
        primaryOwnerId: "user-alice",
        technicalOwnerId: "user-bob",
        businessOwnerId: "user-carol",
        escalationContact: "alice-oncall@haza-aios.com",
      });

      expect(assignment.agentId).toBe(AGENT_1);
      expect(assignment.primaryOwnerId).toBe("user-alice");
      expect(assignment.technicalOwnerId).toBe("user-bob");
      expect(assignment.businessOwnerId).toBe("user-carol");
      expect(assignment.escalationContact).toBe("alice-oncall@haza-aios.com");
      expect(assignment.accountabilityStatus).toBe("active");

      // Verify audit log
      const logs = await governanceService.listAuditLogs(ORG_A);
      const ownLog = logs.find((l) => l.action === "ownership_assigned");
      expect(ownLog).toBeDefined();
      expect(ownLog?.targetType).toBe("ownership");
    });

    it("rejects ownership assignment without primary owner or escalation contact", async () => {
      await expect(
        governanceService.assignOwnership({
          organizationId: ORG_A,
          agentId: AGENT_1,
          assignedBy: USER_ID,
          primaryOwnerId: "",
          escalationContact: "escalation@test.com",
        }),
      ).rejects.toThrow("Primary owner ID is required");

      await expect(
        governanceService.assignOwnership({
          organizationId: ORG_A,
          agentId: AGENT_1,
          assignedBy: USER_ID,
          primaryOwnerId: "user-alice",
          escalationContact: "   ",
        }),
      ).rejects.toThrow("Escalation contact is required");
    });
  });

  // =========================================================================
  // 3. GOVERNANCE POLICY REGISTRY & VERSIONING
  // =========================================================================

  describe("Governance Policy Registry & Lifecycle", () => {
    it("creates a policy with v1 version record", async () => {
      const policy = await governanceService.createPolicy({
        organizationId: ORG_A,
        workspaceId: WORKSPACE_ID,
        name: "PII Redaction Safeguard",
        policyKey: "sec-pii-redaction",
        description: "Enforces automatic masking of SSN, passwords, and credit card numbers",
        policyType: "security",
        scopeType: "organization",
        severity: "critical",
        enforcementAction: "block",
        rules: { redactEntities: ["SSN", "CREDIT_CARD", "SECRET_KEY"] },
        createdBy: USER_ID,
      });

      expect(policy.name).toBe("PII Redaction Safeguard");
      expect(policy.policyKey).toBe("sec-pii-redaction");
      expect(policy.currentVersion).toBe(1);
      expect(policy.lifecycleState).toBe("draft");

      // Verify versions
      const { versions } = await governanceService.getPolicy(ORG_A, policy.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe(1);
      expect(versions[0].changeSummary).toContain("Initial version");
    });

    it("prevents duplicate policy keys within the same organization", async () => {
      await governanceService.createPolicy({
        organizationId: ORG_A,
        name: "Policy 1",
        policyKey: "unique-key-01",
        policyType: "security",
        createdBy: USER_ID,
      });

      await expect(
        governanceService.createPolicy({
          organizationId: ORG_A,
          name: "Policy 1 Duplicate",
          policyKey: "unique-key-01",
          policyType: "compliance",
          createdBy: USER_ID,
        }),
      ).rejects.toThrow("already exists");
    });

    it("increments version number and records change summary upon policy updates", async () => {
      const policy = await governanceService.createPolicy({
        organizationId: ORG_A,
        name: "Rate Limit Policy",
        policyKey: "rate-limit-policy",
        policyType: "behavioral",
        createdBy: USER_ID,
      });

      const updated = await governanceService.updatePolicy(ORG_A, policy.id, {
        name: "Rate Limit Policy V2",
        updatedBy: USER_ID,
        changeSummary: "Lowered hourly burst limit from 100 to 50",
        rules: { burstLimit: 50 },
      });

      expect(updated.currentVersion).toBe(2);
      expect(updated.name).toBe("Rate Limit Policy V2");

      const { versions } = await governanceService.getPolicy(ORG_A, policy.id);
      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(1);
      expect(versions[1].version).toBe(2);
      expect(versions[1].changeSummary).toBe("Lowered hourly burst limit from 100 to 50");
    });

    it("strictly follows allowed lifecycle state transitions", async () => {
      const policy = await governanceService.createPolicy({
        organizationId: ORG_A,
        name: "Lifecycle Test Policy",
        policyKey: "lifecycle-test-policy",
        policyType: "security",
        createdBy: USER_ID,
      });

      expect(policy.lifecycleState).toBe("draft");

      // draft -> active should FAIL (must go through review first)
      await expect(
        governanceService.transitionPolicyLifecycle(ORG_A, policy.id, "active", USER_ID),
      ).rejects.toThrow("Cannot transition policy from 'draft' to 'active'");

      // draft -> review should SUCCEED
      const inReview = await governanceService.transitionPolicyLifecycle(
        ORG_A,
        policy.id,
        "review",
        USER_ID,
      );
      expect(inReview.lifecycleState).toBe("review");

      // review -> active should SUCCEED
      const active = await governanceService.transitionPolicyLifecycle(
        ORG_A,
        policy.id,
        "active",
        USER_ID,
      );
      expect(active.lifecycleState).toBe("active");

      // active -> deprecated should SUCCEED
      const deprecated = await governanceService.transitionPolicyLifecycle(
        ORG_A,
        policy.id,
        "deprecated",
        USER_ID,
      );
      expect(deprecated.lifecycleState).toBe("deprecated");

      // deprecated -> archived should SUCCEED
      const archived = await governanceService.transitionPolicyLifecycle(
        ORG_A,
        policy.id,
        "archived",
        USER_ID,
      );
      expect(archived.lifecycleState).toBe("archived");
    });
  });

  // =========================================================================
  // 4. OVERVIEW STATS & AUDIT LOGS
  // =========================================================================

  describe("Governance Overview Metrics & Audit Logs", () => {
    it("accurately computes overview metrics, orphaned agents, and risk distributions", async () => {
      // Create Profile 1 (High risk, unassigned owner -> orphaned)
      await governanceService.upsertProfile({
        organizationId: ORG_A,
        agentId: AGENT_1,
        userId: USER_ID,
        riskTier: "high",
        complianceStatus: "pending_review",
      });

      // Create Profile 2 (Low risk, assigned owner -> not orphaned)
      await governanceService.upsertProfile({
        organizationId: ORG_A,
        agentId: AGENT_2,
        userId: USER_ID,
        riskTier: "low",
        complianceStatus: "compliant",
      });
      await governanceService.assignOwnership({
        organizationId: ORG_A,
        agentId: AGENT_2,
        assignedBy: USER_ID,
        primaryOwnerId: "user-dev",
        escalationContact: "dev@company.com",
      });

      // Create 1 active policy and 1 draft policy
      const p1 = await governanceService.createPolicy({
        organizationId: ORG_A,
        name: "Policy 1",
        policyKey: "p1",
        policyType: "security",
        createdBy: USER_ID,
      });
      await governanceService.transitionPolicyLifecycle(ORG_A, p1.id, "review", USER_ID);
      await governanceService.transitionPolicyLifecycle(ORG_A, p1.id, "active", USER_ID);

      await governanceService.createPolicy({
        organizationId: ORG_A,
        name: "Policy 2",
        policyKey: "p2",
        policyType: "compliance",
        createdBy: USER_ID,
      });

      const overview = await governanceService.getGovernanceOverview(ORG_A);

      expect(overview.totalProfiles).toBe(2);
      expect(overview.totalPolicies).toBe(2);
      expect(overview.activePolicies).toBe(1);
      expect(overview.orphanedAgents).toBe(1); // AGENT_1 is orphaned
      expect(overview.riskTierDistribution.high).toBe(1);
      expect(overview.riskTierDistribution.low).toBe(1);
      expect(overview.complianceDistribution.pending_review).toBe(1);
      expect(overview.complianceDistribution.compliant).toBe(1);
    });

    it("filters audit logs by targetType and targetId", async () => {
      await governanceService.upsertProfile({
        organizationId: ORG_A,
        agentId: AGENT_1,
        userId: USER_ID,
      });
      await governanceService.createPolicy({
        organizationId: ORG_A,
        name: "Policy Test",
        policyKey: "pol-audit-test",
        policyType: "security",
        createdBy: USER_ID,
      });

      const profileLogs = await governanceService.listAuditLogs(ORG_A, {
        targetType: "agent_profile",
      });
      expect(profileLogs.length).toBeGreaterThan(0);
      expect(profileLogs.every((l) => l.targetType === "agent_profile")).toBe(true);

      const policyLogs = await governanceService.listAuditLogs(ORG_A, {
        targetType: "policy",
      });
      expect(policyLogs.length).toBeGreaterThan(0);
      expect(policyLogs.every((l) => l.targetType === "policy")).toBe(true);
    });
  });

  // =========================================================================
  // 5. MULTI-TENANT ISOLATION
  // =========================================================================

  describe("Multi-Tenant Isolation", () => {
    it("ensures strict cross-organization isolation for profiles, ownership, and policies", async () => {
      // Organization A assets
      await governanceService.upsertProfile({
        organizationId: ORG_A,
        agentId: AGENT_1,
        userId: USER_ID,
        securityClassification: "restricted",
      });
      const policyA = await governanceService.createPolicy({
        organizationId: ORG_A,
        name: "Org A Policy",
        policyKey: "org-a-key",
        policyType: "security",
        createdBy: USER_ID,
      });

      // Organization B query checks
      const profilesB = await governanceService.listProfiles(ORG_B);
      expect(profilesB).toHaveLength(0);

      const policiesB = await governanceService.listPolicies(ORG_B);
      expect(policiesB).toHaveLength(0);

      // Org B cannot access Org A's policy
      await expect(
        governanceService.getPolicy(ORG_B, policyA.id),
      ).rejects.toThrow("not found");

      // Org B can create a policy with the SAME policyKey without conflict
      const policyB = await governanceService.createPolicy({
        organizationId: ORG_B,
        name: "Org B Policy Same Key",
        policyKey: "org-a-key",
        policyType: "security",
        createdBy: USER_ID,
      });
      expect(policyB.id).not.toBe(policyA.id);
      expect(policyB.organizationId).toBe(ORG_B);
    });
  });

  // =========================================================================
  // 6. NON-INTERFERENCE WITH AGENT RUNTIME
  // =========================================================================

  describe("Non-Interference with Agent Runtime (Phase 22A Baseline)", () => {
    it("maintains passive governance foundation without blocking agent runs", async () => {
      // Phase 22A establishes the governance data model and policies.
      // Live policy enforcement is deferred to Phase 22B.
      // Here we verify policies exist in 'draft' or 'active' state without throwing runtime interrupts.
      const policy = await governanceService.createPolicy({
        organizationId: ORG_A,
        name: "Autonomous Action Cap",
        policyKey: "sec-auto-cap",
        policyType: "behavioral",
        enforcementAction: "block",
        createdBy: USER_ID,
      });

      expect(policy.enforcementAction).toBe("block");
      // Service creates and tracks policies passively
      expect(policy.id).toBeDefined();
    });
  });
});
