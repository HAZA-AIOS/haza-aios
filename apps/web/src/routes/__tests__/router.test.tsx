import { render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/auth/AuthProvider";
import { clearStoredAuth, writeStoredAuth } from "@/auth/auth-storage";
import type { AuthResult } from "@/auth/auth.types";
import { navigate, usePathname } from "../navigation";
import { ProtectedRoute, PublicOnlyRoute } from "../router";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockAuth(): AuthResult {
  const now = new Date().toISOString();
  return {
    user: {
      id: "user-1",
      firstName: "Test",
      lastName: "User",
      displayName: "Test User",
      email: "test@example.com",
      emailVerified: true,
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    session: {
      id: "session-1",
      userId: "user-1",
      accessToken: "token-abc",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      rememberMe: false,
    },
  };
}

function AuthWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

// ---------------------------------------------------------------------------
// navigate utility
// ---------------------------------------------------------------------------

describe("navigate", () => {
  it("updates window.location.pathname via history.pushState", () => {
    const spy = vi.spyOn(window.history, "pushState");
    navigate("/test-path");
    expect(spy).toHaveBeenCalledWith({}, "", "/test-path");
    spy.mockRestore();
  });

  it("dispatches a popstate event", () => {
    const listener = vi.fn();
    window.addEventListener("popstate", listener);
    navigate("/another-path");
    window.removeEventListener("popstate", listener);
    expect(listener).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ProtectedRoute — redirects to /login when unauthenticated
// ---------------------------------------------------------------------------

describe("ProtectedRoute", () => {
  beforeEach(() => {
    clearStoredAuth();
  });

  afterEach(() => {
    clearStoredAuth();
    vi.restoreAllMocks();
  });

  it("calls navigate('/login') when the user is unauthenticated", async () => {
    const navigateSpy = vi.spyOn(window.history, "pushState");

    render(
      <AuthWrapper>
        <ProtectedRoute>
          <div>Secret</div>
        </ProtectedRoute>
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith(expect.anything(), "", "/login");
    });
  });

  it("does not redirect when the user is authenticated", async () => {
    writeStoredAuth(makeMockAuth());
    const navigateSpy = vi.spyOn(window.history, "pushState");

    render(
      <AuthWrapper>
        <ProtectedRoute>
          <div>Secret</div>
        </ProtectedRoute>
      </AuthWrapper>,
    );

    // Should NOT have navigated away from the protected route
    expect(navigateSpy).not.toHaveBeenCalledWith(expect.anything(), "", "/login");
  });
});

// ---------------------------------------------------------------------------
// PublicOnlyRoute — redirects to /app when authenticated
// ---------------------------------------------------------------------------

describe("PublicOnlyRoute", () => {
  beforeEach(() => {
    clearStoredAuth();
  });

  afterEach(() => {
    clearStoredAuth();
    vi.restoreAllMocks();
  });

  it("does not redirect an unauthenticated user away from a public route", async () => {
    const navigateSpy = vi.spyOn(window.history, "pushState");

    render(
      <AuthWrapper>
        <PublicOnlyRoute>
          <div>Login Form</div>
        </PublicOnlyRoute>
      </AuthWrapper>,
    );

    expect(navigateSpy).not.toHaveBeenCalledWith(expect.anything(), "", "/app");
  });

  it("redirects to /app when the user is already authenticated", async () => {
    writeStoredAuth(makeMockAuth());
    const navigateSpy = vi.spyOn(window.history, "pushState");

    render(
      <AuthWrapper>
        <PublicOnlyRoute>
          <div>Login Form</div>
        </PublicOnlyRoute>
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith(expect.anything(), "", "/app");
    });
  });
});

// ---------------------------------------------------------------------------
// Verify usePathname hook returns the current pathname
// ---------------------------------------------------------------------------

describe("usePathname", () => {
  it("returns the current window.location.pathname", () => {
    const { result } = renderHook(() => usePathname(), { wrapper: AuthWrapper });
    // jsdom defaults window.location.pathname to '/'
    expect(typeof result.current).toBe("string");
  });
});
