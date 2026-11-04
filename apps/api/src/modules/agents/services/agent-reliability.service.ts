import type { AgentObservabilityRepository } from "../repositories/agent-observability.repository.js";
import type {
  AgentSloDefinitionEntity,
  AgentReliabilityMetricEntity,
  AgentAlertRuleEntity,
  AgentIncidentEntity,
  IncidentStatus,
} from "../observability.types.js";

export class AgentReliabilityService {
  constructor(private readonly repository: AgentObservabilityRepository) {}

  // =========================================================================
  // 1. SLO DEFINITIONS
  // =========================================================================

  async defineSlo(input: {
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
    return await this.repository.upsertSloDefinition(input);
  }

  async listSlos(organizationId: string): Promise<AgentSloDefinitionEntity[]> {
    return await this.repository.listSloDefinitions(organizationId);
  }

  // =========================================================================
  // 2. METRIC AGGREGATION & LATENCY PERCENTILES
  // =========================================================================

  calculatePercentiles(durations: number[]): { p50: number; p95: number; p99: number } {
    if (!durations.length) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
    };

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
    };
  }

  async aggregateMetrics(organizationId: string, windowMinutes: number = 60): Promise<AgentReliabilityMetricEntity> {
    const spans = await this.repository.getRecentSpans(organizationId, windowMinutes);
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

    const total = spans.length;
    let successful = 0;
    let failed = 0;
    const durations: number[] = [];

    for (const span of spans) {
      if (span.status === "error") {
        failed += 1;
      } else {
        successful += 1;
      }
      if (span.durationMs !== null && span.durationMs !== undefined) {
        durations.push(span.durationMs);
      }
    }

    const successRate = total > 0 ? Number(((successful / total) * 100).toFixed(2)) : 100;
    const percentiles = this.calculatePercentiles(durations);

    const metric = await this.repository.recordReliabilityMetric({
      organizationId,
      windowStart,
      windowEnd: now,
      totalRuns: total,
      successfulRuns: successful,
      failedRuns: failed,
      successRate,
      p50LatencyMs: percentiles.p50,
      p95LatencyMs: percentiles.p95,
      p99LatencyMs: percentiles.p99,
      activeWorkerCount: 1,
      queueBacklog: 0,
      staleLeasesReclaimed: 0,
      circuitBreakerTrips: 0,
      rateLimitHits: 0,
    });

    await this.evaluateAlertRules(organizationId, metric);

    return metric;
  }

  // =========================================================================
  // 3. ALERT RULES & INCIDENT DEDUPLICATION
  // =========================================================================

  async createAlertRule(input: {
    organizationId: string;
    workspaceId?: string;
    name: string;
    description?: string;
    metricName: string;
    conditionOperator: string;
    thresholdValue: number;
    evaluationWindowMinutes?: number;
    severity?: string;
    isEnabled?: boolean;
    channels?: string[];
  }): Promise<AgentAlertRuleEntity> {
    return await this.repository.upsertAlertRule(input);
  }

  async listAlertRules(organizationId: string): Promise<AgentAlertRuleEntity[]> {
    return await this.repository.listAlertRules(organizationId);
  }

  async evaluateAlertRules(organizationId: string, metric: AgentReliabilityMetricEntity): Promise<AgentIncidentEntity[]> {
    const rules = await this.repository.listAlertRules(organizationId);
    const triggeredIncidents: AgentIncidentEntity[] = [];

    for (const rule of rules) {
      if (!rule.isEnabled) continue;

      let metricVal = 0;
      if (rule.metricName === "availability" || rule.metricName === "successRate") {
        metricVal = metric.successRate;
      } else if (rule.metricName === "latency_p95" || rule.metricName === "p95LatencyMs") {
        metricVal = metric.p95LatencyMs;
      } else if (rule.metricName === "latency_p99" || rule.metricName === "p99LatencyMs") {
        metricVal = metric.p99LatencyMs;
      } else if (rule.metricName === "latency_p50" || rule.metricName === "p50LatencyMs") {
        metricVal = metric.p50LatencyMs;
      }

      let breached = false;
      if (rule.conditionOperator === "lt" && metricVal < rule.thresholdValue) breached = true;
      if (rule.conditionOperator === "lte" && metricVal <= rule.thresholdValue) breached = true;
      if (rule.conditionOperator === "gt" && metricVal > rule.thresholdValue) breached = true;
      if (rule.conditionOperator === "gte" && metricVal >= rule.thresholdValue) breached = true;
      if (rule.conditionOperator === "eq" && metricVal === rule.thresholdValue) breached = true;

      if (breached) {
        const incident = await this.repository.triggerOrDeduplicateIncident({
          organizationId,
          alertRuleId: rule.id,
          title: `Alert: ${rule.name}`,
          summary: `Threshold breached for ${rule.metricName}. Current: ${metricVal}, Threshold: ${rule.thresholdValue} (${rule.conditionOperator})`,
          severity: rule.severity,
          impactedService: "agent-runtime",
          rootCause: `Automated alert rule check triggered. Observed value: ${metricVal}`,
          metadata: {
            ruleName: rule.name,
            metricName: rule.metricName,
            totalRuns: metric.totalRuns,
            failedRuns: metric.failedRuns,
            p95LatencyMs: metric.p95LatencyMs,
          },
        });
        triggeredIncidents.push(incident);
      }
    }

    return triggeredIncidents;
  }

  // =========================================================================
  // 4. INCIDENT LIFECYCLE MANAGEMENT
  // =========================================================================

  async listIncidents(organizationId: string, status?: IncidentStatus) {
    return await this.repository.listIncidents(organizationId, { status });
  }

  async acknowledgeIncident(organizationId: string, incidentId: string, userId?: string) {
    return await this.repository.updateIncidentStatus(organizationId, incidentId, "acknowledged", userId);
  }

  async mitigateIncident(organizationId: string, incidentId: string, mitigationSteps: string) {
    return await this.repository.updateIncidentStatus(organizationId, incidentId, "mitigated", undefined, mitigationSteps);
  }

  async resolveIncident(organizationId: string, incidentId: string, userId?: string, notes?: string) {
    return await this.repository.updateIncidentStatus(organizationId, incidentId, "resolved", userId, notes);
  }
}
