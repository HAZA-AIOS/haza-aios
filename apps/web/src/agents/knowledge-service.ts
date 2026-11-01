import { apiClient } from "../api/api-client";
import { readStoredAuth } from "../auth/auth-storage";
import type {
  KnowledgeCollectionData,
  KnowledgeSourceData,
  ChunkPreviewData,
  RetrievalResultData,
} from "@haza-aios/ui";

export interface KnowledgeStatsData {
  collectionsCount: number;
  sourcesCount: number;
  embeddingProvider: {
    id: string;
    name: string;
    model: string;
    dimensions: number;
    isReal: boolean;
  };
}

export interface KnowledgeRetrievalHistoryItem {
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
  createdAt: string;
}

class AgentKnowledgeService {
  private getAuthToken(): string | null {
    const auth = readStoredAuth();
    return auth?.session?.accessToken ?? null;
  }

  async getStats(organizationId: string, workspaceId?: string): Promise<KnowledgeStatsData | null> {
    const params = new URLSearchParams();
    if (workspaceId) params.append("workspaceId", workspaceId);
    const path = `/api/v1/organizations/${organizationId}/knowledge/stats?${params.toString()}`;
    const res = await apiClient.request<{ stats: KnowledgeStatsData }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.stats ?? null;
  }

  async listCollections(
    organizationId: string,
    workspaceId?: string,
  ): Promise<KnowledgeCollectionData[]> {
    const params = new URLSearchParams();
    if (workspaceId) params.append("workspaceId", workspaceId);
    const path = `/api/v1/organizations/${organizationId}/knowledge/collections?${params.toString()}`;
    const res = await apiClient.request<{ collections: KnowledgeCollectionData[] }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.collections ?? [];
  }

  async createCollection(
    organizationId: string,
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      industry?: string;
      visibility?: "workspace" | "organization" | "private";
    },
  ): Promise<KnowledgeCollectionData> {
    const path = `/api/v1/organizations/${organizationId}/knowledge/collections`;
    const res = await apiClient.request<{ collection: KnowledgeCollectionData }>(path, {
      method: "POST",
      authToken: this.getAuthToken(),
      body: JSON.stringify({ ...data, workspaceId }),
    });
    return res.collection;
  }

  async getCollection(
    organizationId: string,
    collectionId: string,
  ): Promise<KnowledgeCollectionData | null> {
    const path = `/api/v1/organizations/${organizationId}/knowledge/collections/${collectionId}`;
    const res = await apiClient.request<{ collection: KnowledgeCollectionData }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.collection ?? null;
  }

  async updateCollection(
    organizationId: string,
    collectionId: string,
    data: Partial<KnowledgeCollectionData>,
  ): Promise<KnowledgeCollectionData> {
    const path = `/api/v1/organizations/${organizationId}/knowledge/collections/${collectionId}`;
    const res = await apiClient.request<{ collection: KnowledgeCollectionData }>(path, {
      method: "PATCH",
      authToken: this.getAuthToken(),
      body: JSON.stringify(data),
    });
    return res.collection;
  }

  async deleteCollection(organizationId: string, collectionId: string): Promise<boolean> {
    const path = `/api/v1/organizations/${organizationId}/knowledge/collections/${collectionId}`;
    const res = await apiClient.request<{ archived: boolean }>(path, {
      method: "DELETE",
      authToken: this.getAuthToken(),
    });
    return res?.archived ?? true;
  }

  async listSources(
    organizationId: string,
    workspaceId?: string,
    collectionId?: string,
  ): Promise<KnowledgeSourceData[]> {
    const params = new URLSearchParams();
    if (workspaceId) params.append("workspaceId", workspaceId);
    if (collectionId) params.append("collectionId", collectionId);
    const path = `/api/v1/organizations/${organizationId}/knowledge?${params.toString()}`;
    const res = await apiClient.request<{ sources: KnowledgeSourceData[] }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.sources ?? [];
  }

  async uploadDocument(
    organizationId: string,
    workspaceId: string,
    data: {
      fileName: string;
      mimeType: string;
      fileBase64?: string;
      content?: string;
      collectionId?: string;
      description?: string;
    },
  ): Promise<KnowledgeSourceData> {
    const path = `/api/v1/organizations/${organizationId}/knowledge/upload`;
    const res = await apiClient.request<{ source: KnowledgeSourceData }>(path, {
      method: "POST",
      authToken: this.getAuthToken(),
      body: JSON.stringify({ ...data, workspaceId }),
    });
    return res.source;
  }

  async getSource(organizationId: string, sourceId: string): Promise<KnowledgeSourceData | null> {
    const path = `/api/v1/organizations/${organizationId}/knowledge/${sourceId}`;
    const res = await apiClient.request<{ source: KnowledgeSourceData }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.source ?? null;
  }

  async deleteSource(organizationId: string, sourceId: string): Promise<boolean> {
    const path = `/api/v1/organizations/${organizationId}/knowledge/${sourceId}`;
    const res = await apiClient.request<{ archived: boolean }>(path, {
      method: "DELETE",
      authToken: this.getAuthToken(),
    });
    return res?.archived ?? true;
  }

  async getChunks(organizationId: string, sourceId: string): Promise<ChunkPreviewData[]> {
    const path = `/api/v1/organizations/${organizationId}/knowledge/sources/${sourceId}/chunks`;
    const res = await apiClient.request<{ chunks: ChunkPreviewData[] }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.chunks ?? [];
  }

  async search(
    organizationId: string,
    params: {
      query: string;
      mode?: "hybrid" | "semantic" | "keyword";
      collectionIds?: string[];
      minScore?: number;
      limit?: number;
      workspaceId?: string;
    },
  ): Promise<{ results: RetrievalResultData[]; semanticIndexingAvailable: boolean; latencyMs: number }> {
    const path = `/api/v1/organizations/${organizationId}/knowledge/search`;
    const res = await apiClient.request<{
      results: RetrievalResultData[];
      semanticIndexingAvailable: boolean;
      latencyMs: number;
    }>(path, {
      method: "POST",
      authToken: this.getAuthToken(),
      body: JSON.stringify({
        query: params.query,
        searchMode: params.mode,
        collectionIds: params.collectionIds,
        minScore: params.minScore,
        limit: params.limit,
        workspaceId: params.workspaceId,
      }),
    });
    return res ?? { results: [], semanticIndexingAvailable: true, latencyMs: 0 };
  }

  async listRetrievals(
    organizationId: string,
    limit = 50,
  ): Promise<KnowledgeRetrievalHistoryItem[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    const path = `/api/v1/organizations/${organizationId}/knowledge/retrievals?${params.toString()}`;
    const res = await apiClient.request<{ retrievals: KnowledgeRetrievalHistoryItem[] }>(path, {
      method: "GET",
      authToken: this.getAuthToken(),
    });
    return res?.retrievals ?? [];
  }
}

export const agentKnowledgeService = new AgentKnowledgeService();
