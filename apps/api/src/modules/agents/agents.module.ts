import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import type { AgentDefinitionWithTools, AgentTemplateRecord } from "./agent.types.js";
import { AgentService } from "./services/agent.service.js";
import { validateCreateAgent, validateUpdateAgentConfiguration, validateUpdateAgentStatus } from "./validation/agent-validation.js";

export const agentsModule: BackendModule = {
  name: "agents",
  register(router) {
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/templates",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "agent.read");
        const templates = await new AgentService(database).listTemplates();
        sendJson(response, 200, { templates: templates.map(toTemplateDto) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "agent.read");
        const agents = await new AgentService(database).listAgents(tenant.organizationId);
        sendJson(response, 200, { agents: agents.map(toAgentDto) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "agent.read");
        const agent = await new AgentService(database).getAgent(tenant.organizationId, routeParams.agentId);
        sendJson(response, 200, { agent: toAgentDto(agent) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "agent.manage");
        const agent = await new AgentService(database).createAgent(validateCreateAgent(tenant.organizationId, request.body, auth.user.id));
        sendJson(response, 201, { agent: toAgentDto(agent) });
      },
    });

    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/configuration",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "agent.manage");
        const agent = await new AgentService(database).updateConfiguration(validateUpdateAgentConfiguration(tenant.organizationId, routeParams.agentId, request.body, auth.user.id));
        sendJson(response, 200, { agent: toAgentDto(agent) });
      },
    });

    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/status",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(request, tenant.organizationId, "agent.manage");
        const agent = await new AgentService(database).updateStatus(validateUpdateAgentStatus(tenant.organizationId, routeParams.agentId, request.body));
        sendJson(response, 200, { agent: toAgentDto(agent) });
      },
    });
  },
};

function toTemplateDto(template: AgentTemplateRecord) {
  return {
    ...template,
    tools: [],
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function toAgentDto(agent: AgentDefinitionWithTools) {
  return {
    id: agent.id,
    organizationId: agent.organizationId,
    workspaceId: agent.workspaceId,
    agentTemplateId: agent.templateId,
    name: agent.name,
    status: agent.status,
    configuration: {
      ...agent.configuration,
      tools: agent.tools.map((tool) => tool.toolKey),
    },
    enabled: agent.enabled,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}
