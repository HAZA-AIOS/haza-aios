import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clearStoredAuth } from "../auth-storage";
import { mockAuthService } from "../auth-service";

// ---------------------------------------------------------------------------
// Tests for the mock auth service
//
// The mock service acts as the Auth Service layer in the architecture:
//
//   UI → AuthProvider → mockAuthService → auth-storage → (future: API client)
//
// These tests verify the service's validation rules, session creation, and
// storage side-effects — mirroring what a real backend would enforce.
// ---------------------------------------------------------------------------

describe("mockAuthService", () => {
  beforeEach(() => clearStoredAuth());
  afterEach(() => clearStoredAuth());

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------
  describe("login", () => {
    it("resolves with user and session for valid credentials", async () => {
      const result = await mockAuthService.login({
        email: "user@example.com",
        password: "password123",
        rememberMe: false,
      });

      expect(result.user.email).toBe("user@example.com");
      expect(result.session.accessToken).toBeTruthy();
      expect(result.session.expiresAt).toBeTruthy();
    });

    it("sets rememberMe on the session", async () => {
      const result = await mockAuthService.login({
        email: "user@example.com",
        password: "password123",
        rememberMe: true,
      });
      expect(result.session.rememberMe).toBe(true);
    });

    it("rejects when the email is invalid", async () => {
      await expect(
        mockAuthService.login({ email: "notanemail", password: "password123", rememberMe: false }),
      ).rejects.toThrow();
    });

    it("rejects when the password is too short", async () => {
      await expect(
        mockAuthService.login({ email: "user@example.com", password: "abc", rememberMe: false }),
      ).rejects.toThrow();
    });

    it("persists the session in storage after successful login", async () => {
      await mockAuthService.login({
        email: "user@example.com",
        password: "password123",
        rememberMe: false,
      });
      // Storage should now contain an active session
      const { readStoredAuth } = await import("../auth-storage");
      const stored = readStoredAuth();
      expect(stored).not.toBeNull();
      expect(stored?.user.email).toBe("user@example.com");
    });
  });

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------
  describe("register", () => {
    it("resolves with user and session for valid registration input", async () => {
      const result = await mockAuthService.register({
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
        password: "password123",
      });

      expect(result.user.firstName).toBe("Alice");
      expect(result.user.lastName).toBe("Smith");
      expect(result.user.email).toBe("alice@example.com");
      expect(result.user.emailVerified).toBe(false); // unverified until email flow
    });

    it("rejects when first name is empty", async () => {
      await expect(
        mockAuthService.register({
          firstName: "",
          lastName: "Smith",
          email: "user@example.com",
          password: "password123",
        }),
      ).rejects.toThrow();
    });

    it("rejects when last name is empty", async () => {
      await expect(
        mockAuthService.register({
          firstName: "Alice",
          lastName: "",
          email: "user@example.com",
          password: "password123",
        }),
      ).rejects.toThrow();
    });

    it("rejects when the email is invalid", async () => {
      await expect(
        mockAuthService.register({
          firstName: "Alice",
          lastName: "Smith",
          email: "bad-email",
          password: "password123",
        }),
      ).rejects.toThrow();
    });

    it("rejects when the password is too short", async () => {
      await expect(
        mockAuthService.register({
          firstName: "Alice",
          lastName: "Smith",
          email: "alice@example.com",
          password: "short",
        }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------
  describe("logout", () => {
    it("resolves without error", async () => {
      await expect(mockAuthService.logout()).resolves.toBeUndefined();
    });

    it("clears stored auth on logout", async () => {
      await mockAuthService.login({
        email: "user@example.com",
        password: "password123",
        rememberMe: false,
      });
      await mockAuthService.logout();
      const { readStoredAuth } = await import("../auth-storage");
      expect(readStoredAuth()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // forgotPassword
  // -------------------------------------------------------------------------
  describe("forgotPassword", () => {
    it("resolves without error for a valid email", async () => {
      await expect(
        mockAuthService.forgotPassword({ email: "user@example.com" }),
      ).resolves.toBeUndefined();
    });

    it("rejects for an invalid email", async () => {
      await expect(mockAuthService.forgotPassword({ email: "bad" })).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // resetPassword
  // -------------------------------------------------------------------------
  describe("resetPassword", () => {
    it("resolves without error when token and password are valid", async () => {
      await expect(
        mockAuthService.resetPassword({ token: "valid-token", password: "newpassword" }),
      ).resolves.toBeUndefined();
    });

    it("rejects when the token is empty", async () => {
      await expect(
        mockAuthService.resetPassword({ token: "", password: "newpassword" }),
      ).rejects.toThrow();
    });

    it("rejects when the new password is too short", async () => {
      await expect(
        mockAuthService.resetPassword({ token: "valid-token", password: "abc" }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // verifyEmail
  // -------------------------------------------------------------------------
  describe("verifyEmail", () => {
    it("returns null when no auth is stored and token is provided", async () => {
      const result = await mockAuthService.verifyEmail("some-token");
      expect(result).toBeNull();
    });

    it("marks the user as emailVerified when a session exists", async () => {
      await mockAuthService.register({
        firstName: "Alice",
        lastName: "Smith",
        email: "alice@example.com",
        password: "password123",
      });

      const result = await mockAuthService.verifyEmail("any-token");
      expect(result?.user.emailVerified).toBe(true);
    });
  });
});
