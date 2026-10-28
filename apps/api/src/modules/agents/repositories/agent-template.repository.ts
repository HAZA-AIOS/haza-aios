import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { aiAgentTemplates } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type { AgentTemplateRecord, UpsertAgentTemplateInput } from "../agent.types.js";

export class AgentTemplateRepository {
  constructor(private readonly context: RepositoryContext) {}

  async listAvailable(): Promise<AgentTemplateRecord[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentTemplates)
      .where(eq(aiAgentTemplates.status, "available"))
      .orderBy(desc(aiAgentTemplates.createdAt));
    return rows.map((row) => normalizeTemplate(row as unknown as AgentTemplateRecord));
  }

  async listAvailablePaginated(filter?: {
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
    const page = Math.max(1, filter?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filter?.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [eq(aiAgentTemplates.status, "available")];

    if (filter?.category) {
      conditions.push(eq(aiAgentTemplates.category, filter.category));
    }
    if (filter?.industry) {
      conditions.push(eq(aiAgentTemplates.industry, filter.industry));
    }
    if (filter?.search) {
      const pattern = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          like(aiAgentTemplates.name, pattern),
          like(aiAgentTemplates.description, pattern),
          like(aiAgentTemplates.slug, pattern),
        )!,
      );
    }

    const [rows, totalRes] = await Promise.all([
      this.context.db
        .select()
        .from(aiAgentTemplates)
        .where(and(...conditions))
        .orderBy(desc(aiAgentTemplates.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.context.db
        .select({ count: sql<number>`count(*)` })
        .from(aiAgentTemplates)
        .where(and(...conditions)),
    ]);

    const total = Number(totalRes[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize) || 1;
    const items = rows.map((row) => normalizeTemplate(row as unknown as AgentTemplateRecord));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getById(id: string): Promise<AgentTemplateRecord | null> {
    const rows = await this.context.db.select().from(aiAgentTemplates).where(eq(aiAgentTemplates.id, id)).limit(1);
    return rows[0] ? normalizeTemplate(rows[0] as unknown as AgentTemplateRecord) : null;
  }

  async upsert(input: UpsertAgentTemplateInput): Promise<AgentTemplateRecord> {
    const existing = await this.getById(input.id);
    const now = new Date();

    if (existing) {
      await this.context.db.update(aiAgentTemplates).set({
        slug: input.slug,
        name: input.name,
        description: input.description,
        version: input.version,
        category: input.category,
        industry: input.industry,
        status: input.status,
        icon: input.icon,
        capabilities: input.capabilities,
        requiredPermissions: input.requiredPermissions,
        configurationSchema: input.configurationSchema,
        inputSchema: input.inputSchema,
        outputSchema: input.outputSchema,
        defaultApprovalPolicy: input.defaultApprovalPolicy ?? null,
        metadata: input.metadata,
        updatedAt: now,
      }).where(eq(aiAgentTemplates.id, input.id));
      const updated = await this.getById(input.id);
      if (!updated) throw new Error("Agent template update failed.");
      return updated;
    }

    await this.context.db.insert(aiAgentTemplates).values({
      ...input,
      defaultApprovalPolicy: input.defaultApprovalPolicy ?? null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await this.getById(input.id);
    if (!created) throw new Error("Agent template create failed.");
    return created;
  }
}

function normalizeTemplate(row: AgentTemplateRecord): AgentTemplateRecord {
  return {
    ...row,
    capabilities: normalizeArray(row.capabilities),
    requiredPermissions: normalizeStringArray(row.requiredPermissions),
    configurationSchema: normalizeRecord(row.configurationSchema),
    inputSchema: normalizeRecord(row.inputSchema),
    outputSchema: normalizeRecord(row.outputSchema),
    defaultApprovalPolicy: row.defaultApprovalPolicy ? normalizeRecord(row.defaultApprovalPolicy) as unknown as AgentTemplateRecord["defaultApprovalPolicy"] : null,
    metadata: normalizeRecord(row.metadata),
  };
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return normalizeRecord(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function normalizeArray<T extends Record<string, unknown>>(value: unknown): T[] {
  if (typeof value === "string") {
    try {
      return normalizeArray(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value as T[] : [];
}

function normalizeStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    try {
      return normalizeStringArray(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
