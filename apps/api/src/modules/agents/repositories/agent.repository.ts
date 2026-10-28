import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { aiAgentDefinitions, aiAgentToolAssignments, auditLogs } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AgentAuditEvent,
  AgentDefinitionRecord,
  AgentDefinitionWithTools,
  AgentToolAssignmentRecord,
  HumanApprovalPolicy,
  JsonRecord,
} from "../agent.types.js";
import { redactSensitiveConfig } from "../validation/agent-validation.js";

export class AgentRepository {
  constructor(private readonly context: RepositoryContext) {}

  async listByOrganization(organizationId: string): Promise<AgentDefinitionWithTools[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentDefinitions)
      .where(eq(aiAgentDefinitions.organizationId, organizationId))
      .orderBy(desc(aiAgentDefinitions.createdAt));
    return Promise.all(rows.map((row) => this.withTools(normalizeAgent(row))));
  }

  async listByOrganizationPaginated(
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
    const page = Math.max(1, filter?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filter?.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [eq(aiAgentDefinitions.organizationId, organizationId)];

    if (filter?.status) {
      conditions.push(eq(aiAgentDefinitions.status, filter.status as AgentDefinitionRecord["status"]));
    }
    if (filter?.workspaceId) {
      conditions.push(eq(aiAgentDefinitions.workspaceId, filter.workspaceId));
    }
    if (filter?.search) {
      const pattern = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          like(aiAgentDefinitions.name, pattern),
          like(aiAgentDefinitions.description, pattern),
          like(aiAgentDefinitions.agentKey, pattern),
        )!,
      );
    }

    const [rows, totalRes] = await Promise.all([
      this.context.db
        .select()
        .from(aiAgentDefinitions)
        .where(and(...conditions))
        .orderBy(desc(aiAgentDefinitions.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.context.db
        .select({ count: sql<number>`count(*)` })
        .from(aiAgentDefinitions)
        .where(and(...conditions)),
    ]);

    const total = Number(totalRes[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize) || 1;
    const items = await Promise.all(rows.map((row) => this.withTools(normalizeAgent(row))));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async getByIdForOrganization(organizationId: string, agentId: string): Promise<AgentDefinitionWithTools | null> {
    const rows = await this.context.db.select().from(aiAgentDefinitions).where(and(
      eq(aiAgentDefinitions.organizationId, organizationId),
      eq(aiAgentDefinitions.id, agentId),
    )).limit(1);

    return rows[0] ? this.withTools(normalizeAgent(rows[0])) : null;
  }

  async getByWorkspaceAndTemplate(workspaceId: string, templateId: string): Promise<AgentDefinitionWithTools | null> {
    const rows = await this.context.db.select().from(aiAgentDefinitions).where(and(
      eq(aiAgentDefinitions.workspaceId, workspaceId),
      eq(aiAgentDefinitions.templateId, templateId),
    )).limit(1);

    return rows[0] ? this.withTools(normalizeAgent(rows[0])) : null;
  }

  async create(input: Omit<AgentDefinitionRecord, "id" | "createdAt" | "updatedAt" | "archivedAt">): Promise<AgentDefinitionWithTools> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentDefinitions).values({
      ...input,
      humanApprovalPolicy: input.humanApprovalPolicy ?? null,
      id,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getByIdForOrganization(input.organizationId, id);
    if (!created) throw new Error("Agent definition create failed.");
    return created;
  }

  async updateConfiguration(
    organizationId: string,
    agentId: string,
    configuration: JsonRecord,
    instructions: string,
    modelProvider: string,
    modelSelection: string,
    humanApprovalPolicy?: HumanApprovalPolicy | null,
  ): Promise<AgentDefinitionWithTools | null> {
    const updateValues: Record<string, unknown> = {
      configuration,
      instructions,
      modelProvider,
      modelSelection,
      status: "configured",
      enabled: true,
      updatedAt: new Date(),
    };
    if (humanApprovalPolicy !== undefined) {
      updateValues.humanApprovalPolicy = humanApprovalPolicy;
    }

    await this.context.db
      .update(aiAgentDefinitions)
      .set(updateValues)
      .where(
        and(
          eq(aiAgentDefinitions.organizationId, organizationId),
          eq(aiAgentDefinitions.id, agentId),
        ),
      );

    return this.getByIdForOrganization(organizationId, agentId);
  }

  async updateStatus(
    organizationId: string,
    agentId: string,
    status: AgentDefinitionRecord["status"],
    enabled: boolean,
  ): Promise<AgentDefinitionWithTools | null> {
    await this.context.db.update(aiAgentDefinitions).set({
      status,
      enabled,
      archivedAt: status === "archived" ? new Date() : null,
      updatedAt: new Date(),
    }).where(and(
      eq(aiAgentDefinitions.organizationId, organizationId),
      eq(aiAgentDefinitions.id, agentId),
    ));

    return this.getByIdForOrganization(organizationId, agentId);
  }

  async replaceToolAssignments(agentId: string, toolKeys: string[]): Promise<void> {
    const active = Array.from(new Set(toolKeys.filter(Boolean)));
    const existing = await this.context.db.select().from(aiAgentToolAssignments).where(eq(aiAgentToolAssignments.agentId, agentId));

    for (const row of existing) {
      await this.context.db.update(aiAgentToolAssignments).set({
        status: active.includes(row.toolKey) ? "active" : "inactive",
        updatedAt: new Date(),
      }).where(eq(aiAgentToolAssignments.id, row.id));
    }

    for (const toolKey of active) {
      if (existing.some((row) => row.toolKey === toolKey)) continue;
      await this.context.db.insert(aiAgentToolAssignments).values({
        id: randomUUID(),
        agentId,
        toolKey,
        status: "active",
        configuration: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  async recordAuditEvent(input: {
    organizationId: string;
    workspaceId?: string | null;
    agentId: string;
    actorUserId?: string | null;
    action: string;
    operation: string;
    result?: "success" | "failure" | "denied";
    beforeSnapshot?: JsonRecord | null;
    afterSnapshot?: JsonRecord | null;
    changedFields?: string[] | null;
    metadata?: JsonRecord;
  }): Promise<void> {
    const now = new Date();
    await this.context.db.insert(auditLogs).values({
      id: randomUUID(),
      organizationId: input.organizationId,
      workspaceId: input.workspaceId ?? null,
      actorType: "user",
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: "agent",
      resourceId: input.agentId,
      operation: input.operation,
      result: input.result ?? "success",
      source: "api",
      beforeSnapshot: input.beforeSnapshot ? (redactSensitiveConfig(input.beforeSnapshot) as Record<string, unknown>) : null,
      afterSnapshot: input.afterSnapshot ? (redactSensitiveConfig(input.afterSnapshot) as Record<string, unknown>) : null,
      changedFields: input.changedFields ?? null,
      metadata: input.metadata ?? {},
      createdAt: now,
    });
  }

  async getAuditHistory(
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
    const page = Math.max(1, pagination.page);
    const pageSize = Math.max(1, Math.min(100, pagination.pageSize));
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(auditLogs.organizationId, organizationId),
      eq(auditLogs.resourceType, "agent"),
      eq(auditLogs.resourceId, agentId),
    ];

    const [rows, totalRes] = await Promise.all([
      this.context.db
        .select()
        .from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(pageSize)
        .offset(offset),
      this.context.db
        .select({ count: sql<number>`count(*)` })
        .from(auditLogs)
        .where(and(...conditions)),
    ]);

    const total = Number(totalRes[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize) || 1;

    const items: AgentAuditEvent[] = rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      agentId: row.resourceId ?? agentId,
      actorUserId: row.actorUserId,
      action: row.action,
      operation: row.operation,
      result: (row.result as AgentAuditEvent["result"]) ?? "success",
      beforeSnapshot: row.beforeSnapshot ? (normalizeRecord(row.beforeSnapshot) as JsonRecord) : null,
      afterSnapshot: row.afterSnapshot ? (normalizeRecord(row.afterSnapshot) as JsonRecord) : null,
      changedFields: Array.isArray(row.changedFields) ? row.changedFields : null,
      metadata: normalizeRecord(row.metadata) as JsonRecord,
      createdAt: row.createdAt,
    }));

    return { items, total, page, pageSize, totalPages };
  }

  private async withTools(agent: AgentDefinitionRecord): Promise<AgentDefinitionWithTools> {
    const rows = await this.context.db.select().from(aiAgentToolAssignments).where(and(
      eq(aiAgentToolAssignments.agentId, agent.id),
      eq(aiAgentToolAssignments.status, "active"),
    ));

    return {
      ...agent,
      tools: rows.map(normalizeToolAssignment),
    };
  }
}

function normalizeAgent(row: any): AgentDefinitionRecord {
  return {
    ...row,
    configuration: normalizeRecord(row.configuration),
    humanApprovalPolicy: row.humanApprovalPolicy
      ? (normalizeRecord(row.humanApprovalPolicy) as unknown as HumanApprovalPolicy)
      : null,
  };
}

function normalizeToolAssignment(row: AgentToolAssignmentRecord): AgentToolAssignmentRecord {
  return {
    ...row,
    configuration: row.configuration ? normalizeRecord(row.configuration) : null,
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
