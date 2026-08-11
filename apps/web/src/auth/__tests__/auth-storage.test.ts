import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearStoredAuth, readStoredAuth, writeStoredAuth } from "../auth-storage";
import type { AuthResult } from "../auth.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockAuth(overrides: Partial<AuthResult["session"]> = {}): AuthResult {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60).toISOString(); // +1h

  return {
    user: {
      id: "user-1",
      firstName: "Test",
      lastName: "User",
      displayName: "Test User",
      email: "test@example.com",
      emailVerified: true,
      status: "active",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    session: {
      id: "session-1",
      userId: "user-1",
      accessToken: "mock-token",
      expiresAt,
      rememberMe: false,
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("auth-storage", () => {
  beforeEach(() => {
    // Start each test with clean storage
    clearStoredAuth();
  });

  afterEach(() => {
    clearStoredAuth();
  });

  describe("readStoredAuth", () => {
    it("returns null when no auth data is stored", () => {
      expect(readStoredAuth()).toBeNull();
    });

    it("returns the stored auth result for a valid, non-expired session", () => {
      const auth = makeMockAuth();
      writeStoredAuth(auth);
      const result = readStoredAuth();
      expect(result).not.toBeNull();
      expect(result?.user.email).toBe("test@example.com");
    });

    it("returns null and clears storage for an expired session", () => {
      const expiredAuth = makeMockAuth({
        expiresAt: new Date(Date.now() - 1000).toISOString(), // already expired
      });
      writeStoredAuth(expiredAuth);
      expect(readStoredAuth()).toBeNull();
    });
  });

  describe("writeStoredAuth", () => {
    it("writes to sessionStorage when rememberMe is false", () => {
      const auth = makeMockAuth({ rememberMe: false });
      writeStoredAuth(auth);
      expect(window.sessionStorage.getItem("haza-aios.auth.session")).not.toBeNull();
      expect(window.localStorage.getItem("haza-aios.auth.session")).toBeNull();
    });

    it("writes to localStorage when rememberMe is true", () => {
      const auth = makeMockAuth({ rememberMe: true });
      writeStoredAuth(auth);
      expect(window.localStorage.getItem("haza-aios.auth.session")).not.toBeNull();
      expect(window.sessionStorage.getItem("haza-aios.auth.session")).toBeNull();
    });
  });

  describe("clearStoredAuth", () => {
    it("removes auth data from both storage mechanisms", () => {
      writeStoredAuth(makeMockAuth({ rememberMe: false }));
      clearStoredAuth();
      expect(window.sessionStorage.getItem("haza-aios.auth.session")).toBeNull();
      expect(window.localStorage.getItem("haza-aios.auth.session")).toBeNull();
    });

    it("is idempotent — calling it on already-clear storage does not throw", () => {
      expect(() => clearStoredAuth()).not.toThrow();
    });
  });
});
