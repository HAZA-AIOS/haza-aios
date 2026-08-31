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

describeDatabase("DB-12 agent runtime persistence", () => {
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

  it("persists runs, conversations, ordered messages, and scoped history", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      const owner = await registerTenant(
        baseUrl,
        `runtime-owner-${suffix}@example.com`,
        `Runtime Tenant ${suffix}`,
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

      const createRunResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agents/${agent.id}/runs`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${owner.accessToken}`,
          },
          body: JSON.stringify({
            input: "Create a fractions worksheet",
            executionMode: "manual",
            metadata: { client: "vitest" },
          }),
        },
      );
      const createRunBody = (await createRunResponse.json()) as {
        run: {
          id: string;
          status: string;
          conversationId: string;
          metadata: Record<string, unknown>;
        };
      };

      expect(createRunResponse.status, JSON.stringify(createRunBody)).toBe(201);
      expect(createRunBody.run.status).toBe("queued");
      expect(createRunBody.run.conversationId).toBeDefined();
      expect(createRunBody.run.metadata.userMessagePersisted).toBe(true);

      const runningResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agent-runs/${createRunBody.run.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${owner.accessToken}`,
          },
          body: JSON.stringify({ status: "running", metadata: { stage: "model" } }),
        },
      );
      expect(runningResponse.status).toBe(200);

      const completeResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agent-runs/${createRunBody.run.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${owner.accessToken}`,
          },
          body: JSON.stringify({ status: "completed", output: "Worksheet ready", duration: 25 }),
        },
      );
      const completeBody = (await completeResponse.json()) as {
        run: { status: string; output: string; duration: number };
      };
      expect(completeResponse.status, JSON.stringify(completeBody)).toBe(200);
      expect(completeBody.run.status).toBe("completed");
      expect(completeBody.run.output).toBe("Worksheet ready");
      expect(completeBody.run.duration).toBe(25);

      const messagesResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agent-conversations/${createRunBody.run.conversationId}/messages`,
        {
          headers: { authorization: `Bearer ${owner.accessToken}` },
        },
      );
      const messagesBody = (await messagesResponse.json()) as {
        messages: Array<{ role: string; content: string; sequence: number }>;
      };
      expect(messagesResponse.status).toBe(200);
      expect(messagesBody.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
      expect(messagesBody.messages.map((message) => message.sequence)).toEqual([1, 2]);

      const secondClient = createDatabaseClient(config.database, createLogger(config));
      try {
        const secondServer = createApp(config, logger, secondClient);
        secondServer.listen(0, "127.0.0.1");
        await once(secondServer, "listening");
        const secondBaseUrl = `http://127.0.0.1:${(secondServer.address() as AddressInfo).port}`;
        const persistedMessagesResponse = await fetch(
          `${secondBaseUrl}/api/v1/organizations/${owner.organizationId}/agent-conversations/${createRunBody.run.conversationId}/messages`,
          {
            headers: { authorization: `Bearer ${owner.accessToken}` },
          },
        );
        const persistedMessages = (await persistedMessagesResponse.json()) as {
          messages: unknown[];
        };
        expect(persistedMessagesResponse.status).toBe(200);
        expect(persistedMessages.messages).toHaveLength(2);
        await closeServer(secondServer);
      } finally {
        await secondClient.close();
      }

      const failedRunResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agents/${agent.id}/runs`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${owner.accessToken}`,
          },
          body: JSON.stringify({ input: "Trigger failure" }),
        },
      );
      const failedRunBody = (await failedRunResponse.json()) as { run: { id: string } };
      const failureResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agent-runs/${failedRunBody.run.id}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${owner.accessToken}`,
          },
          body: JSON.stringify({
            status: "failed",
            error: "Provider failed with authorization: bearer should-not-leak",
          }),
        },
      );
      const failureBody = (await failureResponse.json()) as {
        run: { status: string; error: string };
      };
      expect(failureResponse.status, JSON.stringify(failureBody)).toBe(200);
      expect(failureBody.run.status).toBe("failed");
      expect(failureBody.run.error).not.toContain("should-not-leak");

      const listRunsResponse = await fetch(
        `${baseUrl}/api/v1/organizations/${owner.organizationId}/agents/${agent.id}/runs?limit=1`,
        {
          headers: { authorization: `Bearer ${owner.accessToken}` },
        },
      );
      const listRunsBody = (await listRunsResponse.json()) as { runs: unknown[] };
      expect(listRunsResponse.status).toBe(200);
      expect(listRunsBody.runs).toHaveLength(1);

      const foreign = await registerTenant(
        baseUrl,
        `runtime-foreign-${suffix}@example.com`,
        `Runtime Foreign ${suffix}`,
      );
      const foreignMessages = await fetch(
        `${baseUrl}/api/v1/organizations/${foreign.organizationId}/agent-conversations/${createRunBody.run.conversationId}/messages`,
        {
          headers: { authorization: `Bearer ${owner.accessToken}` },
        },
      );
      const foreignRun = await fetch(
        `${baseUrl}/api/v1/organizations/${foreign.organizationId}/agent-runs/${createRunBody.run.id}`,
        {
          headers: { authorization: `Bearer ${owner.accessToken}` },
        },
      );
      expect(foreignMessages.status).toBe(404);
      expect(foreignRun.status).toBe(404);
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
      firstName: "Runtime",
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

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}
