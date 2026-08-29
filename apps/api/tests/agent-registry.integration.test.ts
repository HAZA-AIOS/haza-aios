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

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("DB-11 AI agent registry persistence", () => {
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

  it("persists agent definitions, configuration, and tool assignments through tenant-scoped APIs", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      const created = await registerTenant(baseUrl, `agent-owner-${suffix}@example.com`, `Agent Tenant ${suffix}`);
      const workspaceId = (await readWorkspaces(baseUrl, created.organizationId, created.accessToken))[0].id;

      const templatesResponse = await fetch(`${baseUrl}/api/v1/organizations/${created.organizationId}/agents/templates`, {
        headers: { authorization: `Bearer ${created.accessToken}` },
      });
      const templatesBody = await templatesResponse.json() as { templates: Array<{ id: string; slug: string }> };
      const worksheetTemplate = templatesBody.templates.find((template) => template.slug === "worksheet-creator");

      expect(templatesResponse.status).toBe(200);
      expect(worksheetTemplate).toBeDefined();

      const createResponse = await fetch(`${baseUrl}/api/v1/organizations/${created.organizationId}/agents`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${created.accessToken}` },
        body: JSON.stringify({ workspaceId, templateId: worksheetTemplate?.id }),
      });
      const createBody = await createResponse.json() as { agent: { id: string; agentTemplateId: string; enabled: boolean } };

      expect(createResponse.status, JSON.stringify(createBody)).toBe(201);
      expect(createBody.agent.agentTemplateId).toBe(worksheetTemplate?.id);
      expect(createBody.agent.enabled).toBe(true);

      const duplicateResponse = await fetch(`${baseUrl}/api/v1/organizations/${created.organizationId}/agents`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${created.accessToken}` },
        body: JSON.stringify({ workspaceId, templateId: worksheetTemplate?.id }),
      });
      const duplicateBody = await duplicateResponse.json() as { agent: { id: string } };

      expect(duplicateResponse.status).toBe(201);
      expect(duplicateBody.agent.id).toBe(createBody.agent.id);

      const configResponse = await fetch(`${baseUrl}/api/v1/organizations/${created.organizationId}/agents/${createBody.agent.id}/configuration`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${created.accessToken}` },
        body: JSON.stringify({
          configuration: {
            instructions: { systemInstructions: "Create age-appropriate worksheets.", objectives: "", constraints: "", responseStyle: "" },
            tools: ["curriculum_context"],
            model: { provider: "Platform Default", modelSelection: "Auto", responseQuality: "Balanced", temperature: 0.4, tokenLimits: 2048 },
          },
        }),
      });
      const configBody = await configResponse.json() as { agent: { status: string; configuration: { tools: string[]; instructions: { systemInstructions: string } } } };

      expect(configResponse.status, JSON.stringify(configBody)).toBe(200);
      expect(configBody.agent.status).toBe("configured");
      expect(configBody.agent.configuration.tools).toEqual(["curriculum_context"]);
      expect(configBody.agent.configuration.instructions.systemInstructions).toBe("Create age-appropriate worksheets.");

      const secretResponse = await fetch(`${baseUrl}/api/v1/organizations/${created.organizationId}/agents/${createBody.agent.id}/configuration`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${created.accessToken}` },
        body: JSON.stringify({ configuration: { model: { provider: "Unsafe", modelSelection: "x", apiKey: "should-not-store" } } }),
      });

      expect(secretResponse.status).toBe(400);

      const secondClient = createDatabaseClient(config.database, createLogger(config));
      try {
        const secondServer = createApp(config, logger, secondClient);
        secondServer.listen(0, "127.0.0.1");
        await once(secondServer, "listening");
        const secondBaseUrl = `http://127.0.0.1:${(secondServer.address() as AddressInfo).port}`;
        const readbackResponse = await fetch(`${secondBaseUrl}/api/v1/organizations/${created.organizationId}/agents/${createBody.agent.id}`, {
          headers: { authorization: `Bearer ${created.accessToken}` },
        });
        const readbackBody = await readbackResponse.json() as { agent: { configuration: { tools: string[] } } };

        expect(readbackResponse.status).toBe(200);
        expect(readbackBody.agent.configuration.tools).toEqual(["curriculum_context"]);
        await closeServer(secondServer);
      } finally {
        await secondClient.close();
      }

      const secondTenant = await registerTenant(baseUrl, `agent-second-${suffix}@example.com`, `Agent Second ${suffix}`);
      const foreignRead = await fetch(`${baseUrl}/api/v1/organizations/${secondTenant.organizationId}/agents/${createBody.agent.id}`, {
        headers: { authorization: `Bearer ${created.accessToken}` },
      });
      const foreignWrite = await fetch(`${baseUrl}/api/v1/organizations/${secondTenant.organizationId}/agents/${createBody.agent.id}/configuration`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${created.accessToken}` },
        body: JSON.stringify({ configuration: { tools: [] } }),
      });

      expect(foreignRead.status).toBe(404);
      expect(foreignWrite.status).toBe(404);
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
      lastName: "Owner",
      email,
      password: "password123",
      organizationName,
      industry: "Education",
      organizationType: "School",
      country: "United States",
    }),
  });
  const body = await response.json() as { session: { accessToken: string }; memberships: Array<{ organizationId: string }> };
  expect(response.status).toBe(201);
  return { accessToken: body.session.accessToken, organizationId: body.memberships[0].organizationId };
}

async function readWorkspaces(baseUrl: string, organizationId: string, accessToken: string) {
  const response = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/workspaces`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json() as { workspaces: Array<{ id: string }> };
  expect(response.status).toBe(200);
  return body.workspaces;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}
