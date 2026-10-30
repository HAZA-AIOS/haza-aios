import React, { useState, useEffect } from "react";
import { usePathname, navigate } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import { AgentService } from "@/agents/agent-service";
import {
  AgentRuntimeService,
  type AgentRunItem,
  type AgentRunEventItem,
} from "@/agents/agent-runtime-service";
import type { AgentInstance } from "@/agents/agent.types";
import { AppShell } from "@/components/AppShell";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  AgentRunStatusBadge,
  AgentExecutionTimeline,
  AgentExecutionResultViewer,
} from "@haza-aios/ui";

export const AgentExecutionConsolePage: React.FC = () => {
  const pathname = usePathname();
  // Route: /workspace/agents/:id/execute or /workspace/agents/:id/run
  const agentId = pathname.split("/")[3];

  const { currentOrganization } = useOrganization();
  const [agent, setAgent] = useState<AgentInstance | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(true);

  // Input states
  const [inputMode, setInputMode] = useState<"text" | "json">("text");
  const [promptText, setPromptText] = useState("");
  const [jsonText, setJsonText] = useState("{\n  \"prompt\": \"\"\n}");
  const [isExecuting, setIsExecuting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Current execution run
  const [activeRun, setActiveRun] = useState<AgentRunItem | null>(null);
  const [events, setEvents] = useState<AgentRunEventItem[]>([]);

  useEffect(() => {
    if (!currentOrganization || !agentId) return;
    setLoadingAgent(true);
    AgentService.getInstance(agentId, currentOrganization.id)
      .then((inst) => {
        setAgent(inst || null);
      })
      .finally(() => setLoadingAgent(false));
  }, [agentId, currentOrganization]);

  // Polling active run if running or queued or awaiting_approval
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (
      activeRun &&
      currentOrganization &&
      ["queued", "running", "waiting", "awaiting_approval"].includes(activeRun.status)
    ) {
      interval = setInterval(async () => {
        try {
          const res = await AgentRuntimeService.getRun(currentOrganization.id, activeRun.id);
          setActiveRun(res.run);
          const evtsRes = await AgentRuntimeService.getRunEvents(currentOrganization.id, activeRun.id);
          setEvents(evtsRes.events);
        } catch {
          // ignore transient poll error
        }
      }, 1500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeRun, currentOrganization]);

  const handleExecute = async () => {
    if (!currentOrganization || !agent) return;
    setActionError(null);
    setIsExecuting(true);

    let parsedPayload: Record<string, unknown> = {};
    if (inputMode === "text") {
      if (!promptText.trim()) {
        setActionError("Prompt input cannot be empty.");
        setIsExecuting(false);
        return;
      }
      parsedPayload = { prompt: promptText.trim() };
    } else {
      try {
        parsedPayload = JSON.parse(jsonText);
      } catch (err: any) {
        setActionError(`Invalid JSON format: ${err.message}`);
        setIsExecuting(false);
        return;
      }
    }

    try {
      const res = await AgentRuntimeService.createRun(
        currentOrganization.id,
        agent.id,
        parsedPayload,
        { autoExecute: true },
      );
      setActiveRun(res.run);
      const evtsRes = await AgentRuntimeService.getRunEvents(currentOrganization.id, res.run.id);
      setEvents(evtsRes.events);
    } catch (err: any) {
      setActionError(err.message || "Failed to trigger agent execution.");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancel = async () => {
    if (!currentOrganization || !activeRun) return;
    try {
      const res = await AgentRuntimeService.cancelRun(currentOrganization.id, activeRun.id, "User requested cancellation via Console");
      setActiveRun(res.run);
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel run.");
    }
  };

  const handleRetry = async () => {
    if (!currentOrganization || !activeRun) return;
    try {
      const res = await AgentRuntimeService.retryRun(currentOrganization.id, activeRun.id);
      setActiveRun(res.run);
    } catch (err: any) {
      setActionError(err.message || "Failed to retry run.");
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
              <button
                type="button"
                onClick={() => navigate(`/workspace/agents/${agentId}`)}
                className="hover:text-cyan-400 transition-colors"
              >
                {agent?.name ?? "Agent"}
              </button>
              <span>/</span>
              <span className="text-white font-medium">Execution Console</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <span>{agent?.name ?? "Execution Console"}</span>
              {agent && (
                <span className="text-xs px-2.5 py-1 rounded-md bg-white/5 border border-white/10 font-mono text-slate-300">
                  {agent.agentKey}
                </span>
              )}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/workspace/agents/${agentId}/runs`)}
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
              variant="outline"
              size="sm"
              onClick={() => navigate("/workspace/agents/runtime/monitoring")}
            >
              Monitoring
            </Button>
          </div>
        </div>

        {actionError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center justify-between">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-xs text-rose-300 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 2-Column Console Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Input Console */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border border-white/10 bg-slate-900/60 rounded-xl overflow-hidden shadow-xl">
              <CardHeader className="bg-slate-950/70 border-b border-white/10 px-5 py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-white">Execution Input</CardTitle>
                <div className="flex items-center rounded-lg bg-white/5 p-0.5 border border-white/10">
                  <button
                    type="button"
                    onClick={() => setInputMode("text")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      inputMode === "text"
                        ? "bg-cyan-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Text Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode("json")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      inputMode === "json"
                        ? "bg-cyan-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    JSON Payload
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                {inputMode === "text" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Prompt / Task Description</label>
                    <textarea
                      rows={10}
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder="e.g. Generate a comprehensive 10-question quiz on cellular respiration for Grade 10 biology students."
                      className="w-full text-xs font-sans p-3 bg-slate-950 border border-white/10 rounded-xl text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 leading-relaxed resize-y"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Raw JSON Execution Input</label>
                    <textarea
                      rows={10}
                      value={jsonText}
                      onChange={(e) => setJsonText(e.target.value)}
                      className="w-full text-xs font-mono p-3 bg-slate-950 border border-white/10 rounded-xl text-cyan-300 focus:outline-none focus:border-cyan-500 leading-relaxed resize-y"
                    />
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Execution Mode: <span className="font-mono text-slate-400">manual</span>
                  </span>
                  <Button
                    type="button"
                    onClick={handleExecute}
                    disabled={isExecuting || loadingAgent}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-5"
                  >
                    {isExecuting ? "Submitting..." : "Execute Agent"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Agent Metadata Card */}
            {agent && (
              <Card className="border border-white/10 bg-slate-900/40 rounded-xl p-4 space-y-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Model Provider:</span>
                  <span className="font-mono text-slate-200 uppercase">{agent.modelProvider || "MOCK"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Model Selection:</span>
                  <span className="font-mono text-slate-200">{agent.modelSelection || "mock-gpt-4o"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Human Approval Policy:</span>
                  <span className="font-mono text-slate-200">
                    {agent.humanApprovalPolicy?.required ? "Required" : "Optional / None"}
                  </span>
                </div>
              </Card>
            )}
          </div>

          {/* Right: Live Execution & Results */}
          <div className="lg:col-span-7 space-y-4">
            {activeRun ? (
              <div className="space-y-4">
                {/* Active Run Status Header */}
                <div className="p-4 rounded-xl border border-white/10 bg-slate-900/80 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Run ID:</span>
                      <span className="text-xs font-mono text-white font-bold">{activeRun.id}</span>
                      <AgentRunStatusBadge status={activeRun.status} />
                    </div>
                    <p className="text-xs text-slate-400">
                      Started: {new Date(activeRun.startedAt).toLocaleTimeString()}
                      {activeRun.durationMs && ` • Duration: ${(activeRun.durationMs / 1000).toFixed(2)}s`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {["queued", "running", "waiting"].includes(activeRun.status) && (
                      <Button type="button" variant="destructive" size="sm" onClick={handleCancel}>
                        Cancel
                      </Button>
                    )}
                    {["failed", "cancelled"].includes(activeRun.status) && (
                      <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
                        Retry Run
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/workspace/agents/runs/${activeRun.id}`)}
                    >
                      Full Details →
                    </Button>
                  </div>
                </div>

                {activeRun.status === "awaiting_approval" && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-amber-200">Execution Paused for Human Approval</p>
                      <p className="text-amber-300/80 mt-0.5">
                        This agent run requires authorization under security policy before completing inference.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => navigate("/workspace/agents/approvals")}
                      className="bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      Open Inbox
                    </Button>
                  </div>
                )}

                {/* Output Viewer */}
                <AgentExecutionResultViewer
                  output={activeRun.output}
                  error={activeRun.safeErrorMessage || activeRun.errorMessage}
                  input={activeRun.input}
                />

                {/* Execution Timeline */}
                <Card className="border border-white/10 bg-slate-900/60 rounded-xl p-5 space-y-4">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Execution Timeline
                  </h3>
                  <AgentExecutionTimeline
                    events={events.map((e) => ({
                      id: e.id,
                      eventType: e.eventType,
                      timestamp: e.createdAt,
                      payload: e.payload,
                    }))}
                  />
                </Card>
              </div>
            ) : (
              <div className="py-24 px-6 text-center border border-dashed border-white/10 rounded-2xl bg-slate-900/20 flex flex-col items-center justify-center gap-3">
                <div className="size-12 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-500">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white">Execution Console Ready</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Compose a task prompt on the left and trigger execution to observe live streaming events, attempt lifecycle, and output payloads.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};
