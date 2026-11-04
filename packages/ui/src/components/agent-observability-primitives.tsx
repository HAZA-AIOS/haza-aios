import * as React from "react";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";

// =========================================================================
// 1. DISTRIBUTED TRACE WATERFALL VIEWER
// =========================================================================

export interface TraceSpanNode {
  id: string;
  spanId: string;
  parentSpanId?: string | null;
  name: string;
  kind: string;
  status: string;
  statusCode?: number | null;
  statusMessage?: string | null;
  durationMs: number;
  startTime: string | Date;
  serviceName?: string;
  attributes?: Record<string, unknown>;
  events?: Array<Record<string, unknown>>;
  children?: TraceSpanNode[];
}

export interface TraceWaterfallViewerProps {
  traceId: string;
  rootSpans: TraceSpanNode[];
  totalDurationMs: number;
  className?: string;
}

export function TraceWaterfallViewer({
  traceId,
  rootSpans,
  totalDurationMs,
  className = "",
}: TraceWaterfallViewerProps) {
  const [expandedSpans, setExpandedSpans] = React.useState<Record<string, boolean>>({});

  const toggleExpand = (spanId: string) => {
    setExpandedSpans((prev) => ({ ...prev, [spanId]: !prev[spanId] }));
  };

  const renderSpan = (span: TraceSpanNode, depth = 0) => {
    const isExpanded = !!expandedSpans[span.spanId];
    const isError = span.status === "error";
    const durationPercent =
      totalDurationMs > 0 ? Math.min(100, Math.max(5, (span.durationMs / totalDurationMs) * 100)) : 100;

    return (
      <div key={span.spanId} className="flex flex-col border-b border-border/20 last:border-b-0">
        <div
          onClick={() => toggleExpand(span.spanId)}
          className={`flex items-center gap-3 py-2.5 px-3 hover:bg-muted/30 cursor-pointer transition-colors ${
            isError ? "bg-rose-950/20" : ""
          }`}
          style={{ paddingLeft: `${Math.max(12, depth * 24 + 12)}px` }}
        >
          {/* Depth / Expand icon */}
          <span className="text-xs text-muted-foreground w-4 text-center font-mono">
            {span.children && span.children.length > 0 ? (isExpanded ? "▼" : "▶") : "•"}
          </span>

          {/* Span Name & Kind */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-[200px]">
            <span className="font-medium text-sm text-foreground">{span.name}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-secondary/60 text-secondary-foreground border border-border/40">
              {span.kind}
            </span>
          </div>

          {/* Duration Bar */}
          <div className="flex-1 mx-3 hidden md:flex items-center gap-2">
            <div className="flex-1 bg-muted/40 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isError ? "bg-rose-500" : "bg-emerald-500/80"
                }`}
                style={{ width: `${durationPercent}%` }}
              />
            </div>
            <span className="text-xs font-mono text-muted-foreground whitespace-nowrap min-w-[55px] text-right">
              {span.durationMs}ms
            </span>
          </div>

          {/* Status Badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
              isError
                ? "bg-rose-950/80 text-rose-400 border border-rose-800"
                : "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
            }`}
          >
            {span.status}
          </span>
        </div>

        {/* Expanded Metadata Details */}
        {isExpanded && (
          <div
            className="bg-card/40 border-t border-border/20 p-3 text-xs space-y-2 font-mono"
            style={{ paddingLeft: `${Math.max(24, depth * 24 + 36)}px` }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
              <div>
                <span className="text-foreground/70">Span ID:</span> {span.spanId}
              </div>
              {span.parentSpanId && (
                <div>
                  <span className="text-foreground/70">Parent Span ID:</span> {span.parentSpanId}
                </div>
              )}
              <div>
                <span className="text-foreground/70">Duration:</span> {span.durationMs}ms
              </div>
              {span.statusCode !== undefined && span.statusCode !== null && (
                <div>
                  <span className="text-foreground/70">Status Code:</span> {span.statusCode}
                </div>
              )}
            </div>

            {span.statusMessage && (
              <div className="p-2 rounded bg-rose-950/30 border border-rose-800/40 text-rose-300">
                <strong>Error:</strong> {span.statusMessage}
              </div>
            )}

            {span.attributes && Object.keys(span.attributes).length > 0 && (
              <div>
                <div className="font-semibold text-foreground/80 mb-1">Sanitized Attributes:</div>
                <pre className="p-2 rounded bg-black/40 border border-border/30 overflow-x-auto text-[11px] text-slate-300">
                  {JSON.stringify(span.attributes, null, 2)}
                </pre>
              </div>
            )}

            {span.events && span.events.length > 0 && (
              <div>
                <div className="font-semibold text-foreground/80 mb-1">In-Span Events:</div>
                <div className="space-y-1">
                  {span.events.map((evt, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-sky-400">[{String(evt.name || "event")}]</span>
                      <span>{String(evt.timestamp || "")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nested Child Spans */}
        {span.children &&
          span.children.length > 0 &&
          span.children.map((child) => renderSpan(child, depth + 1))}
      </div>
    );
  };

  return (
    <Card className={`border border-border/40 bg-card/40 backdrop-blur-md overflow-hidden ${className}`}>
      <div className="p-4 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <span>Execution Trace Waterfall</span>
            <span className="text-xs font-mono text-muted-foreground">({traceId.substring(0, 16)}...)</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Distributed span hierarchy with deep secret redaction and duration telemetry
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">
            Total Duration: <strong className="text-foreground">{totalDurationMs}ms</strong>
          </span>
        </div>
      </div>
      <div className="divide-y divide-border/20">
        {rootSpans.length > 0 ? (
          rootSpans.map((root) => renderSpan(root, 0))
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No spans recorded for trace {traceId}
          </div>
        )}
      </div>
    </Card>
  );
}

// =========================================================================
// 2. SLO HEALTH CARD
// =========================================================================

export interface SloHealthCardProps {
  name: string;
  metricType: string;
  targetValue: number;
  currentValue: number;
  unit?: string;
  windowHours?: number;
  burnRate?: number;
  className?: string;
}

export function SloHealthCard({
  name,
  metricType,
  targetValue,
  currentValue,
  unit = "%",
  windowHours = 24,
  burnRate = 0,
  className = "",
}: SloHealthCardProps) {
  const isLatency = metricType.includes("latency");
  const isCompliant = isLatency ? currentValue <= targetValue : currentValue >= targetValue;
  const isWarning = isLatency ? currentValue > targetValue * 0.9 : currentValue < targetValue * 1.05;

  let statusLabel = "Compliant";
  let statusBadgeClass = "bg-emerald-950/70 text-emerald-400 border-emerald-800/70";

  if (!isCompliant) {
    statusLabel = "Breached";
    statusBadgeClass = "bg-rose-950/70 text-rose-400 border-rose-800/70";
  } else if (isWarning) {
    statusLabel = "Warning";
    statusBadgeClass = "bg-amber-950/70 text-amber-400 border-amber-800/70";
  }

  return (
    <Card className={`p-4 border border-border/40 bg-card/40 backdrop-blur-md flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-semibold text-sm text-foreground">{name}</h4>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${statusBadgeClass}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3 font-mono capitalize">
          Target: {targetValue}
          {unit} ({windowHours}h window)
        </p>
      </div>

      <div className="space-y-2 mt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
            {currentValue.toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground ml-0.5">{unit}</span>
          </span>
          {burnRate > 0 && (
            <span
              className={`text-xs font-mono px-1.5 py-0.5 rounded border ${
                burnRate > 5.0
                  ? "bg-rose-950/60 text-rose-400 border-rose-800"
                  : burnRate > 1.0
                  ? "bg-amber-950/60 text-amber-400 border-amber-800"
                  : "bg-muted text-muted-foreground border-border/40"
              }`}
            >
              Burn: {burnRate.toFixed(1)}x
            </span>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted/40 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              !isCompliant ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{
              width: `${Math.min(100, isLatency ? (targetValue / Math.max(1, currentValue)) * 100 : currentValue)}%`,
            }}
          />
        </div>
      </div>
    </Card>
  );
}

// =========================================================================
// 3. EVALUATION BENCHMARK CARD
// =========================================================================

export interface EvaluationBenchmarkCardProps {
  datasetName: string;
  version: string | number;
  overallScore: number;
  groundingScore: number;
  toolAccuracyScore: number;
  schemaScore: number;
  safetyScore: number;
  isBaseline?: boolean;
  scoreDelta?: number;
  totalCases: number;
  passedCases: number;
  onRunBenchmark?: () => void;
  isRunning?: boolean;
  className?: string;
}

export function EvaluationBenchmarkCard({
  datasetName,
  version,
  overallScore,
  groundingScore,
  toolAccuracyScore,
  schemaScore,
  safetyScore,
  isBaseline = false,
  scoreDelta,
  totalCases,
  passedCases,
  onRunBenchmark,
  isRunning = false,
  className = "",
}: EvaluationBenchmarkCardProps) {
  const isRegression = scoreDelta !== undefined && scoreDelta !== null && scoreDelta < -5.0;

  return (
    <Card className={`p-5 border border-border/40 bg-card/40 backdrop-blur-md ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-base text-foreground">{datasetName}</h4>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border/30 font-mono">
              v{version}
            </span>
            {isBaseline && (
              <span className="text-xs px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800 font-semibold uppercase">
                Baseline
              </span>
            )}
            {scoreDelta !== undefined && scoreDelta !== null && (
              <span
                className={`text-xs px-2 py-0.5 rounded font-mono font-semibold border ${
                  isRegression
                    ? "bg-rose-950/80 text-rose-400 border-rose-800 animate-pulse"
                    : scoreDelta >= 0
                    ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
                    : "bg-muted text-muted-foreground border-border/40"
                }`}
              >
                {scoreDelta >= 0 ? `+${scoreDelta.toFixed(1)}%` : `${scoreDelta.toFixed(1)}%`}
                {isRegression && " (Regression Alert)"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Deterministic rule-based benchmark • {passedCases}/{totalCases} test cases passed
          </p>
        </div>

        {onRunBenchmark && (
          <Button
            size="sm"
            onClick={onRunBenchmark}
            disabled={isRunning}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            {isRunning ? "Evaluating..." : "Run Benchmark"}
          </Button>
        )}
      </div>

      {/* Score Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-border/30">
        <div className="p-3 rounded-xl bg-muted/20 border border-border/30 text-center col-span-2 sm:col-span-1">
          <span className="text-[11px] text-muted-foreground font-mono uppercase">Overall</span>
          <div className="text-2xl font-bold font-mono text-foreground mt-0.5">
            {overallScore.toFixed(1)}%
          </div>
        </div>

        <div className="p-3 rounded-xl bg-muted/20 border border-border/30 text-center">
          <span className="text-[11px] text-muted-foreground font-mono uppercase">Grounding</span>
          <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
            {groundingScore.toFixed(1)}%
          </div>
        </div>

        <div className="p-3 rounded-xl bg-muted/20 border border-border/30 text-center">
          <span className="text-[11px] text-muted-foreground font-mono uppercase">Tool Accuracy</span>
          <div className="text-lg font-bold font-mono text-sky-400 mt-0.5">
            {toolAccuracyScore.toFixed(1)}%
          </div>
        </div>

        <div className="p-3 rounded-xl bg-muted/20 border border-border/30 text-center">
          <span className="text-[11px] text-muted-foreground font-mono uppercase">Schema JSON</span>
          <div className="text-lg font-bold font-mono text-purple-400 mt-0.5">
            {schemaScore.toFixed(1)}%
          </div>
        </div>

        <div className="p-3 rounded-xl bg-muted/20 border border-border/30 text-center">
          <span className="text-[11px] text-muted-foreground font-mono uppercase">Policy Safety</span>
          <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
            {safetyScore.toFixed(1)}%
          </div>
        </div>
      </div>
    </Card>
  );
}

// =========================================================================
// 4. INCIDENT MANAGER TABLE
// =========================================================================

export interface IncidentItem {
  id: string;
  title: string;
  summary: string;
  severity: string;
  status: string;
  occurrenceCount: number;
  impactedService?: string;
  rootCause?: string | null;
  updatedAt: string | Date;
}

export interface IncidentManagerTableProps {
  incidents: IncidentItem[];
  onAcknowledge?: (incidentId: string) => void;
  onResolve?: (incidentId: string) => void;
  className?: string;
}

export function IncidentManagerTable({
  incidents,
  onAcknowledge,
  onResolve,
  className = "",
}: IncidentManagerTableProps) {
  return (
    <Card className={`border border-border/40 bg-card/40 backdrop-blur-md overflow-hidden ${className}`}>
      <div className="p-4 border-b border-border/40 bg-muted/20">
        <h3 className="text-base font-semibold text-foreground">Operational Incidents & Breaches</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Deduplicated incident lifecycle management with automated recurrence aggregation
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/40 border-b border-border/30 text-muted-foreground font-mono uppercase">
            <tr>
              <th className="py-2.5 px-3">Severity</th>
              <th className="py-2.5 px-3">Title & Summary</th>
              <th className="py-2.5 px-3 text-center">Occurrences</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {incidents.length > 0 ? (
              incidents.map((inc) => {
                const isCritical = inc.severity === "critical" || inc.severity === "high";
                return (
                  <tr key={inc.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                          isCritical
                            ? "bg-rose-950/80 text-rose-400 border-rose-800"
                            : "bg-amber-950/80 text-amber-400 border-amber-800"
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 max-w-[320px]">
                      <div className="font-semibold text-foreground text-sm">{inc.title}</div>
                      <div className="text-muted-foreground line-clamp-1 mt-0.5">{inc.summary}</div>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-muted text-foreground border border-border/40">
                        {inc.occurrenceCount}x
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize border ${
                          inc.status === "open"
                            ? "bg-rose-950/50 text-rose-300 border-rose-800/50"
                            : inc.status === "acknowledged"
                            ? "bg-sky-950/50 text-sky-300 border-sky-800/50"
                            : inc.status === "resolved"
                            ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/50"
                            : "bg-muted text-muted-foreground border-border/40"
                        }`}
                      >
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {inc.status === "open" && onAcknowledge && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAcknowledge(inc.id)}
                            className="text-xs px-2.5 py-1 h-auto border-border/40 text-foreground hover:bg-muted"
                          >
                            Ack
                          </Button>
                        )}
                        {inc.status !== "resolved" && onResolve && (
                          <Button
                            size="sm"
                            onClick={() => onResolve(inc.id)}
                            className="text-xs px-2.5 py-1 h-auto bg-emerald-700 hover:bg-emerald-600 text-white"
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">
                  No active incidents. All systems operating within SLO thresholds.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

