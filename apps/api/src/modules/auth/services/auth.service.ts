import type { IncomingMessage } from "node:http";
import { ApiError } from "../../../common/errors/api-error.js";
import type { DatabaseClient } from "../../../database/client.js";
import { mapDatabaseError } from "../../../database/errors.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { withTransaction } from "../../../database/transactions.js";
import { OrganizationRepository } from "../../platform/repositories/organization.repository.js";
import { generateSlug } from "../../platform/validation/platform-validation.js";
import type { AuthContext, AuthResult, LoginInput, PermissionKey, RegisterInput, SafeUser } from "../auth.types.js";
import { AuthRepository, toSafeUser } from "../repositories/auth.repository.js";
import { normalizeEmail } from "../validation/auth-validation.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import { createSessionToken, hashSessionToken, sessionCookieName } from "./token.service.js";

const ownerPermissions: PermissionKey[] = [
  "organization.read",
  "organization.manage",
  "workspace.read",
  "workspace.manage",
  "module.read",
  "module.manage",
  "agent.read",
  "agent.manage",
  "member.read",
  "member.manage",
];

const adminPermissions: PermissionKey[] = [
  "organization.read",
  "workspace.read",
  "workspace.manage",
  "module.read",
  "module.manage",
  "agent.read",
  "agent.manage",
  "member.read",
  "member.manage",
];

const memberPermissions: PermissionKey[] = [
  "organization.read",
  "workspace.read",
  "module.read",
  "agent.read",
  "member.read",
];

export class AuthService {
  constructor(private readonly database: DatabaseClient) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    return withTransaction(this.database, async ({ tx }) => {
      const context = createRepositoryContext(tx);
      const authRepository = new AuthRepository(context);
      const organizationRepository = new OrganizationRepository(context);
      const user = await authRepository.createUser({
        ...input,
        email: normalizeEmail(input.email),
        passwordHash: await hashPassword(input.password),
      });
      const organization = await organizationRepository.create({
        name: input.organizationName,
        legalName: input.organizationName,
        slug: generateSlug(input.organizationName),
        industry: input.industry,
        organizationType: input.organizationType,
        email: input.organizationEmail ?? input.email,
        country: input.country,
        ownerId: user.id,
        workspaceName: `${input.organizationName} Workspace`,
        workspaceCode: generateSlug(input.organizationName),
      });
      const bootstrap = await organizationRepository.createBootstrapRecords({
        organizationId: organization.id,
        ownerId: user.id,
        workspaceName: `${organization.name} Workspace`,
        workspaceCode: generateSlug(organization.name),
        timezone: organization.timezone,
        currency: organization.currency,
      });

      await this.ensureOrganizationRoles(authRepository, organization.id);
      const ownerRoleId = await authRepository.ensureRole({
        organizationId: organization.id,
        name: "Owner",
        scope: "organization",
        description: "Organization owner role.",
        permissionKeys: ownerPermissions,
      });
      await authRepository.assignRoleToMembership(bootstrap.membershipId, ownerRoleId);
      await authRepository.createWorkspaceMembership(bootstrap.workspaceId, bootstrap.membershipId);
      await authRepository.recordSecurityEvent({ userId: user.id, organizationId: organization.id, eventType: "auth.register" });

      return this.issueSession(authRepository, toSafeUser(user), false);
    }).catch((error: unknown) => {
      const mapped = mapDatabaseError(error);
      if (mapped.code === "DATABASE_UNIQUE_CONSTRAINT") {
        throw new ApiError(409, "DATABASE_UNIQUE_CONSTRAINT", "User or organization already exists.");
      }
      throw error;
    });
  }

  async login(input: LoginInput, request?: IncomingMessage): Promise<AuthResult> {
    const repository = new AuthRepository(createRepositoryContext(this.database.db));
    const user = await repository.getUserByEmail(input.email);

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      await repository.recordSecurityEvent({
        eventType: "login.failed",
        severity: "warning",
        ipAddress: readIpAddress(request),
        userAgent: readUserAgent(request),
        metadata: { email: normalizeEmail(input.email) },
      });
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    if (user.status !== "active") {
      await repository.recordSecurityEvent({
        userId: user.id,
        eventType: "login.blocked",
        severity: "warning",
        ipAddress: readIpAddress(request),
        userAgent: readUserAgent(request),
        metadata: { status: user.status },
      });
      throw new ApiError(403, "USER_NOT_ACTIVE", "Account is not active.");
    }

    await repository.touchLastLogin(user.id);
    await repository.recordSecurityEvent({
      userId: user.id,
      eventType: "login.success",
      ipAddress: readIpAddress(request),
      userAgent: readUserAgent(request),
    });

    return this.issueSession(repository, toSafeUser(user), input.rememberMe);
  }

  async logout(token: string | null): Promise<void> {
    if (!token) return;
    const repository = new AuthRepository(createRepositoryContext(this.database.db));
    await repository.revokeSessionByHash(hashSessionToken(token));
    await repository.recordSecurityEvent({ eventType: "logout" });
  }

  async authenticateRequest(request: IncomingMessage): Promise<AuthContext> {
    const token = readBearerToken(request) ?? readCookie(request, sessionCookieName);

    if (!token) {
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    const repository = new AuthRepository(createRepositoryContext(this.database.db));
    const session = await repository.getActiveSessionByHash(hashSessionToken(token));

    if (!session) {
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    const user = await repository.getUserById(session.userId);

    if (!user || user.status !== "active") {
      throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
    }

    return {
      user: toSafeUser(user),
      session,
      memberships: await repository.getMembershipsWithPermissions(user.id),
      platformPermissions: await repository.getPlatformPermissions(user.id),
    };
  }

  async requireOrganizationPermission(request: IncomingMessage, organizationId: string, permission: PermissionKey): Promise<AuthContext> {
    const auth = await this.authenticateRequest(request);
    const membership = auth.memberships.find((item) => item.organizationId === organizationId && item.status === "active");

    if (!membership) {
      throw new ApiError(404, "NOT_FOUND", "Organization not found.");
    }

    if (!membership.permissions.includes(permission)) {
      throw new ApiError(403, "FORBIDDEN", "Permission denied.");
    }

    return auth;
  }

  async createOrganizationForUser(user: SafeUser, input: {
    name: string;
    legalName?: string;
    slug?: string;
    industry: string;
    organizationType: string;
    email: string;
    country: string;
    description?: string;
    website?: string;
    phone?: string;
    timezone?: string;
    currency?: string;
    workspaceName?: string;
    workspaceCode?: string;
  }) {
    return withTransaction(this.database, async ({ tx }) => {
      const context = createRepositoryContext(tx);
      const organizationRepository = new OrganizationRepository(context);
      const authRepository = new AuthRepository(context);
      const organization = await organizationRepository.create({ ...input, ownerId: user.id });
      const bootstrap = await organizationRepository.createBootstrapRecords({
        organizationId: organization.id,
        ownerId: user.id,
        workspaceName: input.workspaceName ?? `${organization.name} Workspace`,
        workspaceCode: input.workspaceCode ?? generateSlug(input.workspaceName ?? organization.name),
        timezone: organization.timezone,
        currency: organization.currency,
      });
      await this.ensureOrganizationRoles(authRepository, organization.id);
      const ownerRoleId = await authRepository.ensureRole({
        organizationId: organization.id,
        name: "Owner",
        scope: "organization",
        description: "Organization owner role.",
        permissionKeys: ownerPermissions,
      });
      await authRepository.assignRoleToMembership(bootstrap.membershipId, ownerRoleId);
      await authRepository.createWorkspaceMembership(bootstrap.workspaceId, bootstrap.membershipId);
      return { organization, bootstrap };
    });
  }

  private async issueSession(repository: AuthRepository, user: SafeUser, rememberMe: boolean): Promise<AuthResult> {
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + (rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 8));
    const session = await repository.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt,
      rememberMe,
    });

    return {
      user,
      session: {
        id: session.id,
        userId: session.userId,
        accessToken: token,
        expiresAt: session.expiresAt.toISOString(),
        rememberMe: session.rememberMe,
      },
      memberships: await repository.getMembershipsWithPermissions(user.id),
    };
  }

  private async ensureOrganizationRoles(repository: AuthRepository, organizationId: string): Promise<void> {
    await repository.ensureRole({
      organizationId,
      name: "Owner",
      scope: "organization",
      description: "Organization owner role.",
      permissionKeys: ownerPermissions,
    });
    await repository.ensureRole({
      organizationId,
      name: "Admin",
      scope: "organization",
      description: "Organization administrator role.",
      permissionKeys: adminPermissions,
    });
    await repository.ensureRole({
      organizationId,
      name: "Member",
      scope: "organization",
      description: "Organization member role.",
      permissionKeys: memberPermissions,
    });
  }
}

export function readBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length).trim() || null;
}

export function readCookie(request: IncomingMessage, name: string): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

function readIpAddress(request?: IncomingMessage): string | undefined {
  const forwarded = request?.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return request?.socket.remoteAddress;
}

function readUserAgent(request?: IncomingMessage): string | undefined {
  const userAgent = request?.headers["user-agent"];
  return typeof userAgent === "string" ? userAgent : undefined;
}
