import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateOrganizationPage } from "../CreateOrganizationPage";

vi.mock("@/auth/use-auth", () => ({
  useAuth: () => ({ user: { email: "owner@example.com" } }),
}));

vi.mock("@/org/use-organization", () => ({
  useOrganization: () => ({
    createOrg: vi.fn(),
    isLoading: false,
    organizations: [{ id: "school-1", name: "Existing School" }],
  }),
}));

vi.mock("@/routes/navigation", () => ({
  navigate: vi.fn(),
}));

describe("CreateOrganizationPage for an existing account", () => {
  it("explains that another organization uses the same account", async () => {
    render(<CreateOrganizationPage />);

    expect(screen.getByText("Create another Organization")).toBeVisible();
    expect(screen.getByText(/under your existing account/)).toBeVisible();
    expect(screen.getByText(/switch between organizations from the dashboard/)).toBeVisible();
    expect(await screen.findByDisplayValue("owner@example.com")).toBeVisible();
    expect(screen.getByRole("button", { name: "Create Organization" })).toBeVisible();
  });
});
