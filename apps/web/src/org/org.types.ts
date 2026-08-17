export type OrganizationType =
  | "School"
  | "College"
  | "University"
  | "Healthcare Organization"
  | "Company"
  | "Government Organization"
  | "Non-Profit"
  | "Other";

export type OrganizationStatus = "active" | "suspended";

export interface Organization {
  id: string;
  name: string;
  legalName: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  industry: string;
  organizationType: OrganizationType;
  website?: string;
  email: string;
  phone?: string;
  country: string;
  timezone: string;
  currency: string;
  status: OrganizationStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type MembershipRole = "Owner" | "Admin" | "Member";
export type MembershipStatus = "active" | "pending" | "suspended";

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}
