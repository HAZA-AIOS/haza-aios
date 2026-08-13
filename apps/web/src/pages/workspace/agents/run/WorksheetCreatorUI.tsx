import React, { useState } from "react";
import { Button, Card, CardContent, Input, Textarea } from "@haza-aios/ui";
import { Runtime } from "@/agents/runtime/AgentRuntime";
import { AgentService } from "@/agents/agent-service";
import { WorksheetService } from "@/modules/education/worksheet-service";
import type { AgentInstance } from "@/agents/agent.types";
import { WorksheetPreview } from "./WorksheetPreview";
import { Loader2 } from "lucide-react";

interface WorksheetCreatorUIProps {
  instance: AgentInstance;
  organizationId: string;
}

export const WorksheetCreatorUI: React.FC<WorksheetCreatorUIProps> = ({ instance, organizationId }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [worksheet, setWorksheet] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    grade: "",
    subject: "",
    topic: "",
    difficulty: "Intermediate",
    questionCount: "5",
    questionTypes: "multiple-choice,open-ended",
    learningObjective: "",
    instructions: ""
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.grade || !formData.subject || !formData.topic) {
      alert("Please fill in Grade, Subject, and Topic.");
      return;
    }

    setIsGenerating(true);
    setWorksheet(null);

    try {
      // Create a structured input for the runtime
      const input = JSON.stringify({
        task: "generate_worksheet",
        params: {
          ...formData,
          questionCount: parseInt(formData.questionCount, 10),
          questionTypes: formData.questionTypes.split(",").map(s => s.trim())
        }
      });

      const run = await Runtime.requestExecution({
        agentInstanceId: instance.id,
        organizationId,
        input,
        requestedBy: "current_user",
        executionMode: "manual"
      }, instance, () => AgentService as any);

      // In a real scenario we might poll for completion if it's async,
      // but Runtime.requestExecution for our mock might return completed immediately
      // Let's check the run status. For now, assuming the mock executes synchronously
      // or we just poll like AgentRunPage does.
      
      // Let's implement a simple poll here just in case
      let currentRun = run;
      while (["queued", "running", "waiting"].includes(currentRun.status)) {
        await new Promise(r => setTimeout(r, 1000));
        const runs = await AgentService.getRuns(organizationId, instance.id);
        currentRun = runs.find(r => r.id === run.id) || currentRun;
      }

      if (currentRun.status === "completed" && currentRun.output?.content) {
        try {
          const generatedData = JSON.parse(currentRun.output.content);
          setWorksheet({
            ...generatedData,
            id: `ws-${Date.now()}`,
            organizationId,
            createdBy: "current_user",
            agentInstanceId: instance.id,
            runId: currentRun.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch (e) {
          console.error("Failed to parse worksheet JSON:", e);
          alert("Generated output was not in expected format.");
        }
      } else {
        alert("Generation failed or returned no output.");
      }
    } catch (error) {
      console.error("Failed to generate:", error);
      alert("Failed to start generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!worksheet) return;
    setIsSaving(true);
    try {
      await WorksheetService.saveWorksheet(worksheet);
      alert("Worksheet saved successfully!");
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save worksheet.");
    } finally {
      setIsSaving(false);
    }
  };

  if (worksheet) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setWorksheet(null)}>
          ← Create Another Worksheet
        </Button>
        <WorksheetPreview worksheet={worksheet} onSave={handleSave} isSaving={isSaving} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-2">Worksheet Generator</h2>
        <p className="text-slate-300 text-sm">
          Fill out the parameters below to generate a highly customized, structured worksheet for your students.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Grade / Class *</label>
              <Input 
                placeholder="e.g. 5th Grade, High School Biology" 
                value={formData.grade}
                onChange={(e) => handleChange("grade", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Subject *</label>
              <Input 
                placeholder="e.g. Mathematics, History" 
                value={formData.subject}
                onChange={(e) => handleChange("subject", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Topic *</label>
              <Input 
                placeholder="e.g. Fractions, World War II" 
                value={formData.topic}
                onChange={(e) => handleChange("topic", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Difficulty</label>
              <select 
                className="w-full flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={formData.difficulty} 
                onChange={(e) => handleChange("difficulty", e.target.value)}
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Number of Questions</label>
              <select 
                className="w-full flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={formData.questionCount} 
                onChange={(e) => handleChange("questionCount", e.target.value)}
              >
                <option value="5">5 Questions</option>
                <option value="10">10 Questions</option>
                <option value="15">15 Questions</option>
                <option value="20">20 Questions</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Question Types</label>
              <select 
                className="w-full flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={formData.questionTypes} 
                onChange={(e) => handleChange("questionTypes", e.target.value)}
              >
                <option value="multiple-choice">Multiple Choice Only</option>
                <option value="open-ended">Open Ended Only</option>
                <option value="multiple-choice,open-ended">Mixed (MC & Open Ended)</option>
                <option value="multiple-choice,true-false">Mixed (MC & True/False)</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Learning Objective</label>
            <Input 
              placeholder="What should students be able to do after completing this worksheet?" 
              value={formData.learningObjective}
              onChange={(e) => handleChange("learningObjective", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Additional Instructions</label>
            <Textarea 
              placeholder="Any specific instructions, formatting requirements, or context for the AI..." 
              value={formData.instructions}
              onChange={(e) => handleChange("instructions", e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button 
          size="lg" 
          onClick={handleGenerate} 
          disabled={isGenerating || !formData.grade || !formData.subject || !formData.topic}
          className="w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating Worksheet...
            </>
          ) : (
            "Generate Worksheet"
          )}
        </Button>
      </div>
    </div>
  );
};
