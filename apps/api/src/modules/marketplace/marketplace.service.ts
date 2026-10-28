import { ApiError } from "../../common/errors/api-error.js";
import type { DatabaseClient, DatabaseTransaction } from "../../database/client.js";
import { createRepositoryContext } from "../../database/repositories/repository-context.js";
import { WorkspaceService } from "../platform/services/workspace.service.js";
import { systemTemplates } from "../agents/services/agent.service.js";
import { AgentRepository } from "../agents/repositories/agent.repository.js";
import { AgentTemplateRepository } from "../agents/repositories/agent-template.repository.js";
import { MarketplaceRepository } from "./marketplace.repository.js";
import type {
  AgentTemplateVersionRecord,
  MarketplaceAgentProfileDto,
  MarketplaceAnalyticsDto,
  MarketplaceCatalogFilter,
  MarketplaceCatalogItemDto,
  MarketplaceInstallInput,
  MarketplaceReviewDecisionInput,
  MarketplaceUpgradeInput,
  MarketplaceUninstallInput,
} from "./marketplace.types.js";
import type { AgentDefinitionWithTools, AgentTemplateRecord } from "../agents/agent.types.js";
import { randomUUID } from "node:crypto";
import { aiAgentDefinitions } from "../../database/schema.js";
import { eq } from "drizzle-orm";

export class MarketplaceService {
  constructor(private readonly database: DatabaseClient) {}

  async listCatalog(
    viewerOrgId: string,
    filter: MarketplaceCatalogFilter = {},
  ): Promise<{
    items: MarketplaceCatalogItemDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const repository = new MarketplaceRepository(createRepositoryContext(this.database.db));
    // Ensure initial platform baseline versions exist for platform templates
    await repository.ensurePlatformTemplateVersions(systemTemplates);
    return repository.listCatalogPaginated(viewerOrgId, filter);
  }

  async getAgentProfile(
    templateId: string,
    viewerOrgId: string,
    workspaceId?: string,
  ): Promise<MarketplaceAgentProfileDto> {
    const repository = new MarketplaceRepository(createRepositoryContext(this.database.db));
    await repository.ensurePlatformTemplateVersions(systemTemplates);

    const profile = await repository.getAgentProfile(templateId, viewerOrgId, workspaceId);
    if (!profile) {
      throw new ApiError(404, "NOT_FOUND", "Marketplace agent profile not found.");
    }
    return profile;
  }

  async listVersions(templateId: string): Promise<AgentTemplateVersionRecord[]> {
    const repository = new MarketplaceRepository(createRepositoryContext(this.database.db));
    return repository.listTemplateVersions(templateId);
  }

  async getVersion(templateId: string, version: string): Promise<AgentTemplateVersionRecord> {
    const repository = new MarketplaceRepository(createRepositoryContext(this.database.db));
    const versionRecord = await repository.getTemplateVersion(templateId, version);
    if (!versionRecord) {
      throw new ApiError(404, "NOT_FOUND", `Agent version '${version}' not found for template.`);
    }
    return versionRecord;
  }

  async installAgent(input: MarketplaceInstallInput): Promise<AgentDefinitionWithTools> {
    return this.database.transaction(async (tx: DatabaseTransaction) => {
      const txDb = { ...this.database, db: tx as unknown as DatabaseClient["db"] };
      const context = createRepositoryContext(tx);
      const marketplaceRepo = new MarketplaceRepository(context);
      const agentRepo = new AgentRepository(context);
      const templateRepo = new AgentTemplateRepository(context);

      // 1. Confirm template is published and visible
      const template = await templateRepo.getById(input.templateId);
      if (!template) {
        throw new ApiError(404, "NOT_FOUND", "Agent template not found.");
      }

      // Check visibility & publishing status
      const isPublisher = template.publisherOrganizationId === input.organizationId;
      if (template.publishingStatus !== "published" && !isPublisher) {
        throw new ApiError(403, "FORBIDDEN", "This agent is not currently published on the marketplace.");
      }
      if (template.visibility === "private_organization" && !isPublisher) {
        throw new ApiError(403, "FORBIDDEN", "This private agent is not accessible to your organization.");
      }

      // 2. Validate workspace belongs to tenant
      await new WorkspaceService(txDb).getWorkspace(input.organizationId, input.workspaceId);

      // 3. Resolve version (requested or latest published)
      const targetVersionStr = input.version ?? template.latestVersion ?? template.version ?? "1.0.0";
      let versionRecord = await marketplaceRepo.getTemplateVersion(input.templateId, targetVersionStr);
      if (!versionRecord) {
        // Fallback: create default version if it was a system template baseline
        await marketplaceRepo.ensurePlatformTemplateVersions(systemTemplates);
        versionRecord = await marketplaceRepo.getTemplateVersion(input.templateId, targetVersionStr);
      }

      // 4. Idempotency Check: check if already active in this workspace
      const existing = await agentRepo.getByWorkspaceAndTemplate(input.workspaceId, input.templateId);
      if (existing) {
        if (existing.status !== "active") {
          // Re-activate previously archived or paused agent
          const restored = await agentRepo.updateStatus(
            input.organizationId,
            existing.id,
            "active",
            true,
          );
          if (!restored) throw new Error("Agent reactivation failed.");

          // Update installed version tracking
          await txDb.db
            .update(aiAgentDefinitions)
            .set({
              installedVersion: targetVersionStr,
              templateVersionId: versionRecord?.id ?? null,
              installedFromMarketplace: true,
              updatedAt: new Date(),
            })
            .where(eq(aiAgentDefinitions.id, existing.id));

          await marketplaceRepo.createInstallation({
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            templateId: template.id,
            templateVersionId: versionRecord?.id ?? null,
            installedVersion: targetVersionStr,
            agentDefinitionId: existing.id,
            installedBy: input.installedBy,
            status: "active",
            metadata: { reactivated: true },
          });

          await agentRepo.recordAuditEvent({
            organizationId: input.organizationId,
            workspaceId: input.workspaceId,
            agentId: existing.id,
            actorUserId: input.installedBy,
            action: "agent.install",
            operation: "update",
            result: "success",
            beforeSnapshot: { status: existing.status, installedVersion: existing.installedVersion },
            afterSnapshot: { status: "active", installedVersion: targetVersionStr },
            changedFields: ["status", "installedVersion"],
            metadata: { reactivated: true, installedVersion: targetVersionStr },
          });

          const reloaded = await agentRepo.getByIdForOrganization(input.organizationId, existing.id);
          return reloaded!;
        }

        // Already active: return existing definition idempotently
        return existing;
      }

      // 5. Build configuration merged from template defaults + input
      const initialConfiguration = input.configuration ?? {};

      // 6. Approval policy
      const approvalPolicy =
        input.humanApprovalPolicy ?? versionRecord?.defaultApprovalPolicy ?? template.defaultApprovalPolicy ?? null;

      // 7. Create Agent Definition
      const agent = await agentRepo.create({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        templateId: template.id,
        agentKey: `${template.slug}-${randomUUID().slice(0, 8)}`,
        name: input.name ?? `${template.name}`,
        description: input.description ?? template.description,
        status: "active",
        enabled: true,
        instructions: input.instructions ?? versionRecord?.instructions ?? "",
        configuration: initialConfiguration,
        modelProvider: input.modelProvider ?? "mock",
        modelSelection: input.modelSelection ?? "mock-gpt-4o",
        humanApprovalPolicy: approvalPolicy,
        createdBy: input.installedBy,
      });

      // Update definition installed version
      await txDb.db
        .update(aiAgentDefinitions)
        .set({
          installedVersion: targetVersionStr,
          templateVersionId: versionRecord?.id ?? null,
          installedFromMarketplace: true,
        })
        .where(eq(aiAgentDefinitions.id, agent.id));

      // 8. Durable installation record
      await marketplaceRepo.createInstallation({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        templateId: template.id,
        templateVersionId: versionRecord?.id ?? null,
        installedVersion: targetVersionStr,
        agentDefinitionId: agent.id,
        installedBy: input.installedBy,
        status: "active",
        metadata: {
          templateName: template.name,
          category: template.category,
          industry: template.industry,
        },
      });

      // 9. Audit Event
      await agentRepo.recordAuditEvent({
        organizationId: input.organizationId,
        workspaceId: input.workspaceId,
        agentId: agent.id,
        actorUserId: input.installedBy,
        action: "agent.install",
        operation: "create",
        result: "success",
        beforeSnapshot: null,
        afterSnapshot: {
          id: agent.id,
          name: agent.name,
          templateId: agent.templateId,
          installedVersion: targetVersionStr,
          status: agent.status,
          modelProvider: agent.modelProvider,
          modelSelection: agent.modelSelection,
          humanApprovalPolicy: agent.humanApprovalPolicy,
        },
        changedFields: ["id", "templateId", "installedVersion", "status"],
        metadata: {
          installedFromMarketplace: true,
          installedVersion: targetVersionStr,
        },
      });

      const reloaded = await agentRepo.getByIdForOrganization(input.organizationId, agent.id);
      return reloaded!;
    });
  }

  async listInstalledAgents(organizationId: string, workspaceId?: string) {
    const repository = new MarketplaceRepository(createRepositoryContext(this.database.db));
    return repository.listInstalledAgents(organizationId, workspaceId);
  }

  async upgradeAgent(input: MarketplaceUpgradeInput): Promise<AgentDefinitionWithTools> {
    return this.database.transaction(async (tx: DatabaseTransaction) => {
      const context = createRepositoryContext(tx);
      const marketplaceRepo = new MarketplaceRepository(context);
      const agentRepo = new AgentRepository(context);

      const agent = await agentRepo.getByIdForOrganization(input.organizationId, input.agentId);
      if (!agent) {
        throw new ApiError(404, "NOT_FOUND", "Installed agent not found.");
      }
      if (!agent.templateId) {
        throw new ApiError(400, "VALIDATION_FAILED", "Custom agents not linked to a template cannot be upgraded via marketplace.");
      }

      // Check target version exists and is published
      const versionRecord = await marketplaceRepo.getTemplateVersion(agent.templateId, input.targetVersion);
      if (!versionRecord) {
        throw new ApiError(404, "NOT_FOUND", `Target version '${input.targetVersion}' does not exist.`);
      }
      if (versionRecord.status !== "published") {
        throw new ApiError(400, "VALIDATION_FAILED", `Version '${input.targetVersion}' is not published.`);
      }

      const previousVersion = agent.installedVersion || "1.0.0";
      if (previousVersion === input.targetVersion) {
        return agent; // Already on this version
      }

      // Execute upgrade
      await marketplaceRepo.upgradeAgentVersion(
        input.organizationId,
        input.agentId,
        input.targetVersion,
        versionRecord.id,
        input.updatedBy,
      );

      // Record audit event
      await agentRepo.recordAuditEvent({
        organizationId: input.organizationId,
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        actorUserId: input.updatedBy,
        action: "agent.upgrade",
        operation: "update",
        result: "success",
        beforeSnapshot: { installedVersion: previousVersion },
        afterSnapshot: { installedVersion: input.targetVersion },
        changedFields: ["installedVersion", "templateVersionId"],
        metadata: {
          fromVersion: previousVersion,
          toVersion: input.targetVersion,
        },
      });

      const reloaded = await agentRepo.getByIdForOrganization(input.organizationId, agent.id);
      return reloaded!;
    });
  }

  async uninstallAgent(input: MarketplaceUninstallInput): Promise<void> {
    const context = createRepositoryContext(this.database.db);
    const marketplaceRepo = new MarketplaceRepository(context);
    const agentRepo = new AgentRepository(context);

    const agent = await agentRepo.getByIdForOrganization(input.organizationId, input.agentId);
    if (!agent) {
      throw new ApiError(404, "NOT_FOUND", "Agent definition not found.");
    }

    await marketplaceRepo.uninstallAgent(
      input.organizationId,
      input.agentId,
      input.userId,
      input.reason,
    );

    // Record audit event
    await agentRepo.recordAuditEvent({
      organizationId: input.organizationId,
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      actorUserId: input.userId,
      action: "agent.uninstall",
      operation: "delete",
      result: "success",
      beforeSnapshot: { status: agent.status, enabled: agent.enabled },
      afterSnapshot: { status: "archived", enabled: false },
      changedFields: ["status", "enabled"],
      metadata: { reason: input.reason ?? "User requested uninstall" },
    });
  }

  async createPublisherTemplate(input: any): Promise<AgentTemplateRecord> {
    const templateRepo = new AgentTemplateRepository(createRepositoryContext(this.database.db));
    const marketplaceRepo = new MarketplaceRepository(createRepositoryContext(this.database.db));
    const templateId = randomUUID();
    const created = await templateRepo.upsert({
      id: templateId,
      ...input,
    });

    await marketplaceRepo.createTemplateVersion({
      templateId,
      version: input.version || "1.0.0",
      name: input.name,
      description: input.description,
      instructions: null,
      capabilities: input.capabilities || [],
      requiredPermissions: input.requiredPermissions || [],
      configurationSchema: input.configurationSchema || {},
      inputSchema: input.inputSchema || {},
      outputSchema: input.outputSchema || {},
      defaultApprovalPolicy: input.defaultApprovalPolicy ?? null,
      changelog: "Initial draft version.",
      status: "draft",
    });

    return created;
  }

  async createTemplateVersion(input: any): Promise<AgentTemplateVersionRecord> {
    const marketplaceRepo = new MarketplaceRepository(createRepositoryContext(this.database.db));
    const templateRepo = new AgentTemplateRepository(createRepositoryContext(this.database.db));

    const template = await templateRepo.getById(input.templateId);
    if (!template) {
      throw new ApiError(404, "NOT_FOUND", "Agent template not found.");
    }

    // Check version uniqueness
    const existing = await marketplaceRepo.getTemplateVersion(input.templateId, input.version);
    if (existing) {
      throw new ApiError(409, "DATABASE_UNIQUE_CONSTRAINT", `Version '${input.version}' already exists for this agent.`);
    }

    return marketplaceRepo.createTemplateVersion(input);
  }

  async submitTemplateForReview(
    templateId: string,
    organizationId: string,
    _userId?: string,
  ): Promise<void> {
    const templateRepo = new AgentTemplateRepository(createRepositoryContext(this.database.db));
    const marketplaceRepo = new MarketplaceRepository(createRepositoryContext(this.database.db));

    const template = await templateRepo.getById(templateId);
    if (!template) {
      throw new ApiError(404, "NOT_FOUND", "Agent template not found.");
    }

    // Must be authored by the submitting organization
    if (template.publisherOrganizationId !== organizationId) {
      throw new ApiError(403, "FORBIDDEN", "Only the authoring organization can submit this agent for review.");
    }

    if (template.publishingStatus === "published") {
      throw new ApiError(400, "VALIDATION_FAILED", "This agent is already published.");
    }

    await marketplaceRepo.updateTemplatePublishingStatus(templateId, "submitted", null, null);
  }

  async reviewDecision(
    templateId: string,
    input: MarketplaceReviewDecisionInput,
  ): Promise<void> {
    const templateRepo = new AgentTemplateRepository(createRepositoryContext(this.database.db));
    const marketplaceRepo = new MarketplaceRepository(createRepositoryContext(this.database.db));

    const template = await templateRepo.getById(templateId);
    if (!template) {
      throw new ApiError(404, "NOT_FOUND", "Agent template not found.");
    }

    await marketplaceRepo.updateTemplatePublishingStatus(
      templateId,
      input.decision,
      input.reviewNotes,
      input.reviewerUserId,
    );

    // If decision is published, also publish all draft versions
    if (input.decision === "published") {
      const versions = await marketplaceRepo.listTemplateVersions(templateId);
      for (const v of versions) {
        if (v.status !== "published" && v.status !== "deprecated" && v.status !== "withdrawn") {
          await marketplaceRepo.updateVersionPublishingStatus(v.id, "published", input.reviewNotes, input.reviewerUserId);
        }
      }
    }
  }

  async listPendingSubmissions() {
    const marketplaceRepo = new MarketplaceRepository(createRepositoryContext(this.database.db));
    return marketplaceRepo.listPendingSubmissions();
  }

  async listOrganizationAuthoredTemplates(organizationId: string) {
    const marketplaceRepo = new MarketplaceRepository(createRepositoryContext(this.database.db));
    return marketplaceRepo.listOrganizationAuthoredTemplates(organizationId);
  }

  async getAnalytics(viewerOrgId?: string): Promise<MarketplaceAnalyticsDto> {
    const marketplaceRepo = new MarketplaceRepository(createRepositoryContext(this.database.db));
    return marketplaceRepo.getMarketplaceAnalytics(viewerOrgId);
  }
}
