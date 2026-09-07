import { apiClient } from "@/api/api-client";
import { readStoredAuth } from "@/auth/auth-storage";
import type { Memory } from "../../agent.types";

const DB_KEYS = {
  AGENT_MEMORIES: "haza-aios.agents.memories",
};

type CreateMemoryInput = Omit<Memory, "id" | "createdAt" | "updatedAt">;

type UpdateMemoryInput = Partial<
  Pick<Memory, "scope" | "type" | "content" | "status" | "importance" | "expiresAt">
> & {
  metadata?: Record<string, unknown>;
};

export class MemoryService {
  static async getMemoriesByOrganization(organizationId: string): Promise<Memory[]> {
    if (!isTestRuntime()) {
      throw new Error("Production memory reads require an agent-scoped query.");
    }
    const data = localStorage.getItem(DB_KEYS.AGENT_MEMORIES);
    const memories: Memory[] = data ? JSON.parse(data) : [];
    return memories.filter((m) => m.organizationId === organizationId);
  }

  static async getMemoriesForAgent(options: {
    organizationId: string;
    agentInstanceId: string;
    userId: string;
    conversationId?: string;
    scope?: Memory["scope"];
    type?: string;
    limit?: number;
  }): Promise<Memory[]> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      const params = new URLSearchParams();
      if (options.limit) params.set("limit", String(options.limit));
      if (options.scope) params.set("scope", options.scope);
      if (options.type) params.set("type", options.type);
      if (options.conversationId) params.set("conversationId", options.conversationId);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      const response = await apiClient.request<{ memories: Memory[] }>(
        `/api/v1/organizations/${options.organizationId}/agents/${options.agentInstanceId}/memories${suffix}`,
        { authToken: auth?.session.accessToken },
      );
      return response.memories;
    }

    const memories = await this.getMemoriesByOrganization(options.organizationId);
    return memories.filter((memory) => {
      if (memory.status !== "active") return false;
      if (memory.expiresAt && new Date(memory.expiresAt) < new Date()) return false;
      switch (memory.scope) {
        case "organization":
        case "workspace":
          return true;
        case "user":
          return memory.userId === options.userId;
        case "agent":
          return memory.agentInstanceId === options.agentInstanceId;
        case "conversation":
          return options.conversationId && memory.conversationId === options.conversationId;
        default:
          return false;
      }
    });
  }

  static async createMemory(memoryData: CreateMemoryInput): Promise<Memory> {
    if (!isTestRuntime()) {
      if (!memoryData.agentInstanceId) throw new Error("agentInstanceId is required.");
      const auth = readStoredAuth();
      const response = await apiClient.request<{ memory: Memory }>(
        `/api/v1/organizations/${memoryData.organizationId}/agents/${memoryData.agentInstanceId}/memories`,
        {
          method: "POST",
          authToken: auth?.session.accessToken,
          body: JSON.stringify({
            scope: memoryData.scope,
            type: memoryData.type,
            content: memoryData.content,
            source: memoryData.source,
            sourceRunId: memoryData.sourceRunId,
            sourceConversationId: memoryData.sourceConversationId ?? memoryData.conversationId,
            sourceMessageId: memoryData.sourceMessageId,
            importance: memoryData.importance,
            expiresAt: memoryData.expiresAt,
            metadata: memoryData.metadata ?? {},
          }),
        },
      );
      return response.memory;
    }

    const data = localStorage.getItem(DB_KEYS.AGENT_MEMORIES);
    const memories: Memory[] = data ? JSON.parse(data) : [];

    const newMemory: Memory = {
      ...memoryData,
      id: crypto.randomUUID(),
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    memories.push(newMemory);
    localStorage.setItem(DB_KEYS.AGENT_MEMORIES, JSON.stringify(memories));

    return newMemory;
  }

  static async updateMemory(
    organizationId: string,
    memoryId: string,
    updates: UpdateMemoryInput,
  ): Promise<Memory> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      const response = await apiClient.request<{ memory: Memory }>(
        `/api/v1/organizations/${organizationId}/agent-memories/${memoryId}`,
        {
          method: "PATCH",
          authToken: auth?.session.accessToken,
          body: JSON.stringify(updates),
        },
      );
      return response.memory;
    }

    const data = localStorage.getItem(DB_KEYS.AGENT_MEMORIES);
    const memories: Memory[] = data ? JSON.parse(data) : [];
    const memory = memories.find(
      (item) => item.organizationId === organizationId && item.id === memoryId,
    );
    if (!memory) throw new Error("Memory not found");
    Object.assign(memory, updates, { updatedAt: new Date().toISOString() });
    localStorage.setItem(DB_KEYS.AGENT_MEMORIES, JSON.stringify(memories));
    return memory;
  }

  static async forgetMemory(organizationId: string, memoryId: string): Promise<Memory> {
    if (!isTestRuntime()) {
      const auth = readStoredAuth();
      const response = await apiClient.request<{ memory: Memory }>(
        `/api/v1/organizations/${organizationId}/agent-memories/${memoryId}`,
        { method: "DELETE", authToken: auth?.session.accessToken },
      );
      return response.memory;
    }
    return this.updateMemory(organizationId, memoryId, { status: "deleted" });
  }
}

function isTestRuntime() {
  return import.meta.env.MODE === "test";
}
