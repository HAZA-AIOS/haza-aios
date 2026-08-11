import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthProvider } from "@/auth/AuthProvider";
import { writeStoredAuth, clearStoredAuth } from "@/auth/auth-storage";
import { OrgProvider } from "@/org/OrgProvider";
import { CreateOrganizationPage } from "../CreateOrganizationPage";

vi.mock("@/routes/navigation", () => ({
  navigate: vi.fn(),
}));

describe("CreateOrganizationPage", () => {
  it("renders the organization registration form successfully", async () => {
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
          <CreateOrganizationPage />
        </OrgProvider>
      </AuthProvider>,
    );

    expect(await screen.findByText("Register your Organization")).toBeInTheDocument();
    expect(screen.getByLabelText("Organization Name")).toBeInTheDocument();
  });
});
