import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { withTransaction } from "../../../database/transactions.js";
import { WorkspaceService } from "../../platform/services/workspace.service.js";
import type { AgentDefinitionWithTools, AgentTemplateRecord, CreateAgentInput, JsonRecord, UpdateAgentConfigurationInput, UpdateAgentStatusInput, UpsertAgentTemplateInput } from "../agent.types.js";
import { AgentRepository } from "../repositories/agent.repository.js";
import { AgentTemplateRepository } from "../repositories/agent-template.repository.js";

const systemTemplates: UpsertAgentTemplateInput[] = [
  {
    id: "00000000-0000-4100-8000-000000000101",
    name: "Worksheet Creator",
    slug: "worksheet-creator",
    description: "Automatically generates customized student worksheets and quizzes based on subject and difficulty.",
    version: "1.0.0",
    category: "Education",
    industry: "Education",
    status: "available",
    icon: "📝",
    capabilities: [
      { key: "generate", name: "Educational content generation", description: "Generates educational materials" },
      { key: "transform", name: "Worksheet structuring", description: "Structures content into a worksheet format" },
      { key: "analyze", name: "Difficulty control", description: "Adjusts content based on grade and difficulty" },
    ],
    requiredPermissions: ["module.education.view"],
    configurationSchema: {},
    inputSchema: {},
    outputSchema: {},
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
      { key: "analyze", name: "Data Analysis", description: "Analyzes structured data" },
    ],
    requiredPermissions: ["module.sales.view"],
    configurationSchema: {},
    inputSchema: {},
    outputSchema: {},
    metadata: { source: "db11-system-template" },
  },
];

export class AgentService {
  constructor(private readonly database: DatabaseClient) {}

  async listTemplates(): Promise<AgentTemplateRecord[]> {
    await this.ensureTemplates();
    return new AgentTemplateRepository(createRepositoryContext(this.database.db)).listAvailable();
  }

  async getTemplate(templateId: string): Promise<AgentTemplateRecord> {
    await this.ensureTemplates();
    const template = await new AgentTemplateRepository(createRepositoryContext(this.database.db)).getById(templateId);
    if (!template) throw new ApiError(404, "NOT_FOUND", "Agent template not found.");
    return template;
  }

  async listAgents(organizationId: string): Promise<AgentDefinitionWithTools[]> {
    await this.ensureTemplates();
    return new AgentRepository(createRepositoryContext(this.database.db)).listByOrganization(organizationId);
  }

  async getAgent(organizationId: string, agentId: string): Promise<AgentDefinitionWithTools> {
    const agent = await new AgentRepository(createRepositoryContext(this.database.db)).getByIdForOrganization(organizationId, agentId);
    if (!agent) throw new ApiError(404, "NOT_FOUND", "Agent not found.");
    return agent;
  }

  async createAgent(input: CreateAgentInput): Promise<AgentDefinitionWithTools> {
    return withTransaction(this.database, async ({ tx }) => {
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

      await new WorkspaceService({ ...this.database, db: tx }).getWorkspace(input.organizationId, input.workspaceId);

      const existing = await agentRepository.getByWorkspaceAndTemplate(input.workspaceId, input.templateId);
      if (existing) {
        if (existing.status !== "active") {
          const restored = await agentRepository.updateStatus(input.organizationId, existing.id, "active", true);
          if (!restored) throw new Error("Agent restore failed.");
          return restored;
        }
        return existing;
      }

      const configuration = createDefaultConfiguration(template, input.createdBy);
      const agent = await agentRepository.create({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        templateId: template.id,
        agentKey: template.slug,
        name: input.name ?? `${template.name} (Instance)`,
        description: template.description,
        status: "active",
        enabled: true,
        instructions: "",
        configuration,
        modelProvider: "Platform Default",
        modelSelection: "Auto",
        createdBy: input.createdBy,
      });

      await agentRepository.replaceToolAssignments(agent.id, readToolKeys(configuration));
      const reloaded = await agentRepository.getByIdForOrganization(input.organizationId, agent.id);
      if (!reloaded) throw new Error("Agent reload failed.");
      return reloaded;
    });
  }

  async updateConfiguration(input: UpdateAgentConfigurationInput): Promise<AgentDefinitionWithTools> {
    return withTransaction(this.database, async ({ tx }) => {
      const repository = new AgentRepository(createRepositoryContext(tx));
      const existing = await repository.getByIdForOrganization(input.organizationId, input.agentId);
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Agent not found.");
      if (existing.status === "archived") throw new ApiError(400, "VALIDATION_FAILED", "Archived agents cannot be configured.");

      const configuration: JsonRecord = {
        ...existing.configuration,
        ...input.configuration,
        updatedBy: input.updatedBy,
      };
      const model = readRecord(configuration.model);
      const instructions = readRecord(configuration.instructions);
      const updated = await repository.updateConfiguration(
        input.organizationId,
        input.agentId,
        configuration,
        typeof instructions.systemInstructions === "string" ? instructions.systemInstructions : "",
        typeof model.provider === "string" ? model.provider : existing.modelProvider,
        typeof model.modelSelection === "string" ? model.modelSelection : existing.modelSelection,
      );

      await repository.replaceToolAssignments(input.agentId, readToolKeys(configuration));
      if (!updated) throw new Error("Agent configuration update failed.");
      return repository.getByIdForOrganization(input.organizationId, input.agentId).then((agent) => {
        if (!agent) throw new Error("Agent reload failed.");
        return agent;
      });
    });
  }

  async updateStatus(input: UpdateAgentStatusInput): Promise<AgentDefinitionWithTools> {
    const enabled = input.status === "active" || input.status === "configured";
    const agent = await new AgentRepository(createRepositoryContext(this.database.db)).updateStatus(input.organizationId, input.agentId, input.status, enabled);
    if (!agent) throw new ApiError(404, "NOT_FOUND", "Agent not found.");
    return agent;
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
    behavior: { tone: "Neutral", formality: "Standard", creativity: 50, responseLength: "Medium", language: "English", communicationStyle: "Direct" },
    inputs: [],
    outputs: [],
    tools: [],
    knowledge: [],
    model: { provider: "Platform Default", modelSelection: "Auto", responseQuality: "Balanced", temperature: 0.7, tokenLimits: 2048 },
    memory: { enabled: true, conversationContext: true, persistentMemory: false, organizationKnowledgeFoundation: false },
    notifications: { inApp: true, email: false, onSuccess: false, onFailure: true, requireApproval: false },
    advanced: { executionLimits: 100, timeoutSeconds: 30, retryCount: 1, loggingLevel: "Info", debugMode: false },
    updatedBy: userId,
  };
}

function readToolKeys(configuration: JsonRecord): string[] {
  const tools = configuration.tools;
  return Array.isArray(tools) ? tools.filter((item): item is string => typeof item === "string") : [];
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}
