import type { Memory } from "../../agent.types";

const DB_KEYS = {
  AGENT_MEMORIES: "haza-aios.agents.memories",
};

export class MemoryService {
  static async getMemoriesByOrganization(organizationId: string): Promise<Memory[]> {
    const data = localStorage.getItem(DB_KEYS.AGENT_MEMORIES);
    const memories: Memory[] = data ? JSON.parse(data) : [];
    return memories.filter((m) => m.organizationId === organizationId);
  }

  static async createMemory(
    memoryData: Omit<Memory, "id" | "createdAt" | "updatedAt">
  ): Promise<Memory> {
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
}
