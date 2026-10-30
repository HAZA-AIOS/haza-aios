import { and, inArray, or, eq } from "drizzle-orm";
import { ApiError } from "../../../common/errors/api-error.js";
import { DatabaseClient, type DatabaseTransaction } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { knowledgeSources } from "../../../database/schema.js";
import { assertUuid } from "../../platform/tenant-context.js";
import { WorkspaceService } from "../../platform/services/workspace.service.js";
import type {
  AgentAuditEvent,
  AgentDefinitionWithTools,
  AgentTemplateRecord,
  CreateAgentInput,
  JsonRecord,
  UpdateAgentConfigurationInput,
  UpdateAgentStatusInput,
  UpsertAgentTemplateInput,
} from "../agent.types.js";
import { AgentRepository } from "../repositories/agent.repository.js";
import { AgentTemplateRepository } from "../repositories/agent-template.repository.js";
import {
  redactSensitiveConfig,
  validateActivationPrerequisites,
} from "../validation/agent-validation.js";
import { AiProviderRegistry } from "../providers/provider-registry.js";
import { ACADEMIC_PLANNING_AGENT_TEMPLATE } from "../academic-planning.types.js";

export const systemTemplates: UpsertAgentTemplateInput[] = [
  {
    id: "00000000-0000-4100-8000-000000000101",
    name: "Worksheet Creator",
    slug: "worksheet-creator",
    description:
      "Automatically generates customized student worksheets and quizzes based on subject and difficulty.",
    version: "1.0.0",
    category: "Education",
    industry: "Education",
    status: "available",
    icon: "📝",
    capabilities: [
      {
        key: "generate",
        name: "Educational content generation",
        description: "Generates educational materials",
        requiresApproval: false,
        riskLevel: "low",
      },
      {
        key: "transform",
        name: "Worksheet structuring",
        description: "Structures content into a worksheet format",
        requiresApproval: false,
        riskLevel: "low",
      },
      {
        key: "analyze",
        name: "Difficulty control",
        description: "Adjusts content based on grade and difficulty",
        requiresApproval: false,
        riskLevel: "low",
      },
      {
        key: "publish",
        name: "Curriculum publishing",
        description: "Publishes generated materials directly to active curriculum",
        requiresApproval: true,
        riskLevel: "medium",
      },
    ],
    requiredPermissions: ["module.education.view"],
    configurationSchema: {
      type: "object",
      properties: {
        gradeLevel: { type: "string" },
        subject: { type: "string" },
      },
    },
    inputSchema: {},
    outputSchema: {},
    defaultApprovalPolicy: {
      required: false,
      approverRoles: ["owner", "admin", "teacher"],
      fallbackAction: "deny",
      sensitiveCapabilities: ["publish"],
    },
    metadata: { source: "db11-system-template" },
  },
  {
    id: "00000000-0000-4100-8000-000000000102",
    name: "Sales Analyzer",
    slug: "sales-analyzer",
    description: "Analyzes quarterly sales data and predicts future revenue trends.",
    version: "1.0.0",
    category: "Analytics",
    industry: "corporate",
    status: "available",
    icon: "📈",
    capabilities: [
      {
        key: "analyze",
        name: "Data Analysis",
        description: "Analyzes structured data",
        requiresApproval: false,
        riskLevel: "low",
      },
      {
        key: "export",
        name: "Financial Export",
        description: "Exports financial reports",
        requiresApproval: true,
        riskLevel: "high",
      },
    ],
    requiredPermissions: ["module.sales.view"],
    configurationSchema: {
      type: "object",
      properties: {
        reportingCurrency: { type: "string" },
      },
    },
    inputSchema: {},
    outputSchema: {},
    defaultApprovalPolicy: {
      required: false,
      approverRoles: ["owner", "admin"],
      fallbackAction: "deny",
      sensitiveCapabilities: ["export"],
    },
    metadata: { source: "db11-system-template" },
  },
  {
    id: "00000000-0000-4100-8000-000000000103",
    name: "Clinical Note Summarizer",
    slug: "clinical-note-summarizer",
    description: "Assists healthcare providers by creating structured summaries of patient encounters.",
    version: "1.0.0",
    category: "Healthcare",
    industry: "Healthcare",
    status: "available",
    icon: "🩺",
    capabilities: [
      {
        key: "summarize",
        name: "Clinical Summarization",
        description: "Extracts key clinical findings",
        requiresApproval: false,
        riskLevel: "medium",
      },
      {
        key: "ehr_write",
        name: "EHR Record Update",
        description: "Writes clinical notes to patient record",
        requiresApproval: true,
        riskLevel: "high",
      },
    ],
    requiredPermissions: ["module.healthcare.view"],
    configurationSchema: {
      type: "object",
      properties: {
        specialty: { type: "string" },
      },
    },
    inputSchema: {},
    outputSchema: {},
    defaultApprovalPolicy: {
      required: true,
      approverRoles: ["owner", "admin", "physician"],
      escalationTimeoutHours: 24,
      fallbackAction: "deny",
      sensitiveCapabilities: ["ehr_write"],
    },
    metadata: { source: "db11-system-template" },
  },
  ACADEMIC_PLANNING_AGENT_TEMPLATE,
];

export class AgentService {
  constructor(private readonly database: DatabaseClient) {}

  async listTemplates(): Promise<AgentTemplateRecord[]> {
    await this.ensureTemplates();
    return new AgentTemplateRepository(createRepositoryContext(this.database.db)).listAvailable();
  }

  async listTemplatesPaginated(filter?: {
    category?: string;
    industry?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: AgentTemplateRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    await this.ensureTemplates();
    return new AgentTemplateRepository(createRepositoryContext(this.database.db)).listAvailablePaginated(filter);
  }

  async getTemplate(templateId: string): Promise<AgentTemplateRecord> {
    await this.ensureTemplates();
    const template = await new AgentTemplateRepository(
      createRepositoryContext(this.database.db),
    ).getById(templateId);
    if (!template) throw new ApiError(404, "NOT_FOUND", "Agent template not found.");
    return template;
  }

  async listAgents(organizationId: string): Promise<AgentDefinitionWithTools[]> {
    await this.ensureTemplates();
    return new AgentRepository(createRepositoryContext(this.database.db)).listByOrganization(
      organizationId,
    );
  }

  async listAgentsPaginated(
    organizationId: string,
    filter?: {
      status?: string;
      workspaceId?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{
    items: AgentDefinitionWithTools[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    await this.ensureTemplates();
    return new AgentRepository(createRepositoryContext(this.database.db)).listByOrganizationPaginated(
      organizationId,
      filter,
    );
  }

  async getAgent(organizationId: string, agentId: string): Promise<AgentDefinitionWithTools> {
    const agent = await new AgentRepository(
      createRepositoryContext(this.database.db),
    ).getByIdForOrganization(organizationId, agentId);
    if (!agent) throw new ApiError(404, "NOT_FOUND", "Agent not found.");
    return agent;
  }

  async createAgent(input: CreateAgentInput): Promise<AgentDefinitionWithTools> {
    return this.database.transaction(async (tx: DatabaseTransaction) => {
      const context = createRepositoryContext(tx);
      const templateRepository = new AgentTemplateRepository(context);
      const agentRepository = new AgentRepository(context);

      for (const template of systemTemplates) {
        await templateRepository.upsert(template);
      }

      const template = await templateRepository.getById(input.templateId);
      if (!template || template.status !== "available") {
        throw new ApiError(404, "NOT_FOUND", "Agent template not found.");
      }

      await new WorkspaceService({ ...this.database, db: tx as unknown as DatabaseClient["db"] }).getWorkspace(
        input.organizationId,
        input.workspaceId,
      );

      const existing = await agentRepository.getByWorkspaceAndTemplate(
        input.workspaceId,
        input.templateId,
      );
      if (existing) {
        if (existing.status !== "active") {
          const restored = await agentRepository.updateStatus(
            input.organizationId,
            existing.id,
            "active",
            true,
          );
          if (!restored) throw new Error("Agent restore failed.");

          await agentRepository.recordAuditEvent({
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            agentId: existing.id,
            actorUserId: input.createdBy,
            action: "agent.restore",
            operation: "update",
            result: "success",
            beforeSnapshot: { status: existing.status, enabled: existing.enabled },
            afterSnapshot: { status: restored.status, enabled: restored.enabled },
            changedFields: ["status", "enabled"],
            metadata: { restoredExisting: true },
          });

          return restored;
        }
        return existing;
      }

      const configuration = input.configuration
        ? { ...createDefaultConfiguration(template, input.createdBy), ...input.configuration }
        : createDefaultConfiguration(template, input.createdBy);

      const approvalPolicy = input.humanApprovalPolicy ?? template.defaultApprovalPolicy ?? null;

      const agent = await agentRepository.create({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        templateId: template.id,
        agentKey: template.slug,
        name: input.name ?? `${template.name} (Instance)`,
        description: input.description ?? template.description,
        status: "active",
        enabled: true,
        instructions: input.instructions ?? "",
        configuration,
        modelProvider: input.modelProvider ?? "mock",
        modelSelection: input.modelSelection ?? "mock-gpt-4o",
        humanApprovalPolicy: approvalPolicy,
        createdBy: input.createdBy,
      });

      await agentRepository.replaceToolAssignments(agent.id, readToolKeys(configuration));
      const reloaded = await agentRepository.getByIdForOrganization(input.organizationId, agent.id);
      if (!reloaded) throw new Error("Agent reload failed.");

      // Record audit event
      await agentRepository.recordAuditEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: reloaded.id,
        actorUserId: input.createdBy,
        action: "agent.create",
        operation: "create",
        result: "success",
        beforeSnapshot: null,
        afterSnapshot: {
          id: reloaded.id,
          name: reloaded.name,
          templateId: reloaded.templateId,
          status: reloaded.status,
          modelProvider: reloaded.modelProvider,
          modelSelection: reloaded.modelSelection,
          configuration: redactSensitiveConfig(reloaded.configuration) as Record<string, unknown>,
          humanApprovalPolicy: reloaded.humanApprovalPolicy,
        },
        changedFields: ["id", "name", "templateId", "status", "configuration", "modelProvider"],
        metadata: { templateSlug: template.slug },
      });

      return reloaded;
    });
  }

  async updateConfiguration(
    input: UpdateAgentConfigurationInput,
  ): Promise<AgentDefinitionWithTools> {
    return this.database.transaction(async (tx) => {
      const repository = new AgentRepository(createRepositoryContext(tx));
      const existing = await repository.getByIdForOrganization(input.organizationId, input.agentId);
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Agent not found.");
      if (existing.status === "archived") {
        throw new ApiError(400, "VALIDATION_FAILED", "Archived agents cannot be configured.");
      }

      const configuration: JsonRecord = {
        ...existing.configuration,
        ...input.configuration,
        updatedBy: input.updatedBy,
      };

      if (input.configuration.knowledge !== undefined) {
        const ids = input.configuration.knowledge;
        if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== "string")) {
          throw new ApiError(
            400,
            "VALIDATION_FAILED",
            "Knowledge must contain at most 100 source IDs.",
          );
        }
        for (const id of ids) assertUuid(id, "knowledgeId");
        if (ids.length) {
          const allowed = await tx
            .select({ id: knowledgeSources.id })
            .from(knowledgeSources)
            .where(
              and(
                eq(knowledgeSources.organizationId, input.organizationId),
                eq(knowledgeSources.status, "active"),
                inArray(knowledgeSources.id, ids),
                or(
                  eq(knowledgeSources.visibility, "internal"),
                  eq(knowledgeSources.createdBy, input.updatedBy),
                ),
              ),
            );
          if (allowed.length !== new Set(ids).size)
            throw new ApiError(404, "NOT_FOUND", "Knowledge source not found.");
        }
        configuration.knowledge = [...new Set(ids)];
      }

      const model = readRecord(configuration.model);
      const instructions = readRecord(configuration.instructions);
      const updatedInstructions =
        typeof input.instructions === "string"
          ? input.instructions
          : typeof instructions.systemInstructions === "string"
            ? instructions.systemInstructions
            : existing.instructions ?? "";

      const updatedProvider =
        input.modelProvider ?? (typeof model.provider === "string" ? model.provider : existing.modelProvider);
      const updatedModelSelection =
        input.modelSelection ?? (typeof model.modelSelection === "string" ? model.modelSelection : existing.modelSelection);

      const updatedApprovalPolicy =
        input.humanApprovalPolicy !== undefined ? input.humanApprovalPolicy : existing.humanApprovalPolicy;

      const updated = await repository.updateConfiguration(
        input.organizationId,
        input.agentId,
        configuration,
        updatedInstructions,
        updatedProvider,
        updatedModelSelection,
        updatedApprovalPolicy,
      );

      await repository.replaceToolAssignments(input.agentId, readToolKeys(configuration));
      if (!updated) throw new Error("Agent configuration update failed.");

      const reloaded = await repository.getByIdForOrganization(input.organizationId, input.agentId);
      if (!reloaded) throw new Error("Agent reload failed.");

      // Calculate changed fields
      const changedFields: string[] = ["configuration"];
      if (updatedInstructions !== existing.instructions) changedFields.push("instructions");
      if (updatedProvider !== existing.modelProvider) changedFields.push("modelProvider");
      if (updatedModelSelection !== existing.modelSelection) changedFields.push("modelSelection");
      if (input.humanApprovalPolicy !== undefined) changedFields.push("humanApprovalPolicy");

      // Record audit event
      await repository.recordAuditEvent({
        organizationId: input.organizationId,
        workspaceId: reloaded.workspaceId,
        agentId: reloaded.id,
        actorUserId: input.updatedBy,
        action: "agent.update_configuration",
        operation: "update",
        result: "success",
        beforeSnapshot: {
          configuration: redactSensitiveConfig(existing.configuration) as Record<string, unknown>,
          modelProvider: existing.modelProvider,
          modelSelection: existing.modelSelection,
          humanApprovalPolicy: existing.humanApprovalPolicy,
        },
        afterSnapshot: {
          configuration: redactSensitiveConfig(reloaded.configuration) as Record<string, unknown>,
          modelProvider: reloaded.modelProvider,
          modelSelection: reloaded.modelSelection,
          humanApprovalPolicy: reloaded.humanApprovalPolicy,
        },
        changedFields,
        metadata: { updatedBy: input.updatedBy },
      });

      return reloaded;
    });
  }

  async updateStatus(input: UpdateAgentStatusInput): Promise<AgentDefinitionWithTools> {
    const repository = new AgentRepository(createRepositoryContext(this.database.db));
    const existing = await repository.getByIdForOrganization(input.organizationId, input.agentId);
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Agent not found.");

    // Enforce activation prerequisites if transitioning to 'active'
    if (input.status === "active" && existing.templateId) {
      const template = await new AgentTemplateRepository(
        createRepositoryContext(this.database.db),
      ).getById(existing.templateId);
      if (template) {
        validateActivationPrerequisites(template, existing.configuration);
      }
    }

    const enabled = input.status === "active" || input.status === "configured";
    const agent = await repository.updateStatus(
      input.organizationId,
      input.agentId,
      input.status,
      enabled,
    );
    if (!agent) throw new ApiError(404, "NOT_FOUND", "Agent not found.");

    // Record audit event
    await repository.recordAuditEvent({
      organizationId: input.organizationId,
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      actorUserId: input.updatedBy ?? null,
      action: "agent.status_change",
      operation: "update",
      result: "success",
      beforeSnapshot: { status: existing.status, enabled: existing.enabled },
      afterSnapshot: { status: agent.status, enabled: agent.enabled },
      changedFields: ["status", "enabled"],
      metadata: { previousStatus: existing.status, targetStatus: input.status },
    });

    return agent;
  }

  async getAgentAuditHistory(
    organizationId: string,
    agentId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<{
    items: AgentAuditEvent[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    // Verify agent exists and belongs to organization
    await this.getAgent(organizationId, agentId);
    const repository = new AgentRepository(createRepositoryContext(this.database.db));
    return repository.getAuditHistory(organizationId, agentId, pagination);
  }

  async listProviders() {
    const registry = AiProviderRegistry.getInstance();
    const providers = registry.list();
    const result = await Promise.all(
      providers.map(async (provider) => {
        const models = await provider.listModels();
        return {
          id: provider.id,
          name: provider.name,
          version: provider.version,
          isDefault: provider.id === "mock",
          models,
        };
      }),
    );
    return result;
  }

  private async ensureTemplates(): Promise<void> {
    const repository = new AgentTemplateRepository(createRepositoryContext(this.database.db));
    for (const template of systemTemplates) {
      await repository.upsert(template);
    }
  }
}

function createDefaultConfiguration(template: AgentTemplateRecord, userId: string): JsonRecord {
  return {
    version: "1.0",
    general: { description: template.description },
    instructions: { systemInstructions: "", objectives: "", constraints: "", responseStyle: "" },
    behavior: {
      tone: "Neutral",
      formality: "Standard",
      creativity: 50,
      responseLength: "Medium",
      language: "English",
      communicationStyle: "Direct",
    },
    inputs: [],
    outputs: [],
    tools: template.capabilities.map((c) => c.key),
    knowledge: [],
    model: {
      provider: "mock",
      modelSelection: "mock-gpt-4o",
      responseQuality: "Balanced",
      temperature: 0.7,
      tokenLimits: 2048,
    },
    memory: {
      enabled: true,
      conversationContext: true,
      persistentMemory: false,
      organizationKnowledgeFoundation: false,
    },
    notifications: {
      inApp: true,
      email: false,
      onSuccess: false,
      onFailure: true,
      requireApproval: template.defaultApprovalPolicy?.required ?? false,
    },
    advanced: {
      executionLimits: 100,
      timeoutSeconds: 30,
      retryCount: 1,
      loggingLevel: "Info",
      debugMode: false,
    },
    updatedBy: userId,
  };
}

function readToolKeys(configuration: JsonRecord): string[] {
  const tools = configuration.tools;
  return Array.isArray(tools)
    ? tools.filter((item): item is string => typeof item === "string")
    : [];
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}
