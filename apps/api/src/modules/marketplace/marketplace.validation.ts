import { ApiError } from "../../common/errors/api-error.js";
import { assertUuid } from "../platform/tenant-context.js";
import type {
  MarketplaceInstallInput,
  MarketplaceReviewDecisionInput,
  MarketplaceUpgradeInput,
  PublishingStatus,
} from "./marketplace.types.js";
import type { JsonRecord } from "../agents/agent.types.js";
import {
  validateHumanApprovalPolicy,
} from "../agents/validation/agent-validation.js";

const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/;

export function assertSemver(version: string, fieldName = "version"): void {
  if (!version || typeof version !== "string" || !SEMVER_REGEX.test(version.trim())) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      `Invalid semantic version for '${fieldName}': '${version}'. Expected format: X.Y.Z (e.g. 1.0.0).`,
    );
  }
}

export function validateInstallAgent(
  organizationId: string,
  body: unknown,
  userId: string,
): MarketplaceInstallInput {
  assertUuid(organizationId, "organizationId");
  const data = asRecord(body);
  const workspaceId = readRequiredString(data, "workspaceId", 36);
  const templateId = readRequiredString(data, "templateId", 36);
  assertUuid(workspaceId, "workspaceId");
  assertUuid(templateId, "templateId");

  const version = readOptionalString(data, "version", 80);
  if (version) {
    assertSemver(version, "version");
  }

  const humanApprovalPolicy = validateHumanApprovalPolicy(data.humanApprovalPolicy);

  return {
    organizationId,
    workspaceId,
    templateId,
    version,
    name: readOptionalString(data, "name", 180),
    description: readOptionalString(data, "description", 500),
    instructions: readOptionalString(data, "instructions", 20_000),
    configuration: data.configuration !== undefined ? asRecord(data.configuration) : undefined,
    modelProvider: readOptionalString(data, "modelProvider", 80),
    modelSelection: readOptionalString(data, "modelSelection", 80),
    humanApprovalPolicy,
    installedBy: userId,
  };
}

export function validateUpgradeAgent(
  organizationId: string,
  agentId: string,
  body: unknown,
  userId: string,
): MarketplaceUpgradeInput {
  assertUuid(organizationId, "organizationId");
  assertUuid(agentId, "agentId");
  const data = asRecord(body);
  const targetVersion = readRequiredString(data, "targetVersion", 80);
  assertSemver(targetVersion, "targetVersion");

  return {
    organizationId,
    agentId,
    targetVersion,
    updatedBy: userId,
  };
}

export function validateReviewDecision(
  body: unknown,
  userId: string,
): MarketplaceReviewDecisionInput {
  const data = asRecord(body);
  const decision = readRequiredString(data, "decision", 40) as MarketplaceReviewDecisionInput["decision"];
  const allowedDecisions = new Set([
    "under_review",
    "approved",
    "rejected",
    "published",
    "deprecated",
    "withdrawn",
  ]);

  if (!allowedDecisions.has(decision)) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      `Invalid review decision '${decision}'. Allowed: ${Array.from(allowedDecisions).join(", ")}.`,
    );
  }

  const reviewNotes = readOptionalString(data, "reviewNotes", 4000);
  if (decision === "rejected" && (!reviewNotes || !reviewNotes.trim())) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "Rejection requires providing detailed reviewNotes explaining why the agent was not approved.",
    );
  }

  return {
    decision,
    reviewNotes,
    reviewerUserId: userId,
  };
}

export function validateCreatePublisherTemplate(
  organizationId: string,
  body: unknown,
  userId: string,
) {
  assertUuid(organizationId, "organizationId");
  const data = asRecord(body);

  const name = readRequiredString(data, "name", 180);
  const slug = readRequiredString(data, "slug", 140).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const description = readRequiredString(data, "description", 1000);
  const summary = readOptionalString(data, "summary", 300);
  const category = readRequiredString(data, "category", 80);
  const industry = readRequiredString(data, "industry", 80);
  const version = readRequiredString(data, "version", 80);
  assertSemver(version, "version");
  const icon = readOptionalString(data, "icon", 80) ?? "🤖";
  const visibility = (readOptionalString(data, "visibility", 40) ?? "platform") as "platform" | "private_organization" | "approved_shared";

  const capabilities = Array.isArray(data.capabilities) ? data.capabilities : [];
  const requiredPermissions = Array.isArray(data.requiredPermissions) ? data.requiredPermissions : [];
  const configurationSchema = data.configurationSchema !== undefined ? asRecord(data.configurationSchema) : { type: "object", properties: {} };
  const inputSchema = data.inputSchema !== undefined ? asRecord(data.inputSchema) : { type: "object", properties: {} };
  const outputSchema = data.outputSchema !== undefined ? asRecord(data.outputSchema) : { type: "object", properties: {} };
  const defaultApprovalPolicy = validateHumanApprovalPolicy(data.defaultApprovalPolicy);

  return {
    name,
    slug,
    description,
    summary,
    category,
    industry,
    version,
    icon,
    visibility,
    capabilities,
    requiredPermissions,
    configurationSchema,
    inputSchema,
    outputSchema,
    defaultApprovalPolicy,
    status: "draft" as const,
    metadata: {},
    latestVersion: version,
    publisherType: "organization" as const,
    publisherOrganizationId: organizationId,
    publisherUserId: userId,
    publishingStatus: "draft" as PublishingStatus,
  };
}

export function validateCreateTemplateVersion(
  templateId: string,
  body: unknown,
  _userId?: string,
) {
  assertUuid(templateId, "templateId");
  const data = asRecord(body);

  const version = readRequiredString(data, "version", 80);
  assertSemver(version, "version");

  const name = readRequiredString(data, "name", 180);
  const description = readRequiredString(data, "description", 1000);
  const instructions = readOptionalString(data, "instructions", 20_000);
  const changelog = readOptionalString(data, "changelog", 4000);

  const capabilities = Array.isArray(data.capabilities) ? data.capabilities : [];
  const requiredPermissions = Array.isArray(data.requiredPermissions) ? data.requiredPermissions : [];
  const configurationSchema = data.configurationSchema !== undefined ? asRecord(data.configurationSchema) : { type: "object", properties: {} };
  const inputSchema = data.inputSchema !== undefined ? asRecord(data.inputSchema) : { type: "object", properties: {} };
  const outputSchema = data.outputSchema !== undefined ? asRecord(data.outputSchema) : { type: "object", properties: {} };
  const defaultApprovalPolicy = validateHumanApprovalPolicy(data.defaultApprovalPolicy);

  return {
    templateId,
    version,
    name,
    description,
    instructions: instructions ?? null,
    capabilities,
    requiredPermissions,
    configurationSchema,
    inputSchema,
    outputSchema,
    defaultApprovalPolicy,
    changelog: changelog ?? null,
    status: "draft" as PublishingStatus,
  };
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
  return value.trim();
}
