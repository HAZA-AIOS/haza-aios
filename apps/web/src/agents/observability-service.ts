import { apiClient } from "../api/api-client";
import { readStoredAuth } from "../auth/auth-storage";

export interface WebTraceSpan {
  id: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  kind: string;
  status: string;
  statusCode?: number | null;
  statusMessage?: string | null;
  durationMs: number;
  startTime: string;
  endTime?: string | null;
  serviceName?: string;
  agentId?: string | null;
  agentRunId?: string | null;
  workflowRunId?: string | null;
  autonomousRunId?: string | null;
  attributes?: Record<string, unknown>;
  events?: Array<Record<string, unknown>>;
  children?: WebTraceSpan[];
}

export interface WebTraceTree {
  traceId: string;
  rootSpans: WebTraceSpan[];
  totalDurationMs: number;
  spanCount: number;
  errorCount: number;
}

export interface WebEvaluationDataset {
  id: string;
  name: string;
  description?: string | null;
  targetType: string;
  targetId?: string | null;
  version: string | number;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WebEvaluationCase {
  id: string;
  datasetId: string;
  name: string;
  description?: string | null;
  inputPrompt: string;
  expectedTools: string[];
  requiredCitations: string[];
  orderIndex: number;
}

export interface WebEvaluationRun {
  id: string;
  datasetId: string;
  organizationId: string;
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
  scoreDelta?: number | null;
  summaryResults?: any[];
  createdAt: string;
  completedAt?: string | null;
}

export interface WebSloDefinition {
  id: string;
  name: string;
  metricType: string;
  targetType: string;
  targetValue: number;
  comparisonOperator: string;
  windowDurationMinutes: number;
  status: string;
}

export interface WebReliabilityMetric {
  id: string;
  windowStart: string;
  windowEnd: string;
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
  createdAt: string;
}

export interface WebAlertRule {
  id: string;
  name: string;
  description?: string | null;
  metricName: string;
  conditionOperator: string;
  thresholdValue: number;
  evaluationWindowMinutes: number;
  severity: string;
  isEnabled: boolean;
  channels: string[];
}

export interface WebIncident {
  id: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  occurrenceCount: number;
  impactedService?: string;
  rootCause?: string | null;
  mitigationSteps?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebCostAttribution {
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

export class AgentObservabilityService {
  private getAuthToken(): string | undefined {
    return readStoredAuth()?.session?.accessToken ?? undefined;
  }

  // --- Traces & Spans ---
  async getTraceTree(organizationId: string, traceId: string): Promise<WebTraceTree> {
    const res = await apiClient.request<WebTraceTree>(
      `/api/v1/organizations/${organizationId}/agent-observability/traces/${traceId}`,
      { authToken: this.getAuthToken() },
    );
    return res;
  }

  async listSpans(organizationId: string, status?: string): Promise<WebTraceSpan[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await apiClient.request<{ spans: WebTraceSpan[] }>(
      `/api/v1/organizations/${organizationId}/agent-observability/spans${q}`,
      { authToken: this.getAuthToken() },
    );
    return res.spans;
  }

  // --- Evaluation ---
  async listDatasets(organizationId: string): Promise<WebEvaluationDataset[]> {
    const res = await apiClient.request<{ datasets: WebEvaluationDataset[] }>(
      `/api/v1/organizations/${organizationId}/agent-evaluation/datasets`,
      { authToken: this.getAuthToken() },
    );
    return res.datasets;
  }

  async createDataset(organizationId: string, payload: { name: string; description?: string; version?: string; domain?: string }): Promise<WebEvaluationDataset> {
    const res = await apiClient.request<{ dataset: WebEvaluationDataset }>(
      `/api/v1/organizations/${organizationId}/agent-evaluation/datasets`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        authToken: this.getAuthToken(),
      },
    );
    return res.dataset;
  }

  async listCases(organizationId: string, datasetId: string): Promise<WebEvaluationCase[]> {
    const res = await apiClient.request<{ cases: WebEvaluationCase[] }>(
      `/api/v1/organizations/${organizationId}/agent-evaluation/datasets/${datasetId}/cases`,
      { authToken: this.getAuthToken() },
    );
    return res.cases;
  }

  async runEvaluation(
    organizationId: string,
    payload: { datasetId: string; isBaseline?: boolean; targetId?: string },
  ): Promise<WebEvaluationRun> {
    const res = await apiClient.request<{ run: WebEvaluationRun }>(
      `/api/v1/organizations/${organizationId}/agent-evaluation/runs`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        authToken: this.getAuthToken(),
      },
    );
    return res.run;
  }

  async listEvaluationRuns(organizationId: string, datasetId?: string): Promise<WebEvaluationRun[]> {
    const q = datasetId ? `?datasetId=${encodeURIComponent(datasetId)}` : "";
    const res = await apiClient.request<{ runs: WebEvaluationRun[] }>(
      `/api/v1/organizations/${organizationId}/agent-evaluation/runs${q}`,
      { authToken: this.getAuthToken() },
    );
    return res.runs;
  }

  // --- Reliability & SLOs ---
  async listSlos(organizationId: string): Promise<WebSloDefinition[]> {
    const res = await apiClient.request<{ slos: WebSloDefinition[] }>(
      `/api/v1/organizations/${organizationId}/agent-reliability/slos`,
      { authToken: this.getAuthToken() },
    );
    return res.slos;
  }

  async getReliabilityMetrics(organizationId: string, windowMinutes: number = 60): Promise<WebReliabilityMetric> {
    const res = await apiClient.request<{ metric: WebReliabilityMetric }>(
      `/api/v1/organizations/${organizationId}/agent-reliability/metrics?windowMinutes=${windowMinutes}`,
      { authToken: this.getAuthToken() },
    );
    return res.metric;
  }

  async listAlertRules(organizationId: string): Promise<WebAlertRule[]> {
    const res = await apiClient.request<{ alertRules: WebAlertRule[] }>(
      `/api/v1/organizations/${organizationId}/agent-reliability/alert-rules`,
      { authToken: this.getAuthToken() },
    );
    return res.alertRules;
  }

  // --- Incidents ---
  async listIncidents(organizationId: string, status?: string): Promise<WebIncident[]> {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await apiClient.request<{ incidents: WebIncident[] }>(
      `/api/v1/organizations/${organizationId}/agent-reliability/incidents${q}`,
      { authToken: this.getAuthToken() },
    );
    return res.incidents;
  }

  async updateIncidentStatus(
    organizationId: string,
    incidentId: string,
    status: "acknowledged" | "mitigated" | "resolved",
    mitigationSteps?: string,
  ): Promise<WebIncident> {
    const res = await apiClient.request<{ incident: WebIncident }>(
      `/api/v1/organizations/${organizationId}/agent-reliability/incidents/${incidentId}/status`,
      {
        method: "PUT",
        body: JSON.stringify({ status, mitigationSteps }),
        authToken: this.getAuthToken(),
      },
    );
    return res.incident;
  }

  // --- Cost Intelligence ---
  async getCostAttribution(organizationId: string, days: number = 30): Promise<WebCostAttribution> {
    const res = await apiClient.request<{ costAttribution: WebCostAttribution }>(
      `/api/v1/organizations/${organizationId}/agent-cost/attribution?days=${days}`,
      { authToken: this.getAuthToken() },
    );
    return res.costAttribution;
  }
}

export const agentObservabilityService = new AgentObservabilityService();

