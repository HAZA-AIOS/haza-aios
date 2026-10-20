/* eslint-disable @typescript-eslint/no-explicit-any */
import { once } from "node:events";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import type { DatabaseClient } from "../src/database/client.js";
import {
  applySecurityHeaders,
} from "../src/middleware/security.js";
import {
  InMemoryRateLimiterStore,
  defaultRateLimiterStore,
  hashIdentifier,
  resolveClientIp,
} from "../src/middleware/rate-limiter.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describe("Epic 10N Phase 1: Core Security & Authentication Hardening", () => {
  let server: Server;
  let baseUrl: string;
  let config: ApiConfig;
  let mockDatabase: DatabaseClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    defaultRateLimiterStore.clear();

    config = loadConfig({
      NODE_ENV: "test",
      API_HOST: "127.0.0.1",
      API_PORT: "8000",
      WEB_ORIGIN: "http://localhost:3000",
      WEB_ORIGINS: "http://127.0.0.1:3000",
      LOG_LEVEL: "error",
      API_BODY_LIMIT_BYTES: "65536",
    });

    mockDatabase = createMockDatabase();
    server = createApp(config, logger, mockDatabase);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (server.listening) {
      server.close();
      await once(server, "close");
    }
    defaultRateLimiterStore.clear();
  });

  /* ─────────────────────────────────────────────────────────────
   * SEC-003: Security Headers (HSTS & CSP)
   * ───────────────────────────────────────────────────────────── */
  describe("SEC-003: Security Headers: HSTS and CSP", () => {
    it("emits nosniff, frame-options DENY, referrer-policy, and restrictive API CSP on all responses", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`);

      expect(response.status).toBe(200);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(response.headers.get("permissions-policy")).toBe("camera=(), microphone=(), geolocation=()");
      expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
    });

    it("does NOT emit strict-transport-security in local HTTP development", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`);
      expect(response.headers.get("strict-transport-security")).toBeNull();
    });

    it("emits strict-transport-security: max-age=31536000 only when request is verified HTTPS", () => {
      const mockResponse = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name.toLowerCase()] = value;
        },
      } as any;

      const mockHttpsRequest = {
        socket: { encrypted: true },
        headers: {},
      } as any;

      applySecurityHeaders(mockResponse, mockHttpsRequest);
      expect(mockResponse.headers["strict-transport-security"]).toBe("max-age=31536000");
      expect(mockResponse.headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
    });

    it("emits strict-transport-security when x-forwarded-proto is https in staging or production", () => {
      const mockResponse = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name.toLowerCase()] = value;
        },
      } as any;

      const mockForwardedRequest = {
        socket: { encrypted: false },
        headers: { "x-forwarded-proto": "https" },
      } as any;

      // In production/staging with trusted proxy
      applySecurityHeaders(mockResponse, mockForwardedRequest, {
        trustProxy: true,
        appEnv: "production",
      });
      expect(mockResponse.headers["strict-transport-security"]).toBe("max-age=31536000");
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * SEC-002: Rate Limiting & Proxy Protection
   * ───────────────────────────────────────────────────────────── */
  describe("SEC-002: Authentication Endpoint Rate Limiting", () => {
    it("unit: InMemoryRateLimiterStore tracks consumption and provides accurate retryAfterSeconds", () => {
      const store = new InMemoryRateLimiterStore();
      const key = "test:consume";

      // 3 allowed in 1000ms window
      expect(store.consume(key, 3, 1000).allowed).toBe(true);
      expect(store.consume(key, 3, 1000).allowed).toBe(true);
      expect(store.consume(key, 3, 1000).allowed).toBe(true);

      const denied = store.consume(key, 3, 1000);
      expect(denied.allowed).toBe(false);
      expect(denied.retryAfterSeconds).toBeGreaterThanOrEqual(1);

      store.destroy();
    });

    it("unit: resolveClientIp ignores spoofed headers when trustProxy is false", () => {
      const request = {
        socket: { remoteAddress: "192.168.1.50" },
        headers: {
          "x-forwarded-for": "203.0.113.195, 10.0.0.1",
          "cf-connecting-ip": "198.51.100.1",
        },
      } as any;

      const ipWithoutTrust = resolveClientIp(request, false);
      expect(ipWithoutTrust).toBe("192.168.1.50");

      const ipWithTrust = resolveClientIp(request, true);
      // With trustProxy: true and cf-connecting-ip present, takes cf-connecting-ip
      expect(ipWithTrust).toBe("198.51.100.1");
    });

    it("unit: hashIdentifier normalizes and hashes sensitive identifiers", () => {
      const hash1 = hashIdentifier("  Admin@Example.COM  ");
      const hash2 = hashIdentifier("admin@example.com");
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
      expect(hash1).not.toContain("admin");
      expect(hash1).not.toContain("example");
    });

    it("rate limits repeated failed logins, returning HTTP 429 and Retry-After header", async () => {
      const payload = { email: "victim@example.com", password: "wrong-password" };

      // Send 5 failed login attempts (configured limit is 5 failed attempts per min)
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        expect(response.status).toBe(401);
      }

      // The 6th attempt must be rejected with 429 TOO_MANY_REQUESTS before hitting auth service
      const blockedResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.headers.get("retry-after")).toBeTruthy();
      const body = await blockedResponse.json();
      expect(body.error.code).toBe("TOO_MANY_REQUESTS");
      expect(body.error.retryAfter).toBeGreaterThanOrEqual(1);

      // A different user account from the same IP is not blocked by account-specific limit
      const differentUserResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "other@example.com", password: "wrong-password" }),
      });
      expect(differentUserResponse.status).toBe(401);
    });

    it("does not allow client-spoofed X-Forwarded-For headers to bypass rate limits when trustProxy is false", async () => {
      const payload = { email: "bruteforce@example.com", password: "wrong-password" };

      // Accumulate 5 failed attempts with different spoofed X-Forwarded-For headers
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": `10.0.0.${i + 1}`,
          },
          body: JSON.stringify(payload),
        });
        expect(response.status).toBe(401);
      }

      // 6th attempt with yet another spoofed header is still blocked
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.0.99",
        },
        body: JSON.stringify(payload),
      });
      expect(response.status).toBe(429);
    });

    it("rate limits forgot-password requests, returning HTTP 429 and Retry-After", async () => {
      const payload = { email: "forgot@example.com" };

      // 3 requests allowed per 15 min per account
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        expect(response.status).toBe(200);
      }

      // 4th request must be throttled
      const blockedResponse = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.headers.get("retry-after")).toBeTruthy();
      const body = await blockedResponse.json();
      expect(body.error.code).toBe("TOO_MANY_REQUESTS");
    });

    it("rate limits reset-password attempts, returning HTTP 429 and Retry-After", async () => {
      const payload = { token: "invalid-token-12345", password: "NewStrongPassword123!" };

      // 5 attempts allowed per 15 min per token
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        // 400 INVALID_RESET_TOKEN from service
        expect(response.status).toBe(400);
      }

      // 6th attempt must be throttled
      const blockedResponse = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      expect(blockedResponse.status).toBe(429);
      expect(blockedResponse.headers.get("retry-after")).toBeTruthy();
      const body = await blockedResponse.json();
      expect(body.error.code).toBe("TOO_MANY_REQUESTS");
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * SEC-001: Eliminate Client Actor Identity Spoofing
   * ───────────────────────────────────────────────────────────── */
  describe("SEC-001: Eliminate Client Actor Identity Spoofing", () => {
    const validOrgId = "11111111-1111-4111-8111-111111111111";
    const validWorkspaceId = "22222222-2222-4222-8222-222222222222";

    it("rejects unauthenticated requests to protected education routes with 401", async () => {
      const response = await fetch(
        `${baseUrl}/api/v1/organizations/${validOrgId}/sis/finance/categories`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Tuition" }),
        },
      );
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe("UNAUTHENTICATED");
    });

    it("ignores client-supplied body.actor in portal request submission and binds to verified session actor", async () => {
      // Mock authenticated session as Alice (Member)
      const mockUser = { id: "user-alice-111", email: "alice@example.com", fullName: "Alice Student" };
      const mockMembership = {
        organizationId: validOrgId,
        role: "Member",
        status: "active",
        permissions: ["workspace.read"],
      };

      vi.spyOn(AuthService.prototype, "requireOrganizationPermission").mockResolvedValueOnce({
        user: mockUser as any,
        session: { id: "session-1", userId: mockUser.id, expiresAt: new Date(Date.now() + 3600_000) } as any,
        memberships: [mockMembership as any],
        platformPermissions: [],
      });

      const { SisService } = await import("../src/modules/education/sis.service.js");
      vi.spyOn(SisService.prototype, "getTenant").mockResolvedValueOnce({
        organizationId: validOrgId,
        workspaceId: validWorkspaceId,
      });

      const { SisPortalService } = await import("../src/modules/education/sis-portal.service.js");
      const submitSpy = vi.spyOn(SisPortalService.prototype, "submitRequest").mockImplementation(async (tenant, actor, input) => {
        return {
          id: "33333333-3333-4333-8333-333333333333",
          organizationId: tenant.organizationId,
          requesterUserId: String(actor.userId ?? ""),
          requesterRole: String(actor.role ?? ""),
          ...input,
        } as any;
      });

      // Submit request with malicious payload attempting to spoof actor as Eve (Admin/Owner)
      const spoofedPayload = {
        actor: {
          userId: "user-eve-spoofed-999",
          role: "Owner",
          tenantId: "forged-tenant-id",
        },
        input: {
          type: "profile_update",
          subject: "Change of Phone",
          details: "Please update my phone number.",
        },
      };

      const response = await fetch(
        `${baseUrl}/api/v1/organizations/${validOrgId}/sis/portal/requests`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer mock-token-alice",
          },
          body: JSON.stringify(spoofedPayload),
        },
      );

      expect(response.status).toBe(201);
      const data = await response.json();

      // Verified: The created record MUST have requesterUserId = alice's ID, NOT the spoofed actor!
      expect(data.request.requesterUserId).toBe("user-alice-111");
      expect(data.request.requesterUserId).not.toBe("user-eve-spoofed-999");
      expect(data.request.requesterRole).toBe("Member");
      expect(data.request.requesterRole).not.toBe("Owner");

      expect(submitSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userId: "user-alice-111", role: "Member" }),
        expect.anything(),
      );
    });

    it("ignores client-supplied body.actor in financial fee category creation and binds to authoritative actor", async () => {
      const mockAdmin = { id: "user-admin-222", email: "admin@example.com", fullName: "Admin User" };
      const mockMembership = {
        organizationId: validOrgId,
        role: "Admin",
        status: "active",
        permissions: ["workspace.manage"],
      };

      vi.spyOn(AuthService.prototype, "requireOrganizationPermission").mockResolvedValueOnce({
        user: mockAdmin as any,
        session: { id: "session-2", userId: mockAdmin.id, expiresAt: new Date(Date.now() + 3600_000) } as any,
        memberships: [mockMembership as any],
        platformPermissions: [],
      });

      const { SisService } = await import("../src/modules/education/sis.service.js");
      vi.spyOn(SisService.prototype, "getTenant").mockResolvedValueOnce({
        organizationId: validOrgId,
        workspaceId: validWorkspaceId,
      });

      const { SisFinanceService } = await import("../src/modules/education/sis-finance.service.js");
      const createCategorySpy = vi.spyOn(SisFinanceService.prototype, "createCategory").mockImplementation(async (tenant, data, actor) => {
        return {
          id: "44444444-4444-4444-8444-444444444444",
          organizationId: tenant.organizationId,
          name: String(data.name ?? ""),
          createdBy: String((actor as any)?.userId ?? ""),
          role: String((actor as any)?.role ?? ""),
        } as any;
      });

      // Attempt to spoof actor as someone else in category payload
      const spoofedCategoryPayload = {
        name: "Sports Fee",
        code: "SPORT-01",
        actor: {
          userId: "forged-actor-id",
          role: "SuperAdmin",
        },
      };

      const response = await fetch(
        `${baseUrl}/api/v1/organizations/${validOrgId}/sis/finance/categories`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer mock-token-admin",
          },
          body: JSON.stringify(spoofedCategoryPayload),
        },
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.category).toBeTruthy();
      expect(data.category.createdBy).toBe("user-admin-222");
      expect(data.category.createdBy).not.toBe("forged-actor-id");

      expect(createCategorySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ userId: "user-admin-222", role: "Admin" }),
      );
    });
  });
});

function createMockDatabase(): DatabaseClient {
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue([]),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([]),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    } as any,
    ping: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (work) => work({} as any)),
  };
}
