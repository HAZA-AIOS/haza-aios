import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { aiAgentDefinitions, aiAgentToolAssignments } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type { AgentDefinitionRecord, AgentDefinitionWithTools, AgentToolAssignmentRecord, JsonRecord } from "../agent.types.js";

export class AgentRepository {
  constructor(private readonly context: RepositoryContext) {}

  async listByOrganization(organizationId: string): Promise<AgentDefinitionWithTools[]> {
    const rows = await this.context.db.select().from(aiAgentDefinitions).where(eq(aiAgentDefinitions.organizationId, organizationId));
    return Promise.all(rows.map((row) => this.withTools(normalizeAgent(row))));
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
      id,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getByIdForOrganization(input.organizationId, id);
    if (!created) throw new Error("Agent definition create failed.");
    return created;
  }

  async updateConfiguration(organizationId: string, agentId: string, configuration: JsonRecord, instructions: string, modelProvider: string, modelSelection: string): Promise<AgentDefinitionWithTools | null> {
    await this.context.db.update(aiAgentDefinitions).set({
      configuration,
      instructions,
      modelProvider,
      modelSelection,
      status: "configured",
      enabled: true,
      updatedAt: new Date(),
    }).where(and(
      eq(aiAgentDefinitions.organizationId, organizationId),
      eq(aiAgentDefinitions.id, agentId),
    ));

    return this.getByIdForOrganization(organizationId, agentId);
  }

  async updateStatus(organizationId: string, agentId: string, status: AgentDefinitionRecord["status"], enabled: boolean): Promise<AgentDefinitionWithTools | null> {
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

function normalizeAgent(row: AgentDefinitionRecord): AgentDefinitionRecord {
  return {
    ...row,
    configuration: normalizeRecord(row.configuration),
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
