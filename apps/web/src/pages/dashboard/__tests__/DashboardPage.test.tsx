import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/auth/AuthProvider";
import { writeStoredAuth, clearStoredAuth } from "@/auth/auth-storage";
import { OrgProvider } from "@/org/OrgProvider";
import { DashboardPage } from "../DashboardPage";

vi.mock("@/routes/navigation", () => ({
  navigate: vi.fn(),
  usePathname: () => "/dashboard",
}));

describe("DashboardPage", () => {
  it("renders premium HAZA AIOS dashboard shell and metrics successfully", async () => {
    clearStoredAuth();
    writeStoredAuth({
      user: {
        id: "mock-user-1",
        firstName: "Alice",
        lastName: "Smith",
        displayName: "Alice Smith",
        email: "alice@example.com",
        emailVerified: true,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      session: {
        id: "sess-1",
        userId: "mock-user-1",
        accessToken: "tok-1",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        rememberMe: true,
      },
    });

    render(
      <AuthProvider>
        <OrgProvider>
          <DashboardPage />
        </OrgProvider>
      </AuthProvider>
    );

    // Verify Shell Elements
    expect(await screen.findByText("HAZA AIOS")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();

    // Verify Metric Primitives
    expect(screen.getByText("ACTIVE USERS")).toBeInTheDocument();
    expect(screen.getByText("AI OPERATIONS")).toBeInTheDocument();
    expect(screen.getByText("AUTOMATION TASKS")).toBeInTheDocument();
    expect(screen.getByText("SYSTEM HEALTH")).toBeInTheDocument();

    // Verify Visual Dashboard Primitives
    expect(screen.getByText("AI Operation Allocation")).toBeInTheDocument();
    expect(screen.getByText("AI Operation Activity")).toBeInTheDocument();
    expect(screen.getByText("Trigger Operation")).toBeInTheDocument();
    expect(screen.getByText("Active Workspaces")).toBeInTheDocument();
    expect(screen.getByText("Recent System Activity")).toBeInTheDocument();

    // Verify AI Chat Widget input
    const input = screen.getByPlaceholderText("Ask me anything...");
    expect(input).toBeInTheDocument();
  });
});
