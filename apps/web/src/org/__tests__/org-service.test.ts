import { beforeEach, describe, expect, it } from "vitest";
import { orgService } from "../org-service";

describe("OrganizationService", () => {
  beforeEach(() => {
    orgService.constructor.prototype.constructor.resetToDefaults();
  });

  it("successfully creates a new organization and assigns creator as Owner", async () => {
    const result = await orgService.createOrganization("user-test-123", {
      name: "New University",
      organizationType: "University",
      industry: "Education",
      email: "info@newuni.edu",
      country: "Canada",
    });

    expect(result.organization.name).toBe("New University");
    expect(result.organization.slug).toBe("new-university");
    expect(result.organization.ownerId).toBe("user-test-123");
    expect(result.membership.role).toBe("Owner");
    expect(result.membership.userId).toBe("user-test-123");
  });

  it("handles duplicate slugs by appending sequential numbers", async () => {
    // First creation
    await orgService.createOrganization("user-test-123", {
      name: "Unique Academy",
      organizationType: "School",
      industry: "Education",
      email: "info@unique.edu",
      country: "Canada",
    });

    // Second creation with similar slug resolving structure
    const res1 = await orgService.createOrganization("user-test-123", {
      name: "Awesome School",
      organizationType: "School",
      industry: "Education",
      email: "a@a.com",
      country: "USA",
    });

    const res2 = await orgService.createOrganization("user-test-123", {
      name: "Awesome-School",
      organizationType: "School",
      industry: "Education",
      email: "b@b.com",
      country: "USA",
    });

    expect(res1.organization.slug).toBe("awesome-school");
    expect(res2.organization.slug).toBe("awesome-school-1");
  });

  it("rejects duplicate organization name", async () => {
    await orgService.createOrganization("user-test-123", {
      name: "Duplicate Org",
      organizationType: "School",
      industry: "Education",
      email: "a@a.com",
      country: "USA",
    });

    await expect(
      orgService.createOrganization("user-test-123", {
        name: "Duplicate Org",
        organizationType: "School",
        industry: "Education",
        email: "b@b.com",
        country: "USA",
      }),
    ).rejects.toThrow();
  });

  it("throws error for unauthorized user", async () => {
    await expect(
      orgService.createOrganization(undefined, {
        name: "Unauthorized School",
        organizationType: "School",
        industry: "Education",
        email: "a@a.com",
        country: "USA",
      }),
    ).rejects.toThrow();
  });
});
