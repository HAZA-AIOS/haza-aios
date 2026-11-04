import type {
  FailureAnalysis,
  PlanAdaptation,
  AutonomousTaskDefinitionEntity,
} from "../autonomous.types.js";

export class AutonomousRecoveryService {
  /**
   * Classifies an execution error into retryable (transient) vs terminal (unrecoverable).
   */
  classifyFailure(error: any): FailureAnalysis {
    const message = (error?.message || String(error)).toLowerCase();

    // Check for transient / retryable conditions
    const isNetworkError =
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("econnrefused") ||
      message.includes("network") ||
      message.includes("socket hang up");

    const isRateLimit =
      message.includes("rate limit") ||
      message.includes("429") ||
      message.includes("too many requests") ||
      message.includes("quota exceeded");

    const isTimeout =
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("deadline exceeded");

    const isConcurrency =
      message.includes("deadlock") ||
      message.includes("lock wait") ||
      message.includes("conflict");

    if (isNetworkError || isRateLimit || isTimeout || isConcurrency) {
      return {
        classification: "retryable",
        reason: isConcurrency
          ? "Concurrency conflict / deadlock; eligible for retry."
          : isRateLimit
          ? "Provider rate limit reached; eligible for exponential backoff retry."
          : isTimeout
          ? "Operation timed out; eligible for retry."
          : "Transient network failure; eligible for retry.",
        canReplan: false,
        suggestedAction: "retry",
      };
    }

    // Check for permission / security / authorization failures (terminal)
    const isAuthError =
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("permission denied") ||
      message.includes("401") ||
      message.includes("403");

    if (isAuthError) {
      return {
        classification: "terminal",
        reason: "Security or authorization failure. Privileges cannot be escalated autonomously.",
        canReplan: false,
        suggestedAction: "abort",
      };
    }

    // Check for schema / validation / parameter failure (potentially replannable)
    const isSchemaError =
      message.includes("validation") ||
      message.includes("schema") ||
      message.includes("invalid argument") ||
      message.includes("not found");

    if (isSchemaError) {
      return {
        classification: "terminal",
        reason: `Structural error encountered: ${message}`,
        canReplan: true,
        suggestedAction: "replan",
      };
    }

    return {
      classification: "terminal",
      reason: `Unhandled execution failure: ${message}`,
      canReplan: false,
      suggestedAction: "abort",
    };
  }

  /**
   * Validates that an adapted plan does not violate security constraints or expand privileges.
   */
  validateAdaptation(
    taskDef: AutonomousTaskDefinitionEntity,
    originalPlan: Record<string, unknown>,
    adaptedPlan: Record<string, unknown>,
  ): { isValid: boolean; requiresApproval: boolean; rejectionReason?: string } {
    // 1. Check if original objective is preserved
    const origObjective = originalPlan.objective || taskDef.name;
    const adaptedObjective = adaptedPlan.objective || origObjective;
    if (origObjective !== adaptedObjective) {
      return {
        isValid: false,
        requiresApproval: true,
        rejectionReason: "Objective drift detected: Adapted plan changed the original task objective.",
      };
    }

    // 2. Check for tool / agent privilege escalation
    const allowedAgentIds = new Set<string>();
    if (taskDef.agentId) allowedAgentIds.add(taskDef.agentId);

    const proposedAgents = (adaptedPlan.assignedAgentIds as string[]) || [];
    for (const aId of proposedAgents) {
      if (!allowedAgentIds.has(aId) && taskDef.targetType === "agent") {
        return {
          isValid: false,
          requiresApproval: true,
          rejectionReason: `Privilege escalation blocked: Agent ${aId} is not in the allowed task definition scope.`,
        };
      }
    }

    // 3. Check for consequential mutations
    const hasConsequentialActions = Boolean(adaptedPlan.hasConsequentialActions);
    const requiresApproval =
      taskDef.approvalPolicy.requireApprovalOnReplanning ||
      (hasConsequentialActions && taskDef.approvalPolicy.requireApprovalForMutations) ||
      taskDef.autonomyLevel === "L0" ||
      taskDef.autonomyLevel === "L1";

    return {
      isValid: true,
      requiresApproval,
    };
  }

  /**
   * Creates an audit record for plan adaptation.
   */
  createAdaptationRecord(
    currentRevision: number,
    reason: string,
    failedStepKey: string | undefined,
    originalPlan: Record<string, unknown>,
    adaptedPlan: Record<string, unknown>,
    requiresRenewedApproval: boolean,
  ): PlanAdaptation {
    return {
      revision: currentRevision + 1,
      reason,
      failedStepKey,
      originalPlan,
      adaptedPlan,
      adaptedAt: new Date().toISOString(),
      requiresRenewedApproval,
    };
  }
}
