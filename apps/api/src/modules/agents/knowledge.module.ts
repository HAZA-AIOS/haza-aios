import { sendJson } from "../../common/http/json.js";
import { ApiError } from "../../common/errors/api-error.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import { KnowledgeService } from "./services/knowledge.service.js";
import { readText } from "./knowledge-validation.js";

const base = "/api/v1/organizations/:organizationId/knowledge";

export const knowledgeModule: BackendModule = {
  name: "knowledge",
  register(router) {
    router.register({
      method: "GET",
      path: base,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "agent.read",
        );
        sendJson(response, 200, {
          sources: await new KnowledgeService(database).list(organizationId, auth.user.id),
        });
      },
    });
    router.register({
      method: "POST",
      path: base,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "agent.manage",
        );
        sendJson(response, 201, {
          source: await new KnowledgeService(database).create(
            organizationId,
            auth.user.id,
            request.body,
          ),
        });
      },
    });
    router.register({
      method: "GET",
      path: `${base}/:sourceId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.sourceId, "sourceId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "agent.read",
        );
        sendJson(response, 200, {
          source: await new KnowledgeService(database).get(
            organizationId,
            routeParams.sourceId,
            auth.user.id,
          ),
        });
      },
    });
    router.register({
      method: "DELETE",
      path: `${base}/:sourceId`,
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.sourceId, "sourceId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "agent.manage",
        );
        await new KnowledgeService(database).archive(
          organizationId,
          routeParams.sourceId,
          auth.user.id,
        );
        sendJson(response, 200, { archived: true });
      },
    });
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/knowledge/search",
      async handler(request, response, { database, routeParams }) {
        const { organizationId } = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          organizationId,
          "agent.read",
        );
        const body = request.body as { query?: unknown; limit?: unknown } | null;
        const query = readText(body?.query, 1000);
        const limit = body?.limit ?? 5;
        if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 20)
          throw new ApiError(400, "VALIDATION_FAILED", "Limit must be between 1 and 20.");
        sendJson(response, 200, {
          results: await new KnowledgeService(database).retrieve(
            organizationId,
            routeParams.agentId,
            auth.user.id,
            query,
            limit,
          ),
        });
      },
    });
  },
};
