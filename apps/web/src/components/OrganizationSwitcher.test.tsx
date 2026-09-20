import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Organization } from "@/org/org.types";
import { OrganizationSwitcher } from "./OrganizationSwitcher";

const organizations: Organization[] = [
  {
    id: "school-1",
    name: "HAZA School",
    legalName: "HAZA School",
    slug: "haza-school",
    organizationType: "School",
    industry: "Education",
    email: "owner@example.com",
    country: "Pakistan",
    status: "active",
    ownerId: "user-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "college-1",
    name: "HAZA College",
    legalName: "HAZA College",
    slug: "haza-college",
    organizationType: "College",
    industry: "Education",
    email: "owner@example.com",
    country: "Pakistan",
    status: "active",
    ownerId: "user-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("OrganizationSwitcher", () => {
  it("switches organizations without registering another user", () => {
    const onSwitch = vi.fn();
    render(
      <OrganizationSwitcher
        currentOrganization={organizations[0]}
        organizations={organizations}
        onSwitch={onSwitch}
        onCreate={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Active organization" }), {
      target: { value: "college-1" },
    });

    expect(onSwitch).toHaveBeenCalledWith("college-1");
  });

  it("opens the create-organization workflow from the switcher", () => {
    const onCreate = vi.fn();
    render(
      <OrganizationSwitcher
        currentOrganization={organizations[0]}
        organizations={organizations}
        onSwitch={vi.fn()}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create another organization" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });
});
