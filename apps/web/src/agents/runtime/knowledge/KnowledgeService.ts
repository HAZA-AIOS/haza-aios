import { apiClient } from "@/api/api-client";
import type { KnowledgeSource } from "../../agent.types";

export class KnowledgeServiceClass {
  async getKnowledgeSources(organizationId: string): Promise<KnowledgeSource[]> {
    return (
      await apiClient.request<{ sources: KnowledgeSource[] }>(
        `/api/v1/organizations/${organizationId}/knowledge`,
      )
    ).sources;
  }

  async getKnowledgeSourceById(
    id: string,
    organizationId: string,
  ): Promise<KnowledgeSource | null> {
    return (
      await apiClient.request<{ source: KnowledgeSource }>(
        `/api/v1/organizations/${organizationId}/knowledge/${id}`,
      )
    ).source;
  }

  async create(
    organizationId: string,
    input: Pick<KnowledgeSource, "name" | "description" | "type" | "content">,
  ) {
    return (
      await apiClient.request<{ source: KnowledgeSource }>(
        `/api/v1/organizations/${organizationId}/knowledge`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      )
    ).source;
  }

  async archive(organizationId: string, id: string) {
    await apiClient.request(`/api/v1/organizations/${organizationId}/knowledge/${id}`, {
      method: "DELETE",
    });
  }
}

export const KnowledgeService = new KnowledgeServiceClass();
