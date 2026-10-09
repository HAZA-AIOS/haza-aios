import { describe, it, expect, beforeEach, vi } from "vitest";
import { DomainService } from "../src/modules/platform/services/domain.service";
import { ApiError } from "../src/common/errors/api-error";
import { randomUUID } from "node:crypto";
import dns from "node:dns/promises";

// Mock dns module
vi.mock("node:dns/promises");

const mockDbClient = {
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  }
};

describe("DomainService", () => {
  let domainService: DomainService;

  beforeEach(() => {
    vi.clearAllMocks();
    domainService = new DomainService(mockDbClient as any);
  });

  describe("createTenantDomain", () => {
    it("rejects invalid domain formats", async () => {
      await expect(domainService.createTenantDomain("org-1", "invalid domain")).rejects.toThrow(ApiError);
      await expect(domainService.createTenantDomain("org-1", "invalid domain")).rejects.toThrow("Invalid domain format.");
    });

    it("creates a new domain and generates a verification token", async () => {
      mockDbClient.db.limit.mockResolvedValueOnce([]); // existing lookup
      const insertSpy = vi.spyOn(mockDbClient.db, "insert");
      mockDbClient.db.limit.mockResolvedValueOnce([
        { id: "domain-1", domain: "example.com", status: "pending_verification", verificationToken: "ha-verify=abc" }
      ]); // getTenantDomain

      const domain = await domainService.createTenantDomain("org-1", "example.com");

      expect(insertSpy).toHaveBeenCalled();
      expect(domain.verificationToken).toContain("ha-verify=");
    });

    it("normalizes domains to lowercase", async () => {
      mockDbClient.db.limit.mockResolvedValueOnce([]);
      mockDbClient.db.limit.mockResolvedValueOnce([
        { id: "domain-1", domain: "example.com", status: "pending_verification", verificationToken: "ha-verify=abc" }
      ]);

      const insertSpy = vi.spyOn(mockDbClient.db, "values");
      await domainService.createTenantDomain("org-1", " EXAMPLE.COM  ");

      expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
        domain: "example.com"
      }));
    });

    it("rejects duplicate domain registrations", async () => {
      mockDbClient.db.limit.mockResolvedValue([{ id: "domain-1" }]); // domain exists

      await expect(domainService.createTenantDomain("org-1", "example.com")).rejects.toThrow(ApiError);
      await expect(domainService.createTenantDomain("org-1", "example.com")).rejects.toThrow("Domain is already registered by a tenant.");
    });
  });

  describe("verifyTenantDomain", () => {
    it("verifies successfully with correct TXT record", async () => {
      mockDbClient.db.limit.mockResolvedValue([
        { id: "domain-1", domain: "example.com", status: "pending_verification", verificationToken: "ha-verify=123", organizationId: "org-1" }
      ]);
      (dns.resolveTxt as any).mockResolvedValue([["ha-verify=123"]]);

      const updateSpy = vi.spyOn(mockDbClient.db, "set");

      await domainService.verifyTenantDomain("org-1", "domain-1");

      expect(dns.resolveTxt).toHaveBeenCalledWith("_haza-aios-verification.example.com");
      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: "verified" }));
    });

    it("rejects when TXT record is missing", async () => {
      mockDbClient.db.limit.mockResolvedValue([
        { id: "domain-1", domain: "example.com", status: "pending_verification", verificationToken: "ha-verify=123", organizationId: "org-1" }
      ]);
      (dns.resolveTxt as any).mockRejectedValue({ code: "ENOTFOUND" });

      await expect(domainService.verifyTenantDomain("org-1", "domain-1")).rejects.toThrow(ApiError);
      await expect(domainService.verifyTenantDomain("org-1", "domain-1")).rejects.toThrow("Domain DNS records not verified yet.");
    });

    it("rejects when TXT record is incorrect", async () => {
      mockDbClient.db.limit.mockResolvedValue([
        { id: "domain-1", domain: "example.com", status: "pending_verification", verificationToken: "ha-verify=123", organizationId: "org-1" }
      ]);
      (dns.resolveTxt as any).mockResolvedValue([["ha-verify=wrong"]]);

      await expect(domainService.verifyTenantDomain("org-1", "domain-1")).rejects.toThrow(ApiError);
    });

    it("rejects cross-tenant access", async () => {
      mockDbClient.db.limit.mockResolvedValue([]); // not found for this orgId
      await expect(domainService.verifyTenantDomain("org-other", "domain-1")).rejects.toThrow(ApiError);
    });

    it("handles DNS timeout safely", async () => {
      mockDbClient.db.limit.mockResolvedValue([
        { id: "domain-1", domain: "example.com", status: "pending_verification", verificationToken: "ha-verify=123", organizationId: "org-1" }
      ]);
      (dns.resolveTxt as any).mockRejectedValue({ code: "ETIMEOUT" });

      await expect(domainService.verifyTenantDomain("org-1", "domain-1")).rejects.toThrow(ApiError);
    });
  });

  describe("deleteTenantDomain", () => {
    it("allows deletion of owned domain", async () => {
      mockDbClient.db.limit.mockResolvedValue([{ id: "domain-1" }]);
      const deleteSpy = vi.spyOn(mockDbClient.db, "delete");
      
      await domainService.deleteTenantDomain("org-1", "domain-1");
      expect(deleteSpy).toHaveBeenCalled();
    });

    it("prevents unauthorized deletion", async () => {
      mockDbClient.db.limit.mockResolvedValue([]); // domain doesn't belong to org
      await expect(domainService.deleteTenantDomain("org-1", "domain-1")).rejects.toThrow(ApiError);
    });
  });
});
