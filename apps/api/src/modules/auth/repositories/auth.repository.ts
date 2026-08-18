import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  authSessions,
  membershipRoles,
  organizationMemberships,
  permissions,
  rolePermissions,
  roles,
  securityEvents,
  users,
  workspaceMemberships,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type { CreateUserInput, PermissionKey, RoleScope, SafeUser, SessionRecord, UserRecord } from "../auth.types.js";
import { normalizeEmail } from "../validation/auth-validation.js";

type PermissionSeed = {
  key: PermissionKey;
  description: string;
};

export const corePermissions: PermissionSeed[] = [
  { key: "platform.admin", description: "Access platform-wide administration." },
  { key: "organization.read", description: "Read organization records." },
  { key: "organization.manage", description: "Manage organization settings and lifecycle." },
  { key: "workspace.read", description: "Read workspace records." },
  { key: "workspace.manage", description: "Manage workspace records." },
  { key: "module.read", description: "Read organization module activation." },
  { key: "module.manage", description: "Manage organization module activation." },
  { key: "member.read", description: "Read organization members." },
  { key: "member.manage", description: "Manage organization members and roles." },
];

export class AuthRepository {
  constructor(private readonly context: RepositoryContext) {}

  async createUser(input: CreateUserInput & { passwordHash: string }): Promise<UserRecord> {
    const id = randomUUID();
    const now = new Date();
    const displayName = `${input.firstName.trim()} ${input.lastName.trim()}`.trim();

    await this.context.db.insert(users).values({
      id,
      email: input.email,
      normalizedEmail: normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      displayName,
      emailVerified: input.emailVerified ?? false,
      status: input.status ?? "active",
      createdAt: now,
      updatedAt: now,
    });

    const user = await this.getUserById(id);
    if (!user) throw new Error("User create failed.");
    return user;
  }

  async getUserById(id: string): Promise<UserRecord | null> {
    const rows = await this.context.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async getUserByEmail(email: string): Promise<UserRecord | null> {
    const rows = await this.context.db.select().from(users).where(eq(users.normalizedEmail, normalizeEmail(email))).limit(1);
    return rows[0] ?? null;
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.context.db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  }

  async createSession(input: { userId: string; tokenHash: string; expiresAt: Date; rememberMe: boolean }): Promise<SessionRecord> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(authSessions).values({
      id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      status: "active",
      rememberMe: input.rememberMe,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    const session = await this.getActiveSessionByHash(input.tokenHash);
    if (!session) throw new Error("Session create failed.");
    return session;
  }

  async getActiveSessionByHash(tokenHash: string): Promise<SessionRecord | null> {
    const rows = await this.context.db.select().from(authSessions).where(and(
      eq(authSessions.tokenHash, tokenHash),
      eq(authSessions.status, "active"),
      gt(authSessions.expiresAt, new Date()),
      isNull(authSessions.revokedAt),
    )).limit(1);

    return rows[0] ?? null;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.context.db.update(authSessions).set({
      status: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(authSessions.id, sessionId));
  }

  async revokeSessionByHash(tokenHash: string): Promise<void> {
    await this.context.db.update(authSessions).set({
      status: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(authSessions.tokenHash, tokenHash));
  }

  async ensurePermissions(): Promise<Record<PermissionKey, string>> {
    for (const permission of corePermissions) {
      const existing = await this.getPermissionByKey(permission.key);
      if (!existing) {
        await this.context.db.insert(permissions).values({
          id: randomUUID(),
          key: permission.key,
          description: permission.description,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    const rows = await this.context.db.select({ id: permissions.id, key: permissions.key }).from(permissions).where(inArray(permissions.key, corePermissions.map((item) => item.key)));
    return Object.fromEntries(rows.map((row) => [row.key, row.id])) as Record<PermissionKey, string>;
  }

  async ensureRole(input: { organizationId?: string | null; name: string; scope: RoleScope; systemKey?: string; description: string; permissionKeys: PermissionKey[] }): Promise<string> {
    const permissionIds = await this.ensurePermissions();
    const existing = await this.getRole(input.organizationId ?? null, input.name, input.systemKey);
    const roleId = existing?.id ?? randomUUID();
    const now = new Date();

    if (!existing) {
      await this.context.db.insert(roles).values({
        id: roleId,
        organizationId: input.organizationId ?? null,
        name: input.name,
        scope: input.scope,
        systemKey: input.systemKey,
        description: input.description,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const permissionKey of input.permissionKeys) {
      const permissionId = permissionIds[permissionKey];
      const linkExists = await this.rolePermissionExists(roleId, permissionId);
      if (!linkExists) {
        await this.context.db.insert(rolePermissions).values({
          id: randomUUID(),
          roleId,
          permissionId,
          createdAt: now,
        });
      }
    }

    return roleId;
  }

  async assignRoleToMembership(membershipId: string, roleId: string): Promise<void> {
    const rows = await this.context.db.select({ id: membershipRoles.id }).from(membershipRoles).where(and(
      eq(membershipRoles.membershipId, membershipId),
      eq(membershipRoles.roleId, roleId),
    )).limit(1);

    if (rows.length) return;

    await this.context.db.insert(membershipRoles).values({
      id: randomUUID(),
      membershipId,
      roleId,
      createdAt: new Date(),
    });
  }

  async createWorkspaceMembership(workspaceId: string, organizationMembershipId: string): Promise<void> {
    await this.context.db.insert(workspaceMemberships).values({
      id: randomUUID(),
      workspaceId,
      organizationMembershipId,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async getMembershipByOrganizationAndUser(organizationId: string, userId: string) {
    const rows = await this.context.db.select().from(organizationMemberships).where(and(
      eq(organizationMemberships.organizationId, organizationId),
      eq(organizationMemberships.userId, userId),
    )).limit(1);
    return rows[0] ?? null;
  }

  async getMembershipsWithPermissions(userId: string) {
    const memberships = await this.context.db.select().from(organizationMemberships).where(and(
      eq(organizationMemberships.userId, userId),
      eq(organizationMemberships.status, "active"),
    ));
    const result = [];

    for (const membership of memberships) {
      const permissionRows = await this.context.db
        .select({ key: permissions.key })
        .from(membershipRoles)
        .innerJoin(roles, eq(membershipRoles.roleId, roles.id))
        .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(membershipRoles.membershipId, membership.id));

      result.push({
        id: membership.id,
        organizationId: membership.organizationId,
        userId: membership.userId,
        role: membership.role,
        status: membership.status,
        permissions: Array.from(new Set(permissionRows.map((row) => row.key as PermissionKey))),
      });
    }

    return result;
  }

  async getPlatformPermissions(userId: string): Promise<PermissionKey[]> {
    const rows = await this.context.db
      .select({ key: permissions.key })
      .from(membershipRoles)
      .innerJoin(organizationMemberships, eq(membershipRoles.membershipId, organizationMemberships.id))
      .innerJoin(roles, eq(membershipRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.status, "active"),
        eq(roles.scope, "platform"),
      ));

    return Array.from(new Set(rows.map((row) => row.key as PermissionKey)));
  }

  async recordSecurityEvent(input: { userId?: string; organizationId?: string; eventType: string; severity?: "info" | "warning" | "critical"; ipAddress?: string; userAgent?: string; metadata?: Record<string, unknown> }): Promise<void> {
    await this.context.db.insert(securityEvents).values({
      id: randomUUID(),
      userId: input.userId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      severity: input.severity ?? "info",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata,
      createdAt: new Date(),
    });
  }

  private async getPermissionByKey(key: PermissionKey) {
    const rows = await this.context.db.select().from(permissions).where(eq(permissions.key, key)).limit(1);
    return rows[0] ?? null;
  }

  private async getRole(organizationId: string | null, name: string, systemKey?: string) {
    const rows = await this.context.db.select().from(roles).where(or(
      systemKey ? eq(roles.systemKey, systemKey) : undefined,
      and(
        organizationId ? eq(roles.organizationId, organizationId) : isNull(roles.organizationId),
        eq(roles.name, name),
      ),
    )).limit(1);
    return rows[0] ?? null;
  }

  private async rolePermissionExists(roleId: string, permissionId: string): Promise<boolean> {
    const rows = await this.context.db.select({ id: rolePermissions.id }).from(rolePermissions).where(and(
      eq(rolePermissions.roleId, roleId),
      eq(rolePermissions.permissionId, permissionId),
    )).limit(1);
    return rows.length > 0;
  }
}

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
