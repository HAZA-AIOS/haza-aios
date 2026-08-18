import { migrate } from "drizzle-orm/mysql2/migrator";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { AuthRepository } from "../src/modules/auth/repositories/auth.repository.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { createRepositoryContext } from "../src/database/repositories/repository-context.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("DB-4 auth users sessions and RBAC", () => {
  let config: ApiConfig;
  let database: DatabaseClient;

  beforeAll(async () => {
    config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    });
    database = createDatabaseClient(config.database, createLogger(config));
    await migrateIfNeeded(database);
  });

  afterAll(async () => {
    await database.close();
  });

  it("registers a user with hashed password, organization membership, role, and permissions", async () => {
    const suffix = randomUUID().slice(0, 8);
    const auth = await new AuthService(database).register({
      firstName: "Rbac",
      lastName: "Owner",
      email: `rbac-owner-${suffix}@example.com`,
      password: "password123",
      organizationName: `RBAC Org ${suffix}`,
      organizationType: "School",
      industry: "Education",
      country: "United States",
    });
    const user = await new AuthRepository(createRepositoryContext(database.db)).getUserByEmail(`rbac-owner-${suffix}@example.com`);

    expect(user?.passwordHash).toMatch(/^scrypt\$/);
    expect(user?.passwordHash).not.toContain("password123");
    expect(auth.memberships[0].role).toBe("Owner");
    expect(auth.memberships[0].permissions).toContain("organization.manage");
    expect(auth.memberships[0].permissions).toContain("module.manage");
  });

  it("logs in with correct credentials and rejects wrong credentials generically", async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `login-${suffix}@example.com`;
    await new AuthService(database).register({
      firstName: "Login",
      lastName: "User",
      email,
      password: "password123",
      organizationName: `Login Org ${suffix}`,
      organizationType: "Company",
      industry: "General",
      country: "United States",
    });

    await expect(new AuthService(database).login({ email, password: "password123", rememberMe: false })).resolves.toMatchObject({
      user: { email },
    });
    await expect(new AuthService(database).login({ email, password: "wrong-password", rememberMe: false })).rejects.toMatchObject({
      statusCode: 401,
      code: "INVALID_CREDENTIALS",
    });
  });

  it("persists sessions across reconnect and revokes them on logout", async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `durable-auth-${suffix}@example.com`;
    const auth = await new AuthService(database).register({
      firstName: "Durable",
      lastName: "Session",
      email,
      password: "password123",
      organizationName: `Durable Auth ${suffix}`,
      organizationType: "Company",
      industry: "General",
      country: "United States",
    });
    const secondClient = createDatabaseClient(config.database, createLogger(config));

    try {
      await expect(new AuthService(secondClient).authenticateRequest(makeRequest(auth.session.accessToken))).resolves.toMatchObject({
        user: { email },
      });
      await new AuthService(secondClient).logout(auth.session.accessToken);
      await expect(new AuthService(secondClient).authenticateRequest(makeRequest(auth.session.accessToken))).rejects.toMatchObject({
        statusCode: 401,
      });
    } finally {
      await secondClient.close();
    }
  });

  it("enforces tenant isolation and IDOR protection on platform routes", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      const orgA = await registerViaApi(baseUrl, `tenant-a-${suffix}`);
      const orgB = await registerViaApi(baseUrl, `tenant-b-${suffix}`);

      const denied = await fetch(`${baseUrl}/api/v1/organizations/${orgB.organizationId}/workspaces`, {
        headers: { authorization: `Bearer ${orgA.token}` },
      });
      const deniedBody = await denied.json() as { error: { code: string } };

      expect(denied.status).toBe(404);
      expect(deniedBody.error.code).toBe("NOT_FOUND");

      const allowed = await fetch(`${baseUrl}/api/v1/organizations/${orgA.organizationId}/workspaces`, {
        headers: { authorization: `Bearer ${orgA.token}` },
      });

      expect(allowed.status).toBe(200);
    } finally {
      await closeServer(server);
    }
  });

  it("exposes login, me, and logout API routes", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      const registered = await registerViaApi(baseUrl, `api-auth-${suffix}`);

      const me = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { authorization: `Bearer ${registered.token}` },
      });
      const meBody = await me.json() as { user: { email: string }; memberships: unknown[] };

      expect(me.status).toBe(200);
      expect(meBody.user.email).toBe(`api-auth-${suffix}@example.com`);
      expect(meBody.memberships).toHaveLength(1);

      const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${registered.token}` },
      });
      expect(logout.status).toBe(204);

      const afterLogout = await fetch(`${baseUrl}/api/v1/auth/me`, {
        headers: { authorization: `Bearer ${registered.token}` },
      });
      expect(afterLogout.status).toBe(401);
    } finally {
      await closeServer(server);
    }
  });
});

async function registerViaApi(baseUrl: string, label: string): Promise<{ token: string; organizationId: string }> {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "API",
      lastName: "Auth",
      email: `${label}@example.com`,
      password: "password123",
      organizationName: `Org ${label}`,
      organizationType: "Company",
      industry: "General",
      country: "United States",
    }),
  });
  const body = await response.json() as { session: { accessToken: string }; memberships: Array<{ organizationId: string }> };

  expect(response.status).toBe(201);
  return { token: body.session.accessToken, organizationId: body.memberships[0].organizationId };
}

function makeRequest(token: string) {
  return {
    headers: {
      authorization: `Bearer ${token}`,
    },
    socket: {},
  } as unknown as Parameters<AuthService["authenticateRequest"]>[0];
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

async function migrateIfNeeded(database: DatabaseClient): Promise<void> {
  try {
    await migrate(database.db, { migrationsFolder });
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "ER_TABLE_EXISTS_ERROR") return;
    throw error;
  }
}
