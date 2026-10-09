import { apiClient } from "@/api/api-client";

export type TenantDomain = {
  id: string;
  organizationId: string;
  domain: string;
  verificationToken?: string | null;
  status: "pending_verification" | "verified" | "provisioning" | "active" | "failed" | "disabled";
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export class DomainService {
  async listDomains(organizationId: string): Promise<TenantDomain[]> {
    const data = await apiClient.request<{ domains: TenantDomain[] }>(`/api/v1/organizations/${organizationId}/domains`);
    return data.domains;
  }

  async createDomain(organizationId: string, domain: string): Promise<TenantDomain> {
    const data = await apiClient.request<{ domain: TenantDomain }>(`/api/v1/organizations/${organizationId}/domains`, {
      method: "POST",
      body: JSON.stringify({ domain }),
    });
    return data.domain;
  }

  async verifyDomain(organizationId: string, domainId: string): Promise<TenantDomain> {
    const data = await apiClient.request<{ domain: TenantDomain }>(`/api/v1/organizations/${organizationId}/domains/${domainId}/verify`, {
      method: "POST",
    });
    return data.domain;
  }

  async deleteDomain(organizationId: string, domainId: string): Promise<void> {
    await apiClient.request(`/api/v1/organizations/${organizationId}/domains/${domainId}`, {
      method: "DELETE",
    });
  }
}

export const domainService = new DomainService();
