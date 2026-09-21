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
    WorkflowService.getWorkflow(id, currentOrganization.id).then((w) => {
      setWorkflow(w);
      if (w) {
        WorkflowService.getWorkflowSteps(w.id).then((s) => setSteps(s));
      }
      setLoading(false);
    });
  }, [id, currentOrganization]);

  // Polling for active task
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (
      activeTask &&
      ["pending", "running", "waiting"].includes(activeTask.status) &&
      currentOrganization
    ) {
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
      id: crypto.randomUUID(),
      organizationId: currentOrganization.id,
      workflowId: workflow.id,
      status: "pending",
      input: {}, // Could get from a form
      stepResults: {},
      startedAt: new Date().toISOString(),
    };

    await WorkflowService.saveTask(newTask);
    setActiveTask(newTask);

    // Kick off in background
    WorkflowExecutionManager.startTask(newTask, workflow, steps, "current_user").catch(
      console.error,
    );
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
          className="mb-2 flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Builder
        </button>
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white">
            Run Workflow: {workflow.name}
          </h1>
          <Button onClick={handleStart} disabled={activeTask?.status === "running"}>
            <Play className="mr-2 h-4 w-4" /> Start Workflow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-white/5 bg-[#0f141f]">
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
                    <Icon className={`h-5 w-5 ${colorClass}`} />
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

        <div className="space-y-6 lg:col-span-2">
          <Card className="min-h-[500px] border-white/5 bg-[#0f141f]">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
              <CardTitle>Execution Trace</CardTitle>
              {activeTask && (
                <Badge
                  variant={
                    activeTask.status === "completed"
                      ? "default"
                      : activeTask.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {activeTask.status}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              {!activeTask ? (
                <div className="mt-10 text-center text-slate-500 italic">
                  Click "Start Workflow" to begin execution.
                </div>
              ) : (
                <div className="space-y-4">
                  {steps.map((step) => {
                    const res = activeTask.stepResults[step.id];
                    if (!res) return null;
                    return (
                      <div
                        key={step.id}
                        className="rounded-lg border border-white/10 bg-slate-900/50 p-4"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="font-semibold text-white">{step.name}</h4>
                          <Badge variant="secondary">{res.status}</Badge>
                        </div>
                        {res.error && (
                          <div className="rounded bg-red-950/30 p-2 text-sm text-red-400">
                            {res.error}
                          </div>
                        )}
                        {res.data && (
                          <div className="mt-2 max-h-[200px] overflow-y-auto rounded bg-black/40 p-2 font-mono text-xs whitespace-pre-wrap text-slate-300">
                            {typeof res.data === "object"
                              ? JSON.stringify(res.data, null, 2)
                              : String(res.data)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {["running", "pending"].includes(activeTask.status) && (
                    <div className="flex justify-end pt-4">
                      <Button variant="destructive" onClick={handleCancel}>
                        Cancel Execution
                      </Button>
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
