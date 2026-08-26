import React, { useState, useEffect } from "react";
import { navigate, usePathname } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import { AgentService } from "@/agents/agent-service";
import type { AgentInstance, AgentRun } from "@/agents/agent.types";
import { AppShell } from "@/components/AppShell";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@haza-aios/ui";
import { RunStatusBadge } from "@haza-aios/ui";

export const AgentRunHistory: React.FC = () => {
  const pathname = usePathname();
  // Route: /workspace/agents/:id/history
  const id = pathname.split("/")[3];
  
  const { currentOrganization } = useOrganization();
  const [instance, setInstance] = useState<AgentInstance | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization || !id) return;
    setLoading(true);
    Promise.all([
      AgentService.getInstance(id, currentOrganization.id),
      AgentService.getRuns(currentOrganization.id, id)
    ]).then(([inst, runsList]) => {
      setInstance(inst || null);
      setRuns(runsList);
      setLoading(false);
    });
  }, [id, currentOrganization]);

  if (loading) return <AppShell><div className="p-6">Loading History...</div></AppShell>;
  if (!instance) return <AppShell><div className="p-6">Agent not found.</div></AppShell>;

  return (
    <AppShell>
      <div className="max-w-7xl space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <button 
              onClick={() => navigate(`/workspace/agents/${id}`)}
              className="text-sm font-medium text-slate-400 hover:text-white mb-2 flex items-center gap-1 transition-colors"
            >
              ← Back to Agent
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Run History: {instance.name}
            </h1>
          </div>
          <Button onClick={() => navigate(`/workspace/agents/${id}/run`)} className="bg-red-600 hover:bg-red-700">
            New Execution
          </Button>
        </div>

        <Card className="bg-[#0f141f] border-white/5">
          <CardHeader>
            <CardTitle>Execution Log</CardTitle>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                No executions have been run for this agent yet.
              </div>
            ) : (
              <div className="space-y-4">
                {runs.map(run => (
                  <div key={run.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-900/50 border border-white/5 rounded-xl hover:bg-slate-900 transition-colors">
                    <div className="space-y-1 mb-4 md:mb-0">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-slate-300">{run.id}</span>
                        <RunStatusBadge status={run.status} />
                      </div>
                      <div className="text-xs text-slate-500">
                        Started: {run.startedAt ? new Date(run.startedAt).toLocaleString() : "Unknown"}
                        {run.duration && ` • Duration: ${run.duration}ms`}
                      </div>
                    </div>
                    <div className="text-sm text-slate-400 max-w-sm truncate md:text-right">
                      {typeof run.input === "string" ? run.input : JSON.stringify(run.input)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};
