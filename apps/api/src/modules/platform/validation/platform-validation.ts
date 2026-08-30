import { ApiError } from "../../../common/errors/api-error.js";
import type { CreateOrganizationInput, CreateWorkspaceInput, EnableModuleInput, UpdateModuleConfigurationInput, UpdateOrganizationInput, UpdateWorkspaceInput } from "../platform.types.js";

const organizationStatuses = new Set(["active", "suspended", "archived"]);
const workspaceStatuses = new Set(["active", "archived"]);
const workspaceTypes = new Set(["primary", "general", "industry"]);

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function validateCreateOrganization(body: unknown): CreateOrganizationInput {
  const input = asRecord(body);
  const name = requiredString(input.name, "name");
  const ownerId = requiredString(input.ownerId, "ownerId");
  const organization: CreateOrganizationInput = {
    name,
    legalName: optionalString(input.legalName, "legalName") ?? name,
    slug: optionalSlug(input.slug) ?? generateSlug(name),
    description: optionalString(input.description, "description"),
    industry: requiredString(input.industry, "industry"),
    organizationType: requiredString(input.organizationType, "organizationType"),
    website: optionalString(input.website, "website"),
    email: requiredString(input.email, "email"),
    phone: optionalString(input.phone, "phone"),
    country: requiredString(input.country, "country"),
    timezone: optionalString(input.timezone, "timezone") ?? "UTC",
    currency: normalizeCurrency(optionalString(input.currency, "currency") ?? "USD"),
    ownerId,
    workspaceName: optionalString(input.workspaceName, "workspaceName"),
    workspaceCode: optionalSlug(input.workspaceCode),
  };

  if (!organization.slug) {
    throw issue("slug", "slug could not be generated");
  }

  return organization;
}

export function validateUpdateOrganization(body: unknown): UpdateOrganizationInput {
  const input = asRecord(body);
  const update: UpdateOrganizationInput = {};

  for (const key of ["name", "legalName", "description", "industry", "organizationType", "website", "email", "phone", "country", "timezone"] as const) {
    if (input[key] !== undefined) {
      update[key] = optionalString(input[key], key);
    }
  }

  if (input.currency !== undefined) {
    update.currency = normalizeCurrency(requiredString(input.currency, "currency"));
  }

  if (input.status !== undefined) {
    const status = requiredString(input.status, "status");
    if (!organizationStatuses.has(status)) {
      throw issue("status", "status must be active, suspended, or archived");
    }
    update.status = status as UpdateOrganizationInput["status"];
  }

  return update;
}

export function validateCreateWorkspace(organizationId: string, body: unknown): CreateWorkspaceInput {
  const input = asRecord(body);
  const name = requiredString(input.name, "name");
  const type = optionalString(input.type, "type") ?? "primary";

  if (!workspaceTypes.has(type)) {
    throw issue("type", "type must be primary, general, or industry");
  }

  return {
    organizationId,
    name,
    code: optionalSlug(input.code) ?? generateSlug(name),
    type: type as CreateWorkspaceInput["type"],
  };
}

export function validateUpdateWorkspace(body: unknown): UpdateWorkspaceInput {
  const input = asRecord(body);
  const update: UpdateWorkspaceInput = {};

  if (input.name !== undefined) update.name = requiredString(input.name, "name");
  if (input.code !== undefined) update.code = optionalSlug(input.code);
  if (input.type !== undefined) {
    const type = requiredString(input.type, "type");
    if (!workspaceTypes.has(type)) throw issue("type", "type must be primary, general, or industry");
    update.type = type as UpdateWorkspaceInput["type"];
  }
  if (input.status !== undefined) {
    const status = requiredString(input.status, "status");
    if (!workspaceStatuses.has(status)) throw issue("status", "status must be active or archived");
    update.status = status as UpdateWorkspaceInput["status"];
  }

  return update;
}

export function validateEnableModule(organizationId: string, body: unknown): EnableModuleInput {
  const input = asRecord(body);
  const settings = input.settings === undefined ? undefined : asRecord(input.settings);

  return {
    organizationId,
    moduleKey: requiredString(input.moduleKey, "moduleKey"),
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    settings,
    activatedBy: optionalString(input.activatedBy, "activatedBy"),
  };
}

export function validateUpdateModuleConfiguration(organizationId: string, moduleKey: string, body: unknown): UpdateModuleConfigurationInput {
  const input = asRecord(body);
  const settings = asRecord(input.settings);

  for (const [key, value] of Object.entries(settings)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(key)) {
      throw issue("settings", "settings keys may contain only letters, numbers, dots, underscores, and hyphens");
    }
    if (!isJsonSafe(value)) {
      throw issue("settings", "settings must contain JSON-safe values only");
    }
  }

  return {
    organizationId,
    moduleKey,
    settings,
    activatedBy: optionalString(input.activatedBy, "activatedBy"),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw issue("body", "body must be a JSON object");
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw issue(field, `${field} is required`);
  }

  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim().length === 0) return undefined;
  return requiredString(value, field);
}

function optionalSlug(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const slug = requiredString(value, "slug").toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw issue("slug", "slug must contain lowercase letters, numbers, and hyphens");
  }
  return slug;
}

function normalizeCurrency(value: string): string {
  const currency = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw issue("currency", "currency must be a 3-letter ISO currency code");
  }
  return currency;
}

function isJsonSafe(value: unknown): boolean {
  if (value === null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonSafe);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isJsonSafe);
  return false;
}

function issue(field: string, message: string): ApiError {
  return new ApiError(400, "VALIDATION_FAILED", "Request validation failed", [{ field, message }]);
}
