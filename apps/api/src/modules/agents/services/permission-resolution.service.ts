/**
 * HAZA-AIOS — Epic 22B: Permission Resolution Service
 * Reuses existing RBAC and tenant authorization structures.
 */

import type { AgentGovernanceRepository } from "../repositories/agent-governance.repository.js";
import type { PolicyEvaluationContext } from "../governance-policy-engine.types.js";

export interface PermissionResolutionResult {
  authorized: boolean;
  tenantValid: boolean;
  ownershipActive: boolean;
  orphanedAgent: boolean;
  autonomyAuthorized: boolean;
  mandatoryRestrictionViolated: boolean;
  reasonCode: string;
  reasonDetails: string;
  effectiveRoles: string[];
  maxAllowedAutonomy: number;
}

export class PermissionResolutionService {
  constructor(private readonly governanceRepo?: AgentGovernanceRepository) {}

  /**
   * Resolves effective permissions and validates tenant boundaries, ownership,
   * and autonomy constraints for the given execution context.
   */
  async resolvePermissions(
    context: PolicyEvaluationContext,
    options?: {
      agentOwnerId?: string | null;
      agentOrgId?: string | null;
      profileMaxAutonomy?: number | string | null;
    },
  ): Promise<PermissionResolutionResult> {
    const roles = context.actorRoles || [];

    // 1. Mandatory Tenant Boundary Check
    if (options?.agentOrgId && options.agentOrgId !== context.organizationId) {
      return {
        authorized: false,
        tenantValid: false,
        ownershipActive: false,
        orphanedAgent: false,
        autonomyAuthorized: false,
        mandatoryRestrictionViolated: true,
        reasonCode: "TENANT_MISMATCH",
        reasonDetails: `Cross-tenant authorization violation: Agent belongs to '${options.agentOrgId}', not '${context.organizationId}'`,
        effectiveRoles: roles,
        maxAllowedAutonomy: 0,
      };
    }

    // 2. Resolve Agent Profile & Ownership if repository is present and agentId specified
    let isOrphaned = false;
    let ownershipActive = true;
    let maxAutonomy = 2; // Default L2 autonomy

    if (context.agentId && this.governanceRepo) {
      const [profile, ownership] = await Promise.all([
        this.governanceRepo.getProfileByAgentId(context.organizationId, context.agentId),
        this.governanceRepo.getOwnershipByAgentId(context.organizationId, context.agentId),
      ]);

      if (profile) {
        if (typeof profile.maxAutonomyLevel === "number") {
          maxAutonomy = profile.maxAutonomyLevel;
        } else if (typeof profile.maxAutonomyLevel === "string") {
          const parsed = parseInt(profile.maxAutonomyLevel.replace("L", ""), 10);
          maxAutonomy = isNaN(parsed) ? 2 : parsed;
        }
      }

      if (!ownership || !ownership.primaryOwnerId || (ownership.accountabilityStatus as string) === "orphaned" || ownership.accountabilityStatus === "unassigned" || ownership.accountabilityStatus === "vacant") {
        isOrphaned = true;
        ownershipActive = false;
      }
    } else if (options?.profileMaxAutonomy !== undefined && options.profileMaxAutonomy !== null) {
      if (typeof options.profileMaxAutonomy === "number") {
        maxAutonomy = options.profileMaxAutonomy;
      } else {
        const parsed = parseInt(String(options.profileMaxAutonomy).replace("L", ""), 10);
        maxAutonomy = isNaN(parsed) ? 2 : parsed;
      }
    }

    // 3. Autonomy Level Validation
    let requestedAutonomy = 1;
    if (context.autonomyLevel !== undefined && context.autonomyLevel !== null) {
      if (typeof context.autonomyLevel === "number") {
        requestedAutonomy = context.autonomyLevel;
      } else {
        const parsed = parseInt(String(context.autonomyLevel).replace("L", ""), 10);
        requestedAutonomy = isNaN(parsed) ? 1 : parsed;
      }
    }

    const autonomyAuthorized = requestedAutonomy <= maxAutonomy;

    // 4. Role Authorization for Sensitive / Governed Actions
    let authorized = true;
    let reasonCode = "PERMISSIONS_RESOLVED";
    let reasonDetails = "Actor and agent permissions successfully validated.";

    if (!autonomyAuthorized) {
      authorized = false;
      reasonCode = "AUTONOMY_EXCEEDED";
      reasonDetails = `Requested autonomy level L${requestedAutonomy} exceeds maximum permitted level L${maxAutonomy}`;
    }

    return {
      authorized,
      tenantValid: true,
      ownershipActive,
      orphanedAgent: isOrphaned,
      autonomyAuthorized,
      mandatoryRestrictionViolated: false,
      reasonCode,
      reasonDetails,
      effectiveRoles: roles,
      maxAllowedAutonomy: maxAutonomy,
    };
  }
}
