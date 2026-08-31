import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { aiAgentConversations, aiAgentMessages, aiAgentRuns } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AgentConversationRecord,
  AgentMessageRecord,
  AgentRunRecord,
  JsonRecord,
  PaginationInput,
} from "../agent.types.js";

export class AgentRuntimeRepository {
  constructor(private readonly context: RepositoryContext) {}

  async listRuns(
    organizationId: string,
    agentId: string,
    userId: string,
    pagination: PaginationInput,
  ): Promise<AgentRunRecord[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(
        and(
          eq(aiAgentRuns.organizationId, organizationId),
          eq(aiAgentRuns.agentId, agentId),
          eq(aiAgentRuns.requestedBy, userId),
        ),
      )
      .orderBy(desc(aiAgentRuns.startedAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
    return rows.map(normalizeRun);
  }

  async getRun(
    organizationId: string,
    runId: string,
    userId: string,
  ): Promise<AgentRunRecord | null> {
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
    return rows[0] ? normalizeRun(rows[0]) : null;
  }

  async getRunForConversation(
    organizationId: string,
    runId: string,
    conversationId: string,
    userId: string,
  ): Promise<AgentRunRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(
        and(
          eq(aiAgentRuns.organizationId, organizationId),
          eq(aiAgentRuns.id, runId),
          eq(aiAgentRuns.conversationId, conversationId),
          eq(aiAgentRuns.requestedBy, userId),
        ),
      )
      .limit(1);
    return rows[0] ? normalizeRun(rows[0]) : null;
  }

  async listConversations(
    organizationId: string,
    userId: string,
    pagination: PaginationInput,
    agentId?: string,
  ): Promise<AgentConversationRecord[]> {
    const condition = agentId
      ? and(
          eq(aiAgentConversations.organizationId, organizationId),
          eq(aiAgentConversations.userId, userId),
          eq(aiAgentConversations.agentId, agentId),
        )
      : and(
          eq(aiAgentConversations.organizationId, organizationId),
          eq(aiAgentConversations.userId, userId),
        );
    const rows = await this.context.db
      .select()
      .from(aiAgentConversations)
      .where(condition)
      .orderBy(desc(aiAgentConversations.updatedAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
    return rows.map(normalizeConversation);
  }

  async getConversation(
    organizationId: string,
    conversationId: string,
    userId: string,
  ): Promise<AgentConversationRecord | null> {
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
    return rows[0] ? normalizeConversation(rows[0]) : null;
  }

  async createConversation(
    input: Omit<
      AgentConversationRecord,
      "id" | "status" | "lastMessageAt" | "createdAt" | "updatedAt"
    >,
  ): Promise<AgentConversationRecord> {
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentConversations).values({
      ...input,
      id,
      status: "active",
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getConversation(input.organizationId, id, input.userId);
    if (!created) throw new Error("Conversation create failed.");
    return created;
  }

  async createRun(
    input: Omit<
      AgentRunRecord,
      | "id"
      | "status"
      | "output"
      | "errorCode"
      | "safeErrorMessage"
      | "completedAt"
      | "durationMs"
      | "createdAt"
      | "updatedAt"
    >,
  ): Promise<AgentRunRecord> {
    if (input.idempotencyKey) {
      const existing = await this.getRunByIdempotencyKey(
        input.workspaceId,
        input.agentId,
        input.idempotencyKey,
        input.requestedBy,
      );
      if (existing) return existing;
    }
    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(aiAgentRuns).values({
      ...input,
      id,
      status: "queued",
      output: null,
      errorCode: null,
      safeErrorMessage: null,
      completedAt: null,
      durationMs: null,
      createdAt: now,
      updatedAt: now,
    });
    const created = await this.getRun(input.organizationId, id, input.requestedBy);
    if (!created) throw new Error("Agent run create failed.");
    return created;
  }

  async updateRun(
    organizationId: string,
    runId: string,
    userId: string,
    updates: Partial<
      Pick<
        AgentRunRecord,
        | "status"
        | "output"
        | "errorCode"
        | "safeErrorMessage"
        | "metadata"
        | "completedAt"
        | "durationMs"
      >
    >,
  ): Promise<AgentRunRecord | null> {
    await this.context.db
      .update(aiAgentRuns)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(aiAgentRuns.organizationId, organizationId),
          eq(aiAgentRuns.id, runId),
          eq(aiAgentRuns.requestedBy, userId),
        ),
      );
    return this.getRun(organizationId, runId, userId);
  }

  async listMessages(
    organizationId: string,
    conversationId: string,
    userId: string,
    pagination: PaginationInput,
  ): Promise<AgentMessageRecord[]> {
    const conversation = await this.getConversation(organizationId, conversationId, userId);
    if (!conversation) return [];
    const rows = await this.context.db
      .select()
      .from(aiAgentMessages)
      .where(
        and(
          eq(aiAgentMessages.organizationId, organizationId),
          eq(aiAgentMessages.conversationId, conversationId),
        ),
      )
      .orderBy(aiAgentMessages.sequence)
      .limit(pagination.limit)
      .offset(pagination.offset);
    return rows.map(normalizeMessage);
  }

  async createMessage(
    input: Omit<AgentMessageRecord, "id" | "sequence" | "createdAt">,
  ): Promise<AgentMessageRecord> {
    const id = randomUUID();
    const now = new Date();
    const last = await this.context.db
      .select()
      .from(aiAgentMessages)
      .where(eq(aiAgentMessages.conversationId, input.conversationId))
      .orderBy(desc(aiAgentMessages.sequence))
      .limit(1);
    const sequence = (last[0]?.sequence ?? 0) + 1;
    await this.context.db
      .insert(aiAgentMessages)
      .values({ ...input, id, sequence, createdAt: now });
    await this.context.db
      .update(aiAgentConversations)
      .set({ lastMessageAt: now, updatedAt: now })
      .where(eq(aiAgentConversations.id, input.conversationId));
    const rows = await this.context.db
      .select()
      .from(aiAgentMessages)
      .where(eq(aiAgentMessages.id, id))
      .limit(1);
    if (!rows[0]) throw new Error("Message create failed.");
    return normalizeMessage(rows[0]);
  }

  private async getRunByIdempotencyKey(
    workspaceId: string,
    agentId: string,
    idempotencyKey: string,
    userId: string,
  ): Promise<AgentRunRecord | null> {
    const rows = await this.context.db
      .select()
      .from(aiAgentRuns)
      .where(
        and(
          eq(aiAgentRuns.workspaceId, workspaceId),
          eq(aiAgentRuns.agentId, agentId),
          eq(aiAgentRuns.idempotencyKey, idempotencyKey),
          eq(aiAgentRuns.requestedBy, userId),
        ),
      )
      .limit(1);
    return rows[0] ? normalizeRun(rows[0]) : null;
  }
}

function normalizeRun(row: AgentRunRecord): AgentRunRecord {
  return {
    ...row,
    input: normalizeRecord(row.input),
    output: row.output ? normalizeRecord(row.output) : null,
    metadata: normalizeRecord(row.metadata),
  };
}

function normalizeConversation(row: AgentConversationRecord): AgentConversationRecord {
  return row;
}

function normalizeMessage(row: AgentMessageRecord): AgentMessageRecord {
  return {
    ...row,
    metadata: row.metadata ? normalizeRecord(row.metadata) : null,
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
