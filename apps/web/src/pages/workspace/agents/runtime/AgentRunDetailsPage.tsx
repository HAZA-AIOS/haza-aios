import React, { useState, useEffect } from "react";
import { usePathname, navigate } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import {
  AgentRuntimeService,
  type AgentRunItem,
  type AgentRunEventItem,
  type AgentRunAttemptItem,
  type AgentRuntimeUsageItem,
} from "@/agents/agent-runtime-service";
import { AppShell } from "@/components/AppShell";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  AgentRunStatusBadge,
  AgentRunMetricCard,
  AgentExecutionTimeline,
  AgentAttemptHistory,
  AgentExecutionResultViewer,
} from "@haza-aios/ui";

export const AgentRunDetailsPage: React.FC = () => {
  const pathname = usePathname();
  // Route: /workspace/agents/runs/:runId
  const runId = pathname.split("/")[4];

  const { currentOrganization } = useOrganization();
  const [run, setRun] = useState<AgentRunItem | null>(null);
  const [events, setEvents] = useState<AgentRunEventItem[]>([]);
  const [attempts, setAttempts] = useState<AgentRunAttemptItem[]>([]);
  const [usage, setUsage] = useState<AgentRuntimeUsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"output" | "attempts" | "timeline" | "usage">("output");

  const loadRunDetails = async () => {
    if (!currentOrganization || !runId) return;
    setLoading(true);
    setError(null);
    try {
      const [runRes, eventsRes, attemptsRes, usageRes] = await Promise.all([
        AgentRuntimeService.getRun(currentOrganization.id, runId),
        AgentRuntimeService.getRunEvents(currentOrganization.id, runId),
        AgentRuntimeService.getRunAttempts(currentOrganization.id, runId),
        AgentRuntimeService.getRunUsage(currentOrganization.id, runId),
      ]);
      setRun(runRes.run);
      setEvents(eventsRes.events);
      setAttempts(attemptsRes.attempts);
      setUsage(usageRes.usage);
    } catch (err: any) {
      setError(err.message || "Failed to load run details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRunDetails();
  }, [runId, currentOrganization]);

  const handleCancel = async () => {
    if (!currentOrganization || !run) return;
    try {
      await AgentRuntimeService.cancelRun(currentOrganization.id, run.id, "User requested cancellation from Details Page");
      loadRunDetails();
    } catch (err: any) {
      setError(err.message || "Failed to cancel run.");
    }
  };

  const handleRetry = async () => {
    if (!currentOrganization || !run) return;
    try {
      await AgentRuntimeService.retryRun(currentOrganization.id, run.id);
      loadRunDetails();
    } catch (err: any) {
      setError(err.message || "Failed to retry run.");
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="py-24 text-center text-xs text-slate-400">Loading run telemetry and audit logs...</div>
      </AppShell>
    );
  }

  if (error || !run) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto py-12 space-y-4">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error || "Agent execution run was not found."}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate("/workspace/agents/active")}>
            ← Back to Active Agents
          </Button>
        </div>
      </AppShell>
    );
  }

  const costDollars = ((run.totalCostMicros ?? 0) / 1_000_000).toFixed(4);

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
              <button
                type="button"
                onClick={() => navigate(`/workspace/agents/${run.agentId}`)}
                className="hover:text-cyan-400 transition-colors"
              >
                Agent Details
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={() => navigate(`/workspace/agents/${run.agentId}/runs`)}
                className="hover:text-cyan-400 transition-colors"
              >
                Runs
              </button>
              <span>/</span>
              <span className="text-white font-mono">{run.id.slice(0, 8)}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
                Run #{run.id.slice(0, 8)}
              </h1>
              <AgentRunStatusBadge status={run.status} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {["queued", "running", "waiting"].includes(run.status) && (
              <Button type="button" variant="destructive" size="sm" onClick={handleCancel}>
                Cancel Run
              </Button>
            )}
            {["failed", "cancelled"].includes(run.status) && (
              <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
                Retry Run
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => navigate(`/workspace/agents/${run.agentId}/execute`)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              Open Console
            </Button>
          </div>
        </div>

        {/* 4 Metrics Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <AgentRunMetricCard
            label="Duration"
            value={run.durationMs ? `${(run.durationMs / 1000).toFixed(2)}s` : "—"}
            subvalue={`Started ${new Date(run.startedAt).toLocaleTimeString()}`}
          />
          <AgentRunMetricCard
            label="Attempts"
            value={run.attemptCount ?? attempts.length}
            subvalue={run.workerId ? `Worker: ${run.workerId}` : "No active worker"}
          />
          <AgentRunMetricCard
            label="Token Usage"
            value={(run.totalInputTokens ?? 0) + (run.totalOutputTokens ?? 0)}
            subvalue={`In: ${run.totalInputTokens ?? 0} • Out: ${run.totalOutputTokens ?? 0}`}
          />
          <AgentRunMetricCard
            label="Inference Cost"
            value={`$${costDollars}`}
            subvalue={`${run.totalCostMicros ?? 0} micros (MOCK)`}
          />
        </div>

        {/* Detailed Metadata Pill Bar */}
        <div className="p-4 rounded-xl border border-white/10 bg-slate-900/40 text-xs text-slate-400 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <span className="text-slate-500 block mb-0.5">Agent Identifier:</span>
            <span className="font-mono text-slate-200">{run.agentId}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Execution Mode:</span>
            <span className="font-mono text-slate-200 uppercase">{run.executionMode || "manual"}</span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Revision Snapshot:</span>
            <span className="font-mono text-slate-200">
              {run.configurationRevisionId ? run.configurationRevisionId.slice(0, 8) : "None (Pinned Live)"}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Created Timestamp:</span>
            <span className="text-slate-200">{new Date(run.createdAt).toLocaleString()}</span>
          </div>
        </div>

        {/* Cancellation Reason alert if cancelled */}
        {run.status === "cancelled" && (
          <div className="p-4 rounded-xl bg-slate-800/60 border border-white/10 text-slate-300 text-xs flex items-center gap-2">
            <span className="font-semibold text-rose-400">Cancellation Reason:</span>
            <span>{run.cancellationReason || "User cancelled execution"}</span>
            {run.cancelledAt && <span className="text-slate-500 font-mono">({new Date(run.cancelledAt).toLocaleTimeString()})</span>}
          </div>
        )}

        {/* Main Content Tabs */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab("output")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "output"
                  ? "bg-white/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Output & Input Inspection
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("attempts")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "attempts"
                  ? "bg-white/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Execution Attempts ({attempts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("timeline")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "timeline"
                  ? "bg-white/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Event Timeline ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("usage")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === "usage"
                  ? "bg-white/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Usage & Cost Accounting ({usage.length})
            </button>
          </div>

          {activeTab === "output" && (
            <div className="space-y-4">
              <AgentExecutionResultViewer
                output={run.output}
                error={run.safeErrorMessage || run.errorMessage}
                input={run.input}
              />
            </div>
          )}

          {activeTab === "attempts" && (
            <AgentAttemptHistory
              attempts={attempts.map((a) => ({
                id: a.id,
                attemptNumber: a.attemptNumber,
                status: a.status,
                workerId: a.workerId,
                durationMs: a.durationMs,
                inputTokens: a.inputTokens,
                outputTokens: a.outputTokens,
                errorCode: a.errorCode,
                errorMessage: a.errorMessage,
                startedAt: a.startedAt,
                completedAt: a.completedAt,
              }))}
            />
          )}

          {activeTab === "timeline" && (
            <Card className="border border-white/10 bg-slate-900/60 rounded-xl p-5">
              <AgentExecutionTimeline
                events={events.map((e) => ({
                  id: e.id,
                  eventType: e.eventType,
                  timestamp: e.createdAt,
                  payload: e.payload,
                }))}
              />
            </Card>
          )}

          {activeTab === "usage" && (
            <div className="overflow-x-auto border border-white/10 rounded-xl bg-slate-900/60 shadow-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5">Provider</th>
                    <th className="px-5 py-3.5">Model</th>
                    <th className="px-5 py-3.5">Input Tokens</th>
                    <th className="px-5 py-3.5">Output Tokens</th>
                    <th className="px-5 py-3.5">Total Tokens</th>
                    <th className="px-5 py-3.5">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {usage.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5 text-white font-bold uppercase">{u.provider}</td>
                      <td className="px-5 py-3.5 text-slate-300">{u.model}</td>
                      <td className="px-5 py-3.5">{u.inputTokens}</td>
                      <td className="px-5 py-3.5">{u.outputTokens}</td>
                      <td className="px-5 py-3.5 text-cyan-400 font-bold">{u.totalTokens}</td>
                      <td className="px-5 py-3.5 text-emerald-400">
                        ${(u.costMicros / 1_000_000).toFixed(4)} ({u.costMicros} µs)
                      </td>
                    </tr>
                  ))}
                  {usage.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-slate-500 italic">
                        No usage accounting records for this run.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
