import { migrate } from "../src/database/mysql94-migrator.js";
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

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("Epic 11 — AI Agent Platform Foundation Integration", () => {
  let config: ApiConfig;
  let database: DatabaseClient;

  beforeAll(async () => {
    config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    });
    database = createDatabaseClient(config.database, createLogger(config));
    await migrate(database.db, { migrationsFolder });
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("enforces tenant-scoped CRUD, lifecycle transitions (including suspended), audit logging, approval policies, and provider catalog", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      // 1. Register Primary Tenant (Tenant A)
      const tenantA = await registerTenant(baseUrl, `epic11-owner-${suffix}@example.com`, `Epic11 Org ${suffix}`);
      const workspaceIdA = (await readWorkspaces(baseUrl, tenantA.organizationId, tenantA.accessToken))[0].id;

      // 2. Query AI Providers Catalog
      const providersRes = await fetch(`${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/providers`, {
        headers: { authorization: `Bearer ${tenantA.accessToken}` },
      });
      expect(providersRes.status).toBe(200);
      const providersBody = (await providersRes.json()) as {
        providers: Array<{ id: string; name: string; isDefault: boolean; models: Array<{ id: string }> }>;
      };
      expect(providersBody.providers.some((p) => p.id === "mock")).toBe(true);
      const mockProvider = providersBody.providers.find((p) => p.id === "mock");
      expect(mockProvider?.models.some((m) => m.id === "mock-gpt-4o")).toBe(true);

      // 3. List Templates with Pagination & Category Filtering
      const templatesRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/templates?category=Education&page=1&pageSize=10`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(templatesRes.status).toBe(200);
      const templatesBody = (await templatesRes.json()) as {
        templates: Array<{ id: string; slug: string; name: string; defaultApprovalPolicy?: any }>;
        total: number;
        page: number;
      };
      expect(templatesBody.templates.length).toBeGreaterThanOrEqual(1);
      const worksheetTemplate = templatesBody.templates.find((t) => t.slug === "worksheet-creator");
      expect(worksheetTemplate).toBeDefined();

      // 4. Create Agent Instance with Custom Human Approval Policy & Model Selection
      const createRes = await fetch(`${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tenantA.accessToken}` },
        body: JSON.stringify({
          workspaceId: workspaceIdA,
          templateId: worksheetTemplate?.id,
          name: "Elementary Science Quiz Master",
          modelProvider: "mock",
          modelSelection: "mock-gpt-4o",
          humanApprovalPolicy: {
            required: true,
            approverRoles: ["owner", "admin", "lead_teacher"],
            escalationTimeoutHours: 48,
            fallbackAction: "deny",
            sensitiveCapabilities: ["publish"],
          },
        }),
      });
      expect(createRes.status).toBe(201);
      const createBody = (await createRes.json()) as {
        agent: {
          id: string;
          name: string;
          status: string;
          humanApprovalPolicy: { required: boolean; approverRoles: string[] };
          modelProvider: string;
          modelSelection: string;
        };
      };
      const agentId = createBody.agent.id;
      expect(createBody.agent.name).toBe("Elementary Science Quiz Master");
      expect(createBody.agent.status).toBe("active");
      expect(createBody.agent.humanApprovalPolicy.required).toBe(true);
      expect(createBody.agent.humanApprovalPolicy.approverRoles).toContain("lead_teacher");
      expect(createBody.agent.modelProvider).toBe("mock");

      // 5. Update Agent Configuration
      const updateConfigRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/configuration`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${tenantA.accessToken}` },
          body: JSON.stringify({
            configuration: {
              instructions: { systemInstructions: "Focus strictly on grade 5 biology." },
              model: { provider: "mock", modelSelection: "mock-gpt-4o" },
            },
          }),
        },
      );
      expect(updateConfigRes.status).toBe(200);
      const updateConfigBody = (await updateConfigRes.json()) as { agent: { status: string; instructions: string } };
      expect(updateConfigBody.agent.status).toBe("configured");
      expect(updateConfigBody.agent.instructions).toBe("Focus strictly on grade 5 biology.");

      // 6. Test Lifecycle State Transitions (including SUSPENDED)
      // Transition: configured -> suspended
      const suspendRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${tenantA.accessToken}` },
          body: JSON.stringify({ status: "suspended" }),
        },
      );
      expect(suspendRes.status).toBe(200);
      const suspendBody = (await suspendRes.json()) as { agent: { status: string; enabled: boolean } };
      expect(suspendBody.agent.status).toBe("suspended");
      expect(suspendBody.agent.enabled).toBe(false);

      // Transition: suspended -> active
      const resumeRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${tenantA.accessToken}` },
          body: JSON.stringify({ status: "active" }),
        },
      );
      expect(resumeRes.status).toBe(200);
      const resumeBody = (await resumeRes.json()) as { agent: { status: string; enabled: boolean } };
      expect(resumeBody.agent.status).toBe("active");
      expect(resumeBody.agent.enabled).toBe(true);

      // Transition: active -> paused
      const pauseRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${tenantA.accessToken}` },
          body: JSON.stringify({ status: "paused" }),
        },
      );
      expect(pauseRes.status).toBe(200);
      const pauseBody = (await pauseRes.json()) as { agent: { status: string; enabled: boolean } };
      expect(pauseBody.agent.status).toBe("paused");
      expect(pauseBody.agent.enabled).toBe(false);

      // Transition: paused -> archived
      const archiveRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${tenantA.accessToken}` },
          body: JSON.stringify({ status: "archived" }),
        },
      );
      expect(archiveRes.status).toBe(200);
      const archiveBody = (await archiveRes.json()) as { agent: { status: string } };
      expect(archiveBody.agent.status).toBe("archived");

      // Verify archived agent rejects configuration updates
      const blockedUpdate = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/configuration`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${tenantA.accessToken}` },
          body: JSON.stringify({ configuration: { instructions: { systemInstructions: "Disallowed" } } }),
        },
      );
      expect(blockedUpdate.status).toBe(400);

      // 7. Verify Audit History
      const auditRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agentId}/audit-history`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(auditRes.status).toBe(200);
      const auditBody = (await auditRes.json()) as {
        items: Array<{
          id: string;
          action: string;
          operation: string;
          result: string;
          changedFields: string[];
        }>;
        total: number;
      };
      expect(auditBody.items.length).toBeGreaterThanOrEqual(4);
      const actions = auditBody.items.map((i) => i.action);
      expect(actions).toContain("agent.create");
      expect(actions).toContain("agent.update_configuration");
      expect(actions).toContain("agent.status_change");

      // 8. List Tenant Agents with Status Filter
      const listFilteredRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents?status=archived`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(listFilteredRes.status).toBe(200);
      const listFilteredBody = (await listFilteredRes.json()) as { agents: Array<{ id: string; status: string }> };
      expect(listFilteredBody.agents.some((a) => a.id === agentId)).toBe(true);

      // 9. Tenant Isolation Verification
      const tenantB = await registerTenant(baseUrl, `epic11-intruder-${suffix}@example.com`, `Intruder Org ${suffix}`);

      // Tenant B read Tenant A's agent -> 404
      const foreignRead = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/${agentId}`,
        { headers: { authorization: `Bearer ${tenantB.accessToken}` } },
      );
      expect(foreignRead.status).toBe(404);

      // Tenant B update Tenant A's agent status -> 404
      const foreignStatusUpdate = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/${agentId}/status`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${tenantB.accessToken}` },
          body: JSON.stringify({ status: "active" }),
        },
      );
      expect(foreignStatusUpdate.status).toBe(404);

      // Tenant B read Tenant A's audit history -> 404
      const foreignAudit = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/${agentId}/audit-history`,
        { headers: { authorization: `Bearer ${tenantB.accessToken}` } },
      );
      expect(foreignAudit.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });
});

async function registerTenant(baseUrl: string, email: string, organizationName: string) {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Agent",
      lastName: "Platform",
      email,
      password: "password123",
      organizationName,
      industry: "Education",
      organizationType: "School",
      country: "United States",
    }),
  });
  const body = (await response.json()) as {
    session: { accessToken: string };
    memberships: Array<{ organizationId: string }>;
  };
  expect(response.status).toBe(201);
  return { accessToken: body.session.accessToken, organizationId: body.memberships[0].organizationId };
}

async function readWorkspaces(baseUrl: string, organizationId: string, accessToken: string) {
  const response = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/workspaces`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { workspaces: Array<{ id: string }> };
  expect(response.status).toBe(200);
  return body.workspaces;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}
