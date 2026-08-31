import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import type {
  AgentConversationRecord,
  AgentDefinitionWithTools,
  AgentMessageRecord,
  AgentRunRecord,
  AgentTemplateRecord,
} from "./agent.types.js";
import { AgentService } from "./services/agent.service.js";
import { AgentRuntimeService } from "./services/agent-runtime.service.js";
import {
  validateCreateAgent,
  validateUpdateAgentConfiguration,
  validateUpdateAgentStatus,
} from "./validation/agent-validation.js";
import {
  readPagination,
  validateCreateConversation,
  validateCreateMessage,
  validateCreateRun,
  validateUpdateRun,
} from "./validation/runtime-validation.js";

export const agentsModule: BackendModule = {
  name: "agents",
  register(router) {
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/templates",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const templates = await new AgentService(database).listTemplates();
        sendJson(response, 200, { templates: templates.map(toTemplateDto) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
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
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const agent = await new AgentService(database).getAgent(
          tenant.organizationId,
          routeParams.agentId,
        );
        sendJson(response, 200, { agent: toAgentDto(agent) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const agent = await new AgentService(database).createAgent(
          validateCreateAgent(tenant.organizationId, request.body, auth.user.id),
        );
        sendJson(response, 201, { agent: toAgentDto(agent) });
      },
    });

    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/configuration",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const agent = await new AgentService(database).updateConfiguration(
          validateUpdateAgentConfiguration(
            tenant.organizationId,
            routeParams.agentId,
            request.body,
            auth.user.id,
          ),
        );
        sendJson(response, 200, { agent: toAgentDto(agent) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/runs",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const runs = await new AgentRuntimeService(database).listRuns(
          tenant.organizationId,
          routeParams.agentId,
          auth.user.id,
          readPagination(url),
        );
        sendJson(response, 200, { runs: runs.map(toRunDto) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/runs",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const result = await new AgentRuntimeService(database).createRun(
          validateCreateRun(tenant.organizationId, routeParams.agentId, request.body, auth.user.id),
        );
        sendJson(response, 201, {
          run: toRunDto(result.run),
          conversation: toConversationDto(result.conversation),
          userMessage: toMessageDto(result.userMessage),
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-runs/:runId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const run = await new AgentRuntimeService(database).getRun(
          tenant.organizationId,
          routeParams.runId,
          auth.user.id,
        );
        sendJson(response, 200, { run: toRunDto(run) });
      },
    });

    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/agent-runs/:runId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const run = await new AgentRuntimeService(database).updateRun(
          validateUpdateRun(tenant.organizationId, routeParams.runId, request.body, auth.user.id),
        );
        sendJson(response, 200, { run: toRunDto(run) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-conversations",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const agentId = url.searchParams.get("agentId") ?? undefined;
        if (agentId) assertUuid(agentId, "agentId");
        const conversations = await new AgentRuntimeService(database).listConversations(
          tenant.organizationId,
          auth.user.id,
          readPagination(url),
          agentId,
        );
        sendJson(response, 200, { conversations: conversations.map(toConversationDto) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-conversations",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const conversation = await new AgentRuntimeService(database).createConversation(
          validateCreateConversation(tenant.organizationId, request.body, auth.user.id),
        );
        sendJson(response, 201, { conversation: toConversationDto(conversation) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-conversations/:conversationId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.conversationId, "conversationId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const conversation = await new AgentRuntimeService(database).getConversation(
          tenant.organizationId,
          routeParams.conversationId,
          auth.user.id,
        );
        sendJson(response, 200, { conversation: toConversationDto(conversation) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-conversations/:conversationId/messages",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.conversationId, "conversationId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const messages = await new AgentRuntimeService(database).listMessages(
          tenant.organizationId,
          routeParams.conversationId,
          auth.user.id,
          readPagination(url),
        );
        sendJson(response, 200, { messages: messages.map(toMessageDto) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-conversations/:conversationId/messages",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.conversationId, "conversationId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const message = await new AgentRuntimeService(database).createMessage(
          validateCreateMessage(
            tenant.organizationId,
            routeParams.conversationId,
            request.body,
            auth.user.id,
          ),
        );
        sendJson(response, 201, { message: toMessageDto(message) });
      },
    });
    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/status",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const agent = await new AgentService(database).updateStatus(
          validateUpdateAgentStatus(tenant.organizationId, routeParams.agentId, request.body),
        );
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

function toRunDto(run: AgentRunRecord) {
  return {
    id: run.id,
    organizationId: run.organizationId,
    workspaceId: run.workspaceId,
    agentInstanceId: run.agentId,
    conversationId: run.conversationId,
    status: run.status,
    executionMode: run.executionMode,
    input: unwrapPayload(run.input),
    output: run.output ? unwrapPayload(run.output) : undefined,
    error: run.safeErrorMessage ?? undefined,
    errorCode: run.errorCode ?? undefined,
    provider: run.provider,
    model: run.model,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    duration: run.durationMs ?? undefined,
    requestedBy: run.requestedBy,
    metadata: run.metadata,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function toConversationDto(conversation: AgentConversationRecord) {
  return {
    id: conversation.id,
    organizationId: conversation.organizationId,
    workspaceId: conversation.workspaceId,
    userId: conversation.userId,
    agentInstanceId: conversation.agentId,
    title: conversation.title,
    status: conversation.status,
    lastMessageAt: conversation.lastMessageAt?.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function toMessageDto(message: AgentMessageRecord) {
  return {
    id: message.id,
    organizationId: message.organizationId,
    workspaceId: message.workspaceId,
    conversationId: message.conversationId,
    agentRunId: message.agentRunId,
    role: message.role,
    sequence: message.sequence,
    content: message.content,
    metadata: message.metadata ?? undefined,
    createdAt: message.createdAt.toISOString(),
  };
}

function unwrapPayload(payload: Record<string, unknown>) {
  return Object.keys(payload).length === 1 && Object.prototype.hasOwnProperty.call(payload, "value")
    ? payload.value
    : payload;
}
