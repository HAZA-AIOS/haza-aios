/**
 * HAZA AIOS — Stage 21 Staging Synthetic Test Fixtures
 * 
 * Strict Isolation Principle:
 * All identities, emails, organizations, and identifiers in this file are
 * 100% synthetic. No production user, customer, or student data is used.
 */

export interface SyntheticStagingUser {
  id: string;
  roleKey: string;
  roleTitle: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  assignedTenants: string[];
}

export interface SyntheticStagingOrganization {
  id: string;
  slug: string;
  name: string;
  legalName: string;
  industry: string;
  organizationType: string;
  campuses?: Array<{ id: string; name: string; code: string }>;
  businesses?: Array<{ id: string; name: string; code: string }>;
}

/**
 * Predefined Synthetic Users across all 9 required organizational role tiers.
 */
export const STAGING_SYNTHETIC_USERS: Record<string, SyntheticStagingUser> = {
  platformAdmin: {
    id: "usr-stage-plat-admin-001",
    roleKey: "platform_admin",
    roleTitle: "Platform Administrator",
    email: "platform-admin@staging.haza-aios.com",
    firstName: "Platform",
    lastName: "Admin",
    displayName: "Platform Administrator (Staging)",
    assignedTenants: ["*"],
  },
  orgOwner: {
    id: "usr-stage-org-owner-002",
    roleKey: "organization_owner",
    roleTitle: "Organization Owner",
    email: "org-owner@staging.haza-aios.com",
    firstName: "Organize",
    lastName: "Owner",
    displayName: "Organization Owner (Alpha Trust)",
    assignedTenants: ["org-stage-alpha-edu-001"],
  },
  businessOwner: {
    id: "usr-stage-biz-owner-003",
    roleKey: "business_owner",
    roleTitle: "Standalone Business Owner",
    email: "business-owner@staging.haza-aios.com",
    firstName: "Business",
    lastName: "Owner",
    displayName: "Business Owner (Beta Group)",
    assignedTenants: ["org-stage-beta-corp-002"],
  },
  tenantAdmin: {
    id: "usr-stage-ten-admin-004",
    roleKey: "tenant_admin",
    roleTitle: "Tenant Administrator",
    email: "tenant-admin@staging.haza-aios.com",
    firstName: "Tenant",
    lastName: "Administrator",
    displayName: "Tenant Admin (Alpha Trust)",
    assignedTenants: ["org-stage-alpha-edu-001"],
  },
  eduAdmin: {
    id: "usr-stage-edu-admin-005",
    roleKey: "education_admin",
    roleTitle: "Education Administrator",
    email: "edu-admin@staging.haza-aios.com",
    firstName: "Education",
    lastName: "Director",
    displayName: "SIS Education Admin",
    assignedTenants: ["org-stage-alpha-edu-001"],
  },
  teacher: {
    id: "usr-stage-teacher-006",
    roleKey: "teacher",
    roleTitle: "Teacher / Faculty Member",
    email: "teacher@staging.haza-aios.com",
    firstName: "Sarah",
    lastName: "Jenkins",
    displayName: "Teacher Sarah Jenkins",
    assignedTenants: ["org-stage-alpha-edu-001"],
  },
  staff: {
    id: "usr-stage-staff-007",
    roleKey: "staff",
    roleTitle: "Administrative Staff Member",
    email: "staff@staging.haza-aios.com",
    firstName: "Marcus",
    lastName: "Vance",
    displayName: "Staff Marcus Vance",
    assignedTenants: ["org-stage-alpha-edu-001"],
  },
  student: {
    id: "usr-stage-student-008",
    roleKey: "student",
    roleTitle: "Enrolled Student",
    email: "student@staging.haza-aios.com",
    firstName: "Alex",
    lastName: "Mercer",
    displayName: "Student Alex Mercer",
    assignedTenants: ["org-stage-alpha-edu-001"],
  },
  parent: {
    id: "usr-stage-parent-009",
    roleKey: "parent",
    roleTitle: "Parent / Legal Guardian",
    email: "parent@staging.haza-aios.com",
    firstName: "David",
    lastName: "Mercer",
    displayName: "Guardian David Mercer",
    assignedTenants: ["org-stage-alpha-edu-001"],
  },
};

/**
 * Predefined Synthetic Multi-Tenant Organizational Structures.
 */
export const STAGING_SYNTHETIC_ORGANIZATIONS: Record<string, SyntheticStagingOrganization> = {
  alphaEduTrust: {
    id: "org-stage-alpha-edu-001",
    slug: "alpha-educational-trust",
    name: "Alpha Educational Trust",
    legalName: "Alpha Educational Foundation Staging Ltd",
    industry: "Education",
    organizationType: "Multi-Campus School System",
    campuses: [
      { id: "cmp-alpha-main-001", name: "Alpha Central Main Campus", code: "ACM-01" },
      { id: "cmp-alpha-north-002", name: "Alpha North Extension Campus", code: "ANX-02" },
    ],
  },
  betaHorizonGroup: {
    id: "org-stage-beta-corp-002",
    slug: "beta-horizon-group",
    name: "Beta Horizon Enterprise Group",
    legalName: "Beta Horizon Holdings Staging Corp",
    industry: "Commercial",
    organizationType: "Multi-Business Enterprise",
    businesses: [
      { id: "biz-beta-consult-001", name: "Beta Management Consulting", code: "BMC-01" },
      { id: "biz-beta-logistics-002", name: "Beta Supply & Logistics", code: "BSL-02" },
    ],
  },
};

/**
 * Returns summary statistics for planned staging fixtures.
 */
export function getStagingFixtureSummary() {
  const users = Object.values(STAGING_SYNTHETIC_USERS);
  const orgs = Object.values(STAGING_SYNTHETIC_ORGANIZATIONS);
  const totalCampuses = orgs.reduce((sum, org) => sum + (org.campuses?.length ?? 0), 0);
  const totalBusinesses = orgs.reduce((sum, org) => sum + (org.businesses?.length ?? 0), 0);

  return {
    totalSyntheticUsers: users.length,
    totalOrganizations: orgs.length,
    totalCampuses,
    totalBusinesses,
    rolesRepresented: users.map((u) => u.roleTitle),
  };
}
