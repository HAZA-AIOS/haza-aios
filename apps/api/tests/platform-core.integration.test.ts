import { migrate } from "drizzle-orm/mysql2/migrator";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { organizations } from "../src/database/schema.js";
import { withTransaction } from "../src/database/transactions.js";
import { OrganizationModuleService } from "../src/modules/platform/services/organization-module.service.js";
import { OrganizationService } from "../src/modules/platform/services/organization.service.js";
import { WorkspaceService } from "../src/modules/platform/services/workspace.service.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("DB-3 platform tenant core", () => {
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

  it("creates an organization with workspace, settings, and owner membership transactionally", async () => {
    const suffix = randomUUID().slice(0, 8);
    const service = new OrganizationService(database);

    const { organization, settings } = await service.createOrganization({
      name: `Acme Health ${suffix}`,
      legalName: `Acme Health ${suffix} LLC`,
      slug: `acme-health-${suffix}`,
      industry: "Healthcare",
      organizationType: "Healthcare Organization",
      email: `owner-${suffix}@example.com`,
      country: "United States",
      timezone: "America/New_York",
      currency: "USD",
      ownerId: `owner-${suffix}`,
      workspaceName: "Clinical Workspace",
      workspaceCode: `clinical-${suffix}`,
    });

    const workspaces = await new WorkspaceService(database).listWorkspaces(organization.id);

    expect(organization.status).toBe("active");
    expect(settings.timezone).toBe("America/New_York");
    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].organizationId).toBe(organization.id);
  });

  it("prevents duplicate organization slugs", async () => {
    const suffix = randomUUID().slice(0, 8);
    const input = {
      name: `Duplicate ${suffix}`,
      slug: `duplicate-${suffix}`,
      industry: "Corporate",
      organizationType: "Company",
      email: `duplicate-${suffix}@example.com`,
      country: "United States",
      ownerId: `owner-${suffix}`,
    };
    const service = new OrganizationService(database);

    await service.createOrganization(input);
    await expect(service.createOrganization({ ...input, ownerId: `owner-2-${suffix}` })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("enforces workspace tenant isolation", async () => {
    const orgA = await createTestOrganization(database, "tenant-a");
    const orgB = await createTestOrganization(database, "tenant-b");
    const workspaceB = (await new WorkspaceService(database).listWorkspaces(orgB.id))[0];

    await expect(new WorkspaceService(database).getWorkspace(orgA.id, workspaceB.id)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("persists module activation per organization", async () => {
    const orgA = await createTestOrganization(database, "module-a");
    const orgB = await createTestOrganization(database, "module-b");
    const service = new OrganizationModuleService(database);

    const enabled = await service.enableModule({
      organizationId: orgA.id,
      moduleKey: "education-sis",
      activatedBy: "db3-test",
    });
    const orgAModules = await service.listModules(orgA.id);
    const orgBModules = await service.listModules(orgB.id);

    expect(enabled.enabled).toBe(true);
    expect(orgAModules.some((item) => item.catalog.key === "education-sis" && item.state?.enabled)).toBe(true);
    expect(orgBModules.some((item) => item.catalog.key === "education-sis" && item.state?.enabled)).toBe(false);

    const disabled = await service.disableModule(orgA.id, "education-sis");
    expect(disabled.enabled).toBe(false);
    expect(disabled.status).toBe("deactivated");
  });

  it("persists platform module catalog and protects duplicate activation/configuration", async () => {
    const orgA = await createTestOrganization(database, "module-db10-a");
    const service = new OrganizationModuleService(database);

    const catalog = await service.listCatalog();
    expect(catalog.map((module) => module.key)).toEqual(expect.arrayContaining(["education-sis", "demo-analytics"]));

    const first = await service.enableModule({
      organizationId: orgA.id,
      moduleKey: "education-sis",
      activatedBy: "db10-test",
      settings: { defaultView: "dashboard" },
    });
    const second = await service.enableModule({
      organizationId: orgA.id,
      moduleKey: "education-sis",
      activatedBy: "db10-test",
      settings: { defaultView: "reports" },
    });
    const configured = await service.updateConfiguration({
      organizationId: orgA.id,
      moduleKey: "education-sis",
      settings: { analyticsEnabled: true },
      activatedBy: "db10-test",
    });
    const orgModules = await service.listModules(orgA.id);
    const education = orgModules.find((item) => item.catalog.key === "education-sis");

    expect(second.id).toBe(first.id);
    expect(configured.settings).toMatchObject({ defaultView: "reports", analyticsEnabled: true });
    expect(education?.state?.id).toBe(first.id);
    expect(orgModules.filter((item) => item.catalog.key === "education-sis" && item.state)).toHaveLength(1);
  });

  it("rolls back tenant records when a transaction fails", async () => {
    const id = randomUUID();

    await expect(withTransaction(database, async ({ tx }) => {
      await tx.insert(organizations).values({
        id,
        name: "Rollback Tenant",
        legalName: "Rollback Tenant LLC",
        slug: `rollback-${randomUUID().slice(0, 8)}`,
        industry: "Corporate",
        organizationType: "Company",
        email: "rollback@example.com",
        country: "United States",
        ownerId: "rollback-owner",
      });
      throw new Error("rollback");
    })).rejects.toThrow("Database operation failed.");

    const rows = await database.db.select().from(organizations).where(eq(organizations.id, id));

    expect(rows).toHaveLength(0);
  });

  it("persists organization records across database client reconnect", async () => {
    const organization = await createTestOrganization(database, "durable");
    const secondClient = createDatabaseClient(config.database, createLogger(config));

    try {
      const reloaded = await new OrganizationService(secondClient).getOrganization(organization.id);
      expect(reloaded.slug).toBe(organization.slug);
    } finally {
      await secondClient.close();
    }
  });

  it("exposes organization, workspace, and module APIs with safe tenant scoping", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      const createResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": `db3-${suffix}` },
        body: JSON.stringify({
          firstName: "API",
          lastName: "Owner",
          email: `api-owner-${suffix}@example.com`,
          password: "password123",
          organizationName: `API Tenant ${suffix}`,
          industry: "Government",
          organizationType: "Government Organization",
          country: "United States",
        }),
      });
      const created = await createResponse.json() as { session: { accessToken: string }; memberships: Array<{ organizationId: string }> };
      const organizationId = created.memberships[0].organizationId;

      expect(createResponse.status).toBe(201);
      expect(createResponse.headers.get("x-request-id")).toBe(`db3-${suffix}`);

      const workspacesResponse = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/workspaces`, {
        headers: { authorization: `Bearer ${created.session.accessToken}` },
      });
      const workspacesBody = await workspacesResponse.json() as { workspaces: Array<{ id: string; organizationId: string }> };

      expect(workspacesResponse.status).toBe(200);
      expect(workspacesBody.workspaces[0].organizationId).toBe(organizationId);

      const moduleResponse = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/modules`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${created.session.accessToken}` },
        body: JSON.stringify({ moduleKey: "demo-analytics", activatedBy: "api-test" }),
      });
      const moduleBody = await moduleResponse.json() as { module: { moduleKey: string; enabled: boolean } };

      expect(moduleResponse.status).toBe(201);
      expect(moduleBody.module).toMatchObject({ moduleKey: "demo-analytics", enabled: true });

      const catalogResponse = await fetch(`${baseUrl}/api/v1/modules`, {
        headers: { authorization: `Bearer ${created.session.accessToken}` },
      });
      const catalogBody = await catalogResponse.json() as { modules: Array<{ key: string }> };

      expect(catalogResponse.status).toBe(200);
      expect(catalogBody.modules.map((item) => item.key)).toContain("education-sis");

      const configResponse = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/modules/demo-analytics/config`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${created.session.accessToken}` },
        body: JSON.stringify({ settings: { pinned: true } }),
      });
      const configBody = await configResponse.json() as { module: { settings: { pinned: boolean } } };

      expect(configResponse.status).toBe(200);
      expect(configBody.module.settings.pinned).toBe(true);

      const secondCreateResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": `db10-${suffix}` },
        body: JSON.stringify({
          firstName: "API",
          lastName: "Second",
          email: `api-second-${suffix}@example.com`,
          password: "password123",
          organizationName: `API Second ${suffix}`,
          industry: "Education",
          organizationType: "School",
          country: "United States",
        }),
      });
      const secondCreated = await secondCreateResponse.json() as { session: { accessToken: string }; memberships: Array<{ organizationId: string }> };
      const forbiddenResponse = await fetch(`${baseUrl}/api/v1/organizations/${secondCreated.memberships[0].organizationId}/modules`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${created.session.accessToken}` },
        body: JSON.stringify({ moduleKey: "education-sis" }),
      });

      expect(secondCreateResponse.status).toBe(201);
      expect(forbiddenResponse.status).toBe(404);

      const invalidResponse = await fetch(`${baseUrl}/api/v1/organizations/not-a-uuid`);
      const invalidBody = await invalidResponse.json() as { error: { code: string } };

      expect(invalidResponse.status).toBe(400);
      expect(invalidBody.error.code).toBe("VALIDATION_FAILED");
    } finally {
      await closeServer(server);
    }
  });
});

async function createTestOrganization(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const result = await new OrganizationService(database).createOrganization({
    name: `${label} ${suffix}`,
    slug: `${label}-${suffix}`,
    industry: "Corporate",
    organizationType: "Company",
    email: `${label}-${suffix}@example.com`,
    country: "United States",
    ownerId: `${label}-owner-${suffix}`,
  });

  return result.organization;
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
