import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { eq, and } from "drizzle-orm";
import { tenantDomains } from "../../../database/schema.js";
import { randomUUID } from "node:crypto";

export class DomainService {
  constructor(private readonly database: DatabaseClient) {}

  async createTenantDomain(organizationId: string, domain: string) {
    // Basic domain format validation
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      throw new ApiError(400, "VALIDATION_FAILED", "Invalid domain format.");
    }

    const existing = await this.database.db.select()
      .from(tenantDomains)
      .where(eq(tenantDomains.domain, domain))
      .limit(1);

    if (existing.length > 0) {
      throw new ApiError(409, "VALIDATION_FAILED", "Domain is already registered by a tenant.");
    }

    const id = randomUUID();
    await this.database.db.insert(tenantDomains).values({
      id,
      organizationId,
      domain,
      status: "pending_verification",
    });

    return await this.getTenantDomain(organizationId, id);
  }

  async listTenantDomains(organizationId: string) {
    return await this.database.db.select()
      .from(tenantDomains)
      .where(eq(tenantDomains.organizationId, organizationId));
  }

  async getTenantDomain(organizationId: string, id: string) {
    const rows = await this.database.db.select()
      .from(tenantDomains)
      .where(and(eq(tenantDomains.organizationId, organizationId), eq(tenantDomains.id, id)))
      .limit(1);

    if (rows.length === 0) {
      throw new ApiError(404, "NOT_FOUND", "Tenant domain not found.");
    }
    return rows[0];
  }

  async verifyTenantDomain(organizationId: string, id: string) {
    await this.getTenantDomain(organizationId, id);
    
    // MOCK: Cloudflare API Hook for Domain Verification
    // In a real scenario, this would call the Cloudflare API to check DNS records
    // e.g., await cloudflareClient.customHostnames.get(...)
    const isVerified = true; // Simulating successful DNS verification

    if (!isVerified) {
      await this.database.db.update(tenantDomains)
        .set({ status: "failed", updatedAt: new Date() })
        .where(and(eq(tenantDomains.id, id), eq(tenantDomains.organizationId, organizationId)));
      throw new ApiError(400, "VALIDATION_FAILED", "Domain DNS records not verified yet.");
    }

    await this.database.db.update(tenantDomains)
      .set({ status: "verified", verifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(tenantDomains.id, id), eq(tenantDomains.organizationId, organizationId)));

    return await this.getTenantDomain(organizationId, id);
  }

  async deleteTenantDomain(organizationId: string, id: string) {
    await this.getTenantDomain(organizationId, id);
    
    // MOCK: Cloudflare API Hook to remove Custom Hostname
    // e.g., await cloudflareClient.customHostnames.delete(...)

    await this.database.db.delete(tenantDomains)
      .where(and(eq(tenantDomains.id, id), eq(tenantDomains.organizationId, organizationId)));
  }
}
