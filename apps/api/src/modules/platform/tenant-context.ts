import { ApiError } from "../../common/errors/api-error.js";
import type { ApiRequest } from "../../routes/types.js";

export type TenantContext = {
  scope: "tenant";
  organizationId: string;
};

export type PlatformContext = {
  scope: "platform";
};

export type RequestTenantContext = TenantContext | PlatformContext;

export function createTenantContext(organizationId: string): TenantContext {
  assertUuid(organizationId, "organizationId");
  return {
    scope: "tenant",
    organizationId,
  };
}

export function readDevelopmentTenantHeader(request: ApiRequest): TenantContext | null {
  const value = request.headers["x-haza-organization-id"];
  const organizationId = Array.isArray(value) ? value[0] : value;

  if (!organizationId) {
    return null;
  }

  return createTenantContext(organizationId);
}

export function assertUuid(value: string | undefined, field: string): asserts value is string {
  const valid = typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  if (!valid) {
    throw new ApiError(400, "VALIDATION_FAILED", "Request validation failed", [
      { field, message: `${field} must be a valid UUID` },
    ]);
  }
}
