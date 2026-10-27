import { ApiError } from "../../../common/errors/api-error.js";
import { assertUuid } from "../../platform/tenant-context.js";
import type {
  AgentDefinitionWithTools,
  AgentTemplateRecord,
  CreateAgentInput,
  HumanApprovalPolicy,
  JsonRecord,
  UpdateAgentConfigurationInput,
  UpdateAgentStatusInput,
} from "../agent.types.js";

const allowedStatusUpdates = new Set([
  "active",
  "configured",
  "paused",
  "disabled",
  "archived",
  "suspended",
]);

const allowedProviderKeys = new Set([
  "provider",
  "modelSelection",
  "responseQuality",
  "temperature",
  "tokenLimits",
]);

const forbiddenSecretKeys = new Set([
  "apikey",
  "api_key",
  "secret",
  "token",
  "accesstoken",
  "access_token",
  "password",
  "credential",
  "credentials",
  "privatekey",
  "private_key",
  "client_secret",
  "clientsecret",
  "auth_token",
  "authorization",
]);

function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (allowedProviderKeys.has(key) || lower === "tokenlimits") return false;
  if (forbiddenSecretKeys.has(lower)) return true;
  const stripped = lower.replace(/[-_]/g, "");
  return (
    stripped === "apikey" ||
    stripped === "accesstoken" ||
    stripped === "authtoken" ||
    stripped === "clientsecret" ||
    stripped === "privatekey" ||
    stripped === "credentials" ||
    stripped === "password" ||
    stripped.endsWith("token") ||
    stripped.endsWith("secret") ||
    stripped.endsWith("apikey")
  );
}

export function validateCreateAgent(
  organizationId: string,
  body: unknown,
  userId: string,
): CreateAgentInput {
  assertUuid(organizationId, "organizationId");
  const data = asRecord(body);
  const workspaceId = readRequiredString(data, "workspaceId", 36);
  const templateId = readRequiredString(data, "templateId", 36);
  assertUuid(workspaceId, "workspaceId");
  assertUuid(templateId, "templateId");

  const humanApprovalPolicy = validateHumanApprovalPolicy(data.humanApprovalPolicy);

  return {
    organizationId,
    workspaceId,
    templateId,
    createdBy: userId,
    name: readOptionalString(data, "name", 180),
    description: readOptionalString(data, "description", 500),
    instructions: readOptionalString(data, "instructions", 20_000),
    configuration: data.configuration !== undefined ? asRecord(data.configuration) : undefined,
    modelProvider: readOptionalString(data, "modelProvider", 80),
    modelSelection: readOptionalString(data, "modelSelection", 80),
    humanApprovalPolicy,
  };
}

export function validateUpdateAgentConfiguration(
  organizationId: string,
  agentId: string,
  body: unknown,
  userId: string,
): UpdateAgentConfigurationInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(agentId, "agentId");
  const data = asRecord(body);
  const configuration = asRecord(data.configuration);
  validateSafeConfiguration(configuration);

  const humanApprovalPolicy = validateHumanApprovalPolicy(data.humanApprovalPolicy);

  return {
    organizationId,
    agentId,
    updatedBy: userId,
    configuration,
    instructions: readOptionalString(data, "instructions", 20_000),
    modelProvider: readOptionalString(data, "modelProvider", 80),
    modelSelection: readOptionalString(data, "modelSelection", 80),
    humanApprovalPolicy,
  };
}

export function validateUpdateAgentStatus(
  organizationId: string,
  agentId: string,
  body: unknown,
): UpdateAgentStatusInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(agentId, "agentId");
  const data = asRecord(body);
  const status = readRequiredString(data, "status", 40);

  if (!allowedStatusUpdates.has(status)) {
    throw new ApiError(400, "VALIDATION_FAILED", `Unsupported agent status: '${status}'.`);
  }

  return { organizationId, agentId, status: status as UpdateAgentStatusInput["status"] };
}

export function validateHumanApprovalPolicy(
  policy: unknown,
): HumanApprovalPolicy | undefined {
  if (policy === undefined || policy === null) return undefined;
  if (typeof policy !== "object" || Array.isArray(policy)) {
    throw new ApiError(400, "VALIDATION_FAILED", "humanApprovalPolicy must be an object.");
  }

  const p = policy as Record<string, unknown>;
  const required = typeof p.required === "boolean" ? p.required : false;
  let approverRoles: string[] = ["owner", "admin"];
  if (p.approverRoles !== undefined) {
    if (!Array.isArray(p.approverRoles)) {
      throw new ApiError(400, "VALIDATION_FAILED", "approverRoles must be an array of strings.");
    }
    approverRoles = p.approverRoles.filter((r): r is string => typeof r === "string" && r.length > 0);
    if (approverRoles.length === 0) {
      throw new ApiError(400, "VALIDATION_FAILED", "approverRoles must contain at least one valid role name.");
    }
  }

  let escalationTimeoutHours: number | undefined = undefined;
  if (p.escalationTimeoutHours !== undefined) {
    if (typeof p.escalationTimeoutHours !== "number" || p.escalationTimeoutHours <= 0 || p.escalationTimeoutHours > 720) {
      throw new ApiError(400, "VALIDATION_FAILED", "escalationTimeoutHours must be between 1 and 720.");
    }
    escalationTimeoutHours = p.escalationTimeoutHours;
  }

  let fallbackAction: "deny" | "escalate" | undefined = undefined;
  if (p.fallbackAction !== undefined) {
    if (p.fallbackAction !== "deny" && p.fallbackAction !== "escalate") {
      throw new ApiError(400, "VALIDATION_FAILED", "fallbackAction must be 'deny' or 'escalate'.");
    }
    fallbackAction = p.fallbackAction;
  }

  let sensitiveCapabilities: string[] | undefined = undefined;
  if (p.sensitiveCapabilities !== undefined) {
    if (!Array.isArray(p.sensitiveCapabilities)) {
      throw new ApiError(400, "VALIDATION_FAILED", "sensitiveCapabilities must be an array of strings.");
    }
    sensitiveCapabilities = p.sensitiveCapabilities.filter((c): c is string => typeof c === "string");
  }

  return {
    required,
    approverRoles,
    escalationTimeoutHours,
    fallbackAction,
    sensitiveCapabilities,
  };
}

/**
 * Validates that an agent configuration satisfies all required fields defined
 * by its template before transitioning to 'active' lifecycle state.
 */
export function validateActivationPrerequisites(
  template: AgentTemplateRecord,
  configuration: JsonRecord,
): void {
  const schema = template.configurationSchema;
  if (!schema || typeof schema !== "object") return;

  const missingFields: string[] = [];

  // Check top-level required fields array
  if (Array.isArray(schema.required)) {
    for (const field of schema.required) {
      if (typeof field === "string") {
        const val = configuration[field];
        if (val === undefined || val === null || val === "") {
          missingFields.push(field);
        }
      }
    }
  }

  // Check nested properties with required: true
  if (schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)) {
    const props = schema.properties as Record<string, unknown>;
    for (const [propName, propDef] of Object.entries(props)) {
      if (propDef && typeof propDef === "object" && (propDef as { required?: boolean }).required === true) {
        const val = configuration[propName];
        if (val === undefined || val === null || val === "") {
          if (!missingFields.includes(propName)) {
            missingFields.push(propName);
          }
        }
      }
    }
  }

  if (missingFields.length > 0) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      `Agent cannot be activated without required configuration: missing [${missingFields.join(", ")}].`,
    );
  }
}

/**
 * Redacts any accidental secrets or sensitive credentials from configuration
 * objects before storing or exposing in API responses/audit events.
 */
export function redactSensitiveConfig(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") {
    if (typeof value === "string") {
      // Check for token or key signatures
      if (
        value.startsWith("sk-") ||
        value.startsWith("ghp_") ||
        value.startsWith("Bearer ") ||
        (value.length > 40 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value))
      ) {
        return "[REDACTED]";
      }
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveConfig(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(key)) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redactSensitiveConfig(val);
    }
  }
  return result;
}

/**
 * Enforces default-deny capability authorization on an agent instance.
 */
export function assertCapabilityPermitted(
  agent: AgentDefinitionWithTools,
  capabilityKey: string,
): void {
  const assignedToolKeys = new Set(agent.tools.map((t) => t.toolKey));
  const configTools = Array.isArray(agent.configuration.tools)
    ? (agent.configuration.tools as string[])
    : [];
  for (const t of configTools) {
    assignedToolKeys.add(t);
  }

  if (!assignedToolKeys.has(capabilityKey)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      `Agent '${agent.name}' (ID: ${agent.id}) is not permitted to use capability '${capabilityKey}'. Default-deny policy enforced.`,
    );
  }
}

export function readPagePagination(url: URL): { page: number; pageSize: number } {
  const pageParam = url.searchParams.get("page");
  const pageSizeParam = url.searchParams.get("pageSize") ?? url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");

  let pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : 20;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 20;
  if (pageSize > 100) pageSize = 100;

  let page = pageParam ? parseInt(pageParam, 10) : 1;
  if (offsetParam && !pageParam) {
    const offset = parseInt(offsetParam, 10);
    if (Number.isFinite(offset) && offset >= 0) {
      page = Math.floor(offset / pageSize) + 1;
    }
  }
  if (!Number.isFinite(page) || page < 1) page = 1;

  return { page, pageSize };
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
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          `Unsupported model configuration field: ${key}.`,
        );
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
    if (isSecretKey(key)) {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        "Provider secrets must not be stored in agent configuration.",
      );
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
