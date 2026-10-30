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
import { membershipRoles, organizationMemberships, roles } from "../src/database/schema.js";
import { and, eq } from "drizzle-orm";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("Epic 14 — AI Agent Runtime & Execution Engine Integration", () => {
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

  it("verifies full runtime lifecycle: queuing, revision pinning, durable worker claim, inference, events, attempts, usage, human approvals with separation of duties, cancellation, retry, and tenant isolation", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      // 1. Setup Tenant A
      const tenantA = await registerTenant(
        baseUrl,
        `epic14-owner-${suffix}@example.com`,
        `Epic14 Org ${suffix}`,
      );
      const workspacesA = await readWorkspaces(baseUrl, tenantA.organizationId, tenantA.accessToken);
      const workspaceIdA = workspacesA[0].id;

      // Register an admin user in Tenant A for approval separation of duties
      const adminTenant = await registerTenant(
        baseUrl,
        `epic14-admin-${suffix}@example.com`,
        `Epic14 Admin Org ${suffix}`,
      );
      const adminMembershipId = randomUUID();
      await database.db.insert(organizationMemberships).values({
        id: adminMembershipId,
        organizationId: tenantA.organizationId,
        userId: adminTenant.userId,
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const adminRoleRows = await database.db
        .select({ id: roles.id })
        .from(roles)
        .where(
          and(
            eq(roles.organizationId, tenantA.organizationId),
            eq(roles.name, "Admin"),
          ),
        )
        .limit(1);

      if (adminRoleRows[0]) {
        await database.db.insert(membershipRoles).values({
          id: randomUUID(),
          membershipId: adminMembershipId,
          roleId: adminRoleRows[0].id,
          createdAt: new Date(),
        });
      }

      // Setup Tenant B for tenant isolation verification
      const tenantB = await registerTenant(
        baseUrl,
        `epic14-other-${suffix}@example.com`,
        `Epic14 Tenant B ${suffix}`,
      );

      // 2. Create Standard Executable Agent in Tenant A
      const agent = await createWorksheetAgent(
        baseUrl,
        tenantA.organizationId,
        workspaceIdA,
        tenantA.accessToken,
      );

      // Activate agent
      await fetch(`${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agent.id}/status`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tenantA.accessToken}`,
        },
        body: JSON.stringify({ status: "active" }),
      });

      // 3. Test Queueing and Manual Worker Tick
      const createRunRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agent.id}/runs`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            input: { prompt: "Generate quiz questions" },
            executionMode: "manual",
            metadata: { testSuite: "epic14" },
          }),
        },
      );
      expect(createRunRes.status).toBe(201);
      const runData = (await createRunRes.json()) as {
        run: {
          id: string;
          status: string;
          configurationRevisionId: string | null;
          attemptCount: number;
          totalInputTokens: number;
        };
      };
      expect(runData.run.status).toBe("queued");
      expect(runData.run.attemptCount).toBe(0);

      // 4. Trigger Worker Tick to Claim and Execute Queued Run
      const tickRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/runtime/worker/tick`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ workerId: "test-worker-alpha" }),
        },
      );
      expect(tickRes.status).toBe(200);
      const tickData = (await tickRes.json()) as {
        executed: boolean;
        run: { id: string; status: string; output: { result: string } };
        attempt: { attemptNumber: number; status: string; workerId: string };
      };
      expect(tickData.executed).toBe(true);
      expect(tickData.run.id).toBe(runData.run.id);
      expect(tickData.run.status).toBe("completed");
      expect(tickData.run.output.result).toBeDefined();
      expect(tickData.attempt.workerId).toBe("test-worker-alpha");

      // 5. Verify Timeline Events
      const eventsRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/runs/${runData.run.id}/events`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(eventsRes.status).toBe(200);
      const { events } = (await eventsRes.json()) as {
        events: Array<{ eventType: string }>;
      };
      const eventTypes = events.map((e) => e.eventType);
      expect(eventTypes).toContain("run_created");
      expect(eventTypes).toContain("run_queued");
      expect(eventTypes).toContain("worker_claimed");
      expect(eventTypes).toContain("run_started");
      expect(eventTypes).toContain("model_invoked");
      expect(eventTypes).toContain("model_responded");
      expect(eventTypes).toContain("run_completed");

      // 6. Verify Attempts
      const attemptsRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/runs/${runData.run.id}/attempts`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(attemptsRes.status).toBe(200);
      const { attempts } = (await attemptsRes.json()) as {
        attempts: Array<{ attemptNumber: number; status: string; inputTokens: number }>;
      };
      expect(attempts.length).toBe(1);
      expect(attempts[0].attemptNumber).toBe(1);
      expect(attempts[0].status).toBe("completed");
      expect(attempts[0].inputTokens).toBeGreaterThan(0);

      // 7. Verify Usage Accounting
      const usageRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/runs/${runData.run.id}/usage`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(usageRes.status).toBe(200);
      const { usage } = (await usageRes.json()) as {
        usage: Array<{ provider: string; model: string; totalTokens: number; costMicros: number }>;
      };
      expect(usage.length).toBe(1);
      expect(usage[0].provider).toBe("mock");
      expect(usage[0].totalTokens).toBeGreaterThan(0);
      expect(usage[0].costMicros).toBeGreaterThan(0);

      // 8. Test Human Approval Workflow with Separation of Duties
      // Create separate workspace for Agent B with required human approval policy
      const createApprovalWorkspaceRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/workspaces`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            name: `Approvals Workspace ${suffix}`,
            slug: `approvals-${suffix}`,
          }),
        },
      );
      expect(createApprovalWorkspaceRes.status).toBe(201);
      const approvalWorkspaceId = (
        (await createApprovalWorkspaceRes.json()) as { workspace: { id: string } }
      ).workspace.id;

      const approvalAgent = await createWorksheetAgent(
        baseUrl,
        tenantA.organizationId,
        approvalWorkspaceId,
        tenantA.accessToken,
      );

      // Update human approval policy
      await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${approvalAgent.id}/configuration`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            configuration: { temperature: 0.5 },
            humanApprovalPolicy: {
              required: true,
              approverRoles: ["admin", "owner"],
              escalationTimeoutHours: 24,
            },
          }),
        },
      );

      await fetch(`${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${approvalAgent.id}/status`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${tenantA.accessToken}`,
        },
        body: JSON.stringify({ status: "active" }),
      });

      // Create Run requiring approval
      const approvalRunRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${approvalAgent.id}/runs?autoExecute=true`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            input: { prompt: "Generate sensitive exam materials" },
          }),
        },
      );
      expect(approvalRunRes.status).toBe(201);
      const approvalRunData = (await approvalRunRes.json()) as {
        run: { id: string; status: string };
      };
      // Run should be paused in awaiting_approval!
      expect(approvalRunData.run.status).toBe("awaiting_approval");

      // Verify approval request appears in approvals inbox
      const inboxRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/approvals?status=pending`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(inboxRes.status).toBe(200);
      const { approvals } = (await inboxRes.json()) as {
        approvals: Array<{ id: string; runId: string; status: string; requestedBy: string }>;
      };
      const pendingApproval = approvals.find((a) => a.runId === approvalRunData.run.id);
      expect(pendingApproval).toBeDefined();
      expect(pendingApproval!.status).toBe("pending");

      // Test Separation of Duties: Requester attempts to approve their own request -> MUST BE FORBIDDEN (403)
      const selfApproveRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/approvals/${pendingApproval!.id}/approve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`, // Owner requested it!
          },
          body: JSON.stringify({ reason: "Self-approval attempt" }),
        },
      );
      expect(selfApproveRes.status).toBe(403);

      // Now approve with distinct authorized administrator user
      const adminApproveRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/approvals/${pendingApproval!.id}/approve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${adminTenant.accessToken}`,
          },
          body: JSON.stringify({ reason: "Exam generation authorized by Department Head" }),
        },
      );
      expect(adminApproveRes.status).toBe(200);

      // Check run status after approval auto-resumes execution
      const resumedRunRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/runs/${approvalRunData.run.id}`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(resumedRunRes.status).toBe(200);
      const resumedRun = ((await resumedRunRes.json()) as { run: { status: string } }).run;
      expect(resumedRun.status).toBe("completed");

      // 9. Test Rejection Workflow
      const rejectRunRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${approvalAgent.id}/runs?autoExecute=true`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ input: "Rejectable task" }),
        },
      );
      const rejectedRunData = (await rejectRunRes.json()) as { run: { id: string } };

      const rejectInboxRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/approvals?status=pending`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      const rejectApproval = ((await rejectInboxRes.json()) as {
        approvals: Array<{ id: string; runId: string }>;
      }).approvals.find((a) => a.runId === rejectedRunData.run.id);

      const rejectActionRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/approvals/${rejectApproval!.id}/reject`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${adminTenant.accessToken}`,
          },
          body: JSON.stringify({ reason: "Disallowed by curriculum guidelines" }),
        },
      );
      expect(rejectActionRes.status).toBe(200);

      const rejectedRunCheck = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/runs/${rejectedRunData.run.id}`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(
        ((await rejectedRunCheck.json()) as { run: { status: string } }).run.status,
      ).toBe("rejected");

      // 10. Test Run Cancellation & Retry
      const cancelRunRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/${agent.id}/runs`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ input: "Run to be cancelled" }),
        },
      );
      const toCancel = ((await cancelRunRes.json()) as { run: { id: string; status: string } }).run;
      expect(toCancel.status).toBe("queued");

      const doCancelRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/runs/${toCancel.id}/cancel`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({ reason: "User changed mind" }),
        },
      );
      expect(doCancelRes.status).toBe(200);
      const cancelledRun = ((await doCancelRes.json()) as { run: { status: string; cancellationReason: string } }).run;
      expect(cancelledRun.status).toBe("cancelled");
      expect(cancelledRun.cancellationReason).toBe("User changed mind");

      // Retry the cancelled run
      const retryRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/runs/${toCancel.id}/retry`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
        },
      );
      expect(retryRes.status).toBe(200);
      const retriedRun = ((await retryRes.json()) as { run: { status: string } }).run;
      expect(retriedRun.status).toBe("completed");

      // 11. Test Runtime Monitoring Metrics
      const monitoringRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/runtime/monitoring`,
        { headers: { authorization: `Bearer ${tenantA.accessToken}` } },
      );
      expect(monitoringRes.status).toBe(200);
      const { metrics } = (await monitoringRes.json()) as {
        metrics: {
          completedLast24h: number;
          successRatePercentage: number;
          totalTokensLast24h: number;
        };
      };
      expect(metrics.completedLast24h).toBeGreaterThanOrEqual(3);
      expect(metrics.totalTokensLast24h).toBeGreaterThan(0);

      // 12. Test Tenant Isolation
      // Tenant B attempts to read Tenant A's run -> 404
      const foreignRunRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/runs/${runData.run.id}`,
        { headers: { authorization: `Bearer ${tenantB.accessToken}` } },
      );
      expect(foreignRunRes.status).toBe(404);

      // Tenant B attempts to access Tenant A's approval -> 404
      const foreignApprovalRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/approvals/${pendingApproval!.id}`,
        { headers: { authorization: `Bearer ${tenantB.accessToken}` } },
      );
      expect(foreignApprovalRes.status).toBe(404);

      // Tenant B attempts to access Tenant A's events -> 404
      const foreignEventsRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/agents/runs/${runData.run.id}/events`,
        { headers: { authorization: `Bearer ${tenantB.accessToken}` } },
      );
      expect(foreignEventsRes.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });
});

async function registerTenant(
  baseUrl: string,
  email: string,
  organizationName: string,
): Promise<{ accessToken: string; organizationId: string; userId: string }> {
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
    user: { id: string };
    memberships: Array<{ organizationId: string }>;
  };
  expect(response.status).toBe(201);
  return {
    accessToken: body.session.accessToken,
    organizationId: body.memberships[0].organizationId,
    userId: body.user.id,
  };
}

async function createWorksheetAgent(
  baseUrl: string,
  organizationId: string,
  workspaceId: string,
  accessToken: string,
): Promise<{ id: string }> {
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

async function readWorkspaces(
  baseUrl: string,
  organizationId: string,
  accessToken: string,
): Promise<Array<{ id: string }>> {
  const response = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/workspaces`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { workspaces: Array<{ id: string }> };
  return body.workspaces;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}
