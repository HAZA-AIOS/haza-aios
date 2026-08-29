import { ApiError } from "../../../common/errors/api-error.js";
import { assertUuid } from "../../platform/tenant-context.js";
import type { CreateAgentInput, JsonRecord, UpdateAgentConfigurationInput, UpdateAgentStatusInput } from "../agent.types.js";

const allowedStatusUpdates = new Set(["active", "configured", "paused", "disabled", "archived"]);
const allowedProviderKeys = new Set(["provider", "modelSelection", "responseQuality", "temperature", "tokenLimits"]);
const forbiddenSecretKeys = new Set(["apikey", "api_key", "secret", "token", "accesstoken", "access_token", "password", "credential", "privatekey", "private_key"]);

export function validateCreateAgent(organizationId: string, body: unknown, userId: string): CreateAgentInput {
  assertUuid(organizationId, "organizationId");
  const data = asRecord(body);
  const workspaceId = readRequiredString(data, "workspaceId", 36);
  const templateId = readRequiredString(data, "templateId", 36);
  assertUuid(workspaceId, "workspaceId");
  assertUuid(templateId, "templateId");

  return {
    organizationId,
    workspaceId,
    templateId,
    createdBy: userId,
    name: readOptionalString(data, "name", 180),
  };
}

export function validateUpdateAgentConfiguration(organizationId: string, agentId: string, body: unknown, userId: string): UpdateAgentConfigurationInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(agentId, "agentId");
  const data = asRecord(body);
  const configuration = asRecord(data.configuration);
  validateSafeConfiguration(configuration);

  return {
    organizationId,
    agentId,
    updatedBy: userId,
    configuration,
  };
}

export function validateUpdateAgentStatus(organizationId: string, agentId: string, body: unknown): UpdateAgentStatusInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(agentId, "agentId");
  const data = asRecord(body);
  const status = readRequiredString(data, "status", 40);

  if (!allowedStatusUpdates.has(status)) {
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported agent status.");
  }

  return { organizationId, agentId, status: status as UpdateAgentStatusInput["status"] };
}

function validateSafeConfiguration(configuration: JsonRecord): void {
  const serialized = JSON.stringify(configuration);
  if (serialized.length > 120_000) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Agent configuration is too large.");
  }

  rejectSecretKeys(configuration);

  const model = configuration.model;
  if (model !== undefined) {
    const modelConfig = asRecord(model);
    for (const key of Object.keys(modelConfig)) {
      if (!allowedProviderKeys.has(key)) {
        throw new ApiError(400, "VALIDATION_FAILED", `Unsupported model configuration field: ${key}.`);
      }
    }
  }

  const instructions = configuration.instructions;
  if (instructions !== undefined) {
    const instructionConfig = asRecord(instructions);
    for (const value of Object.values(instructionConfig)) {
      if (typeof value === "string" && value.length > 20_000) {
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Agent instruction text is too large.");
      }
    }
  }
}

function rejectSecretKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rejectSecretKeys);
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenSecretKeys.has(key.toLowerCase())) {
      throw new ApiError(400, "VALIDATION_FAILED", "Provider secrets must not be stored in agent configuration.");
    }
    rejectSecretKeys(nested);
  }
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_FAILED", "Request body must be a JSON object.");
  }
  return value as JsonRecord;
}

function readRequiredString(data: JsonRecord, key: string, maxLength: number): string {
  const value = data[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "VALIDATION_FAILED", `${key} is required.`);
  }
  if (value.length > maxLength) {
    throw new ApiError(400, "VALIDATION_FAILED", `${key} is too long.`);
  }
  return value.trim();
}

function readOptionalString(data: JsonRecord, key: string, maxLength: number): string | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_FAILED", `${key} must be a string.`);
  }
  if (value.length > maxLength) {
    throw new ApiError(400, "VALIDATION_FAILED", `${key} is too long.`);
  }
  return value.trim() || undefined;
}
