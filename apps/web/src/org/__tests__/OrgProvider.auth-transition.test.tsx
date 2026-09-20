import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Organization, OrganizationMembership } from "../org.types";
import { OrgProvider } from "../OrgProvider";
import { useOrganization } from "../use-organization";

const mocks = vi.hoisted(() => ({
  auth: {
    status: "unauthenticated" as "unauthenticated" | "authenticated",
    user: null as { id: string } | null,
  },
  getUserOrganizations: vi.fn(),
  getMembership: vi.fn(),
}));

vi.mock("@/auth/use-auth", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("../org-service", () => ({
  orgService: {
    getUserOrganizations: mocks.getUserOrganizations,
    getMembership: mocks.getMembership,
  },
}));

const organization: Organization = {
  id: "org-school",
  name: "Existing School",
  legalName: "Existing School",
  slug: "existing-school",
  industry: "Education",
  organizationType: "School",
  email: "school@example.com",
  country: "Pakistan",
  timezone: "Asia/Karachi",
  currency: "PKR",
  status: "active",
  ownerId: "user-1",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

const membership: OrganizationMembership = {
  id: "membership-owner",
  organizationId: organization.id,
  userId: "user-1",
  role: "Owner",
  status: "active",
  joinedAt: "2026-09-20T00:00:00.000Z",
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-20T00:00:00.000Z",
};

function OrganizationState() {
  const { isLoading, organizations } = useOrganization();

  return (
    <>
      <p data-testid="loading">{String(isLoading)}</p>
      <p data-testid="organization-count">{organizations.length}</p>
    </>
  );
}

describe("OrgProvider authentication transitions", () => {
  it("stays loading until organizations resolve for the newly authenticated user", async () => {
    let resolveOrganizations!: (organizations: Organization[]) => void;
    mocks.getUserOrganizations.mockReturnValue(
      new Promise<Organization[]>((resolve) => {
        resolveOrganizations = resolve;
      }),
    );
    mocks.getMembership.mockResolvedValue(membership);

    const view = render(
      <OrgProvider>
        <OrganizationState />
      </OrgProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    mocks.auth.status = "authenticated";
    mocks.auth.user = { id: "user-1" };
    view.rerender(
      <OrgProvider>
        <OrganizationState />
      </OrgProvider>,
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("true");

    await act(async () => {
      resolveOrganizations([organization]);
    });

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("organization-count")).toHaveTextContent("1");
  });
});
