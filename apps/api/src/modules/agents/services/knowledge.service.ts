import { createHash, randomUUID } from "node:crypto";
import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { EmbeddingProviderRegistry } from "../embeddings/embedding-provider.registry.js";
import { ChunkingEngine } from "../ingestion/chunking-engine.js";
import { DocumentExtractor } from "../ingestion/document-extractor.js";
import type {
  CreateKnowledgeCollectionInput,
  GroundedContextPackage,
  KnowledgeCollectionRecord,
  KnowledgeSourceRecord,
  RetrievalQueryInput,
  UpdateKnowledgeCollectionInput,
} from "../knowledge.types.js";
import { validateKnowledge } from "../knowledge-validation.js";
import { KnowledgeRepository } from "../repositories/knowledge.repository.js";
import { AgentService } from "./agent.service.js";
import { ContextEngineService } from "./context-engine.service.js";
import { HybridSearchService } from "./hybrid-search.service.js";

export class KnowledgeService {
  private repo: KnowledgeRepository;
  private hybridSearch: HybridSearchService;
  private contextEngine: ContextEngineService;

  constructor(private readonly database: DatabaseClient) {
    this.repo = new KnowledgeRepository(createRepositoryContext(database.db));
    this.hybridSearch = new HybridSearchService(database);
    this.contextEngine = new ContextEngineService(database);
  }

  // ==========================================
  // COLLECTIONS
  // ==========================================

  async listCollections(
    organizationId: string,
    workspaceId?: string,
  ): Promise<KnowledgeCollectionRecord[]> {
    return this.repo.listCollections(organizationId, workspaceId);
  }

  async getCollection(
    organizationId: string,
    collectionId: string,
  ): Promise<KnowledgeCollectionRecord> {
    const col = await this.repo.getCollectionById(organizationId, collectionId);
    if (!col) throw new ApiError(404, "NOT_FOUND", "Knowledge collection not found.");
    return col;
  }

  async createCollection(
    organizationId: string,
    workspaceId: string,
    userId: string,
    input: CreateKnowledgeCollectionInput,
  ): Promise<KnowledgeCollectionRecord> {
    if (!input.name || !input.name.trim()) {
      throw new ApiError(400, "VALIDATION_FAILED", "Collection name is required.");
    }
    return this.repo.createCollection(organizationId, workspaceId, userId, input);
  }

  async updateCollection(
    organizationId: string,
    collectionId: string,
    input: UpdateKnowledgeCollectionInput,
  ): Promise<KnowledgeCollectionRecord> {
    const updated = await this.repo.updateCollection(organizationId, collectionId, input);
    if (!updated) throw new ApiError(404, "NOT_FOUND", "Knowledge collection not found.");
    return updated;
  }

  async archiveCollection(organizationId: string, collectionId: string): Promise<void> {
    await this.getCollection(organizationId, collectionId);
    await this.repo.archiveCollection(organizationId, collectionId);
  }

  // ==========================================
  // SOURCES (DB-14 COMPATIBLE + ENHANCED)
  // ==========================================

  async list(organizationId: string, userId: string, workspaceId?: string, collectionId?: string) {
    const sources = await this.repo.listSources(organizationId, workspaceId, collectionId);
    return sources.filter((s) => s.visibility !== "private" || s.createdBy === userId);
  }

  async get(organizationId: string, sourceId: string, userId: string) {
    const source = await this.repo.getSourceById(organizationId, sourceId);
    if (!source) throw new ApiError(404, "NOT_FOUND", "Knowledge source not found.");
    if (source.visibility === "private" && source.createdBy !== userId) {
      throw new ApiError(403, "FORBIDDEN", "Access to private knowledge source denied.");
    }
    return source;
  }

  async create(organizationId: string, userId: string, body: unknown, workspaceId?: string) {
    const input = validateKnowledge(body);
    const id = randomUUID();
    const sourceHash = createHash("sha256").update(input.content).digest("hex");

    const source = await this.repo.createSource({
      id,
      organizationId,
      workspaceId: workspaceId ?? null,
      name: input.name,
      description: input.description,
      type: input.type,
      visibility: input.visibility,
      content: input.content,
      contentHash: sourceHash,
      ingestionStatus: "ready",
      storageBackend: "database_durable",
      createdBy: userId,
    });

    // Chunk text using enhanced chunker
    const doc = {
      text: input.content,
      title: input.name,
      fileType: "txt" as const,
      sections: [{ heading: "General", text: input.content }],
    };
    const chunks = ChunkingEngine.chunkDocument(doc, id);

    await this.repo.insertChunks(
      chunks.map((c) => ({
        id: c.id,
        sourceId: id,
        organizationId,
        workspaceId: workspaceId ?? null,
        ordinal: c.ordinal,
        sectionHeading: c.sectionHeading,
        pageNumber: c.pageNumber,
        tokenCount: c.tokenCount,
        contentHash: c.contentHash,
        content: c.content,
      })),
    );

    // Generate embeddings
    try {
      const { provider } = await EmbeddingProviderRegistry.getInstance().getActiveProvider();
      const embedRes = await provider.embed({ texts: chunks.map((c) => c.content) });
      if (embedRes.embeddings.length === chunks.length) {
        await this.repo.insertEmbeddings(
          chunks.map((c, i) => ({
            id: randomUUID(),
            organizationId,
            workspaceId: workspaceId ?? (source.workspaceId || "default-ws"),
            sourceId: id,
            chunkId: c.id,
            provider: provider.id,
            model: provider.defaultModel,
            dimensions: provider.dimensions,
            embedding: embedRes.embeddings[i],
            contentHash: c.contentHash,
          })),
        );
      }
    } catch {
      // Non-fatal embedding fallback for offline environments
    }

    return this.get(organizationId, id, userId);
  }

  async uploadAndIngestDocument(
    organizationId: string,
    workspaceId: string,
    userId: string,
    fileData: {
      fileName: string;
      mimeType?: string;
      buffer: Buffer;
      collectionId?: string;
      description?: string;
    },
  ): Promise<KnowledgeSourceRecord & { chunkCount: number; requiresOcr?: boolean }> {
    const { buffer, fileName, mimeType, collectionId, description } = fileData;
    const sourceId = randomUUID();
    const docId = randomUUID();
    const checksum = createHash("sha256").update(buffer).digest("hex");

    // 1. Extract text from binary or text payload
    const extracted = DocumentExtractor.extract(buffer, fileName, mimeType);
    const contentHash = createHash("sha256").update(extracted.text).digest("hex");

    // 2. Persist original document payload in durable database storage
    await this.repo.insertDocument({
      id: docId,
      organizationId,
      workspaceId,
      sourceId,
      version: 1,
      contentType: mimeType || "application/octet-stream",
      rawContent: buffer.toString("base64"),
      contentHash,
      checksum,
    });

    // 3. Create knowledge source record
    const source = await this.repo.createSource({
      id: sourceId,
      organizationId,
      workspaceId,
      collectionId: collectionId ?? null,
      name: extracted.title || fileName,
      description: description || `Ingested document: ${fileName}`,
      type: "document",
      visibility: "internal",
      content: extracted.text,
      contentHash,
      ingestionStatus: extracted.requiresOcr ? "failed" : "ready",
      fileName,
      fileType: extracted.fileType,
      fileSizeBytes: buffer.length,
      mimeType: mimeType ?? null,
      storageUri: `db://documents/${docId}`,
      storageBackend: "database_durable",
      currentVersion: 1,
      metadata: {
        requiresOcr: extracted.requiresOcr ?? false,
        pageCount: extracted.pageCount ?? 1,
        sectionsCount: extracted.sections.length,
      },
      createdBy: userId,
    });

    if (extracted.requiresOcr) {
      return { ...source, chunkCount: 0, requiresOcr: true };
    }

    // 4. Chunk document
    const chunks = ChunkingEngine.chunkDocument(extracted, sourceId);
    await this.repo.insertChunks(
      chunks.map((c) => ({
        id: c.id,
        sourceId,
        organizationId,
        workspaceId,
        ordinal: c.ordinal,
        sectionHeading: c.sectionHeading,
        pageNumber: c.pageNumber,
        tokenCount: c.tokenCount,
        contentHash: c.contentHash,
        content: c.content,
      })),
    );

    // 5. Generate and store embeddings
    try {
      const { provider } = await EmbeddingProviderRegistry.getInstance().getActiveProvider();
      const embedRes = await provider.embed({ texts: chunks.map((c) => c.content) });
      if (embedRes.embeddings.length === chunks.length) {
        await this.repo.insertEmbeddings(
          chunks.map((c, i) => ({
            id: randomUUID(),
            organizationId,
            workspaceId,
            sourceId,
            chunkId: c.id,
            provider: provider.id,
            model: provider.defaultModel,
            dimensions: provider.dimensions,
            embedding: embedRes.embeddings[i],
            contentHash: c.contentHash,
          })),
        );
      }
    } catch {
      // Non-fatal embedding fallback
    }

    return { ...source, chunkCount: chunks.length, requiresOcr: false };
  }

  async archive(organizationId: string, sourceId: string, userId: string) {
    await this.get(organizationId, sourceId, userId);
    await this.repo.archiveSource(organizationId, sourceId);
  }

  // ==========================================
  // RETRIEVAL & CONTEXT ENGINE
  // ==========================================

  async search(
    organizationId: string,
    queryInput: RetrievalQueryInput,
    options: { workspaceId?: string; userId?: string } = {},
  ) {
    return this.hybridSearch.search(organizationId, queryInput, options);
  }

  async assembleContext(
    organizationId: string,
    workspaceId: string,
    userId: string,
    query: string,
    authorizedSourceIds: string[] = [],
    authorizedCollectionIds: string[] = [],
    tokenBudget?: number,
  ): Promise<GroundedContextPackage> {
    return this.contextEngine.assembleContext(
      organizationId,
      workspaceId,
      userId,
      query,
      authorizedSourceIds,
      authorizedCollectionIds,
      tokenBudget,
    );
  }

  // DB-14 Backward-compatible retrieve endpoint
  async retrieve(
    organizationId: string,
    agentId: string,
    userId: string,
    query: string,
    limit: number,
  ): Promise<any[]> {
    const agent = await new AgentService(this.database).getAgent(organizationId, agentId);
    if (agent.status === "archived" || agent.status === "disabled") {
      throw new ApiError(403, "FORBIDDEN", "Agent is unavailable.");
    }

    const ids = Array.isArray(agent.configuration?.knowledge)
      ? agent.configuration.knowledge
          .filter((id): id is string => typeof id === "string")
          .slice(0, 100)
      : [];

    if (!ids.length) return [];

    const searchRes = await this.hybridSearch.search(
      organizationId,
      {
        query,
        sourceIds: ids,
        limit,
        mode: "hybrid",
      },
      {
        userId,
      },
    );

    // Record retrieval audit
    try {
      await this.repo.recordRetrieval({
        id: randomUUID(),
        organizationId,
        workspaceId: agent.workspaceId || "default-ws",
        agentId,
        query,
        retrievalMode: "hybrid",
        matchedChunkIds: searchRes.results.map((r) => r.chunkId),
        scores: Object.fromEntries(searchRes.results.map((r) => [r.chunkId, r.relevanceScore])),
        latencyMs: searchRes.latencyMs,
        requestedBy: userId,
      });
    } catch {
      // Non-fatal retrieval audit logging
    }

    return searchRes.results.map((r) => ({
      sourceId: r.sourceId,
      title: r.documentTitle,
      chunkId: r.chunkId,
      content: r.content,
      relevance: r.relevanceScore,
    }));
  }

  async getChunks(organizationId: string, sourceId: string, userId: string) {
    await this.get(organizationId, sourceId, userId);
    return this.repo.getChunksBySourceId(organizationId, sourceId);
  }

  async listRetrievals(organizationId: string, limit = 50) {
    return this.repo.listRetrievals(organizationId, limit);
  }

  async getStats(organizationId: string, workspaceId?: string) {
    const collections = await this.repo.listCollections(organizationId, workspaceId);
    const sources = await this.repo.listSources(organizationId, workspaceId);
    const { provider, isRealSemantic } = await EmbeddingProviderRegistry.getInstance().getActiveProvider();
    return {
      collectionsCount: collections.length,
      sourcesCount: sources.length,
      embeddingProvider: {
        id: provider.id,
        name: provider.name,
        model: provider.defaultModel,
        dimensions: provider.dimensions,
        isReal: isRealSemantic,
      },
    };
  }
}
