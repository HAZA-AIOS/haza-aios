/**
 * HAZA-AIOS — Epic 22B: Enterprise Policy & Permission Evaluation Engine
 * Evaluates governance policies deterministically with strict precedence:
 *   1. Mandatory platform security restrictions.
 *   2. Explicit applicable DENY policies.
 *   3. Applicable REQUIRE_APPROVAL policies.
 *   4. Applicable ALLOW policies.
 *   5. Default-deny for governed actions without authorization.
 */

import { randomUUID } from "node:crypto";
import type { AgentGovernanceRepository } from "../repositories/agent-governance.repository.js";
import type { AgentApprovalService } from "./agent-approval.service.js";
import { PermissionResolutionService } from "./permission-resolution.service.js";
import { redactSecrets } from "../utils/secret-redactor.js";
import type {
  PolicyEvaluationContext,
  PolicyDecisionResult,
  PolicyRuleMatch,
  GovernanceEnforcementMode,
  PolicyDecisionType,
} from "../governance-policy-engine.types.js";
import type { AgentGovernancePolicyEntity } from "../governance.types.js";

const MANDATORY_FORBIDDEN_TOOLS = [
  "raw_socket",
  "system_exec",
  "untrusted_eval",
  "root_shell",
  "arbitrary_code_runner",
  "bypass_sandbox",
];

const ENFORCEMENT_MODE_POLICY_KEY = "sys-enforcement-mode";

export class PolicyEvaluationEngine {
  private readonly permissionResolver: PermissionResolutionService;

  constructor(
    private readonly governanceRepo?: AgentGovernanceRepository,
    private approvalService?: AgentApprovalService,
  ) {
    this.permissionResolver = new PermissionResolutionService(governanceRepo);
  }

  setApprovalService(service: AgentApprovalService): void {
    this.approvalService = service;
  }

  /**
   * Retrieves the current governance enforcement mode for the organization.
   * Defaults to 'MONITOR' if not explicitly configured.
   */
  async getEnforcementMode(organizationId: string): Promise<GovernanceEnforcementMode> {
    if (!this.governanceRepo) return "MONITOR";
    try {
      const policy = await this.governanceRepo.getPolicyByKey(
        organizationId,
        ENFORCEMENT_MODE_POLICY_KEY,
      );
      if (!policy || policy.lifecycleState !== "active") {
        return "MONITOR";
      }
      const mode = (policy.rules as any)?.mode || (policy.rules as any)?.enforcementMode;
      if (mode === "DISABLED" || mode === "MONITOR" || mode === "ENFORCE") {
        return mode;
      }
      return "MONITOR";
    } catch {
      return "MONITOR";
    }
  }

  /**
   * Updates the organization's governance enforcement mode.
   * Requires appropriate administrative permissions and logs to the audit ledger.
   */
  async setEnforcementMode(
    organizationId: string,
    mode: GovernanceEnforcementMode,
    actorId: string,
  ): Promise<void> {
    if (!this.governanceRepo) return;
    const existing = await this.governanceRepo.getPolicyByKey(
      organizationId,
      ENFORCEMENT_MODE_POLICY_KEY,
    );

    if (existing) {
      await this.governanceRepo.updatePolicy(organizationId, existing.id, {
        updatedBy: actorId,
        rules: { mode },
        changeSummary: `Governance enforcement mode set to ${mode}`,
      });
      if (existing.lifecycleState !== "active") {
        await this.governanceRepo.updateLifecycleState(
          organizationId,
          existing.id,
          "active",
          actorId,
        );
      }
    } else {
      await this.governanceRepo.createPolicy({
        organizationId,
        name: "Governance Enforcement Mode Controller",
        policyKey: ENFORCEMENT_MODE_POLICY_KEY,
        policyType: "enforcement_control",
        scopeType: "organization",
        severity: "critical",
        enforcementAction: "block",
        lifecycleState: "active",
        rules: { mode },
        createdBy: actorId,
      });
    }

    await this.governanceRepo.createAuditLog({
      organizationId,
      actorId,
      action: "governance_mode_changed",
      targetType: "organization",
      targetId: organizationId,
      beforeState: existing ? (existing.rules as Record<string, unknown>) : null,
      afterState: { mode },
      metadata: { newMode: mode },
    });
  }

  /**
   * Authoritative policy evaluation entry point.
   * Evaluates context against platform security, active policies, profiles, and autonomy.
   */
  async evaluate(context: PolicyEvaluationContext): Promise<PolicyDecisionResult> {
    const correlationId = context.correlationId || `pol-cor-${randomUUID().slice(0, 8)}`;
    const timestamp = new Date().toISOString();

    try {
      return await this.evaluateInternal(context, correlationId, timestamp);
    } catch (err: any) {
      // Fail closed upon unexpected evaluation exceptions
      return {
        decision: "DENY",
        effectiveDecision: "DENY",
        enforcementMode: "ENFORCE",
        reasonCode: "POLICY_EVALUATION_FAILED_CLOSED",
        reasonDetails: `Policy evaluation encountered an unexpected error and failed closed: ${err?.message || "Unknown error"}`,
        matchedPolicies: [],
        matchedPolicyVersions: [],
        matches: [],
        mandatoryRestrictionViolated: true,
        correlationId,
        timestamp,
        simulated: !!context.isSimulated,
        context: {
          organizationId: context.organizationId,
          workspaceId: context.workspaceId || null,
          actorId: context.actorId,
          agentId: context.agentId || null,
          toolKey: context.toolKey || null,
          action: context.action || null,
          resourceClassification: context.resourceClassification || null,
          riskTier: context.riskTier || null,
        },
      };
    }
  }

  private async evaluateInternal(
    context: PolicyEvaluationContext,
    correlationId: string,
    timestamp: string,
  ): Promise<PolicyDecisionResult> {
    const enforcementMode = await this.getEnforcementMode(context.organizationId);

    // =========================================================================
    // LEVEL 1: MANDATORY PLATFORM SECURITY RESTRICTIONS
    // =========================================================================

    // 1.1 Tenant Context Check
    if (!context.organizationId || !context.actorId) {
      return this.buildResult({
        decision: "DENY",
        effectiveDecision: "DENY",
        enforcementMode,
        reasonCode: "MANDATORY_AUTH_REQUIRED",
        reasonDetails: "Organization ID and Actor ID are mandatory for all governed executions.",
        mandatoryRestrictionViolated: true,
        correlationId,
        timestamp,
        context,
      });
    }

    // 1.2 Blacklisted Dangerous Tool Check
    if (context.toolKey && MANDATORY_FORBIDDEN_TOOLS.includes(context.toolKey.toLowerCase())) {
      return this.buildResult({
        decision: "DENY",
        effectiveDecision: "DENY",
        enforcementMode,
        reasonCode: "MANDATORY_TOOL_FORBIDDEN",
        reasonDetails: `Execution of platform-forbidden tool '${context.toolKey}' is strictly prohibited.`,
        mandatoryRestrictionViolated: true,
        correlationId,
        timestamp,
        context,
      });
    }

    // 1.3 Permission Resolution & Tenancy Check
    const permResult = await this.permissionResolver.resolvePermissions(context);
    if (permResult.mandatoryRestrictionViolated) {
      return this.buildResult({
        decision: "DENY",
        effectiveDecision: "DENY",
        enforcementMode,
        reasonCode: permResult.reasonCode,
        reasonDetails: permResult.reasonDetails,
        mandatoryRestrictionViolated: true,
        correlationId,
        timestamp,
        context,
      });
    }

    // =========================================================================
    // FETCH ACTIVE POLICIES & PROFILE
    // =========================================================================
    let activePolicies: AgentGovernancePolicyEntity[] = [];
    if (this.governanceRepo) {
      const allPolicies = await this.governanceRepo.listPolicies(context.organizationId);
      // STRICT FILTER: Only policies in 'active' lifecycle state apply at runtime!
      activePolicies = allPolicies.filter(
        (p) => p.lifecycleState === "active" && p.policyKey !== ENFORCEMENT_MODE_POLICY_KEY,
      );
    }

    const matchedDenies: PolicyRuleMatch[] = [];
    const matchedApprovals: PolicyRuleMatch[] = [];
    const matchedAllows: PolicyRuleMatch[] = [];
    const requiredApprovalRoles: Set<string> = new Set();

    // Check agent profile constraints (e.g. autonomy caps, approval flags)
    if (context.agentId && this.governanceRepo) {
      const profile = await this.governanceRepo.getProfileByAgentId(
        context.organizationId,
        context.agentId,
      );
      if (profile) {
        // Autonomy cap violation
        if (!permResult.autonomyAuthorized) {
          matchedDenies.push({
            policyId: profile.id,
            policyKey: "gov-profile-autonomy-cap",
            version: 1,
            severity: "high",
            enforcementAction: "block",
            ruleKey: "maxAutonomyLevel",
            reason: permResult.reasonDetails,
          });
        }

        // Profile requires tool approval
        if ((profile.requireApprovalForTools || profile.approvalPolicy === "strict" || profile.approvalPolicy === "four_eyes") && context.action === "tool_invocation") {
          matchedApprovals.push({
            policyId: profile.id,
            policyKey: "gov-profile-tool-approval",
            version: 1,
            severity: "medium",
            enforcementAction: "require_approval",
            ruleKey: "requireApprovalForTools",
            reason: `Agent governance profile mandates human approval for tool invocations.`,
          });
        }
      }
    }

    // Evaluate all active policies
    for (const policy of activePolicies) {
      // Check scope
      if (policy.scopeType === "workspace" && policy.workspaceId && context.workspaceId) {
        if (policy.workspaceId !== context.workspaceId) continue;
      }
      if (
        policy.scopeType === "agent_specific" &&
        policy.targetAgentIds &&
        policy.targetAgentIds.length > 0
      ) {
        if (!context.agentId || !policy.targetAgentIds.includes(context.agentId)) continue;
      }

      const rules = (policy.rules || {}) as Record<string, any>;

      // A. Disallowed Tools Check
      if (context.toolKey) {
        const disallowed = rules.disallowedTools || rules.blacklistedTools || rules.blockedTools || [];
        if (Array.isArray(disallowed) && disallowed.includes(context.toolKey)) {
          matchedDenies.push({
            policyId: policy.id,
            policyKey: policy.policyKey,
            version: policy.currentVersion,
            severity: policy.severity,
            enforcementAction: "block",
            ruleKey: "disallowedTools",
            reason: `Tool '${context.toolKey}' is explicitly disallowed by policy '${policy.name}'.`,
          });
        }

        const approvalTools = rules.approvalRequiredTools || rules.requireApprovalTools || (policy.enforcementAction === "require_approval" ? (rules.tools || rules.blockedTools || rules.targetTools) : []) || [];
        if (Array.isArray(approvalTools) && approvalTools.includes(context.toolKey)) {
          matchedApprovals.push({
            policyId: policy.id,
            policyKey: policy.policyKey,
            version: policy.currentVersion,
            severity: policy.severity,
            enforcementAction: "require_approval",
            ruleKey: "approvalRequiredTools",
            reason: `Tool '${context.toolKey}' requires human approval per policy '${policy.name}'.`,
          });
          if (Array.isArray(rules.requiredRoles)) {
            rules.requiredRoles.forEach((r: string) => requiredApprovalRoles.add(r));
          }
        }

        const allowedTools = rules.allowedTools || rules.whitelistedTools || [];
        if (Array.isArray(allowedTools) && allowedTools.includes(context.toolKey)) {
          matchedAllows.push({
            policyId: policy.id,
            policyKey: policy.policyKey,
            version: policy.currentVersion,
            severity: policy.severity,
            enforcementAction: policy.enforcementAction,
            ruleKey: "allowedTools",
            reason: `Tool '${context.toolKey}' is explicitly permitted by policy '${policy.name}'.`,
          });
        }
      }

      // B. Disallowed Actions Check
      if (context.action) {
        const disallowedActions = rules.disallowedActions || [];
        if (Array.isArray(disallowedActions) && disallowedActions.includes(context.action)) {
          if (policy.enforcementAction === "require_approval") {
            matchedApprovals.push({
              policyId: policy.id,
              policyKey: policy.policyKey,
              version: policy.currentVersion,
              severity: policy.severity,
              enforcementAction: "require_approval",
              ruleKey: "approvalRequiredActions",
              reason: `Action '${context.action}' requires human approval per policy '${policy.name}'.`,
            });
          } else {
            matchedDenies.push({
              policyId: policy.id,
              policyKey: policy.policyKey,
              version: policy.currentVersion,
              severity: policy.severity,
              enforcementAction: "block",
              ruleKey: "disallowedActions",
              reason: `Action '${context.action}' is prohibited by policy '${policy.name}'.`,
            });
          }
        }

        const approvalActions = rules.approvalRequiredActions || rules.requireApprovalActions || [];
        if (Array.isArray(approvalActions) && approvalActions.includes(context.action)) {
          matchedApprovals.push({
            policyId: policy.id,
            policyKey: policy.policyKey,
            version: policy.currentVersion,
            severity: policy.severity,
            enforcementAction: "require_approval",
            ruleKey: "approvalRequiredActions",
            reason: `Action '${context.action}' requires human approval per policy '${policy.name}'.`,
          });
        }
      }

      // C. Resource Classification Restrictions
      if (context.resourceClassification) {
        const restricted = rules.restrictedClassifications || [];
        if (
          Array.isArray(restricted) &&
          restricted.includes(context.resourceClassification)
        ) {
          if (policy.enforcementAction === "block") {
            matchedDenies.push({
              policyId: policy.id,
              policyKey: policy.policyKey,
              version: policy.currentVersion,
              severity: policy.severity,
              enforcementAction: "block",
              ruleKey: "restrictedClassifications",
              reason: `Access to classification '${context.resourceClassification}' is blocked by policy '${policy.name}'.`,
            });
          } else if (policy.enforcementAction === "require_approval") {
            matchedApprovals.push({
              policyId: policy.id,
              policyKey: policy.policyKey,
              version: policy.currentVersion,
              severity: policy.severity,
              enforcementAction: "require_approval",
              ruleKey: "restrictedClassifications",
              reason: `Access to classification '${context.resourceClassification}' requires human approval per policy '${policy.name}'.`,
            });
          }
        }
      }

      // D. Direct Policy Enforcement Action matching
      if (policy.enforcementAction === "block" && matchedDenies.length === 0) {
        if (rules.enforceAllMatches) {
          matchedDenies.push({
            policyId: policy.id,
            policyKey: policy.policyKey,
            version: policy.currentVersion,
            severity: policy.severity,
            enforcementAction: "block",
            ruleKey: "enforceAllMatches",
            reason: `Policy '${policy.name}' blocks this operation.`,
          });
        }
      }
    }

    // =========================================================================
    // LEVEL 2: EXPLICIT APPLICABLE DENY POLICIES
    // =========================================================================
    if (matchedDenies.length > 0) {
      const topDeny = matchedDenies[0];
      return this.buildResult({
        decision: "DENY",
        effectiveDecision: enforcementMode === "ENFORCE" ? "DENY" : "ALLOW",
        enforcementMode,
        reasonCode: "POLICY_EXPLICIT_DENY",
        reasonDetails: topDeny.reason,
        matches: matchedDenies,
        correlationId,
        timestamp,
        context,
      });
    }

    // =========================================================================
    // LEVEL 3: APPLICABLE REQUIRE_APPROVAL POLICIES
    // =========================================================================
    if (matchedApprovals.length > 0) {
      const topApproval = matchedApprovals[0];
      let approvalRequestId: string | undefined;

      if (enforcementMode === "ENFORCE" && !context.isSimulated && this.approvalService) {
        try {
          const appReq = await this.approvalService.createApprovalRequest({
            organizationId: context.organizationId,
            workspaceId: context.workspaceId,
            agentId: context.agentId || "unknown-agent",
            actionType: context.action || "tool_invocation",
            actionTarget: context.toolKey || context.action || "unknown_target",
            requestingActorId: context.actorId,
            payload: (context.parameters as Record<string, unknown>) ?? {},
            matchedPolicyId: topApproval.policyId,
            matchedPolicyVersion: topApproval.version,
            approvalReason: topApproval.reason,
            riskClassification: (topApproval.severity as any) || "medium",
          });
          approvalRequestId = appReq.id;
        } catch {
          // ignore creation error
        }
      }

      return this.buildResult({
        decision: "REQUIRE_APPROVAL",
        effectiveDecision: enforcementMode === "ENFORCE" ? "REQUIRE_APPROVAL" : "ALLOW",
        enforcementMode,
        reasonCode: "POLICY_REQUIRE_APPROVAL",
        reasonDetails: topApproval.reason,
        matches: matchedApprovals,
        requiredApprovalRoles: Array.from(requiredApprovalRoles),
        approvalRequestId,
        correlationId,
        timestamp,
        context,
      });
    }

    // =========================================================================
    // LEVEL 4: APPLICABLE ALLOW POLICIES
    // =========================================================================
    if (matchedAllows.length > 0) {
      return this.buildResult({
        decision: "ALLOW",
        effectiveDecision: "ALLOW",
        enforcementMode,
        reasonCode: "POLICY_EXPLICIT_ALLOW",
        reasonDetails: matchedAllows[0].reason,
        matches: matchedAllows,
        correlationId,
        timestamp,
        context,
      });
    }

    // =========================================================================
    // LEVEL 5: DEFAULT-DENY FOR GOVERNED ACTIONS WITHOUT AUTHORIZATION
    // =========================================================================
    const isGovernedSensitive =
      context.resourceClassification === "restricted" ||
      context.riskTier === "critical" ||
      permResult.orphanedAgent;

    if (isGovernedSensitive) {
      const reason = permResult.orphanedAgent
        ? `Orphaned agent '${context.agentId}' cannot execute operations without an active primary owner.`
        : `Governed action requires explicit authorization policy for '${context.resourceClassification || context.riskTier}' operation.`;

      return this.buildResult({
        decision: "DENY",
        effectiveDecision: enforcementMode === "ENFORCE" ? "DENY" : "ALLOW",
        enforcementMode,
        reasonCode: "DEFAULT_DENY_UNAUTHORIZED",
        reasonDetails: reason,
        correlationId,
        timestamp,
        context,
      });
    }

    // Default Allow for standard, non-sensitive operations
    return this.buildResult({
      decision: "ALLOW",
      effectiveDecision: "ALLOW",
      enforcementMode,
      reasonCode: "DEFAULT_ALLOW",
      reasonDetails: "Operation evaluated successfully and permitted under baseline governance.",
      correlationId,
      timestamp,
      context,
    });
  }

  private buildResult(params: {
    decision: PolicyDecisionType;
    effectiveDecision: PolicyDecisionType;
    enforcementMode: GovernanceEnforcementMode;
    reasonCode: string;
    reasonDetails: string;
    matches?: PolicyRuleMatch[];
    mandatoryRestrictionViolated?: boolean;
    requiredApprovalRoles?: string[];
    approvalRequestId?: string;
    correlationId: string;
    timestamp: string;
    context: PolicyEvaluationContext;
  }): PolicyDecisionResult {
    const matches = params.matches || [];
    const matchedPolicies = Array.from(new Set(matches.map((m) => m.policyKey)));
    const matchedPolicyVersions = Array.from(new Set(matches.map((m) => m.version)));

    const result: PolicyDecisionResult = {
      decision: params.decision,
      effectiveDecision: params.effectiveDecision,
      enforcementMode: params.enforcementMode,
      reasonCode: params.reasonCode,
      reasonDetails: params.reasonDetails,
      matchedPolicies,
      matchedPolicyVersions,
      matches,
      mandatoryRestrictionViolated: !!params.mandatoryRestrictionViolated,
      requiredApprovalRoles: params.requiredApprovalRoles || [],
      approvalRequestId: params.approvalRequestId,
      correlationId: params.correlationId,
      timestamp: params.timestamp,
      simulated: !!params.context.isSimulated,
      context: {
        organizationId: params.context.organizationId,
        workspaceId: params.context.workspaceId || null,
        actorId: params.context.actorId,
        agentId: params.context.agentId || null,
        toolKey: params.context.toolKey || null,
        action: params.context.action || null,
        resourceClassification: params.context.resourceClassification || null,
        riskTier: params.context.riskTier || null,
      },
    };

    // Emit Audit Log (asynchronously, with secret redaction)
    if (this.governanceRepo && !params.context.isSimulated) {
      this.recordAuditLog(result, params.context).catch(() => {});
    }

    return result;
  }

  private async recordAuditLog(
    result: PolicyDecisionResult,
    context: PolicyEvaluationContext,
  ): Promise<void> {
    if (!this.governanceRepo) return;
    try {
      const sanitizedDetails = redactSecrets(result.reasonDetails);
      await this.governanceRepo.createAuditLog({
        organizationId: context.organizationId,
        workspaceId: context.workspaceId || null,
        actorId: context.actorId,
        action: "policy_decision",
        targetType: context.toolKey ? "tool" : context.agentId ? "agent" : "action",
        targetId: context.toolKey || context.agentId || context.action || "global",
        beforeState: null,
        afterState: {
          decision: result.decision,
          effectiveDecision: result.effectiveDecision,
          enforcementMode: result.enforcementMode,
          reasonCode: result.reasonCode,
          reasonDetails: sanitizedDetails,
          matchedPolicies: result.matchedPolicies,
          correlationId: result.correlationId,
        },
        metadata: {
          correlationId: result.correlationId,
          autonomyLevel: context.autonomyLevel,
          resourceClassification: context.resourceClassification,
          riskTier: context.riskTier,
        },
      });
    } catch {
      // Audit failures should not crash runtime
    }
  }
}
