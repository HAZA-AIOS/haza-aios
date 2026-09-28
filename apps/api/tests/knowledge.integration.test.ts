import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { resolve } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { migrate } from "../src/database/mysql94-migrator.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/common/logging/logger.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";

const integration = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;

integration("DB-14 persistent knowledge", () => {
  let database: DatabaseClient;
  let server: Server;
  let base: string;
  beforeAll(async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      TEST_DATABASE_NAME: process.env.TEST_DATABASE_NAME ?? "haza_aios_test",
      LOG_LEVEL: "error",
    });
    database = createDatabaseClient(config.database, createLogger(config));
    await migrate(database.db, { migrationsFolder: resolve("src/database/migrations") });
    server = createApp(config, createLogger(config), database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);
  afterAll(async () => {
    if (server?.listening) {
      server.close();
      await once(server, "close");
    }
    if (database) await database.close();
  });

  async function tenant() {
    const response = await fetch(`${base}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Knowledge",
        lastName: "Owner",
        email: `knowledge-${randomUUID()}@example.test`,
        password: "TestPassword123!",
        organizationName: `Knowledge ${randomUUID()}`,
        industry: "Education",
        organizationType: "School",
        country: "United States",
      }),
    });
    expect(response.status).toBe(201);
    const auth = (await response.json()) as {
      session: { accessToken: string };
      memberships: { organizationId: string }[];
    };
    return { id: auth.memberships[0].organizationId, token: auth.session.accessToken };
  }

  async function request(
    owner: { id: string; token: string },
    path: string,
    method = "GET",
    body?: unknown,
  ) {
    return fetch(`${base}/api/v1/organizations/${owner.id}${path}`, {
      method,
      headers: { authorization: `Bearer ${owner.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  it("persists chunks, enforces tenant and agent assignments, and excludes archived content", async () => {
    const owner = await tenant();
    const other = await tenant();
    const created = await request(owner, "/knowledge", "POST", {
      name: "Biology",
      content: "Photosynthesis converts light into energy.",
    });
    expect(created.status).toBe(201);
    const { source } = (await created.json()) as { source: { id: string; contentHash: string } };
    expect(source.contentHash).toHaveLength(64);
    const read = await request(owner, `/knowledge/${source.id}`);
    expect((await read.json()).source.content).toContain("Photosynthesis");
    expect((await request(other, `/knowledge/${source.id}`)).status).toBe(404);
    expect((await request(other, `/knowledge/${source.id}`, "DELETE")).status).toBe(404);
    const foreign = await request(other, "/knowledge", "POST", {
      name: "Other",
      content: "Photosynthesis secret",
    });
    const foreignId = (await foreign.json()).source.id;
    const workspaces = await request(owner, "/workspaces");
    const workspaceId = (await workspaces.json()).workspaces[0].id;
    const templates = await request(owner, "/agents/templates");
    const templateId = (await templates.json()).templates[0].id;
    const createdAgent = await request(owner, "/agents", "POST", { workspaceId, templateId });
    expect(createdAgent.status).toBe(201);
    const agentId = (await createdAgent.json()).agent.id;
    const search = () =>
      request(owner, `/agents/${agentId}/knowledge/search`, "POST", {
        query: "photosynthesis",
        authorizedKnowledgeIds: [source.id, foreignId],
      });
    expect((await (await search()).json()).results).toEqual([]);
    const badAssignment = await request(owner, `/agents/${agentId}/configuration`, "PATCH", {
      configuration: { knowledge: [foreignId] },
    });
    expect(badAssignment.status).toBe(404);
    const assigned = await request(owner, `/agents/${agentId}/configuration`, "PATCH", {
      configuration: { knowledge: [source.id] },
    });
    expect(assigned.status).toBe(200);
    const results = (await (await search()).json()).results;
    expect(results).toHaveLength(1);
    expect(results[0].sourceId).toBe(source.id);
    expect(results[0].chunkId).toBeTruthy();
    expect((await request(owner, `/knowledge/${source.id}`, "DELETE")).status).toBe(200);
    expect((await (await search()).json()).results).toEqual([]);
  }, 60_000);
});
