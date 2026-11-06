import { AutonomousTaskService } from "./services/autonomous-task.service.js";
import { AgentObservabilityRepository } from "./repositories/agent-observability.repository.js";
import { AgentObservabilityService } from "./services/agent-observability.service.js";
import { AgentEvaluationService } from "./services/agent-evaluation.service.js";
import { AgentReliabilityService } from "./services/agent-reliability.service.js";
import { AgentCostService } from "./services/agent-cost.service.js";
import { AgentGovernanceRepository } from "./repositories/agent-governance.repository.js";
import { AgentGovernanceService } from "./services/agent-governance.service.js";
import { PolicyEvaluationEngine } from "./services/policy-evaluation-engine.service.js";
import { PolicySimulationService } from "./services/policy-simulation.service.js";
import { AgentApprovalRepository } from "./repositories/agent-approval.repository.js";
import { AgentApprovalService } from "./services/agent-approval.service.js";
import { AgentApprovalContinuationService } from "./services/agent-approval-continuation.service.js";
import { AgentSecurityRepository } from "./repositories/agent-security.repository.js";
import { AgentSecurityGatewayService } from "./services/agent-security-gateway.service.js";
import { AgentSecretVaultService } from "./services/agent-secret-vault.service.js";
import { AgentComplianceService } from "./services/agent-compliance.service.js";
import { AgentComplianceRepository } from "./repositories/agent-compliance.repository.js";
import { AgentTeamService } from "./services/agent-team.service.js";
import { AgentOrchestrationService } from "./services/agent-orchestration.service.js";
import {
  validateCreateAgentTeam,
  validateCreateWorkflowDefinition,
} from "./validation/orchestration-validation.js";
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
import { UnifiedAiProviderGateway } from "./providers/ai-provider-gateway.js";
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
      path: "/api/v1/organizations/:organizationId/agents/providers/config",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const gateway = UnifiedAiProviderGateway.getInstance(database);
        const configs = await gateway.listTenantConfigs(tenant.organizationId);
        sendJson(response, 200, { configs });
      },
    });

    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agents/providers/config",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const providerId = (body.providerId as string) || "openai";
        const gateway = UnifiedAiProviderGateway.getInstance(database);

        const config = await gateway.updateTenantConfig(
          tenant.organizationId,
          {
            providerId,
            liveModeEnabled: body.liveModeEnabled !== undefined ? Boolean(body.liveModeEnabled) : undefined,
            environmentMode: body.environmentMode as any,
            apiKey: body.apiKey as string | undefined,
            defaultModel: body.defaultModel as string | undefined,
            allowedModels: Array.isArray(body.allowedModels) ? (body.allowedModels as string[]) : undefined,
            embeddingModel: body.embeddingModel as string | undefined,
            embeddingLiveEnabled: body.embeddingLiveEnabled !== undefined ? Boolean(body.embeddingLiveEnabled) : undefined,
            status: body.status as any,
            statusMessage: body.statusMessage as string | undefined,
          },
          auth.user.id,
        );

        sendJson(response, 200, { config });
      },
    });

    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agents/providers/validate",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const providerId = (body.providerId as string) || "openai";
        const gateway = UnifiedAiProviderGateway.getInstance(database);
        const result = await gateway.probeProvider(tenant.organizationId, providerId);
        sendJson(response, 200, { validation: result });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/providers/models",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const providerId = url.searchParams.get("providerId") ?? undefined;
        const gateway = UnifiedAiProviderGateway.getInstance(database);
        const models = await gateway.listAvailableModels(tenant.organizationId, providerId);
        sendJson(response, 200, { models });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/providers/budgets",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const workspaceId = url.searchParams.get("workspaceId") ?? undefined;
        const gateway = UnifiedAiProviderGateway.getInstance(database);
        const budget = await gateway.getBudget(tenant.organizationId, workspaceId);
        sendJson(response, 200, { budget });
      },
    });

    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agents/providers/budgets",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as Record<string, unknown>;
        const workspaceId = body.workspaceId as string | undefined;
        const gateway = UnifiedAiProviderGateway.getInstance(database);
        const updated = await gateway.updateBudget(
          tenant.organizationId,
          {
            monthlyBudgetUsd: typeof body.monthlyBudgetUsd === "number" ? body.monthlyBudgetUsd : undefined,
            dailyBudgetUsd: typeof body.dailyBudgetUsd === "number" ? body.dailyBudgetUsd : undefined,
            perRequestMaxCostUsd: typeof body.perRequestMaxCostUsd === "number" ? body.perRequestMaxCostUsd : undefined,
            enforceHardLimit: typeof body.enforceHardLimit === "boolean" ? body.enforceHardLimit : undefined,
            notifyThresholdPercent: typeof body.notifyThresholdPercent === "number" ? body.notifyThresholdPercent : undefined,
            status: body.status as string | undefined,
          },
          auth.user.id,
          workspaceId,
        );
        sendJson(response, 200, { budget: updated });
      },
    });

    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agents/providers/usage",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const limitParam = Number(url.searchParams.get("limit") || 50);
        const gateway = UnifiedAiProviderGateway.getInstance(database);
        const usage = await gateway.getUsageMetrics(tenant.organizationId, limitParam);
        sendJson(response, 200, { usage });
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


    // ========================================================================
    // Epic 19 — Multi-Agent Collaboration & Orchestration Routes
    // ========================================================================

    // 1. List Agent Teams
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-teams",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const workspaceId = url.searchParams.get("workspaceId") || undefined;
        const teams = await new AgentTeamService(database).listTeams(tenant.organizationId, workspaceId);
        sendJson(response, 200, { teams });
      },
    });

    // 2. Create Agent Team
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-teams",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const input = validateCreateAgentTeam(tenant.organizationId, auth.user.id, request.body);
        const team = await new AgentTeamService(database).createTeam(input);
        sendJson(response, 201, { team });
      },
    });

    // 3. Get Agent Team
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-teams/:teamId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.teamId, "teamId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const team = await new AgentTeamService(database).getTeam(tenant.organizationId, routeParams.teamId);
        sendJson(response, 200, { team });
      },
    });

    // 4. Update Agent Team
    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/agent-teams/:teamId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.teamId, "teamId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const team = await new AgentTeamService(database).updateTeam(
          tenant.organizationId,
          routeParams.teamId,
          body,
        );
        sendJson(response, 200, { team });
      },
    });

    // 5. Delete Agent Team
    router.register({
      method: "DELETE",
      path: "/api/v1/organizations/:organizationId/agent-teams/:teamId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.teamId, "teamId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        await new AgentTeamService(database).deleteTeam(tenant.organizationId, routeParams.teamId);
        sendJson(response, 200, { success: true });
      },
    });

    // 6. List Workflow Definitions
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-workflows",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const workspaceId = url.searchParams.get("workspaceId") || undefined;
        const workflows = await new AgentOrchestrationService(database).listDefinitions(
          tenant.organizationId,
          workspaceId,
        );
        sendJson(response, 200, { workflows });
      },
    });

    // 7. Create Workflow Definition
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-workflows",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const input = validateCreateWorkflowDefinition(tenant.organizationId, auth.user.id, request.body);
        const workflow = await new AgentOrchestrationService(database).createDefinition(input);
        sendJson(response, 201, { workflow });
      },
    });

    // 8. Get Workflow Definition
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-workflows/:workflowId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workflowId, "workflowId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const workflow = await new AgentOrchestrationService(database).getDefinition(
          tenant.organizationId,
          routeParams.workflowId,
        );
        sendJson(response, 200, { workflow });
      },
    });

    // 9. Validate Workflow Definition
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-workflows/:workflowId/validate",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workflowId, "workflowId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const validation = await new AgentOrchestrationService(database).validateDefinition(
          tenant.organizationId,
          routeParams.workflowId,
        );
        sendJson(response, 200, { validation });
      },
    });

    // 10. Start Workflow Run
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-workflows/:workflowId/runs",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.workflowId, "workflowId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const initialInput = (body.input as Record<string, unknown>) || {};
        const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined;

        const run = await new AgentOrchestrationService(database).startWorkflowRun(
          tenant.organizationId,
          routeParams.workflowId,
          initialInput,
          auth.user.id,
          idempotencyKey,
        );
        sendJson(response, 201, { run });
      },
    });

    // 11. Get Workflow Run
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-workflow-runs/:runId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const run = await new AgentOrchestrationService(database).getWorkflowRun(
          tenant.organizationId,
          routeParams.runId,
        );
        sendJson(response, 200, { run });
      },
    });

    // 12. Cancel Workflow Run
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-workflow-runs/:runId/cancel",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const run = await new AgentOrchestrationService(database).cancelWorkflowRun(
          tenant.organizationId,
          routeParams.runId,
          auth.user.id,
        );
        sendJson(response, 200, { run });
      },
    });

    // 13. List Workflow Run Events
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-workflow-runs/:runId/events",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const events = await new AgentOrchestrationService(database).listWorkflowEvents(
          tenant.organizationId,
          routeParams.runId,
        );
        sendJson(response, 200, { events });
      },
    });

    // 14. Approve / Reject Step Run
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-workflow-runs/:runId/steps/:stepKey/approval",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        assertUuid(routeParams.runId, "runId");
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const decision = body.decision === "rejected" ? "rejected" : "approved";
        const notes = typeof body.notes === "string" ? body.notes : undefined;

        const run = await new AgentOrchestrationService(database).approveStepRun(
          tenant.organizationId,
          routeParams.runId,
          routeParams.stepKey,
          decision,
          auth.user.id,
          notes,
        );
        sendJson(response, 200, { run });
      },
    });
    // =========================================================
    // EPIC 20: AUTONOMOUS AGENTS & CONTINUOUS OPERATIONS
    // =========================================================

    // 1. Get Autonomous Policy
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/policy",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const workspaceId = url.searchParams.get("workspaceId") || "ws-default";
        const policy = await new AutonomousTaskService(database).getPolicy(tenant.organizationId, workspaceId);
        sendJson(response, 200, { policy });
      },
    });

    // 2. Update Autonomous Policy
    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/policy",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const workspaceId = body.workspaceId || "ws-default";
        const policy = await new AutonomousTaskService(database).updatePolicy({
          organizationId: tenant.organizationId,
          workspaceId,
          maxActiveTasks: body.maxActiveTasks,
          maxGlobalConcurrency: body.maxGlobalConcurrency,
          defaultAutonomyLevel: body.defaultAutonomyLevel,
          allowedAutonomyLevels: body.allowedAutonomyLevels,
        });
        sendJson(response, 200, { policy });
      },
    });

    // 3. Organization Emergency Stop All
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/emergency-stop-all",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const workspaceId = body.workspaceId || "ws-default";
        const policy = await new AutonomousTaskService(database).emergencyStopAll(
          tenant.organizationId,
          workspaceId,
          auth.user.id,
        );
        sendJson(response, 200, { policy, message: "Organization-wide emergency stop activated" });
      },
    });

    // 4. Resume All Tasks
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/resume-all",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const workspaceId = body.workspaceId || "ws-default";
        const policy = await new AutonomousTaskService(database).resumeAll(tenant.organizationId, workspaceId);
        sendJson(response, 200, { policy, message: "Organization-wide emergency stop cleared" });
      },
    });

    // 5. List Autonomous Tasks
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const workspaceId = url.searchParams.get("workspaceId") || undefined;
        const status = (url.searchParams.get("status") as any) || undefined;
        const tasks = await new AutonomousTaskService(database).listTasks(tenant.organizationId, workspaceId, status);
        sendJson(response, 200, { tasks });
      },
    });

    // 6. Create Autonomous Task
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const workspaceId = body.workspaceId || "ws-default";
        const task = await new AutonomousTaskService(database).createTask(
          tenant.organizationId,
          workspaceId,
          body,
          auth.user.id,
        );
        sendJson(response, 201, { task });
      },
    });

    // 7. Get Autonomous Task
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/:taskId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const task = await new AutonomousTaskService(database).getTask(tenant.organizationId, routeParams.taskId);
        sendJson(response, 200, { task });
      },
    });

    // 8. Update Autonomous Task
    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/:taskId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const task = await new AutonomousTaskService(database).updateTask(tenant.organizationId, routeParams.taskId, body);
        sendJson(response, 200, { task });
      },
    });

    // 9. Pause Task
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/:taskId/pause",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const task = await new AutonomousTaskService(database).pauseTask(tenant.organizationId, routeParams.taskId);
        sendJson(response, 200, { task });
      },
    });

    // 10. Resume Task
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/:taskId/resume",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const task = await new AutonomousTaskService(database).resumeTask(tenant.organizationId, routeParams.taskId);
        sendJson(response, 200, { task });
      },
    });

    // 11. Task Emergency Stop
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/:taskId/emergency-stop",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const task = await new AutonomousTaskService(database).emergencyStopTask(
          tenant.organizationId,
          routeParams.taskId,
          auth.user.id,
          body.reason,
        );
        sendJson(response, 200, { task });
      },
    });

    // 12. Trigger Run On-Demand
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/:taskId/run",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const run = await new AutonomousTaskService(database).triggerTaskRun(
          tenant.organizationId,
          routeParams.taskId,
          body,
        );
        sendJson(response, 201, { run });
      },
    });

    // 13. List Triggers for Task
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/:taskId/triggers",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const triggers = await new AutonomousTaskService(database).listTriggers(tenant.organizationId, routeParams.taskId);
        sendJson(response, 200, { triggers });
      },
    });

    // 14. Create Trigger for Task
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/:taskId/triggers",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const workspaceId = body.workspaceId || "ws-default";
        const trigger = await new AutonomousTaskService(database).createTrigger(
          tenant.organizationId,
          workspaceId,
          { ...body, taskDefinitionId: routeParams.taskId },
        );
        sendJson(response, 201, { trigger });
      },
    });

    // 15. Toggle Trigger (Enable / Disable)
    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/triggers/:triggerId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const trigger = await new AutonomousTaskService(database).toggleTrigger(
          tenant.organizationId,
          routeParams.triggerId,
          Boolean(body.isEnabled),
        );
        sendJson(response, 200, { trigger });
      },
    });

    // 16. Delete Trigger
    router.register({
      method: "DELETE",
      path: "/api/v1/organizations/:organizationId/autonomous-tasks/triggers/:triggerId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        await new AutonomousTaskService(database).deleteTrigger(tenant.organizationId, routeParams.triggerId);
        sendJson(response, 200, { success: true });
      },
    });

    // 17. List Runs
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/autonomous-task-runs",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const taskDefinitionId = url.searchParams.get("taskDefinitionId") || undefined;
        const status = (url.searchParams.get("status") as any) || undefined;
        const runs = await new AutonomousTaskService(database).listRuns(tenant.organizationId, {
          taskDefinitionId,
          status,
        });
        sendJson(response, 200, { runs });
      },
    });

    // 18. Get Run Details
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/autonomous-task-runs/:runId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const run = await new AutonomousTaskService(database).getRun(tenant.organizationId, routeParams.runId);
        sendJson(response, 200, { run });
      },
    });

    // 19. Cancel Run
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-task-runs/:runId/cancel",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const run = await new AutonomousTaskService(database).cancelRun(
          tenant.organizationId,
          routeParams.runId,
          body.reason,
        );
        sendJson(response, 200, { run });
      },
    });

    // 20. Approve Run (Human Approval Gate)
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-task-runs/:runId/approve",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const run = await new AutonomousTaskService(database).approveRun(
          tenant.organizationId,
          routeParams.runId,
          auth.user.id,
        );
        sendJson(response, 200, { run });
      },
    });

    // 21. Reject Run
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/autonomous-task-runs/:runId/reject",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const run = await new AutonomousTaskService(database).rejectRun(
          tenant.organizationId,
          routeParams.runId,
          auth.user.id,
          body.reason,
        );
        sendJson(response, 200, { run });
      },
    });

    // 22. Get Run Events Audit Log
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/autonomous-task-runs/:runId/events",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const events = await new AutonomousTaskService(database).listEvents(tenant.organizationId, routeParams.runId);
        sendJson(response, 200, { events });
      },
    });

    // 23. Get Run Latest Checkpoint
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/autonomous-task-runs/:runId/checkpoint",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const checkpoint = await new AutonomousTaskService(database).getLatestCheckpoint(
          tenant.organizationId,
          routeParams.runId,
        );
        sendJson(response, 200, { checkpoint });
      },
    });

    // =========================================================================
    // EPIC 21: AGENT OPERATIONS OBSERVABILITY, EVALUATION & RELIABILITY
    // =========================================================================

    // 1. Record / Ingest Trace Span
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-observability/spans",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentObservabilityService(repo);
        const body = (request.body ?? {}) as any;
        const span = await service.recordSpan({
          ...body,
          organizationId: tenant.organizationId,
        });
        sendJson(response, 201, { span });
      },
    });

    // 2. List Spans
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-observability/spans",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentObservabilityService(repo);
        const status = url.searchParams.get("status") || undefined;
        const agentId = url.searchParams.get("agentId") || undefined;
        const limit = Number(url.searchParams.get("limit") || "50");
        const offset = Number(url.searchParams.get("offset") || "0");
        const spans = await service.listSpans(tenant.organizationId, {
          status,
          agentId,
          limit,
          offset,
        });
        sendJson(response, 200, { spans });
      },
    });

    // 3. Get Trace Execution Tree
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-observability/traces/:traceId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentObservabilityService(repo);
        const tree = await service.getTraceTree(tenant.organizationId, routeParams.traceId);
        sendJson(response, 200, tree);
      },
    });

    // 4. List Evaluation Datasets
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-evaluation/datasets",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentEvaluationService(repo);
        const datasets = await service.listDatasets(tenant.organizationId);
        sendJson(response, 200, { datasets });
      },
    });

    // 5. Create Evaluation Dataset
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-evaluation/datasets",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentEvaluationService(repo);
        const dataset = await service.createDataset({
          organizationId: tenant.organizationId,
          workspaceId: body.workspaceId,
          name: body.name,
          description: body.description,
          version: body.version,
          metadata: { domain: body.domain },
          createdBy: auth.user.id,
        });
        sendJson(response, 201, { dataset });
      },
    });

    // 6. List Evaluation Cases
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-evaluation/datasets/:datasetId/cases",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentEvaluationService(repo);
        const cases = await service.getCases(routeParams.datasetId);
        sendJson(response, 200, { cases });
      },
    });

    // 7. Add Evaluation Case
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-evaluation/datasets/:datasetId/cases",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentEvaluationService(repo);
        const evaluationCase = await service.addCase({
          datasetId: routeParams.datasetId,
          organizationId: tenant.organizationId,
          name: body.name,
          description: body.description,
          inputPrompt: body.inputPrompt || body.prompt,
          inputContext: body.inputContext,
          expectedOutput: body.expectedOutput,
          expectedOutputSchema: body.expectedOutputSchema,
          expectedTools: body.expectedTools,
          requiredCitations: body.requiredCitations || body.contextChunkIds,
          gradingCriteria: body.gradingCriteria,
          orderIndex: body.orderIndex,
        });
        sendJson(response, 201, { case: evaluationCase });
      },
    });

    // 8. Run Evaluation Suite
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-evaluation/runs",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentEvaluationService(repo);
        const run = await service.runEvaluationSuite({
          organizationId: tenant.organizationId,
          workspaceId: body.workspaceId,
          datasetId: body.datasetId,
          targetType: body.targetType || 'agent',
          targetId: body.targetAgentId || body.targetWorkflowId || body.targetId,
          isBaseline: body.isBaseline,
          mockResultsByCaseId: body.mockResultsByCaseId,
          executedBy: auth.user.id,
        });
        sendJson(response, 201, { run });
      },
    });

    // 9. List Evaluation Runs
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-evaluation/runs",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const datasetId = url.searchParams.get("datasetId") || undefined;
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentEvaluationService(repo);
        const runs = await service.listRuns(tenant.organizationId, datasetId);
        sendJson(response, 200, { runs });
      },
    });

    // 10. Get Evaluation Run
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-evaluation/runs/:runId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentEvaluationService(repo);
        const run = await service.getRun(tenant.organizationId, routeParams.runId);
        if (!run) {
          throw new ApiError(404, "NOT_FOUND", "Evaluation run not found");
        }
        sendJson(response, 200, { run });
      },
    });

    // 11. List SLO Definitions
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-reliability/slos",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentReliabilityService(repo);
        const slos = await service.listSlos(tenant.organizationId);
        sendJson(response, 200, { slos });
      },
    });

    // 12. Upsert SLO Definition
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-reliability/slos",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentReliabilityService(repo);
        const slo = await service.defineSlo({
          organizationId: tenant.organizationId,
          name: body.name,
          metricType: body.metricType,
          targetValue: Number(body.targetValue),
          windowDurationMinutes: body.windowDurationMinutes || (body.windowHours ? Number(body.windowHours) * 60 : undefined),
          status: body.status,
        });
        sendJson(response, 200, { slo });
      },
    });

    // 13. Aggregate & Get Reliability Metrics
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-reliability/metrics",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const windowMinutes = Number(url.searchParams.get("windowMinutes") || "60");
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentReliabilityService(repo);
        const metric = await service.aggregateMetrics(tenant.organizationId, windowMinutes);
        sendJson(response, 200, { metric });
      },
    });

    // 14. List Alert Rules
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-reliability/alert-rules",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentReliabilityService(repo);
        const alertRules = await service.listAlertRules(tenant.organizationId);
        sendJson(response, 200, { alertRules });
      },
    });

    // 15. Create Alert Rule
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-reliability/alert-rules",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentReliabilityService(repo);
        const alertRule = await service.createAlertRule({
          organizationId: tenant.organizationId,
          name: body.name,
          metricName: body.metricName || body.metricType,
          thresholdValue: Number(body.thresholdValue),
          conditionOperator: body.conditionOperator || body.comparisonOperator,
          evaluationWindowMinutes: body.evaluationWindowMinutes || body.windowMinutes,
          severity: body.severity,
          isEnabled: body.isEnabled,
          channels: body.channels,
        });
        sendJson(response, 201, { alertRule });
      },
    });

    // 16. List Incidents
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-reliability/incidents",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const status = url.searchParams.get("status") as any;
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentReliabilityService(repo);
        const incidents = await service.listIncidents(tenant.organizationId, status);
        sendJson(response, 200, { incidents });
      },
    });

    // 17. Update Incident Status (Acknowledge / Mitigate / Resolve)
    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agent-reliability/incidents/:incidentId/status",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentReliabilityService(repo);
        let incident;
        if (body.status === "acknowledged") {
          incident = await service.acknowledgeIncident(tenant.organizationId, routeParams.incidentId, auth.user.id);
        } else if (body.status === "mitigated") {
          incident = await service.mitigateIncident(tenant.organizationId, routeParams.incidentId, body.mitigationSteps);
        } else if (body.status === "resolved") {
          incident = await service.resolveIncident(tenant.organizationId, routeParams.incidentId, auth.user.id, body.mitigationSteps);
        } else {
          throw new ApiError(400, "BAD_REQUEST", "Invalid incident status update");
        }
        sendJson(response, 200, { incident });
      },
    });

    // 18. Cost Attribution Intelligence
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-cost/attribution",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const days = Number(url.searchParams.get("days") || "30");
        const repo = new AgentObservabilityRepository(createRepositoryContext(database.db));
        const service = new AgentCostService(repo);
        const costAttribution = await service.getCostAttribution(tenant.organizationId, days);
        sendJson(response, 200, { costAttribution });
      },
    });

    // =========================================================================
    // EPIC 22A: ENTERPRISE AGENT GOVERNANCE FOUNDATION
    // =========================================================================

    // 1. Get Governance Overview Stats
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/overview",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const overview = await service.getGovernanceOverview(tenant.organizationId);
        sendJson(response, 200, { overview });
      },
    });

    // 2. List Agent Governance Profiles
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/profiles",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const riskTier = url.searchParams.get("riskTier") || undefined;
        const complianceStatus = url.searchParams.get("complianceStatus") || undefined;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const profiles = await service.listProfiles(tenant.organizationId, {
          riskTier,
          complianceStatus,
        });
        sendJson(response, 200, { profiles });
      },
    });

    // 3. Get Single Agent Governance Profile
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/profiles/:agentId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const data = await service.getAgentProfile(tenant.organizationId, routeParams.agentId);
        sendJson(response, 200, data);
      },
    });

    // 4. Upsert Agent Governance Profile
    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agent-governance/profiles/:agentId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const profile = await service.upsertProfile({
          ...body,
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          userId: auth.user.id,
        });
        sendJson(response, 200, { profile });
      },
    });

    // 5. Record Compliance Review for Agent
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/profiles/:agentId/review",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const profile = await service.recordAgentReview({
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          reviewedBy: auth.user.id,
          complianceStatus: body.complianceStatus || "compliant",
          notes: body.notes,
        });
        sendJson(response, 200, { profile });
      },
    });

    // 6. List Ownership Assignments
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/ownership",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const ownerships = await service.listOwnership(tenant.organizationId);
        sendJson(response, 200, { ownerships });
      },
    });

    // 7. Get Agent Ownership Assignment
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/ownership/:agentId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const ownership = await service.getAgentOwnership(tenant.organizationId, routeParams.agentId);
        sendJson(response, 200, { ownership });
      },
    });

    // 8. Assign Agent Ownership
    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agent-governance/ownership/:agentId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const ownership = await service.assignOwnership({
          ...body,
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          assignedBy: auth.user.id,
        });
        sendJson(response, 200, { ownership });
      },
    });

    // 9. List Governance Policies
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/policies",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const policyType = url.searchParams.get("policyType") || undefined;
        const lifecycleState = url.searchParams.get("lifecycleState") || undefined;
        const severity = url.searchParams.get("severity") || undefined;
        const scopeType = url.searchParams.get("scopeType") || undefined;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const policies = await service.listPolicies(tenant.organizationId, {
          policyType,
          lifecycleState,
          severity,
          scopeType,
        });
        sendJson(response, 200, { policies });
      },
    });

    // 10. Register / Create Governance Policy
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/policies",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const policy = await service.createPolicy({
          ...body,
          organizationId: tenant.organizationId,
          createdBy: auth.user.id,
        });
        sendJson(response, 201, { policy });
      },
    });

    // 11. Get Governance Policy & Version History
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/policies/:policyId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const data = await service.getPolicy(tenant.organizationId, routeParams.policyId);
        sendJson(response, 200, data);
      },
    });

    // 12. Update Governance Policy Definition
    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agent-governance/policies/:policyId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const policy = await service.updatePolicy(
          tenant.organizationId,
          routeParams.policyId,
          {
            ...body,
            updatedBy: auth.user.id,
          },
        );
        sendJson(response, 200, { policy });
      },
    });

    // 13. Transition Policy Lifecycle State
    router.register({
      method: "PATCH",
      path: "/api/v1/organizations/:organizationId/agent-governance/policies/:policyId/lifecycle",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const auth = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const policy = await service.transitionPolicyLifecycle(
          tenant.organizationId,
          routeParams.policyId,
          body.lifecycleState,
          auth.user.id,
        );
        sendJson(response, 200, { policy });
      },
    });

    // 14. List Governance Audit Logs
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/audit-logs",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const targetType = url.searchParams.get("targetType") || undefined;
        const targetId = url.searchParams.get("targetId") || undefined;
        const limit = Number(url.searchParams.get("limit") || "50");
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const service = new AgentGovernanceService(repo);
        const auditLogs = await service.listAuditLogs(tenant.organizationId, {
          targetType,
          targetId,
          limit,
        });
        sendJson(response, 200, { auditLogs });
      },
    });
    // 15. Policy Evaluation
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/evaluate",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const engine = new PolicyEvaluationEngine(repo);
        const decision = await engine.evaluate({
          ...body,
          organizationId: tenant.organizationId,
          actorId: body.actorId || authResult.user.id,
        });
        sendJson(response, 200, { decision });
      },
    });

    // 16. Policy Simulation
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/simulate",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as any;
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const simService = new PolicySimulationService(repo);
        const simulation = await simService.simulatePolicyDecision({
          ...body,
          organizationId: tenant.organizationId,
          actorId: body.actorId || authResult.user.id,
        });
        sendJson(response, 200, { simulation });
      },
    });

    // 17. Get Governance Enforcement Mode
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/mode",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const engine = new PolicyEvaluationEngine(repo);
        const enforcementMode = await engine.getEnforcementMode(tenant.organizationId);
        sendJson(response, 200, { enforcementMode });
      },
    });

    // 18. Set Governance Enforcement Mode
    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agent-governance/mode",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const mode = body.mode;
        if (mode !== "DISABLED" && mode !== "MONITOR" && mode !== "ENFORCE") {
          throw new ApiError(400, "VALIDATION_FAILED", "Mode must be one of: DISABLED, MONITOR, ENFORCE");
        }
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const engine = new PolicyEvaluationEngine(repo);
        await engine.setEnforcementMode(tenant.organizationId, mode, authResult.user.id);
        sendJson(response, 200, { enforcementMode: mode, updated: true });
      },
    });

    // 19. List Policy Decision History
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/decisions",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const limit = Number(url.searchParams.get("limit") || "50");
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const allLogs = await repo.listAuditLogs(tenant.organizationId, { limit });
        const decisions = allLogs.filter((l) => l.action === "policy_decision" || l.action === "policy_simulation");
        sendJson(response, 200, { decisions: decisions.slice(0, limit) });
      },
    });

    // 20. Compare Policy Versions
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/policies/:policyId/versions/compare",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const v1 = Number(url.searchParams.get("v1") || "1");
        const v2 = Number(url.searchParams.get("v2") || "2");
        const repo = new AgentGovernanceRepository(createRepositoryContext(database.db));
        const simService = new PolicySimulationService(repo);
        const comparison = await simService.comparePolicyVersions(
          tenant.organizationId,
          routeParams.policyId,
          v1,
          v2,
        );
        sendJson(response, 200, { comparison });
      },
    });

    // 21. List Governance Approval Requests
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const status = url.searchParams.get("status") as any;
        const agentId = url.searchParams.get("agentId") || undefined;
        const riskClassification = url.searchParams.get("riskClassification") as any;
        const assignedReviewerId = url.searchParams.get("assignedReviewerId") || undefined;
        const limit = Number(url.searchParams.get("limit") || "50");
        const offset = Number(url.searchParams.get("offset") || "0");

        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const govRepo = new AgentGovernanceRepository(repoCtx);
        const service = new AgentApprovalService(approvalRepo, govRepo);

        const approvals = await service.listApprovals(tenant.organizationId, {
          status,
          agentId,
          riskClassification,
          assignedReviewerId,
          limit,
          offset,
        });

        sendJson(response, 200, { approvals });
      },
    });

    // 22. Get Governance Approval Details
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals/:approvalId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const govRepo = new AgentGovernanceRepository(repoCtx);
        const service = new AgentApprovalService(approvalRepo, govRepo);

        const details = await service.getApprovalDetails(
          tenant.organizationId,
          routeParams.approvalId,
        );
        sendJson(response, 200, { details });
      },
    });

    // 23. Create Governance Approval Request
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as any;
        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const govRepo = new AgentGovernanceRepository(repoCtx);
        const service = new AgentApprovalService(approvalRepo, govRepo);

        const approvalRequest = await service.createApprovalRequest({
          ...body,
          organizationId: tenant.organizationId,
          requestingActorId: body.requestingActorId || authResult.user.id,
        });

        sendJson(response, 201, { approvalRequest });
      },
    });

    // 24. Approve Governance Approval Request
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals/:approvalId/approve",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as any;
        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const govRepo = new AgentGovernanceRepository(repoCtx);
        const service = new AgentApprovalService(approvalRepo, govRepo);

        const result = await service.decideApprovalRequest({
          approvalRequestId: routeParams.approvalId,
          organizationId: tenant.organizationId,
          decision: "approved",
          actorId: authResult.user.id,
          actorType: "user",
          userRoles: authResult.memberships?.filter(m => m.organizationId === tenant.organizationId).map(m => m.role) || [],
          userPermissions: authResult.memberships?.find(m => m.organizationId === tenant.organizationId)?.permissions || [],
          justification: body.justification,
          reason: body.reason,
        });

        sendJson(response, 200, result);
      },
    });

    // 25. Reject Governance Approval Request
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals/:approvalId/reject",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as any;
        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const govRepo = new AgentGovernanceRepository(repoCtx);
        const service = new AgentApprovalService(approvalRepo, govRepo);

        const result = await service.decideApprovalRequest({
          approvalRequestId: routeParams.approvalId,
          organizationId: tenant.organizationId,
          decision: "rejected",
          actorId: authResult.user.id,
          actorType: "user",
          userRoles: authResult.memberships?.filter(m => m.organizationId === tenant.organizationId).map(m => m.role) || [],
          userPermissions: authResult.memberships?.find(m => m.organizationId === tenant.organizationId)?.permissions || [],
          justification: body.justification,
          reason: body.reason,
        });

        sendJson(response, 200, result);
      },
    });

    // 26. Revoke Governance Approval Request
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals/:approvalId/revoke",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as any;
        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const govRepo = new AgentGovernanceRepository(repoCtx);
        const service = new AgentApprovalService(approvalRepo, govRepo);

        const result = await service.decideApprovalRequest({
          approvalRequestId: routeParams.approvalId,
          organizationId: tenant.organizationId,
          decision: "revoked",
          actorId: authResult.user.id,
          actorType: "user",
          userRoles: authResult.memberships?.filter(m => m.organizationId === tenant.organizationId).map(m => m.role) || [],
          userPermissions: authResult.memberships?.find(m => m.organizationId === tenant.organizationId)?.permissions || [],
          reason: body.reason,
        });

        sendJson(response, 200, result);
      },
    });

    // 27. Escalate Governance Approval Request
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals/:approvalId/escalate",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as any;
        if (!body.reason) {
          throw new ApiError(400, "VALIDATION_FAILED", "Escalation reason is required");
        }
        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const govRepo = new AgentGovernanceRepository(repoCtx);
        const service = new AgentApprovalService(approvalRepo, govRepo);

        const result = await service.escalateApprovalRequest({
          approvalRequestId: routeParams.approvalId,
          organizationId: tenant.organizationId,
          actorId: authResult.user.id,
          escalatedToReviewerId: body.escalatedToReviewerId,
          reason: body.reason,
        });

        sendJson(response, 200, result);
      },
    });

    // 28. Get Approval Status
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals/:approvalId/status",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const requestEntity = await approvalRepo.getRequestById(
          tenant.organizationId,
          routeParams.approvalId,
        );
        if (!requestEntity) {
          throw new ApiError(404, "NOT_FOUND", "Approval request not found");
        }
        sendJson(response, 200, {
          id: requestEntity.id,
          status: requestEntity.status,
          expiresAt: requestEntity.expiresAt,
          consumedAt: requestEntity.consumedAt,
          consumedBy: requestEntity.consumedBy,
          decisionId: requestEntity.decisionId,
        });
      },
    });

    // 29. Continue Approved Execution
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals/:approvalId/continue",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const govRepo = new AgentGovernanceRepository(repoCtx);
        const policyEngine = new PolicyEvaluationEngine(govRepo);
        const continuationService = new AgentApprovalContinuationService(
          approvalRepo,
          policyEngine,
          undefined,
          govRepo,
        );

        const result = await continuationService.continueApprovedExecution({
          approvalRequestId: routeParams.approvalId,
          organizationId: tenant.organizationId,
          actorId: authResult.user.id,
          providedPayload: body.providedPayload,
          idempotencyKey: body.idempotencyKey,
        });

        sendJson(response, 200, { continuation: result });
      },
    });

    // 30. Expire Sweep
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/approvals/expire-sweep",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const repoCtx = createRepositoryContext(database.db);
        const approvalRepo = new AgentApprovalRepository(repoCtx);
        const service = new AgentApprovalService(approvalRepo);
        const expired = await service.sweepExpiredApprovals(tenant.organizationId);
        sendJson(response, 200, { expiredCount: expired.length, expired });
      },
    });

    // =========================================================================
    // EPIC 22D — ENTERPRISE AGENT SECURITY CONTROLS, SANDBOXING & SECRETS
    // =========================================================================

    // 1. Get Security Posture
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/posture",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const gateway = new AgentSecurityGatewayService(secRepo);
        const posture = await gateway.getSecurityPosture(tenant.organizationId);
        sendJson(response, 200, posture);
      },
    });

    // 2. List Security Profiles / Capabilities
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/capabilities",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const isSuspParam = url.searchParams.get("isSuspended");
        const isSuspended = isSuspParam !== null ? isSuspParam === "true" : undefined;
        const profiles = await secRepo.listProfiles(tenant.organizationId, { isSuspended });
        sendJson(response, 200, { items: profiles, total: profiles.length });
      },
    });

    // 3. Get Agent Security Capability Profile
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/capabilities/:agentId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        let profile = await secRepo.getProfile(tenant.organizationId, routeParams.agentId);
        if (!profile) {
          profile = await secRepo.upsertProfile({
            organizationId: tenant.organizationId,
            agentId: routeParams.agentId,
          });
        }
        sendJson(response, 200, profile);
      },
    });

    // 4. Update Agent Security Capability Profile
    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/capabilities/:agentId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const updated = await secRepo.upsertProfile({
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          ...body,
        });
        sendJson(response, 200, updated);
      },
    });

    // 5. Suspend Agent
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/agents/:agentId/suspend",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.reason || typeof body.reason !== "string") {
          throw new ApiError(400, "VALIDATION_FAILED", "Suspension reason is required");
        }
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const gateway = new AgentSecurityGatewayService(secRepo);
        const updated = await gateway.suspendAgent({
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          suspendedBy: authResult.user.id,
          reason: body.reason,
        });
        sendJson(response, 200, updated);
      },
    });

    // 6. Reactivate Agent
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/agents/:agentId/reactivate",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const gateway = new AgentSecurityGatewayService(secRepo);
        const updated = await gateway.reactivateAgent({
          organizationId: tenant.organizationId,
          agentId: routeParams.agentId,
          actorId: authResult.user.id,
        });
        sendJson(response, 200, updated);
      },
    });

    // 7. Emergency Stop
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/emergency-stop",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const gateway = new AgentSecurityGatewayService(secRepo);
        await gateway.triggerEmergencyStop({
          organizationId: tenant.organizationId,
          workspaceId: body?.workspaceId,
          actorId: authResult.user.id,
          reason: body?.reason,
        });
        sendJson(response, 200, {
          status: "EMERGENCY_STOPPED",
          stoppedAt: new Date().toISOString(),
          stoppedBy: authResult.user.id,
        });
      },
    });

    // 8. Emergency Resume
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/emergency-resume",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const gateway = new AgentSecurityGatewayService(secRepo);
        await gateway.resumeEmergencyStop({
          organizationId: tenant.organizationId,
          workspaceId: body?.workspaceId,
          actorId: authResult.user.id,
        });
        sendJson(response, 200, {
          status: "RESUMED",
          resumedAt: new Date().toISOString(),
          resumedBy: authResult.user.id,
        });
      },
    });

    // 9. List Secret References
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/secrets",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const status = url.searchParams.get("status") as any;
        const agentId = url.searchParams.get("agentId") || undefined;
        const secrets = await secRepo.listSecretReferences(tenant.organizationId, { status, agentId });
        sendJson(response, 200, { items: secrets, total: secrets.length });
      },
    });

    // 10. Create Secret Reference
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/secrets",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.secretIdentifier || !body?.name) {
          throw new ApiError(400, "VALIDATION_FAILED", "secretIdentifier and name are required");
        }

        if (body.initialValue) {
          AgentSecretVaultService.registerSecretValue(
            tenant.organizationId,
            body.secretIdentifier,
            body.initialValue,
          );
        }

        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const created = await secRepo.createSecretReference({
          organizationId: tenant.organizationId,
          workspaceId: body.workspaceId,
          secretIdentifier: body.secretIdentifier,
          name: body.name,
          description: body.description,
          allowedAgentIds: body.allowedAgentIds || [],
          allowedToolKeys: body.allowedToolKeys || [],
          createdBy: authResult.user.id,
          metadata: body.metadata || {},
        });
        sendJson(response, 201, created);
      },
    });

    // 11. Revoke Secret Reference
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/secrets/:secretId/revoke",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const revoked = await secRepo.revokeSecretReference(tenant.organizationId, routeParams.secretId);
        if (!revoked) {
          throw new ApiError(404, "NOT_FOUND", "Secret reference not found");
        }
        sendJson(response, 200, revoked);
      },
    });

    // 12. Rotate Secret Reference
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/secrets/:secretId/rotate",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const rotated = await secRepo.rotateSecretReference(tenant.organizationId, routeParams.secretId);
        if (!rotated) {
          throw new ApiError(404, "NOT_FOUND", "Secret reference not found");
        }
        if (body?.newValue) {
          AgentSecretVaultService.registerSecretValue(
            tenant.organizationId,
            rotated.secretIdentifier,
            body.newValue,
          );
        }
        sendJson(response, 200, rotated);
      },
    });

    // 13. List Security Events
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/security/events",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const repoCtx = createRepositoryContext(database.db);
        const secRepo = new AgentSecurityRepository(repoCtx);
        const agentId = url.searchParams.get("agentId") || undefined;
        const eventType = (url.searchParams.get("eventType") as any) || undefined;
        const severity = (url.searchParams.get("severity") as any) || undefined;
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 50;

        const events = await secRepo.listEvents(tenant.organizationId, {
          agentId,
          eventType,
          severity,
          limit,
        });
        sendJson(response, 200, { items: events, total: events.length });
      },
    });

    // =========================================================================
    // EPIC 22E: Compliance, Audit Integrity & Evidence Management Endpoints
    // =========================================================================

    // 1. Compliance Overview
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/overview",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const service = new AgentComplianceService(database.db);
        const overview = await service.getComplianceOverview(tenant.organizationId);
        sendJson(response, 200, overview);
      },
    });

    // 2. Framework Listing
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/frameworks",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const service = new AgentComplianceService(database.db);
        const frameworks = await service.listFrameworks(tenant.organizationId);
        sendJson(response, 200, { items: frameworks, total: frameworks.length });
      },
    });

    // 3. Control Listing
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/controls",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const frameworkId = url.searchParams.get("frameworkId") || undefined;
        const category = url.searchParams.get("category") || undefined;
        const status = (url.searchParams.get("status") as any) || undefined;

        const service = new AgentComplianceService(database.db);
        const controls = await service.listControls(tenant.organizationId, {
          frameworkId,
          category,
          status,
        });
        sendJson(response, 200, { items: controls, total: controls.length });
      },
    });

    // 4. Get Control by ID
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/controls/:controlId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const service = new AgentComplianceService(database.db);
        const control = await service.getControl(tenant.organizationId, routeParams.controlId);
        if (!control) {
          throw new ApiError(404, "NOT_FOUND", "Compliance control not found");
        }
        sendJson(response, 200, control);
      },
    });

    // 5. Update Control Verification
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/controls/:controlId/verify",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.status) {
          throw new ApiError(400, "VALIDATION_FAILED", "Status is required");
        }
        const service = new AgentComplianceService(database.db);
        const updated = await service.verifyControl(tenant.organizationId, routeParams.controlId, {
          status: body.status,
          verifiedBy: authResult.user.id,
          exceptions: body.exceptions,
        });
        sendJson(response, 200, updated);
      },
    });

    // 6. Unified Audit Events Listing
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/audit/events",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const category = (url.searchParams.get("category") as any) || undefined;
        const eventType = url.searchParams.get("eventType") || undefined;
        const agentId = url.searchParams.get("agentId") || undefined;
        const correlationId = url.searchParams.get("correlationId") || undefined;
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 50;

        const repo = new AgentComplianceRepository(database.db);
        const { events, total } = await repo.listEvents(tenant.organizationId, {
          category,
          eventType,
          agentId,
          correlationId,
          limit,
        });
        sendJson(response, 200, { items: events, total });
      },
    });

    // 7. Verify Audit Integrity Chain
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/audit/verify",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const fromSeqParam = url.searchParams.get("fromSeq");
        const toSeqParam = url.searchParams.get("toSeq");
        const range =
          fromSeqParam || toSeqParam
            ? {
                fromSeq: fromSeqParam ? parseInt(fromSeqParam, 10) : undefined,
                toSeq: toSeqParam ? parseInt(toSeqParam, 10) : undefined,
              }
            : undefined;

        const service = new AgentComplianceService(database.db);
        const verification = await service.verifyAuditIntegrity(tenant.organizationId, range);
        sendJson(response, 200, verification);
      },
    });

    // 8. List Evidence
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/evidence",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const evidenceType = (url.searchParams.get("evidenceType") as any) || undefined;
        const classification = (url.searchParams.get("classification") as any) || undefined;
        const isUnderLegalHold = url.searchParams.has("isUnderLegalHold")
          ? url.searchParams.get("isUnderLegalHold") === "true"
          : undefined;
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 50;

        const service = new AgentComplianceService(database.db);
        const { evidence, total } = await service.listEvidence(tenant.organizationId, {
          evidenceType,
          classification,
          isUnderLegalHold,
          limit,
        });
        sendJson(response, 200, { items: evidence, total });
      },
    });

    // 9. Collect Evidence
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/evidence",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.title || !body?.evidenceType || !body?.source) {
          throw new ApiError(400, "VALIDATION_FAILED", "title, evidenceType, and source are required");
        }
        const service = new AgentComplianceService(database.db);
        const evidence = await service.collectEvidence(tenant.organizationId, {
          workspaceId: body.workspaceId,
          title: body.title,
          evidenceType: body.evidenceType,
          source: body.source,
          classification: body.classification,
          relatedControlIds: body.relatedControlIds,
          structuredPayload: body.structuredPayload,
          collectedBy: authResult.user.id,
        });
        sendJson(response, 201, evidence);
      },
    });

    // 10. Get Evidence Detail
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/evidence/:evidenceId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const service = new AgentComplianceService(database.db);
        const evidence = await service.getEvidence(tenant.organizationId, routeParams.evidenceId);
        if (!evidence) {
          throw new ApiError(404, "NOT_FOUND", "Evidence item not found");
        }
        sendJson(response, 200, evidence);
      },
    });

    // 11. List Evidence Packages
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/packages",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const service = new AgentComplianceService(database.db);
        const packages = await service.listEvidencePackages(tenant.organizationId);
        sendJson(response, 200, { items: packages, total: packages.length });
      },
    });

    // 12. Generate Evidence Package
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/packages",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!Array.isArray(body?.evidenceIds) || body.evidenceIds.length === 0) {
          throw new ApiError(400, "VALIDATION_FAILED", "evidenceIds array is required");
        }
        const service = new AgentComplianceService(database.db);
        const result = await service.generateEvidencePackage(tenant.organizationId, {
          workspaceId: body.workspaceId,
          packageIdentifier: body.packageIdentifier,
          evidenceIds: body.evidenceIds,
          auditEventIds: body.auditEventIds,
          exportedBy: authResult.user.id,
          redactionLevel: body.redactionLevel,
        });
        sendJson(response, 201, result);
      },
    });

    // 13. Get Evidence Package Detail
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/packages/:packageId",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const service = new AgentComplianceService(database.db);
        const pkg = await service.getEvidencePackage(tenant.organizationId, routeParams.packageId);
        if (!pkg) {
          throw new ApiError(404, "NOT_FOUND", "Evidence package not found");
        }
        sendJson(response, 200, pkg);
      },
    });

    // 14. Verify Package Offline
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/packages/verify",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.manifest) {
          throw new ApiError(400, "VALIDATION_FAILED", "manifest payload is required");
        }
        const service = new AgentComplianceService(database.db);
        const verification = service.verifyPackageOffline(body.manifest, body.expectedChecksum);
        sendJson(response, 200, verification);
      },
    });

    // 15. List Retention Policies
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/retention/policies",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const service = new AgentComplianceService(database.db);
        const policies = await service.listRetentionPolicies(tenant.organizationId);
        sendJson(response, 200, { items: policies, total: policies.length });
      },
    });

    // 16. Upsert Retention Policy
    router.register({
      method: "PUT",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/retention/policies",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.recordCategory || typeof body?.retentionDurationDays !== "number") {
          throw new ApiError(400, "VALIDATION_FAILED", "recordCategory and retentionDurationDays are required");
        }
        const service = new AgentComplianceService(database.db);
        const updated = await service.upsertRetentionPolicy({
          organizationId: tenant.organizationId,
          recordCategory: body.recordCategory,
          retentionDurationDays: body.retentionDurationDays,
          disposalAction: body.disposalAction,
          createdBy: authResult.user.id,
        });
        sendJson(response, 200, updated);
      },
    });

    // 17. Preview Disposal
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/retention/preview",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const service = new AgentComplianceService(database.db);
        const preview = await service.previewDisposal(tenant.organizationId);
        sendJson(response, 200, preview);
      },
    });

    // 18. List Legal Holds
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/holds",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const status = (url.searchParams.get("status") as any) || undefined;
        const service = new AgentComplianceService(database.db);
        const holds = await service.listLegalHolds(tenant.organizationId, status);
        sendJson(response, 200, { items: holds, total: holds.length });
      },
    });

    // 19. Create Legal Hold
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/holds",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.name || !body?.reason) {
          throw new ApiError(400, "VALIDATION_FAILED", "name and reason are required");
        }
        const service = new AgentComplianceService(database.db);
        const hold = await service.createLegalHold({
          organizationId: tenant.organizationId,
          name: body.name,
          description: body.description,
          reason: body.reason,
          scopeType: body.scopeType,
          scopeCriteria: body.scopeCriteria,
          createdBy: authResult.user.id,
        });
        sendJson(response, 201, hold);
      },
    });

    // 20. Release Legal Hold
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/holds/:holdIdentifier/release",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.justification) {
          throw new ApiError(400, "VALIDATION_FAILED", "justification is required");
        }
        const service = new AgentComplianceService(database.db);
        const released = await service.releaseLegalHold(
          tenant.organizationId,
          routeParams.holdIdentifier,
          authResult.user.id,
          body.justification,
        );
        sendJson(response, 200, released);
      },
    });

    // 21. List Investigations
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/investigations",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const status = (url.searchParams.get("status") as any) || undefined;
        const service = new AgentComplianceService(database.db);
        const investigations = await service.listInvestigations(tenant.organizationId, status);
        sendJson(response, 200, { items: investigations, total: investigations.length });
      },
    });

    // 22. Create Investigation
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/investigations",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.title) {
          throw new ApiError(400, "VALIDATION_FAILED", "title is required");
        }
        const service = new AgentComplianceService(database.db);
        const inv = await service.createInvestigation({
          organizationId: tenant.organizationId,
          title: body.title,
          description: body.description,
          investigatorId: authResult.user.id,
          searchFilters: body.searchFilters,
        });
        sendJson(response, 201, inv);
      },
    });

    // 23. Reconstruct Investigation Timeline
    router.register({
      method: "GET",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/investigations/timeline",
      async handler(request, response, { database, routeParams, url }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.read",
        );
        const correlationId = url.searchParams.get("correlationId") || undefined;
        const traceId = url.searchParams.get("traceId") || undefined;
        const agentId = url.searchParams.get("agentId") || undefined;

        const service = new AgentComplianceService(database.db);
        const timeline = await service.getInvestigationTimeline(tenant.organizationId, {
          correlationId,
          traceId,
          agentId,
          investigatorId: authResult.user.id,
        });
        sendJson(response, 200, timeline);
      },
    });

    // 24. Add Note to Investigation
    router.register({
      method: "POST",
      path: "/api/v1/organizations/:organizationId/agent-governance/compliance/investigations/:caseNumber/notes",
      async handler(request, response, { database, routeParams }) {
        const tenant = createTenantContext(routeParams.organizationId);
        const authResult = await new AuthService(database).requireOrganizationPermission(
          request,
          tenant.organizationId,
          "agent.manage",
        );
        const body = (request.body ?? {}) as any;
        if (!body?.note) {
          throw new ApiError(400, "VALIDATION_FAILED", "note is required");
        }
        const service = new AgentComplianceService(database.db);
        const updated = await service.addInvestigationNote(
          tenant.organizationId,
          routeParams.caseNumber,
          body.note,
          authResult.user.id,
        );
        sendJson(response, 200, updated);
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
