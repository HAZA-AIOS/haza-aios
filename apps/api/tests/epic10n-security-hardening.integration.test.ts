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
  normalizeIp,
  isIpInCidr,
  isTrustedProxy,
  resolveClientIp,
} from "../src/middleware/rate-limiter.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { SisService } from "../src/modules/education/sis.service.js";
import { SisFinanceService } from "../src/modules/education/sis-finance.service.js";

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
   * SEC-003 / SEC-003A: Security Headers (HSTS & CSP)
   * ───────────────────────────────────────────────────────────── */
  describe("SEC-003A: Security Headers: HSTS and CSP Consistency", () => {
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

    it("emits strict-transport-security: max-age=31536000 only when request is verified direct HTTPS", () => {
      const mockResponse = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name.toLowerCase()] = value;
        },
      } as any;

      const mockHttpsRequest = {
        socket: { encrypted: true, remoteAddress: "127.0.0.1" },
        headers: {},
      } as any;

      applySecurityHeaders(mockResponse, mockHttpsRequest);
      expect(mockResponse.headers["strict-transport-security"]).toBe("max-age=31536000");
      // Must NOT contain includeSubDomains or preload
      expect(mockResponse.headers["strict-transport-security"]).not.toContain("includeSubDomains");
      expect(mockResponse.headers["strict-transport-security"]).not.toContain("preload");
      expect(mockResponse.headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
    });

    it("emits strict-transport-security when x-forwarded-proto is https from a verified trusted proxy", () => {
      const mockResponse = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name.toLowerCase()] = value;
        },
      } as any;

      const mockForwardedRequest = {
        socket: { encrypted: false, remoteAddress: "10.0.0.1" }, // Private network IP (trusted)
        headers: { "x-forwarded-proto": "https" },
      } as any;

      applySecurityHeaders(mockResponse, mockForwardedRequest, {
        trustProxy: true,
      });
      expect(mockResponse.headers["strict-transport-security"]).toBe("max-age=31536000");
      expect(mockResponse.headers["strict-transport-security"]).not.toContain("includeSubDomains");
    });

    it("does NOT emit strict-transport-security when untrusted socket sends forged x-forwarded-proto", () => {
      const mockResponse = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name.toLowerCase()] = value;
        },
      } as any;

      // Socket is a public untrusted client IP
      const mockUntrustedRequest = {
        socket: { encrypted: false, remoteAddress: "203.0.113.50" },
        headers: { "x-forwarded-proto": "https" },
      } as any;

      applySecurityHeaders(mockResponse, mockUntrustedRequest, {
        trustProxy: true,
        appEnv: "production",
      });
      // Untrusted socket MUST NOT establish HTTPS, so HSTS must be omitted
      expect(mockResponse.headers["strict-transport-security"]).toBeUndefined();
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * SEC-002 / SEC-002A: Rate Limiting & Proxy Trust Boundaries
   * ───────────────────────────────────────────────────────────── */
  describe("SEC-002A: Trusted Proxy and Client IP Validation", () => {
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

    it("unit: normalizeIp validates, strips ports, and handles IPv4-mapped IPv6", () => {
      expect(normalizeIp(" 192.168.1.1 ")).toBe("192.168.1.1");
      expect(normalizeIp("192.168.1.1:8080")).toBe("192.168.1.1");
      expect(normalizeIp("[2001:db8::1]:8080")).toBe("2001:db8::1");
      expect(normalizeIp("::ffff:192.168.1.1")).toBe("192.168.1.1");
      expect(normalizeIp("2001:0db8::1")).toBe("2001:0db8::1");
      expect(normalizeIp("invalid-ip")).toBeNull();
      expect(normalizeIp("999.999.999.999")).toBeNull();
      expect(normalizeIp("1.2.3.4.5")).toBeNull();
      expect(normalizeIp("<script>")).toBeNull();
      expect(normalizeIp("")).toBeNull();
    });

    it("unit: isIpInCidr correctly matches IPv4 and IPv6 CIDRs", () => {
      // IPv4
      expect(isIpInCidr("127.0.0.1", "127.0.0.0/8")).toBe(true);
      expect(isIpInCidr("10.5.2.1", "10.0.0.0/8")).toBe(true);
      expect(isIpInCidr("192.168.1.50", "192.168.0.0/16")).toBe(true);
      expect(isIpInCidr("172.20.1.1", "172.16.0.0/12")).toBe(true);
      expect(isIpInCidr("100.65.0.1", "100.64.0.0/10")).toBe(true);
      expect(isIpInCidr("203.0.113.5", "10.0.0.0/8")).toBe(false);

      // IPv6
      expect(isIpInCidr("::1", "::1/128")).toBe(true);
      expect(isIpInCidr("fe80::1", "fe80::/10")).toBe(true);
      expect(isIpInCidr("2606:4700::1", "2606:4700::/32")).toBe(true);
      expect(isIpInCidr("2001:db8::1", "2606:4700::/32")).toBe(false);
    });

    it("unit (Requirement 1): valid trusted-proxy request resolves client IP from X-Forwarded-For", () => {
      const request = {
        socket: { remoteAddress: "127.0.0.1" }, // Trusted loopback proxy
        headers: {
          "x-forwarded-for": "203.0.113.195",
        },
      } as any;

      const ip = resolveClientIp(request, true);
      expect(ip).toBe("203.0.113.195");
    });

    it("unit (Requirement 2): direct request with forged CF-Connecting-IP ignores header and returns socket IP", () => {
      const request = {
        socket: { remoteAddress: "203.0.113.50" }, // Public untrusted client
        headers: {
          "cf-connecting-ip": "1.1.1.1",
        },
      } as any;

      // Even with trustProxy: true, untrusted socket origin prevents trusting headers
      const ip = resolveClientIp(request, true);
      expect(ip).toBe("203.0.113.50");
    });

    it("unit (Requirement 3): direct request with forged X-Forwarded-For ignores header and returns socket IP", () => {
      const request = {
        socket: { remoteAddress: "203.0.113.50" }, // Public untrusted client
        headers: {
          "x-forwarded-for": "1.1.1.1",
        },
      } as any;

      const ip = resolveClientIp(request, true);
      expect(ip).toBe("203.0.113.50");
    });

    it("unit (Requirement 4): malformed IP headers are rejected and fall back safely to socket IP", () => {
      const request = {
        socket: { remoteAddress: "127.0.0.1" },
        headers: {
          "x-forwarded-for": "malformed-ip; select * from users",
        },
      } as any;

      const ip = resolveClientIp(request, true);
      expect(ip).toBe("127.0.0.1");
    });

    it("unit (Requirement 5): multiple forwarded IP values traversed right-to-left to find authentic client", () => {
      const request = {
        socket: { remoteAddress: "10.0.1.1" }, // Railway container ingress proxy (trusted)
        headers: {
          // Client (203.0.113.195) -> Internal Proxy (10.0.2.2) -> Railway (10.0.1.1)
          "x-forwarded-for": "203.0.113.195, 10.0.2.2",
        },
      } as any;

      const ip = resolveClientIp(request, true);
      expect(ip).toBe("203.0.113.195");
    });

    it("unit (Requirement 6): IPv4 and IPv6 addresses are properly supported and normalized", () => {
      // IPv6 client through trusted proxy
      const v6Request = {
        socket: { remoteAddress: "::1" },
        headers: {
          "x-forwarded-for": "2001:0db8::8a2e:0370:7334",
        },
      } as any;
      expect(resolveClientIp(v6Request, true)).toBe("2001:0db8::8a2e:0370:7334");

      // IPv4-mapped IPv6 client normalized to IPv4
      const mappedRequest = {
        socket: { remoteAddress: "127.0.0.1" },
        headers: {
          "x-forwarded-for": "::ffff:198.51.100.25",
        },
      } as any;
      expect(resolveClientIp(mappedRequest, true)).toBe("198.51.100.25");
    });

    it("unit (Requirement 7): requests with proxy trust disabled ignore all forwarding headers", () => {
      const request = {
        socket: { remoteAddress: "127.0.0.1" },
        headers: {
          "x-forwarded-for": "203.0.113.195",
          "cf-connecting-ip": "1.1.1.1",
        },
      } as any;

      expect(resolveClientIp(request, false)).toBe("127.0.0.1");
    });

    it("unit (Requirement 8): requests with proxy trust enabled but unverified proxy origin ignore headers", () => {
      const request = {
        socket: { remoteAddress: "198.51.100.99" }, // Public IP not in trusted proxy ranges
        headers: {
          "x-forwarded-for": "203.0.113.195",
          "cf-connecting-ip": "1.1.1.1",
        },
      } as any;

      expect(resolveClientIp(request, true)).toBe("198.51.100.99");
    });

    it("unit: valid Cloudflare proxy request extracts CF-Connecting-IP when upstream is Cloudflare", () => {
      const request = {
        socket: { remoteAddress: "10.0.0.1" }, // Railway proxy
        headers: {
          "x-forwarded-for": "203.0.113.195, 173.245.48.5", // 173.245.48.5 is in Cloudflare IP range
          "cf-connecting-ip": "203.0.113.195",
        },
      } as any;

      expect(resolveClientIp(request, true)).toBe("203.0.113.195");
    });

    it("unit: hashIdentifier normalizes and hashes sensitive identifiers", () => {
      const hash1 = hashIdentifier("  Admin@Example.COM  ");
      const hash2 = hashIdentifier("admin@example.com");
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
      expect(hash1).not.toContain("admin");
      expect(hash1).not.toContain("example");
    });

    it("unit: isTrustedProxy matches configured CIDR lists", () => {
      expect(isTrustedProxy("127.0.0.1", true)).toBe(true);
      expect(isTrustedProxy("10.0.0.1", true)).toBe(true);
      expect(isTrustedProxy("172.16.0.1", true)).toBe(true);
      expect(isTrustedProxy("192.168.1.1", true)).toBe(true);
      expect(isTrustedProxy("100.64.0.1", true)).toBe(true);
      expect(isTrustedProxy("203.0.113.50", true)).toBe(false);
      expect(isTrustedProxy("203.0.113.50", "203.0.113.0/24")).toBe(true);
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

    it("integration (Requirement 9): enforces rate limits despite attempted header spoofing", async () => {
      const payload = { email: "bruteforce@example.com", password: "wrong-password" };

      // Accumulate 5 failed attempts with different spoofed X-Forwarded-For and CF-Connecting-IP headers
      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": `198.51.100.${i + 1}`,
            "cf-connecting-ip": `203.0.113.${i + 1}`,
          },
          body: JSON.stringify(payload),
        });
        expect(response.status).toBe(401);
      }

      // 6th attempt with yet another spoofed header is still blocked because trustProxy is false by default in test
      const blockedResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.99",
          "cf-connecting-ip": "203.0.113.99",
        },
        body: JSON.stringify(payload),
      });
      expect(blockedResponse.status).toBe(429);
    });

    it("resets failed login count on successful login", async () => {
      const payload = { email: "gooduser@example.com", password: "wrong-password" };

      // Record 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      // Spy on AuthService.prototype.login to simulate success
      const loginSpy = vi.spyOn(AuthService.prototype, "login").mockResolvedValueOnce({
        user: {
          id: "u1",
          email: "gooduser@example.com",
          firstName: "Good",
          lastName: "User",
          displayName: "Good User",
          emailVerified: true,
          status: "active",
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "sess-1",
          userId: "u1",
          accessToken: "sample-token",
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          rememberMe: false,
        },
        memberships: [],
      } as any);

      // Successful login
      const successResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "gooduser@example.com", password: "correct-password" }),
      });
      expect(successResponse.status).toBe(200);
      loginSpy.mockRestore();

      // Ensure another 4 failed attempts are now allowed before being blocked
      for (let i = 0; i < 4; i++) {
        const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        expect(res.status).toBe(401);
      }
    });

    it("enforces forgot-password rate limits (3 requests per 15 min per account)", async () => {
      const payload = { email: "forgot@example.com" };

      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        expect(response.status).toBe(200);
      }

      const blocked = await fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBeTruthy();
    });

    it("enforces reset-password rate limits (5 attempts per 15 min)", async () => {
      const payload = { token: "sample-token", password: "new-password-1234!" };

      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        // Returns 400 for invalid token
        expect(response.status).toBe(400);
      }

      const blocked = await fetch(`${baseUrl}/api/v1/auth/reset-password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(blocked.status).toBe(429);
    });

    it("enforces registration rate limits (5 attempts per hour per IP)", async () => {
      const registerPayload = (i: number) => ({
        email: `newuser${i}@example.com`,
        password: "Password1234!",
        fullName: `New User ${i}`,
      });

      for (let i = 0; i < 5; i++) {
        const response = await fetch(`${baseUrl}/api/v1/auth/register-identity`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(registerPayload(i)),
        });
        // 400 because registration without invitation/existing org may fail, but hits rate limiter
        expect([200, 201, 400, 403]).toContain(response.status);
      }

      const blocked = await fetch(`${baseUrl}/api/v1/auth/register-identity`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(registerPayload(99)),
      });
      expect(blocked.status).toBe(429);
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * SEC-001: Actor Identity Hardening
   * ───────────────────────────────────────────────────────────── */
  describe("SEC-001: Actor Identity Hardening in Education API", () => {
    it("ignores forged actor payload in request body and derives actor strictly from authenticated session", async () => {
      const validOrgId = "11111111-1111-4111-8111-111111111111";

      const tenantSpy = vi.spyOn(SisService.prototype, "getTenant").mockResolvedValueOnce({
        organizationId: validOrgId,
        workspaceId: "ws-111",
      });

      const authSpy = vi.spyOn(AuthService.prototype, "requireOrganizationPermission").mockResolvedValueOnce({
        user: {
          id: "user-legit-111",
          email: "legit@example.com",
          firstName: "Legit",
          lastName: "User",
          displayName: "Legit User",
          emailVerified: true,
          status: "active",
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-1",
          userId: "user-legit-111",
          tokenHash: "mock-hash",
          status: "active",
          rememberMe: false,
          expiresAt: new Date(Date.now() + 3600_000),
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        memberships: [
          {
            id: "mem-1",
            organizationId: validOrgId,
            userId: "user-legit-111",
            role: "Admin",
            status: "active",
            permissions: ["workspace.read", "workspace.manage"],
          },
        ],
        platformPermissions: [],
      } as any);

      const createStructureSpy = vi.spyOn(SisFinanceService.prototype, "createStructure").mockResolvedValueOnce({
        id: "struct-1",
        name: "Tuition Fee",
        code: "TUIT-01",
        amount: 500,
        currency: "USD",
        feeType: "tuition",
        frequency: "term",
      } as any);

      const spoofedFeePayload = {
        name: "Tuition Fee",
        code: "TUIT-01",
        amount: 500,
        currency: "USD",
        feeType: "tuition",
        frequency: "term",
        actor: {
          userId: "attacker-forged-uuid",
          role: "SuperAdmin",
          email: "attacker@forged.com",
        },
      };

      const response = await fetch(
        `${baseUrl}/api/v1/organizations/${validOrgId}/sis/finance/structures`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer mock-token",
          },
          body: JSON.stringify(spoofedFeePayload),
        },
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.structure).toBeTruthy();
      expect(data.structure.name).toBe("Tuition Fee");

      // Verify that createStructure received the authoritative actor, NOT the forged actor
      expect(createStructureSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ userId: "user-legit-111", role: "Admin", email: "legit@example.com" }),
      );

      authSpy.mockRestore();
      tenantSpy.mockRestore();
      createStructureSpy.mockRestore();
    });

    it("applies authenticated actor context to fee category creation and audit records", async () => {
      const validOrgId = "22222222-2222-4222-8222-222222222222";

      const tenantSpy = vi.spyOn(SisService.prototype, "getTenant").mockResolvedValueOnce({
        organizationId: validOrgId,
        workspaceId: "ws-222",
      });

      const authSpy = vi.spyOn(AuthService.prototype, "requireOrganizationPermission").mockResolvedValueOnce({
        user: {
          id: "user-admin-222",
          email: "admin2@example.com",
          firstName: "Admin",
          lastName: "Two",
          displayName: "Admin Two",
          emailVerified: true,
          status: "active",
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        session: {
          id: "session-2",
          userId: "user-admin-222",
          tokenHash: "mock-hash-2",
          status: "active",
          rememberMe: false,
          expiresAt: new Date(Date.now() + 3600_000),
          revokedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        memberships: [
          {
            id: "mem-2",
            organizationId: validOrgId,
            userId: "user-admin-222",
            role: "Admin",
            status: "active",
            permissions: ["workspace.read", "workspace.manage"],
          },
        ],
        platformPermissions: [],
      } as any);

      const createCategorySpy = vi.spyOn(SisFinanceService.prototype, "createCategory").mockResolvedValueOnce({
        id: "cat-123",
        organizationId: validOrgId,
        name: "Athletics",
        code: "ATH-01",
        createdBy: "user-admin-222",
      } as any);

      const spoofedCategoryPayload = {
        name: "Athletics",
        code: "ATH-01",
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

      expect(createCategorySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ userId: "user-admin-222", role: "Admin", email: "admin2@example.com" }),
      );

      authSpy.mockRestore();
      tenantSpy.mockRestore();
      createCategorySpy.mockRestore();
    });
  });

  /* ─────────────────────────────────────────────────────────────
   * RB-002A: Trusted Proxy Security & Client IP Resolution (TP-001 to TP-018)
   * ───────────────────────────────────────────────────────────── */
  describe("RB-002A: Trusted Proxy Security & Client IP Resolution (TP-001 to TP-018)", () => {
    // TP-001: TRUST_PROXY unset -> Disabled
    it("TP-001: TRUST_PROXY unset -> trustProxy is disabled (false)", () => {
      const cfg = loadConfig({});
      expect(cfg.trustProxy).toBe(false);
    });

    // TP-002: TRUST_PROXY=false -> Disabled
    it("TP-002: TRUST_PROXY=false -> trustProxy is disabled (false)", () => {
      const cfg = loadConfig({ TRUST_PROXY: "false" });
      expect(cfg.trustProxy).toBe(false);
    });

    // TP-003: TRUST_PROXY=true -> Explicit boolean mode
    it("TP-003: TRUST_PROXY=true -> explicit boolean true mode", () => {
      const cfg = loadConfig({ TRUST_PROXY: "true" });
      expect(cfg.trustProxy).toBe(true);
    });

    // TP-004: TRUST_PROXY=cloudflare -> Cloudflare mode preserved
    it("TP-004: TRUST_PROXY=cloudflare -> explicit 'cloudflare' mode preserved", () => {
      const cfg = loadConfig({ TRUST_PROXY: "cloudflare" });
      expect(cfg.trustProxy).toBe("cloudflare");
    });

    // TP-005: Invalid TRUST_PROXY value -> Configuration rejected
    it("TP-005: Invalid TRUST_PROXY value -> configuration rejected with startup error", () => {
      expect(() => loadConfig({ TRUST_PROXY: "unsupported-mode" })).toThrow(
        /Invalid TRUST_PROXY configuration/,
      );
      expect(() => loadConfig({ TRUST_PROXY: "yes" })).toThrow(
        /Invalid TRUST_PROXY configuration/,
      );
    });

    // TP-006: Untrusted socket with forged headers -> Headers ignored
    it("TP-006: Untrusted socket with forged headers -> headers ignored, binds to socket IP", () => {
      const request = {
        socket: { remoteAddress: "203.0.113.50" }, // Public untrusted IP
        headers: {
          "x-forwarded-for": "1.1.1.1, 8.8.8.8",
          "cf-connecting-ip": "1.1.1.1",
          "x-real-ip": "1.1.1.1",
        },
      } as any;
      expect(resolveClientIp(request, "cloudflare")).toBe("203.0.113.50");
      expect(resolveClientIp(request, true)).toBe("203.0.113.50");
      expect(resolveClientIp(request, false)).toBe("203.0.113.50");
    });

    // TP-007: Trusted proxy with valid, verified chain -> Correct client IP
    it("TP-007: Trusted proxy with valid, verified Cloudflare chain -> extracts genuine client IP", () => {
      const request = {
        socket: { remoteAddress: "10.0.1.5" }, // Railway internal proxy
        headers: {
          "x-forwarded-for": "203.0.113.195, 173.245.48.5", // Client IP followed by Cloudflare edge IP
          "cf-connecting-ip": "203.0.113.195",
        },
      } as any;
      expect(resolveClientIp(request, "cloudflare")).toBe("203.0.113.195");
    });

    // TP-008: Direct Railway request with forged CF header -> Forged value ignored
    it("TP-008: Direct Railway request with forged CF header -> forged value ignored, returns connecting client IP", () => {
      const request = {
        socket: { remoteAddress: "10.0.1.5" }, // Railway internal proxy
        headers: {
          // Direct request: Railway edge appended connecting IP (198.51.100.55), client injected CF-Connecting-IP
          "x-forwarded-for": "198.51.100.55",
          "cf-connecting-ip": "8.8.8.8",
        },
      } as any;
      // Must NOT accept 8.8.8.8 because the request did not traverse Cloudflare
      expect(resolveClientIp(request, "cloudflare")).toBe("198.51.100.55");
    });

    // TP-009: Forged Cloudflare CIDR inside XFF -> No false authentication of proxy chain
    it("TP-009: Forged Cloudflare CIDR inside XFF -> no false authentication of proxy chain", () => {
      const request = {
        socket: { remoteAddress: "10.0.1.5" }, // Railway internal proxy
        headers: {
          // Attacker injected Cloudflare IP into their XFF, but Railway edge appended attacker's real IP
          "x-forwarded-for": "173.245.48.5, 198.51.100.55",
          "cf-connecting-ip": "8.8.8.8",
        },
      } as any;
      // Right-to-left traversal stops at 198.51.100.55; 173.245.48.5 is untrusted client data
      expect(resolveClientIp(request, "cloudflare")).toBe("198.51.100.55");
    });

    // TP-010: Malformed CF-Connecting-IP -> Safe fallback
    it("TP-010: Malformed CF-Connecting-IP -> safe fallback to valid candidate client IP", () => {
      const request = {
        socket: { remoteAddress: "10.0.1.5" },
        headers: {
          "x-forwarded-for": "203.0.113.195, 173.245.48.5",
          "cf-connecting-ip": "not-an-ip; <script>",
        },
      } as any;
      expect(resolveClientIp(request, "cloudflare")).toBe("203.0.113.195");
    });

    // TP-011: Malformed X-Forwarded-For -> Safe fallback
    it("TP-011: Malformed X-Forwarded-For -> safe fallback to socket IP", () => {
      const request = {
        socket: { remoteAddress: "10.0.1.5" },
        headers: {
          "x-forwarded-for": "malformed-ip, 999.999.999.999",
        },
      } as any;
      expect(resolveClientIp(request, "cloudflare")).toBe("10.0.1.5");
    });

    // TP-012: IPv4 address -> Correct normalization
    it("TP-012: IPv4 address -> correct normalization", () => {
      expect(normalizeIp(" 192.0.2.1 ")).toBe("192.0.2.1");
      expect(normalizeIp("192.0.2.1:8080")).toBe("192.0.2.1");
    });

    // TP-013: IPv6 address -> Correct normalization
    it("TP-013: IPv6 address -> correct normalization", () => {
      expect(normalizeIp("[2001:db8::1]:8443")).toBe("2001:db8::1");
      expect(normalizeIp(" 2001:db8::1 ")).toBe("2001:db8::1");
    });

    // TP-014: IPv4-mapped IPv6 -> Correct normalization
    it("TP-014: IPv4-mapped IPv6 -> stripped and normalized to IPv4", () => {
      expect(normalizeIp("::ffff:192.0.2.1")).toBe("192.0.2.1");
    });

    // TP-015: Missing socket information -> Safe documented fallback
    it("TP-015: Missing socket information -> safe documented fallback to loopback, ignoring headers", () => {
      const requestWithoutSocket = {
        socket: undefined,
        headers: {
          "x-forwarded-for": "203.0.113.195",
          "cf-connecting-ip": "8.8.8.8",
        },
      } as any;
      expect(resolveClientIp(requestWithoutSocket, "cloudflare")).toBe("127.0.0.1");

      const requestWithNullAddress = {
        socket: { remoteAddress: null },
        headers: {
          "x-forwarded-for": "203.0.113.195",
          "cf-connecting-ip": "8.8.8.8",
        },
      } as any;
      expect(resolveClientIp(requestWithNullAddress, "cloudflare")).toBe("127.0.0.1");
    });

    // TP-016: Distinct clients through verified proxy -> Independent rate-limit buckets
    it("TP-016: Distinct clients through verified proxy maintain independent rate-limit buckets", () => {
      const store = new InMemoryRateLimiterStore();
      const reqClientA = {
        socket: { remoteAddress: "10.0.1.5" },
        headers: {
          "x-forwarded-for": "198.51.100.1, 173.245.48.5",
          "cf-connecting-ip": "198.51.100.1",
        },
      } as any;
      const reqClientB = {
        socket: { remoteAddress: "10.0.1.5" },
        headers: {
          "x-forwarded-for": "198.51.100.2, 173.245.48.5",
          "cf-connecting-ip": "198.51.100.2",
        },
      } as any;

      const ipA = resolveClientIp(reqClientA, "cloudflare");
      const ipB = resolveClientIp(reqClientB, "cloudflare");
      expect(ipA).toBe("198.51.100.1");
      expect(ipB).toBe("198.51.100.2");
      expect(ipA).not.toBe(ipB);

      // Both consume from rate limiter independently
      expect(store.consume(`auth:login:${ipA}`, 2, 60_000).allowed).toBe(true);
      expect(store.consume(`auth:login:${ipB}`, 2, 60_000).allowed).toBe(true);
      store.destroy();
    });

    // TP-017: One client exceeds rate limit -> Other clients unaffected
    it("TP-017: One client exceeding rate limit leaves other clients unaffected", () => {
      const store = new InMemoryRateLimiterStore();
      const ipAbuser = "198.51.100.100";
      const ipInnocent = "198.51.100.200";

      // Abuser consumes all quota (limit = 2)
      expect(store.consume(`auth:login:${ipAbuser}`, 2, 60_000).allowed).toBe(true);
      expect(store.consume(`auth:login:${ipAbuser}`, 2, 60_000).allowed).toBe(true);
      const blocked = store.consume(`auth:login:${ipAbuser}`, 2, 60_000);
      expect(blocked.allowed).toBe(false);

      // Innocent client is unaffected
      const allowed = store.consume(`auth:login:${ipInnocent}`, 2, 60_000);
      expect(allowed.allowed).toBe(true);
      store.destroy();
    });

    // TP-018: Security headers with explicit proxy mode -> Correct HTTPS handling
    it("TP-018: Security headers emit HSTS only on verified HTTPS across trusted proxy", () => {
      const mockResponseTrusted = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name.toLowerCase()] = value;
        },
      } as any;
      const reqTrustedHttps = {
        socket: { encrypted: false, remoteAddress: "10.0.1.5" },
        headers: { "x-forwarded-proto": "https" },
      } as any;

      applySecurityHeaders(mockResponseTrusted, reqTrustedHttps, {
        trustProxy: "cloudflare",
      });
      expect(mockResponseTrusted.headers["strict-transport-security"]).toBe("max-age=31536000");

      // Untrusted socket attempting to claim HTTPS
      const mockResponseUntrusted = {
        headers: {} as Record<string, string>,
        setHeader(name: string, value: string) {
          this.headers[name.toLowerCase()] = value;
        },
      } as any;
      const reqUntrustedHttps = {
        socket: { encrypted: false, remoteAddress: "203.0.113.50" },
        headers: { "x-forwarded-proto": "https" },
      } as any;

      applySecurityHeaders(mockResponseUntrusted, reqUntrustedHttps, {
        trustProxy: "cloudflare",
      });
      expect(mockResponseUntrusted.headers["strict-transport-security"]).toBeUndefined();
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
