import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { eq, and } from "drizzle-orm";
import { tenantDomains } from "../../../database/schema.js";
import { randomBytes, randomUUID } from "node:crypto";
import dns from "node:dns/promises";

export class DomainService {
  constructor(private readonly database: DatabaseClient) {}

  async createTenantDomain(organizationId: string, domain: string) {
    let normalizedDomain = domain.trim().toLowerCase();
    
    // Convert to punycode for IDN normalization
    try {
      normalizedDomain = new URL(`http://${normalizedDomain}`).hostname;
    } catch {
      throw new ApiError(400, "VALIDATION_FAILED", "Invalid domain format.");
    }
    
    // Basic domain format validation
    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(normalizedDomain)) {
      throw new ApiError(400, "VALIDATION_FAILED", "Invalid domain format.");
    }

    // Prevent registration of internal or system domains
    const prohibitedDomains = ["haza-aios.com", "railway.app", "vercel.app", "herokuapp.com", "localhost"];
    if (prohibitedDomains.some(d => normalizedDomain === d || normalizedDomain.endsWith(`.${d}`))) {
      throw new ApiError(400, "VALIDATION_FAILED", "This domain is reserved or prohibited.");
    }

    const existing = await this.database.db.select()
      .from(tenantDomains)
      .where(eq(tenantDomains.domain, normalizedDomain))
      .limit(1);

    if (existing.length > 0) {
      throw new ApiError(409, "VALIDATION_FAILED", "Domain is already registered by a tenant.");
    }

    const id = randomUUID();
    const verificationToken = `ha-verify=${randomBytes(32).toString("hex")}`;
    
    await this.database.db.insert(tenantDomains).values({
      id,
      organizationId,
      domain: normalizedDomain,
      verificationToken,
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
    const domainRecord = await this.getTenantDomain(organizationId, id);
    
    if (domainRecord.status === "verified" || domainRecord.status === "active") {
      return domainRecord;
    }

    const verifyHost = `_haza-aios-verification.${domainRecord.domain}`;
    let isVerified = false;

    try {
      const records = await dns.resolveTxt(verifyHost);
      for (const recordArray of records) {
        const record = recordArray.join("");
        if (record === domainRecord.verificationToken) {
          isVerified = true;
          break;
        }
      }
    } catch (err: any) {
      // DNS lookup failed or NO DATA
      if (err.code !== "ENOTFOUND" && err.code !== "ENODATA") {
        console.error("DNS resolution error:", err);
      }
    }

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

    await this.database.db.delete(tenantDomains)
      .where(and(eq(tenantDomains.id, id), eq(tenantDomains.organizationId, organizationId)));
  }
}
