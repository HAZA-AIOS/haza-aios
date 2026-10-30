import React, { useState, useEffect } from "react";
import { navigate } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import {
  AgentRuntimeService,
  type RuntimeMonitoringMetrics,
} from "@/agents/agent-runtime-service";
import { AppShell } from "@/components/AppShell";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  AgentRunMetricCard,
} from "@haza-aios/ui";

export const AgentRuntimeMonitoringPage: React.FC = () => {
  const { currentOrganization } = useOrganization();

  const [metrics, setMetrics] = useState<RuntimeMonitoringMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTickActive, setIsTickActive] = useState(false);
  const [tickResult, setTickResult] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const res = await AgentRuntimeService.getMonitoringMetrics(currentOrganization.id);
      setMetrics(res.metrics);
    } catch (err: any) {
      setError(err.message || "Failed to load runtime telemetry metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [currentOrganization]);

  const handleTriggerWorkerTick = async () => {
    if (!currentOrganization) return;
    setIsTickActive(true);
    setTickResult(null);
    try {
      const res = await AgentRuntimeService.triggerWorkerTick(currentOrganization.id, "dashboard-manual-worker");
      if (res.executed && res.run) {
        setTickResult(`Successfully claimed and executed run #${res.run.id.slice(0, 8)} (${res.run.status}).`);
      } else {
        setTickResult("Worker tick completed: No queued runs available to claim.");
      }
      fetchMetrics();
    } catch (err: any) {
      setError(err.message || "Worker tick failed.");
    } finally {
      setIsTickActive(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <button
                type="button"
                onClick={() => navigate("/workspace/agents/active")}
                className="hover:text-cyan-400 transition-colors"
              >
                Agents
              </button>
              <span>/</span>
              <span className="text-white font-medium">Runtime Telemetry & Monitoring</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>Runtime Engine Telemetry</span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-medium">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE (5s POLL)
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/workspace/agents/runs")}
            >
              Runs History
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/workspace/agents/approvals")}
            >
              Approvals Inbox
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleTriggerWorkerTick}
              disabled={isTickActive}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
            >
              {isTickActive ? "Dispatching Worker..." : "Trigger Worker Tick"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {tickResult && (
          <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono flex items-center justify-between">
            <span>{tickResult}</span>
            <button
              type="button"
              onClick={() => setTickResult(null)}
              className="text-xs text-cyan-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading && !metrics ? (
          <div className="py-24 text-center text-xs text-slate-400">Loading live telemetry...</div>
        ) : metrics ? (
          <div className="space-y-6">
            {/* Primary Queue Health & Capacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <AgentRunMetricCard
                label="Queue Depth"
                value={metrics.activeQueuedRuns}
                subvalue="Runs pending worker claim"
                badge={
                  metrics.activeQueuedRuns > 0 ? (
                    <span className="text-xs text-amber-400 font-mono">BACKLOG</span>
                  ) : (
                    <span className="text-xs text-emerald-400 font-mono">CLEAR</span>
                  )
                }
              />
              <AgentRunMetricCard
                label="Active Running"
                value={metrics.activeExecutingRuns}
                subvalue="Concurrent leased executions"
                badge={
                  metrics.activeExecutingRuns > 0 ? (
                    <span className="text-xs text-cyan-400 font-mono">ACTIVE</span>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">IDLE</span>
                  )
                }
              />
              <AgentRunMetricCard
                label="Awaiting Approval"
                value={metrics.awaitingApprovalRuns}
                subvalue="Paused on human authorization"
                badge={
                  metrics.awaitingApprovalRuns > 0 ? (
                    <span className="text-xs text-amber-400 font-mono animate-pulse">ACTION REQ</span>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">0 PENDING</span>
                  )
                }
              />
              <AgentRunMetricCard
                label="24h Success Rate"
                value={`${metrics.successRatePercentage.toFixed(1)}%`}
                subvalue={`${metrics.completedLast24h} OK / ${metrics.failedLast24h} Fail`}
                badge={
                  metrics.successRatePercentage >= 95 ? (
                    <span className="text-xs text-emerald-400 font-mono">NOMINAL</span>
                  ) : (
                    <span className="text-xs text-rose-400 font-mono">DEGRADED</span>
                  )
                }
              />
            </div>

            {/* Performance & Token Throughput */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AgentRunMetricCard
                label="Average Latency (24h)"
                value={`${(metrics.averageDurationMs / 1000).toFixed(2)}s`}
                subvalue="Mean end-to-end execution duration"
              />
              <AgentRunMetricCard
                label="Token Volume (24h)"
                value={metrics.totalTokensLast24h.toLocaleString()}
                subvalue="Total input & output tokens processed"
              />
              <AgentRunMetricCard
                label="Total Cost (24h)"
                value={`$${(metrics.totalCostMicrosLast24h / 1_000_000).toFixed(4)}`}
                subvalue={`${metrics.totalCostMicrosLast24h.toLocaleString()} micros (MOCK)`}
              />
            </div>

            {/* Architectural Engine Overview Card */}
            <Card className="border border-white/10 bg-slate-900/60 rounded-xl overflow-hidden shadow-xl">
              <CardHeader className="bg-slate-950/70 border-b border-white/10 px-5 py-4">
                <CardTitle className="text-sm font-semibold text-white">
                  Execution Engine Architecture & Fencing Status
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-4 text-xs text-slate-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
                    <span className="font-semibold text-slate-200 block">Durable Queue</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Queue state is persisted transactionally in MySQL 9.4 with revision pinning and idempotency fencing.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
                    <span className="font-semibold text-slate-200 block">Lease Expiration Fencing</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Workers acquire 300s TTL leases with UUID tokens. Stale or crashed workers are safely reclaimed.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
                    <span className="font-semibold text-slate-200 block">Separation of Duties</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Human-in-the-loop policies pause high-risk actions. Requesters are strictly forbidden from self-approval.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
};
