import type { AgentObservabilityRepository } from "../repositories/agent-observability.repository.js";
import type { AgentCostAttribution } from "../observability.types.js";

export class AgentCostService {
  constructor(private readonly repository: AgentObservabilityRepository) {}

  /**
   * Aggregates usage and spending metrics across agents, workflows, and AI providers
   */
  async getCostAttribution(organizationId: string, days: number = 30): Promise<AgentCostAttribution> {
    return await this.repository.getCostAttribution(organizationId, days);
  }
}

