import React, { useEffect, useState } from "react";
import { AppShell } from "../../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import { Input } from "@haza-aios/ui/components/input";
import {
  AgentToolCard,
  ToolSchemaViewer,
  ToolPermissionMatrix,
  ToolUsageMetricCard,
  ToolPolicyEditor,
  ToolExecutionResultViewer,
} from "@haza-aios/ui/components/agent-tool-primitives";
import {
  agentToolService,
  type AgentToolItem,
  type AgentToolExecutionItem,
  type AgentToolMetrics,
} from "../../../../agents/agent-tool-service";
import { useOrganization } from "../../../../org/use-organization";

export const AgentToolsPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id || "org-mentor-school";
  const workspaceId = "default-ws";

  const [activeTab, setActiveTab] = useState<"catalog" | "executions" | "policies" | "metrics">("catalog");
  const [tools, setTools] = useState<AgentToolItem[]>([]);
  const [executions, setExecutions] = useState<AgentToolExecutionItem[]>([]);
  const [metrics, setMetrics] = useState<AgentToolMetrics>({
    totalInvocations: 0,
    completedCount: 0,
    failedCount: 0,
    awaitingApprovalCount: 0,
    successRate: 100,
    avgDurationMs: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTool, setSelectedTool] = useState<AgentToolItem | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<AgentToolExecutionItem | null>(null);
  const [policyMessage, setPolicyMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [organizationId, workspaceId]);

  const loadData = async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const [fetchedTools, execsRes, fetchedMetrics] = await Promise.all([
        agentToolService.listTools(organizationId, workspaceId),
        agentToolService.listExecutions(organizationId, workspaceId, { limit: 30 }),
        agentToolService.getMetrics(organizationId, workspaceId),
      ]);
      setTools(fetchedTools);
      setExecutions(execsRes.executions);
      setMetrics(fetchedMetrics);
    } catch (err) {
      console.error("Failed to load agent tools data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTools = tools.filter((tool) => {
    const matchesSearch =
      !search ||
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      tool.toolKey.toLowerCase().includes(search.toLowerCase()) ||
      tool.description.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === "all" || tool.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleToggleTool = async (tool: AgentToolItem, newEnabled: boolean) => {
    try {
      await agentToolService.updatePolicy(organizationId, workspaceId, tool.toolKey, {
        enabled: newEnabled,
      });
      setTools((prev) =>
        prev.map((t) => (t.toolKey === tool.toolKey ? { ...t, enabled: newEnabled } : t)),
      );
      setPolicyMessage(`Tool '${tool.name}' ${newEnabled ? "enabled" : "disabled"} successfully.`);
      setTimeout(() => setPolicyMessage(null), 3000);
    } catch (err) {
      console.error("Failed to update tool policy:", err);
    }
  };

  const handleSavePolicy = async (toolKey: string, policy: { enabled: boolean; approvalPolicyOverride?: string | null }) => {
    try {
      await agentToolService.updatePolicy(organizationId, workspaceId, toolKey, policy);
      setTools((prev) =>
        prev.map((t) =>
          t.toolKey === toolKey
            ? { ...t, enabled: policy.enabled, approvalPolicyOverride: policy.approvalPolicyOverride }
            : t,
        ),
      );
      setPolicyMessage(`Updated governance policy for '${toolKey}'.`);
      setTimeout(() => setPolicyMessage(null), 3000);
    } catch (err) {
      console.error("Failed to save policy:", err);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span>AGENTS</span>
              <span>/</span>
              <span>TOOLS & ORGANIZATIONAL DATA</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              Agent Tool Registry & Gateway
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Epic 16
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Discover and invoke explicitly authorized, versioned tools that retrieve or modify permitted organizational data through existing application domain services.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="border-slate-800 hover:border-slate-700 text-slate-300"
            >
              Refresh Registry
            </Button>
          </div>
        </div>

        {policyMessage && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium animate-fadeIn">
            ✓ {policyMessage}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 px-3 ${
              activeTab === "catalog"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Tool Catalog ({tools.length})
          </button>
          <button
            onClick={() => setActiveTab("executions")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 px-3 ${
              activeTab === "executions"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Execution History ({executions.length})
          </button>
          <button
            onClick={() => setActiveTab("policies")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 px-3 ${
              activeTab === "policies"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Tenant Policies
          </button>
          <button
            onClick={() => setActiveTab("metrics")}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 px-3 ${
              activeTab === "metrics"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Observability Metrics
          </button>
        </div>

        {/* TAB 1: TOOL CATALOG */}
        {activeTab === "catalog" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="w-full sm:w-96">
                <Input
                  placeholder="Search tools by name, key, or category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-slate-900/60 border-slate-800 text-xs"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-300 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Categories</option>
                  <option value="academic_structure">Academic Structure</option>
                  <option value="curriculum">Curriculum Benchmarks</option>
                  <option value="lesson_planning">Lesson Planning</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-16 text-slate-500">Loading tools from server registry...</div>
            ) : filteredTools.length === 0 ? (
              <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No tools matching your filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTools.map((tool) => (
                  <AgentToolCard
                    key={tool.toolKey}
                    tool={tool}
                    onSelect={() => setSelectedTool(tool)}
                    onToggleEnabled={(enabled) => handleToggleTool(tool, enabled)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EXECUTION HISTORY */}
        {activeTab === "executions" && (
          <div className="space-y-4">
            {executions.length === 0 ? (
              <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No tool executions recorded yet for this workspace.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/40">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Tool Key</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Digest</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {executions.map((exec) => (
                      <tr key={exec.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {new Date(exec.startedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-cyan-300">
                          {exec.toolKey}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              exec.status === "completed"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : exec.status === "awaiting_approval"
                                ? "bg-amber-500/20 text-amber-400"
                                : exec.status === "failed"
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-cyan-500/20 text-cyan-400"
                            }`}
                          >
                            {exec.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 font-mono">
                          {exec.durationMs ? `${exec.durationMs}ms` : "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500 truncate max-w-xs">
                          {exec.inputDigest.slice(0, 16)}...
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedExecution(exec)}
                            className="text-xs border-slate-700 hover:text-cyan-400"
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TENANT POLICIES */}
        {activeTab === "policies" && (
          <div className="space-y-4 max-w-3xl">
            <p className="text-xs text-slate-400 mb-2">
              Organization administrators can override default platform approval policies and enable/disable specific tools per workspace.
            </p>
            {tools.map((t) => (
              <ToolPolicyEditor
                key={t.toolKey}
                toolKey={t.toolKey}
                enabled={t.enabled}
                approvalPolicyOverride={t.approvalPolicyOverride}
                onSave={(pol) => handleSavePolicy(t.toolKey, pol)}
              />
            ))}
          </div>
        )}

        {/* TAB 4: OBSERVABILITY METRICS */}
        {activeTab === "metrics" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ToolUsageMetricCard
              title="Total Tool Invocations"
              value={metrics.totalInvocations}
              subtitle="All recorded executions"
            />
            <ToolUsageMetricCard
              title="Success Rate"
              value={`${metrics.successRate}%`}
              subtitle={`${metrics.completedCount} successful runs`}
            />
            <ToolUsageMetricCard
              title="Average Latency"
              value={`${metrics.avgDurationMs}ms`}
              subtitle="End-to-end domain adapter duration"
            />
            <ToolUsageMetricCard
              title="Awaiting Approval"
              value={metrics.awaitingApprovalCount}
              subtitle="Paused at governance checkpoint"
            />
          </div>
        )}

        {/* SCHEMA INSPECTOR MODAL */}
        {selectedTool && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 my-8">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedTool.name}
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      v{selectedTool.version}
                    </span>
                  </h3>
                  <code className="text-xs text-cyan-400 font-mono">{selectedTool.toolKey}</code>
                </div>
                <button
                  onClick={() => setSelectedTool(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{selectedTool.description}</p>

              <ToolPermissionMatrix
                requiredPermissions={selectedTool.requiredPermissions}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ToolSchemaViewer
                  title="Input Parameter Schema"
                  schema={selectedTool.inputSchema || {}}
                />
                <ToolSchemaViewer
                  title="Output Result Schema"
                  schema={selectedTool.outputSchema || {}}
                />
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <Button variant="outline" onClick={() => setSelectedTool(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* EXECUTION DETAILS MODAL */}
        {selectedExecution && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-bold text-white font-mono">
                  Execution: {selectedExecution.id}
                </h3>
                <button
                  onClick={() => setSelectedExecution(null)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <ToolExecutionResultViewer execution={selectedExecution} />

              <div className="flex justify-end pt-2 border-t border-slate-800">
                <Button variant="outline" onClick={() => setSelectedExecution(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
