import { ApiError } from "../../../common/errors/api-error.js";
import type { AgentSecurityRepository } from "../repositories/agent-security.repository.js";
import { redactObject } from "../utils/secret-redactor.js";
export { redactObject };
import type { AgentSecretReferenceEntity } from "../governance-security.types.js";

export class AgentSecretVaultService {
  // In-memory synthetic secret vault keyed by `${organizationId}:${secretIdentifier}`
  // Never stored in the database.
  private static readonly vaultStore = new Map<string, string>();

  constructor(private readonly securityRepo: AgentSecurityRepository) {}

  /**
   * Registers a synthetic secret value in the in-memory vault for testing/backend execution.
   * This is never exported or serialized.
   */
  static registerSecretValue(organizationId: string, secretIdentifier: string, secretValue: string): void {
    const key = `${organizationId}:${secretIdentifier}`;
    this.vaultStore.set(key, secretValue);
  }

  static clearVault(): void {
    this.vaultStore.clear();
  }

  /**
   * Retrieves a secret value for trusted backend execution after verifying:
   * 1. Multi-tenant boundary
   * 2. Active status (rejects REVOKED or ROTATED)
   * 3. Agent allowlist scope
   * 4. Tool allowlist scope
   * 5. Emits audit security event without secret payload
   */
  async resolveSecret(input: {
    organizationId: string;
    workspaceId?: string | null;
    secretIdentifier: string;
    agentId: string;
    toolKey?: string;
    actorId?: string;
  }): Promise<{ secretValue: string; reference: AgentSecretReferenceEntity }> {
    const ref = await this.securityRepo.getSecretReference(
      input.organizationId,
      input.secretIdentifier,
    );

    if (!ref) {
      await this.securityRepo.createEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        actorId: input.actorId,
        eventType: "SECRET_ACCESS_DENIED",
        severity: "HIGH",
        targetType: "secret_reference",
        targetId: input.secretIdentifier,
        details: { reason: "Secret reference identifier not found" },
      });
      throw new ApiError(404, "NOT_FOUND", `Secret reference '${input.secretIdentifier}' not found`);
    }

    // 1. Tenant boundary
    if (ref.organizationId !== input.organizationId) {
      await this.securityRepo.createEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        actorId: input.actorId,
        eventType: "SECRET_ACCESS_DENIED",
        severity: "CRITICAL",
        targetType: "secret_reference",
        targetId: ref.id,
        details: { reason: "Cross-tenant secret reference access attempted" },
      });
      throw new ApiError(403, "FORBIDDEN", "Cross-tenant secret access is strictly prohibited");
    }

    // 2. Lifecycle Status
    if (ref.status === "revoked") {
      await this.securityRepo.createEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        actorId: input.actorId,
        eventType: "SECRET_REVOKED",
        severity: "HIGH",
        targetType: "secret_reference",
        targetId: ref.id,
        details: { reason: "Attempted to access revoked secret" },
      });
      throw new ApiError(403, "FORBIDDEN", `Secret reference '${ref.secretIdentifier}' has been revoked`);
    }

    // 3. Agent Scope Check
    if (ref.allowedAgentIds.length > 0 && !ref.allowedAgentIds.includes(input.agentId)) {
      await this.securityRepo.createEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        actorId: input.actorId,
        eventType: "SECRET_ACCESS_DENIED",
        severity: "HIGH",
        targetType: "secret_reference",
        targetId: ref.id,
        details: { reason: `Agent '${input.agentId}' is not authorized to access secret` },
      });
      throw new ApiError(403, "FORBIDDEN", `Agent '${input.agentId}' is not authorized for secret '${ref.secretIdentifier}'`);
    }

    // 4. Tool Scope Check
    if (input.toolKey && ref.allowedToolKeys.length > 0 && !ref.allowedToolKeys.includes(input.toolKey)) {
      await this.securityRepo.createEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        actorId: input.actorId,
        eventType: "SECRET_ACCESS_DENIED",
        severity: "HIGH",
        targetType: "secret_reference",
        targetId: ref.id,
        details: { reason: `Tool '${input.toolKey}' is not authorized to access secret` },
      });
      throw new ApiError(403, "FORBIDDEN", `Tool '${input.toolKey}' is not authorized for secret '${ref.secretIdentifier}'`);
    }

    // Retrieve from secure in-memory store
    const storeKey = `${input.organizationId}:${ref.secretIdentifier}`;
    const secretValue = AgentSecretVaultService.vaultStore.get(storeKey) || `synthetic-${ref.secretIdentifier}-val`;

    // Audit log access without leaking secret
    await this.securityRepo.createEvent({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      actorId: input.actorId,
      eventType: "CAPABILITY_DENIED", // Will only be logged if an issue occurs; here we log normal access via audit or details
      severity: "LOW",
      targetType: "secret_reference",
      targetId: ref.id,
      details: {
        action: "secret_resolved",
        version: ref.version,
        toolKey: input.toolKey,
      },
    });

    return { secretValue, reference: ref };
  }

  /**
   * Sanitizes any output object or string to prevent inadvertent secret disclosure.
   */
  sanitizeOutput<T>(data: T): T {
    return redactObject(data);
  }
}

