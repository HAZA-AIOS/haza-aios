import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { migrate } from "../src/database/mysql94-migrator.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import {
  billingAccounts,
  billingStatements,
  communicationDeliveries,
  membershipRoles,
  organizationSubscriptions,
  organizationMemberships,
  operationalEvents,
  roles,
  saasPlans,
  workspaceMemberships,
} from "../src/database/schema.js";
import { AuthService } from "../src/modules/auth/services/auth.service.js";
import { OperationalService } from "../src/modules/operations/services/operational.service.js";
import { MeteringService } from "../src/modules/metering/metering.service.js";

const integration = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;

integration("DB-16 operational persistence", () => {
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

  it("persists isolated audit, event, notification and delivery state", async () => {
    const owner = await registerTenant("owner");
    const foreign = await registerTenant("foreign");
    const workspaceId = await firstWorkspace(owner);
    const member = await addMember(owner.organizationId, workspaceId);
    const operations = new OperationalService(database);

    const audit = await operations.recordAudit({
      organizationId: owner.organizationId,
      workspaceId,
      actorUserId: owner.userId,
      action: "student.updated",
      resourceType: "student",
      resourceId: randomUUID(),
      operation: "update",
      requestId: "request-db16-audit",
      metadata: { password: "unsafe", nested: { accessToken: "unsafe", safe: true } },
    });
    expect(audit?.metadata).toEqual({
      password: "[REDACTED]",
      nested: { accessToken: "[REDACTED]", safe: true },
    });
    expect(
      (await operations.listAudits(owner.organizationId, { limit: 1, offset: 0 })).items,
    ).toHaveLength(1);
    expect(
      (await operations.listAudits(foreign.organizationId, { limit: 10, offset: 0 })).items,
    ).toHaveLength(0);

    const firstEvent = await operations.emitDomainEvent({
      organizationId: owner.organizationId,
      workspaceId,
      eventType: "student.enrolled",
      aggregateType: "student",
      aggregateId: randomUUID(),
      actorUserId: owner.userId,
      idempotencyKey: "db16-student-enrolled",
      payload: { studentId: "safe", authorization: "unsafe" },
      correlationId: "db16-correlation",
    });
    const duplicateEvent = await operations.emitDomainEvent({
      organizationId: owner.organizationId,
      workspaceId,
      eventType: "student.enrolled",
      aggregateType: "student",
      aggregateId: randomUUID(),
      idempotencyKey: "db16-student-enrolled",
    });
    expect(duplicateEvent?.id).toBe(firstEvent?.id);
    expect(firstEvent?.payload).toMatchObject({ authorization: "[REDACTED]" });

    const created = await operations.createEventNotification(
      {
        organizationId: owner.organizationId,
        workspaceId,
        eventType: "exam.result.available",
        aggregateType: "result",
        aggregateId: randomUUID(),
        actorUserId: owner.userId,
        payload: { published: true },
      },
      {
        workspaceId,
        recipientUserId: member.userId,
        notificationType: "exam.result.available",
        title: "Result available",
        message: "Your result is ready.",
        actionPath: "/workspace/education/results",
      },
    );
    expect(created.notification?.sourceEventId).toBe(created.event.id);

    const memberNotifications = await operations.listUserNotifications(
      owner.organizationId,
      member.userId,
      { limit: 20, offset: 0, unreadOnly: true },
    );
    expect(memberNotifications).toHaveLength(1);
    expect(
      await operations.listUserNotifications(owner.organizationId, owner.userId, {
        limit: 20,
        offset: 0,
        unreadOnly: false,
      }),
    ).toHaveLength(0);

    await expect(
      operations.markNotificationRead(owner.organizationId, owner.userId, created.notification!.id),
    ).rejects.toMatchObject({ statusCode: 404 });
    const read = await operations.markNotificationRead(
      owner.organizationId,
      member.userId,
      created.notification!.id,
    );
    expect(read?.isRead).toBe(true);
    const acknowledged = await operations.acknowledgeNotification(
      owner.organizationId,
      member.userId,
      created.notification!.id,
    );
    expect(acknowledged?.acknowledgedAt).toBeInstanceOf(Date);

    await operations.saveUserPreference(owner.organizationId, workspaceId, member.userId, {
      workflow: { inApp: true, email: false },
      apiKey: "unsafe",
    });
    expect(await operations.getUserPreference(owner.organizationId, member.userId)).toEqual({
      workflow: { inApp: true, email: false },
      apiKey: "[REDACTED]",
    });

    const attempt = await operations.recordDeliveryAttempt({
      organizationId: owner.organizationId,
      workspaceId,
      notificationId: created.notification!.id,
      recipientId: member.userId,
      recipientKind: "user",
      channel: "email",
      status: "failed",
      attemptNumber: 1,
      safeErrorCode: "PROVIDER_TIMEOUT",
      safeErrorMessage: "Provider timed out.",
      metadata: { authorization: "unsafe" },
      completedAt: new Date(),
    });
    expect(attempt?.safeErrorCode).toBe("PROVIDER_TIMEOUT");
    const deliveryRows = await database.db
      .select()
      .from(communicationDeliveries)
      .where(eq(communicationDeliveries.id, attempt!.id));
    const persistedPayload =
      typeof deliveryRows[0].payload === "string"
        ? JSON.parse(deliveryRows[0].payload)
        : deliveryRows[0].payload;
    expect(persistedPayload).toEqual({ authorization: "[REDACTED]" });
    await expect(
      operations.recordDeliveryAttempt({
        organizationId: foreign.organizationId,
        workspaceId: await firstWorkspace(foreign),
        notificationId: created.notification!.id,
        recipientId: member.userId,
        recipientKind: "user",
        channel: "email",
        status: "failed",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      operations.recordAudit({
        organizationId: foreign.organizationId,
        workspaceId,
        action: "cross-tenant.test",
        resourceType: "test",
        operation: "create",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      operations.createEventNotification(
        {
          organizationId: owner.organizationId,
          workspaceId,
          eventType: "rollback.test",
          aggregateType: "test",
          aggregateId: randomUUID(),
        },
        {
          workspaceId,
          recipientUserId: foreign.userId,
          notificationType: "rollback.test",
          title: "Invalid",
          message: "Invalid",
        },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(
      (
        await operations.listDomainEvents(owner.organizationId, {
          limit: 20,
          offset: 0,
          eventType: "rollback.test",
        })
      ).items,
    ).toHaveLength(0);

    expect((await apiRequest(member, "/audit-logs")).status).toBe(403);
    expect((await apiRequest(owner, "/audit-logs?limit=1")).status).toBe(200);
    expect(
      (await apiRequest(member, `/notifications/${created.notification!.id}/read`, "PATCH")).status,
    ).toBe(200);
    expect(
      (await apiRequest(owner, `/notifications/${created.notification!.id}/read`, "PATCH")).status,
    ).toBe(404);
    expect((await apiRequest(owner, `/audit-logs/${audit!.id}`, "PATCH", {})).status).toBe(404);

    const workflowId = randomUUID();
    expect(
      (
        await apiRequest(owner, "/workflows", "POST", {
          id: workflowId,
          workspaceId,
          name: "DB-16 approval",
          status: "active",
        })
      ).status,
    ).toBe(201);
    const stepResponse = await apiRequest(owner, `/workflows/${workflowId}/steps`, "PUT", {
      expectedRevision: 1,
      steps: [{ id: randomUUID(), name: "Approval", type: "condition", order: 0 }],
    });
    const stepId = ((await stepResponse.json()) as { steps: Array<{ id: string }> }).steps[0].id;
    const runResponse = await apiRequest(owner, "/workflow-runs", "POST", {
      workflowId,
      idempotencyKey: `db16-run-${randomUUID()}`,
    });
    const runId = ((await runResponse.json()) as { run: { id: string } }).run.id;
    const taskResponse = await apiRequest(owner, "/workflow-tasks", "POST", {
      workflowRunId: runId,
      workflowStepId: stepId,
      title: "Review application",
      status: "assigned",
      assignedUserId: member.userId,
    });
    expect(taskResponse.status).toBe(201);
    const workflowNotices = await operations.listUserNotifications(
      owner.organizationId,
      member.userId,
      { limit: 20, offset: 0, unreadOnly: false },
    );
    expect(workflowNotices.some((item) => item.notificationType === "workflow.task.assigned")).toBe(
      true,
    );

    expect(
      (
        await apiRequest(owner, `/workflow-runs/${runId}`, "PATCH", {
          status: "failed",
          error: "Safe failure",
        })
      ).status,
    ).toBe(200);
    const failures = await database.db
      .select()
      .from(operationalEvents)
      .where(
        and(
          eq(operationalEvents.organizationId, owner.organizationId),
          eq(operationalEvents.workflowRunId, runId),
        ),
      );
    expect(failures).toHaveLength(1);
    const metering = new MeteringService(database);
    expect(await metering.usageSummary(owner.organizationId, {})).toContainEqual({
      meterKey: "workflow.run",
      quantity: 1,
      events: 1,
    });
    expect((await metering.listUsage(foreign.organizationId, { limit: 10, offset: 0 })).total).toBe(
      0,
    );
    const existingUsage = (await metering.listUsage(owner.organizationId, { limit: 10, offset: 0 }))
      .items[0];
    const repeatedUsage = await metering.recordTerminalRun({
      organizationId: owner.organizationId,
      workspaceId,
      sourceType: "workflow_run",
      sourceId: runId,
      outcome: "failed",
      occurredAt: new Date(),
    });
    expect(repeatedUsage.id).toBe(existingUsage.id);
    await expect(
      metering.recordTerminalRun({
        organizationId: foreign.organizationId,
        workspaceId,
        sourceType: "workflow_run",
        sourceId: runId,
        outcome: "failed",
        occurredAt: new Date(),
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    const planId = randomUUID();
    const accountId = randomUUID();
    const subscriptionId = randomUUID();
    const periodStart = new Date("2026-09-01T00:00:00Z");
    const periodEnd = new Date("2026-10-01T00:00:00Z");
    await database.db.insert(saasPlans).values({
      id: planId,
      code: `test-${randomUUID()}`,
      name: "Synthetic plan",
      currency: "USD",
      interval: "monthly",
      priceCents: 0,
    });
    await database.db.insert(billingAccounts).values({
      id: accountId,
      organizationId: owner.organizationId,
      billingEmail: `billing-${randomUUID()}@example.test`,
      currency: "USD",
    });
    await database.db.insert(organizationSubscriptions).values({
      id: subscriptionId,
      organizationId: owner.organizationId,
      billingAccountId: accountId,
      planId,
      periodStart,
      periodEnd,
    });
    await database.db.insert(billingStatements).values({
      id: randomUUID(),
      organizationId: owner.organizationId,
      subscriptionId,
      currency: "USD",
      periodStart,
      periodEnd,
      usageSnapshot: { "workflow.run": 1 },
    });
    expect((await metering.billingOverview(owner.organizationId)).account?.id).toBe(accountId);
    expect((await metering.billingOverview(foreign.organizationId)).account).toBeNull();
    expect((await metering.billingOverview(owner.organizationId)).chargingEnabled).toBe(false);
    expect((await apiRequest(owner, "/billing/overview")).status).toBe(200);
  }, 90_000);

  async function registerTenant(label: string) {
    const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: "Operations",
        lastName: "Owner",
        email: `operations-${label}-${randomUUID()}@example.test`,
        password: "TestPassword123!",
        organizationName: `Operations ${label} ${randomUUID()}`,
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

  async function addMember(organizationId: string, workspaceId: string) {
    const identity = await new AuthService(database).registerIdentity({
      firstName: "Operations",
      lastName: "Member",
      email: `operations-member-${randomUUID()}@example.test`,
      password: "TestPassword123!",
      status: "active",
      emailVerified: true,
    });
    const membershipId = randomUUID();
    await database.db.insert(organizationMemberships).values({
      id: membershipId,
      organizationId,
      userId: identity.user.id,
      role: "Member",
      status: "active",
    });
    await database.db.insert(workspaceMemberships).values({
      id: randomUUID(),
      workspaceId,
      organizationMembershipId: membershipId,
      isDefault: true,
    });
    const memberRole = (
      await database.db
        .select({ id: roles.id })
        .from(roles)
        .where(and(eq(roles.organizationId, organizationId), eq(roles.name, "Member")))
        .limit(1)
    )[0];
    await database.db.insert(membershipRoles).values({
      id: randomUUID(),
      membershipId,
      roleId: memberRole.id,
    });
    return {
      organizationId,
      userId: identity.user.id,
      token: identity.session.accessToken,
    };
  }

  async function firstWorkspace(owner: { organizationId: string; token: string }) {
    const response = await apiRequest(owner, "/workspaces");
    return ((await response.json()) as { workspaces: Array<{ id: string }> }).workspaces[0].id;
  }

  function apiRequest(
    actor: { organizationId: string; token: string },
    path: string,
    method = "GET",
    body?: unknown,
  ) {
    return fetch(`${baseUrl}/api/v1/organizations/${actor.organizationId}${path}`, {
      method,
      headers: { authorization: `Bearer ${actor.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
});
