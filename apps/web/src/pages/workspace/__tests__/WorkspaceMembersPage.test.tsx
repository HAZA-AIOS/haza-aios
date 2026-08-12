import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AuthContext } from "../../../auth/AuthProvider";
import { OrgContext } from "../../../org/OrgContext";
import { WorkspaceMembersPage } from "../WorkspaceMembersPage";
import type { Organization, OrganizationMembership } from "../../../org/org.types";

const mockUser = {
  id: "user-1",
  firstName: "Test",
  lastName: "Operator",
  displayName: "Test Operator",
  email: "operator@test.com",
  emailVerified: true,
  status: "active" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAuthContextValue = {
  status: "authenticated" as const,
  user: mockUser,
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

const mockOrg: Organization = {
  id: "org-mentor-school",
  name: "The Mentor School",
  legalName: "The Mentor School Inc.",
  slug: "the-mentor-school",
  industry: "Education",
  organizationType: "School",
  email: "contact@mentorschool.edu",
  country: "United States",
  timezone: "America/New_York",
  currency: "USD",
  status: "active",
  ownerId: "user-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMembership: OrganizationMembership = {
  id: "membership-1",
  organizationId: "org-mentor-school",
  userId: "user-1",
  role: "Owner",
  status: "active",
  joinedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderWithProviders(ui: React.ReactElement, membershipRole: "Owner" | "Admin" | "Member" = "Owner") {
  const orgContextValue = {
    currentOrganization: mockOrg,
    currentMembership: { ...mockMembership, role: membershipRole },
    organizations: [mockOrg],
    isLoading: false,
    error: null,
    createOrg: async () => ({ organization: {} as never, membership: {} as never }),
    switchOrg: async () => {},
    refresh: async () => {},
  };

  return render(
    React.createElement(
      AuthContext.Provider,
      { value: mockAuthContextValue },
      React.createElement(
        OrgContext.Provider,
        { value: orgContextValue },
        ui
      )
    )
  );
}

describe("WorkspaceMembersPage", () => {
  it("renders page header and search input", async () => {
    renderWithProviders(React.createElement(WorkspaceMembersPage), "Owner");
    expect(await screen.findByText("Organization Members")).toBeDefined();
    expect(await screen.findByPlaceholderText("Search members by name or email...")).toBeDefined();
  });

  it("shows 'Invite Member' button for Owners", async () => {
    renderWithProviders(React.createElement(WorkspaceMembersPage), "Owner");
    expect(await screen.findByText("Invite Member")).toBeDefined();
  });

  it("shows 'Invite Member' button for Admins", async () => {
    renderWithProviders(React.createElement(WorkspaceMembersPage), "Admin");
    expect(await screen.findByText("Invite Member")).toBeDefined();
  });

  it("hides 'Invite Member' button and shows read-only banner for standard Members", async () => {
    renderWithProviders(React.createElement(WorkspaceMembersPage), "Member");
    expect(screen.queryByText("Invite Member")).toBeNull();
    expect(await screen.findByText("Read-Only Mode (Member)")).toBeDefined();
  });
});
