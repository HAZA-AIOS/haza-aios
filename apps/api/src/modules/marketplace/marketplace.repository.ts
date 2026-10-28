import { and, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { RepositoryContext } from "../../database/repositories/repository-context.js";
import {
  aiAgentDefinitions,
  aiAgentInstallations,
  aiAgentTemplates,
  aiAgentTemplateVersions,
  organizations,
  users,
} from "../../database/schema.js";
import type {
  AgentInstallationRecord,
  AgentTemplateVersionRecord,
  MarketplaceAgentProfileDto,
  MarketplaceAnalyticsDto,
  MarketplaceCatalogFilter,
  MarketplaceCatalogItemDto,
  MarketplaceReviewSubmissionDto,
  PublishingStatus,
} from "./marketplace.types.js";
import type { AgentTemplateRecord, UpsertAgentTemplateInput } from "../agents/agent.types.js";
import { AgentTemplateRepository } from "../agents/repositories/agent-template.repository.js";
import { randomUUID } from "node:crypto";

export class MarketplaceRepository {
  constructor(private readonly context: RepositoryContext) {}

  /**
   * Automatically seed initial baseline versions (e.g. 1.0.0) for platform templates
   * to guarantee that every platform agent has an immutable version record.
   */
  async ensurePlatformTemplateVersions(templates: UpsertAgentTemplateInput[]): Promise<void> {
    const templateRepo = new AgentTemplateRepository(this.context);
    for (const t of templates) {
      await templateRepo.upsert(t);
      const existingVersion = await this.context.db
        .select({ id: aiAgentTemplateVersions.id })
        .from(aiAgentTemplateVersions)
        .where(
          and(
            eq(aiAgentTemplateVersions.templateId, t.id),
            eq(aiAgentTemplateVersions.version, t.version || "1.0.0"),
          ),
        )
        .limit(1);

      if (!existingVersion.length) {
        await this.context.db.insert(aiAgentTemplateVersions).values({
          id: randomUUID(),
          templateId: t.id,
          version: t.version || "1.0.0",
          name: t.name,
          description: t.description,
          instructions: null,
          configurationSchema: t.configurationSchema,
          inputSchema: t.inputSchema,
          outputSchema: t.outputSchema,
          capabilities: t.capabilities,
          requiredPermissions: t.requiredPermissions,
          defaultApprovalPolicy: t.defaultApprovalPolicy ?? null,
          changelog: "Initial verified platform baseline release.",
          status: "published",
          reviewNotes: "Platform verified",
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  async listCatalogPaginated(
    viewerOrgId: string,
    filter: MarketplaceCatalogFilter = {},
  ): Promise<{
    items: MarketplaceCatalogItemDto[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filter.pageSize ?? 24));
    const offset = (page - 1) * pageSize;

    // Visibility boundary:
    // Published templates that are either platform-wide OR owned by the viewer's organization
    const visibilityCondition = or(
      and(
        eq(aiAgentTemplates.publishingStatus, "published"),
        eq(aiAgentTemplates.visibility, "platform"),
      ),
      and(
        eq(aiAgentTemplates.publishingStatus, "published"),
        inArray(aiAgentTemplates.visibility, ["private_organization", "approved_shared"]),
        eq(aiAgentTemplates.publisherOrganizationId, viewerOrgId),
      ),
    )!;

    const conditions: SQL[] = [visibilityCondition];

    if (filter.category && filter.category !== "All") {
      conditions.push(eq(aiAgentTemplates.category, filter.category));
    }
    if (filter.industry && filter.industry !== "All") {
      conditions.push(eq(aiAgentTemplates.industry, filter.industry));
    }
    if (filter.search?.trim()) {
      const term = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          like(aiAgentTemplates.name, term),
          like(aiAgentTemplates.description, term),
          like(aiAgentTemplates.slug, term),
          like(aiAgentTemplates.summary, term),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [rows, totalRes, installedAgents] = await Promise.all([
      this.context.db
        .select({
          template: aiAgentTemplates,
          publisherOrgName: organizations.name,
        })
        .from(aiAgentTemplates)
        .leftJoin(organizations, eq(aiAgentTemplates.publisherOrganizationId, organizations.id))
        .where(whereClause)
        .orderBy(desc(aiAgentTemplates.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.context.db
        .select({ count: sql<number>`count(*)` })
        .from(aiAgentTemplates)
        .where(whereClause),
      this.context.db
        .select({
          templateId: aiAgentDefinitions.templateId,
          installedVersion: aiAgentDefinitions.installedVersion,
          status: aiAgentDefinitions.status,
        })
        .from(aiAgentDefinitions)
        .where(
          and(
            eq(aiAgentDefinitions.organizationId, viewerOrgId),
            inArray(aiAgentDefinitions.status, ["active", "configured", "paused", "suspended"]),
          ),
        ),
    ]);

    const installedMap = new Map<string, string>();
    for (const inst of installedAgents) {
      if (inst.templateId) {
        installedMap.set(inst.templateId, inst.installedVersion || "1.0.0");
      }
    }

    const total = Number(totalRes[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize) || 1;

    const items: MarketplaceCatalogItemDto[] = rows.map((r) => {
      const t = r.template;
      const installedVer = installedMap.get(t.id) ?? null;
      const installed = installedVer !== null;
      const hasUpdateAvailable = installed && installedVer !== t.latestVersion;

      return {
        id: t.id,
        slug: t.slug,
        name: t.name,
        summary: t.summary ?? t.description.slice(0, 160),
        description: t.description,
        latestVersion: t.latestVersion || t.version || "1.0.0",
        category: t.category,
        industry: t.industry,
        icon: t.icon,
        publisherType: (t.publisherType as "platform" | "organization") ?? "platform",
        publisherName: r.publisherOrgName ?? "HAZA Platform",
        visibility: (t.visibility as "platform" | "private_organization" | "approved_shared") ?? "platform",
        publishingStatus: (t.publishingStatus as PublishingStatus) ?? "published",
        capabilities: (t.capabilities as any) ?? [],
        requiredPermissions: (t.requiredPermissions as any) ?? [],
        installed,
        installedVersion: installedVer,
        hasUpdateAvailable,
        publishedAt: t.publishedAt ? t.publishedAt.toISOString() : t.createdAt.toISOString(),
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getAgentProfile(
    templateId: string,
    viewerOrgId: string,
    workspaceId?: string,
  ): Promise<MarketplaceAgentProfileDto | null> {
    const rows = await this.context.db
      .select({
        template: aiAgentTemplates,
        publisherOrgName: organizations.name,
      })
      .from(aiAgentTemplates)
      .leftJoin(organizations, eq(aiAgentTemplates.publisherOrganizationId, organizations.id))
      .where(eq(aiAgentTemplates.id, templateId))
      .limit(1);

    if (!rows.length) return null;
    const row = rows[0];
    const t = row.template;

    // Check visibility permissions:
    // If not published, only the publisher org or platform admins can view
    const isPublisher = t.publisherOrganizationId === viewerOrgId;
    if (t.publishingStatus !== "published" && !isPublisher) {
      return null;
    }
    if (t.visibility === "private_organization" && !isPublisher) {
      return null;
    }

    // Fetch versions
    const versionRows = await this.context.db
      .select()
      .from(aiAgentTemplateVersions)
      .where(eq(aiAgentTemplateVersions.templateId, templateId))
      .orderBy(desc(aiAgentTemplateVersions.createdAt));

    // Filter versions for public viewers: only show published versions
    const visibleVersions = isPublisher
      ? versionRows
      : versionRows.filter((v) => v.status === "published");

    // Check if installed in the tenant
    const instQuery = [
      eq(aiAgentDefinitions.organizationId, viewerOrgId),
      eq(aiAgentDefinitions.templateId, templateId),
      inArray(aiAgentDefinitions.status, ["active", "configured", "paused", "suspended"]),
    ];
    if (workspaceId) {
      instQuery.push(eq(aiAgentDefinitions.workspaceId, workspaceId));
    }

    const installedRes = await this.context.db
      .select({
        id: aiAgentDefinitions.id,
        installedVersion: aiAgentDefinitions.installedVersion,
      })
      .from(aiAgentDefinitions)
      .where(and(...instQuery))
      .limit(1);

    const installed = installedRes.length > 0;
    const installedInstanceId = installed ? installedRes[0].id : null;
    const installedVersion = installed ? installedRes[0].installedVersion || "1.0.0" : null;
    const hasUpdateAvailable = installed && installedVersion !== t.latestVersion;

    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      summary: t.summary ?? t.description.slice(0, 160),
      description: t.description,
      latestVersion: t.latestVersion || t.version || "1.0.0",
      category: t.category,
      industry: t.industry,
      icon: t.icon,
      publisherType: (t.publisherType as "platform" | "organization") ?? "platform",
      publisherName: row.publisherOrgName ?? "HAZA Platform",
      publisherOrganizationId: t.publisherOrganizationId,
      visibility: (t.visibility as any) ?? "platform",
      publishingStatus: (t.publishingStatus as PublishingStatus) ?? "published",
      capabilities: (t.capabilities as any) ?? [],
      requiredPermissions: (t.requiredPermissions as any) ?? [],
      configurationSchema: (t.configurationSchema as any) ?? {},
      inputSchema: (t.inputSchema as any) ?? {},
      outputSchema: (t.outputSchema as any) ?? {},
      defaultApprovalPolicy: (t.defaultApprovalPolicy as any) ?? null,
      versions: visibleVersions.map((v) => ({
        id: v.id,
        version: v.version,
        changelog: v.changelog,
        status: v.status as PublishingStatus,
        publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
      })),
      installed,
      installedInstanceId,
      installedVersion,
      hasUpdateAvailable,
      publishedAt: t.publishedAt ? t.publishedAt.toISOString() : t.createdAt.toISOString(),
    };
  }

  async listTemplateVersions(templateId: string): Promise<AgentTemplateVersionRecord[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentTemplateVersions)
      .where(eq(aiAgentTemplateVersions.templateId, templateId))
      .orderBy(desc(aiAgentTemplateVersions.createdAt));

    return rows.map((r) => ({
      id: r.id,
      templateId: r.templateId,
      version: r.version,
      name: r.name,
      description: r.description,
      instructions: r.instructions,
      configurationSchema: (r.configurationSchema as any) ?? {},
      inputSchema: (r.inputSchema as any) ?? {},
      outputSchema: (r.outputSchema as any) ?? {},
      capabilities: (r.capabilities as any) ?? [],
      requiredPermissions: (r.requiredPermissions as any) ?? [],
      defaultApprovalPolicy: (r.defaultApprovalPolicy as any) ?? null,
      changelog: r.changelog,
      status: r.status as PublishingStatus,
      reviewNotes: r.reviewNotes,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async getTemplateVersion(
    templateId: string,
    version: string,
  ): Promise<AgentTemplateVersionRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentTemplateVersions)
      .where(
        and(
          eq(aiAgentTemplateVersions.templateId, templateId),
          eq(aiAgentTemplateVersions.version, version),
        ),
      )
      .limit(1);

    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      templateId: r.templateId,
      version: r.version,
      name: r.name,
      description: r.description,
      instructions: r.instructions,
      configurationSchema: (r.configurationSchema as any) ?? {},
      inputSchema: (r.inputSchema as any) ?? {},
      outputSchema: (r.outputSchema as any) ?? {},
      capabilities: (r.capabilities as any) ?? [],
      requiredPermissions: (r.requiredPermissions as any) ?? [],
      defaultApprovalPolicy: (r.defaultApprovalPolicy as any) ?? null,
      changelog: r.changelog,
      status: r.status as PublishingStatus,
      reviewNotes: r.reviewNotes,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async createTemplateVersion(
    input: Omit<AgentTemplateVersionRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<AgentTemplateVersionRecord> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(aiAgentTemplateVersions).values({
      id,
      templateId: input.templateId,
      version: input.version,
      name: input.name,
      description: input.description,
      instructions: input.instructions,
      configurationSchema: input.configurationSchema,
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      capabilities: input.capabilities,
      requiredPermissions: input.requiredPermissions,
      defaultApprovalPolicy: input.defaultApprovalPolicy ?? null,
      changelog: input.changelog,
      status: input.status,
      reviewNotes: input.reviewNotes ?? null,
      reviewedBy: input.reviewedBy ?? null,
      reviewedAt: input.reviewedAt ?? null,
      publishedAt: input.publishedAt ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateTemplatePublishingStatus(
    templateId: string,
    status: PublishingStatus,
    reviewNotes?: string | null,
    reviewerId?: string | null,
  ): Promise<void> {
    const now = new Date();
    const updatePayload: Record<string, unknown> = {
      publishingStatus: status,
      updatedAt: now,
    };
    if (reviewNotes !== undefined) updatePayload.reviewNotes = reviewNotes;
    if (reviewerId !== undefined) updatePayload.reviewedBy = reviewerId;
    if (reviewerId) updatePayload.reviewedAt = now;
    if (status === "published") updatePayload.publishedAt = now;

    await this.context.db
      .update(aiAgentTemplates)
      .set(updatePayload)
      .where(eq(aiAgentTemplates.id, templateId));
  }

  async updateVersionPublishingStatus(
    versionId: string,
    status: PublishingStatus,
    reviewNotes?: string | null,
    reviewerId?: string | null,
  ): Promise<void> {
    const now = new Date();
    const updatePayload: Record<string, unknown> = {
      status,
      updatedAt: now,
    };
    if (reviewNotes !== undefined) updatePayload.reviewNotes = reviewNotes;
    if (reviewerId !== undefined) updatePayload.reviewedBy = reviewerId;
    if (reviewerId) updatePayload.reviewedAt = now;
    if (status === "published") updatePayload.publishedAt = now;

    await this.context.db
      .update(aiAgentTemplateVersions)
      .set(updatePayload)
      .where(eq(aiAgentTemplateVersions.id, versionId));
  }

  async listOrganizationAuthoredTemplates(organizationId: string): Promise<AgentTemplateRecord[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentTemplates)
      .where(eq(aiAgentTemplates.publisherOrganizationId, organizationId))
      .orderBy(desc(aiAgentTemplates.createdAt));

    return rows as unknown as AgentTemplateRecord[];
  }

  async listPendingSubmissions(): Promise<MarketplaceReviewSubmissionDto[]> {
    const rows = await this.context.db
      .select({
        template: aiAgentTemplates,
        publisherOrgName: organizations.name,
        submitterEmail: users.email,
      })
      .from(aiAgentTemplates)
      .leftJoin(organizations, eq(aiAgentTemplates.publisherOrganizationId, organizations.id))
      .leftJoin(users, eq(aiAgentTemplates.publisherUserId, users.id))
      .where(inArray(aiAgentTemplates.publishingStatus, ["submitted", "under_review"]))
      .orderBy(desc(aiAgentTemplates.updatedAt));

    return rows.map((r) => ({
      id: r.template.id,
      slug: r.template.slug,
      name: r.template.name,
      summary: r.template.summary,
      description: r.template.description,
      category: r.template.category,
      industry: r.template.industry,
      publisherType: r.template.publisherType,
      publisherOrganizationId: r.template.publisherOrganizationId,
      publisherOrganizationName: r.publisherOrgName,
      publisherUserId: r.template.publisherUserId,
      publisherUserEmail: r.submitterEmail,
      publishingStatus: r.template.publishingStatus,
      reviewNotes: r.template.reviewNotes,
      updatedAt: r.template.updatedAt.toISOString(),
      template: r.template,
    }));
  }

  async createInstallation(
    input: Omit<AgentInstallationRecord, "id" | "installedAt" | "uninstalledAt" | "uninstalledBy">,
  ): Promise<AgentInstallationRecord> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(aiAgentInstallations).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      templateId: input.templateId,
      templateVersionId: input.templateVersionId,
      installedVersion: input.installedVersion,
      agentDefinitionId: input.agentDefinitionId,
      installedBy: input.installedBy,
      status: input.status,
      metadata: input.metadata,
      installedAt: now,
    });

    return {
      ...input,
      id,
      installedAt: now,
      uninstalledAt: null,
      uninstalledBy: null,
    };
  }

  async listInstalledAgents(
    organizationId: string,
    workspaceId?: string,
  ): Promise<
    Array<{
      agent: typeof aiAgentDefinitions.$inferSelect;
      template: typeof aiAgentTemplates.$inferSelect | null;
      hasUpdateAvailable: boolean;
    }>
  > {
    const conditions: SQL[] = [
      eq(aiAgentDefinitions.organizationId, organizationId),
      inArray(aiAgentDefinitions.status, ["active", "configured", "paused", "suspended"]),
    ];
    if (workspaceId) {
      conditions.push(eq(aiAgentDefinitions.workspaceId, workspaceId));
    }

    const rows = await this.context.db
      .select({
        agent: aiAgentDefinitions,
        template: aiAgentTemplates,
      })
      .from(aiAgentDefinitions)
      .leftJoin(aiAgentTemplates, eq(aiAgentDefinitions.templateId, aiAgentTemplates.id))
      .where(and(...conditions))
      .orderBy(desc(aiAgentDefinitions.createdAt));

    return rows.map((r) => {
      const installedVer = r.agent.installedVersion || "1.0.0";
      const latestVer = r.template?.latestVersion || "1.0.0";
      const hasUpdateAvailable = installedVer !== latestVer;
      return {
        id: r.agent.id,
        agentDefinitionId: r.agent.id,
        agentName: r.agent.name,
        agentKey: r.agent.agentKey,
        status: r.agent.status,
        enabled: r.agent.enabled,
        workspaceId: r.agent.workspaceId,
        templateId: r.agent.templateId ?? "",
        templateName: r.template?.name ?? r.agent.name,
        templateSlug: r.template?.slug ?? "",
        category: r.template?.category ?? "General",
        industry: r.template?.industry ?? "General",
        icon: r.template?.icon ?? "🤖",
        publisherType: r.template?.publisherType ?? "platform",
        installedVersion: installedVer,
        latestTemplateVersion: latestVer,
        hasUpdateAvailable,
        isUpgradeAvailable: hasUpdateAvailable,
        installedAt: r.agent.createdAt.toISOString(),
        agent: r.agent,
        template: r.template,
      };
    });
  }

  async getInstallationForAgent(
    organizationId: string,
    agentId: string,
  ): Promise<AgentInstallationRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentInstallations)
      .where(
        and(
          eq(aiAgentInstallations.organizationId, organizationId),
          eq(aiAgentInstallations.agentDefinitionId, agentId),
          eq(aiAgentInstallations.status, "active"),
        ),
      )
      .orderBy(desc(aiAgentInstallations.installedAt))
      .limit(1);

    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      templateId: r.templateId,
      templateVersionId: r.templateVersionId,
      installedVersion: r.installedVersion,
      agentDefinitionId: r.agentDefinitionId,
      installedBy: r.installedBy,
      status: r.status as "active" | "uninstalled" | "upgraded",
      installedAt: r.installedAt,
      uninstalledAt: r.uninstalledAt,
      uninstalledBy: r.uninstalledBy,
      metadata: r.metadata as Record<string, unknown>,
    };
  }

  async upgradeAgentVersion(
    organizationId: string,
    agentId: string,
    targetVersion: string,
    versionId: string,
    userId: string,
  ): Promise<void> {
    const now = new Date();

    // 1. Mark existing active installations for this agent as upgraded
    await this.context.db
      .update(aiAgentInstallations)
      .set({
        status: "upgraded",
        uninstalledAt: now,
        uninstalledBy: userId,
      })
      .where(
        and(
          eq(aiAgentInstallations.organizationId, organizationId),
          eq(aiAgentInstallations.agentDefinitionId, agentId),
          eq(aiAgentInstallations.status, "active"),
        ),
      );

    // 2. Update agent definition installed version
    await this.context.db
      .update(aiAgentDefinitions)
      .set({
        installedVersion: targetVersion,
        templateVersionId: versionId,
        updatedAt: now,
      })
      .where(
        and(
          eq(aiAgentDefinitions.organizationId, organizationId),
          eq(aiAgentDefinitions.id, agentId),
        ),
      );

    // 3. Get agent details for new installation record
    const agent = await this.context.db
      .select()
      .from(aiAgentDefinitions)
      .where(
        and(
          eq(aiAgentDefinitions.organizationId, organizationId),
          eq(aiAgentDefinitions.id, agentId),
        ),
      )
      .limit(1);

    if (agent.length && agent[0].templateId) {
      await this.context.db.insert(aiAgentInstallations).values({
        id: randomUUID(),
        organizationId,
        workspaceId: agent[0].workspaceId,
        templateId: agent[0].templateId,
        templateVersionId: versionId,
        installedVersion: targetVersion,
        agentDefinitionId: agentId,
        installedBy: userId,
        status: "active",
        metadata: { upgradedFrom: agent[0].installedVersion },
        installedAt: now,
      });
    }
  }

  async uninstallAgent(
    organizationId: string,
    agentId: string,
    userId: string,
    reason?: string,
  ): Promise<void> {
    const now = new Date();

    // 1. Mark installation records as uninstalled
    await this.context.db
      .update(aiAgentInstallations)
      .set({
        status: "uninstalled",
        uninstalledAt: now,
        uninstalledBy: userId,
        metadata: reason ? { reason } : null,
      })
      .where(
        and(
          eq(aiAgentInstallations.organizationId, organizationId),
          eq(aiAgentInstallations.agentDefinitionId, agentId),
          eq(aiAgentInstallations.status, "active"),
        ),
      );

    // 2. Soft-delete / archive agent definition
    await this.context.db
      .update(aiAgentDefinitions)
      .set({
        status: "archived",
        enabled: false,
        archivedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(aiAgentDefinitions.organizationId, organizationId),
          eq(aiAgentDefinitions.id, agentId),
        ),
      );
  }

  async getMarketplaceAnalytics(_viewerOrgId?: string): Promise<MarketplaceAnalyticsDto> {
    // Aggregates based 100% on actual persisted records:
    const [publishedCount, totalInstalls, activeInstalls, pendingSubs, industryRows, categoryRows, versionRows] =
      await Promise.all([
        this.context.db
          .select({ count: sql<number>`count(*)` })
          .from(aiAgentTemplates)
          .where(eq(aiAgentTemplates.publishingStatus, "published")),
        this.context.db.select({ count: sql<number>`count(*)` }).from(aiAgentInstallations),
        this.context.db
          .select({ count: sql<number>`count(*)` })
          .from(aiAgentInstallations)
          .where(eq(aiAgentInstallations.status, "active")),
        this.context.db
          .select({ count: sql<number>`count(*)` })
          .from(aiAgentTemplates)
          .where(inArray(aiAgentTemplates.publishingStatus, ["submitted", "under_review"])),
        this.context.db
          .select({
            industry: aiAgentTemplates.industry,
            count: sql<number>`count(*)`,
          })
          .from(aiAgentTemplates)
          .where(eq(aiAgentTemplates.publishingStatus, "published"))
          .groupBy(aiAgentTemplates.industry),
        this.context.db
          .select({
            category: aiAgentTemplates.category,
            count: sql<number>`count(*)`,
          })
          .from(aiAgentTemplates)
          .where(eq(aiAgentTemplates.publishingStatus, "published"))
          .groupBy(aiAgentTemplates.category),
        this.context.db
          .select({
            templateName: aiAgentTemplates.name,
            version: aiAgentInstallations.installedVersion,
            count: sql<number>`count(*)`,
          })
          .from(aiAgentInstallations)
          .innerJoin(aiAgentTemplates, eq(aiAgentInstallations.templateId, aiAgentTemplates.id))
          .where(eq(aiAgentInstallations.status, "active"))
          .groupBy(aiAgentTemplates.name, aiAgentInstallations.installedVersion),
      ]);

    const agentsByIndustry: Record<string, number> = {};
    for (const r of industryRows) {
      if (r.industry) agentsByIndustry[r.industry] = Number(r.count);
    }

    const agentsByCategory: Record<string, number> = {};
    for (const r of categoryRows) {
      if (r.category) agentsByCategory[r.category] = Number(r.count);
    }

    const versionAdoption = versionRows.map((v) => ({
      templateName: v.templateName,
      version: v.version,
      installCount: Number(v.count),
    }));

    const pub = Number(publishedCount[0]?.count ?? 0);
    const tot = Number(totalInstalls[0]?.count ?? 0);
    const act = Number(activeInstalls[0]?.count ?? 0);
    const pen = Number(pendingSubs[0]?.count ?? 0);

    return {
      totalPublishedAgents: pub,
      publishedAgentsCount: pub,
      totalInstallations: tot,
      totalInstallationsCount: tot,
      activeInstallations: act,
      activeInstallationsCount: act,
      pendingSubmissions: pen,
      pendingReviewsCount: pen,
      agentsByIndustry,
      agentsByCategory,
      versionAdoption,
    };
  }
}
