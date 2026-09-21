import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../common/errors/api-error.js";
import type { DatabaseClient, DatabaseTransaction } from "../../database/client.js";
import {
  aiAgentRuns,
  billingAccounts,
  billingStatements,
  organizationSubscriptions,
  saasPlans,
  usageMeterEvents,
  workflowRuns,
  workspaces,
} from "../../database/schema.js";
import { sanitizeOperationalRecord } from "../operations/operational-sanitization.js";

export type UsageSource = "agent_run" | "workflow_run";
export type UsageFilter = {
  limit: number;
  offset: number;
  meterKey?: string;
  from?: Date;
  to?: Date;
};

export class MeteringService {
  constructor(private readonly database: DatabaseClient) {}

  async recordTerminalRun(
    input: {
      organizationId: string;
      workspaceId: string;
      sourceType: UsageSource;
      sourceId: string;
      outcome: "completed" | "failed" | "cancelled";
      occurredAt: Date;
    },
    tx?: DatabaseTransaction,
  ) {
    const db = tx ?? this.database.db;
    const workspace = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, input.workspaceId),
          eq(workspaces.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!workspace[0]) throw new ApiError(404, "NOT_FOUND", "Workspace not found.");
    const source =
      input.sourceType === "agent_run"
        ? await db
            .select({ id: aiAgentRuns.id })
            .from(aiAgentRuns)
            .where(
              and(
                eq(aiAgentRuns.id, input.sourceId),
                eq(aiAgentRuns.organizationId, input.organizationId),
                eq(aiAgentRuns.workspaceId, input.workspaceId),
              ),
            )
            .limit(1)
        : await db
            .select({ id: workflowRuns.id })
            .from(workflowRuns)
            .where(
              and(
                eq(workflowRuns.id, input.sourceId),
                eq(workflowRuns.organizationId, input.organizationId),
                eq(workflowRuns.workspaceId, input.workspaceId),
              ),
            )
            .limit(1);
    if (!source[0]) throw new ApiError(404, "NOT_FOUND", "Usage source not found.");

    const idempotencyKey = `${input.sourceType}:${input.sourceId}:terminal`;
    const existing = await db
      .select()
      .from(usageMeterEvents)
      .where(
        and(
          eq(usageMeterEvents.organizationId, input.organizationId),
          eq(usageMeterEvents.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) return existing[0];

    const event = {
      id: randomUUID(),
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      meterKey: input.sourceType === "agent_run" ? "agent.run" : "workflow.run",
      quantity: 1,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      idempotencyKey,
      metadata: sanitizeOperationalRecord({ outcome: input.outcome }),
      occurredAt: input.occurredAt,
    };
    await db.insert(usageMeterEvents).values(event);
    return event;
  }

  async listUsage(organizationId: string, filter: UsageFilter) {
    const predicates = [eq(usageMeterEvents.organizationId, organizationId)];
    if (filter.meterKey) predicates.push(eq(usageMeterEvents.meterKey, filter.meterKey));
    if (filter.from) predicates.push(gte(usageMeterEvents.occurredAt, filter.from));
    if (filter.to) predicates.push(lte(usageMeterEvents.occurredAt, filter.to));
    const [items, counts] = await Promise.all([
      this.database.db
        .select()
        .from(usageMeterEvents)
        .where(and(...predicates))
        .orderBy(desc(usageMeterEvents.occurredAt), desc(usageMeterEvents.id))
        .limit(filter.limit)
        .offset(filter.offset),
      this.database.db
        .select({ total: sql<number>`count(*)` })
        .from(usageMeterEvents)
        .where(and(...predicates)),
    ]);
    return {
      items,
      total: Number(counts[0]?.total ?? 0),
      limit: filter.limit,
      offset: filter.offset,
    };
  }

  async usageSummary(organizationId: string, filter: Omit<UsageFilter, "limit" | "offset">) {
    const predicates = [eq(usageMeterEvents.organizationId, organizationId)];
    if (filter.meterKey) predicates.push(eq(usageMeterEvents.meterKey, filter.meterKey));
    if (filter.from) predicates.push(gte(usageMeterEvents.occurredAt, filter.from));
    if (filter.to) predicates.push(lte(usageMeterEvents.occurredAt, filter.to));
    const rows = await this.database.db
      .select({
        meterKey: usageMeterEvents.meterKey,
        quantity: sql<number>`sum(${usageMeterEvents.quantity})`,
        events: sql<number>`count(*)`,
      })
      .from(usageMeterEvents)
      .where(and(...predicates))
      .groupBy(usageMeterEvents.meterKey);
    return rows.map((row) => ({
      meterKey: row.meterKey,
      quantity: Number(row.quantity),
      events: Number(row.events),
    }));
  }

  async billingOverview(organizationId: string) {
    const accounts = await this.database.db
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.organizationId, organizationId))
      .limit(1);
    const subscriptions = await this.database.db
      .select({ subscription: organizationSubscriptions, plan: saasPlans })
      .from(organizationSubscriptions)
      .innerJoin(saasPlans, eq(organizationSubscriptions.planId, saasPlans.id))
      .where(eq(organizationSubscriptions.organizationId, organizationId))
      .orderBy(desc(organizationSubscriptions.createdAt))
      .limit(20);
    const statements = await this.database.db
      .select()
      .from(billingStatements)
      .where(eq(billingStatements.organizationId, organizationId))
      .orderBy(desc(billingStatements.createdAt))
      .limit(20);
    return {
      account: accounts[0] ?? null,
      subscriptions,
      statements: statements.map((statement) => ({
        ...statement,
        usageSnapshot:
          typeof statement.usageSnapshot === "string"
            ? JSON.parse(statement.usageSnapshot)
            : statement.usageSnapshot,
      })),
      chargingEnabled: false,
    };
  }
}
