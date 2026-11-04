import { describe, expect, it, beforeEach } from "vitest";
import { AgentObservabilityService } from "../src/modules/agents/services/agent-observability.service.js";
import { AgentEvaluationService } from "../src/modules/agents/services/agent-evaluation.service.js";
import { AgentReliabilityService } from "../src/modules/agents/services/agent-reliability.service.js";
import { AgentCostService } from "../src/modules/agents/services/agent-cost.service.js";
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
} from "../src/modules/agents/observability.types.js";

describe("Epic 21: Agent Operations Observability, Evaluation & Reliability", () => {
  const ORG_A = "00000000-0000-4801-a000-000000000001";
  const WORKSPACE_ID = "00000000-0000-4801-w000-000000000001";
  const USER_ID = "00000000-0000-4801-u000-000000000001";

  // In-memory Stores
  let spanStore: Map<string, AgentTraceSpanEntity>;
  let datasetStore: Map<string, AgentEvaluationDatasetEntity>;
  let caseStore: Map<string, AgentEvaluationCaseEntity[]>;
  let runStore: Map<string, AgentEvaluationRunEntity[]>;
  let sloStore: Map<string, AgentSloDefinitionEntity>;
  let metricStore: AgentReliabilityMetricEntity[];
  let alertRuleStore: Map<string, AgentAlertRuleEntity>;
  let incidentStore: Map<string, AgentIncidentEntity>;

  let mockRepo: any;
  let observabilityService: AgentObservabilityService;
  let evaluationService: AgentEvaluationService;
  let reliabilityService: AgentReliabilityService;
  let costService: AgentCostService;

  beforeEach(() => {
    spanStore = new Map();
    datasetStore = new Map();
    caseStore = new Map();
    runStore = new Map();
    sloStore = new Map();
    metricStore = [];
    alertRuleStore = new Map();
    incidentStore = new Map();

    mockRepo = {
      // 1. Spans
      createSpan: async (input: CreateTraceSpanInput) => {
        const id = `span-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const entity: AgentTraceSpanEntity = {
          id,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || WORKSPACE_ID,
          traceId: input.traceId,
          spanId: input.spanId || "sp-" + Math.random().toString(36).substring(2, 10),
          parentSpanId: input.parentSpanId || null,
          name: input.name,
          kind: input.kind || "internal",
          status: input.status || "ok",
          statusCode: input.statusCode || 0,
          statusMessage: input.statusMessage || null,
          durationMs: input.durationMs || 10,
          startTime: input.startTime || new Date(),
          endTime: input.endTime || new Date(),
          serviceName: input.serviceName || "haza-aios-agent",
          agentId: input.agentId || null,
          agentRunId: input.agentRunId || null,
          workflowRunId: input.workflowRunId || null,
          autonomousRunId: input.autonomousRunId || null,
          attributes: input.attributes || {},
          events: input.events || [],
          createdAt: new Date(),
        };
        spanStore.set(entity.spanId, entity);
        return entity;
      },

      listSpansByTraceId: async (orgId: string, traceId: string) => {
        return Array.from(spanStore.values()).filter(
          (s) => s.organizationId === orgId && s.traceId === traceId,
        );
      },

      listSpans: async (orgId: string) => {
        return Array.from(spanStore.values()).filter((s) => s.organizationId === orgId);
      },

      getRecentSpans: async (orgId: string) => {
        return Array.from(spanStore.values()).filter((s) => s.organizationId === orgId);
      },

      // 2. Evaluation
      createEvaluationDataset: async (input: any) => {
        const id = `ds-${Date.now()}`;
        const entity: AgentEvaluationDatasetEntity = {
          id,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || WORKSPACE_ID,
          name: input.name,
          description: input.description || null,
          targetType: input.targetType || "agent",
          targetId: input.targetId || null,
          version: input.version || "1.0.0",
          status: input.status || "active",
          metadata: input.metadata || {},
          createdBy: input.createdBy || USER_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        datasetStore.set(id, entity);
        return entity;
      },

      listEvaluationDatasets: async (orgId: string) => {
        return Array.from(datasetStore.values()).filter((d) => d.organizationId === orgId);
      },

      createEvaluationCase: async (input: any) => {
        const id = `case-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const entity: AgentEvaluationCaseEntity = {
          id,
          datasetId: input.datasetId,
          organizationId: input.organizationId,
          name: input.name,
          description: input.description || null,
          inputPrompt: input.inputPrompt || input.prompt || "",
          inputContext: input.inputContext || {},
          expectedOutput: input.expectedOutput || null,
          expectedOutputSchema: input.expectedOutputSchema || null,
          expectedTools: input.expectedTools || [],
          requiredCitations: input.requiredCitations || input.contextChunkIds || [],
          gradingCriteria: input.gradingCriteria || {},
          orderIndex: input.orderIndex || 0,
          createdAt: new Date(),
        };
        const list = caseStore.get(input.datasetId) || [];
        list.push(entity);
        caseStore.set(input.datasetId, list);
        return entity;
      },

      listEvaluationCases: async (datasetId: string) => {
        return caseStore.get(datasetId) || [];
      },

      createEvaluationRun: async (input: any) => {
        const id = `run-${Date.now()}`;
        const entity: AgentEvaluationRunEntity = {
          id,
          datasetId: input.datasetId,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || WORKSPACE_ID,
          targetType: input.targetType || "agent",
          targetId: input.targetId || null,
          status: input.status || "completed",
          totalCases: input.totalCases,
          passedCases: input.passedCases,
          failedCases: input.failedCases,
          overallScore: input.overallScore,
          groundingScore: input.groundingScore || 0,
          toolAccuracyScore: input.toolAccuracyScore || 0,
          formatComplianceScore: input.formatComplianceScore || 0,
          isBaseline: Boolean(input.isBaseline),
          comparedToRunId: input.comparedToRunId || null,
          scoreDelta: input.scoreDelta ?? 0,
          summaryResults: input.summaryResults || [],
          evaluatedBy: input.evaluatedBy || USER_ID,
          durationMs: input.durationMs || 100,
          startedAt: new Date(),
          completedAt: new Date(),
          createdAt: new Date(),
        };
        const list = runStore.get(input.datasetId) || [];
        list.push(entity);
        runStore.set(input.datasetId, list);
        return entity;
      },

      getLatestBaselineRun: async (_orgId: string, datasetId: string) => {
        const list = runStore.get(datasetId) || [];
        const baselines = list.filter((r) => r.isBaseline);
        return baselines.length > 0 ? baselines[baselines.length - 1] : null;
      },

      listEvaluationRuns: async (_orgId: string, datasetId?: string) => {
        if (datasetId) return runStore.get(datasetId) || [];
        return Array.from(runStore.values()).flat();
      },

      // 3. Reliability & SLOs
      upsertSloDefinition: async (input: any) => {
        const id = `slo-${input.name}`;
        const entity: AgentSloDefinitionEntity = {
          id,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || WORKSPACE_ID,
          name: input.name,
          description: input.description || null,
          metricType: input.metricType,
          targetType: input.targetType || "all",
          targetId: input.targetId || null,
          targetValue: input.targetValue,
          comparisonOperator: input.comparisonOperator || "gte",
          windowDurationMinutes: input.windowDurationMinutes || 1440,
          status: input.status || "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        sloStore.set(id, entity);
        return entity;
      },

      listSloDefinitions: async (orgId: string) => {
        return Array.from(sloStore.values()).filter((s) => s.organizationId === orgId);
      },

      recordReliabilityMetric: async (input: any) => {
        const id = `metric-${Date.now()}`;
        const entity: AgentReliabilityMetricEntity = {
          id,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || WORKSPACE_ID,
          windowStart: input.windowStart,
          windowEnd: input.windowEnd,
          totalRuns: input.totalRuns || 0,
          successfulRuns: input.successfulRuns || 0,
          failedRuns: input.failedRuns || 0,
          successRate: input.successRate || 100,
          p50LatencyMs: input.p50LatencyMs || 0,
          p95LatencyMs: input.p95LatencyMs || 0,
          p99LatencyMs: input.p99LatencyMs || 0,
          activeWorkerCount: 1,
          queueBacklog: 0,
          staleLeasesReclaimed: 0,
          circuitBreakerTrips: 0,
          rateLimitHits: 0,
          createdAt: new Date(),
        };
        metricStore.push(entity);
        return entity;
      },

      getLatestReliabilityMetrics: async (_orgId: string) => {
        return [...metricStore].reverse();
      },

      upsertAlertRule: async (input: any) => {
        const id = `rule-${input.name}`;
        const entity: AgentAlertRuleEntity = {
          id,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || WORKSPACE_ID,
          name: input.name,
          description: input.description || null,
          metricName: input.metricName || input.metricType || "availability",
          conditionOperator: input.conditionOperator || "gt",
          thresholdValue: input.thresholdValue,
          evaluationWindowMinutes: input.evaluationWindowMinutes || 15,
          severity: input.severity || "warning",
          isEnabled: input.isEnabled !== undefined ? input.isEnabled : true,
          channels: input.channels || ["in_app"],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        alertRuleStore.set(id, entity);
        return entity;
      },

      listAlertRules: async (orgId: string) => {
        return Array.from(alertRuleStore.values()).filter((r) => r.organizationId === orgId);
      },

      // 4. Incident Management & Deduplication
      triggerOrDeduplicateIncident: async (input: any) => {
        const existing = Array.from(incidentStore.values()).find(
          (i) => i.title === input.title && (i.status === "open" || i.status === "acknowledged"),
        );

        if (existing) {
          existing.occurrenceCount += 1;
          existing.summary = input.summary;
          existing.updatedAt = new Date();
          return existing;
        }

        const id = `inc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const entity: AgentIncidentEntity = {
          id,
          organizationId: input.organizationId,
          workspaceId: input.workspaceId || WORKSPACE_ID,
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
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        incidentStore.set(id, entity);
        return entity;
      },

      listIncidents: async (orgId: string, options: any = {}) => {
        return Array.from(incidentStore.values()).filter((i) => {
          if (i.organizationId !== orgId) return false;
          if (options.status && i.status !== options.status) return false;
          return true;
        });
      },

      updateIncidentStatus: async (
        _orgId: string,
        id: string,
        status: any,
        userId?: string,
        mitigationSteps?: string,
      ) => {
        const incident = incidentStore.get(id);
        if (!incident) return null;

        incident.status = status;
        incident.updatedAt = new Date();
        if (status === "acknowledged") {
          incident.acknowledgedBy = userId || USER_ID;
          incident.acknowledgedAt = new Date();
        } else if (status === "resolved") {
          incident.resolvedBy = userId || USER_ID;
          incident.resolvedAt = new Date();
          if (mitigationSteps) incident.mitigationSteps = mitigationSteps;
        }
        return incident;
      },

      // 5. Cost Attribution
      getCostAttribution: async (orgId: string) => {
        return {
          organizationId: orgId,
          totalCostUsd: 12.45,
          totalTokens: 250000,
          promptTokens: 180000,
          completionTokens: 70000,
          byAgent: [
            { agentId: "agent-academic-planner", costUsd: 8.5, tokens: 170000, runsCount: 42 },
            { agentId: "agent-lesson-specialist", costUsd: 3.95, tokens: 80000, runsCount: 20 },
          ],
          byProvider: [
            { providerId: "openai", modelId: "gpt-4o", costUsd: 11.2, tokens: 200000 },
            { providerId: "openai", modelId: "text-embedding-3-small", costUsd: 1.25, tokens: 50000 },
          ],
          anomalyDetected: false,
        };
      },
    };

    observabilityService = new AgentObservabilityService(mockRepo);
    evaluationService = new AgentEvaluationService(mockRepo);
    reliabilityService = new AgentReliabilityService(mockRepo);
    costService = new AgentCostService(mockRepo);
  });

  // =========================================================================
  // 1. W3C TRACEPARENT PROTOCOL & DISTRIBUTED TRACING
  // =========================================================================

  describe("Phase 21A: Distributed Tracing & W3C Traceparent", () => {
    it("generates a conformant W3C traceparent header and context", () => {
      const { traceparent, context } = observabilityService.generateTraceparent();

      expect(traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/);
      expect(context.traceId).toHaveLength(32);
      expect(context.spanId).toHaveLength(16);
      expect(context.traceFlags).toBe("01");
    });

    it("parses valid incoming traceparent header correctly", () => {
      const incoming = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
      const ctx = observabilityService.parseTraceparent(incoming);

      expect(ctx.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
      expect(ctx.spanId).toBe("00f067aa0ba902b7");
      expect(ctx.traceFlags).toBe("01");
    });

    it("deeply redacts API keys, tokens, and database credentials from telemetry", () => {
      const sensitiveData = {
        apiKey: "sk-proj-abc1234567890abcdef1234567890",
        nested: {
          authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token1234567890",
          dbUrl: "mysql://user:super_secret_pw@db.railway.internal:3306/production",
          safeField: "academic_lesson_plan",
        },
        userPassword: "PlainPassword123!",
      };

      const redacted = observabilityService.redactSecrets(sensitiveData);

      expect(redacted.apiKey).toBe("sk-...REDACTED");
      expect(redacted.nested.authHeader).toBe("Bearer ...REDACTED");
      expect(redacted.nested.dbUrl).toContain("mysql://[USER]:[REDACTED]@db.railway.internal:3306");
      expect(redacted.nested.safeField).toBe("academic_lesson_plan");
      expect(redacted.userPassword).toBe("[REDACTED_CREDENTIAL]");
    });

    it("assembles nested spans into a hierarchical parent-child waterfall execution tree", async () => {
      const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";

      // Root workflow span
      const rootSpan = await observabilityService.recordSpan({
        organizationId: ORG_A,
        traceId,
        spanId: "0000000000000001",
        parentSpanId: null,
        name: "workflow.run",
        kind: "internal",
        durationMs: 1200,
      });

      // Child step span
      const stepSpan = await observabilityService.recordSpan({
        organizationId: ORG_A,
        traceId,
        spanId: "0000000000000002",
        parentSpanId: rootSpan.spanId,
        name: "step.execute",
        kind: "internal",
        durationMs: 650,
      });

      // Child tool span
      await observabilityService.recordSpan({
        organizationId: ORG_A,
        traceId,
        spanId: "0000000000000003",
        parentSpanId: stepSpan.spanId,
        name: "tool.call",
        kind: "client",
        status: "ok",
        durationMs: 180,
      });

      const tree = await observabilityService.getTraceTree(ORG_A, traceId);

      expect(tree.traceId).toBe(traceId);
      expect(tree.spanCount).toBe(3);
      expect(tree.rootSpans).toHaveLength(1);
      expect(tree.rootSpans[0].name).toBe("workflow.run");
      expect(tree.rootSpans[0].children).toHaveLength(1);
      expect(tree.rootSpans[0].children[0].name).toBe("step.execute");
      expect(tree.rootSpans[0].children[0].children).toHaveLength(1);
      expect(tree.rootSpans[0].children[0].children[0].name).toBe("tool.call");
    });
  });

  // =========================================================================
  // 2. DETERMINISTIC AGENT EVALUATION ENGINE
  // =========================================================================

  describe("Phase 21B: Deterministic Agent Evaluation Engine", () => {
    it("grades test cases accurately according to grounding, tools, and schema", () => {
      const testCase: AgentEvaluationCaseEntity = {
        id: "c-1",
        datasetId: "ds-1",
        organizationId: ORG_A,
        name: "Grade 6 Science Lesson Plan",
        inputPrompt: "Generate a unit plan for photosynthesis.",
        inputContext: {},
        expectedTools: ["academic_standards_search", "lms_lesson_draft_save"],
        requiredCitations: ["doc-chunk-001", "doc-chunk-002"],
        expectedOutputSchema: { title: "string", grade: "number", objectives: "array" },
        gradingCriteria: {
          requiredKeywords: ["chlorophyll", "light energy"],
          forbiddenKeywords: ["unauthorized_mutation"],
        },
        orderIndex: 0,
        createdAt: new Date(),
      };

      const compliantOutput = {
        outputText: "Unit plan for Photosynthesis. Cells absorb light energy using chlorophyll.",
        invokedTools: ["academic_standards_search", "lms_lesson_draft_save"],
        citedChunkIds: ["doc-chunk-001", "doc-chunk-002"],
        outputJson: { title: "Photosynthesis", grade: 6, objectives: ["Understand light reaction"] },
        escalationAttempted: false,
      };

      const result = evaluationService.evaluateCase(testCase, compliantOutput);

      expect(result.groundingScore).toBe(100);
      expect(result.toolScore).toBe(100);
      expect(result.schemaScore).toBe(100);
      expect(result.safetyScore).toBe(100);
      expect(result.totalScore).toBe(100);
      expect(result.passed).toBe(true);
    });

    it("penalizes ungrounded citations and missing tools", () => {
      const testCase: AgentEvaluationCaseEntity = {
        id: "c-2",
        datasetId: "ds-1",
        organizationId: ORG_A,
        name: "Grounded Science Activity",
        inputPrompt: "Explain cellular respiration",
        inputContext: {},
        expectedTools: ["academic_standards_search"],
        requiredCitations: ["doc-chunk-100"],
        expectedOutputSchema: {},
        gradingCriteria: {},
        orderIndex: 0,
        createdAt: new Date(),
      };

      const flawedOutput = {
        outputText: "Cellular respiration produces ATP.",
        invokedTools: [], // missing required tool
        citedChunkIds: ["doc-chunk-100", "hallucinated-doc-999"], // 1 valid, 1 hallucinated
        escalationAttempted: false,
      };

      const result = evaluationService.evaluateCase(testCase, flawedOutput);

      expect(result.toolScore).toBe(0); // missing tool
      expect(result.groundingScore).toBeLessThan(100); // hallucination penalty
      expect(result.feedback.length).toBeGreaterThan(0);
    });

    it("detects performance regression (> 5% drop) and triggers automated incident", async () => {
      const dataset = await evaluationService.createDataset({
        organizationId: ORG_A,
        name: "Grade 6 Curriculum Golden Benchmark",
        version: "1.0.0",
      });

      await evaluationService.addCase({
        datasetId: dataset.id,
        organizationId: ORG_A,
        name: "Living Systems Unit Plan",
        inputPrompt: "Generate living systems plan",
        expectedTools: ["academic_standards_search"],
        requiredCitations: ["chunk-1"],
      });

      // 1. Establish high baseline run (100%)
      const baselineRun = await evaluationService.runEvaluationSuite({
        organizationId: ORG_A,
        datasetId: dataset.id,
        isBaseline: true,
      });

      expect(baselineRun.isBaseline).toBe(true);
      expect(baselineRun.overallScore).toBe(100);

      // 2. Execute flawed run that regresses score below 90% (delta < -5%)
      const regressedRun = await evaluationService.runEvaluationSuite({
        organizationId: ORG_A,
        datasetId: dataset.id,
        isBaseline: false,
        mockResultsByCaseId: {
          [caseStore.get(dataset.id)![0].id]: {
            outputText: "No keywords",
            invokedTools: [], // missing tool -> toolScore = 0
            citedChunkIds: [], // missing citations -> groundingScore = 0
            escalationAttempted: true, // safety = 0
          },
        },
      });

      expect(regressedRun.overallScore).toBeLessThan(50);
      expect(regressedRun.scoreDelta).toBeLessThan(-5.0);

      // Verify regression incident created
      const incidents = await mockRepo.listIncidents(ORG_A);
      const regressionIncident = incidents.find((i: AgentIncidentEntity) =>
        i.title.includes("Agent Evaluation Regression"),
      );

      expect(regressionIncident).toBeDefined();
      expect(regressionIncident.severity).toBe("high");
    });
  });

  // =========================================================================
  // 3. RELIABILITY, SLOS & INCIDENT DEDUPLICATION
  // =========================================================================

  describe("Phase 21C: Reliability, SLOs & Incident Deduplication", () => {
    it("accurately computes p50, p95, p99 latency percentiles", () => {
      const durations = [100, 150, 200, 250, 300, 350, 400, 450, 500, 1000];
      const { p50, p95, p99 } = reliabilityService.calculatePercentiles(durations);

      expect(p50).toBe(300);
      expect(p95).toBe(1000);
      expect(p99).toBe(1000);
    });

    it("aggregates spans into reliability metrics and evaluates SLO compliance", async () => {
      // Record 19 successful spans and 1 failed span (95% success rate)
      for (let i = 0; i < 19; i++) {
        await observabilityService.recordSpan({
          organizationId: ORG_A,
          traceId: `tr-${i}`,
          spanId: `sp-${i}`,
          name: "agent.reasoning",
          status: "ok",
          durationMs: 300 + i * 20,
        });
      }
      await observabilityService.recordSpan({
        organizationId: ORG_A,
        traceId: "tr-fail",
        spanId: "sp-fail",
        name: "agent.reasoning",
        status: "error",
        durationMs: 1500,
      });

      const metric = await reliabilityService.aggregateMetrics(ORG_A, 60);

      expect(metric.totalRuns).toBe(20);
      expect(metric.successfulRuns).toBe(19);
      expect(metric.failedRuns).toBe(1);
      expect(metric.successRate).toBe(95);
      expect(metric.p95LatencyMs).toBeGreaterThan(600);
    });

    it("deduplicates alerts for identical breach conditions into recurring incident counter", async () => {
      // Trigger breach 1
      const inc1 = await mockRepo.triggerOrDeduplicateIncident({
        organizationId: ORG_A,
        title: "Availability SLO Breached",
        summary: "Current availability 94.2% is below 99.5% target",
        severity: "critical",
      });

      expect(inc1.occurrenceCount).toBe(1);
      expect(inc1.status).toBe("open");

      // Trigger identical breach 2 (e.g. 5 minutes later)
      const inc2 = await mockRepo.triggerOrDeduplicateIncident({
        organizationId: ORG_A,
        title: "Availability SLO Breached",
        summary: "Current availability 93.8% is below 99.5% target",
        severity: "critical",
      });

      expect(inc2.id).toBe(inc1.id); // Same deduplicated incident
      expect(inc2.occurrenceCount).toBe(2); // Occurrence counter incremented
      expect(incidentStore.size).toBe(1); // No spam duplicate records created
    });

    it("transitions incident lifecycle from open -> acknowledged -> resolved", async () => {
      const inc = await mockRepo.triggerOrDeduplicateIncident({
        organizationId: ORG_A,
        title: "Upstream AI Provider Latency Spike",
        summary: "P95 latency exceeded 5000ms",
        severity: "high",
      });

      expect(inc.status).toBe("open");

      // Operator acknowledges
      const acked = await reliabilityService.acknowledgeIncident(ORG_A, inc.id, USER_ID);
      expect(acked?.status).toBe("acknowledged");
      expect(acked?.acknowledgedBy).toBe(USER_ID);

      // Operator resolves
      const resolved = await reliabilityService.resolveIncident(
        ORG_A,
        inc.id,
        USER_ID,
        "Applied provider gateway fallback circuit breaker",
      );
      expect(resolved?.status).toBe("resolved");
      expect(resolved?.resolvedBy).toBe(USER_ID);
      expect(resolved?.mitigationSteps).toContain("fallback circuit breaker");
    });
  });

  // =========================================================================
  // 4. COST INTELLIGENCE ATTRIBUTION
  // =========================================================================

  describe("Phase 21D: Cost & Performance Intelligence", () => {
    it("retrieves multi-dimensional cost attribution by agent and model provider", async () => {
      const attribution: AgentCostAttribution = await costService.getCostAttribution(ORG_A, 30);

      expect(attribution.organizationId).toBe(ORG_A);
      expect(attribution.totalCostUsd).toBe(12.45);
      expect(attribution.totalTokens).toBe(250000);
      expect(attribution.byAgent).toHaveLength(2);
      expect(attribution.byAgent[0].agentId).toBe("agent-academic-planner");
      expect(attribution.byProvider).toHaveLength(2);
      expect(attribution.byProvider[0].providerId).toBe("openai");
      expect(attribution.anomalyDetected).toBe(false);
    });
  });
});
