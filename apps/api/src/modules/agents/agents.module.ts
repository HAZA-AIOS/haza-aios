import { sendJson } from "../../common/http/json.js";
import { ApiError } from "../../common/errors/api-error.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import type {
  AgentApprovalRequestRecord,
  AgentApprovalStatus,
  AgentAuditEvent,
  AgentConversationRecord,
  AgentDefinitionWithTools,
  AgentMemoryRecord,
  AgentMessageRecord,
  AgentRunAttemptRecord,
  AgentRunEventRecord,
  AgentRunRecord,
  AgentRunStatus,
  AgentRuntimeUsageRecord,
  AgentTemplateRecord,
} from "./agent.types.js";
import { AgentService } from "./services/agent.service.js";
import { AgentRuntimeService } from "./services/agent-runtime.service.js";
import { validateAcademicPlanningInput } from "./validation/academic-planning-validation.js";
import { ACADEMIC_PLANNING_AGENT_TEMPLATE } from "./academic-planning.types.js";
import { AiProviderRegistry } from "./providers/provider-registry.js";
import type { AcademicLessonPlanRecord, LessonPlanStatus } from "./academic-planning.types.js";
import { AgentToolRepository } from "./repositories/agent-tool.repository.js";
import { AgentToolGatewayService } from "./tools/agent-tool-gateway.service.js";
import { listTrustedTools } from "./tools/trusted-tool-registry.js";
import { createRepositoryContext } from "../../database/repositories/repository-context.js";
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

    /* â”€â”€â”€â”€â”€ AI Agent Builder Endpoints (Epic 13) â”€â”€â”€â”€â”€ */

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

    // --- Epic 14: AI Agent Runtime & Execution Engine Endpoints ---

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/runs",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const validated = validateCreateRun(
          tenant.organizationId,
          routeParams.agentId,
          request.body,
          auth.user.id,
        );
        const service = new AgentRuntimeService(database);
        const created = await service.createRun(validated);

        const autoExecute = url.searchParams.get("autoExecute") === "true";
        if (autoExecute) {
          await service.claimAndExecute("inline-worker", tenant.organizationId);
        }

        const latest = await service.getRun(tenant.organizationId, created.run.id, auth.user.id);
        sendJson(response, 201, {
          run: toRunDto(latest),
          conversation: toConversationDto(created.conversation),
          userMessage: toMessageDto(created.userMessage),
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/runs",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const pagination = readPagination(url);
        const statusParam = url.searchParams.get("status") as AgentRunStatus | null;
        const runs = await new AgentRuntimeService(database).listRuns(
          tenant.organizationId,
          routeParams.agentId,
          undefined,
          pagination,
          statusParam ?? undefined,
        );
        sendJson(response, 200, { runs: runs.map(toRunDto) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/runs/:runId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const run = await new AgentRuntimeService(database).getRun(
          tenant.organizationId,
          routeParams.runId,
        );
        sendJson(response, 200, { run: toRunDto(run) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/runs/:runId/cancel",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const reason = typeof body.reason === "string" ? body.reason : undefined;
        const run = await new AgentRuntimeService(database).cancelRun(
          tenant.organizationId,
          routeParams.runId,
          auth.user.id,
          reason,
        );
        sendJson(response, 200, { run: toRunDto(run) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/runs/:runId/retry",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const service = new AgentRuntimeService(database);
        await service.retryRun(tenant.organizationId, routeParams.runId, auth.user.id);
        await service.claimAndExecute("inline-worker", tenant.organizationId);
        const latest = await service.getRun(tenant.organizationId, routeParams.runId);
        sendJson(response, 200, { run: toRunDto(latest) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/runs/:runId/events",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const events = await new AgentRuntimeService(database).listRunEvents(
          tenant.organizationId,
          routeParams.runId,
        );
        sendJson(response, 200, { events: events.map(toEventDto) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/runs/:runId/attempts",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const attempts = await new AgentRuntimeService(database).listRunAttempts(
          tenant.organizationId,
          routeParams.runId,
        );
        sendJson(response, 200, { attempts: attempts.map(toAttemptDto) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/runs/:runId/usage",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const usage = await new AgentRuntimeService(database).getRunUsage(
          tenant.organizationId,
          routeParams.runId,
        );
        sendJson(response, 200, { usage: usage.map(toUsageDto) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/approvals",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const statusParam = url.searchParams.get("status") as AgentApprovalStatus | null;
        const pagination = readPagination(url);
        const approvals = await new AgentRuntimeService(database).listApprovalRequests(
          tenant.organizationId,
          statusParam ?? undefined,
          pagination,
        );
        sendJson(response, 200, { approvals: approvals.map(toApprovalDto) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/approvals/:approvalId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.approvalId, "approvalId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const approval = await new AgentRuntimeService(database).getApprovalRequest(
          tenant.organizationId,
          routeParams.approvalId,
        );
        sendJson(response, 200, { approval: toApprovalDto(approval) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/approvals/:approvalId/approve",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.approvalId, "approvalId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const reason = typeof body.reason === "string" ? body.reason : undefined;
        const service = new AgentRuntimeService(database);
        const result = await service.approveApprovalRequest(
          tenant.organizationId,
          routeParams.approvalId,
          auth.user.id,
          reason,
        );
        await service.claimAndExecute("inline-worker", tenant.organizationId);
        sendJson(response, 200, {
          request: toApprovalDto(result.request),
          decision: {
            id: result.decision.id,
            decision: result.decision.decision,
            reason: result.decision.reason,
            decidedBy: result.decision.decidedBy,
            decidedAt: result.decision.decidedAt.toISOString(),
          },
        });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/approvals/:approvalId/reject",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.approvalId, "approvalId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const reason = typeof body.reason === "string" ? body.reason : undefined;
        const result = await new AgentRuntimeService(database).rejectApprovalRequest(
          tenant.organizationId,
          routeParams.approvalId,
          auth.user.id,
          reason,
        );
        sendJson(response, 200, {
          request: toApprovalDto(result.request),
          decision: {
            id: result.decision.id,
            decision: result.decision.decision,
            reason: result.decision.reason,
            decidedBy: result.decision.decidedBy,
            decidedAt: result.decision.decidedAt.toISOString(),
          },
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/runtime/monitoring",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const metrics = await new AgentRuntimeService(database).getMonitoringMetrics(
          tenant.organizationId,
        );
        sendJson(response, 200, { metrics });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/runtime/worker/tick",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const workerId = typeof body.workerId === "string" ? body.workerId : "manual-worker-tick";
        const result = await new AgentRuntimeService(database).claimAndExecute(
          workerId,
          tenant.organizationId,
        );
        sendJson(response, 200, {
          executed: result.executed,
          run: result.run ? toRunDto(result.run) : null,
          attempt: result.attempt ? toAttemptDto(result.attempt) : null,
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/conversations",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const pagination = readPagination(url);
        const conversations = await new AgentRuntimeService(database).listConversations(
          tenant.organizationId,
          auth.user.id,
          pagination,
          routeParams.agentId,
        );
        sendJson(response, 200, { conversations: conversations.map(toConversationDto) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/:agentId/conversations",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.agentId, "agentId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const validated = validateCreateConversation(
          tenant.organizationId,
          { ...(request.body ?? {}), agentId: routeParams.agentId },
          auth.user.id,
        );
        const created = await new AgentRuntimeService(database).createConversation(validated);
        sendJson(response, 201, { conversation: toConversationDto(created) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/conversations/:conversationId/messages",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.conversationId, "conversationId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const pagination = readPagination(url);
        const messages = await new AgentRuntimeService(database).listMessages(
          tenant.organizationId,
          routeParams.conversationId,
          auth.user.id,
          pagination,
        );
        sendJson(response, 200, { messages: messages.map(toMessageDto) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/conversations/:conversationId/messages",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.conversationId, "conversationId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const validated = validateCreateMessage(
          tenant.organizationId,
          routeParams.conversationId,
          request.body,
          auth.user.id,
        );
        const created = await new AgentRuntimeService(database).createMessage(validated);
        sendJson(response, 201, { message: toMessageDto(created) });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/academic-planning/status",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const workspaceId = url.searchParams.get("workspaceId");
        const agentService = new AgentService(database);
        const agents = await agentService.listAgents(tenant.organizationId);
        const planner = agents.find(
          (a) =>
            (!workspaceId || a.workspaceId === workspaceId) &&
            (a.templateId === "00000000-0000-4100-8000-000000000104" ||
              a.agentKey === "academic-planning-assistant"),
        );

        const providerRegistry = AiProviderRegistry.getInstance();
        const liveConfigured = providerRegistry.isLiveConfigured(planner?.modelProvider || "openai");

        sendJson(response, 200, {
          available: true,
          template: ACADEMIC_PLANNING_AGENT_TEMPLATE,
          installed: Boolean(planner && planner.status === "active"),
          agent: planner ? toAgentDto(planner) : null,
          inferenceMode: liveConfigured ? "live" : "mock_fallback",
          liveProviderConfigured: liveConfigured,
        });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/academic-planning/generate",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const body = (request.body ?? {}) as Record<string, unknown>;
        const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : undefined;
        if (!workspaceId) {
          throw new ApiError(400, "VALIDATION_FAILED", "workspaceId is required.");
        }

        const validatedInput = validateAcademicPlanningInput(body);

        // Ensure Academic Planning Assistant is installed
        const agentService = new AgentService(database);
        const agents = await agentService.listAgents(tenant.organizationId);
        let planner = agents.find(
          (a) =>
            a.workspaceId === workspaceId &&
            (a.templateId === "00000000-0000-4100-8000-000000000104" ||
              a.agentKey === "academic-planning-assistant"),
        );

        if (!planner) {
          planner = await agentService.createAgent({
            organizationId: tenant.organizationId,
            workspaceId,
            templateId: "00000000-0000-4100-8000-000000000104",
            name: "HAZA Academic Planning Assistant",
            description: "Institutional Academic Planning Assistant for lesson planning and curriculum differentiation.",
            instructions: ACADEMIC_PLANNING_AGENT_TEMPLATE.metadata?.systemPrompt as string,
            createdBy: auth.user.id,
            configuration: {
              defaultTeachingLanguage: validatedInput.teachingLanguage || "English",
              standardLessonDurationMinutes: validatedInput.durationMinutes,
            },
          });
        }

        const runtimeService = new AgentRuntimeService(database);
        const { run } = await runtimeService.createRun({
          organizationId: tenant.organizationId,
          agentId: planner.id,
          userId: auth.user.id,
          input: validatedInput as unknown as Record<string, unknown>,
          executionMode: "manual",
          metadata: {
            source: "academic-planning-assistant-ui",
            workspaceId,
            gradeLevel: validatedInput.gradeLevel,
            subject: validatedInput.subject,
            topic: validatedInput.topic,
          },
        });

        // If client requested synchronous execution or testing fallback
        const executeSync = url.searchParams.get("sync") === "true";
        if (executeSync) {
          const outcome = await runtimeService.claimAndExecute("academic-sync-worker", tenant.organizationId);
          sendJson(response, 201, {
            run: outcome.run ? toRunDto(outcome.run) : toRunDto(run),
            executed: outcome.executed,
          });
          return;
        }

        sendJson(response, 202, {
          run: toRunDto(run),
          status: run.status,
          message: "Lesson plan generation task queued for worker execution.",
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/academic-lesson-plans",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const pagination = readPagePagination(url);
        const status = url.searchParams.get("status") as LessonPlanStatus | undefined;
        const search = url.searchParams.get("search") ?? undefined;
        const createdBy = url.searchParams.get("createdBy") ?? undefined;

        const paginated = await new AgentRuntimeService(database).listLessonPlans(
          tenant.organizationId,
          routeParams.workspaceId,
          {
            status: status || undefined,
            search,
            createdBy,
            page: pagination.page,
            pageSize: pagination.pageSize,
          },
        );

        sendJson(response, 200, {
          plans: paginated.items.map(toLessonPlanDto),
          total: paginated.total,
          page: paginated.page,
          pageSize: paginated.pageSize,
          totalPages: paginated.totalPages,
        });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/academic-lesson-plans/:planId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.planId, "planId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const plan = await new AgentRuntimeService(database).getLessonPlan(
          tenant.organizationId,
          routeParams.planId,
        );
        sendJson(response, 200, { plan: toLessonPlanDto(plan) });
      },
    });

    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/academic-lesson-plans/:planId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.planId, "planId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const body = (request.body ?? {}) as Record<string, unknown>;
        const updated = await new AgentRuntimeService(database).updateLessonPlanDraft(
          tenant.organizationId,
          routeParams.planId,
          body as any,
          auth.user.id,
        );
        sendJson(response, 200, { plan: toLessonPlanDto(updated) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/academic-lesson-plans/:planId/approve",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.planId, "planId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const body = (request.body ?? {}) as Record<string, unknown>;
        const notes = typeof body.notes === "string" ? body.notes : undefined;

        const approved = await new AgentRuntimeService(database).approveLessonPlan(
          tenant.organizationId,
          routeParams.planId,
          auth.user.id,
          notes,
        );
        sendJson(response, 200, { plan: toLessonPlanDto(approved) });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/academic-lesson-plans/:planId/publish",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.planId, "planId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "workspace.read",
        );

        const body = (request.body ?? {}) as Record<string, unknown>;
        const published = await new AgentRuntimeService(database).publishLessonPlan(
          tenant.organizationId,
          routeParams.planId,
          auth.user.id,
          body as any,
        );
        sendJson(response, 200, { plan: toLessonPlanDto(published) });
      },
    });

    router.register({
      method: "DELETE",
      path: "/api/v1/organizations/:organizationId/academic-lesson-plans/:planId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.planId, "planId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        await new AgentRuntimeService(database).deleteLessonPlan(
          tenant.organizationId,
          routeParams.planId,
          auth.user.id,
        );
        sendJson(response, 200, { success: true });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/academic-lesson-plans/:planId/export",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.planId, "planId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const format = (url.searchParams.get("format") || "markdown") as "json" | "markdown" | "text";
        const exported = await new AgentRuntimeService(database).exportLessonPlan(
          tenant.organizationId,
          routeParams.planId,
          format,
        );

        response.setHeader("Content-Type", exported.mimeType);
        response.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
        response.writeHead(200);
        response.end(exported.content);
      },
    });

    // ==========================================
    // EPIC 16: AGENT TOOLS & ORGANIZATIONAL DATA
    // ==========================================

    // List Available Tools (with tenant policy enablement)
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-tools",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const repoCtx = createRepositoryContext(database.db);
        const toolRepo = new AgentToolRepository(repoCtx);
        await toolRepo.ensureTrustedToolsSeeded(listTrustedTools());

        const workspaceId = url.searchParams.get("workspaceId") || undefined;
        const category = url.searchParams.get("category") || undefined;
        const industry = url.searchParams.get("industry") || undefined;

        const tools = await toolRepo.listTools({ category, industry });
        const policies = await toolRepo.listTenantPolicies(tenant.organizationId, workspaceId);

        const enriched = tools.map((t) => {
          const policy = policies.find((p) => p.toolId === t.toolId || p.toolKey === t.toolKey);
          return {
            ...t,
            enabled: policy ? policy.enabled : true,
            approvalPolicyOverride: policy?.approvalPolicyOverride ?? null,
            customRateLimitPerMinute: policy?.customRateLimitPerMinute ?? null,
            allowedAgentIds: policy?.allowedAgentIds ?? null,
          };
        });

        sendJson(response, 200, { tools: enriched, count: enriched.length });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/agent-tools",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const repoCtx = createRepositoryContext(database.db);
        const toolRepo = new AgentToolRepository(repoCtx);
        await toolRepo.ensureTrustedToolsSeeded(listTrustedTools());

        const category = url.searchParams.get("category") || undefined;
        const industry = url.searchParams.get("industry") || undefined;

        const tools = await toolRepo.listTools({ category, industry });
        const policies = await toolRepo.listTenantPolicies(tenant.organizationId, routeParams.workspaceId);

        const enriched = tools.map((t) => {
          const policy = policies.find((p) => p.toolId === t.toolId || p.toolKey === t.toolKey);
          return {
            ...t,
            enabled: policy ? policy.enabled : true,
            approvalPolicyOverride: policy?.approvalPolicyOverride ?? null,
            customRateLimitPerMinute: policy?.customRateLimitPerMinute ?? null,
            allowedAgentIds: policy?.allowedAgentIds ?? null,
          };
        });

        sendJson(response, 200, { tools: enriched, count: enriched.length });
      },
    });

    // Get Single Tool Details
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/agent-tools/:toolKey",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const repoCtx = createRepositoryContext(database.db);
        const toolRepo = new AgentToolRepository(repoCtx);
        const tool = await toolRepo.getToolByKey(routeParams.toolKey);
        if (!tool) {
          throw new ApiError(404, "NOT_FOUND", `Tool '${routeParams.toolKey}' not found.`);
        }

        const policy = await toolRepo.getTenantPolicy(
          tenant.organizationId,
          tool.toolId,
          routeParams.workspaceId,
        );

        sendJson(response, 200, {
          tool: {
            ...tool,
            enabled: policy ? policy.enabled : true,
            approvalPolicyOverride: policy?.approvalPolicyOverride ?? null,
            customRateLimitPerMinute: policy?.customRateLimitPerMinute ?? null,
            allowedAgentIds: policy?.allowedAgentIds ?? null,
          },
        });
      },
    });

    // Tool Version History
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/agent-tools/:toolKey/versions",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const repoCtx = createRepositoryContext(database.db);
        const toolRepo = new AgentToolRepository(repoCtx);
        const tool = await toolRepo.getToolByKey(routeParams.toolKey);
        if (!tool) {
          throw new ApiError(404, "NOT_FOUND", `Tool '${routeParams.toolKey}' not found.`);
        }

        const versions = await toolRepo.listToolVersions(tool.toolId);
        sendJson(response, 200, { toolKey: tool.toolKey, versions });
      },
    });

    // List Tenant Policies
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/agent-tools/policies",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const repoCtx = createRepositoryContext(database.db);
        const toolRepo = new AgentToolRepository(repoCtx);
        const policies = await toolRepo.listTenantPolicies(tenant.organizationId, routeParams.workspaceId);
        sendJson(response, 200, { policies });
      },
    });

    // Update Tenant Policy for Tool
    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/agent-tools/:toolKey/policy",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "organization.manage",
        );

        const repoCtx = createRepositoryContext(database.db);
        const toolRepo = new AgentToolRepository(repoCtx);
        const tool = await toolRepo.getToolByKey(routeParams.toolKey);
        if (!tool) {
          throw new ApiError(404, "NOT_FOUND", `Tool '${routeParams.toolKey}' not found.`);
        }

        const body = (request.body ?? {}) as Record<string, unknown>;
        const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
        const approvalPolicyOverride = typeof body.approvalPolicyOverride === "string" ? body.approvalPolicyOverride : null;
        const customRateLimitPerMinute = typeof body.customRateLimitPerMinute === "number" ? body.customRateLimitPerMinute : null;
        const allowedAgentIds = Array.isArray(body.allowedAgentIds) ? (body.allowedAgentIds as string[]) : null;

        const policy = await toolRepo.setTenantPolicy({
          organizationId: tenant.organizationId,
          workspaceId: routeParams.workspaceId,
          toolId: tool.toolId,
          enabled,
          approvalPolicyOverride,
          customRateLimitPerMinute,
          allowedAgentIds,
        });

        sendJson(response, 200, { policy });
      },
    });

    // Execute Tool Directly
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/agent-tools/execute",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const body = (request.body ?? {}) as Record<string, unknown>;
        if (!body.runId || typeof body.runId !== "string") {
          throw new ApiError(400, "VALIDATION_FAILED", "runId is required.");
        }
        if (!body.toolKey || typeof body.toolKey !== "string") {
          throw new ApiError(400, "VALIDATION_FAILED", "toolKey is required.");
        }

        const gateway = new AgentToolGatewayService(database);
        const result = await gateway.executeTool(
          {
            runId: body.runId,
            toolKey: body.toolKey,
            toolVersion: typeof body.toolVersion === "string" ? body.toolVersion : undefined,
            input: (body.input as Record<string, unknown>) ?? {},
            idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
          },
          {
            userId: auth.user.id,
          },
        );

        sendJson(response, result.success ? 200 : result.approvalRequired ? 202 : 400, { result });
      },
    });

    // Tool Executions History
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/agent-tools/executions",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const repoCtx = createRepositoryContext(database.db);
        const toolRepo = new AgentToolRepository(repoCtx);

        const runId = url.searchParams.get("runId") || undefined;
        const agentId = url.searchParams.get("agentId") || undefined;
        const toolKey = url.searchParams.get("toolKey") || undefined;
        const status = url.searchParams.get("status") || undefined;
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
        const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

        const { executions, total } = await toolRepo.listExecutions(tenant.organizationId, {
          workspaceId: routeParams.workspaceId,
          runId,
          agentId,
          toolKey,
          status,
          limit,
          offset,
        });

        sendJson(response, 200, { executions, total, limit, offset });
      },
    });

    // Single Execution Details
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/agent-tools/executions/:executionId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        assertUuid(routeParams.executionId, "executionId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const repoCtx = createRepositoryContext(database.db);
        const toolRepo = new AgentToolRepository(repoCtx);
        const execution = await toolRepo.getExecutionById(tenant.organizationId, routeParams.executionId);
        if (!execution) {
          throw new ApiError(404, "NOT_FOUND", `Execution '${routeParams.executionId}' not found.`);
        }

        sendJson(response, 200, { execution });
      },
    });

    // Tool Telemetry Metrics
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/workspaces/:workspaceId/agent-tools/metrics",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workspaceId, "workspaceId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );

        const repoCtx = createRepositoryContext(database.db);
        const toolRepo = new AgentToolRepository(repoCtx);
        const { executions, total } = await toolRepo.listExecutions(tenant.organizationId, {
          workspaceId: routeParams.workspaceId,
          limit: 100,
        });

        const completed = executions.filter((e) => e.status === "completed");
        const failed = executions.filter((e) => e.status === "failed");
        const awaitingApproval = executions.filter((e) => e.status === "awaiting_approval");

        const avgDurationMs = completed.length > 0
          ? Math.round(completed.reduce((acc, e) => acc + (e.durationMs || 0), 0) / completed.length)
          : 0;

        const successRate = total > 0 ? Math.round((completed.length / total) * 100) : 100;

        sendJson(response, 200, {
          metrics: {
            totalInvocations: total,
            completedCount: completed.length,
            failedCount: failed.length,
            awaitingApprovalCount: awaitingApproval.length,
            successRate,
            avgDurationMs,
          },
        });
      },
    });

  },
};


function toLessonPlanDto(plan: AcademicLessonPlanRecord) {
  const content = plan.content as any;
  return {
    id: plan.id,
    organizationId: plan.organizationId,
    workspaceId: plan.workspaceId,
    agentRunId: plan.agentRunId,
    title: plan.title,
    grade: plan.grade,
    subject: plan.subject,
    topic: plan.topic,
    durationMinutes: plan.durationMinutes,
    learningObjectives: plan.learningObjectives,
    content: plan.content,
    status: plan.status,
    curriculumReference: plan.curriculumReference,
    curriculumVerified: plan.curriculumVerified,
    verificationStatus: plan.curriculumVerified ? "institutional_verified" : "general_guidance",
    createdBy: plan.createdBy,
    approvedBy: plan.approvedBy,
    reviewedBy: plan.approvedBy,
    approvedAt: plan.approvedAt ? plan.approvedAt.toISOString() : null,
    reviewedAt: plan.approvedAt ? plan.approvedAt.toISOString() : null,
    approvalNotes: content?.approvalNotes ?? null,
    publishedToLmsAt: content?.publishedToLmsAt ?? null,
    lmsCourseId: content?.lmsCourseId ?? null,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

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
    agentId: run.agentId,
    conversationId: run.conversationId,
    status: run.status,
    executionMode: run.executionMode,
    input: unwrapPayload(run.input),
    output: run.output ? unwrapPayload(run.output) : undefined,
    error: run.safeErrorMessage ?? undefined,
    errorCode: run.errorCode ?? undefined,
    provider: run.provider,
    model: run.model,
    configurationRevisionId: run.configurationRevisionId ?? null,
    attemptCount: run.attemptCount,
    maxAttempts: run.maxAttempts,
    priority: run.priority,
    totalInputTokens: run.totalInputTokens,
    totalOutputTokens: run.totalOutputTokens,
    totalCostMicros: run.totalCostMicros,
    cancelledBy: run.cancelledBy ?? null,
    cancelledAt: run.cancelledAt?.toISOString(),
    cancellationReason: run.cancellationReason ?? null,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString(),
    duration: run.durationMs ?? undefined,
    durationMs: run.durationMs ?? undefined,
    requestedBy: run.requestedBy,
    metadata: run.metadata,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function toAttemptDto(attempt: AgentRunAttemptRecord) {
  return {
    id: attempt.id,
    organizationId: attempt.organizationId,
    workspaceId: attempt.workspaceId,
    runId: attempt.runId,
    attemptNumber: attempt.attemptNumber,
    status: attempt.status,
    workerId: attempt.workerId,
    leaseToken: attempt.leaseToken,
    startedAt: attempt.startedAt.toISOString(),
    completedAt: attempt.completedAt?.toISOString(),
    durationMs: attempt.durationMs,
    errorCode: attempt.errorCode,
    errorMessage: attempt.errorMessage,
    errorDetails: attempt.errorDetails,
    inputTokens: attempt.inputTokens,
    outputTokens: attempt.outputTokens,
    metadata: attempt.metadata,
    createdAt: attempt.createdAt.toISOString(),
    updatedAt: attempt.updatedAt.toISOString(),
  };
}

function toEventDto(event: AgentRunEventRecord) {
  return {
    id: event.id,
    organizationId: event.organizationId,
    workspaceId: event.workspaceId,
    runId: event.runId,
    attemptId: event.attemptId,
    eventType: event.eventType,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}

function toApprovalDto(approval: AgentApprovalRequestRecord) {
  return {
    id: approval.id,
    organizationId: approval.organizationId,
    workspaceId: approval.workspaceId,
    runId: approval.runId,
    attemptId: approval.attemptId,
    actionName: approval.actionName,
    actionType: approval.actionType,
    actionPayload: approval.actionPayload,
    riskLevel: approval.riskLevel,
    policy: approval.policy,
    requiredRoles: approval.requiredRoles,
    status: approval.status,
    requestedBy: approval.requestedBy,
    expiresAt: approval.expiresAt?.toISOString(),
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
  };
}

function toUsageDto(usage: AgentRuntimeUsageRecord) {
  return {
    id: usage.id,
    organizationId: usage.organizationId,
    workspaceId: usage.workspaceId,
    runId: usage.runId,
    agentId: usage.agentId,
    provider: usage.provider,
    model: usage.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    durationMs: usage.durationMs,
    costMicros: usage.costMicros,
    createdAt: usage.createdAt.toISOString(),
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
