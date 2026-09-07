import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  aiAgentConversations,
  aiAgentMemories,
  aiAgentMessages,
  aiAgentRuns,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type { AgentMemoryQuery, AgentMemoryRecord, JsonRecord } from "../agent.types.js";

export class AgentMemoryRepository {
  constructor(private readonly context: RepositoryContext) {}

  async listForAgent(query: AgentMemoryQuery): Promise<AgentMemoryRecord[]> {
    const clauses = [
      eq(aiAgentMemories.organizationId, query.organizationId),
      eq(aiAgentMemories.agentId, query.agentId),
      eq(aiAgentMemories.status, query.status ?? "active"),
    ];
    if (query.type) clauses.push(eq(aiAgentMemories.type, query.type));
    if (query.scope) clauses.push(eq(aiAgentMemories.scope, query.scope));

    const rows = await this.context.db
      .select()
      .from(aiAgentMemories)
      .where(and(...clauses))
      .orderBy(desc(aiAgentMemories.importance), desc(aiAgentMemories.updatedAt))
      .limit(query.limit)
      .offset(query.offset);

    return rows
      .map(normalizeMemory)
      .filter((memory) => isVisibleToUser(memory, query.userId, query.conversationId));
  }

  async findById(organizationId: string, memoryId: string): Promise<AgentMemoryRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentMemories)
      .where(
        and(eq(aiAgentMemories.organizationId, organizationId), eq(aiAgentMemories.id, memoryId)),
      )
      .limit(1);
    return rows[0] ? normalizeMemory(rows[0]) : null;
  }

  async create(
    input: Omit<
      AgentMemoryRecord,
      "id" | "status" | "lastUsedAt" | "usageCount" | "createdAt" | "updatedAt"
    >,
  ): Promise<AgentMemoryRecord> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentMemories).values({
      ...input,
      id,
      status: "active",
      lastUsedAt: null,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.findById(input.organizationId, id);
    if (!created) throw new Error("Agent memory create failed.");
    return created;
  }

  async update(
    organizationId: string,
    memoryId: string,
    updates: Partial<
      Pick<
        AgentMemoryRecord,
        | "scope"
        | "type"
        | "content"
        | "status"
        | "importance"
        | "metadata"
        | "expiresAt"
        | "updatedBy"
      >
    >,
  ): Promise<AgentMemoryRecord | null> {
    await this.context.db
      .update(aiAgentMemories)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(eq(aiAgentMemories.organizationId, organizationId), eq(aiAgentMemories.id, memoryId)),
      );
    return this.findById(organizationId, memoryId);
  }

  async markUsed(memoryIds: string[]): Promise<void> {
    for (const memoryId of memoryIds) {
      const memory = await this.context.db
        .select()
        .from(aiAgentMemories)
        .where(eq(aiAgentMemories.id, memoryId))
        .limit(1);
      if (!memory[0]) continue;
      await this.context.db
        .update(aiAgentMemories)
        .set({
          lastUsedAt: new Date(),
          usageCount: (memory[0].usageCount ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(aiAgentMemories.id, memoryId));
    }
  }

  async findConversation(organizationId: string, conversationId: string, userId: string) {
    const rows = await this.context.db
      .select()
      .from(aiAgentConversations)
      .where(
        and(
          eq(aiAgentConversations.organizationId, organizationId),
          eq(aiAgentConversations.id, conversationId),
          eq(aiAgentConversations.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async findRun(organizationId: string, runId: string, userId: string) {
    const rows = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(
        and(
          eq(aiAgentRuns.organizationId, organizationId),
          eq(aiAgentRuns.id, runId),
          eq(aiAgentRuns.requestedBy, userId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async findMessage(organizationId: string, messageId: string, userId: string) {
    const rows = await this.context.db
      .select({ message: aiAgentMessages, conversation: aiAgentConversations })
      .from(aiAgentMessages)
      .innerJoin(aiAgentConversations, eq(aiAgentMessages.conversationId, aiAgentConversations.id))
      .where(
        and(
          eq(aiAgentMessages.organizationId, organizationId),
          eq(aiAgentMessages.id, messageId),
          eq(aiAgentConversations.userId, userId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }
}

function isVisibleToUser(
  memory: AgentMemoryRecord,
  userId: string,
  conversationId?: string,
): boolean {
  if (memory.expiresAt && memory.expiresAt.getTime() <= Date.now()) return false;
  if (memory.scope === "user") return memory.userId === userId;
  if (memory.scope === "conversation")
    return (
      memory.userId === userId &&
      (!conversationId || memory.sourceConversationId === conversationId)
    );
  return true;
}

function normalizeMemory(row: AgentMemoryRecord): AgentMemoryRecord {
  return {
    ...row,
    metadata: normalizeRecord(row.metadata),
  };
}

function normalizeRecord(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      return normalizeRecord(JSON.parse(value) as unknown);
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonRecord;
  return {};
}
