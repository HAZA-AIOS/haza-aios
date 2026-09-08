import { ApiError } from "../../../common/errors/api-error.js";
import { assertUuid } from "../../platform/tenant-context.js";
import type {
  AgentMessageRole,
  AgentRunStatus,
  CreateAgentRunInput,
  CreateConversationInput,
  CreateMessageInput,
  JsonRecord,
  PaginationInput,
  UpdateAgentRunInput,
} from "../agent.types.js";

const runStatuses = new Set<AgentRunStatus>([
  "queued",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
]);
const messageRoles = new Set<AgentMessageRole>(["user", "assistant", "system", "tool"]);
const secretPattern =
  /(sk-[a-z0-9_-]+|ghp_[a-z0-9_]+|github_pat_[a-z0-9_]+|authorization:\s*bearer\s+\S+|api[_-]?key\s*[:=]\s*\S+|password\s*[:=]\s*\S+)/i;

export function validateCreateRun(
  organizationId: string,
  agentId: string,
  body: unknown,
  userId: string,
): CreateAgentRunInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(agentId, "agentId");
  const data = asRecord(body);
  const input = data.input;
  if (input === undefined || input === null || (typeof input === "string" && !input.trim())) {
    throw new ApiError(400, "VALIDATION_FAILED", "input is required.");
  }
  const conversationId = readOptionalString(data, "conversationId", 36);
  if (conversationId) assertUuid(conversationId, "conversationId");
  const idempotencyKey = readOptionalString(data, "idempotencyKey", 160);
  const metadata = data.metadata === undefined ? {} : asRecord(data.metadata);
  rejectSecrets(input);
  rejectSecrets(metadata);
  return {
    organizationId,
    agentId,
    userId,
    conversationId,
    input,
    executionMode: readOptionalString(data, "executionMode", 40) ?? "manual",
    metadata,
    idempotencyKey,
  };
}

export function validateUpdateRun(
  organizationId: string,
  runId: string,
  body: unknown,
  userId: string,
): UpdateAgentRunInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(runId, "runId");
  const data = asRecord(body);
  const status = readRequiredString(data, "status", 40) as AgentRunStatus;
  if (!runStatuses.has(status))
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported run status.");
  const metadata = data.metadata === undefined ? undefined : asRecord(data.metadata);
  if (metadata) rejectSecrets(metadata);
  const error = readOptionalString(data, "error", 1000);
  const durationMs = readOptionalNumber(data, "duration");
  return {
    organizationId,
    runId,
    userId,
    status,
    output: data.output,
    error,
    errorCode: readOptionalString(data, "errorCode", 120),
    metadata,
    durationMs,
  };
}

export function validateCreateConversation(
  organizationId: string,
  body: unknown,
  userId: string,
): CreateConversationInput {
  assertUuid(organizationId, "organizationId");
  const data = asRecord(body);
  const agentId = readRequiredString(data, "agentId", 36);
  assertUuid(agentId, "agentId");
  return {
    organizationId,
    agentId,
    userId,
    title: readRequiredString(data, "title", 220),
  };
}

export function validateCreateMessage(
  organizationId: string,
  conversationId: string,
  body: unknown,
  userId: string,
): CreateMessageInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(conversationId, "conversationId");
  const data = asRecord(body);
  const role = readRequiredString(data, "role", 40) as AgentMessageRole;
  if (!messageRoles.has(role))
    throw new ApiError(400, "VALIDATION_FAILED", "Unsupported message role.");
  if (role === "system")
    throw new ApiError(403, "FORBIDDEN", "System messages cannot be written through this API.");
  const content = readRequiredString(data, "content", 50_000);
  rejectSecrets(content);
  const agentRunId = readOptionalString(data, "agentRunId", 36);
  if (agentRunId) assertUuid(agentRunId, "agentRunId");
  const metadata =
    data.metadata === undefined || data.metadata === null ? null : asRecord(data.metadata);
  if (metadata) rejectSecrets(metadata);
  return { organizationId, conversationId, userId, role, content, metadata, agentRunId };
}

export function readPagination(url: URL): PaginationInput {
  const limit = clampNumber(Number(url.searchParams.get("limit") ?? 50), 1, 100, 50);
  const offset = clampNumber(Number(url.searchParams.get("offset") ?? 0), 0, 10_000, 0);
  return { limit, offset };
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "VALIDATION_FAILED", "Request body must be a JSON object.");
  }
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

function readOptionalNumber(data: JsonRecord, key: string): number | undefined {
  const value = data[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ApiError(400, "VALIDATION_FAILED", `${key} must be a non-negative number.`);
  }
  return Math.round(value);
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function rejectSecrets(value: unknown): void {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (secretPattern.test(serialized)) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "Runtime payload contains secret-like content and cannot be persisted.",
    );
  }
}
