export type UserStatus = "active" | "inactive" | "suspended" | "pending" | "archived";
export type RoleScope = "platform" | "organization";
export type MembershipRoleName = "Owner" | "Admin" | "Member";

export type UserRecord = {
  id: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  displayName: string;
  emailVerified: boolean;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SafeUser = Omit<UserRecord, "passwordHash" | "normalizedEmail">;

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  status: "active" | "revoked" | "expired";
  rememberMe: boolean;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PermissionKey =
  | "platform.admin"
  | "organization.read"
  | "organization.manage"
  | "workspace.read"
  | "workspace.manage"
  | "module.read"
  | "module.manage"
  | "member.read"
  | "member.manage";

export type AuthMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRoleName;
  status: "active" | "pending" | "suspended";
  permissions: PermissionKey[];
};

export type AuthContext = {
  user: SafeUser;
  session: SessionRecord;
  memberships: AuthMembership[];
  platformPermissions: PermissionKey[];
};

export type CreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  status?: UserStatus;
  emailVerified?: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
  rememberMe: boolean;
};

export type RegisterInput = CreateUserInput & {
  organizationName: string;
  organizationType: string;
  industry: string;
  country: string;
  organizationEmail?: string;
};

export type AuthResult = {
  user: SafeUser;
  session: {
    id: string;
    userId: string;
    accessToken: string;
    expiresAt: string;
    rememberMe: boolean;
  };
  memberships: AuthMembership[];
};
