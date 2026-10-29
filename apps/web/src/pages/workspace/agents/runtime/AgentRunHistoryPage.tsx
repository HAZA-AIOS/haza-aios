import React, { useState, useEffect } from "react";
import { usePathname, navigate } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import {
  AgentRuntimeService,
  type AgentRunItem,
  type AgentRunStatus,
} from "@/agents/agent-runtime-service";
import { AppShell } from "@/components/AppShell";
import {
  Button,
  AgentRunStatusBadge,
  AgentRuntimeEmptyState,
} from "@haza-aios/ui";

export const AgentRunHistoryPage: React.FC = () => {
  const pathname = usePathname();
  // Route: /workspace/agents/:id/runs or /workspace/agents/:id/history or /workspace/agents/runs
  const parts = pathname.split("/");
  const agentId = parts[3] !== "runs" && parts[3] !== "approvals" && parts[3] !== "runtime" ? parts[3] : undefined;

  const { currentOrganization } = useOrganization();
  const [runs, setRuns] = useState<AgentRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AgentRunStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = async () => {
    if (!currentOrganization) return;
    setLoading(true);
    setError(null);
    try {
      const res = await AgentRuntimeService.listRuns(currentOrganization.id, {
        agentId,
        status: statusFilter === "all" ? undefined : statusFilter,
        limit: 50,
      });
      setRuns(res.runs);
    } catch (err: any) {
      setError(err.message || "Failed to load runs history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [agentId, currentOrganization, statusFilter]);

  const handleCancel = async (runId: string) => {
    if (!currentOrganization) return;
    try {
      await AgentRuntimeService.cancelRun(currentOrganization.id, runId, "Cancelled from History Page");
      fetchRuns();
    } catch (err: any) {
      setError(err.message || "Failed to cancel run.");
    }
  };

  const handleRetry = async (runId: string) => {
    if (!currentOrganization) return;
    try {
      await AgentRuntimeService.retryRun(currentOrganization.id, runId);
      fetchRuns();
    } catch (err: any) {
      setError(err.message || "Failed to retry run.");
    }
  };

  const filterTabs: Array<{ label: string; value: AgentRunStatus | "all" }> = [
    { label: "All Runs", value: "all" },
    { label: "Queued", value: "queued" },
    { label: "Running", value: "running" },
    { label: "Awaiting Approval", value: "awaiting_approval" },
    { label: "Completed", value: "completed" },
    { label: "Failed", value: "failed" },
    { label: "Cancelled", value: "cancelled" },
  ];

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
              {agentId && (
                <>
                  <span>/</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/workspace/agents/${agentId}`)}
                    className="hover:text-cyan-400 transition-colors"
                  >
                    Agent
                  </button>
                </>
              )}
              <span>/</span>
              <span className="text-white font-medium">Execution Runs History</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Execution Runs History</h1>
          </div>

          <div className="flex items-center gap-2">
            {agentId && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => navigate(`/workspace/agents/${agentId}/execute`)}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                Launch Console
              </Button>
            )}
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
              variant="outline"
              size="sm"
              onClick={() => navigate("/workspace/agents/runtime/monitoring")}
            >
              Runtime Monitoring
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error}
          </div>
        )}

        {/* Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === tab.value
                  ? "bg-white/10 text-cyan-400 border border-cyan-500/30"
                  : "text-slate-400 hover:text-slate-200 border border-white/5 bg-slate-900/40"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Runs Table */}
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading runs history...</div>
        ) : runs.length === 0 ? (
          <AgentRuntimeEmptyState
            title="No Execution Runs Found"
            description={
              statusFilter === "all"
                ? "This agent has not executed any tasks yet."
                : `No runs currently match the "${statusFilter}" status filter.`
            }
            action={
              agentId && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate(`/workspace/agents/${agentId}/execute`)}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  Execute Agent Now
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto border border-white/10 rounded-xl bg-slate-900/60 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-white/10 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-5 py-3.5">Run ID</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Mode</th>
                  <th className="px-5 py-3.5">Attempts</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Tokens (Total)</th>
                  <th className="px-5 py-3.5">Executed At</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5 text-white font-bold">
                      <button
                        type="button"
                        onClick={() => navigate(`/workspace/agents/runs/${r.id}`)}
                        className="hover:text-cyan-400 transition-colors font-mono"
                      >
                        {r.id.slice(0, 8)}...
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <AgentRunStatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 font-sans capitalize">
                      {r.executionMode || "manual"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{r.attemptCount ?? 0}</td>
                    <td className="px-5 py-3.5 text-slate-400">
                      {r.durationMs ? `${(r.durationMs / 1000).toFixed(2)}s` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {(r.totalInputTokens ?? 0) + (r.totalOutputTokens ?? 0)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 font-sans">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right font-sans space-x-2">
                      {["queued", "running", "waiting"].includes(r.status) && (
                        <button
                          type="button"
                          onClick={() => handleCancel(r.id)}
                          className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                        >
                          Cancel
                        </button>
                      )}
                      {["failed", "cancelled"].includes(r.status) && (
                        <button
                          type="button"
                          onClick={() => handleRetry(r.id)}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => navigate(`/workspace/agents/runs/${r.id}`)}
                        className="text-xs text-slate-400 hover:text-white font-medium"
                      >
                        Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
};
