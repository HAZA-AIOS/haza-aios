import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  agentTraceSpans,
  agentEvaluationDatasets,
  agentEvaluationCases,
  agentEvaluationRuns,
  agentSloDefinitions,
  agentReliabilityMetrics,
  agentAlertRules,
  agentIncidents,
  aiUsageLedger,
} from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AgentTraceSpanEntity,
  CreateTraceSpanInput,
  AgentEvaluationDatasetEntity,
  AgentEvaluationCaseEntity,
  AgentEvaluationRunEntity,
  AgentSloDefinitionEntity,
  AgentReliabilityMetricEntity,
  AgentAlertRuleEntity,
  AgentIncidentEntity,
  AgentCostAttribution,
  IncidentStatus,
} from "../observability.types.js";

export class AgentObservabilityRepository {
  constructor(private readonly context: RepositoryContext) {}

  // =========================================================================
  // 1. DISTRIBUTED TRACING & SPANS
  // =========================================================================

  async createSpan(input: CreateTraceSpanInput): Promise<AgentTraceSpanEntity> {
    const id = randomUUID();
    const spanId = input.spanId || randomUUID().replace(/-/g, "").substring(0, 16);
    const startTime = input.startTime || new Date();
    const durationMs =
      input.durationMs !== undefined
        ? input.durationMs
        : input.endTime
        ? input.endTime.getTime() - startTime.getTime()
        : 0;

    await this.context.db.insert(agentTraceSpans).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      traceId: input.traceId,
      spanId,
      parentSpanId: input.parentSpanId || null,
      name: input.name,
      kind: input.kind || "internal",
      status: input.status || "ok",
      statusCode: input.statusCode || 0,
      statusMessage: input.statusMessage || null,
      durationMs: Math.max(0, durationMs),
      startTime,
      endTime: input.endTime || null,
      serviceName: input.serviceName || "haza-aios-agent",
      agentId: input.agentId || null,
      agentRunId: input.agentRunId || null,
      workflowRunId: input.workflowRunId || null,
      autonomousRunId: input.autonomousRunId || input.autonomousTaskRunId || null,
      attributes: input.attributes || {},
      events: (input.events || []) as Array<Record<string, unknown>>,
    });

    return {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      traceId: input.traceId,
      spanId,
      parentSpanId: input.parentSpanId || null,
      name: input.name,
      kind: input.kind || "internal",
      status: input.status || "ok",
      statusCode: input.statusCode || 0,
      statusMessage: input.statusMessage || null,
      durationMs: Math.max(0, durationMs),
      startTime,
      endTime: input.endTime || null,
      serviceName: input.serviceName || "haza-aios-agent",
      agentId: input.agentId || null,
      agentRunId: input.agentRunId || null,
      workflowRunId: input.workflowRunId || null,
      autonomousRunId: input.autonomousRunId || input.autonomousTaskRunId || null,
      attributes: input.attributes || {},
      events: input.events || [],
      createdAt: new Date(),
    };
  }

  async listSpansByTraceId(organizationId: string, traceId: string): Promise<AgentTraceSpanEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentTraceSpans)
      .where(
        and(
          eq(agentTraceSpans.organizationId, organizationId),
          eq(agentTraceSpans.traceId, traceId),
        ),
      )
      .orderBy(agentTraceSpans.startTime);

    return rows.map(this.mapSpanRow);
  }

  async listSpans(
    organizationId: string,
    options: {
      workspaceId?: string;
      limit?: number;
      offset?: number;
      status?: string;
      agentId?: string;
    } = {},
  ): Promise<AgentTraceSpanEntity[]> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const conditions = [eq(agentTraceSpans.organizationId, organizationId)];
    if (options.workspaceId) {
      conditions.push(eq(agentTraceSpans.workspaceId, options.workspaceId));
    }
    if (options.status) {
      conditions.push(eq(agentTraceSpans.status, options.status));
    }
    if (options.agentId) {
      conditions.push(eq(agentTraceSpans.agentId, options.agentId));
    }

    const rows = await this.context.db
      .select()
      .from(agentTraceSpans)
      .where(and(...conditions))
      .orderBy(desc(agentTraceSpans.startTime))
      .limit(limit)
      .offset(offset);

    return rows.map(this.mapSpanRow);
  }

  async getRecentSpans(organizationId: string, minutes: number = 60): Promise<AgentTraceSpanEntity[]> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const rows = await this.context.db
      .select()
      .from(agentTraceSpans)
      .where(
        and(
          eq(agentTraceSpans.organizationId, organizationId),
          gte(agentTraceSpans.startTime, cutoff),
        ),
      )
      .orderBy(desc(agentTraceSpans.startTime))
      .limit(2000);

    return rows.map(this.mapSpanRow);
  }

  private mapSpanRow(row: any): AgentTraceSpanEntity {
    return {
      id: row.id,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      traceId: row.traceId,
      spanId: row.spanId,
      parentSpanId: row.parentSpanId,
      name: row.name,
      kind: row.kind,
      status: row.status,
      statusCode: row.statusCode,
      statusMessage: row.statusMessage,
      durationMs: row.durationMs,
      startTime: row.startTime,
      endTime: row.endTime,
      serviceName: row.serviceName,
      agentId: row.agentId,
      agentRunId: row.agentRunId,
      workflowRunId: row.workflowRunId,
      autonomousRunId: row.autonomousRunId,
      attributes: (row.attributes as Record<string, unknown>) || {},
      events: (row.events as Array<Record<string, unknown>>) || [],
      createdAt: row.createdAt,
    };
  }

  // =========================================================================
  // 2. AGENT EVALUATION ENGINE
  // =========================================================================

  async createEvaluationDataset(input: {
    organizationId: string;
    workspaceId?: string | null;
    name: string;
    description?: string;
    targetType?: string;
    targetId?: string;
    version?: string | number;
    status?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string;
  }): Promise<AgentEvaluationDatasetEntity> {
    const id = randomUUID();
    const version = String(input.version || "1.0.0");
    const status = input.status || "active";
    const targetType = input.targetType || "agent";

    await this.context.db.insert(agentEvaluationDatasets).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      name: input.name,
      description: input.description || null,
      targetType,
      targetId: input.targetId || null,
      version,
      status,
      metadata: input.metadata || {},
      createdBy: input.createdBy || null,
    });

    return {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      name: input.name,
      description: input.description || null,
      targetType,
      targetId: input.targetId || null,
      version,
      status,
      metadata: input.metadata || {},
      createdBy: input.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getEvaluationDataset(organizationId: string, id: string): Promise<AgentEvaluationDatasetEntity | null> {
    const rows = await this.context.db
      .select()
      .from(agentEvaluationDatasets)
      .where(
        and(
          eq(agentEvaluationDatasets.organizationId, organizationId),
          eq(agentEvaluationDatasets.id, id),
        ),
      )
      .limit(1);

    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      name: r.name,
      description: r.description,
      targetType: r.targetType,
      targetId: r.targetId,
      version: r.version,
      status: r.status,
      metadata: (r.metadata as Record<string, unknown>) || {},
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async listEvaluationDatasets(organizationId: string): Promise<AgentEvaluationDatasetEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentEvaluationDatasets)
      .where(eq(agentEvaluationDatasets.organizationId, organizationId))
      .orderBy(desc(agentEvaluationDatasets.createdAt));

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      name: r.name,
      description: r.description,
      targetType: r.targetType,
      targetId: r.targetId,
      version: r.version,
      status: r.status,
      metadata: (r.metadata as Record<string, unknown>) || {},
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async createEvaluationCase(input: {
    datasetId: string;
    organizationId: string;
    name: string;
    description?: string;
    inputPrompt?: string;
    prompt?: string;
    inputContext?: Record<string, unknown>;
    expectedOutput?: string;
    expectedOutputSchema?: Record<string, unknown>;
    expectedTools?: string[];
    requiredCitations?: string[];
    contextChunkIds?: string[];
    gradingCriteria?: Record<string, unknown>;
    orderIndex?: number;
  }): Promise<AgentEvaluationCaseEntity> {
    const id = randomUUID();
    const orderIndex = input.orderIndex ?? 0;
    const inputPrompt = input.inputPrompt || input.prompt || "";
    const requiredCitations = input.requiredCitations || input.contextChunkIds || [];

    await this.context.db.insert(agentEvaluationCases).values({
      id,
      datasetId: input.datasetId,
      organizationId: input.organizationId,
      name: input.name,
      description: input.description || null,
      inputPrompt,
      inputContext: input.inputContext || {},
      expectedOutput: input.expectedOutput || null,
      expectedOutputSchema: input.expectedOutputSchema || null,
      expectedTools: input.expectedTools || [],
      requiredCitations,
      gradingCriteria: input.gradingCriteria || {},
      orderIndex,
    });

    return {
      id,
      datasetId: input.datasetId,
      organizationId: input.organizationId,
      name: input.name,
      description: input.description || null,
      inputPrompt,
      inputContext: input.inputContext || {},
      expectedOutput: input.expectedOutput || null,
      expectedOutputSchema: input.expectedOutputSchema || null,
      expectedTools: input.expectedTools || [],
      requiredCitations,
      gradingCriteria: input.gradingCriteria || {},
      orderIndex,
      createdAt: new Date(),
    };
  }

  async listEvaluationCases(datasetId: string): Promise<AgentEvaluationCaseEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentEvaluationCases)
      .where(eq(agentEvaluationCases.datasetId, datasetId))
      .orderBy(agentEvaluationCases.orderIndex);

    return rows.map((r) => ({
      id: r.id,
      datasetId: r.datasetId,
      organizationId: r.organizationId,
      name: r.name,
      description: r.description,
      inputPrompt: r.inputPrompt,
      inputContext: (r.inputContext as Record<string, unknown>) || {},
      expectedOutput: r.expectedOutput,
      expectedOutputSchema: r.expectedOutputSchema as Record<string, unknown> | null,
      expectedTools: (r.expectedTools as string[]) || [],
      requiredCitations: (r.requiredCitations as string[]) || [],
      gradingCriteria: (r.gradingCriteria as Record<string, unknown>) || {},
      orderIndex: r.orderIndex,
      createdAt: r.createdAt,
    }));
  }

  async createEvaluationRun(input: {
    organizationId: string;
    workspaceId?: string | null;
    datasetId: string;
    targetType?: string;
    targetId?: string | null;
    status: string;
    totalCases: number;
    passedCases: number;
    failedCases: number;
    overallScore: number;
    groundingScore?: number;
    toolAccuracyScore?: number;
    formatComplianceScore?: number;
    isBaseline: boolean;
    comparedToRunId?: string | null;
    scoreDelta?: number;
    summaryResults: Array<Record<string, unknown>>;
    evaluatedBy?: string | null;
    durationMs?: number;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<AgentEvaluationRunEntity> {
    const id = randomUUID();
    const scoreDelta = input.scoreDelta !== undefined ? input.scoreDelta : 0;
    const now = new Date();
    const groundingScore = input.groundingScore || 0;
    const toolAccuracyScore = input.toolAccuracyScore || 0;
    const formatComplianceScore = input.formatComplianceScore || 0;

    await this.context.db.insert(agentEvaluationRuns).values({
      id,
      datasetId: input.datasetId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      targetType: input.targetType || "agent",
      targetId: input.targetId || null,
      status: input.status,
      totalCases: input.totalCases,
      passedCases: input.passedCases,
      failedCases: input.failedCases,
      overallScore: input.overallScore.toFixed(2) as any,
      groundingScore: groundingScore.toFixed(2) as any,
      toolAccuracyScore: toolAccuracyScore.toFixed(2) as any,
      formatComplianceScore: formatComplianceScore.toFixed(2) as any,
      isBaseline: input.isBaseline,
      comparedToRunId: input.comparedToRunId || null,
      scoreDelta: scoreDelta.toFixed(2) as any,
      summaryResults: input.summaryResults,
      evaluatedBy: input.evaluatedBy || null,
      durationMs: input.durationMs || 0,
      startedAt: input.startedAt || now,
      completedAt: input.completedAt || now,
    });

    return {
      id,
      datasetId: input.datasetId,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      targetType: input.targetType || "agent",
      targetId: input.targetId || null,
      status: input.status,
      totalCases: input.totalCases,
      passedCases: input.passedCases,
      failedCases: input.failedCases,
      overallScore: input.overallScore,
      groundingScore,
      toolAccuracyScore,
      formatComplianceScore,
      isBaseline: input.isBaseline,
      comparedToRunId: input.comparedToRunId || null,
      scoreDelta,
      summaryResults: input.summaryResults,
      evaluatedBy: input.evaluatedBy || null,
      durationMs: input.durationMs || 0,
      startedAt: input.startedAt || now,
      completedAt: input.completedAt || now,
      createdAt: now,
    };
  }

  async getEvaluationRun(organizationId: string, id: string): Promise<AgentEvaluationRunEntity | null> {
    const rows = await this.context.db
      .select()
      .from(agentEvaluationRuns)
      .where(
        and(
          eq(agentEvaluationRuns.organizationId, organizationId),
          eq(agentEvaluationRuns.id, id),
        ),
      )
      .limit(1);

    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      datasetId: r.datasetId,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      targetType: r.targetType,
      targetId: r.targetId,
      status: r.status,
      totalCases: r.totalCases,
      passedCases: r.passedCases,
      failedCases: r.failedCases,
      overallScore: Number(r.overallScore),
      groundingScore: Number(r.groundingScore),
      toolAccuracyScore: Number(r.toolAccuracyScore),
      formatComplianceScore: Number(r.formatComplianceScore),
      isBaseline: r.isBaseline,
      comparedToRunId: r.comparedToRunId,
      scoreDelta: Number(r.scoreDelta),
      summaryResults: (r.summaryResults as Array<Record<string, unknown>>) || [],
      evaluatedBy: r.evaluatedBy,
      durationMs: r.durationMs,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    };
  }

  async listEvaluationRuns(organizationId: string, datasetId?: string): Promise<AgentEvaluationRunEntity[]> {
    const conditions = [eq(agentEvaluationRuns.organizationId, organizationId)];
    if (datasetId) {
      conditions.push(eq(agentEvaluationRuns.datasetId, datasetId));
    }

    const rows = await this.context.db
      .select()
      .from(agentEvaluationRuns)
      .where(and(...conditions))
      .orderBy(desc(agentEvaluationRuns.createdAt))
      .limit(100);

    return rows.map((r) => ({
      id: r.id,
      datasetId: r.datasetId,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      targetType: r.targetType,
      targetId: r.targetId,
      status: r.status,
      totalCases: r.totalCases,
      passedCases: r.passedCases,
      failedCases: r.failedCases,
      overallScore: Number(r.overallScore),
      groundingScore: Number(r.groundingScore),
      toolAccuracyScore: Number(r.toolAccuracyScore),
      formatComplianceScore: Number(r.formatComplianceScore),
      isBaseline: r.isBaseline,
      comparedToRunId: r.comparedToRunId,
      scoreDelta: Number(r.scoreDelta),
      summaryResults: (r.summaryResults as Array<Record<string, unknown>>) || [],
      evaluatedBy: r.evaluatedBy,
      durationMs: r.durationMs,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    }));
  }

  async getLatestBaselineRun(organizationId: string, datasetId: string): Promise<AgentEvaluationRunEntity | null> {
    const rows = await this.context.db
      .select()
      .from(agentEvaluationRuns)
      .where(
        and(
          eq(agentEvaluationRuns.organizationId, organizationId),
          eq(agentEvaluationRuns.datasetId, datasetId),
          eq(agentEvaluationRuns.isBaseline, true),
        ),
      )
      .orderBy(desc(agentEvaluationRuns.createdAt))
      .limit(1);

    if (!rows.length) return null;
    const r = rows[0];
    return {
      id: r.id,
      datasetId: r.datasetId,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      targetType: r.targetType,
      targetId: r.targetId,
      status: r.status,
      totalCases: r.totalCases,
      passedCases: r.passedCases,
      failedCases: r.failedCases,
      overallScore: Number(r.overallScore),
      groundingScore: Number(r.groundingScore),
      toolAccuracyScore: Number(r.toolAccuracyScore),
      formatComplianceScore: Number(r.formatComplianceScore),
      isBaseline: r.isBaseline,
      comparedToRunId: r.comparedToRunId,
      scoreDelta: Number(r.scoreDelta),
      summaryResults: (r.summaryResults as Array<Record<string, unknown>>) || [],
      evaluatedBy: r.evaluatedBy,
      durationMs: r.durationMs,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    };
  }

  // =========================================================================
  // 3. RELIABILITY & SLO ENGINE
  // =========================================================================

  async upsertSloDefinition(input: {
    organizationId: string;
    workspaceId?: string;
    name: string;
    description?: string;
    metricType: string;
    targetType?: string;
    targetId?: string;
    targetValue: number;
    comparisonOperator?: string;
    windowDurationMinutes?: number;
    status?: string;
  }): Promise<AgentSloDefinitionEntity> {
    const existing = await this.context.db
      .select()
      .from(agentSloDefinitions)
      .where(
        and(
          eq(agentSloDefinitions.organizationId, input.organizationId),
          eq(agentSloDefinitions.name, input.name),
        ),
      )
      .limit(1);

    const comparisonOperator = input.comparisonOperator || "gte";
    const windowDurationMinutes = input.windowDurationMinutes || 1440;
    const status = input.status || "active";
    const targetType = input.targetType || "all";

    if (existing.length > 0) {
      const id = existing[0].id;
      await this.context.db
        .update(agentSloDefinitions)
        .set({
          metricType: input.metricType,
          targetType,
          targetValue: input.targetValue.toFixed(4) as any,
          comparisonOperator,
          windowDurationMinutes,
          status,
          updatedAt: new Date(),
        })
        .where(eq(agentSloDefinitions.id, id));

      return {
        id,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId || existing[0].workspaceId,
        name: input.name,
        description: input.description || existing[0].description,
        metricType: input.metricType,
        targetType,
        targetId: input.targetId || existing[0].targetId,
        targetValue: input.targetValue,
        comparisonOperator,
        windowDurationMinutes,
        status,
        createdAt: existing[0].createdAt,
        updatedAt: new Date(),
      };
    }

    const id = randomUUID();
    await this.context.db.insert(agentSloDefinitions).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      name: input.name,
      description: input.description || null,
      metricType: input.metricType,
      targetType,
      targetId: input.targetId || null,
      targetValue: input.targetValue.toFixed(4) as any,
      comparisonOperator,
      windowDurationMinutes,
      status,
    });

    return {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      name: input.name,
      description: input.description || null,
      metricType: input.metricType,
      targetType,
      targetId: input.targetId || null,
      targetValue: input.targetValue,
      comparisonOperator,
      windowDurationMinutes,
      status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async listSloDefinitions(organizationId: string): Promise<AgentSloDefinitionEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentSloDefinitions)
      .where(eq(agentSloDefinitions.organizationId, organizationId))
      .orderBy(agentSloDefinitions.name);

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      name: r.name,
      description: r.description,
      metricType: r.metricType,
      targetType: r.targetType,
      targetId: r.targetId,
      targetValue: Number(r.targetValue),
      comparisonOperator: r.comparisonOperator,
      windowDurationMinutes: r.windowDurationMinutes,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async recordReliabilityMetric(input: {
    organizationId: string;
    workspaceId?: string;
    windowStart: Date;
    windowEnd: Date;
    totalRuns?: number;
    successfulRuns?: number;
    failedRuns?: number;
    totalExecutions?: number;
    successfulExecutions?: number;
    failedExecutions?: number;
    successRate: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    activeWorkerCount?: number;
    queueBacklog?: number;
    staleLeasesReclaimed?: number;
    circuitBreakerTrips?: number;
    rateLimitHits?: number;
  }): Promise<AgentReliabilityMetricEntity> {
    const id = randomUUID();
    const now = new Date();
    const totalRuns = input.totalRuns ?? input.totalExecutions ?? 0;
    const successfulRuns = input.successfulRuns ?? input.successfulExecutions ?? 0;
    const failedRuns = input.failedRuns ?? input.failedExecutions ?? 0;

    await this.context.db.insert(agentReliabilityMetrics).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate: input.successRate.toFixed(2) as any,
      p50LatencyMs: input.p50LatencyMs,
      p95LatencyMs: input.p95LatencyMs,
      p99LatencyMs: input.p99LatencyMs,
      activeWorkerCount: input.activeWorkerCount || 1,
      queueBacklog: input.queueBacklog || 0,
      staleLeasesReclaimed: input.staleLeasesReclaimed || 0,
      circuitBreakerTrips: input.circuitBreakerTrips || 0,
      rateLimitHits: input.rateLimitHits || 0,
    });

    return {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      totalRuns,
      successfulRuns,
      failedRuns,
      successRate: input.successRate,
      p50LatencyMs: input.p50LatencyMs,
      p95LatencyMs: input.p95LatencyMs,
      p99LatencyMs: input.p99LatencyMs,
      activeWorkerCount: input.activeWorkerCount || 1,
      queueBacklog: input.queueBacklog || 0,
      staleLeasesReclaimed: input.staleLeasesReclaimed || 0,
      circuitBreakerTrips: input.circuitBreakerTrips || 0,
      rateLimitHits: input.rateLimitHits || 0,
      createdAt: now,
    };
  }

  async getLatestReliabilityMetrics(organizationId: string, limit: number = 24): Promise<AgentReliabilityMetricEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentReliabilityMetrics)
      .where(eq(agentReliabilityMetrics.organizationId, organizationId))
      .orderBy(desc(agentReliabilityMetrics.windowStart))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      windowStart: r.windowStart,
      windowEnd: r.windowEnd,
      totalRuns: r.totalRuns,
      successfulRuns: r.successfulRuns,
      failedRuns: r.failedRuns,
      successRate: Number(r.successRate),
      p50LatencyMs: r.p50LatencyMs,
      p95LatencyMs: r.p95LatencyMs,
      p99LatencyMs: r.p99LatencyMs,
      activeWorkerCount: r.activeWorkerCount,
      queueBacklog: r.queueBacklog,
      staleLeasesReclaimed: r.staleLeasesReclaimed,
      circuitBreakerTrips: r.circuitBreakerTrips,
      rateLimitHits: r.rateLimitHits,
      createdAt: r.createdAt,
    }));
  }

  async upsertAlertRule(input: {
    organizationId: string;
    workspaceId?: string;
    name: string;
    description?: string;
    metricName?: string;
    metricType?: string;
    conditionOperator?: string;
    comparisonOperator?: string;
    thresholdValue: number;
    evaluationWindowMinutes?: number;
    windowMinutes?: number;
    severity?: string;
    isEnabled?: boolean;
    channels?: string[];
  }): Promise<AgentAlertRuleEntity> {
    const existing = await this.context.db
      .select()
      .from(agentAlertRules)
      .where(
        and(
          eq(agentAlertRules.organizationId, input.organizationId),
          eq(agentAlertRules.name, input.name),
        ),
      )
      .limit(1);

    const metricName = input.metricName || input.metricType || "availability";
    const conditionOperator = input.conditionOperator || input.comparisonOperator || "gt";
    const evaluationWindowMinutes = input.evaluationWindowMinutes || input.windowMinutes || 15;
    const severity = input.severity || "warning";
    const channels = input.channels || ["in_app"];

    if (existing.length > 0) {
      const id = existing[0].id;
      await this.context.db
        .update(agentAlertRules)
        .set({
          metricName,
          conditionOperator,
          thresholdValue: input.thresholdValue.toFixed(4) as any,
          evaluationWindowMinutes,
          severity,
          isEnabled: input.isEnabled !== undefined ? input.isEnabled : existing[0].isEnabled,
          channels,
          updatedAt: new Date(),
        })
        .where(eq(agentAlertRules.id, id));

      return {
        id,
        organizationId: input.organizationId,
        workspaceId: input.workspaceId || existing[0].workspaceId,
        name: input.name,
        description: input.description || existing[0].description,
        metricName,
        conditionOperator,
        thresholdValue: input.thresholdValue,
        evaluationWindowMinutes,
        severity,
        isEnabled: input.isEnabled !== undefined ? input.isEnabled : existing[0].isEnabled,
        channels,
        createdAt: existing[0].createdAt,
        updatedAt: new Date(),
      };
    }

    const id = randomUUID();
    await this.context.db.insert(agentAlertRules).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      name: input.name,
      description: input.description || null,
      metricName,
      conditionOperator,
      thresholdValue: input.thresholdValue.toFixed(4) as any,
      evaluationWindowMinutes,
      severity,
      isEnabled: input.isEnabled !== undefined ? input.isEnabled : true,
      channels,
    });

    return {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      name: input.name,
      description: input.description || null,
      metricName,
      conditionOperator,
      thresholdValue: input.thresholdValue,
      evaluationWindowMinutes,
      severity,
      isEnabled: input.isEnabled !== undefined ? input.isEnabled : true,
      channels,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async listAlertRules(organizationId: string): Promise<AgentAlertRuleEntity[]> {
    const rows = await this.context.db
      .select()
      .from(agentAlertRules)
      .where(eq(agentAlertRules.organizationId, organizationId))
      .orderBy(agentAlertRules.name);

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      name: r.name,
      description: r.description,
      metricName: r.metricName,
      conditionOperator: r.conditionOperator,
      thresholdValue: Number(r.thresholdValue),
      evaluationWindowMinutes: r.evaluationWindowMinutes,
      severity: r.severity,
      isEnabled: r.isEnabled,
      channels: (r.channels as string[]) || ["in_app"],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  // =========================================================================
  // 4. INCIDENT MANAGEMENT & DEDUPLICATION
  // =========================================================================

  async triggerOrDeduplicateIncident(input: {
    organizationId: string;
    workspaceId?: string | null;
    alertRuleId?: string | null;
    title: string;
    summary: string;
    severity?: string;
    impactedService?: string;
    impactedAgentId?: string | null;
    rootCause?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentIncidentEntity> {
    const openIncidents = await this.context.db
      .select()
      .from(agentIncidents)
      .where(
        and(
          eq(agentIncidents.organizationId, input.organizationId),
          eq(agentIncidents.title, input.title),
          inArray(agentIncidents.status, ["open", "acknowledged"]),
        ),
      )
      .limit(1);

    if (openIncidents.length > 0) {
      const existing = openIncidents[0];
      const newOccurrence = existing.occurrenceCount + 1;
      await this.context.db
        .update(agentIncidents)
        .set({
          occurrenceCount: newOccurrence,
          summary: input.summary,
          rootCause: input.rootCause || existing.rootCause,
          metadata: input.metadata || existing.metadata,
          updatedAt: new Date(),
        })
        .where(eq(agentIncidents.id, existing.id));

      return {
        id: existing.id,
        organizationId: existing.organizationId,
        workspaceId: existing.workspaceId,
        alertRuleId: existing.alertRuleId,
        title: existing.title,
        summary: input.summary,
        severity: existing.severity,
        status: existing.status,
        impactedService: existing.impactedService,
        impactedAgentId: existing.impactedAgentId,
        rootCause: input.rootCause || existing.rootCause,
        mitigationSteps: existing.mitigationSteps,
        acknowledgedBy: existing.acknowledgedBy,
        acknowledgedAt: existing.acknowledgedAt,
        resolvedBy: existing.resolvedBy,
        resolvedAt: existing.resolvedAt,
        occurrenceCount: newOccurrence,
        metadata: (input.metadata || existing.metadata) as Record<string, unknown>,
        createdAt: existing.createdAt,
        updatedAt: new Date(),
      };
    }

    const id = randomUUID();
    const now = new Date();
    await this.context.db.insert(agentIncidents).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      alertRuleId: input.alertRuleId || null,
      title: input.title,
      summary: input.summary,
      severity: input.severity || "warning",
      status: "open",
      impactedService: input.impactedService || "agent-runtime",
      impactedAgentId: input.impactedAgentId || null,
      rootCause: input.rootCause || null,
      mitigationSteps: null,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      occurrenceCount: 1,
      metadata: input.metadata || {},
    });

    return {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId || null,
      alertRuleId: input.alertRuleId || null,
      title: input.title,
      summary: input.summary,
      severity: input.severity || "warning",
      status: "open",
      impactedService: input.impactedService || "agent-runtime",
      impactedAgentId: input.impactedAgentId || null,
      rootCause: input.rootCause || null,
      mitigationSteps: null,
      acknowledgedBy: null,
      acknowledgedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      occurrenceCount: 1,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };
  }

  async listIncidents(
    organizationId: string,
    options: { status?: IncidentStatus; limit?: number } = {},
  ): Promise<AgentIncidentEntity[]> {
    const conditions = [eq(agentIncidents.organizationId, organizationId)];
    if (options.status) {
      conditions.push(eq(agentIncidents.status, options.status));
    }

    const rows = await this.context.db
      .select()
      .from(agentIncidents)
      .where(and(...conditions))
      .orderBy(desc(agentIncidents.updatedAt))
      .limit(options.limit || 50);

    return rows.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      alertRuleId: r.alertRuleId,
      title: r.title,
      summary: r.summary,
      severity: r.severity,
      status: r.status,
      impactedService: r.impactedService,
      impactedAgentId: r.impactedAgentId,
      rootCause: r.rootCause,
      mitigationSteps: r.mitigationSteps,
      acknowledgedBy: r.acknowledgedBy,
      acknowledgedAt: r.acknowledgedAt,
      resolvedBy: r.resolvedBy,
      resolvedAt: r.resolvedAt,
      occurrenceCount: r.occurrenceCount,
      metadata: (r.metadata as Record<string, unknown>) || {},
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async updateIncidentStatus(
    organizationId: string,
    id: string,
    status: IncidentStatus,
    userId?: string,
    mitigationSteps?: string,
  ): Promise<AgentIncidentEntity | null> {
    const existing = await this.context.db
      .select()
      .from(agentIncidents)
      .where(
        and(
          eq(agentIncidents.organizationId, organizationId),
          eq(agentIncidents.id, id),
        ),
      )
      .limit(1);

    if (!existing.length) return null;
    const now = new Date();
    const updateData: any = {
      status,
      updatedAt: now,
    };

    if (status === "acknowledged") {
      updateData.acknowledgedBy = userId || "system";
      updateData.acknowledgedAt = now;
    } else if (status === "mitigated") {
      if (mitigationSteps) updateData.mitigationSteps = mitigationSteps;
    } else if (status === "resolved") {
      updateData.resolvedBy = userId || "system";
      updateData.resolvedAt = now;
      if (mitigationSteps) updateData.mitigationSteps = mitigationSteps;
    }

    await this.context.db
      .update(agentIncidents)
      .set(updateData)
      .where(eq(agentIncidents.id, id));

    const updated = await this.context.db
      .select()
      .from(agentIncidents)
      .where(eq(agentIncidents.id, id))
      .limit(1);

    const r = updated[0];
    return {
      id: r.id,
      organizationId: r.organizationId,
      workspaceId: r.workspaceId,
      alertRuleId: r.alertRuleId,
      title: r.title,
      summary: r.summary,
      severity: r.severity,
      status: r.status,
      impactedService: r.impactedService,
      impactedAgentId: r.impactedAgentId,
      rootCause: r.rootCause,
      mitigationSteps: r.mitigationSteps,
      acknowledgedBy: r.acknowledgedBy,
      acknowledgedAt: r.acknowledgedAt,
      resolvedBy: r.resolvedBy,
      resolvedAt: r.resolvedAt,
      occurrenceCount: r.occurrenceCount,
      metadata: (r.metadata as Record<string, unknown>) || {},
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  // =========================================================================
  // 5. COST ATTRIBUTION INTELLIGENCE (Reusing ai_usage_ledger)
  // =========================================================================

  async getCostAttribution(organizationId: string, days: number = 30): Promise<AgentCostAttribution> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const ledgerRows = await this.context.db
      .select()
      .from(aiUsageLedger)
      .where(
        and(
          eq(aiUsageLedger.organizationId, organizationId),
          gte(aiUsageLedger.createdAt, cutoff),
        ),
      );

    let totalCostUsd = 0;
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    const agentMap = new Map<string, { cost: number; tokens: number; count: number }>();
    const providerMap = new Map<string, { cost: number; tokens: number }>();

    for (const row of ledgerRows) {
      const cost = Number(row.actualCostUsd || row.estimatedCostUsd || 0);
      const tokens = row.totalTokens || (row.promptTokens + row.completionTokens);
      totalCostUsd += cost;
      totalTokens += tokens;
      promptTokens += row.promptTokens;
      completionTokens += row.completionTokens;

      const agentId = row.agentId || "unattributed";
      const aData = agentMap.get(agentId) || { cost: 0, tokens: 0, count: 0 };
      aData.cost += cost;
      aData.tokens += tokens;
      aData.count += 1;
      agentMap.set(agentId, aData);

      const provKey = `${row.providerId}:${row.modelId}`;
      const pData = providerMap.get(provKey) || { cost: 0, tokens: 0 };
      pData.cost += cost;
      pData.tokens += tokens;
      providerMap.set(provKey, pData);
    }

    const byAgent = Array.from(agentMap.entries()).map(([agentId, data]) => ({
      agentId,
      costUsd: Number(data.cost.toFixed(4)),
      tokens: data.tokens,
      runsCount: data.count,
    }));

    const byProvider = Array.from(providerMap.entries()).map(([key, data]) => {
      const [providerId, modelId] = key.split(":");
      return {
        providerId,
        modelId,
        costUsd: Number(data.cost.toFixed(4)),
        tokens: data.tokens,
      };
    });

    const anomalyDetected = byAgent.some((a) => a.costUsd > 10.0);
    const anomalyReason = anomalyDetected ? "High single-entity spend exceeding $10 threshold" : undefined;

    return {
      organizationId,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      totalTokens,
      promptTokens,
      completionTokens,
      byAgent,
      byProvider,
      anomalyDetected,
      anomalyReason,
    };
  }
}
