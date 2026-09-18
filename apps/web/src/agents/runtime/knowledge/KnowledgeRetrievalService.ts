import { apiClient } from "@/api/api-client";

export interface RetrievalQuery {
  organizationId: string;
  agentId?: string;
  query: string;
  authorizedKnowledgeIds: string[];
  limit?: number;
}

export interface RetrievalResult {
  sourceId: string;
  chunkId: string;
  title: string;
  content: string;
  relevance: number;
}

export class KnowledgeRetrievalServiceClass {
  async retrieve(params: RetrievalQuery): Promise<RetrievalResult[]> {
    if (!params.organizationId || !params.agentId) {
      throw new Error("Knowledge retrieval requires an organization and persisted agent.");
    }
    const response = await apiClient.request<{ results: RetrievalResult[] }>(
      `/api/v1/organizations/${params.organizationId}/agents/${params.agentId}/knowledge/search`,
      { method: "POST", body: JSON.stringify({ query: params.query, limit: params.limit ?? 5 }) },
    );
    return response.results;
  }
}

export const KnowledgeRetrievalService = new KnowledgeRetrievalServiceClass();
