import { ApiError } from "../../common/errors/api-error.js";
import { assertUuid } from "../platform/tenant-context.js";
import type { AuditQuery, EventQuery } from "./operational.types.js";

const auditResults = new Set(["success", "failure", "denied"]);
const severities = new Set(["info", "warning", "error", "critical"]);

export function readAuditQuery(params: URLSearchParams): AuditQuery {
  const query: AuditQuery = { ...readPage(params) };
  query.workspaceId = readUuid(params, "workspaceId");
  query.actorUserId = readUuid(params, "actorUserId");
  query.action = readText(params, "action", 160);
  query.resourceType = readText(params, "resourceType", 120);
  query.resourceId = readText(params, "resourceId", 160);
  const result = readText(params, "result", 20);
  if (result && !auditResults.has(result)) fail("result");
  query.result = result as AuditQuery["result"];
  query.from = readDate(params, "from");
  query.to = readDate(params, "to");
  validateRange(query.from, query.to);
  return query;
}

export function readEventQuery(params: URLSearchParams): EventQuery {
  const query: EventQuery = { ...readPage(params) };
  query.workspaceId = readUuid(params, "workspaceId");
  query.eventType = readText(params, "eventType", 160);
  query.aggregateType = readText(params, "aggregateType", 120);
  query.aggregateId = readText(params, "aggregateId", 160);
  query.component = readText(params, "component", 120);
  query.status = readText(params, "status", 40);
  const severity = readText(params, "severity", 20);
  if (severity && !severities.has(severity)) fail("severity");
  query.severity = severity as EventQuery["severity"];
  query.from = readDate(params, "from");
  query.to = readDate(params, "to");
  validateRange(query.from, query.to);
  return query;
}

export function readNotificationQuery(params: URLSearchParams): {
  limit: number;
  offset: number;
  unreadOnly: boolean;
} {
  const page = readPage(params);
  return { ...page, unreadOnly: params.get("status") === "unread" };
}

export function readPreferenceInput(value: unknown): {
  workspaceId: string;
  preferences: Record<string, unknown>;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("preferences");
  const input = value as Record<string, unknown>;
  const workspaceId = typeof input.workspaceId === "string" ? input.workspaceId : "";
  assertUuid(workspaceId, "workspaceId");
  const preferences = input.preferences;
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) {
    fail("preferences");
  }
  return { workspaceId, preferences: preferences as Record<string, unknown> };
}

function readPage(params: URLSearchParams): { limit: number; offset: number } {
  const limit = readInteger(params.get("limit"), 50, 1, 100, "limit");
  const offset = readInteger(params.get("offset"), 0, 0, 1_000_000, "offset");
  return { limit, offset };
}

function readInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
  field: string,
) {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) fail(field);
  return parsed;
}

function readUuid(params: URLSearchParams, field: string): string | undefined {
  const value = params.get(field) ?? undefined;
  if (value) assertUuid(value, field);
  return value;
}

function readText(params: URLSearchParams, field: string, maximum: number): string | undefined {
  const value = params.get(field)?.trim();
  if (!value) return undefined;
  if (value.length > maximum) fail(field);
  return value;
}

function readDate(params: URLSearchParams, field: string): Date | undefined {
  const value = params.get(field);
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) fail(field);
  return date;
}

function validateRange(from?: Date, to?: Date): void {
  if (from && to && from > to) fail("from");
}

function fail(field: string): never {
  throw new ApiError(400, "VALIDATION_FAILED", "Request validation failed", [
    { field, message: `${field} is invalid` },
  ]);
}
