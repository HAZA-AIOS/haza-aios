import { describe, expect, it, beforeEach } from "vitest";
import { PolicyEvaluationEngine } from "../src/modules/agents/services/policy-evaluation-engine.service.js";
import { PolicySimulationService } from "../src/modules/agents/services/policy-simulation.service.js";
import { PermissionResolutionService } from "../src/modules/agents/services/permission-resolution.service.js";
import { AgentToolGatewayService } from "../src/modules/agents/tools/agent-tool-gateway.service.js";
import type {
  AgentGovernanceProfileEntity,
  AgentOwnershipAssignmentEntity,
  AgentGovernancePolicyEntity,
  AgentGovernancePolicyVersionEntity,
  AgentGovernanceAuditLogEntity,
} from "../src/modules/agents/governance.types.js";
import type { PolicyEvaluationContext } from "../src/modules/agents/governance-policy-engine.types.js";

describe("Epic 22B: Enterprise Policy & Permission Engine", () => {
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
  let policyEngine: PolicyEvaluationEngine;
  let simulationService: PolicySimulationService;
  let permissionService: PermissionResolutionService;

  beforeEach(() => {
    profileStore = new Map();
    ownershipStore = new Map();
    policyStore = new Map();
    versionStore = [];
    auditLogStore = [];

    mockRepo = {
      getProfileByAgentId: async (orgId: string, agentId: string) => {
        return profileStore.get(`${orgId}:${agentId}`) || null;
      },
      listProfiles: async (orgId: string) => {
        return Array.from(profileStore.values()).filter((p) => p.organizationId === orgId);
      },
      getOwnershipByAgentId: async (orgId: string, agentId: string) => {
        return ownershipStore.get(`${orgId}:${agentId}`) || null;
      },
      listOwnershipAssignments: async (orgId: string) => {
        return Array.from(ownershipStore.values()).filter((o) => o.organizationId === orgId);
      },
      getPolicyById: async (orgId: string, policyId: string) => {
        const p = policyStore.get(policyId);
        return p && p.organizationId === orgId ? p : null;
      },
      getPolicyByKey: async (orgId: string, policyKey: string) => {
        return (
          Array.from(policyStore.values()).find(
            (p) => p.organizationId === orgId && p.policyKey === policyKey,
          ) || null
        );
      },
      listPolicies: async (orgId: string) => {
        return Array.from(policyStore.values()).filter((p) => p.organizationId === orgId);
      },
      createPolicy: async (input: any) => {
        const id = `pol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const entity: AgentGovernancePolicyEntity = {
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
          lifecycleState: input.lifecycleState || "active",
          currentVersion: 1,
          description: input.description || null,
          rules: input.rules || {},
          metadata: input.metadata || {},
          createdBy: input.createdBy || USER_ID,
          updatedBy: input.createdBy || USER_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        policyStore.set(id, entity);
        versionStore.push({
          id: `pv-${id}-1`,
          policyId: id,
          organizationId: input.organizationId,
          version: 1,
          lifecycleState: entity.lifecycleState,
          changeSummary: "Initial version",
          rules: entity.rules,
          createdBy: input.createdBy || USER_ID,
          createdAt: new Date(),
        });
        return entity;
      },
      updatePolicy: async (orgId: string, policyId: string, input: any) => {
        const existing = policyStore.get(policyId);
        if (!existing || existing.organizationId !== orgId) throw new Error("Not found");
        const nextVer = existing.currentVersion + 1;
        const updated: AgentGovernancePolicyEntity = {
          ...existing,
          rules: input.rules || existing.rules,
          currentVersion: nextVer,
          updatedBy: input.updatedBy,
          updatedAt: new Date(),
        };
        policyStore.set(policyId, updated);
        versionStore.push({
          id: `pv-${policyId}-${nextVer}`,
          policyId,
          organizationId: orgId,
          version: nextVer,
          lifecycleState: updated.lifecycleState,
          changeSummary: input.changeSummary || `Version ${nextVer}`,
          rules: updated.rules,
          createdBy: input.updatedBy,
          createdAt: new Date(),
        });
        return updated;
      },
      updateLifecycleState: async (orgId: string, policyId: string, state: any, userId: string) => {
        const existing = policyStore.get(policyId);
        if (!existing || existing.organizationId !== orgId) throw new Error("Not found");
        existing.lifecycleState = state;
        existing.updatedBy = userId;
        return existing;
      },
      listPolicyVersions: async (orgId: string, policyId: string) => {
        return versionStore.filter((v) => v.organizationId === orgId && v.policyId === policyId);
      },
      createAuditLog: async (input: any) => {
        const log: AgentGovernanceAuditLogEntity = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      listAuditLogs: async (orgId: string, filters?: any) => {
        return auditLogStore.filter((l) => l.organizationId === orgId);
      },
    };

    policyEngine = new PolicyEvaluationEngine(mockRepo);
    simulationService = new PolicySimulationService(mockRepo);
    permissionService = new PermissionResolutionService(mockRepo);
  });

  // =========================================================================
  // 1. POLICY PRECEDENCE & DECISION RESOLUTION
  // =========================================================================

  describe("Step 2 & Step 3: Policy Precedence Hierarchy", () => {
    it("Level 1: Strictly enforces mandatory platform restrictions above all policies", async () => {
      // Even if there is an explicit allow policy for a tool
      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Allow Shell Policy",
        policyKey: "allow-shell",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "log",
        rules: { allowedTools: ["raw_socket", "system_exec"] },
      });

      // Attempting to invoke blacklisted platform tool 'raw_socket'
      const result = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "raw_socket",
        action: "tool_invocation",
      });

      expect(result.decision).toBe("DENY");
      expect(result.effectiveDecision).toBe("DENY");
      expect(result.mandatoryRestrictionViolated).toBe(true);
      expect(result.reasonCode).toBe("MANDATORY_TOOL_FORBIDDEN");
    });

    it("Level 1: Rejects cross-tenant access attempts immediately", async () => {
      const perm = await permissionService.resolvePermissions(
        {
          organizationId: ORG_A,
          actorId: USER_ID,
        },
        { agentOrgId: ORG_B },
      );

      expect(perm.authorized).toBe(false);
      expect(perm.tenantValid).toBe(false);
      expect(perm.mandatoryRestrictionViolated).toBe(true);
      expect(perm.reasonCode).toBe("TENANT_MISMATCH");
    });

    it("Level 2: Explicit applicable DENY takes precedence over ALLOW", async () => {
      // Policy 1: Explicit ALLOW for tool
      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Allow Tools",
        policyKey: "allow-tools",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "log",
        rules: { allowedTools: ["education.lesson_plan.create"] },
      });

      // Policy 2: Explicit DENY for tool
      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Block Sensitive Tools",
        policyKey: "block-tools",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "block",
        rules: { disallowedTools: ["education.lesson_plan.create"] },
      });

      const result = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "education.lesson_plan.create",
        action: "tool_invocation",
      });

      expect(result.decision).toBe("DENY");
      expect(result.reasonCode).toBe("POLICY_EXPLICIT_DENY");
      expect(result.matchedPolicies).toContain("block-tools");
    });

    it("Level 3: REQUIRE_APPROVAL takes precedence over general ALLOW", async () => {
      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Approval for Curriculum Tool",
        policyKey: "require-approval-curriculum",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "require_approval",
        rules: {
          approvalRequiredTools: ["education.curriculum.generate"],
          requiredRoles: ["academic_director"],
        },
      });

      const result = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "education.curriculum.generate",
        action: "tool_invocation",
      });

      expect(result.decision).toBe("REQUIRE_APPROVAL");
      expect(result.reasonCode).toBe("POLICY_REQUIRE_APPROVAL");
      expect(result.requiredApprovalRoles).toContain("academic_director");
    });

    it("Level 4: Explicit ALLOW permits authorized tool invocation", async () => {
      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Allow Structure Tools",
        policyKey: "allow-structure",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "log",
        rules: { allowedTools: ["education.structure.read"] },
      });

      const result = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "education.structure.read",
        action: "tool_invocation",
      });

      expect(result.decision).toBe("ALLOW");
      expect(result.reasonCode).toBe("POLICY_EXPLICIT_ALLOW");
    });

    it("Level 5: Default-Deny blocks governed actions on restricted data without authorization", async () => {
      const result = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "custom_export",
        action: "tool_invocation",
        resourceClassification: "restricted",
      });

      expect(result.decision).toBe("DENY");
      expect(result.reasonCode).toBe("DEFAULT_DENY_UNAUTHORIZED");
    });

    it("Default-Allow permits standard benign unclassified operations", async () => {
      const result = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "standard_calc",
        action: "tool_invocation",
        resourceClassification: "public",
        riskTier: "low",
      });

      expect(result.decision).toBe("ALLOW");
      expect(result.reasonCode).toBe("DEFAULT_ALLOW");
    });
  });

  // =========================================================================
  // 2. POLICY LIFECYCLE & EFFECTIVE VERSION SELECTION
  // =========================================================================

  describe("Policy Lifecycle & Version Selection", () => {
    it("strictly ignores policies in 'draft', 'deprecated', or 'archived' states at runtime", async () => {
      // Draft policy with block rule
      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Draft Block Policy",
        policyKey: "draft-block",
        policyType: "tool_restriction",
        lifecycleState: "draft",
        enforcementAction: "block",
        rules: { disallowedTools: ["education.lesson_plan.create"] },
      });

      const result = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "education.lesson_plan.create",
        action: "tool_invocation",
      });

      // Draft policy must NOT trigger a deny
      expect(result.decision).not.toBe("DENY");
      expect(result.matchedPolicies).not.toContain("draft-block");
    });
  });

  // =========================================================================
  // 3. SAFE ROLLOUT: MONITOR VS ENFORCE VS DISABLED
  // =========================================================================

  describe("Step 5: Safe Rollout & Enforcement Modes", () => {
    it("in MONITOR mode (default): evaluates and audits DENY without blocking execution", async () => {
      // Default mode is MONITOR
      expect(await policyEngine.getEnforcementMode(ORG_A)).toBe("MONITOR");

      // Active DENY policy
      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Block Sensitive Operations",
        policyKey: "sec-block-op",
        policyType: "behavioral",
        lifecycleState: "active",
        enforcementAction: "block",
        rules: { disallowedActions: ["export_all_grades"] },
      });

      const result = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        action: "export_all_grades",
      });

      expect(result.decision).toBe("DENY"); // Analytical decision is DENY
      expect(result.effectiveDecision).toBe("ALLOW"); // In MONITOR mode, execution proceeds
      expect(result.enforcementMode).toBe("MONITOR");
    });

    it("in ENFORCE mode: actively applies DENY and blocks execution", async () => {
      // Switch mode to ENFORCE
      await policyEngine.setEnforcementMode(ORG_A, "ENFORCE", USER_ID);
      expect(await policyEngine.getEnforcementMode(ORG_A)).toBe("ENFORCE");

      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Strict Tool Blocking",
        policyKey: "strict-tool-block",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "block",
        rules: { disallowedTools: ["dangerous_tool"] },
      });

      const result = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "dangerous_tool",
        action: "tool_invocation",
      });

      expect(result.decision).toBe("DENY");
      expect(result.effectiveDecision).toBe("DENY"); // In ENFORCE mode, execution is blocked
      expect(result.enforcementMode).toBe("ENFORCE");
    });

    it("in DISABLED mode: policy checks are bypassed, but mandatory security restrictions persist", async () => {
      await policyEngine.setEnforcementMode(ORG_A, "DISABLED", USER_ID);

      // Normal policy is bypassed
      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Regular Policy",
        policyKey: "reg-policy",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "block",
        rules: { disallowedTools: ["some_tool"] },
      });

      const normal = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "some_tool",
      });
      expect(normal.effectiveDecision).toBe("ALLOW");

      // Mandatory platform security restriction is STILL DENIED even in DISABLED mode!
      const mandatory = await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "root_shell",
      });
      expect(mandatory.decision).toBe("DENY");
      expect(mandatory.effectiveDecision).toBe("DENY");
    });
  });

  // =========================================================================
  // 4. POLICY SIMULATION & VERSION COMPARISON
  // =========================================================================

  describe("Step 6: Read-Only Policy Simulation", () => {
    it("simulates hypothetical decisions with explainable precedence without executing actions", async () => {
      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Simulation Test Policy",
        policyKey: "sim-test-policy",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "require_approval",
        rules: {
          approvalRequiredTools: ["academic.publish"],
          requiredRoles: ["principal"],
        },
      });

      const sim = await simulationService.simulatePolicyDecision({
        organizationId: ORG_A,
        actorId: USER_ID,
        toolKey: "academic.publish",
        action: "tool_invocation",
      });

      expect(sim.simulated).toBe(true);
      expect(sim.decision).toBe("REQUIRE_APPROVAL");
      expect(sim.precedenceLevel).toBe(3);
      expect(sim.wouldRequireHumanApproval).toBe(true);
      expect(sim.requiredApprovalRoles).toContain("principal");
      expect(sim.matchedPolicies).toHaveLength(1);
      expect(sim.matchedPolicies[0].policyKey).toBe("sim-test-policy");
    });

    it("compares two policy versions and identifies added, removed, and modified rules", async () => {
      const p = await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Versioned Policy",
        policyKey: "versioned-policy",
        policyType: "tool_restriction",
        rules: { allowedTools: ["toolA"], maxRetries: 3 },
      });

      await mockRepo.updatePolicy(ORG_A, p.id, {
        updatedBy: USER_ID,
        rules: { allowedTools: ["toolA", "toolB"], timeoutMs: 5000 },
        changeSummary: "Added toolB and timeoutMs, removed maxRetries",
      });

      const diff = await simulationService.comparePolicyVersions(ORG_A, p.id, 1, 2);

      expect(diff.policyId).toBe(p.id);
      expect(diff.diff.addedRules).toContain("timeoutMs");
      expect(diff.diff.removedRules).toContain("maxRetries");
      expect(diff.diff.modifiedRules).toHaveLength(1);
      expect(diff.diff.modifiedRules[0].key).toBe("allowedTools");
    });
  });

  // =========================================================================
  // 5. RUNTIME ENFORCEMENT INTEGRATION (TOOL GATEWAY)
  // =========================================================================

  describe("Step 4: Authoritative Server-Side Enforcement (Tool Gateway)", () => {
    it("blocks tool invocation at the gateway boundary when policy engine yields DENY in ENFORCE mode", async () => {
      await policyEngine.setEnforcementMode(ORG_A, "ENFORCE", USER_ID);

      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Disallowed Tool Policy",
        policyKey: "disallow-lesson-plan",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "block",
        rules: { disallowedTools: ["education.lesson_plan.create"] },
      });

      const gateway = new AgentToolGatewayService({ db: null } as any);
      gateway.setPolicyEngine(policyEngine);

      const result = await gateway.executeTool({
        runId: "run-001",
        toolKey: "education.lesson_plan.create",
        input: {},
      }, {
        organizationId: ORG_A,
        workspaceId: WORKSPACE_ID,
        agentId: AGENT_1,
        userId: USER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe("POLICY_VIOLATION");
      expect(result.error?.message).toContain("Tool execution blocked by governance policy");
    });

    it("requires approval at the gateway boundary when policy engine yields REQUIRE_APPROVAL", async () => {
      await policyEngine.setEnforcementMode(ORG_A, "ENFORCE", USER_ID);

      await mockRepo.createPolicy({
        organizationId: ORG_A,
        name: "Approval Required Tool Policy",
        policyKey: "approval-lesson-plan",
        policyType: "tool_restriction",
        lifecycleState: "active",
        enforcementAction: "require_approval",
        rules: { approvalRequiredTools: ["education.lesson_plan.create"] },
      });

      const gateway = new AgentToolGatewayService({ db: null } as any);
      gateway.setPolicyEngine(policyEngine);

      const result = await gateway.executeTool({
        runId: "run-002",
        toolKey: "education.lesson_plan.create",
        input: {},
      }, {
        organizationId: ORG_A,
        workspaceId: WORKSPACE_ID,
        agentId: AGENT_1,
        userId: USER_ID,
      });

      expect(result.success).toBe(false);
      expect(result.error?.category).toBe("APPROVAL_REQUIRED");
      expect(result.error?.message).toContain("requires human approval");
    });
  });

  // =========================================================================
  // 6. FAIL-CLOSED AND SECRET REDACTION
  // =========================================================================

  describe("Fail-Closed Security & Secret Redaction", () => {
    it("fails closed with DENY when unexpected internal exceptions occur", async () => {
      // Mock repository throwing database connection failure
      const brokenRepo = {
        listPolicies: async () => {
          throw new Error("Fatal: Database connection lost");
        },
      } as any;

      const brokenEngine = new PolicyEvaluationEngine(brokenRepo);
      const result = await brokenEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        action: "agent_execution",
      });

      expect(result.decision).toBe("DENY");
      expect(result.effectiveDecision).toBe("DENY");
      expect(result.reasonCode).toBe("POLICY_EVALUATION_FAILED_CLOSED");
    });

    it("redacts credentials and Bearer tokens in audit logs", async () => {
      await policyEngine.evaluate({
        organizationId: ORG_A,
        actorId: USER_ID,
        action: "login_test",
        parameters: {
          apiKey: "sk-abcdef1234567890abcdef",
          auth: "Bearer secret-token-12345",
        },
      });

      const logs = await mockRepo.listAuditLogs(ORG_A);
      expect(logs.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(logs);
      expect(serialized).not.toContain("sk-abcdef1234567890abcdef");
      expect(serialized).not.toContain("secret-token-12345");
    });
  });
});
