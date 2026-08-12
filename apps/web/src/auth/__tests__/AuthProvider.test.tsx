import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearStoredAuth } from "../auth-storage";
import { AuthProvider } from "../AuthProvider";
import { useAuth, useCurrentUser } from "../use-auth";

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearStoredAuth();
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  clearStoredAuth();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// useAuth — initial loading state
// ---------------------------------------------------------------------------
describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    // Suppress the expected React error output
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow("useAuth must be used within AuthProvider.");
    spy.mockRestore();
  });

  it("starts in the loading state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.status).toBe("loading");
  });

  it("transitions to unauthenticated when no session is stored", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------
  describe("login", () => {
    it("transitions to authenticated on successful login", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for the initial session check to settle
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

      // Perform login
      await act(async () => {
        void result.current.login({
          email: "user@example.com",
          password: "password123",
          rememberMe: false,
        });
        await vi.runAllTimersAsync();
      });

      await waitFor(() => expect(result.current.status).toBe("authenticated"));
      expect(result.current.user?.email).toBe("user@example.com");
      expect(result.current.session).not.toBeNull();
    });

    it("sets an error and remains unauthenticated on invalid login", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await vi.runAllTimersAsync();
      });
      await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

      await act(async () => {
        void result.current
          .login({ email: "bad", password: "password123", rememberMe: false })
          .catch(() => undefined);
        await vi.runAllTimersAsync();
      });

      await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
      expect(result.current.error).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // logout
  // -------------------------------------------------------------------------
  describe("logout", () => {
    it("transitions to unauthenticated after logout", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Login first
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

      await act(async () => {
        void result.current.login({
          email: "user@example.com",
          password: "password123",
          rememberMe: false,
        });
        await vi.runAllTimersAsync();
      });
      await waitFor(() => expect(result.current.status).toBe("authenticated"));

      // Logout
      await act(async () => {
        void result.current.logout();
        await vi.runAllTimersAsync();
      });

      await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // clearError
  // -------------------------------------------------------------------------
  describe("clearError", () => {
    it("clears a previously set auth error", async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await vi.runAllTimersAsync();
      });
      await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

      // Trigger an error
      await act(async () => {
        void result.current
          .login({ email: "bad", password: "password123", rememberMe: false })
          .catch(() => undefined);
        await vi.runAllTimersAsync();
      });
      await waitFor(() => expect(result.current.error).not.toBeNull());

      // Clear it
      act(() => result.current.clearError());
      expect(result.current.error).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// useCurrentUser
// ---------------------------------------------------------------------------
describe("useCurrentUser", () => {
  it("returns null when unauthenticated", async () => {
    const { result } = renderHook(() => useCurrentUser(), { wrapper });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await waitFor(() => expect(result.current).toBeNull());
  });

  it("returns the current user when authenticated", async () => {
    const authResult = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await vi.runAllTimersAsync();
    });
    await waitFor(() => expect(authResult.result.current.status).toBe("unauthenticated"));

    await act(async () => {
      void authResult.result.current.login({
        email: "user@example.com",
        password: "password123",
        rememberMe: false,
      });
      await vi.runAllTimersAsync();
    });

    await waitFor(() => expect(authResult.result.current.status).toBe("authenticated"));
    expect(authResult.result.current.user?.email).toBe("user@example.com");
  });
});
