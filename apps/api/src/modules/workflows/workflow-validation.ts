import { ApiError } from "../../common/errors/api-error.js";
import { assertUuid } from "../platform/tenant-context.js";
import type {
  CreateWorkflowInput,
  CreateWorkflowRunInput,
  CreateWorkflowTaskInput,
  JsonRecord,
  UpdateWorkflowInput,
  UpdateWorkflowRequest,
  UpdateWorkflowRunInput,
  UpdateWorkflowTaskInput,
  WorkflowRunStatus,
  WorkflowStatus,
  WorkflowStepInput,
  WorkflowStepRunStatus,
  WorkflowStepType,
  WorkflowTaskStatus,
} from "./workflow.types.js";

const workflowStatuses = new Set<WorkflowStatus>(["draft", "active", "archived"]);
const stepTypes = new Set<WorkflowStepType>([
  "agent",
  "tool",
  "knowledge",
  "condition",
  "save",
  "notification",
]);
const runStatuses = new Set<WorkflowRunStatus>([
  "pending",
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
]);
const stepRunStatuses = new Set<WorkflowStepRunStatus>([
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
]);
const taskStatuses = new Set<WorkflowTaskStatus>([
  "pending",
  "assigned",
  "in_progress",
  "blocked",
  "waiting",
  "completed",
  "cancelled",
  "failed",
]);
const secretPattern = /(?:"?(authorization|api[_-]?key|password|secret|token)"?\s*[:=])/i;

export function validateCreateWorkflow(
  organizationId: string,
  userId: string,
  body: unknown,
): CreateWorkflowInput {
  const data = asRecord(body);
  const id = optionalUuid(data.id, "id");
  const workspaceId = requiredUuid(data.workspaceId, "workspaceId");
  const agentId = optionalUuid(data.agentInstanceId ?? data.agentId, "agentId");
  const status = optionalEnum(data.status, workflowStatuses, "status") ?? "draft";
  const configuration = optionalRecord(data.configuration, "configuration");
  rejectSecrets(configuration);
  return {
    id,
    organizationId,
    workspaceId,
    agentId,
    name: requiredText(data.name, "name", 180),
    description: optionalText(data.description, "description", 1000) ?? "",
    status,
    version: optionalText(data.version, "version", 40) ?? "1.0.0",
    configuration,
    createdBy: userId,
  };
}

export function validateUpdateWorkflow(body: unknown): UpdateWorkflowRequest {
  const data = asRecord(body);
  const result: UpdateWorkflowInput = {};
  if ("agentInstanceId" in data || "agentId" in data)
    result.agentId = optionalUuid(data.agentInstanceId ?? data.agentId, "agentId");
  if ("name" in data) result.name = requiredText(data.name, "name", 180);
  if ("description" in data)
    result.description = optionalText(data.description, "description", 1000) ?? "";
  if ("status" in data) result.status = requiredEnum(data.status, workflowStatuses, "status");
  if ("version" in data) result.version = requiredText(data.version, "version", 40);
  if ("configuration" in data) {
    result.configuration = optionalRecord(data.configuration, "configuration");
    rejectSecrets(result.configuration);
  }
  if (!Object.keys(result).length)
    throw new ApiError(400, "VALIDATION_FAILED", "At least one workflow field is required.");
  return {
    ...result,
    expectedRevision: integer(data.expectedRevision, "expectedRevision", 1, 2_147_483_647),
  };
}

export function validateSteps(body: unknown): WorkflowStepInput[] {
  const data = asRecord(body);
  if (!Array.isArray(data.steps) || data.steps.length > 100)
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "steps must be an array with at most 100 entries.",
    );
  const orders = new Set<number>();
  return data.steps.map((value, index) => {
    const step = asRecord(value);
    const order = integer(step.order, `steps[${index}].order`, 0, 9999);
    if (orders.has(order))
      throw new ApiError(400, "VALIDATION_FAILED", "Workflow step order values must be unique.");
    orders.add(order);
    const configuration = optionalRecord(step.configuration, "configuration");
    rejectSecrets(configuration);
    const retry = step.retryPolicy === undefined ? undefined : asRecord(step.retryPolicy);
    return {
      id: optionalUuid(step.id, "stepId"),
      name: requiredText(step.name, "name", 180),
      type: requiredEnum(step.type, stepTypes, "type"),
      order,
      configuration,
      timeoutSeconds:
        step.timeoutSeconds === undefined
          ? undefined
          : integer(step.timeoutSeconds, "timeoutSeconds", 1, 86400),
      retryPolicy: retry
        ? {
            maxAttempts: integer(retry.maxAttempts, "maxAttempts", 1, 20),
            delay: integer(retry.delay, "delay", 0, 86_400_000),
          }
        : undefined,
    };
  });
}

export function readExpectedRevision(body: unknown): number {
  return integer(asRecord(body).expectedRevision, "expectedRevision", 1, 2_147_483_647);
}

export function validateCreateRun(
  organizationId: string,
  userId: string,
  body: unknown,
): CreateWorkflowRunInput {
  const data = asRecord(body);
  const input = optionalRecord(data.input, "input");
  const executionContext = optionalRecord(data.executionContext, "executionContext");
  rejectSecrets(input);
  rejectSecrets(executionContext);
  return {
    id: optionalUuid(data.id, "id"),
    organizationId,
    workflowId: requiredUuid(data.workflowId, "workflowId"),
    requestedBy: userId,
    agentRunId: optionalUuid(data.agentRunId, "agentRunId"),
    input,
    executionContext,
    idempotencyKey: optionalText(data.idempotencyKey, "idempotencyKey", 160),
  };
}

export function validateUpdateRun(body: unknown, reportedBy: string): UpdateWorkflowRunInput {
  const data = asRecord(body);
  const status = requiredEnum(data.status, runStatuses, "status");
  const output = data.output === undefined ? undefined : optionalRecord(data.output, "output");
  const executionContext =
    data.executionContext === undefined
      ? undefined
      : optionalRecord(data.executionContext, "executionContext");
  if (output) rejectSecrets(output);
  if (executionContext) rejectSecrets(executionContext);
  let stepResults: UpdateWorkflowRunInput["stepResults"];
  if (data.stepResults !== undefined) {
    const raw = asRecord(data.stepResults);
    stepResults = {};
    for (const [stepId, value] of Object.entries(raw)) {
      assertUuid(stepId, "stepId");
      const result = asRecord(value);
      const resultStatus = requiredEnum(result.status, stepRunStatuses, "step status");
      const metadata = optionalRecord(result.metadata, "metadata");
      const normalizedData =
        result.data === undefined ? undefined : normalizeJsonValue(result.data, "data");
      rejectSecrets(normalizedData);
      rejectSecrets(metadata);
      stepResults[stepId] = {
        success: Boolean(result.success),
        status: resultStatus,
        data: normalizedData,
        error: optionalText(result.error, "error", 1000),
        metadata,
        startedAt: optionalText(result.startedAt, "startedAt", 64),
        completedAt: optionalText(result.completedAt, "completedAt", 64),
      };
    }
  }
  return {
    status,
    currentStepId:
      data.currentStepId === null ? null : optionalUuid(data.currentStepId, "currentStepId"),
    output,
    error: optionalText(data.error, "error", 1000),
    executionContext,
    stepResults,
    reportedBy,
  };
}

export function validateCreateTask(
  organizationId: string,
  userId: string,
  body: unknown,
): CreateWorkflowTaskInput {
  const data = asRecord(body);
  const input = optionalRecord(data.input, "input");
  const metadata = optionalRecord(data.metadata, "metadata");
  rejectSecrets(input);
  rejectSecrets(metadata);
  return {
    organizationId,
    workflowRunId: requiredUuid(data.workflowRunId, "workflowRunId"),
    workflowStepId: requiredUuid(data.workflowStepId, "workflowStepId"),
    title: requiredText(data.title, "title", 220),
    description: optionalText(data.description, "description", 1000) ?? "",
    type: optionalText(data.type, "type", 80) ?? "manual",
    priority: optionalText(data.priority, "priority", 40) ?? "normal",
    assignedUserId: optionalUuid(data.assignedUserId, "assignedUserId"),
    assignedRole: optionalText(data.assignedRole, "assignedRole", 120),
    assignedAgentId: optionalUuid(data.assignedAgentId, "assignedAgentId"),
    input,
    metadata,
    dueAt: optionalDate(data.dueAt, "dueAt"),
    createdBy: userId,
  };
}

export function validateUpdateTask(body: unknown): UpdateWorkflowTaskInput {
  const data = asRecord(body);
  const output = data.output === undefined ? undefined : optionalRecord(data.output, "output");
  if (output) rejectSecrets(output);
  return {
    status: requiredEnum(data.status, taskStatuses, "status"),
    output,
    assignedUserId:
      data.assignedUserId === null ? null : optionalUuid(data.assignedUserId, "assignedUserId"),
    assignedRole:
      data.assignedRole === null ? null : optionalText(data.assignedRole, "assignedRole", 120),
    assignedAgentId:
      data.assignedAgentId === null ? null : optionalUuid(data.assignedAgentId, "assignedAgentId"),
  };
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "VALIDATION_FAILED", "Request body must be a JSON object.");
  return value as JsonRecord;
}
function optionalRecord(value: unknown, field: string): JsonRecord {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "VALIDATION_FAILED", `${field} must be a JSON object.`);
  return value as JsonRecord;
}
function requiredText(value: unknown, field: string, max: number): string {
  const text = optionalText(value, field, max);
  if (!text) throw new ApiError(400, "VALIDATION_FAILED", `${field} is required.`);
  return text;
}
function optionalText(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.length > max)
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      `${field} must be a string of at most ${max} characters.`,
    );
  return value.trim() || undefined;
}
function requiredUuid(value: unknown, field: string): string {
  const id = requiredText(value, field, 36);
  assertUuid(id, field);
  return id;
}
function optionalUuid(value: unknown, field: string): string | undefined {
  const id = optionalText(value, field, 36);
  if (id) assertUuid(id, field);
  return id;
}
function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max)
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      `${field} must be an integer between ${min} and ${max}.`,
    );
  return value;
}
function requiredEnum<T extends string>(value: unknown, allowed: Set<T>, field: string): T {
  if (typeof value !== "string" || !allowed.has(value as T))
    throw new ApiError(400, "VALIDATION_FAILED", `Unsupported ${field}.`);
  return value as T;
}
function optionalEnum<T extends string>(
  value: unknown,
  allowed: Set<T>,
  field: string,
): T | undefined {
  return value === undefined ? undefined : requiredEnum(value, allowed, field);
}
function optionalDate(value: unknown, field: string): Date | undefined {
  const text = optionalText(value, field, 64);
  if (!text) return undefined;
  const date = new Date(text);
  if (Number.isNaN(date.getTime()))
    throw new ApiError(400, "VALIDATION_FAILED", `${field} must be an ISO date.`);
  return date;
}
function normalizeJsonValue(value: unknown, field: string): unknown {
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    throw new ApiError(400, "VALIDATION_FAILED", `${field} must be JSON serializable.`);
  }
}
function rejectSecrets(value: unknown): void {
  if (secretPattern.test(JSON.stringify(value)))
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "Workflow payload contains secret-like content and cannot be persisted.",
    );
}
