import { sendJson } from "../../common/http/json.js";
import { ApiError } from "../../common/errors/api-error.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import { readPagePagination } from "../agents/validation/agent-validation.js";
import { MarketplaceService } from "./marketplace.service.js";
import {
  validateCreatePublisherTemplate,
  validateCreateTemplateVersion,
  validateInstallAgent,
  validateReviewDecision,
  validateUpgradeAgent,
} from "./marketplace.validation.js";
import type { IncomingMessage } from "node:http";
import type { AuthContext } from "../auth/auth.types.js";

async function requirePlatformAdmin(
  authService: AuthService,
  request: IncomingMessage,
): Promise<AuthContext> {
  const auth = await authService.authenticateRequest(request);
  if (!auth.platformPermissions.includes("platform.admin")) {
    throw new ApiError(403, "FORBIDDEN", "Platform administrator permission required.");
  }
  return auth;
}

export const marketplaceModule: BackendModule = {
  name: "marketplace",
  register(router) {
    // 1. Marketplace catalog discovery
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/marketplace/catalog",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const pagination = readPagePagination(url);
        const search = url.searchParams.get("search") ?? undefined;
        const category = url.searchParams.get("category") ?? undefined;
        const industry = url.searchParams.get("industry") ?? undefined;
        const publisher = (url.searchParams.get("publisher") as any) ?? undefined;
        const visibility = (url.searchParams.get("visibility") as any) ?? undefined;

        const paginated = await new MarketplaceService(database).listCatalog(
          tenant.organizationId,
          {
            search,
            category,
            industry,
            publisher,
            visibility,
            ...pagination,
          },
        );

        sendJson(response, 200, paginated);
      },
    });

    // 2. Agent profile
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/marketplace/agents/:templateId",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        assertUuid(routeParams.templateId, "templateId");
        const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
        if (workspaceId) {
          assertUuid(workspaceId, "workspaceId");
        }

        const profile = await new MarketplaceService(database).getAgentProfile(
          routeParams.templateId,
          tenant.organizationId,
          workspaceId,
        );

        sendJson(response, 200, { profile });
      },
    });

    // 3. Agent versions list
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/marketplace/agents/:templateId/versions",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        assertUuid(routeParams.templateId, "templateId");
        const versions = await new MarketplaceService(database).listVersions(
          routeParams.templateId,
        );

        sendJson(response, 200, { versions });
      },
    });

    // 4. Agent specific version details
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/marketplace/agents/:templateId/versions/:version",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        assertUuid(routeParams.templateId, "templateId");
        const versionRecord = await new MarketplaceService(database).getVersion(
          routeParams.templateId,
          routeParams.version,
        );

        sendJson(response, 200, { version: versionRecord });
      },
    });

    // 5. Install agent
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/marketplace/install",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );

        const input = validateInstallAgent(
          tenant.organizationId,
          request.body,
          auth.user.id,
        );

        const agent = await new MarketplaceService(database).installAgent(input);
        sendJson(response, 201, { agent });
      },
    });

    // 6. List installed agents
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/marketplace/installed",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
        if (workspaceId) {
          assertUuid(workspaceId, "workspaceId");
        }

        const installedAgents = await new MarketplaceService(database).listInstalledAgents(
          tenant.organizationId,
          workspaceId,
        );

        sendJson(response, 200, { installedAgents });
      },
    });

    // 7. Upgrade installed agent
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/marketplace/installed/:agentId/upgrade",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );

        const input = validateUpgradeAgent(
          tenant.organizationId,
          routeParams.agentId,
          request.body,
          auth.user.id,
        );

        const upgraded = await new MarketplaceService(database).upgradeAgent(input);
        sendJson(response, 200, { agent: upgraded });
      },
    });

    // 8. Uninstall agent
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/marketplace/installed/:agentId/uninstall",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );

        assertUuid(routeParams.agentId, "agentId");
        const body = (request.body && typeof request.body === "object") ? (request.body as Record<string, unknown>) : {};
        const reason = typeof body.reason === "string" ? body.reason : undefined;

        await new MarketplaceService(database).uninstallAgent({
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          userId: auth.user.id,
          reason,
        });

        sendJson(response, 200, { success: true });
      },
    });

    // 9. Publisher: list authored templates
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/marketplace/publisher/templates",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );

        const templates = await new MarketplaceService(
          database,
        ).listOrganizationAuthoredTemplates(tenant.organizationId);

        sendJson(response, 200, { templates });
      },
    });

    // 10. Publisher: create authored template
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/marketplace/publisher/templates",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );

        const input = validateCreatePublisherTemplate(
          tenant.organizationId,
          request.body,
          auth.user.id,
        );

        const created = await new MarketplaceService(database).createPublisherTemplate(input);
        sendJson(response, 201, { template: created });
      },
    });

    // 11. Publisher: create template version
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/marketplace/publisher/templates/:templateId/versions",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );

        const input = validateCreateTemplateVersion(
          routeParams.templateId,
          request.body,
          auth.user.id,
        );

        const created = await new MarketplaceService(database).createTemplateVersion(input);
        sendJson(response, 201, { version: created });
      },
    });

    // 12. Publisher: submit template for review
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/marketplace/publisher/templates/:templateId/submit",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );

        assertUuid(routeParams.templateId, "templateId");
        await new MarketplaceService(database).submitTemplateForReview(
          routeParams.templateId,
          tenant.organizationId,
          auth.user.id,
        );

        sendJson(response, 200, { success: true });
      },
    });

    // 13. Platform Admin: list pending submissions for review
    router.register({
      method: "GET",
      path: "/api/v1/platform/marketplace/reviews",
      async handler(request, response, { database }) {
        const authService = new AuthService(database);
        await requirePlatformAdmin(authService, request);

        const submissions = await new MarketplaceService(database).listPendingSubmissions();
        sendJson(response, 200, { submissions });
      },
    });

    // 14. Platform Admin: review decision (approve, reject, publish, deprecate, withdraw)
    router.register({
      method: "POST",
      path: "/api/v1/platform/marketplace/reviews/:templateId/decision",
      async handler(request, response, { database, routeParams }) {
        const authService = new AuthService(database);
        const auth = await requirePlatformAdmin(authService, request);

        assertUuid(routeParams.templateId, "templateId");
        const decisionInput = validateReviewDecision(request.body, auth.user.id);

        await new MarketplaceService(database).reviewDecision(
          routeParams.templateId,
          decisionInput,
        );

        sendJson(response, 200, { success: true });
      },
    });

    // 15. Organization Analytics
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/marketplace/analytics",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const analytics = await new MarketplaceService(database).getAnalytics(
          tenant.organizationId,
        );

        sendJson(response, 200, { analytics });
      },
    });

    // 16. Platform-wide Analytics
    router.register({
      method: "GET",
      path: "/api/v1/platform/marketplace/analytics",
      async handler(request, response, { database }) {
        const authService = new AuthService(database);
        await requirePlatformAdmin(authService, request);

        const analytics = await new MarketplaceService(database).getAnalytics();
        sendJson(response, 200, { analytics });
      },
    });
  },
};
