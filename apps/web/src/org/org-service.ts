import { generateSlug, validateOrganization } from "./org-validation";
import type { Organization, OrganizationMembership, OrganizationType } from "./org.types";

const orgsKey = "haza-aios.orgs";
const membershipsKey = "haza-aios.memberships";

// Seed data
const defaultOrgs: Organization[] = [
  {
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
    ownerId: "mock-user-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultMemberships: OrganizationMembership[] = [
  {
    id: "membership-1",
    organizationId: "org-mentor-school",
    userId: "mock-user-1",
    role: "Owner",
    status: "active",
    joinedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function getStoredOrgs(): Organization[] {
  const data = localStorage.getItem(orgsKey);
  if (!data) {
    localStorage.setItem(orgsKey, JSON.stringify(defaultOrgs));
    return defaultOrgs;
  }
  return JSON.parse(data);
}

function saveStoredOrgs(orgs: Organization[]) {
  localStorage.setItem(orgsKey, JSON.stringify(orgs));
}

function getStoredMemberships(): OrganizationMembership[] {
  const data = localStorage.getItem(membershipsKey);
  if (!data) {
    localStorage.setItem(membershipsKey, JSON.stringify(defaultMemberships));
    return defaultMemberships;
  }
  return JSON.parse(data);
}

function saveStoredMemberships(memberships: OrganizationMembership[]) {
  localStorage.setItem(membershipsKey, JSON.stringify(memberships));
}

export class OrganizationService {
  /**
   * Resets mock database state to defaults (useful for tests)
   */
  static resetToDefaults() {
    localStorage.setItem(orgsKey, JSON.stringify(defaultOrgs));
    localStorage.setItem(membershipsKey, JSON.stringify(defaultMemberships));
  }

  /**
   * Create a new organization and associate creator as Owner
   */
  async createOrganization(
    userId: string | undefined,
    input: {
      name: string;
      legalName?: string;
      organizationType: OrganizationType;
      industry: string;
      website?: string;
      email: string;
      phone?: string;
      country: string;
      description?: string;
    },
  ): Promise<{ organization: Organization; membership: OrganizationMembership }> {
    if (!userId) {
      throw new Error("Unauthorized: User session is missing.");
    }

    // Validate inputs
    const validationErrors = validateOrganization(input);
    if (Object.keys(validationErrors).length > 0) {
      throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }

    const orgs = getStoredOrgs();

    // Check for duplicate organization name (case-insensitive)
    const nameExists = orgs.some((o) => o.name.toLowerCase() === input.name.toLowerCase());
    if (nameExists) {
      throw new Error(`An organization named "${input.name}" already exists.`);
    }

    // Slug generation and uniqueness conflict resolution
    const baseSlug = generateSlug(input.name);
    let finalSlug = baseSlug;
    let counter = 1;

    while (orgs.some((o) => o.slug === finalSlug)) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const newOrg: Organization = {
      id: `org-${Math.random().toString(36).substr(2, 9)}`,
      name: input.name.trim(),
      legalName: (input.legalName || input.name).trim(),
      slug: finalSlug,
      logoUrl: undefined,
      description: input.description?.trim(),
      industry: input.industry.trim(),
      organizationType: input.organizationType,
      website: input.website?.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim(),
      country: input.country.trim(),
      timezone: "UTC", // Default timezone
      currency: "USD", // Default currency
      status: "active",
      ownerId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newMembership: OrganizationMembership = {
      id: `mem-${Math.random().toString(36).substr(2, 9)}`,
      organizationId: newOrg.id,
      userId,
      role: "Owner",
      status: "active",
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orgs.push(newOrg);
    saveStoredOrgs(orgs);

    const memberships = getStoredMemberships();
    memberships.push(newMembership);
    saveStoredMemberships(memberships);

    return { organization: newOrg, membership: newMembership };
  }

  /**
   * Get all organizations that a user belongs to
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const memberships = getStoredMemberships();
    const userOrgIds = memberships
      .filter((m) => m.userId === userId && m.status === "active")
      .map((m) => m.organizationId);

    const orgs = getStoredOrgs();
    return orgs.filter((o) => userOrgIds.includes(o.id));
  }

  /**
   * Get membership details of a user for a specific organization
   */
  async getMembership(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership | null> {
    const memberships = getStoredMemberships();
    return (
      memberships.find((m) => m.userId === userId && m.organizationId === organizationId) || null
    );
  }
}

export const orgService = new OrganizationService();
