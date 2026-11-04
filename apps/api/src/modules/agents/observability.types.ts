export type SpanKind = "internal" | "client" | "server" | "producer" | "consumer";
export type SpanStatus = "ok" | "error" | "unset";
export type AlertSeverity = "low" | "medium" | "high" | "critical" | string;
export type SloMetricType = string;
export type IncidentStatus = "open" | "acknowledged" | "mitigated" | "resolved";

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  traceFlags?: string;
}

export interface SpanEvent {
  name: string;
  timestamp: string;
  attributes?: Record<string, unknown>;
}

export interface AgentTraceSpanEntity {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  kind: string;
  status: string;
  statusCode: number;
  statusMessage?: string | null;
  durationMs: number;
  startTime: Date;
  endTime?: Date | null;
  serviceName: string;
  agentId?: string | null;
  agentRunId?: string | null;
  workflowRunId?: string | null;
  autonomousRunId?: string | null;
  autonomousTaskRunId?: string | null;
  attributes: Record<string, unknown>;
  events: Array<Record<string, unknown>>;
  createdAt: Date;
}

export interface CreateTraceSpanInput {
  organizationId: string;
  workspaceId?: string | null;
  traceId: string;
  spanId?: string;
  parentSpanId?: string | null;
  name: string;
  kind?: string;
  status?: string;
  statusCode?: number;
  statusMessage?: string | null;
  durationMs?: number;
  startTime?: Date;
  endTime?: Date | null;
  serviceName?: string;
  agentId?: string | null;
  agentRunId?: string | null;
  workflowRunId?: string | null;
  autonomousRunId?: string | null;
  autonomousTaskRunId?: string | null;
  attributes?: Record<string, unknown>;
  events?: Array<Record<string, unknown>>;
}

export interface EvaluationRubricWeights {
  groundingWeight: number; // default 0.35
  toolWeight: number;      // default 0.25
  schemaWeight: number;    // default 0.20
  safetyWeight: number;    // default 0.20
}

export interface AgentEvaluationDatasetEntity {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  targetType: string;
  targetId?: string | null;
  version: string | number;
  status: string;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
  domain?: string;
}

export interface AgentEvaluationCaseEntity {
  id: string;
  datasetId: string;
  organizationId: string;
  name: string;
  description?: string | null;
  inputPrompt: string;
  inputContext: Record<string, unknown>;
  expectedOutput?: string | null;
  expectedOutputSchema?: Record<string, unknown> | null;
  expectedTools: string[];
  requiredCitations: string[];
  gradingCriteria: Record<string, unknown>;
  orderIndex: number;
  createdAt: Date;
  prompt?: string;
  contextChunkIds?: string[];
  requiredKeywords?: string[];
  forbiddenKeywords?: string[];
  weight?: number;
}

export interface EvaluationCaseScoreDetail {
  caseId: string;
  caseName: string;
  groundingScore: number;
  toolScore: number;
  schemaScore: number;
  safetyScore: number;
  totalScore: number;
  passed: boolean;
  feedback: string[];
  citationsMatched: number;
  citationsExpected: number;
  toolsMatched: number;
  toolsExpected: number;
}

export interface AgentEvaluationRunEntity {
  id: string;
  datasetId: string;
  organizationId: string;
  workspaceId?: string | null;
  targetType: string;
  targetId?: string | null;
  status: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  overallScore: number;
  groundingScore: number;
  toolAccuracyScore: number;
  formatComplianceScore: number;
  isBaseline: boolean;
  comparedToRunId?: string | null;
  scoreDelta: number;
  summaryResults: Array<Record<string, unknown>> | any;
  evaluatedBy?: string | null;
  durationMs: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  targetAgentId?: string | null;
  targetWorkflowId?: string | null;
  metrics?: any;
  resultsSummary?: any;
}

export interface AgentSloDefinitionEntity {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  metricType: string;
  targetType: string;
  targetId?: string | null;
  targetValue: number;
  comparisonOperator: string;
  windowDurationMinutes: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  windowHours?: number;
  warningThreshold?: number;
  isEnabled?: boolean;
}

export interface AgentReliabilityMetricEntity {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  windowStart: Date;
  windowEnd: Date;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  activeWorkerCount: number;
  queueBacklog: number;
  staleLeasesReclaimed: number;
  circuitBreakerTrips: number;
  rateLimitHits: number;
  createdAt: Date;
  totalExecutions?: number;
  successfulExecutions?: number;
  failedExecutions?: number;
  errorBudgetBurnRate?: number;
  sloBreached?: boolean;
  timestamp?: Date;
}

export interface AgentAlertRuleEntity {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  name: string;
  description?: string | null;
  metricName: string;
  conditionOperator: string;
  thresholdValue: number;
  evaluationWindowMinutes: number;
  severity: string;
  isEnabled: boolean;
  channels: string[];
  createdAt: Date;
  updatedAt: Date;
  metricType?: string;
  comparisonOperator?: string;
  windowMinutes?: number;
}

export interface AgentIncidentEntity {
  id: string;
  organizationId: string;
  workspaceId?: string | null;
  alertRuleId?: string | null;
  title: string;
  summary: string;
  severity: string;
  status: string;
  impactedService: string;
  impactedAgentId?: string | null;
  rootCause?: string | null;
  mitigationSteps?: string | null;
  acknowledgedBy?: string | null;
  acknowledgedAt?: Date | null;
  resolvedBy?: string | null;
  resolvedAt?: Date | null;
  occurrenceCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  incidentKey?: string;
  currentValue?: number | null;
  thresholdValue?: number | null;
  recurrenceCount?: number;
  lastRecurredAt?: Date;
  rootCauseAnalysis?: Record<string, unknown> | null;
}

export interface AgentCostAttribution {
  organizationId: string;
  totalCostUsd: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  byAgent: Array<{ agentId: string; costUsd: number; tokens: number; runsCount: number }>;
  byProvider: Array<{ providerId: string; modelId: string; costUsd: number; tokens: number }>;
  anomalyDetected: boolean;
  anomalyReason?: string;
}
