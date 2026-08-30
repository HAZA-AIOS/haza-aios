import { apiClient } from "@/api/api-client";
import { generateSlug, validateOrganization } from "./org-validation";
import type { Organization, OrganizationMembership, OrganizationType } from "./org.types";

const orgsKey = "haza-aios.orgs";
const membershipsKey = "haza-aios.memberships";

// Test/demo fallback data. Runtime organization authority comes from the API.
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

type ApiOrganization = Omit<Organization, "organizationType" | "status" | "website" | "phone" | "description" | "logoUrl"> & {
  organizationType: string;
  status: Organization["status"] | "archived";
  website?: string | null;
  phone?: string | null;
  description?: string | null;
  logoUrl?: string | null;
};

type ApiMembership = OrganizationMembership & {
  permissions?: string[];
};

type AuthMeResponse = {
  memberships?: ApiMembership[];
};

function getStoredOrgs(): Organization[] {
  const data = localStorage.getItem(orgsKey);
  if (!data) {
    localStorage.setItem(orgsKey, JSON.stringify(defaultOrgs));
    return defaultOrgs;
  }
  return JSON.parse(data) as Organization[];
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
  return JSON.parse(data) as OrganizationMembership[];
}

function saveStoredMemberships(memberships: OrganizationMembership[]) {
  localStorage.setItem(membershipsKey, JSON.stringify(memberships));
}

export class OrganizationService {
  /**
   * Resets test/demo fallback state to defaults.
   */
  static resetToDefaults() {
    localStorage.setItem(orgsKey, JSON.stringify(defaultOrgs));
    localStorage.setItem(membershipsKey, JSON.stringify(defaultMemberships));
  }

  /**
   * Create a new organization and associate creator as Owner.
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

    return requestOrTestFixture(async () => {
      const response = await apiClient.request<{ organization: ApiOrganization }>("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          ownerId: userId,
          workspaceName: `${input.name.trim()} Workspace`,
          workspaceCode: generateSlug(input.name),
        }),
      });
      const organization = toOrganization(response.organization);
      const membership = await this.getMembership(userId, organization.id);

      if (!membership) {
        throw new Error("Organization was created but membership could not be resolved.");
      }

      return { organization, membership };
    }, () => this.createLocalOrganization(userId, input));
  }

  /**
   * Get all organizations that a user belongs to.
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    return requestOrTestFixture(async () => {
      const response = await apiClient.request<{ organizations: ApiOrganization[] }>("/api/v1/organizations");
      const memberships = await this.getCurrentMemberships(userId);
      const activeOrgIds = new Set(
        memberships
          .filter((membership) => membership.userId === userId && membership.status === "active")
          .map((membership) => membership.organizationId),
      );

      return response.organizations
        .map(toOrganization)
        .filter((organization) => activeOrgIds.has(organization.id) && organization.status === "active");
    }, () => this.getLocalUserOrganizations(userId));
  }

  /**
   * Get membership details of a user for a specific organization.
   */
  async getMembership(userId: string, organizationId: string): Promise<OrganizationMembership | null> {
    return requestOrTestFixture(async () => {
      const memberships = await this.getCurrentMemberships(userId);
      return memberships.find((membership) => membership.userId === userId && membership.organizationId === organizationId) ?? null;
    }, () => this.getLocalMembership(userId, organizationId));
  }

  private async getCurrentMemberships(userId: string): Promise<OrganizationMembership[]> {
    const response = await apiClient.request<AuthMeResponse>("/api/v1/auth/me");
    return (response.memberships ?? [])
      .filter((membership) => membership.userId === userId)
      .map(toMembership);
  }

  private createLocalOrganization(
    userId: string,
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
  ): { organization: Organization; membership: OrganizationMembership } {
    const validationErrors = validateOrganization(input);
    if (Object.keys(validationErrors).length > 0) {
      throw new Error(`Validation failed: ${JSON.stringify(validationErrors)}`);
    }

    const orgs = getStoredOrgs();
    const nameExists = orgs.some((organization) => organization.name.toLowerCase() === input.name.toLowerCase());
    if (nameExists) {
      throw new Error(`An organization named "${input.name}" already exists.`);
    }

    const baseSlug = generateSlug(input.name);
    let finalSlug = baseSlug;
    let counter = 1;

    while (orgs.some((organization) => organization.slug === finalSlug)) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const newOrg: Organization = {
      id: `org-${Math.random().toString(36).slice(2, 11)}`,
      name: input.name.trim(),
      legalName: (input.legalName || input.name).trim(),
      slug: finalSlug,
      description: input.description?.trim(),
      industry: input.industry.trim(),
      organizationType: input.organizationType,
      website: input.website?.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim(),
      country: input.country.trim(),
      timezone: "UTC",
      currency: "USD",
      status: "active",
      ownerId: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newMembership: OrganizationMembership = {
      id: `mem-${Math.random().toString(36).slice(2, 11)}`,
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

  private getLocalUserOrganizations(userId: string): Organization[] {
    const memberships = getStoredMemberships();
    const userOrgIds = memberships
      .filter((membership) => membership.userId === userId && membership.status === "active")
      .map((membership) => membership.organizationId);

    const orgs = getStoredOrgs();
    return orgs.filter((organization) => userOrgIds.includes(organization.id));
  }

  private getLocalMembership(userId: string, organizationId: string): OrganizationMembership | null {
    const memberships = getStoredMemberships();
    return memberships.find((membership) => membership.userId === userId && membership.organizationId === organizationId) ?? null;
  }
}

function toOrganization(organization: ApiOrganization): Organization {
  return {
    ...organization,
    description: organization.description ?? undefined,
    website: organization.website ?? undefined,
    phone: organization.phone ?? undefined,
    logoUrl: organization.logoUrl ?? undefined,
    organizationType: toOrganizationType(organization.organizationType),
    status: organization.status === "suspended" ? "suspended" : "active",
    createdAt: toIsoString(organization.createdAt),
    updatedAt: toIsoString(organization.updatedAt),
  };
}

function toMembership(membership: ApiMembership): OrganizationMembership {
  return {
    id: membership.id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    joinedAt: toIsoString(membership.joinedAt),
    createdAt: toIsoString(membership.createdAt),
    updatedAt: toIsoString(membership.updatedAt),
  };
}

function toOrganizationType(value: string): OrganizationType {
  const allowed: OrganizationType[] = [
    "School",
    "College",
    "University",
    "Healthcare Organization",
    "Company",
    "Government Organization",
    "Non-Profit",
    "Other",
  ];
  return allowed.includes(value as OrganizationType) ? value as OrganizationType : "Other";
}

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function requestOrTestFixture<T>(request: () => Promise<T>, fixture: () => T): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (import.meta.env.MODE === "test") {
      return fixture();
    }
    throw error;
  }
}

export const orgService = new OrganizationService();
