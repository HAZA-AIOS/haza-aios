import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import {
  aiAgentKnowledgeDocuments,
  aiAgentKnowledgeEmbeddings,
  aiAgentKnowledgeRetrievals,
  knowledgeChunks,
  knowledgeCollections,
  knowledgeSources,
} from "../../../database/schema.js";
import type {
  CreateKnowledgeCollectionInput,
  KnowledgeChunkRecord,
  KnowledgeCollectionRecord,
  KnowledgeEmbeddingRecord,
  KnowledgeRetrievalRecord,
  KnowledgeSourceRecord,
  KnowledgeSourceStatus,
  UpdateKnowledgeCollectionInput,
} from "../knowledge.types.js";

export class KnowledgeRepository {
  constructor(private readonly context: RepositoryContext) {}

  // ==========================================
  // COLLECTIONS
  // ==========================================

  async listCollections(
    organizationId: string,
    workspaceId?: string,
    status: KnowledgeSourceStatus = "active",
  ): Promise<KnowledgeCollectionRecord[]> {
    const conditions = [
      eq(knowledgeCollections.organizationId, organizationId),
      eq(knowledgeCollections.status, status),
    ];

    if (workspaceId) {
      conditions.push(eq(knowledgeCollections.workspaceId, workspaceId));
    }

    const rows = await this.context.db
      .select()
      .from(knowledgeCollections)
      .where(and(...conditions))
      .orderBy(desc(knowledgeCollections.createdAt))
      .limit(100);

    return rows.map((r) => this.mapCollectionRow(r));
  }

  async getCollectionById(
    organizationId: string,
    collectionId: string,
  ): Promise<KnowledgeCollectionRecord | null> {
    const rows = await this.context.db
      .select()
      .from(knowledgeCollections)
      .where(
        and(
          eq(knowledgeCollections.organizationId, organizationId),
          eq(knowledgeCollections.id, collectionId),
        ),
      )
      .limit(1);

    return rows[0] ? this.mapCollectionRow(rows[0]) : null;
  }

  async createCollection(
    organizationId: string,
    workspaceId: string,
    userId: string,
    input: CreateKnowledgeCollectionInput,
  ): Promise<KnowledgeCollectionRecord> {
    const id = randomUUID();
    const slug = input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    await this.context.db.insert(knowledgeCollections).values({
      id,
      organizationId,
      workspaceId,
      name: input.name,
      slug,
      description: input.description ?? null,
      industry: input.industry ?? "education",
      visibility: input.visibility ?? "workspace",
      accessPolicy: input.accessPolicy ?? null,
      status: "active",
      createdBy: userId,
    });

    const created = await this.getCollectionById(organizationId, id);
    if (!created) throw new Error("Failed to create knowledge collection.");
    return created;
  }

  async updateCollection(
    organizationId: string,
    collectionId: string,
    input: UpdateKnowledgeCollectionInput,
  ): Promise<KnowledgeCollectionRecord | null> {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.industry !== undefined) updates.industry = input.industry;
    if (input.visibility !== undefined) updates.visibility = input.visibility;
    if (input.accessPolicy !== undefined) updates.accessPolicy = input.accessPolicy;
    if (input.status !== undefined) updates.status = input.status;

    if (Object.keys(updates).length > 0) {
      await this.context.db
        .update(knowledgeCollections)
        .set(updates)
        .where(
          and(
            eq(knowledgeCollections.organizationId, organizationId),
            eq(knowledgeCollections.id, collectionId),
          ),
        );
    }

    return this.getCollectionById(organizationId, collectionId);
  }

  async archiveCollection(organizationId: string, collectionId: string): Promise<void> {
    await this.context.db
      .update(knowledgeCollections)
      .set({ status: "archived" })
      .where(
        and(
          eq(knowledgeCollections.organizationId, organizationId),
          eq(knowledgeCollections.id, collectionId),
        ),
      );
  }

  // ==========================================
  // SOURCES
  // ==========================================

  async listSources(
    organizationId: string,
    workspaceId?: string,
    collectionId?: string,
  ): Promise<KnowledgeSourceRecord[]> {
    const conditions = [
      eq(knowledgeSources.organizationId, organizationId),
      eq(knowledgeSources.status, "active"),
    ];

    if (workspaceId) {
      conditions.push(
        or(
          eq(knowledgeSources.workspaceId, workspaceId),
          sql`${knowledgeSources.workspaceId} IS NULL`,
        )!,
      );
    }

    if (collectionId) {
      conditions.push(eq(knowledgeSources.collectionId, collectionId));
    }

    const rows = await this.context.db
      .select()
      .from(knowledgeSources)
      .where(and(...conditions))
      .orderBy(desc(knowledgeSources.createdAt))
      .limit(200);

    return rows.map((r) => this.mapSourceRow(r));
  }

  async getSourceById(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeSourceRecord | null> {
    const rows = await this.context.db
      .select()
      .from(knowledgeSources)
      .where(
        and(eq(knowledgeSources.organizationId, organizationId), eq(knowledgeSources.id, sourceId)),
      )
      .limit(1);

    return rows[0] ? this.mapSourceRow(rows[0]) : null;
  }

  async createSource(data: {
    id: string;
    organizationId: string;
    workspaceId?: string | null;
    collectionId?: string | null;
    name: string;
    description: string;
    type: "text" | "document" | "structured";
    visibility: "internal" | "private";
    content: string;
    contentHash: string;
    ingestionStatus?: string;
    fileName?: string | null;
    fileType?: string | null;
    fileSizeBytes?: number | null;
    mimeType?: string | null;
    storageUri?: string | null;
    storageBackend?: string;
    currentVersion?: number;
    metadata?: Record<string, unknown> | null;
    createdBy: string;
  }): Promise<KnowledgeSourceRecord> {
    const now = new Date();
    await this.context.db.insert(knowledgeSources).values({
      id: data.id,
      organizationId: data.organizationId,
      workspaceId: data.workspaceId ?? null,
      collectionId: data.collectionId ?? null,
      name: data.name,
      description: data.description,
      type: data.type,
      visibility: data.visibility,
      status: "active",
      content: data.content,
      contentHash: data.contentHash,
      ingestionStatus: data.ingestionStatus ?? "ready",
      fileName: data.fileName ?? null,
      fileType: data.fileType ?? null,
      fileSizeBytes: data.fileSizeBytes ?? null,
      mimeType: data.mimeType ?? null,
      storageUri: data.storageUri ?? null,
      storageBackend: data.storageBackend ?? "database_durable",
      currentVersion: data.currentVersion ?? 1,
      metadata: data.metadata ?? null,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    const created = await this.getSourceById(data.organizationId, data.id);
    if (!created) throw new Error("Failed to create knowledge source record.");
    return created;
  }

  async updateSource(
    organizationId: string,
    sourceId: string,
    updates: Partial<{
      name: string;
      description: string;
      ingestionStatus: string;
      content: string;
      contentHash: string;
      currentVersion: number;
      metadata: Record<string, unknown>;
    }>,
  ): Promise<KnowledgeSourceRecord | null> {
    await this.context.db
      .update(knowledgeSources)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(eq(knowledgeSources.organizationId, organizationId), eq(knowledgeSources.id, sourceId)),
      );

    return this.getSourceById(organizationId, sourceId);
  }

  async archiveSource(organizationId: string, sourceId: string): Promise<void> {
    await this.context.db
      .update(knowledgeSources)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(eq(knowledgeSources.organizationId, organizationId), eq(knowledgeSources.id, sourceId)),
      );
  }

  // ==========================================
  // CHUNKS
  // ==========================================

  async insertChunks(
    chunks: Array<{
      id: string;
      sourceId: string;
      organizationId: string;
      workspaceId?: string | null;
      ordinal: number;
      sectionHeading?: string | null;
      pageNumber?: number | null;
      tokenCount: number;
      contentHash?: string | null;
      content: string;
    }>,
  ): Promise<void> {
    if (chunks.length === 0) return;
    await this.context.db.insert(knowledgeChunks).values(
      chunks.map((c) => ({
        id: c.id,
        sourceId: c.sourceId,
        organizationId: c.organizationId,
        workspaceId: c.workspaceId ?? null,
        ordinal: c.ordinal,
        sectionHeading: c.sectionHeading ?? null,
        pageNumber: c.pageNumber ?? null,
        tokenCount: c.tokenCount,
        contentHash: c.contentHash ?? null,
        content: c.content,
      })),
    );
  }

  async getChunksBySourceId(
    organizationId: string,
    sourceId: string,
  ): Promise<KnowledgeChunkRecord[]> {
    const rows = await this.context.db
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.organizationId, organizationId),
          eq(knowledgeChunks.sourceId, sourceId),
        ),
      )
      .orderBy(knowledgeChunks.ordinal);

    return rows.map((r) => this.mapChunkRow(r));
  }

  async getChunksByIds(
    organizationId: string,
    chunkIds: string[],
  ): Promise<KnowledgeChunkRecord[]> {
    if (chunkIds.length === 0) return [];
    const rows = await this.context.db
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.organizationId, organizationId),
          inArray(knowledgeChunks.id, chunkIds),
        ),
      );

    return rows.map((r) => this.mapChunkRow(r));
  }

  // ==========================================
  // RAW DOCUMENTS
  // ==========================================

  async insertDocument(data: {
    id: string;
    organizationId: string;
    workspaceId: string;
    sourceId: string;
    version: number;
    contentType: string;
    rawContent: string | null;
    contentHash: string;
    checksum: string;
  }): Promise<void> {
    await this.context.db.insert(aiAgentKnowledgeDocuments).values({
      id: data.id,
      organizationId: data.organizationId,
      workspaceId: data.workspaceId,
      sourceId: data.sourceId,
      version: data.version,
      contentType: data.contentType,
      rawContent: data.rawContent,
      contentHash: data.contentHash,
      checksum: data.checksum,
    });
  }

  // ==========================================
  // EMBEDDINGS
  // ==========================================

  async insertEmbeddings(
    embeddings: Array<{
      id: string;
      organizationId: string;
      workspaceId: string;
      sourceId: string;
      chunkId: string;
      provider: string;
      model: string;
      dimensions: number;
      embedding: number[];
      contentHash: string;
    }>,
  ): Promise<void> {
    if (embeddings.length === 0) return;
    await this.context.db.insert(aiAgentKnowledgeEmbeddings).values(
      embeddings.map((e) => ({
        id: e.id,
        organizationId: e.organizationId,
        workspaceId: e.workspaceId,
        sourceId: e.sourceId,
        chunkId: e.chunkId,
        provider: e.provider,
        model: e.model,
        dimensions: e.dimensions,
        embedding: e.embedding,
        contentHash: e.contentHash,
      })),
    );
  }

  async getEmbeddingsForChunks(
    organizationId: string,
    chunkIds: string[],
  ): Promise<KnowledgeEmbeddingRecord[]> {
    if (chunkIds.length === 0) return [];
    const rows = await this.context.db
      .select()
      .from(aiAgentKnowledgeEmbeddings)
      .where(
        and(
          eq(aiAgentKnowledgeEmbeddings.organizationId, organizationId),
          inArray(aiAgentKnowledgeEmbeddings.chunkId, chunkIds),
        ),
      );

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      sourceId: r.sourceId,
      chunkId: r.chunkId,
      provider: r.provider,
      model: r.model,
      dimensions: r.dimensions,
      embedding: r.embedding,
      contentHash: r.contentHash,
      createdAt: r.createdAt,
    }));
  }

  // ==========================================
  // RETRIEVAL AUDITING
  // ==========================================

  async recordRetrieval(data: {
    id: string;
    organizationId: string;
    workspaceId: string;
    agentId?: string | null;
    runId?: string | null;
    query: string;
    retrievalMode: "hybrid" | "semantic" | "keyword";
    matchedChunkIds: string[];
    scores: Record<string, number>;
    latencyMs: number;
    requestedBy: string;
  }): Promise<void> {
    await this.context.db.insert(aiAgentKnowledgeRetrievals).values({
      id: data.id,
      organizationId: data.organizationId,
      workspaceId: data.workspaceId,
      agentId: data.agentId ?? null,
      runId: data.runId ?? null,
      query: data.query,
      retrievalMode: data.retrievalMode,
      matchedChunkIds: data.matchedChunkIds,
      scores: data.scores,
      latencyMs: data.latencyMs,
      requestedBy: data.requestedBy,
    });
  }

  async listRetrievals(
    organizationId: string,
    limit = 50,
  ): Promise<KnowledgeRetrievalRecord[]> {
    const rows = await this.context.db
      .select()
      .from(aiAgentKnowledgeRetrievals)
      .where(eq(aiAgentKnowledgeRetrievals.organizationId, organizationId))
      .orderBy(desc(aiAgentKnowledgeRetrievals.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      agentId: r.agentId,
      runId: r.runId,
      query: r.query,
      retrievalMode: r.retrievalMode as any,
      matchedChunkIds: r.matchedChunkIds,
      scores: r.scores,
      latencyMs: r.latencyMs,
      requestedBy: r.requestedBy,
      createdAt: r.createdAt,
    }));
  }

  // ==========================================
  // ROW MAPPERS
  // ==========================================

  private mapCollectionRow(row: any): KnowledgeCollectionRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      industry: row.industry,
      visibility: row.visibility,
      accessPolicy: row.accessPolicy,
      status: row.status,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapSourceRow(row: any): KnowledgeSourceRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      collectionId: row.collectionId,
      name: row.name,
      description: row.description,
      type: row.type,
      visibility: row.visibility,
      status: row.status,
      content: row.content,
      contentHash: row.contentHash,
      ingestionStatus: row.ingestionStatus,
      fileName: row.fileName,
      fileType: row.fileType,
      fileSizeBytes: row.fileSizeBytes,
      mimeType: row.mimeType,
      storageUri: row.storageUri,
      storageBackend: row.storageBackend,
      currentVersion: row.currentVersion,
      metadata: row.metadata,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapChunkRow(row: any): KnowledgeChunkRecord {
    return {
      id: row.id,
      sourceId: row.sourceId,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      ordinal: row.ordinal,
      sectionHeading: row.sectionHeading,
      pageNumber: row.pageNumber,
      tokenCount: row.tokenCount,
      contentHash: row.contentHash,
      content: row.content,
    };
  }
}
