/**
 * HAZA-AIOS — Epic 22B: Policy & Permission Engine Types
 */

export type PolicyDecisionType = "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "NOT_APPLICABLE";

export type GovernanceEnforcementMode = "DISABLED" | "MONITOR" | "ENFORCE";

export type ResourceClassification = "public" | "internal" | "confidential" | "restricted";

export type RiskTier = "low" | "medium" | "high" | "critical";

export interface PolicyEvaluationContext {
  organizationId: string;
  workspaceId?: string | null;
  actorId: string;
  actorRoles?: string[];
  agentId?: string | null;
  toolKey?: string | null;
  action?: string | null; // e.g. "agent_execution", "tool_invocation", "multi_agent_delegation", "autonomous_task"
  resourceClassification?: ResourceClassification | string | null;
  autonomyLevel?: string | number | null; // "L0", "L1", "L2", "L3" or 0, 1, 2, 3
  riskTier?: RiskTier | string | null;
  parameters?: Record<string, unknown>;
  correlationId?: string;
  isSimulated?: boolean;
}

export interface PolicyRuleMatch {
  policyId: string;
  policyKey: string;
  version: number;
  severity: string;
  enforcementAction: string;
  ruleKey: string;
  reason: string;
}

export interface PolicyDecisionResult {
  decision: PolicyDecisionType;
  effectiveDecision: PolicyDecisionType; // Result after factoring in enforcementMode
  enforcementMode: GovernanceEnforcementMode;
  reasonCode: string;
  reasonDetails: string;
  matchedPolicies: string[];
  matchedPolicyVersions: number[];
  matches: PolicyRuleMatch[];
  mandatoryRestrictionViolated: boolean;
  requiredApprovalRoles?: string[];
  approvalRequestId?: string;
  correlationId: string;
  timestamp: string;
  simulated: boolean;
  context: {
    organizationId: string;
    workspaceId: string | null;
    actorId: string;
    agentId: string | null;
    toolKey: string | null;
    action: string | null;
    resourceClassification: string | null;
    riskTier: string | null;
  };
}

export interface PolicySimulationResult {
  simulated: true;
  decision: PolicyDecisionType;
  effectiveDecision: PolicyDecisionType;
  enforcementMode: GovernanceEnforcementMode;
  precedenceLevel: number; // 1 = Mandatory, 2 = Deny, 3 = Require Approval, 4 = Allow, 5 = Default
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
  context: PolicyEvaluationContext;
}

export interface PolicyVersionComparisonResult {
  policyId: string;
  policyKey: string;
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
    modifiedRules: Array<{
      key: string;
      oldValue: unknown;
      newValue: unknown;
    }>;
  };
}
