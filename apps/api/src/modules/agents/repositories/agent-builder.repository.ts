import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { aiAgentConfigurationRevisions, aiAgentDefinitions } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AgentConfigurationRevisionRecord,
  AgentValidationError,
  HumanApprovalPolicy,
  JsonRecord,
} from "../agent.types.js";

export class AgentBuilderRepository {
  constructor(private readonly context: RepositoryContext) {}

  async createRevision(
    data: {
      organizationId: string;
      workspaceId: string;
      agentId: string;
      revisionNumber: number;
      version: string;
      status: "draft" | "published" | "archived";
      configuration: JsonRecord;
      validationStatus: "valid" | "invalid" | "warning";
      validationErrors?: AgentValidationError[] | null;
      changelog?: string | null;
      createdBy: string;
      publishedBy?: string | null;
      publishedAt?: Date | null;
    },
  ): Promise<AgentConfigurationRevisionRecord> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(aiAgentConfigurationRevisions).values({
      id,
      organizationId: data.organizationId,
      workspaceId: data.workspaceId,
      agentId: data.agentId,
      revisionNumber: data.revisionNumber,
      version: data.version,
      status: data.status,
      configuration: data.configuration,
      validationStatus: data.validationStatus,
      validationErrors: data.validationErrors as any,
      changelog: data.changelog ?? null,
      createdBy: data.createdBy,
      publishedBy: data.publishedBy ?? null,
      publishedAt: data.publishedAt ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await this.getRevisionById(data.organizationId, data.agentId, id);
    if (!created) {
      throw new Error("Failed to create agent configuration revision.");
    }
    return created;
  }

  async getRevisionById(
    organizationId: string,
    agentId: string,
    revisionId: string,
  ): Promise<AgentConfigurationRevisionRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentConfigurationRevisions)
      .where(
        and(
          eq(aiAgentConfigurationRevisions.id, revisionId),
          eq(aiAgentConfigurationRevisions.agentId, agentId),
          eq(aiAgentConfigurationRevisions.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!rows.length) return null;
    return normalizeRevision(rows[0]);
  }

  async getRevisionByNumber(
    organizationId: string,
    agentId: string,
    revisionNumber: number,
  ): Promise<AgentConfigurationRevisionRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentConfigurationRevisions)
      .where(
        and(
          eq(aiAgentConfigurationRevisions.agentId, agentId),
          eq(aiAgentConfigurationRevisions.organizationId, organizationId),
          eq(aiAgentConfigurationRevisions.revisionNumber, revisionNumber),
        ),
      )
      .limit(1);

    if (!rows.length) return null;
    return normalizeRevision(rows[0]);
  }

  async getLatestRevision(
    organizationId: string,
    agentId: string,
  ): Promise<AgentConfigurationRevisionRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentConfigurationRevisions)
      .where(
        and(
          eq(aiAgentConfigurationRevisions.agentId, agentId),
          eq(aiAgentConfigurationRevisions.organizationId, organizationId),
        ),
      )
      .orderBy(desc(aiAgentConfigurationRevisions.revisionNumber))
      .limit(1);

    if (!rows.length) return null;
    return normalizeRevision(rows[0]);
  }

  async getDraftRevision(
    organizationId: string,
    agentId: string,
  ): Promise<AgentConfigurationRevisionRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentConfigurationRevisions)
      .where(
        and(
          eq(aiAgentConfigurationRevisions.agentId, agentId),
          eq(aiAgentConfigurationRevisions.organizationId, organizationId),
          eq(aiAgentConfigurationRevisions.status, "draft"),
        ),
      )
      .orderBy(desc(aiAgentConfigurationRevisions.revisionNumber))
      .limit(1);

    if (!rows.length) return null;
    return normalizeRevision(rows[0]);
  }

  async getActivePublishedRevision(
    organizationId: string,
    agentId: string,
  ): Promise<AgentConfigurationRevisionRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentConfigurationRevisions)
      .where(
        and(
          eq(aiAgentConfigurationRevisions.agentId, agentId),
          eq(aiAgentConfigurationRevisions.organizationId, organizationId),
          eq(aiAgentConfigurationRevisions.status, "published"),
        ),
      )
      .orderBy(desc(aiAgentConfigurationRevisions.revisionNumber))
      .limit(1);

    if (!rows.length) return null;
    return normalizeRevision(rows[0]);
  }

  async listRevisions(
    organizationId: string,
    agentId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<{
    items: AgentConfigurationRevisionRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, pagination.page);
    const pageSize = Math.max(1, Math.min(100, pagination.pageSize));
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(aiAgentConfigurationRevisions.organizationId, organizationId),
      eq(aiAgentConfigurationRevisions.agentId, agentId),
    ];

    const [rows, countRes] = await Promise.all([
      this.context.db
        .select()
        .from(aiAgentConfigurationRevisions)
        .where(and(...conditions))
        .orderBy(desc(aiAgentConfigurationRevisions.revisionNumber))
        .limit(pageSize)
        .offset(offset),
      this.context.db
        .select({ count: sql<number>`count(*)` })
        .from(aiAgentConfigurationRevisions)
        .where(and(...conditions)),
    ]);

    const total = Number(countRes[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      items: rows.map(normalizeRevision),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async updateRevision(
    revisionId: string,
    updates: {
      configuration?: JsonRecord;
      version?: string;
      status?: "draft" | "published" | "archived";
      validationStatus?: "valid" | "invalid" | "warning";
      validationErrors?: AgentValidationError[] | null;
      changelog?: string | null;
      publishedBy?: string | null;
      publishedAt?: Date | null;
    },
  ): Promise<AgentConfigurationRevisionRecord | null> {
    const patch: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (updates.configuration !== undefined) patch.configuration = updates.configuration;
    if (updates.version !== undefined) patch.version = updates.version;
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.validationStatus !== undefined) patch.validationStatus = updates.validationStatus;
    if (updates.validationErrors !== undefined) patch.validationErrors = updates.validationErrors;
    if (updates.changelog !== undefined) patch.changelog = updates.changelog;
    if (updates.publishedBy !== undefined) patch.publishedBy = updates.publishedBy;
    if (updates.publishedAt !== undefined) patch.publishedAt = updates.publishedAt;

    await this.context.db
      .update(aiAgentConfigurationRevisions)
      .set(patch)
      .where(eq(aiAgentConfigurationRevisions.id, revisionId));

    const rows = await this.context.db
      .select()
      .from(aiAgentConfigurationRevisions)
      .where(eq(aiAgentConfigurationRevisions.id, revisionId))
      .limit(1);

    if (!rows.length) return null;
    return normalizeRevision(rows[0]);
  }

  async getNextRevisionNumber(agentId: string): Promise<number> {
    const rows = await this.context.db
      .select({ maxRev: sql<number>`COALESCE(MAX(${aiAgentConfigurationRevisions.revisionNumber}), 0)` })
      .from(aiAgentConfigurationRevisions)
      .where(eq(aiAgentConfigurationRevisions.agentId, agentId));

    const currentMax = Number(rows[0]?.maxRev ?? 0);
    return currentMax + 1;
  }

  async updateActiveAgentConfiguration(
    agentId: string,
    revisionId: string,
    revisionNumber: number,
    configuration: JsonRecord,
    instructions?: string,
    modelProvider?: string,
    modelSelection?: string,
    humanApprovalPolicy?: HumanApprovalPolicy | null,
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      activeRevisionId: revisionId,
      activeRevisionNumber: revisionNumber,
      configuration,
      updatedAt: new Date(),
    };

    if (instructions !== undefined) patch.instructions = instructions;
    if (modelProvider !== undefined) patch.modelProvider = modelProvider;
    if (modelSelection !== undefined) patch.modelSelection = modelSelection;
    if (humanApprovalPolicy !== undefined) patch.humanApprovalPolicy = humanApprovalPolicy;

    await this.context.db
      .update(aiAgentDefinitions)
      .set(patch)
      .where(eq(aiAgentDefinitions.id, agentId));
  }
}

function normalizeRevision(row: any): AgentConfigurationRevisionRecord {
  return {
    ...row,
    configuration: normalizeRecord(row.configuration),
    validationErrors: Array.isArray(row.validationErrors)
      ? row.validationErrors
      : typeof row.validationErrors === "string"
        ? tryParseJson(row.validationErrors)
        : null,
  };
}

function tryParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return normalizeRecord(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
