import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { DatabaseClient } from "../../../database/client.js";
import {
  aiAgentKnowledgeEmbeddings,
  knowledgeChunks,
  knowledgeSources,
} from "../../../database/schema.js";
import { EmbeddingProviderRegistry } from "../embeddings/embedding-provider.registry.js";
import type { RetrievalQueryInput, RetrievalResultItem } from "../knowledge.types.js";

export class HybridSearchService {
  constructor(private readonly database: DatabaseClient) {}

  async search(
    organizationId: string,
    queryInput: RetrievalQueryInput,
    options: {
      workspaceId?: string;
      userId?: string;
      userRoles?: string[];
    } = {},
  ): Promise<{ results: RetrievalResultItem[]; semanticIndexingAvailable: boolean; latencyMs: number }> {
    const startTime = Date.now();
    const query = queryInput.query.trim();
    if (!query) {
      return { results: [], semanticIndexingAvailable: false, latencyMs: 0 };
    }

    const limit = Math.min(Math.max(1, queryInput.limit ?? 5), 20);
    const minScore = queryInput.minScore ?? 0.1;

    // 1. Resolve Embedding Provider
    const { provider: embeddingProvider, isRealSemantic } =
      await EmbeddingProviderRegistry.getInstance().getActiveProvider();

    // 2. Fetch candidate chunks with pre-retrieval tenant/workspace/status filtering in SQL
    const conditions = [
      eq(knowledgeSources.organizationId, organizationId),
      eq(knowledgeChunks.organizationId, organizationId),
      eq(knowledgeSources.status, "active"),
      eq(knowledgeSources.ingestionStatus, "ready"),
    ];

    if (options.workspaceId) {
      conditions.push(
        or(
          eq(knowledgeSources.workspaceId, options.workspaceId),
          sql`${knowledgeSources.workspaceId} IS NULL`,
        )!,
      );
    }

    if (queryInput.collectionIds && queryInput.collectionIds.length > 0) {
      conditions.push(inArray(knowledgeSources.collectionId, queryInput.collectionIds));
    }

    if (queryInput.sourceIds && queryInput.sourceIds.length > 0) {
      conditions.push(inArray(knowledgeSources.id, queryInput.sourceIds));
    }

    // Role-based visibility check: 'private' sources only visible to creator
    if (options.userId) {
      conditions.push(
        or(
          eq(knowledgeSources.visibility, "internal"),
          eq(knowledgeSources.createdBy, options.userId),
        )!,
      );
    }

    const candidateRows = await this.database.db
      .select({
        chunkId: knowledgeChunks.id,
        ordinal: knowledgeChunks.ordinal,
        sectionHeading: knowledgeChunks.sectionHeading,
        pageNumber: knowledgeChunks.pageNumber,
        content: knowledgeChunks.content,
        sourceId: knowledgeSources.id,
        collectionId: knowledgeSources.collectionId,
        documentTitle: knowledgeSources.name,
        documentVersion: knowledgeSources.currentVersion,
      })
      .from(knowledgeChunks)
      .innerJoin(
        knowledgeSources,
        and(
          eq(knowledgeSources.id, knowledgeChunks.sourceId),
          eq(knowledgeSources.organizationId, knowledgeChunks.organizationId),
        ),
      )
      .where(and(...conditions))
      .limit(300);

    if (candidateRows.length === 0) {
      return {
        results: [],
        semanticIndexingAvailable: isRealSemantic,
        latencyMs: Date.now() - startTime,
      };
    }

    // 3. Compute Lexical / Keyword Scores
    const queryTokens = this.tokenize(query);
    const candidateChunkIds = candidateRows.map((r) => r.chunkId);

    // 4. Compute Semantic Embeddings if applicable
    let queryVector: number[] | null = null;
    const chunkEmbeddingsMap = new Map<string, number[]>();

    const requestedMode = queryInput.mode ?? "hybrid";
    const runSemantic = requestedMode !== "keyword";

    if (runSemantic) {
      try {
        const embedRes = await embeddingProvider.embed({ texts: [query] });
        if (embedRes.embeddings.length > 0) {
          queryVector = embedRes.embeddings[0];

          // Fetch stored embeddings for candidates
          const embeddingRows = await this.database.db
            .select({
              chunkId: aiAgentKnowledgeEmbeddings.chunkId,
              embedding: aiAgentKnowledgeEmbeddings.embedding,
            })
            .from(aiAgentKnowledgeEmbeddings)
            .where(
              and(
                eq(aiAgentKnowledgeEmbeddings.organizationId, organizationId),
                inArray(aiAgentKnowledgeEmbeddings.chunkId, candidateChunkIds),
              ),
            );

          for (const row of embeddingRows) {
            chunkEmbeddingsMap.set(row.chunkId, row.embedding);
          }
        }
      } catch (err) {
        // Semantic search graceful fallback to keyword
      }
    }

    // 5. Score Candidates with Hybrid Fusion
    const scoredResults: RetrievalResultItem[] = [];
    const semanticWeight = queryVector && chunkEmbeddingsMap.size > 0 ? 0.65 : 0.0;
    const lexicalWeight = 1.0 - semanticWeight;

    for (const row of candidateRows) {
      const lexicalScore = this.computeLexicalScore(queryTokens, row.documentTitle, row.content);

      let semanticScore = 0;
      if (queryVector) {
        const chunkVector = chunkEmbeddingsMap.get(row.chunkId);
        if (chunkVector) {
          semanticScore = this.cosineSimilarity(queryVector, chunkVector);
        }
      }

      const combinedScore =
        semanticWeight > 0
          ? semanticWeight * semanticScore + lexicalWeight * lexicalScore
          : lexicalScore;

      if (combinedScore >= minScore) {
        const method: "semantic" | "keyword" | "hybrid" =
          semanticWeight > 0 && semanticScore > 0.1
            ? lexicalScore > 0.1
              ? "hybrid"
              : "semantic"
            : "keyword";

        const citationReference = `[Doc: ${row.documentTitle}, Chunk: ${row.chunkId}]`;

        scoredResults.push({
          sourceId: row.sourceId,
          collectionId: row.collectionId,
          documentTitle: row.documentTitle,
          documentVersion: row.documentVersion,
          chunkId: row.chunkId,
          ordinal: row.ordinal,
          sectionHeading: row.sectionHeading,
          pageNumber: row.pageNumber,
          content: row.content,
          relevanceScore: Number(combinedScore.toFixed(4)),
          retrievalMethod: method,
          citationReference,
        });
      }
    }

    // 6. Sort and bound
    scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore || a.ordinal - b.ordinal);
    const finalResults = scoredResults.slice(0, limit);

    return {
      results: finalResults,
      semanticIndexingAvailable: isRealSemantic,
      latencyMs: Date.now() - startTime,
    };
  }

  private tokenize(text: string): string[] {
    return [...new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  }

  private computeLexicalScore(
    queryTokens: string[],
    title: string,
    content: string,
  ): number {
    if (queryTokens.length === 0) return 0;
    const lowerTitle = title.toLowerCase();
    const lowerContent = content.toLowerCase();

    let matchedWeight = 0;
    for (const token of queryTokens) {
      if (lowerTitle.includes(token)) matchedWeight += 2.0;
      if (lowerContent.includes(token)) matchedWeight += 1.0;
    }

    const maxPossible = queryTokens.length * 3.0;
    return Math.min(1.0, matchedWeight / maxPossible);
  }

  private cosineSimilarity(v1: number[], v2: number[]): number {
    if (v1.length !== v2.length) return 0;
    let dot = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
    }
    // Since vectors are unit-normalized, dot is in [-1, 1]. Clamp to [0, 1].
    return Math.max(0, Math.min(1, (dot + 1) / 2));
  }
}
