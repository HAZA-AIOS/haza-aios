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

describeDatabase("DB-13 agent memory persistence", () => {
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
  }, 60_000);

  afterAll(async () => {
    await database.close();
  });

  it("persists long-term memory with source traceability, privacy, and forget behavior", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      const owner = await registerTenant(
        baseUrl,
        `memory-owner-${suffix}@example.com`,
        `Memory Tenant ${suffix}`,
      );
      const workspaceId = (
        await readWorkspaces(baseUrl, owner.organizationId, owner.accessToken)
      )[0].id;
      const agent = await createWorksheetAgent(
        baseUrl,
        owner.organizationId,
        workspaceId,
        owner.accessToken,
      );
      const source = await createCompletedRun(
        baseUrl,
        owner.organizationId,
        agent.id,
        owner.accessToken,
      );

      const createMemoryResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agents/${agent.id}/memories`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${owner.accessToken}`,
          },
          body: JSON.stringify({
            scope: "user",
            type: "preference",
            content: "Prefers concise worksheets with answer keys.",
            source: "explicit_instruction",
            sourceRunId: source.runId,
            sourceConversationId: source.conversationId,
            sourceMessageId: source.userMessageId,
            importance: 8,
            metadata: { test: "db13" },
          }),
        },
      );
      const createMemoryBody = (await createMemoryResponse.json()) as {
        memory: {
          id: string;
          status: string;
          sourceRunId: string;
          sourceConversationId: string;
          sourceMessageId: string;
        };
      };
      expect(createMemoryResponse.status, JSON.stringify(createMemoryBody)).toBe(201);
      expect(createMemoryBody.memory.status).toBe("active");
      expect(createMemoryBody.memory.sourceRunId).toBe(source.runId);
      expect(createMemoryBody.memory.sourceConversationId).toBe(source.conversationId);
      expect(createMemoryBody.memory.sourceMessageId).toBe(source.userMessageId);

      const secretResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agents/${agent.id}/memories`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${owner.accessToken}`,
          },
          body: JSON.stringify({ content: "password: never-store-this", type: "fact" }),
        },
      );
      expect(secretResponse.status).toBe(400);

      const listResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agents/${agent.id}/memories?limit=10&conversationId=${source.conversationId}`,
        { headers: { authorization: `Bearer ${owner.accessToken}` } },
      );
      const listBody = (await listResponse.json()) as {
        memories: Array<{ id: string; content: string; usageCount: number }>;
      };
      expect(listResponse.status).toBe(200);
      expect(listBody.memories.some((memory) => memory.id === createMemoryBody.memory.id)).toBe(
        true,
      );

      const secondClient = createDatabaseClient(config.database, createLogger(config));
      try {
        const secondServer = createApp(config, logger, secondClient);
        secondServer.listen(0, "127.0.0.1");
        await once(secondServer, "listening");
        const secondBaseUrl = `http://127.0.0.1:${(secondServer.address() as AddressInfo).port}`;
        const persistedResponse = await fetch(
          `${secondBaseUrl}/api/v1/organizations/${owner.organizationId}/agents/${agent.id}/memories?limit=10&conversationId=${source.conversationId}`,
          { headers: { authorization: `Bearer ${owner.accessToken}` } },
        );
        const persistedBody = (await persistedResponse.json()) as {
          memories: Array<{ id: string }>;
        };
        expect(persistedResponse.status).toBe(200);
        expect(
          persistedBody.memories.some((memory) => memory.id === createMemoryBody.memory.id),
        ).toBe(true);
        await closeServer(secondServer);
      } finally {
        await secondClient.close();
      }

      const updateResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agent-memories/${createMemoryBody.memory.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${owner.accessToken}`,
          },
          body: JSON.stringify({
            content: "Prefers concise worksheets with worked answers.",
            importance: 9,
          }),
        },
      );
      const updateBody = (await updateResponse.json()) as {
        memory: { content: string; importance: number };
      };
      expect(updateResponse.status, JSON.stringify(updateBody)).toBe(200);
      expect(updateBody.memory.content).toContain("worked answers");
      expect(updateBody.memory.importance).toBe(9);

      const foreign = await registerTenant(
        baseUrl,
        `memory-foreign-${suffix}@example.com`,
        `Memory Foreign ${suffix}`,
      );
      const foreignAccess = await fetch(
        `${baseUrl}/api/v1/organizations/${foreign.organizationId}/agent-memories/${createMemoryBody.memory.id}`,
        { headers: { authorization: `Bearer ${owner.accessToken}` } },
      );
      expect(foreignAccess.status).toBe(404);

      const deleteResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agent-memories/${createMemoryBody.memory.id}`,
        { method: "DELETE", headers: { authorization: `Bearer ${owner.accessToken}` } },
      );
      const deleteBody = (await deleteResponse.json()) as { memory: { status: string } };
      expect(deleteResponse.status, JSON.stringify(deleteBody)).toBe(200);
      expect(deleteBody.memory.status).toBe("deleted");

      const afterDeleteResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agents/${agent.id}/memories`,
        { headers: { authorization: `Bearer ${owner.accessToken}` } },
      );
      const afterDeleteBody = (await afterDeleteResponse.json()) as {
        memories: Array<{ id: string }>;
      };
      expect(afterDeleteResponse.status).toBe(200);
      expect(
        afterDeleteBody.memories.some((memory) => memory.id === createMemoryBody.memory.id),
      ).toBe(false);
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
      firstName: "Memory",
      lastName: "Owner",
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
  return {
    accessToken: body.session.accessToken,
    organizationId: body.memberships[0].organizationId,
  };
}

async function readWorkspaces(baseUrl: string, organizationId: string, accessToken: string) {
  const response = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/workspaces`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { workspaces: Array<{ id: string }> };
  expect(response.status).toBe(200);
  return body.workspaces;
}

async function createWorksheetAgent(
  baseUrl: string,
  organizationId: string,
  workspaceId: string,
  accessToken: string,
) {
  const templatesResponse = await fetch(
    `${baseUrl}/api/v1/organizations/${organizationId}/agents/templates`,
    {
      headers: { authorization: `Bearer ${accessToken}` },
    },
  );
  const templatesBody = (await templatesResponse.json()) as {
    templates: Array<{ id: string; slug: string }>;
  };
  const template = templatesBody.templates.find((item) => item.slug === "worksheet-creator");
  expect(template).toBeDefined();

  const createResponse = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/agents`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ workspaceId, templateId: template?.id }),
  });
  const createBody = (await createResponse.json()) as { agent: { id: string } };
  expect(createResponse.status).toBe(201);
  return createBody.agent;
}

async function createCompletedRun(
  baseUrl: string,
  organizationId: string,
  agentId: string,
  accessToken: string,
) {
  const createRunResponse = await fetch(
    `${baseUrl}/api/v1/organizations/${organizationId}/agents/${agentId}/runs`,
    {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        input: "Remember that concise worksheets are preferred.",
        executionMode: "manual",
      }),
    },
  );
  const createRunBody = (await createRunResponse.json()) as {
    run: { id: string; conversationId: string };
    userMessage: { id: string };
  };
  expect(createRunResponse.status).toBe(201);

  const completeResponse = await fetch(
    `${baseUrl}/api/v1/organizations/${organizationId}/agent-runs/${createRunBody.run.id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        status: "completed",
        output: "Stored preference acknowledged.",
        duration: 18,
      }),
    },
  );
  expect(completeResponse.status).toBe(200);
  return {
    runId: createRunBody.run.id,
    conversationId: createRunBody.run.conversationId,
    userMessageId: createRunBody.userMessage.id,
  };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}
