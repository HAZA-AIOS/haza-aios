import React, { useState, useEffect } from "react";
import { navigate, usePathname } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import { AgentService } from "@/agents/agent-service";
import { Runtime } from "@/agents/runtime/AgentRuntime";
import type { AgentInstance, AgentRun, AgentTemplate } from "@/agents/agent.types";
import { AppShell } from "@/components/AppShell";
import { Button, Card, CardHeader, CardTitle, CardContent, Textarea } from "@haza-aios/ui";
import { RunStatusBadge, ExecutionTimeline, RunOutputViewer } from "@haza-aios/ui";
import { WorksheetCreatorUI } from "./WorksheetCreatorUI";

type TimelineStep = {
  label: string;
  status: "pending" | "active" | "completed" | "failed";
};

export const AgentRunPage: React.FC = () => {
  const pathname = usePathname();
  // Route: /workspace/agents/:id/run
  const id = pathname.split("/")[3];
  
  const { currentOrganization } = useOrganization();
  const [instance, setInstance] = useState<AgentInstance | null>(null);
  const [template, setTemplate] = useState<AgentTemplate | null>(null);
  const [input, setInput] = useState("");
  
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);

  useEffect(() => {
    if (!currentOrganization || !id) return;
    AgentService.getInstance(id, currentOrganization.id).then(inst => {
      setInstance(inst || null);
      if (inst?.agentTemplateId) {
        AgentService.getTemplateForOrg(inst.agentTemplateId, currentOrganization.id).then((resolved) => setTemplate(resolved || null));
      }
    });
  }, [id, currentOrganization]);

  // Poll for run updates if we have an active run
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (currentRunId && currentOrganization && (currentRun?.status === "running" || currentRun?.status === "queued" || currentRun?.status === "waiting")) {
      interval = setInterval(async () => {
        const runs = await AgentService.getRuns(currentOrganization.id, id);
        const updatedRun = runs.find(r => r.id === currentRunId);
        if (updatedRun) {
          setCurrentRun(updatedRun);
          if (["completed", "failed", "cancelled"].includes(updatedRun.status)) {
            clearInterval(interval);
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentRunId, currentOrganization, id, currentRun?.status]);

  if (!instance) return <AppShell><div className="p-6">Loading Agent...</div></AppShell>;

  const handleExecute = async () => {
    if (!input.trim() || !currentOrganization) return;
    
    try {
      const run = await Runtime.requestExecution({
        agentInstanceId: instance.id,
        organizationId: currentOrganization.id,
        input,
        requestedBy: "current_user_placeholder", // Typically from auth context
        executionMode: "manual"
      }, instance, () => AgentService);
      
      setCurrentRunId(run.id);
      setCurrentRun(run);
      setInput(""); // clear input
    } catch (error) {
      console.error("Execution failed to start:", error);
      alert("Failed to start execution");
    }
  };

  const handleCancel = async () => {
    if (currentRunId) {
      await Runtime.cancelExecution(currentRunId, () => AgentService);
    }
  };

  const getSteps = (): TimelineStep[] => {
    if (!currentRun) return [];
    return [
      { label: "Queued", status: currentRun.status === "queued" ? "active" : "completed" },
      { label: "Execution & Model Call", status: ["running", "waiting"].includes(currentRun.status) ? "active" : (["completed", "failed", "cancelled"].includes(currentRun.status) && currentRun.status !== "queued" ? "completed" : "pending") },
      { label: "Completed", status: currentRun.status === "completed" ? "completed" : (currentRun.status === "failed" ? "failed" : "pending") }
    ];
  };

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        <div className="max-w-7xl space-y-8 animate-fade-in w-full">
          <div className="flex items-center justify-between">
            <div>
              <button 
                onClick={() => navigate(`/workspace/agents/${id}`)}
                className="text-sm font-medium text-slate-400 hover:text-white mb-2 flex items-center gap-1 transition-colors"
              >
                ← Back to Agent
              </button>
              <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                Execute Agent: {instance.name}
              </h1>
            </div>
            <Button variant="outline" onClick={() => navigate(`/workspace/agents/${id}/history`)}>
              View Run History
            </Button>
          </div>

          {template?.slug === "worksheet-creator" || instance.agentTemplateId === "template-worksheet-creator" ? (
            <WorksheetCreatorUI instance={instance} organizationId={currentOrganization?.id || ""} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="bg-[#0f141f] border-white/5">
                <CardHeader>
                  <CardTitle>Input Parameters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-2">Prompt</label>
                    <Textarea 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Enter input prompt for the agent..."
                      className="min-h-[150px] bg-slate-900 border-white/10"
                      disabled={["running", "waiting", "queued"].includes(currentRun?.status || "")}
                    />
                  </div>
                  <Button 
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleExecute}
                    disabled={!input.trim() || ["running", "waiting", "queued"].includes(currentRun?.status || "")}
                  >
                    Execute Agent
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-[#0f141f] border-white/5 min-h-[500px] flex flex-col">
                <CardHeader className="flex flex-row justify-between items-center border-b border-white/5 pb-4">
                  <CardTitle>Execution Console</CardTitle>
                  {currentRun && <RunStatusBadge status={currentRun.status} />}
                </CardHeader>
                <CardContent className="flex-1 p-6 space-y-8 flex flex-col">
                  {!currentRun ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500 italic">
                      Awaiting input to begin execution...
                    </div>
                  ) : (
                    <>
                      <ExecutionTimeline steps={getSteps()} />
                      
                      <div className="flex-1 mt-8 space-y-2">
                        <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Output</div>
                        {["completed", "failed"].includes(currentRun.status) ? (
                           <RunOutputViewer output={currentRun.output} error={currentRun.error} />
                        ) : (
                          <div className="h-full min-h-[200px] bg-slate-900/50 rounded-xl border border-white/5 flex items-center justify-center p-8">
                            <div className="flex flex-col items-center gap-4">
                              <div className="size-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
                              <span className="text-sm text-slate-400 font-medium">
                                {currentRun.status === "waiting" ? "Executing tools..." : "Model generating response..."}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {["running", "waiting", "queued"].includes(currentRun.status) && (
                        <div className="pt-4 flex justify-end">
                          <Button variant="destructive" onClick={handleCancel}>Cancel Run</Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
