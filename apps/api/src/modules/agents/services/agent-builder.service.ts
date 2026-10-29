import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../../common/errors/api-error.js";
import { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import {
  aiAgentDefinitions,
  knowledgeSources,
} from "../../../database/schema.js";
import { assertUuid } from "../../platform/tenant-context.js";
import type {
  AgentBuilderDraftInput,
  AgentBuilderDuplicateInput,
  AgentBuilderFullConfig,
  AgentBuilderPreviewInput,
  AgentBuilderPreviewResult,
  AgentBuilderPublishInput,
  AgentConfigurationRevisionRecord,
  AgentDefinitionRecord,
  AgentDefinitionWithTools,
  HumanApprovalPolicy,
  JsonRecord,
  RevisionDiffItem,
} from "../agent.types.js";
import { AgentRepository } from "../repositories/agent.repository.js";
import { AgentBuilderRepository } from "../repositories/agent-builder.repository.js";
import {
  compileSystemInstructions,
  validateBuilderConfiguration,
} from "../validation/agent-builder-validation.js";
import { AiProviderRegistry } from "../providers/provider-registry.js";
import type { ToolCall, ToolDeclaration } from "../providers/ai-provider.types.js";

// Built-in standard tool catalog for selection in builder
export const REGISTERED_BUILDER_TOOLS = [
  {
    toolKey: "web_search",
    name: "Web Search",
    description: "Search public web sources for factual information and citations.",
    category: "Information",
    riskLevel: "low" as const,
    requiresApproval: false,
    permissions: ["tool.search.web"],
  },
  {
    toolKey: "document_parser",
    name: "Document & PDF Parser",
    description: "Extract text, tables, and metadata from uploaded documents.",
    category: "Data Processing",
    riskLevel: "low" as const,
    requiresApproval: false,
    permissions: ["tool.document.parse"],
  },
  {
    toolKey: "data_calculator",
    name: "Math & Statistical Calculator",
    description: "Perform precise numerical computations and statistical aggregations.",
    category: "Computation",
    riskLevel: "low" as const,
    requiresApproval: false,
    permissions: ["tool.calculate"],
  },
  {
    toolKey: "database_query_readonly",
    name: "Read-Only Database Query",
    description: "Execute structured read-only queries against authorized organizational views.",
    category: "Data Access",
    riskLevel: "medium" as const,
    requiresApproval: false,
    permissions: ["tool.db.read"],
  },
  {
    toolKey: "database_write",
    name: "Database Record Writer",
    description: "Create or modify organizational records directly in the workspace.",
    category: "Data Modification",
    riskLevel: "high" as const,
    requiresApproval: true,
    permissions: ["tool.db.write"],
  },
  {
    toolKey: "email_notification_dispatcher",
    name: "Email Dispatcher",
    description: "Send templated notification emails to internal or external recipients.",
    category: "Communication",
    riskLevel: "medium" as const,
    requiresApproval: true,
    permissions: ["tool.email.send"],
  },
  {
    toolKey: "external_webhook_executor",
    name: "External Webhook Invoker",
    description: "Trigger third-party webhook endpoints with formatted JSON payloads.",
    category: "Integration",
    riskLevel: "high" as const,
    requiresApproval: true,
    permissions: ["tool.webhook.call"],
  },
];

export const REGISTERED_BUILDER_CAPABILITIES = [
  {
    key: "generate",
    name: "Content Generation",
    description: "Generate structured and unstructured educational, analytical, or business content.",
    riskLevel: "low" as const,
    requiresApproval: false,
  },
  {
    key: "transform",
    name: "Data Transformation",
    description: "Format, translate, summarize, and adapt text and datasets.",
    riskLevel: "low" as const,
    requiresApproval: false,
  },
  {
    key: "analyze",
    name: "In-Depth Analysis",
    description: "Evaluate inputs, metrics, trends, and qualitative feedback.",
    riskLevel: "low" as const,
    requiresApproval: false,
  },
  {
    key: "publish",
    name: "Direct Publishing",
    description: "Publish finalized materials directly to live curriculum or active portals.",
    riskLevel: "medium" as const,
    requiresApproval: true,
  },
  {
    key: "execute_action",
    name: "Automated Action Execution",
    description: "Trigger external workflows or automated modification of system states.",
    riskLevel: "high" as const,
    requiresApproval: true,
  },
];

// Simple in-memory sliding window rate limiter for preview calls
const previewCallLog = new Map<string, number[]>();

export class AgentBuilderService {
  constructor(private readonly database: DatabaseClient) {}

  async getCatalogOptions(organizationId: string) {
    assertUuid(organizationId, "organizationId");

    const providerRegistry = AiProviderRegistry.getInstance();
    const allProviders = providerRegistry.list();
    const allModels = await providerRegistry.listAllModels();

    // Query active knowledge sources for the organization
    const orgKnowledge = await this.database.db
      .select({
        id: knowledgeSources.id,
        name: knowledgeSources.name,
        type: knowledgeSources.type,
        status: knowledgeSources.status,
        visibility: knowledgeSources.visibility,
      })
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.organizationId, organizationId),
          eq(knowledgeSources.status, "active"),
        ),
      );

    return {
      providers: allProviders.map((p) => ({
        id: p.id,
        name: p.name,
        version: p.version,
      })),
      models: allModels.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        contextWindow: m.contextWindow,
        maxOutputTokens: m.maxOutputTokens,
        capabilities: m.capabilities,
      })),
      capabilities: REGISTERED_BUILDER_CAPABILITIES,
      tools: REGISTERED_BUILDER_TOOLS,
      knowledgeSources: orgKnowledge.map((k: { id: string; name: string; type: string; status: string }) => ({
        id: k.id,
        name: k.name,
        type: k.type,
        status: k.status,
      })),
    };
  }

  async getBuilderContext(organizationId: string, agentId: string) {
    assertUuid(organizationId, "organizationId");
    assertUuid(agentId, "agentId");

    return this.database.transaction(async (tx) => {
      const repoContext = createRepositoryContext(tx);
      const agentRepo = new AgentRepository(repoContext);
      const builderRepo = new AgentBuilderRepository(repoContext);

      const agent = await agentRepo.getByIdForOrganization(organizationId, agentId);
      if (!agent) {
        throw new ApiError(404, "NOT_FOUND", "Agent definition not found.");
      }

      const [activeRev, draftRev, latestRev, totalRevs] = await Promise.all([
        builderRepo.getActivePublishedRevision(organizationId, agentId),
        builderRepo.getDraftRevision(organizationId, agentId),
        builderRepo.getLatestRevision(organizationId, agentId),
        builderRepo.listRevisions(organizationId, agentId, { page: 1, pageSize: 1 }),
      ]);

      const catalog = await this.getCatalogOptions(organizationId);

      // If no draft exists, generate a synthesized draft from the current active configuration
      let workingDraft = draftRev;
      if (!workingDraft) {
        workingDraft = {
          id: "draft-in-memory",
          organizationId,
          workspaceId: agent.workspaceId,
          agentId: agent.id,
          revisionNumber: (activeRev?.revisionNumber ?? 0) + 1,
          version: `${agent.installedVersion ?? "1.0.0"}-draft`,
          status: "draft",
          configuration: this.synthesizeFullConfig(agent, activeRev?.configuration),
          validationStatus: "valid",
          validationErrors: null,
          changelog: null,
          createdBy: agent.createdBy,
          publishedBy: null,
          publishedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      return {
        agent,
        activeRevision: activeRev,
        draftRevision: workingDraft,
        latestRevision: latestRev,
        totalRevisions: totalRevs.total,
        catalogOptions: catalog,
      };
    });
  }

  async saveDraft(input: AgentBuilderDraftInput) {
    assertUuid(input.organizationId, "organizationId");
    assertUuid(input.agentId, "agentId");

    return this.database.transaction(async (tx) => {
      const repoContext = createRepositoryContext(tx);
      const agentRepo = new AgentRepository(repoContext);
      const builderRepo = new AgentBuilderRepository(repoContext);

      const agent = await agentRepo.getByIdForOrganization(input.organizationId, input.agentId);
      if (!agent) {
        throw new ApiError(404, "NOT_FOUND", "Agent definition not found.");
      }
      if (agent.status === "archived") {
        throw new ApiError(400, "VALIDATION_FAILED", "Archived agents cannot be edited.");
      }

      // Fetch org knowledge IDs for tenant validation
      const allowedKnowledge = await tx
        .select({ id: knowledgeSources.id })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.organizationId, input.organizationId),
            eq(knowledgeSources.status, "active"),
          ),
        );
      const allowedKnowledgeIds = allowedKnowledge.map((k) => k.id);

      const validation = validateBuilderConfiguration(input.configuration, {
        allowedKnowledgeIds,
      });

      const existingDraft = await builderRepo.getDraftRevision(input.organizationId, input.agentId);

      let savedRevision: AgentConfigurationRevisionRecord;
      if (existingDraft) {
        const updated = await builderRepo.updateRevision(existingDraft.id, {
          configuration: input.configuration as any,
          version: input.version ?? existingDraft.version,
          validationStatus: validation.status,
          validationErrors: validation.errors.concat(validation.warnings),
          changelog: input.changelog ?? existingDraft.changelog,
        });
        if (!updated) throw new Error("Failed to update existing draft revision.");
        savedRevision = updated;
      } else {
        const nextRevNumber = await builderRepo.getNextRevisionNumber(input.agentId);
        savedRevision = await builderRepo.createRevision({
          organizationId: input.organizationId,
          workspaceId: agent.workspaceId,
          agentId: input.agentId,
          revisionNumber: nextRevNumber,
          version: input.version ?? `${agent.installedVersion ?? "1.0.0"}-draft`,
          status: "draft",
          configuration: input.configuration as any,
          validationStatus: validation.status,
          validationErrors: validation.errors.concat(validation.warnings),
          changelog: input.changelog ?? "Draft saved",
          createdBy: input.userId,
        });
      }

      await agentRepo.recordAuditEvent({
        organizationId: input.organizationId,
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        actorUserId: input.userId,
        action: "agent.builder_draft_saved",
        operation: "update",
        result: "success",
        afterSnapshot: savedRevision as any,
        metadata: {
          revisionNumber: savedRevision.revisionNumber,
          validationStatus: validation.status,
        },
      });

      return {
        revision: savedRevision,
        validation,
      };
    });
  }

  async publishRevision(input: AgentBuilderPublishInput) {
    assertUuid(input.organizationId, "organizationId");
    assertUuid(input.agentId, "agentId");

    return this.database.transaction(async (tx) => {
      const repoContext = createRepositoryContext(tx);
      const agentRepo = new AgentRepository(repoContext);
      const builderRepo = new AgentBuilderRepository(repoContext);

      const agent = await agentRepo.getByIdForOrganization(input.organizationId, input.agentId);
      if (!agent) {
        throw new ApiError(404, "NOT_FOUND", "Agent definition not found.");
      }
      if (agent.status === "archived") {
        throw new ApiError(400, "VALIDATION_FAILED", "Archived agents cannot be published.");
      }

      // Fetch candidate revision to publish
      let revision: AgentConfigurationRevisionRecord | null = null;
      if (input.revisionId) {
        revision = await builderRepo.getRevisionById(input.organizationId, input.agentId, input.revisionId);
      } else {
        revision = await builderRepo.getDraftRevision(input.organizationId, input.agentId);
      }

      if (!revision) {
        throw new ApiError(404, "NOT_FOUND", "No draft revision found to publish.");
      }

      // Strict validation before publishing
      const allowedKnowledge = await tx
        .select({ id: knowledgeSources.id })
        .from(knowledgeSources)
        .where(
          and(
            eq(knowledgeSources.organizationId, input.organizationId),
            eq(knowledgeSources.status, "active"),
          ),
        );
      const allowedKnowledgeIds = allowedKnowledge.map((k) => k.id);

      const validation = validateBuilderConfiguration(revision.configuration, {
        allowedKnowledgeIds,
      });

      if (!validation.valid) {
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          `Cannot publish configuration with blocking errors: ${validation.errors.map((e) => e.message).join("; ")}`,
          { errors: validation.errors },
        );
      }

      const config = revision.configuration as unknown as AgentBuilderFullConfig;
      const compiledInstructions = compileSystemInstructions(config.instructions as any);

      // Determine clean semantic version
      const publishedVersion = input.version ?? revision.version.replace(/-draft$/, "");

      // Promote revision to 'published'
      const now = new Date();
      const updatedRev = await builderRepo.updateRevision(revision.id, {
        status: "published",
        version: publishedVersion,
        validationStatus: "valid",
        validationErrors: null,
        changelog: input.changelog ?? revision.changelog ?? "Published revision",
        publishedBy: input.userId,
        publishedAt: now,
      });

      if (!updatedRev) throw new Error("Failed to promote revision to published.");

      // Update active definition
      const humanApprovalPolicy: HumanApprovalPolicy = {
        required: config.humanApproval.policy !== "never",
        approverRoles: config.humanApproval.approverRoles,
        escalationTimeoutHours: config.humanApproval.escalationTimeoutHours,
        fallbackAction: config.humanApproval.fallbackAction,
        sensitiveCapabilities: config.humanApproval.sensitiveCapabilities,
      };

      await builderRepo.updateActiveAgentConfiguration(
        agent.id,
        updatedRev.id,
        updatedRev.revisionNumber,
        config as any,
        compiledInstructions,
        config.model.provider,
        config.model.modelSelection,
        humanApprovalPolicy,
      );

      // Update name and description if altered
      if (
        config.identity.name !== agent.name ||
        config.identity.description !== agent.description
      ) {
        await tx
          .update(aiAgentDefinitions)
          .set({
            name: config.identity.name,
            description: config.identity.description,
            updatedAt: now,
          })
          .where(eq(aiAgentDefinitions.id, agent.id));
      }

      // Sync tool assignments
      const toolKeys = Array.isArray(config.tools)
        ? config.tools.map((t) => t.toolKey).filter(Boolean)
        : [];
      await agentRepo.replaceToolAssignments(agent.id, toolKeys);

      // Audit event
      await agentRepo.recordAuditEvent({
        organizationId: input.organizationId,
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        actorUserId: input.userId,
        action: "agent.builder_published",
        operation: "publish",
        result: "success",
        afterSnapshot: updatedRev as any,
        metadata: {
          revisionNumber: updatedRev.revisionNumber,
          version: publishedVersion,
        },
      });

      const reloadedAgent = await agentRepo.getByIdForOrganization(input.organizationId, agent.id);
      return {
        revision: updatedRev,
        agent: reloadedAgent,
      };
    });
  }

  async duplicateAgent(input: AgentBuilderDuplicateInput) {
    assertUuid(input.organizationId, "organizationId");
    assertUuid(input.workspaceId, "workspaceId");
    assertUuid(input.sourceAgentId, "sourceAgentId");

    return this.database.transaction(async (tx) => {
      const repoContext = createRepositoryContext(tx);
      const agentRepo = new AgentRepository(repoContext);
      const builderRepo = new AgentBuilderRepository(repoContext);

      const sourceAgent = await agentRepo.getByIdForOrganization(
        input.organizationId,
        input.sourceAgentId,
      );
      if (!sourceAgent) {
        throw new ApiError(404, "NOT_FOUND", "Source agent definition not found.");
      }

      // Validate new agentKey format
      if (!/^[a-z0-9_-]+$/i.test(input.newAgentKey)) {
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          "New agent key must contain only alphanumeric characters, hyphens, or underscores.",
        );
      }

      // Check key uniqueness
      const existingWithKey = await tx
        .select({ id: aiAgentDefinitions.id })
        .from(aiAgentDefinitions)
        .where(
          and(
            eq(aiAgentDefinitions.workspaceId, input.workspaceId),
            eq(aiAgentDefinitions.agentKey, input.newAgentKey),
          ),
        )
        .limit(1);

      if (existingWithKey.length > 0) {
        throw new ApiError(
          409,
          "DATABASE_UNIQUE_CONSTRAINT",
          `An agent with key '${input.newAgentKey}' already exists in this workspace.`,
        );
      }

      // Prepare cloned configuration
      const sourceActiveRev = await builderRepo.getActivePublishedRevision(
        input.organizationId,
        input.sourceAgentId,
      );
      const baseConfig = this.synthesizeFullConfig(sourceAgent, sourceActiveRev?.configuration);

      const clonedConfig: AgentBuilderFullConfig = {
        ...baseConfig,
        identity: {
          ...baseConfig.identity,
          name: input.newName,
          agentKey: input.newAgentKey,
          description: `Copy of ${sourceAgent.name}: ${baseConfig.identity.description}`,
        },
      };

      const newAgentId = randomUUID();
      const now = new Date();

      await tx.insert(aiAgentDefinitions).values({
        id: newAgentId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        templateId: sourceAgent.templateId ?? null,
        templateVersionId: sourceAgent.templateVersionId ?? null,
        installedVersion: "1.0.0",
        installedFromMarketplace: false,
        activeRevisionNumber: 1,
        agentKey: input.newAgentKey,
        name: input.newName,
        description: clonedConfig.identity.description,
        status: "configured",
        enabled: true,
        instructions: sourceAgent.instructions,
        configuration: clonedConfig as any,
        modelProvider: sourceAgent.modelProvider,
        modelSelection: sourceAgent.modelSelection,
        createdBy: input.userId,
        humanApprovalPolicy: sourceAgent.humanApprovalPolicy as any,
        createdAt: now,
        updatedAt: now,
      });

      // Create Revision 1 for the new agent
      const rev1 = await builderRepo.createRevision({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: newAgentId,
        revisionNumber: 1,
        version: "1.0.0",
        status: "published",
        configuration: clonedConfig as any,
        validationStatus: "valid",
        changelog: `Duplicated from agent '${sourceAgent.name}' (${sourceAgent.id})`,
        createdBy: input.userId,
        publishedBy: input.userId,
        publishedAt: now,
      });

      await builderRepo.updateActiveAgentConfiguration(
        newAgentId,
        rev1.id,
        1,
        clonedConfig as any,
      );

      // Copy tool assignments
      if (sourceAgent.tools && sourceAgent.tools.length > 0) {
        await agentRepo.replaceToolAssignments(
          newAgentId,
          sourceAgent.tools.map((t) => t.toolKey),
        );
      }

      await agentRepo.recordAuditEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: newAgentId,
        actorUserId: input.userId,
        action: "agent.builder_duplicated",
        operation: "create",
        result: "success",
        metadata: {
          sourceAgentId: sourceAgent.id,
          sourceName: sourceAgent.name,
        },
      });

      const created = await agentRepo.getByIdForOrganization(input.organizationId, newAgentId);
      return {
        agent: created,
        revision: rev1,
      };
    });
  }

  async createNewAgent(input: {
    organizationId: string;
    workspaceId: string;
    userId: string;
    configuration: AgentBuilderFullConfig;
  }) {
    assertUuid(input.organizationId, "organizationId");
    assertUuid(input.workspaceId, "workspaceId");

    return this.database.transaction(async (tx) => {
      const repoContext = createRepositoryContext(tx);
      const agentRepo = new AgentRepository(repoContext);
      const builderRepo = new AgentBuilderRepository(repoContext);

      const validation = validateBuilderConfiguration(input.configuration);
      if (!validation.valid) {
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          `Validation failed: ${validation.errors.map((e) => e.message).join("; ")}`,
          { errors: validation.errors },
        );
      }

      // Check agentKey uniqueness
      const existing = await tx
        .select({ id: aiAgentDefinitions.id })
        .from(aiAgentDefinitions)
        .where(
          and(
            eq(aiAgentDefinitions.workspaceId, input.workspaceId),
            eq(aiAgentDefinitions.agentKey, input.configuration.identity.agentKey),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new ApiError(
          409,
          "DATABASE_UNIQUE_CONSTRAINT",
          `An agent with key '${input.configuration.identity.agentKey}' already exists in this workspace.`,
        );
      }

      const agentId = randomUUID();
      const now = new Date();
      const compiledInstructions = compileSystemInstructions(input.configuration.instructions as any);

      const humanApprovalPolicy: HumanApprovalPolicy = {
        required: input.configuration.humanApproval.policy !== "never",
        approverRoles: input.configuration.humanApproval.approverRoles,
        escalationTimeoutHours: input.configuration.humanApproval.escalationTimeoutHours,
        fallbackAction: input.configuration.humanApproval.fallbackAction,
        sensitiveCapabilities: input.configuration.humanApproval.sensitiveCapabilities,
      };

      await tx.insert(aiAgentDefinitions).values({
        id: agentId,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        templateId: null,
        templateVersionId: null,
        installedVersion: "1.0.0",
        installedFromMarketplace: false,
        activeRevisionNumber: 1,
        agentKey: input.configuration.identity.agentKey,
        name: input.configuration.identity.name,
        description: input.configuration.identity.description,
        status: "configured",
        enabled: true,
        instructions: compiledInstructions,
        configuration: input.configuration as any,
        modelProvider: input.configuration.model.provider,
        modelSelection: input.configuration.model.modelSelection,
        createdBy: input.userId,
        humanApprovalPolicy: humanApprovalPolicy as any,
        createdAt: now,
        updatedAt: now,
      });

      // Create initial Revision 1 as draft
      const rev1 = await builderRepo.createRevision({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId,
        revisionNumber: 1,
        version: "1.0.0-draft",
        status: "draft",
        configuration: input.configuration as any,
        validationStatus: validation.status,
        changelog: "Initial creation",
        createdBy: input.userId,
      });

      // Tool assignments
      const toolKeys = Array.isArray(input.configuration.tools)
        ? input.configuration.tools.map((t) => t.toolKey).filter(Boolean)
        : [];
      if (toolKeys.length > 0) {
        await agentRepo.replaceToolAssignments(agentId, toolKeys);
      }

      await agentRepo.recordAuditEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId,
        actorUserId: input.userId,
        action: "agent.builder_created",
        operation: "create",
        result: "success",
        metadata: {
          agentKey: input.configuration.identity.agentKey,
          name: input.configuration.identity.name,
        },
      });

      const created = await agentRepo.getByIdForOrganization(input.organizationId, agentId);
      return {
        agent: created,
        revision: rev1,
        validation,
      };
    });
  }

  async restoreRevision(
    organizationId: string,
    agentId: string,
    revisionId: string,
    userId: string,
  ) {
    assertUuid(organizationId, "organizationId");
    assertUuid(agentId, "agentId");
    assertUuid(revisionId, "revisionId");

    return this.database.transaction(async (tx) => {
      const repoContext = createRepositoryContext(tx);
      const agentRepo = new AgentRepository(repoContext);
      const builderRepo = new AgentBuilderRepository(repoContext);

      const targetRev = await builderRepo.getRevisionById(organizationId, agentId, revisionId);
      if (!targetRev) {
        throw new ApiError(404, "NOT_FOUND", "Revision to restore not found.");
      }

      const existingDraft = await builderRepo.getDraftRevision(organizationId, agentId);
      let draftRev: AgentConfigurationRevisionRecord;

      const changelog = `Restored from revision ${targetRev.revisionNumber} (${targetRev.version})`;

      if (existingDraft) {
        const updated = await builderRepo.updateRevision(existingDraft.id, {
          configuration: targetRev.configuration,
          version: `${targetRev.version.replace(/-draft$/, "")}-draft`,
          validationStatus: targetRev.validationStatus,
          validationErrors: targetRev.validationErrors,
          changelog,
        });
        if (!updated) throw new Error("Failed to update draft with restored revision.");
        draftRev = updated;
      } else {
        const nextRevNumber = await builderRepo.getNextRevisionNumber(agentId);
        draftRev = await builderRepo.createRevision({
          organizationId,
          workspaceId: targetRev.workspaceId,
          agentId,
          revisionNumber: nextRevNumber,
          version: `${targetRev.version.replace(/-draft$/, "")}-draft`,
          status: "draft",
          configuration: targetRev.configuration,
          validationStatus: targetRev.validationStatus,
          validationErrors: targetRev.validationErrors,
          changelog,
          createdBy: userId,
        });
      }

      await agentRepo.recordAuditEvent({
        organizationId,
        workspaceId: targetRev.workspaceId,
        agentId,
        actorUserId: userId,
        action: "agent.builder_restored",
        operation: "restore",
        result: "success",
        metadata: {
          restoredFromRevisionId: revisionId,
          restoredFromRevisionNumber: targetRev.revisionNumber,
        },
      });

      return draftRev;
    });
  }

  async compareRevisions(
    organizationId: string,
    agentId: string,
    baseRevisionId: string,
    targetRevisionId: string,
  ) {
    assertUuid(organizationId, "organizationId");
    assertUuid(agentId, "agentId");
    assertUuid(baseRevisionId, "baseRevisionId");
    assertUuid(targetRevisionId, "targetRevisionId");

    const builderRepo = new AgentBuilderRepository(
      createRepositoryContext(this.database.db),
    );

    const [baseRev, targetRev] = await Promise.all([
      builderRepo.getRevisionById(organizationId, agentId, baseRevisionId),
      builderRepo.getRevisionById(organizationId, agentId, targetRevisionId),
    ]);

    if (!baseRev) throw new ApiError(404, "NOT_FOUND", "Base revision not found.");
    if (!targetRev) throw new ApiError(404, "NOT_FOUND", "Target revision not found.");

    const diffs = computeConfigurationDiff(
      baseRev.configuration as Record<string, unknown>,
      targetRev.configuration as Record<string, unknown>,
    );

    return {
      baseRevision: baseRev,
      targetRevision: targetRev,
      diffs,
    };
  }

  async listRevisions(
    organizationId: string,
    agentId: string,
    pagination: { page: number; pageSize: number },
  ) {
    assertUuid(organizationId, "organizationId");
    assertUuid(agentId, "agentId");

    const builderRepo = new AgentBuilderRepository(
      createRepositoryContext(this.database.db),
    );

    return builderRepo.listRevisions(organizationId, agentId, pagination);
  }

  async getRevision(organizationId: string, agentId: string, revisionId: string) {
    assertUuid(organizationId, "organizationId");
    assertUuid(agentId, "agentId");
    assertUuid(revisionId, "revisionId");

    const builderRepo = new AgentBuilderRepository(
      createRepositoryContext(this.database.db),
    );

    const rev = await builderRepo.getRevisionById(organizationId, agentId, revisionId);
    if (!rev) throw new ApiError(404, "NOT_FOUND", "Revision not found.");
    return rev;
  }

  async executeMockPreview(input: AgentBuilderPreviewInput): Promise<AgentBuilderPreviewResult> {
    assertUuid(input.organizationId, "organizationId");

    // Rate limiting: max 20 requests per minute per user/organization
    const rateKey = `${input.organizationId}:${input.userId}`;
    const now = Date.now();
    const timestamps = (previewCallLog.get(rateKey) ?? []).filter((t) => now - t < 60_000);
    if (timestamps.length >= 20) {
      throw new ApiError(
        429,
        "TOO_MANY_REQUESTS",
        "Mock preview rate limit exceeded. Please wait a minute before sending more test messages.",
      );
    }
    timestamps.push(now);
    previewCallLog.set(rateKey, timestamps);

    const testPrompt = input.testPrompt?.trim();
    if (!testPrompt) {
      throw new ApiError(400, "VALIDATION_FAILED", "Test prompt cannot be empty.");
    }
    if (testPrompt.length > 4000) {
      throw new ApiError(400, "VALIDATION_FAILED", "Test prompt cannot exceed 4,000 characters.");
    }

    const compiledInstructions = compileSystemInstructions(input.configuration.instructions as any);

    // Convert declared tools to MockAiProvider ToolDeclaration format
    const declaredTools: ToolDeclaration[] = Array.isArray(input.configuration.tools)
      ? input.configuration.tools.map((t) => ({
          name: t.toolKey,
          description: t.description,
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
          },
        }))
      : [];

    const registry = AiProviderRegistry.getInstance();
    const mockProvider = registry.get("mock") ?? registry.getDefault();

    const startTime = Date.now();
    const response = await mockProvider.invoke({
      model: input.configuration.model.modelSelection || "mock-gpt-4o",
      messages: [
        { role: "system", content: compiledInstructions },
        { role: "user", content: testPrompt },
      ],
      temperature: input.configuration.model.temperature,
      maxTokens: Math.min(input.configuration.model.maxTokens || 2048, 1024),
      tools: declaredTools.length > 0 ? declaredTools : undefined,
      timeoutMs: 10_000,
    });
    const durationMs = Date.now() - startTime;

    // Simulate tool call simulation preview
    const simulatedToolCalls = response.toolCalls?.map((tc: ToolCall) => {
      const match = input.configuration.tools.find((t) => t.toolKey === tc.name);
      return {
        name: tc.name,
        description: match?.description ?? "Declared tool",
        riskLevel: match?.riskLevel ?? "low",
        requiresApproval: match?.requiresApproval ?? false,
        arguments: tc.arguments,
      };
    });

    return {
      simulated: true,
      model: response.model,
      provider: "mock",
      content: response.content,
      finishReason: response.finishReason,
      latencyMs: durationMs,
      simulatedUsage: response.usage,
      simulatedToolCalls,
      validationWarnings: [
        "SIMULATED EXECUTION: Running in isolated test harness. No real external AI charges or database modifications were performed.",
      ],
    };
  }

  // Synthesize a complete typed builder configuration from existing agent row & JSON config
  private synthesizeFullConfig(
    agent: AgentDefinitionWithTools | AgentDefinitionRecord,
    savedConfig?: JsonRecord,
  ): AgentBuilderFullConfig {
    const raw = (savedConfig ?? agent.configuration ?? {}) as Record<string, unknown>;

    const identity: AgentBuilderFullConfig["identity"] = {
      name: agent.name,
      agentKey: agent.agentKey,
      description: agent.description,
      category: typeof raw.category === "string" ? raw.category : undefined,
      industry: typeof raw.industry === "string" ? raw.industry : undefined,
      icon: typeof raw.icon === "string" ? raw.icon : "🤖",
      tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    };

    const rawModel = (raw.model ?? {}) as Record<string, unknown>;
    const model: AgentBuilderFullConfig["model"] = {
      provider: agent.modelProvider || (typeof rawModel.provider === "string" ? rawModel.provider : "mock"),
      modelSelection:
        agent.modelSelection ||
        (typeof rawModel.modelSelection === "string" ? rawModel.modelSelection : "mock-gpt-4o"),
      temperature: typeof rawModel.temperature === "number" ? rawModel.temperature : 0.7,
      maxTokens: typeof rawModel.maxTokens === "number" ? rawModel.maxTokens : 2048,
      timeoutSeconds: typeof rawModel.timeoutSeconds === "number" ? rawModel.timeoutSeconds : 60,
      responseQuality: (rawModel.responseQuality as any) ?? "balanced",
    };

    const rawInstructions = (raw.instructions ?? {}) as Record<string, unknown>;
    const instructions: AgentBuilderFullConfig["instructions"] = {
      role: typeof rawInstructions.role === "string" ? rawInstructions.role : "Helpful Enterprise Assistant",
      objectives:
        typeof rawInstructions.objectives === "string"
          ? rawInstructions.objectives
          : "Execute organizational queries accurately and safely.",
      boundaryConstraints:
        typeof rawInstructions.boundaryConstraints === "string"
          ? rawInstructions.boundaryConstraints
          : "",
      behavioralRules:
        typeof rawInstructions.behavioralRules === "string" ? rawInstructions.behavioralRules : "",
      outputFormat:
        typeof rawInstructions.outputFormat === "string" ? rawInstructions.outputFormat : "Markdown",
      prohibitedActions:
        typeof rawInstructions.prohibitedActions === "string"
          ? rawInstructions.prohibitedActions
          : "",
      escalationRequirements:
        typeof rawInstructions.escalationRequirements === "string"
          ? rawInstructions.escalationRequirements
          : "",
      systemInstructions:
        typeof rawInstructions.systemInstructions === "string"
          ? rawInstructions.systemInstructions
          : agent.instructions ?? "",
    };

    const capabilities: AgentBuilderFullConfig["capabilities"] = Array.isArray(raw.capabilities)
      ? (raw.capabilities as any)
      : [
          {
            key: "generate",
            name: "Content Generation",
            description: "Generate structured content",
            riskLevel: "low",
            requiresApproval: false,
          },
        ];

    // Tools from assignments or config
    let tools: AgentBuilderFullConfig["tools"] = [];
    if (Array.isArray(raw.tools) && raw.tools.length > 0) {
      tools = raw.tools as any;
    } else if ("tools" in agent && Array.isArray(agent.tools)) {
      tools = agent.tools.map((t) => {
        const found = REGISTERED_BUILDER_TOOLS.find((bt) => bt.toolKey === t.toolKey);
        return {
          toolKey: t.toolKey,
          name: found?.name ?? t.toolKey,
          description: found?.description ?? "Assigned tool",
          category: found?.category ?? "General",
          riskLevel: found?.riskLevel ?? "low",
          requiresApproval: found?.requiresApproval ?? false,
          permissions: found?.permissions ?? [],
        };
      });
    }

    // Knowledge
    const rawKnowledge = Array.isArray(raw.knowledge) ? raw.knowledge : [];
    const knowledge: AgentBuilderFullConfig["knowledge"] = rawKnowledge.map((item) => {
      if (typeof item === "string") {
        return {
          sourceId: item,
          enabled: true,
          accessPolicy: "read_only",
        };
      }
      return item as any;
    });

    // Human Approval
    const rawApproval = (raw.humanApproval ?? agent.humanApprovalPolicy ?? {}) as Record<string, unknown>;
    const humanApproval: AgentBuilderFullConfig["humanApproval"] = {
      policy: (rawApproval.policy as any) ?? (rawApproval.required ? "always" : "never"),
      riskThreshold: (rawApproval.riskThreshold as any) ?? "high",
      approverRoles: Array.isArray(rawApproval.approverRoles)
        ? (rawApproval.approverRoles as string[])
        : ["admin", "owner"],
      escalationTimeoutHours:
        typeof rawApproval.escalationTimeoutHours === "number"
          ? rawApproval.escalationTimeoutHours
          : 24,
      fallbackAction: (rawApproval.fallbackAction as any) ?? "deny",
      sensitiveCapabilities: Array.isArray(rawApproval.sensitiveCapabilities)
        ? (rawApproval.sensitiveCapabilities as string[])
        : [],
    };

    return {
      identity,
      model,
      instructions,
      capabilities,
      tools,
      knowledge,
      humanApproval,
    };
  }
}

// Compute structured visual diff between two configuration revisions
export function computeConfigurationDiff(
  base: Record<string, unknown>,
  target: Record<string, unknown>,
  prefix = "",
): RevisionDiffItem[] {
  const diffs: RevisionDiffItem[] = [];

  const allKeys = Array.from(new Set([...Object.keys(base ?? {}), ...Object.keys(target ?? {})]));

  for (const key of allKeys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const baseVal = base?.[key];
    const targetVal = target?.[key];

    if (baseVal === undefined && targetVal !== undefined) {
      diffs.push({
        field: key,
        path,
        before: null,
        after: targetVal,
        action: "added",
      });
    } else if (baseVal !== undefined && targetVal === undefined) {
      diffs.push({
        field: key,
        path,
        before: baseVal,
        after: null,
        action: "removed",
      });
    } else if (
      typeof baseVal === "object" &&
      baseVal !== null &&
      typeof targetVal === "object" &&
      targetVal !== null &&
      !Array.isArray(baseVal) &&
      !Array.isArray(targetVal)
    ) {
      diffs.push(
        ...computeConfigurationDiff(
          baseVal as Record<string, unknown>,
          targetVal as Record<string, unknown>,
          path,
        ),
      );
    } else if (JSON.stringify(baseVal) !== JSON.stringify(targetVal)) {
      diffs.push({
        field: key,
        path,
        before: baseVal,
        after: targetVal,
        action: "modified",
      });
    }
  }

  return diffs;
}
