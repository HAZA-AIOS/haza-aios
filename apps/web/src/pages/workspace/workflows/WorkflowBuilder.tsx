import React, { useState, useEffect } from "react";
import { Card, CardContent, Button, Input, Badge } from "@haza-aios/ui";
import { WorkflowService } from "@/agents/runtime/workflow/WorkflowService";
import type { Workflow, WorkflowStep, StepType } from "@/agents/runtime/workflow/workflow.types";
// Removed WorkflowExecutionManager
import { usePathname, navigate } from "@/routes/navigation";
import { useOrganization } from "@/org/use-organization";
import { Play, Save, Trash2 } from "lucide-react";

export const WorkflowBuilder: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const pathname = usePathname();
  const parts = pathname.split("/");
  // format: /workspace/workflows/:id
  const id = parts[3];

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization) return;
    
    if (id === "new") {
      setTimeout(() => {
        setWorkflow({
          id: `wf_${Date.now()}`,
          organizationId: currentOrganization.id,
          name: "New Workflow",
          description: "",
          status: "draft",
          version: "1.0",
          configuration: {},
          createdBy: "current_user",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        setSteps([]);
        setLoading(false);
      }, 0);
    } else {
      WorkflowService.getWorkflow(id!, currentOrganization.id).then(w => {
        if (w) {
          setWorkflow(w);
          WorkflowService.getWorkflowSteps(w.id).then(s => setSteps(s));
        }
        setLoading(false);
      });
    }
  }, [id, currentOrganization]);

  const addStep = (type: StepType) => {
    const newStep: WorkflowStep = {
      id: `step_${Date.now()}`,
      workflowId: workflow!.id,
      name: `New ${type} Step`,
      type,
      order: steps.length,
      configuration: {}
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    // Reorder
    newSteps.forEach((s, i) => s.order = i);
    setSteps(newSteps);
  };

  const updateStepConfig = (index: number, key: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index].configuration = { ...newSteps[index].configuration, [key]: value };
    setSteps(newSteps);
  };

  const saveWorkflow = async () => {
    if (!workflow || !currentOrganization) return;
    await WorkflowService.saveWorkflow(workflow);
    await WorkflowService.saveWorkflowSteps(steps);
    alert("Workflow saved!");
    if (id === "new") navigate(`/workspace/workflows`);
  };

  if (loading || !workflow) return <div>Loading...</div>;

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Workflow Builder
          </h1>
          <p className="text-slate-400">Design automated task sequences.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={saveWorkflow}><Save className="w-4 h-4 mr-2" /> Save</Button>
          <Button onClick={() => navigate(`/workspace/workflows/${workflow.id}/run`)}><Play className="w-4 h-4 mr-2" /> Run</Button>
        </div>
      </div>

      <Card className="bg-[#0f141f] border-white/5">
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300">Name</label>
            <Input value={workflow.name} onChange={e => setWorkflow({...workflow, name: e.target.value})} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300">Description</label>
            <Input value={workflow.description} onChange={e => setWorkflow({...workflow, description: e.target.value})} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card key={step.id} className="bg-slate-900 border-white/5 relative overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500" />
            <CardContent className="p-4 flex gap-4">
              <div className="flex items-center justify-center bg-slate-800 w-10 h-10 rounded-full font-bold text-slate-300 shrink-0">
                {index + 1}
              </div>
              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Input 
                      value={step.name} 
                      onChange={e => {
                        const newSteps = [...steps];
                        newSteps[index].name = e.target.value;
                        setSteps(newSteps);
                      }}
                      className="bg-transparent border-none text-lg font-semibold px-0 h-auto focus-visible:ring-0"
                    />
                    <Badge variant="secondary">{step.type}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="text-red-400" onClick={() => removeStep(index)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Step specific config */}
                {step.type === "agent" && (
                  <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-md">
                    <div>
                      <label className="text-xs font-medium text-slate-400">Agent Instance ID</label>
                      <Input 
                        placeholder="e.g. inst-123" 
                        value={step.configuration.agentInstanceId || ""} 
                        onChange={e => updateStepConfig(index, "agentInstanceId", e.target.value)} 
                        className="h-8 text-sm bg-slate-900 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400">Prompt / Input</label>
                      <Input 
                        placeholder="e.g. {{curriculumContext}}" 
                        value={step.configuration.input || ""} 
                        onChange={e => updateStepConfig(index, "input", e.target.value)} 
                        className="h-8 text-sm bg-slate-900 mt-1"
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={step.configuration.requireJson || false}
                        onChange={e => updateStepConfig(index, "requireJson", e.target.checked)}
                      />
                      <label className="text-xs text-slate-300">Require Structured JSON Output</label>
                    </div>
                  </div>
                )}

                {step.type === "tool" && (
                  <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-md">
                    <div>
                      <label className="text-xs font-medium text-slate-400">Tool ID</label>
                      <Input 
                        placeholder="e.g. save-worksheet-tool" 
                        value={step.configuration.toolId || ""} 
                        onChange={e => updateStepConfig(index, "toolId", e.target.value)} 
                        className="h-8 text-sm bg-slate-900 mt-1"
                      />
                    </div>
                  </div>
                )}
                
                {step.type === "knowledge" && (
                  <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-md">
                    <div>
                      <label className="text-xs font-medium text-slate-400">Search Query</label>
                      <Input 
                        placeholder="e.g. Grade 5 Math" 
                        value={step.configuration.query || ""} 
                        onChange={e => updateStepConfig(index, "query", e.target.value)} 
                        className="h-8 text-sm bg-slate-900 mt-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 justify-center mt-6">
        <Button variant="outline" className="border-dashed" onClick={() => addStep("knowledge")}>+ Knowledge</Button>
        <Button variant="outline" className="border-dashed" onClick={() => addStep("agent")}>+ Agent Step</Button>
        <Button variant="outline" className="border-dashed" onClick={() => addStep("tool")}>+ Tool Step</Button>
        <Button variant="outline" className="border-dashed" onClick={() => addStep("condition")}>+ Condition</Button>
      </div>

    </div>
  );
};
