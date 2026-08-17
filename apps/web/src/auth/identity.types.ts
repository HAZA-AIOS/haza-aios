type UserStatus = "active" | "invited" | "suspended";

type UserRole = "owner" | "admin" | "member";

type Permission =
  "organization:read" | "organization:update" | "users:read" | "users:invite" | "billing:read";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  avatar?: string;
  emailVerified: boolean;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

type AuthSession = {
  id: string;
  userId: string;
  accessToken: string;
  expiresAt: string;
  rememberMe: boolean;
};

type Organization = {
  id: string;
  name: string;
};

type OrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: UserRole;
  permissions: Permission[];
};

export type {
  AuthSession,
  Organization,
  OrganizationMembership,
  Permission,
  User,
  UserRole,
  UserStatus,
};
