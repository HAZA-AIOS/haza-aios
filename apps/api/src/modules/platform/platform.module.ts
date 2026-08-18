import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "./tenant-context.js";
import { OrganizationModuleService } from "./services/organization-module.service.js";
import { OrganizationService } from "./services/organization.service.js";
import { WorkspaceService } from "./services/workspace.service.js";
import { validateCreateOrganization, validateCreateWorkspace, validateEnableModule, validateUpdateOrganization, validateUpdateWorkspace } from "./validation/platform-validation.js";

export const platformModule: BackendModule = {
  name: "platform",
  register(router) {
    router.register({
      method: "GET",
      path: "/api/v1/organizations",
      async handler(request, response, { database }) {
        const auth = await new AuthService(database).authenticateRequest(request);
        const service = new OrganizationService(database);
        const organizations = await Promise.all(auth.memberships.map((membership) => service.getOrganization(membership.organizationId)));
        sendJson(response, 200, { organizations });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations",
      async handler(request, response, { database }) {
        const authService = new AuthService(database);
        const auth = await authService.authenticateRequest(request);
        const input = validateCreateOrganization(request.body);
        const result = await authService.createOrganizationForUser(auth.user, input);
        const settings = await new OrganizationService(database).getSettings(result.organization.id);
        sendJson(response, 201, { organization: result.organization, settings });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "organization.read");
        const organization = await new OrganizationService(database).getOrganization(tenant.organizationId);
        sendJson(response, 200, { organization });
      },
    });

    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "organization.manage");
        const organization = await new OrganizationService(database).updateOrganization(tenant.organizationId, validateUpdateOrganization(request.body));
        sendJson(response, 200, { organization });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/settings",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "organization.read");
        const settings = await new OrganizationService(database).getSettings(tenant.organizationId);
        sendJson(response, 200, { settings });
      },
    });

    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/settings",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "organization.manage");
        const input = validateUpdateOrganization(request.body);
        const settings = await new OrganizationService(database).updateSettings(tenant.organizationId, {
          timezone: input.timezone,
          currency: input.currency,
        });
        sendJson(response, 200, { settings });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "workspace.read");
        const workspaces = await new WorkspaceService(database).listWorkspaces(tenant.organizationId);
        sendJson(response, 200, { workspaces });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/workspaces",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "workspace.manage");
        const workspace = await new WorkspaceService(database).createWorkspace(validateCreateWorkspace(tenant.organizationId, request.body));
        sendJson(response, 201, { workspace });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "workspace.read");
        const workspace = await new WorkspaceService(database).getWorkspace(tenant.organizationId, routeParams.workspaceId);
        sendJson(response, 200, { workspace });
      },
    });

    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "workspace.manage");
        const workspace = await new WorkspaceService(database).updateWorkspace(tenant.organizationId, routeParams.workspaceId, validateUpdateWorkspace(request.body));
        sendJson(response, 200, { workspace });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/modules",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "module.read");
        const modules = await new OrganizationModuleService(database).listModules(tenant.organizationId);
        sendJson(response, 200, { modules });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/modules",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "module.manage");
        const module = await new OrganizationModuleService(database).enableModule({
          ...validateEnableModule(tenant.organizationId, request.body),
          activatedBy: auth.user.id,
        });
        sendJson(response, 201, { module });
      },
    });

    router.register({
      method: "DELETE",
      path: "/api/v1/organizations/:organizationId/modules/:moduleKey",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "module.manage");
        const module = await new OrganizationModuleService(database).disableModule(tenant.organizationId, routeParams.moduleKey);
        sendJson(response, 200, { module });
      },
    });
  },
};
