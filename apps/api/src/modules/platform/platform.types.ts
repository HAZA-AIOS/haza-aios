export type OrganizationStatus = "active" | "suspended" | "archived";
export type WorkspaceStatus = "active" | "archived";
export type WorkspaceType = "primary" | "general" | "industry";
export type ModuleActivationStatus = "activated" | "deactivated";
export type MembershipRole = "Owner" | "Admin" | "Member";
export type MembershipStatus = "active" | "pending" | "suspended";

export type OrganizationRecord = {
  id: string;
  name: string;
  legalName: string;
  slug: string;
  description: string | null;
  industry: string;
  organizationType: string;
  website: string | null;
  email: string;
  phone: string | null;
  country: string;
  timezone: string;
  currency: string;
  status: OrganizationStatus;
  ownerId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceRecord = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  type: WorkspaceType;
  status: WorkspaceStatus;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationSettingsRecord = {
  id: string;
  organizationId: string;
  timezone: string;
  locale: string;
  currency: string;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type PlatformModuleRecord = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  industry: string;
  version: string;
  status: string;
  isCore: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationModuleRecord = {
  id: string;
  organizationId: string;
  moduleKey: string;
  status: ModuleActivationStatus;
  enabled: boolean;
  settings: Record<string, unknown> | null;
  activatedAt: Date;
  activatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type OrganizationModuleWithCatalog = {
  catalog: PlatformModuleRecord;
  state: OrganizationModuleRecord | null;
};

export type OrganizationMembershipRecord = {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateOrganizationInput = {
  name: string;
  legalName?: string;
  slug?: string;
  description?: string;
  industry: string;
  organizationType: string;
  website?: string;
  email: string;
  phone?: string;
  country: string;
  timezone?: string;
  currency?: string;
  ownerId: string;
  workspaceName?: string;
  workspaceCode?: string;
};

export type UpdateOrganizationInput = Partial<Pick<CreateOrganizationInput, "name" | "legalName" | "description" | "industry" | "organizationType" | "website" | "email" | "phone" | "country" | "timezone" | "currency">> & {
  status?: OrganizationStatus;
};

export type CreateWorkspaceInput = {
  organizationId: string;
  name: string;
  code?: string;
  type?: WorkspaceType;
};

export type UpdateWorkspaceInput = Partial<Pick<CreateWorkspaceInput, "name" | "code" | "type">> & {
  status?: WorkspaceStatus;
};

export type EnableModuleInput = {
  organizationId: string;
  moduleKey: string;
  enabled?: boolean;
  settings?: Record<string, unknown>;
  activatedBy?: string;
};

export type UpdateModuleConfigurationInput = {
  organizationId: string;
  moduleKey: string;
  settings: Record<string, unknown>;
  activatedBy?: string;
};

export type UpsertPlatformModuleInput = {
  key: string;
  name: string;
  description: string;
  category: string;
  industry: string;
  version: string;
  status: string;
  isCore: boolean;
  metadata: Record<string, unknown>;
};
