import type { Memory } from "../../agent.types";
import { MemoryService } from "./MemoryService";

export interface MemoryRetrievalOptions {
  organizationId: string;
  userId: string;
  agentInstanceId: string;
  conversationId?: string;
  limit?: number;
}

export class MemoryRetrievalServiceClass {
  /**
   * Retrieves all relevant and authorized memory for a given agent run context
   */
  async retrieveRelevantMemory(options: MemoryRetrievalOptions): Promise<Memory[]> {
    const { organizationId, userId, agentInstanceId, conversationId, limit = 10 } = options;
    
    // 1. Validate Organization (enforced by MemoryService getting by org)
    const allOrgMemories = await MemoryService.getMemoriesByOrganization(organizationId);
    
    // 2. Filter memories based on authorized scope and privacy
    const relevantMemories = allOrgMemories.filter(memory => {
      // Must be active and not expired
      if (memory.status !== "active") return false;
      if (memory.expiresAt && new Date(memory.expiresAt) < new Date()) return false;

      switch (memory.scope) {
        case "organization":
          // For Epic 18: Assuming all agents can see org memory if authorized.
          // In reality, this would check agent permissions against org memory tags.
          return true;
          
        case "user":
          // Must belong to the exact user
          return memory.userId === userId;
          
        case "agent":
          // Must belong to the exact agent instance
          return memory.agentInstanceId === agentInstanceId;
          
        case "conversation":
          // Must belong to the exact conversation
          return conversationId && memory.conversationId === conversationId;
          
        default:
          return false;
      }
    });

    // 3. Sort by importance and date (simple mock heuristic)
    relevantMemories.sort((a, b) => {
      const importanceDiff = (b.importance || 0) - (a.importance || 0);
      if (importanceDiff !== 0) return importanceDiff;
      // Newer first
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // 4. Apply limits
    return relevantMemories.slice(0, limit);
  }
}

export const MemoryRetrievalService = new MemoryRetrievalServiceClass();
