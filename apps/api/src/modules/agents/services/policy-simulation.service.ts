/**
 * HAZA-AIOS — Epic 22B: Policy Simulation Service
 * Read-only simulation engine. Evaluates hypothetical decisions without executing any action.
 */

import type { AgentGovernanceRepository } from "../repositories/agent-governance.repository.js";
import { PolicyEvaluationEngine } from "./policy-evaluation-engine.service.js";
import type {
  PolicyEvaluationContext,
  PolicySimulationResult,
} from "../governance-policy-engine.types.js";

export class PolicySimulationService {
  private readonly evaluationEngine: PolicyEvaluationEngine;

  constructor(private readonly governanceRepo?: AgentGovernanceRepository) {
    this.evaluationEngine = new PolicyEvaluationEngine(governanceRepo);
  }

  /**
   * Runs a read-only policy simulation against the policy registry.
   * Guarantees: Never executes agent action, tool, or workflow.
   */
  async simulatePolicyDecision(
    context: PolicyEvaluationContext,
  ): Promise<PolicySimulationResult> {
    // Force simulated flag
    const simContext: PolicyEvaluationContext = {
      ...context,
      isSimulated: true,
    };

    const evalResult = await this.evaluationEngine.evaluate(simContext);

    // Determine Precedence Level (1 to 5)
    let precedenceLevel = 5;
    let precedenceDescription = "Level 5: Default authorization rules applied";

    if (evalResult.mandatoryRestrictionViolated) {
      precedenceLevel = 1;
      precedenceDescription = "Level 1: Mandatory platform security restriction (highest precedence)";
    } else if (evalResult.reasonCode === "POLICY_EXPLICIT_DENY") {
      precedenceLevel = 2;
      precedenceDescription = "Level 2: Explicit applicable DENY policy";
    } else if (evalResult.reasonCode === "POLICY_REQUIRE_APPROVAL") {
      precedenceLevel = 3;
      precedenceDescription = "Level 3: Applicable REQUIRE_APPROVAL policy";
    } else if (evalResult.reasonCode === "POLICY_EXPLICIT_ALLOW") {
      precedenceLevel = 4;
      precedenceDescription = "Level 4: Applicable ALLOW policy";
    }

    const matchedPolicies = evalResult.matches.map((m) => ({
      id: m.policyId,
      policyKey: m.policyKey,
      name: m.policyKey,
      version: m.version,
      severity: m.severity,
      enforcementAction: m.enforcementAction,
      matchedRule: m.ruleKey,
    }));

    return {
      simulated: true,
      decision: evalResult.decision,
      effectiveDecision: evalResult.effectiveDecision,
      enforcementMode: evalResult.enforcementMode,
      precedenceLevel,
      precedenceDescription,
      matchedPolicies,
      reasonCode: evalResult.reasonCode,
      reasonDetails: evalResult.reasonDetails,
      wouldRequireHumanApproval: evalResult.decision === "REQUIRE_APPROVAL",
      requiredApprovalRoles: evalResult.requiredApprovalRoles || [],
      simulatedAt: evalResult.timestamp,
      correlationId: evalResult.correlationId,
      context: simContext,
    };
  }

  /**
   * Compares two versions of a policy and generates a structured diff.
   */
  async comparePolicyVersions(
    organizationId: string,
    policyId: string,
    v1Num: number,
    v2Num: number,
  ) {
    if (!this.governanceRepo) {
      throw new Error("Repository unavailable for version comparison");
    }

    const versions = await this.governanceRepo.listPolicyVersions(organizationId, policyId);
    const v1 = versions.find((v) => v.version === v1Num);
    const v2 = versions.find((v) => v.version === v2Num);

    if (!v1 || !v2) {
      throw new Error(`Policy versions v${v1Num} and/or v${v2Num} not found`);
    }

    const rules1 = (v1.rules || {}) as Record<string, unknown>;
    const rules2 = (v2.rules || {}) as Record<string, unknown>;

    const keys1 = Object.keys(rules1);
    const keys2 = Object.keys(rules2);

    const addedRules = keys2.filter((k) => !keys1.includes(k));
    const removedRules = keys1.filter((k) => !keys2.includes(k));
    const modifiedRules: Array<{ key: string; oldValue: unknown; newValue: unknown }> = [];

    for (const key of keys1) {
      if (keys2.includes(key)) {
        if (JSON.stringify(rules1[key]) !== JSON.stringify(rules2[key])) {
          modifiedRules.push({
            key,
            oldValue: rules1[key],
            newValue: rules2[key],
          });
        }
      }
    }

    return {
      policyId,
      v1: {
        version: v1.version,
        lifecycleState: v1.lifecycleState,
        rules: rules1,
        changeSummary: v1.changeSummary,
      },
      v2: {
        version: v2.version,
        lifecycleState: v2.lifecycleState,
        rules: rules2,
        changeSummary: v2.changeSummary,
      },
      diff: {
        addedRules,
        removedRules,
        modifiedRules,
      },
    };
  }
}
