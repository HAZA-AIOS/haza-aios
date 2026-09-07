import { ApiError } from "../../../common/errors/api-error.js";
import { assertUuid } from "../../platform/tenant-context.js";
import type {
  AgentMemoryQuery,
  AgentMemoryScope,
  AgentMemoryStatus,
  CreateAgentMemoryInput,
  JsonRecord,
  UpdateAgentMemoryInput,
} from "../agent.types.js";

const memoryScopes = new Set<AgentMemoryScope>([
  "user",
  "agent",
  "conversation",
  "workspace",
  "organization",
]);
const memoryStatuses = new Set<AgentMemoryStatus>(["active", "archived", "deleted"]);
const memoryTypes = new Set(["fact", "preference", "context", "task_state", "instruction"]);
const secretPattern =
  /(sk-[a-z0-9_-]+|ghp_[a-z0-9_]+|github_pat_[a-z0-9_]+|authorization:\s*bearer\s+\S+|api[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+)/i;

export function validateCreateMemory(
  organizationId: string,
  agentId: string,
  body: unknown,
  userId: string,
): CreateAgentMemoryInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(agentId, "agentId");
  const data = asRecord(body);
  const scope = readOptionalString(data, "scope", 40) ?? "user";
  if (!memoryScopes.has(scope as AgentMemoryScope))
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported memory scope.");
  const type = (readOptionalString(data, "type", 80) ?? "fact").toLowerCase();
  if (!memoryTypes.has(type))
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported memory type.");
  const content = readRequiredString(data, "content", 10_000);
  rejectSecrets(content);
  const metadata = data.metadata === undefined ? {} : asRecord(data.metadata);
  rejectSecrets(metadata);
  const sourceRunId = readOptionalUuid(data, "sourceRunId");
  const sourceConversationId =
    readOptionalUuid(data, "sourceConversationId") ?? readOptionalUuid(data, "conversationId");
  const sourceMessageId = readOptionalUuid(data, "sourceMessageId");
  return {
    organizationId,
    agentId,
    userId,
    scope: scope as AgentMemoryScope,
    type,
    content,
    source: readOptionalString(data, "source", 120) ?? "manual",
    sourceRunId,
    sourceConversationId,
    sourceMessageId,
    importance: readImportance(data.importance),
    metadata,
    expiresAt: readOptionalDate(data, "expiresAt"),
  };
}

export function validateUpdateMemory(
  organizationId: string,
  memoryId: string,
  body: unknown,
  userId: string,
): UpdateAgentMemoryInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(memoryId, "memoryId");
  const data = asRecord(body);
  const scope = readOptionalString(data, "scope", 40);
  if (scope && !memoryScopes.has(scope as AgentMemoryScope))
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported memory scope.");
  const status = readOptionalString(data, "status", 40);
  if (status && !memoryStatuses.has(status as AgentMemoryStatus))
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported memory status.");
  const type = readOptionalString(data, "type", 80)?.toLowerCase();
  if (type && !memoryTypes.has(type))
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported memory type.");
  const content = readOptionalString(data, "content", 10_000);
  if (content) rejectSecrets(content);
  const metadata = data.metadata === undefined ? undefined : asRecord(data.metadata);
  if (metadata) rejectSecrets(metadata);
  return {
    organizationId,
    memoryId,
    userId,
    scope: scope as AgentMemoryScope | undefined,
    type,
    content,
    status: status as AgentMemoryStatus | undefined,
    importance: data.importance === undefined ? undefined : readImportance(data.importance),
    metadata,
    expiresAt: data.expiresAt === null ? null : readOptionalDate(data, "expiresAt"),
  };
}

export function readMemoryQuery(
  organizationId: string,
  agentId: string,
  userId: string,
  url: URL,
): AgentMemoryQuery {
  assertUuid(organizationId, "organizationId");
  assertUuid(agentId, "agentId");
  const scope = url.searchParams.get("scope") ?? undefined;
  if (scope && !memoryScopes.has(scope as AgentMemoryScope))
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported memory scope.");
  const status = url.searchParams.get("status") ?? "active";
  if (!memoryStatuses.has(status as AgentMemoryStatus))
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported memory status.");
  const conversationId = url.searchParams.get("conversationId") ?? undefined;
  if (conversationId) assertUuid(conversationId, "conversationId");
  return {
    organizationId,
    agentId,
    userId,
    limit: clampNumber(Number(url.searchParams.get("limit") ?? 20), 1, 100, 20),
    offset: clampNumber(Number(url.searchParams.get("offset") ?? 0), 0, 10_000, 0),
    type: url.searchParams.get("type") ?? undefined,
    scope: scope as AgentMemoryScope | undefined,
    status: status as AgentMemoryStatus,
    conversationId,
  };
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "VALIDATION_FAILED", "Request body must be a JSON object.");
  return value as JsonRecord;
}

function readRequiredString(data: JsonRecord, key: string, maxLength: number): string {
  const value = data[key];
  if (typeof value !== "string" || !value.trim())
    throw new ApiError(400, "VALIDATION_FAILED", `${key} is required.`);
  if (value.length > maxLength) throw new ApiError(400, "VALIDATION_FAILED", `${key} is too long.`);
  return value.trim();
}

function readOptionalString(data: JsonRecord, key: string, maxLength: number): string | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string")
    throw new ApiError(400, "VALIDATION_FAILED", `${key} must be a string.`);
  if (value.length > maxLength) throw new ApiError(400, "VALIDATION_FAILED", `${key} is too long.`);
  return value.trim() || undefined;
}

function readOptionalUuid(data: JsonRecord, key: string): string | undefined {
  const value = readOptionalString(data, key, 36);
  if (value) assertUuid(value, key);
  return value;
}

function readImportance(value: unknown): number {
  if (value === undefined || value === null) return 5;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 10)
    throw new ApiError(400, "VALIDATION_FAILED", "importance must be an integer from 1 to 10.");
  return numeric;
}

function readOptionalDate(data: JsonRecord, key: string): Date | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string")
    throw new ApiError(400, "VALIDATION_FAILED", `${key} must be an ISO date string.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new ApiError(400, "VALIDATION_FAILED", `${key} must be a valid ISO date string.`);
  return date;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function rejectSecrets(value: unknown): void {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (serialized && secretPattern.test(serialized))
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "Secrets and credentials must not be stored in agent memory.",
    );
}
