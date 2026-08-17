import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mocks for auth and org contexts
const mockAuthContextValue = {
  status: "authenticated" as const,
  user: {
    id: "user-1",
    firstName: "Test",
    lastName: "Admin",
    displayName: "Test Admin",
    email: "admin@test.com",
    emailVerified: true,
    status: "active" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  session: {
    id: "session-1",
    userId: "user-1",
    accessToken: "mock-token",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    rememberMe: false,
  },
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  forgotPassword: async () => {},
  resetPassword: async () => {},
  verifyEmail: async () => {},
  clearError: () => {},
};

const mockOrgContextValue = {
  currentOrganization: null,
  currentMembership: null,
  organizations: [],
  isLoading: false,
  error: null,
  createOrg: async () => ({ organization: {} as never, membership: {} as never }),
  switchOrg: async () => {},
  refresh: async () => {},
};

// We need to import after mocks
import { AuthContext } from "@/auth/AuthProvider";
import { OrgContext } from "@/org/OrgContext";
import { AdminOverviewPage } from "../AdminOverviewPage";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    React.createElement(
      AuthContext.Provider,
      { value: mockAuthContextValue },
      React.createElement(
        OrgContext.Provider,
        { value: mockOrgContextValue },
        ui,
      ),
    ),
  );
}

describe("AdminOverviewPage", () => {
  it("renders the admin overview page title", async () => {
    renderWithProviders(React.createElement(AdminOverviewPage));
    expect(await screen.findByText("Platform Administration")).toBeDefined();
  });

  it("renders stat card titles", async () => {
    renderWithProviders(React.createElement(AdminOverviewPage));
    expect(await screen.findByText("Total Organizations")).toBeDefined();
    expect(await screen.findByText("Total Users")).toBeDefined();
    expect(await screen.findByText("Active Sessions")).toBeDefined();
    expect(await screen.findByText("System Health")).toBeDefined();
  });

  it("renders the system health monitor section", async () => {
    renderWithProviders(React.createElement(AdminOverviewPage));
    expect(await screen.findByText("System Health Monitor")).toBeDefined();
  });

  it("renders the recent audit activity section", async () => {
    renderWithProviders(React.createElement(AdminOverviewPage));
    expect(await screen.findByText("Recent Audit Activity")).toBeDefined();
  });
});
