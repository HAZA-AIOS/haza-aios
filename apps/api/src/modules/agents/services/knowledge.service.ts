import { and, eq, inArray, or } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { knowledgeSources, knowledgeChunks } from "../../../database/schema.js";
import { AgentService } from "./agent.service.js";
import { chunkKnowledge, scoreKnowledge, validateKnowledge } from "../knowledge-validation.js";

export class KnowledgeService {
  constructor(private readonly database: DatabaseClient) {}

  async list(organizationId: string, userId: string) {
    const rows = await this.database.db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.organizationId, organizationId),
          eq(knowledgeSources.status, "active"),
          or(eq(knowledgeSources.visibility, "internal"), eq(knowledgeSources.createdBy, userId)),
        ),
      )
      .limit(200);
    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      description: row.description,
      type: row.type,
      visibility: row.visibility,
      status: row.status,
      ingestionStatus: row.ingestionStatus,
      contentHash: row.contentHash,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async get(organizationId: string, sourceId: string, userId: string) {
    const rows = await this.database.db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.organizationId, organizationId),
          eq(knowledgeSources.id, sourceId),
          eq(knowledgeSources.status, "active"),
          or(eq(knowledgeSources.visibility, "internal"), eq(knowledgeSources.createdBy, userId)),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Knowledge source not found.");
    return rows[0];
  }

  async create(organizationId: string, userId: string, body: unknown) {
    const input = validateKnowledge(body);
    const id = randomUUID();
    const now = new Date();
    await this.database.transaction(async (tx) => {
      await tx.insert(knowledgeSources).values({
        ...input,
        id,
        organizationId,
        createdBy: userId,
        contentHash: createHash("sha256").update(input.content).digest("hex"),
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(knowledgeChunks).values(
        chunkKnowledge(input.content).map((content, ordinal) => ({
          id: randomUUID(),
          sourceId: id,
          organizationId,
          ordinal,
          content,
        })),
      );
    });
    return this.get(organizationId, id, userId);
  }

  async archive(organizationId: string, sourceId: string, userId: string) {
    await this.get(organizationId, sourceId, userId);
    await this.database.db
      .update(knowledgeSources)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(eq(knowledgeSources.organizationId, organizationId), eq(knowledgeSources.id, sourceId)),
      );
  }

  async retrieve(
    organizationId: string,
    agentId: string,
    userId: string,
    query: string,
    limit: number,
  ) {
    const agent = await new AgentService(this.database).getAgent(organizationId, agentId);
    if (agent.status === "archived" || agent.status === "disabled")
      throw new ApiError(403, "FORBIDDEN", "Agent is unavailable.");
    // Source IDs come from persisted agent configuration, never from caller-supplied authorization.
    const ids = Array.isArray(agent.configuration.knowledge)
      ? agent.configuration.knowledge
          .filter((id): id is string => typeof id === "string")
          .slice(0, 100)
      : [];
    if (!ids.length) return [];
    const rows = await this.database.db
      .select({
        sourceId: knowledgeSources.id,
        title: knowledgeSources.name,
        chunkId: knowledgeChunks.id,
        content: knowledgeChunks.content,
      })
      .from(knowledgeChunks)
      .innerJoin(
        knowledgeSources,
        and(
          eq(knowledgeSources.id, knowledgeChunks.sourceId),
          eq(knowledgeSources.organizationId, knowledgeChunks.organizationId),
        ),
      )
      .where(
        and(
          eq(knowledgeSources.organizationId, organizationId),
          eq(knowledgeChunks.organizationId, organizationId),
          eq(knowledgeSources.status, "active"),
          inArray(knowledgeSources.id, ids),
          or(eq(knowledgeSources.visibility, "internal"), eq(knowledgeSources.createdBy, userId)),
        ),
      );
    return rows
      .map((row) => ({ ...row, relevance: scoreKnowledge(query, row.title, row.content) }))
      .filter((row) => row.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance || a.chunkId.localeCompare(b.chunkId))
      .slice(0, limit);
  }
}
