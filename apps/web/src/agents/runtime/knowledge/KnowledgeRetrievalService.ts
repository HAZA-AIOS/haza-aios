import { KnowledgeService } from "./KnowledgeService";
import type { KnowledgeSource } from "../../agent.types";

export interface RetrievalQuery {
  organizationId: string;
  query: string;
  authorizedKnowledgeIds: string[];
  limit?: number;
}

export interface RetrievalResult {
  sourceId: string;
  title: string;
  content: string;
  relevance: number;
}

export class KnowledgeRetrievalServiceClass {
  /**
   * Retrieves relevant knowledge authorized for the agent
   */
  async retrieve(params: RetrievalQuery): Promise<RetrievalResult[]> {
    const { organizationId, query, authorizedKnowledgeIds, limit = 5 } = params;

    if (!organizationId) {
      throw new Error("AuthorizationError: organizationId is required for knowledge retrieval");
    }

    // 1. Fetch all knowledge sources for the organization
    const allSources = await KnowledgeService.getKnowledgeSources(organizationId);

    // 2. Filter down to ONLY the sources this specific agent is authorized to use
    // If authorizedKnowledgeIds is empty, we assume no knowledge is authorized unless specifically configured.
    const authorizedSources = allSources.filter(src => 
      authorizedKnowledgeIds.includes(src.id)
    );

    // 3. Very basic mock search implementation (keyword matching)
    // In a real Epic, this would connect to a vector DB (Pinecone, PGVector, etc.)
    const results: RetrievalResult[] = [];
    const queryLower = query.toLowerCase();

    for (const source of authorizedSources) {
      if (!source.content) continue;
      
      const contentLower = source.content.toLowerCase();
      const titleLower = source.name.toLowerCase();
      
      // Calculate a fake relevance score
      let relevance = 0;
      if (titleLower.includes(queryLower)) relevance += 0.5;
      if (contentLower.includes(queryLower)) relevance += 0.8;
      
      // If no direct keyword match, we still return it with low relevance for the mock
      // just to prove context assembly works.
      if (relevance === 0) relevance = 0.1;

      results.push({
        sourceId: source.id,
        title: source.name,
        content: source.content,
        relevance
      });
    }

    // 4. Sort and apply limit
    results.sort((a, b) => b.relevance - a.relevance);
    return results.slice(0, limit);
  }
}

export const KnowledgeRetrievalService = new KnowledgeRetrievalServiceClass();
