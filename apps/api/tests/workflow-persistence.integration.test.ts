import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";

const integration = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;

integration("DB-15 workflow persistence", () => {
  let database: DatabaseClient;
  let server: Server;
  let baseUrl: string;

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
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);

  afterAll(async () => {
    if (server?.listening) {
      server.close();
      await once(server, "close");
    }
    if (database) await database.close();
  });

  it("persists definitions, steps, runs and human tasks with tenant isolation", async () => {
    const owner = await registerTenant("owner");
    const foreign = await registerTenant("foreign");
    const workspaceId = await firstWorkspace(owner);
    const foreignWorkspaceId = await firstWorkspace(foreign);
    const workflowId = randomUUID();

    const crossWorkspace = await request(owner, "/workflows", "POST", {
      id: randomUUID(),
      workspaceId: foreignWorkspaceId,
      name: "Invalid tenant workflow",
    });
    expect(crossWorkspace.status).toBe(404);

    const created = await request(owner, "/workflows", "POST", {
      id: workflowId,
      workspaceId,
      name: "Admissions workflow",
      description: "Durable sequential flow",
      status: "active",
      version: "1.0.0",
      configuration: { mode: "sequential" },
    });
    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { workflow: { revision: number } };
    expect(createdBody.workflow.revision).toBe(1);
    expect((await request(foreign, `/workflows/${workflowId}`)).status).toBe(404);

    let firstStepId = randomUUID();
    let secondStepId = randomUUID();
    const steps = await request(owner, `/workflows/${workflowId}/steps`, "PUT", {
      expectedRevision: 1,
      steps: [
        {
          id: firstStepId,
          name: "Generate packet",
          type: "agent",
          order: 0,
          configuration: {},
          retryPolicy: { maxAttempts: 2, delay: 50 },
        },
        { id: secondStepId, name: "Human review", type: "condition", order: 1, configuration: {} },
      ],
    });
    expect(steps.status).toBe(200);
    const stepBody = (await steps.json()) as { steps: Array<{ id: string }> };
    expect(stepBody.steps).toHaveLength(2);
    firstStepId = stepBody.steps[0].id;
    secondStepId = stepBody.steps[1].id;

    const runId = randomUUID();
    const createdRun = await request(owner, "/workflow-runs", "POST", {
      id: runId,
      workflowId,
      idempotencyKey: "admission-run-1",
      input: { studentId: "S-100" },
      executionContext: { source: "integration-test" },
    });
    expect(createdRun.status, await createdRun.text()).toBe(201);
    const duplicateRun = await request(owner, "/workflow-runs", "POST", {
      workflowId,
      idempotencyKey: "admission-run-1",
      input: { ignoredDuplicate: true },
    });
    expect(((await duplicateRun.json()) as { run: { id: string } }).run.id).toBe(runId);
    expect((await request(foreign, `/workflow-runs/${runId}`)).status).toBe(404);
    const revised = await request(owner, `/workflows/${workflowId}/steps`, "PUT", {
      expectedRevision: 2,
      steps: [{ id: randomUUID(), name: "Replacement", type: "tool", order: 0 }],
    });
    expect(revised.status).toBe(200);
    expect(
      (
        await request(owner, `/workflows/${workflowId}`, "PATCH", {
          expectedRevision: 2,
          name: "Stale update",
        })
      ).status,
    ).toBe(409);

    const running = await request(owner, `/workflow-runs/${runId}`, "PATCH", {
      status: "running",
      currentStepId: firstStepId,
      stepResults: {
        [firstStepId]: {
          success: true,
          status: "completed",
          data: { packetId: "P-1" },
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      },
    });
    expect(running.status, await running.text()).toBe(200);

    const task = await request(owner, "/workflow-tasks", "POST", {
      workflowRunId: runId,
      workflowStepId: secondStepId,
      title: "Approve admission packet",
      assignedUserId: owner.userId,
      input: { packetId: "P-1" },
      metadata: { human: true },
    });
    expect(task.status).toBe(201);
    const taskId = ((await task.json()) as { task: { id: string } }).task.id;
    expect(
      (
        await request(owner, "/workflow-tasks", "POST", {
          workflowRunId: runId,
          workflowStepId: secondStepId,
          title: "Cross tenant assignment",
          assignedUserId: foreign.userId,
        })
      ).status,
    ).toBe(404);
    expect(
      (await request(owner, `/workflow-tasks/${taskId}`, "PATCH", { status: "in_progress" }))
        .status,
    ).toBe(200);
    expect(
      (
        await request(owner, `/workflow-tasks/${taskId}`, "PATCH", {
          status: "completed",
          output: { approved: true },
        })
      ).status,
    ).toBe(200);

    const completed = await request(owner, `/workflow-runs/${runId}`, "PATCH", {
      status: "completed",
      output: { approved: true },
    });
    expect(completed.status).toBe(200);
    const persisted = await request(owner, `/workflow-runs/${runId}`);
    const persistedBody = (await persisted.json()) as {
      run: { status: string; output: { approved: boolean } };
    };
    expect(persistedBody.run.status).toBe("completed");
    expect(persistedBody.run.output.approved).toBe(true);
  }, 60_000);

  async function registerTenant(label: string) {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Workflow",
        lastName: "Owner",
        email: `workflow-${label}-${randomUUID()}@example.test`,
        password: "TestPassword123!",
        organizationName: `Workflow ${label} ${randomUUID()}`,
        industry: "Education",
        organizationType: "School",
        country: "United States",
      }),
    });
    const body = (await response.json()) as {
      user: { id: string };
      session: { accessToken: string };
      memberships: Array<{ organizationId: string }>;
    };
    expect(response.status).toBe(201);
    return {
      organizationId: body.memberships[0].organizationId,
      token: body.session.accessToken,
      userId: body.user.id,
    };
  }

  async function firstWorkspace(owner: { organizationId: string; token: string }) {
    const response = await request(owner, "/workspaces");
    return ((await response.json()) as { workspaces: Array<{ id: string }> }).workspaces[0].id;
  }

  function request(
    owner: { organizationId: string; token: string },
    path: string,
    method = "GET",
    body?: unknown,
  ) {
    return fetch(`${baseUrl}/api/v1/organizations/${owner.organizationId}${path}`, {
      method,
      headers: { authorization: `Bearer ${owner.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
});
