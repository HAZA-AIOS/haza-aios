import { ApiError } from "../../common/errors/api-error.js";
import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { createTenantContext } from "../platform/tenant-context.js";
import { MeteringService, type UsageFilter } from "./metering.service.js";

const base = "/api/v1/organizations/:organizationId";

function readFilter(params: URLSearchParams): UsageFilter {
  const limit = params.has("limit") ? Number(params.get("limit")) : 50;
  const offset = params.has("offset") ? Number(params.get("offset")) : 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, "VALIDATION_FAILED", "limit must be between 1 and 100.");
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw new ApiError(400, "VALIDATION_FAILED", "offset is invalid.");
  }
  const meterKey = params.get("meterKey")?.trim() || undefined;
  if (meterKey && !/^[a-z][a-z0-9.]{0,119}$/.test(meterKey)) {
    throw new ApiError(400, "VALIDATION_FAILED", "meterKey is invalid.");
  }
  const from = params.get("from") ? new Date(params.get("from")!) : undefined;
  const to = params.get("to") ? new Date(params.get("to")!) : undefined;
  if (
    (from && Number.isNaN(from.valueOf())) ||
    (to && Number.isNaN(to.valueOf())) ||
    (from && to && from > to)
  ) {
    throw new ApiError(400, "VALIDATION_FAILED", "Date range is invalid.");
  }
  return { limit, offset, meterKey, from, to };
}

export const meteringModule: BackendModule = {
  name: "metering",
  register(router) {
    router.register({
      method: "GET",
      path: `${base}/usage/events`,
      async handler(request, response, { database, routeParams, url }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "usage.read",
        );
        sendJson(
          response,
          200,
          await new MeteringService(database).listUsage(
            organizationId,
            readFilter(url.searchParams),
          ),
        );
      },
    });
    router.register({
      method: "GET",
      path: `${base}/usage/summary`,
      async handler(request, response, { database, routeParams, url }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "usage.read",
        );
        sendJson(response, 200, {
          metrics: await new MeteringService(database).usageSummary(
            organizationId,
            readFilter(url.searchParams),
          ),
        });
      },
    });
    router.register({
      method: "GET",
      path: `${base}/billing/overview`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "billing.read",
        );
        sendJson(
          response,
          200,
          await new MeteringService(database).billingOverview(organizationId),
        );
      },
    });
  },
};
