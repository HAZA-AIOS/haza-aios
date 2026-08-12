import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthProvider } from "@/auth/AuthProvider";
import { writeStoredAuth, clearStoredAuth } from "@/auth/auth-storage";
import { OrgProvider } from "../OrgProvider";
import { useOrganization } from "../use-organization";

function TestComponent() {
  const { currentOrganization, currentMembership, createOrg } = useOrganization();

  return (
    <div>
      <p data-testid="org-name">{currentOrganization?.name || "No Org"}</p>
      <p data-testid="member-role">{currentMembership?.role || "No Role"}</p>
      <button
        onClick={() =>
          createOrg({
            name: "Dynamic Academy",
            organizationType: "School",
            industry: "Education",
            email: "dynamic@academy.com",
            country: "USA",
          })
        }
      >
        Create
      </button>
    </div>
  );
}

import { orgService } from "../org-service";

describe("OrgProvider & useOrganization hook", () => {
  it("provides organization context if authenticated", async () => {
    localStorage.clear();
    orgService.constructor.prototype.constructor.resetToDefaults();
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
          <TestComponent />
        </OrgProvider>
      </AuthProvider>,
    );

    const orgElement = await screen.findByTestId("org-name");
    expect(orgElement.textContent).toBe("The Mentor School");

    const roleElement = await screen.findByTestId("member-role");
    expect(roleElement.textContent).toBe("Owner");
  });
});
