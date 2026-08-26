import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@haza-aios/ui";
import { WorkflowService } from "@/agents/runtime/workflow/WorkflowService";
import type { Workflow, WorkflowStep, Task } from "@/agents/runtime/workflow/workflow.types";
import { WorkflowExecutionManager } from "@/agents/runtime/workflow/WorkflowExecutionManager";
import { usePathname, navigate } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import { ArrowLeft, CheckCircle2, Circle, Play, XCircle } from "lucide-react";

export const WorkflowRunPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const pathname = usePathname();
  const parts = pathname.split("/");
  // format: /workspace/workflows/:id/run
  const id = parts[3];

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization || !id) return;
    WorkflowService.getWorkflow(id, currentOrganization.id).then(w => {
      setWorkflow(w);
      if (w) {
        WorkflowService.getWorkflowSteps(w.id).then(s => setSteps(s));
      }
      setLoading(false);
    });
  }, [id, currentOrganization]);

  // Polling for active task
  useEffect(() => {
    let interval: any;
    if (activeTask && ["pending", "running", "waiting"].includes(activeTask.status) && currentOrganization) {
      interval = setInterval(async () => {
        const t = await WorkflowService.getTask(activeTask.id, currentOrganization.id);
        if (t) setActiveTask(t);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTask, currentOrganization]);

  const handleStart = async () => {
    if (!workflow || !currentOrganization) return;

    const newTask: Task = {
      id: `task_${Date.now()}`,
      organizationId: currentOrganization.id,
      workflowId: workflow.id,
      status: "pending",
      input: {}, // Could get from a form
      stepResults: {},
      startedAt: new Date().toISOString()
    };
    
    await WorkflowService.saveTask(newTask);
    setActiveTask(newTask);

    // Kick off in background
    WorkflowExecutionManager.startTask(newTask, workflow, steps, "current_user").catch(console.error);
  };

  const handleCancel = async () => {
    if (activeTask && currentOrganization) {
      await WorkflowExecutionManager.cancelTask(activeTask.id, currentOrganization.id);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!workflow) return <div>Workflow not found</div>;

  return (
    <div className="max-w-7xl space-y-8">
      <div>
        <button 
          onClick={() => navigate(`/workspace/workflows/${workflow.id}`)}
          className="text-sm font-medium text-slate-400 hover:text-white mb-2 flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Builder
        </button>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Run Workflow: {workflow.name}
          </h1>
          <Button onClick={handleStart} disabled={activeTask?.status === "running"}>
            <Play className="w-4 h-4 mr-2" /> Start Workflow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-[#0f141f] border-white/5">
            <CardHeader>
              <CardTitle>Steps Outline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step) => {
                const stepResult = activeTask?.stepResults[step.id];
                let Icon = Circle;
                let colorClass = "text-slate-500";
                
                if (stepResult) {
                  if (stepResult.status === "completed") {
                    Icon = CheckCircle2;
                    colorClass = "text-green-500";
                  } else if (stepResult.status === "failed") {
                    Icon = XCircle;
                    colorClass = "text-red-500";
                  }
                } else if (activeTask && activeTask.currentStepId === step.id) {
                  colorClass = "text-blue-500 animate-pulse";
                }

                return (
                  <div key={step.id} className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${colorClass}`} />
                    <div>
                      <div className="text-sm font-medium text-slate-200">{step.name}</div>
                      <div className="text-xs text-slate-500 uppercase">{step.type}</div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#0f141f] border-white/5 min-h-[500px]">
            <CardHeader className="flex flex-row justify-between items-center border-b border-white/5 pb-4">
              <CardTitle>Execution Trace</CardTitle>
              {activeTask && (
                <Badge variant={activeTask.status === "completed" ? "default" : activeTask.status === "failed" ? "destructive" : "secondary"}>
                  {activeTask.status}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {!activeTask ? (
                <div className="text-center text-slate-500 italic mt-10">
                  Click "Start Workflow" to begin execution.
                </div>
              ) : (
                <div className="space-y-4">
                  {steps.map(step => {
                    const res = activeTask.stepResults[step.id];
                    if (!res) return null;
                    return (
                      <div key={step.id} className="border border-white/10 rounded-lg p-4 bg-slate-900/50">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold text-white">{step.name}</h4>
                          <Badge variant="secondary">{res.status}</Badge>
                        </div>
                        {res.error && (
                          <div className="text-red-400 text-sm bg-red-950/30 p-2 rounded">{res.error}</div>
                        )}
                        {res.data && (
                          <div className="mt-2 bg-black/40 p-2 rounded text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                            {typeof res.data === "object" ? JSON.stringify(res.data, null, 2) : String(res.data)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {["running", "pending"].includes(activeTask.status) && (
                    <div className="flex justify-end pt-4">
                      <Button variant="destructive" onClick={handleCancel}>Cancel Execution</Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
