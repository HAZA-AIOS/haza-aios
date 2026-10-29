import { sendJson } from "../../common/http/json.js";
import { ApiError } from "../../common/errors/api-error.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import type {
  AgentAuditEvent,
  AgentConversationRecord,
  AgentDefinitionWithTools,
  AgentMemoryRecord,
  AgentMessageRecord,
  AgentRunRecord,
  AgentTemplateRecord,
} from "./agent.types.js";
import { AgentService } from "./services/agent.service.js";
import { AgentRuntimeService } from "./services/agent-runtime.service.js";
import { AgentMemoryService } from "./services/agent-memory.service.js";
import { AgentBuilderService } from "./services/agent-builder.service.js";
import { validateBuilderConfiguration } from "./validation/agent-builder-validation.js";
import type { AgentBuilderFullConfig } from "./agent.types.js";
import {
  readPagePagination,
  redactSensitiveConfig,
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
import {
  readMemoryQuery,
  validateCreateMemory,
  validateUpdateMemory,
} from "./validation/memory-validation.js";

export const agentsModule: BackendModule = {
  name: "agents",
  register(router) {
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/templates",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const pagination = readPagePagination(url);
        const category = url.searchParams.get("category") ?? undefined;
        const industry = url.searchParams.get("industry") ?? undefined;
        const search = url.searchParams.get("search") ?? undefined;
        const paginated = await new AgentService(database).listTemplatesPaginated({
          category,
          industry,
          search,
          ...pagination,
        });
        sendJson(response, 200, {
          templates: paginated.items.map(toTemplateDto),
          total: paginated.total,
          page: paginated.page,
          pageSize: paginated.pageSize,
          totalPages: paginated.totalPages,
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/providers",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const providers = await new AgentService(database).listProviders();
        sendJson(response, 200, { providers });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const pagination = readPagePagination(url);
        const status = url.searchParams.get("status") ?? undefined;
        const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
        const search = url.searchParams.get("search") ?? undefined;
        const paginated = await new AgentService(database).listAgentsPaginated(
          tenant.organizationId,
          {
            status,
            workspaceId,
            search,
            ...pagination,
          },
        );
        sendJson(response, 200, {
          agents: paginated.items.map(toAgentDto),
          total: paginated.total,
          page: paginated.page,
          pageSize: paginated.pageSize,
          totalPages: paginated.totalPages,
        });
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
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/status",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const validated = validateUpdateAgentStatus(
          tenant.organizationId,
          routeParams.agentId,
          request.body,
        );
        const agent = await new AgentService(database).updateStatus({
          ...validated,
          updatedBy: auth.user.id,
        });
        sendJson(response, 200, { agent: toAgentDto(agent) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/audit-history",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const pagination = readPagePagination(url);
        const result = await new AgentService(database).getAgentAuditHistory(
          tenant.organizationId,
          routeParams.agentId,
          pagination,
        );
        sendJson(response, 200, {
          items: result.items.map(toAuditEventDto),
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        });
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
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/memories",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const memories = await new AgentMemoryService(database).listMemories(
          readMemoryQuery(tenant.organizationId, routeParams.agentId, auth.user.id, url),
        );
        sendJson(response, 200, { memories: memories.map(toMemoryDto) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/memories",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const memory = await new AgentMemoryService(database).createMemory(
          validateCreateMemory(
            tenant.organizationId,
            routeParams.agentId,
            request.body,
            auth.user.id,
          ),
          hasOrganizationPermission(auth, tenant.organizationId, "agent.manage"),
        );
        sendJson(response, 201, { memory: toMemoryDto(memory) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-memories/:memoryId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.memoryId, "memoryId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const memory = await new AgentMemoryService(database).getMemory(
          tenant.organizationId,
          routeParams.memoryId,
          auth.user.id,
          hasOrganizationPermission(auth, tenant.organizationId, "agent.manage"),
        );
        sendJson(response, 200, { memory: toMemoryDto(memory) });
      },
    });

    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/agent-memories/:memoryId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.memoryId, "memoryId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const memory = await new AgentMemoryService(database).updateMemory(
          validateUpdateMemory(
            tenant.organizationId,
            routeParams.memoryId,
            request.body,
            auth.user.id,
          ),
          hasOrganizationPermission(auth, tenant.organizationId, "agent.manage"),
        );
        sendJson(response, 200, { memory: toMemoryDto(memory) });
      },
    });

    router.register({
      method: "DELETE",
      path: "/api/v1/organizations/:organizationId/agent-memories/:memoryId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.memoryId, "memoryId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const memory = await new AgentMemoryService(database).forgetMemory(
          tenant.organizationId,
          routeParams.memoryId,
          auth.user.id,
          hasOrganizationPermission(auth, tenant.organizationId, "agent.manage"),
        );
        sendJson(response, 200, { memory: toMemoryDto(memory) });
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

    /* ───── AI Agent Builder Endpoints (Epic 13) ───── */

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/builder/catalog-options",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const options = await new AgentBuilderService(database).getCatalogOptions(
          tenant.organizationId,
        );
        sendJson(response, 200, { catalogOptions: options });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/builder/new",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const workspaceId = String(body.workspaceId || "").trim();
        assertUuid(workspaceId, "workspaceId");

        const result = await new AgentBuilderService(database).createNewAgent({
          organizationId: tenant.organizationId,
          workspaceId,
          userId: auth.user.id,
          configuration: (body.configuration ?? {}) as AgentBuilderFullConfig,
        });

        if (!result.agent) {
          throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to retrieve created agent.");
        }

        sendJson(response, 201, {
          agent: toAgentDto(result.agent),
          revision: result.revision,
          validation: result.validation,
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const context = await new AgentBuilderService(database).getBuilderContext(
          tenant.organizationId,
          routeParams.agentId,
        );
        sendJson(response, 200, {
          agent: toAgentDto(context.agent),
          activeRevision: context.activeRevision,
          draftRevision: context.draftRevision,
          latestRevision: context.latestRevision,
          totalRevisions: context.totalRevisions,
          catalogOptions: context.catalogOptions,
        });
      },
    });

    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder/draft",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const result = await new AgentBuilderService(database).saveDraft({
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          userId: auth.user.id,
          configuration: (body.configuration ?? {}) as AgentBuilderFullConfig,
          version: typeof body.version === "string" ? body.version : undefined,
          changelog: typeof body.changelog === "string" ? body.changelog : undefined,
        });
        sendJson(response, 200, result);
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder/publish",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const result = await new AgentBuilderService(database).publishRevision({
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          userId: auth.user.id,
          version: typeof body.version === "string" ? body.version : undefined,
          changelog: typeof body.changelog === "string" ? body.changelog : undefined,
          revisionId: typeof body.revisionId === "string" ? body.revisionId : undefined,
        });
        if (!result.agent) {
          throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to retrieve published agent.");
        }
        sendJson(response, 200, {
          revision: result.revision,
          agent: toAgentDto(result.agent),
        });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder/duplicate",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const workspaceId = String(body.workspaceId || "").trim();
        const newName = String(body.newName || "").trim();
        const newAgentKey = String(body.newAgentKey || "").trim();
        assertUuid(workspaceId, "workspaceId");

        const result = await new AgentBuilderService(database).duplicateAgent({
          organizationId: tenant.organizationId,
          workspaceId,
          sourceAgentId: routeParams.agentId,
          userId: auth.user.id,
          newName,
          newAgentKey,
        });

        if (!result.agent) {
          throw new ApiError(500, "INTERNAL_SERVER_ERROR", "Failed to retrieve duplicated agent.");
        }

        sendJson(response, 201, {
          agent: toAgentDto(result.agent),
          revision: result.revision,
        });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder/validate",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const config = body.configuration ?? body;
        const catalog = await new AgentBuilderService(database).getCatalogOptions(
          tenant.organizationId,
        );
        const allowedKnowledgeIds = catalog.knowledgeSources.map((k: { id: string }) => k.id);

        const outcome = validateBuilderConfiguration(config, {
          availableProviders: catalog.providers.map((p) => p.id),
          registeredCapabilities: catalog.capabilities.map((c) => c.key),
          registeredTools: catalog.tools.map((t) => t.toolKey),
          allowedKnowledgeIds,
        });
        sendJson(response, 200, outcome);
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder/revisions",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const pagination = readPagePagination(url);
        const paginated = await new AgentBuilderService(database).listRevisions(
          tenant.organizationId,
          routeParams.agentId,
          pagination,
        );
        sendJson(response, 200, paginated);
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder/revisions/compare",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const baseRevId = url.searchParams.get("baseRevisionId") || "";
        const targetRevId = url.searchParams.get("targetRevisionId") || "";
        assertUuid(baseRevId, "baseRevisionId");
        assertUuid(targetRevId, "targetRevisionId");

        const comparison = await new AgentBuilderService(database).compareRevisions(
          tenant.organizationId,
          routeParams.agentId,
          baseRevId,
          targetRevId,
        );
        sendJson(response, 200, comparison);
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder/revisions/:revisionId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const revision = await new AgentBuilderService(database).getRevision(
          tenant.organizationId,
          routeParams.agentId,
          routeParams.revisionId,
        );
        sendJson(response, 200, { revision });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder/revisions/:revisionId/restore",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const restored = await new AgentBuilderService(database).restoreRevision(
          tenant.organizationId,
          routeParams.agentId,
          routeParams.revisionId,
          auth.user.id,
        );
        sendJson(response, 200, { revision: restored });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/builder/preview",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const testPrompt = String(body.testPrompt || "");
        const configuration = (body.configuration ?? {}) as AgentBuilderFullConfig;

        const previewResult = await new AgentBuilderService(database).executeMockPreview({
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          userId: auth.user.id,
          testPrompt,
          configuration,
        });

        sendJson(response, 200, { preview: previewResult });
      },
    });
  },
};

function toTemplateDto(template: AgentTemplateRecord) {
  return {
    ...template,
    defaultApprovalPolicy: template.defaultApprovalPolicy ?? null,
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
    agentKey: agent.agentKey,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    enabled: agent.enabled,
    instructions: agent.instructions ?? "",
    modelProvider: agent.modelProvider,
    modelSelection: agent.modelSelection,
    humanApprovalPolicy: agent.humanApprovalPolicy ?? null,
    configuration: redactSensitiveConfig({
      ...agent.configuration,
      tools: agent.tools.map((tool) => tool.toolKey),
    }) as Record<string, unknown>,
    tools: agent.tools.map((tool) => ({
      id: tool.id,
      toolKey: tool.toolKey,
      status: tool.status,
    })),
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

function toAuditEventDto(event: AgentAuditEvent) {
  return {
    id: event.id,
    organizationId: event.organizationId,
    workspaceId: event.workspaceId,
    agentId: event.agentId,
    actorUserId: event.actorUserId,
    action: event.action,
    operation: event.operation,
    result: event.result,
    beforeSnapshot: event.beforeSnapshot
      ? (redactSensitiveConfig(event.beforeSnapshot) as Record<string, unknown>)
      : null,
    afterSnapshot: event.afterSnapshot
      ? (redactSensitiveConfig(event.afterSnapshot) as Record<string, unknown>)
      : null,
    changedFields: event.changedFields,
    metadata: event.metadata,
    createdAt: event.createdAt.toISOString(),
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

function toMemoryDto(memory: AgentMemoryRecord) {
  return {
    id: memory.id,
    organizationId: memory.organizationId,
    workspaceId: memory.workspaceId,
    agentInstanceId: memory.agentId,
    userId: memory.userId ?? undefined,
    scope: memory.scope,
    type: memory.type,
    content: memory.content,
    status: memory.status,
    source: memory.source,
    sourceRunId: memory.sourceRunId ?? undefined,
    sourceConversationId: memory.sourceConversationId ?? undefined,
    sourceMessageId: memory.sourceMessageId ?? undefined,
    conversationId: memory.sourceConversationId ?? undefined,
    importance: memory.importance,
    metadata: memory.metadata,
    expiresAt: memory.expiresAt?.toISOString(),
    lastUsedAt: memory.lastUsedAt?.toISOString(),
    usageCount: memory.usageCount,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  };
}

function hasOrganizationPermission(
  auth: { memberships: Array<{ organizationId: string; permissions: string[] }> },
  organizationId: string,
  permission: string,
): boolean {
  return auth.memberships.some(
    (membership) =>
      membership.organizationId === organizationId && membership.permissions.includes(permission),
  );
}

function unwrapPayload(payload: Record<string, unknown>) {
  return Object.keys(payload).length === 1 && Object.prototype.hasOwnProperty.call(payload, "value")
    ? payload.value
    : payload;
}
