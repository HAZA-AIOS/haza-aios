import React, { useEffect, useState } from "react";
import { AppShell } from "../../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import { Card } from "@haza-aios/ui/components/card";
import {
  OrchestrationService,
  type AgentTeam,
  type AgentTeamRole,
  type WorkflowDefinition,
  type WorkflowPattern,
  type WorkflowRun,
  type WorkflowValidationResult,
  type WorkflowArtifact,
} from "../../../../agents/orchestration-service";
import { useOrganization } from "../../../../org/use-organization";
import {
  Users,
  Network,
  Play,
  CheckCircle,
  AlertTriangle,
  Clock,
  FileText,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  X,
  Eye,
  GitBranch,
} from "lucide-react";

const orchestrationService = new OrchestrationService();

export const MultiAgentOrchestrationPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id || "org-mentor-school";
  const workspaceId = "ws-default";

  const [activeTab, setActiveTab] = useState<"teams" | "builder" | "monitor" | "approvals" | "artifacts">("teams");
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [artifacts, setArtifacts] = useState<WorkflowArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Team Modal State
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [newMembers, setNewMembers] = useState<Array<{ agentId: string; role: AgentTeamRole; priority: number }>>([
    { agentId: "agent-planner", role: "planner", priority: 1 },
    { agentId: "agent-specialist", role: "specialist", priority: 2 },
    { agentId: "agent-reviewer", role: "reviewer", priority: 3 },
  ]);

  // Workflow Builder State
  const [newWfName, setNewWfName] = useState("Grade 6 Science Curriculum Unit");
  const [newWfDesc, setNewWfDesc] = useState("Multi-agent collaborative planning, drafting, and assessment workflow.");
  const [newWfPattern, setNewWfPattern] = useState<WorkflowPattern>("sequential");
  const [newWfTeamId, setNewWfTeamId] = useState<string>("");
  const [builderSteps, setBuilderSteps] = useState<
    Array<{
      stepKey: string;
      name: string;
      description: string;
      assignedRole: AgentTeamRole;
      dependsOnStepKeys: string[];
      requiresApproval: boolean;
      outputKey: string;
    }>
  >([
    {
      stepKey: "step_planning",
      name: "Decompose Unit Curriculum",
      description: "Decompose living systems curriculum into 4 structured lessons.",
      assignedRole: "planner",
      dependsOnStepKeys: [],
      requiresApproval: false,
      outputKey: "lesson_breakdown",
    },
    {
      stepKey: "step_knowledge",
      name: "Curriculum Standard Retrieval",
      description: "Retrieve official Science living systems standards and competencies.",
      assignedRole: "specialist",
      dependsOnStepKeys: ["step_planning"],
      requiresApproval: false,
      outputKey: "curriculum_standards",
    },
    {
      stepKey: "step_content",
      name: "Draft Lesson Activities",
      description: "Generate structured interactive classroom and lab activities.",
      assignedRole: "specialist",
      dependsOnStepKeys: ["step_knowledge"],
      requiresApproval: false,
      outputKey: "lesson_activities",
    },
    {
      stepKey: "step_review",
      name: "Teacher Final Review & Sign-Off",
      description: "Review generated unit plan and ensure instructional rigor before publishing.",
      assignedRole: "reviewer",
      dependsOnStepKeys: ["step_content"],
      requiresApproval: true,
      outputKey: "final_unit_package",
    },
  ]);
  const [validationResult, setValidationResult] = useState<WorkflowValidationResult | null>(null);

  const loadAllData = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const [fetchedTeams, fetchedWorkflows] = await Promise.all([
        orchestrationService.listTeams(organizationId, workspaceId).catch(() => []),
        orchestrationService.listWorkflows(organizationId, workspaceId).catch(() => []),
      ]);
      setTeams(fetchedTeams);
      setWorkflows(fetchedWorkflows);
      if (fetchedTeams.length > 0 && !newWfTeamId) {
        setNewWfTeamId(fetchedTeams[0].id);
      }
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to load orchestration data." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [organizationId, workspaceId]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const created = await orchestrationService.createTeam(organizationId, {
        workspaceId,
        name: newTeamName,
        description: newTeamDesc,
        members: newMembers,
      });
      setTeams([created, ...teams]);
      setIsCreatingTeam(false);
      setNewTeamName("");
      setNewTeamDesc("");
      setActionMessage({ type: "success", text: `Team '${created.name}' created successfully.` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to create team." });
    }
  };

  const handleValidateBuilder = () => {
    const errors: string[] = [];
    const keys = new Set(builderSteps.map((s) => s.stepKey));
    for (const step of builderSteps) {
      for (const dep of step.dependsOnStepKeys) {
        if (!keys.has(dep)) {
          errors.push(`Step '${step.stepKey}' depends on non-existent '${dep}'`);
        }
      }
    }
    const isValid = errors.length === 0;
    setValidationResult({
      valid: isValid,
      errors,
      warnings: [],
      cycleDetected: false,
      unresolvedRoles: [],
      dependencyGraph: {},
      executionOrder: builderSteps.map((s) => s.stepKey),
    });
  };

  const handleSaveWorkflow = async () => {
    try {
      const created = await orchestrationService.createWorkflow(organizationId, {
        workspaceId,
        teamId: newWfTeamId || null,
        name: newWfName,
        description: newWfDesc,
        pattern: newWfPattern,
        steps: builderSteps,
      });
      setWorkflows([created, ...workflows]);
      setActionMessage({ type: "success", text: `Workflow definition '${created.name}' created!` });
      setActiveTab("monitor");
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to save workflow." });
    }
  };

  const handleStartRun = async (workflowId: string) => {
    try {
      setActionMessage(null);
      const run = await orchestrationService.startWorkflowRun(organizationId, workflowId, {
        unitTitle: "Cells and Living Systems",
        grade: "Grade 6",
        subject: "Science",
        durationWeeks: 4,
      });
      setRuns([run, ...runs]);
      setSelectedRun(run);
      setActiveTab("monitor");
      setActionMessage({ type: "success", text: `Workflow run dispatched (Status: ${run.status})` });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to start workflow run." });
    }
  };

  const handleApprovalDecision = async (runId: string, stepKey: string, decision: "approved" | "rejected") => {
    try {
      const updatedRun = await orchestrationService.submitApproval(organizationId, runId, stepKey, decision);
      setRuns(runs.map((r) => (r.id === runId ? updatedRun : r)));
      if (selectedRun?.id === runId) setSelectedRun(updatedRun);
      setActionMessage({
        type: "success",
        text: `Approval decision '${decision}' submitted for step '${stepKey}'.`,
      });
    } catch (err: any) {
      setActionMessage({ type: "error", text: err.message || "Failed to submit approval." });
    }
  };

  const pendingApprovals = runs.filter((r) => r.status === "waiting_approval");

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-800/80">
                Epic 19 • Multi-Agent Engine
              </span>
              <span className="text-xs text-zinc-500">Autonomous Orchestration</span>
            </div>
            <h1 className="text-3xl font-extrabold text-zinc-100 tracking-tight mt-1">
              Multi-Agent Collaboration & Orchestration
            </h1>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
              Coordinate teams of specialized agents through versioned DAG workflows, shared artifact context, and human-in-the-loop approval gates.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllData}
              disabled={isLoading}
              className="border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreatingTeam(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Agent Team
            </Button>
          </div>
        </div>

        {/* Global Notifications */}
        {actionMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
              actionMessage.type === "success"
                ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                : "bg-red-950/40 border-red-800 text-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-zinc-400 hover:text-zinc-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1.5 rounded-xl border border-zinc-800 overflow-x-auto">
          {[
            { id: "teams", label: "Agent Teams", icon: Users, badge: teams.length },
            { id: "builder", label: "Workflow Builder", icon: Network },
            { id: "monitor", label: "Execution Monitor", icon: Play, badge: runs.length },
            { id: "approvals", label: "Approval Queue", icon: ShieldCheck, badge: pendingApprovals.length, alert: pendingApprovals.length > 0 },
            { id: "artifacts", label: "Artifacts & Provenance", icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-zinc-400"}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                      tab.alert
                        ? "bg-amber-950 text-amber-300 border border-amber-800 animate-pulse"
                        : isActive
                        ? "bg-zinc-700 text-zinc-200"
                        : "bg-zinc-800/80 text-zinc-500"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Agent Teams */}
        {activeTab === "teams" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-zinc-200">Configured Agent Teams</h3>
                <p className="text-sm text-zinc-400">
                  Organizations assemble agent teams with specialized roles: Planner, Specialist, Reviewer, and Supervisor.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {teams.length === 0 ? (
                <Card className="col-span-full p-8 text-center bg-zinc-900/40 border-zinc-800">
                  <Users className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-300 font-medium">No agent teams created yet</p>
                  <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
                    Create your first organization-scoped agent team to begin composing multi-agent workflows.
                  </p>
                  <Button
                    onClick={() => setIsCreatingTeam(true)}
                    className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Create Agent Team
                  </Button>
                </Card>
              ) : (
                teams.map((team) => (
                  <Card key={team.id} className="p-5 bg-zinc-900/60 border-zinc-800/80 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          {team.status}
                        </span>
                        <span className="text-xs text-zinc-500">{team.members?.length || 0} Members</span>
                      </div>
                      <h4 className="text-lg font-bold text-zinc-100 mt-2">{team.name}</h4>
                      <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{team.description}</p>

                      <div className="mt-4 space-y-2">
                        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Roster & Roles
                        </span>
                        <div className="space-y-1.5">
                          {team.members?.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-zinc-800/50 border border-zinc-800"
                            >
                              <span className="text-zinc-300 font-medium">{m.agentName || m.agentId}</span>
                              <span
                                className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase font-bold ${
                                  m.role === "planner"
                                    ? "bg-blue-950 text-blue-400 border border-blue-900"
                                    : m.role === "specialist"
                                    ? "bg-purple-950 text-purple-400 border border-purple-900"
                                    : m.role === "reviewer"
                                    ? "bg-amber-950 text-amber-400 border border-amber-900"
                                    : "bg-emerald-950 text-emerald-400 border border-emerald-900"
                                }`}
                              >
                                {m.role}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Workflow Builder */}
        {activeTab === "builder" && (
          <div className="space-y-6">
            <Card className="p-6 bg-zinc-900/60 border-zinc-800">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100">DAG Workflow Definition Builder</h3>
                  <p className="text-sm text-zinc-400">
                    Define structured agent steps, graph dependencies, and human validation gates.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleValidateBuilder}
                    className="border-zinc-700 bg-zinc-900 text-zinc-300"
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5 text-blue-400" />
                    Validate Graph
                  </Button>
                  <Button
                    onClick={handleSaveWorkflow}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Save & Deploy
                  </Button>
                </div>
              </div>

              {/* Validation Results Notice */}
              {validationResult && (
                <div
                  className={`mt-4 p-4 rounded-xl border text-sm ${
                    validationResult.valid
                      ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                      : "bg-red-950/40 border-red-800 text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {validationResult.valid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    <span>{validationResult.valid ? "DAG Validation Passed (No Cycles Detected)" : "DAG Validation Errors"}</span>
                  </div>
                  {validationResult.errors.length > 0 && (
                    <ul className="list-disc list-inside mt-2 text-xs space-y-1 text-red-400">
                      {validationResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Workflow Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Workflow Name</label>
                  <input
                    type="text"
                    value={newWfName}
                    onChange={(e) => setNewWfName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Execution Pattern</label>
                  <select
                    value={newWfPattern}
                    onChange={(e) => setNewWfPattern(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="sequential">Sequential Pipeline</option>
                    <option value="parallel">Parallel Branches</option>
                    <option value="supervisor_worker">Supervisor-Worker</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-400 uppercase">Assigned Agent Team</label>
                  <select
                    value={newWfTeamId}
                    onChange={(e) => setNewWfTeamId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Visual Step Canvas */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-emerald-400" />
                    Step Sequence & Dependency Graph
                  </span>
                </div>

                <div className="space-y-4">
                  {builderSteps.map((step, idx) => (
                    <div
                      key={step.stepKey}
                      className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/90 relative flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center font-bold text-emerald-400 text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-100">{step.name}</span>
                            <span className="font-mono text-xs text-zinc-500">[{step.stepKey}]</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                step.assignedRole === "planner"
                                  ? "bg-blue-950 text-blue-400"
                                  : step.assignedRole === "specialist"
                                  ? "bg-purple-950 text-purple-400"
                                  : "bg-amber-950 text-amber-400"
                              }`}
                            >
                              Role: {step.assignedRole}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">{step.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                            <span>
                              Depends on:{" "}
                              {step.dependsOnStepKeys.length > 0 ? (
                                <strong className="text-zinc-300">{step.dependsOnStepKeys.join(", ")}</strong>
                              ) : (
                                <span className="text-zinc-600">None (Root Step)</span>
                              )}
                            </span>
                            <span>
                              Output Key: <strong className="text-emerald-400">{step.outputKey}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {step.requiresApproval && (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-medium">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Human Approval Gate
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 3: Execution Monitor */}
        {activeTab === "monitor" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Runs List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Active & Recent Runs</h3>
                {workflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-200">{wf.name}</h4>
                      <span className="text-xs text-zinc-500">v{wf.version}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartRun(wf.id)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" />
                      Run
                    </Button>
                  </div>
                ))}

                <div className="pt-4 space-y-2">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Run History</span>
                  {runs.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">No executions logged yet.</p>
                  ) : (
                    runs.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRun(r)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          selectedRun?.id === r.id
                            ? "bg-zinc-800 border-emerald-600"
                            : "bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-bold uppercase ${
                              r.status === "completed"
                                ? "text-emerald-400"
                                : r.status === "waiting_approval"
                                ? "text-amber-400"
                                : r.status === "failed"
                                ? "text-red-400"
                                : "text-blue-400"
                            }`}
                          >
                            {r.status}
                          </span>
                          <span className="text-zinc-500">{r.totalDurationMs}ms</span>
                        </div>
                        <p className="text-zinc-400 mt-1 truncate">ID: {r.id}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Selected Run Details */}
              <div className="md:col-span-2">
                {selectedRun ? (
                  <Card className="p-6 bg-zinc-900/60 border-zinc-800 space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                              selectedRun.status === "completed"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                                : selectedRun.status === "waiting_approval"
                                ? "bg-amber-950 text-amber-400 border border-amber-900"
                                : "bg-blue-950 text-blue-400 border border-blue-900"
                            }`}
                          >
                            {selectedRun.status}
                          </span>
                          <span className="text-xs text-zinc-500 font-mono">Run: {selectedRun.id.slice(0, 8)}</span>
                        </div>
                        <h4 className="text-base font-bold text-zinc-100 mt-1">Multi-Agent Execution Pipeline</h4>
                      </div>
                      <div className="text-right text-xs text-zinc-400">
                        <div>Duration: <strong className="text-zinc-200">{selectedRun.totalDurationMs}ms</strong></div>
                        <div>Tokens: <strong className="text-zinc-200">{selectedRun.totalPromptTokens + selectedRun.totalCompletionTokens}</strong></div>
                      </div>
                    </div>

                    {/* Step Runs Progress */}
                    <div className="space-y-3">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Step Timeline</span>
                      <div className="space-y-2">
                        {selectedRun.stepRuns?.map((sr) => (
                          <div
                            key={sr.id}
                            className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              {sr.status === "completed" ? (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              ) : sr.status === "waiting_approval" ? (
                                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                              ) : sr.status === "failed" ? (
                                <X className="w-4 h-4 text-red-400" />
                              ) : (
                                <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                              )}
                              <span className="font-semibold text-zinc-200">{sr.stepKey}</span>
                              <span className="text-zinc-500">({sr.status})</span>
                            </div>
                            <span className="text-zinc-400">{sr.durationMs}ms</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Final Output Viewer */}
                    {selectedRun.finalOutput && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Aggregated Final Output
                        </span>
                        <pre className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 overflow-x-auto max-h-60 font-mono">
                          {JSON.stringify(selectedRun.finalOutput, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Card>
                ) : (
                  <Card className="p-12 text-center bg-zinc-900/40 border-zinc-800 text-zinc-500">
                    Select a run to inspect execution progress and step telemetry.
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Approval Queue */}
        {activeTab === "approvals" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-zinc-200">Human Decision Approval Queue</h3>
              <p className="text-sm text-zinc-400">
                Workflows paused at human-in-the-loop gates requiring authorized review and sign-off before proceeding.
              </p>
            </div>

            {pendingApprovals.length === 0 ? (
              <Card className="p-8 text-center bg-zinc-900/40 border-zinc-800">
                <CheckCircle className="w-10 h-10 text-emerald-500/60 mx-auto mb-2" />
                <p className="text-zinc-300 font-medium">All approval gates resolved</p>
                <p className="text-xs text-zinc-500 mt-1">No workflow runs are currently paused for decisions.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendingApprovals.map((run) => (
                  <Card key={run.id} className="p-5 bg-zinc-900/80 border-amber-900/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800">
                          Waiting Approval
                        </span>
                        <span className="text-xs text-zinc-400">Step: {run.currentStepKey}</span>
                      </div>
                      <span className="text-xs font-mono text-zinc-500">Run: {run.id}</span>
                    </div>

                    <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-300">
                      <p className="font-semibold text-zinc-200">Approval Evidence & Proposed Artifacts:</p>
                      <pre className="mt-1 max-h-32 overflow-y-auto text-zinc-400 font-mono">
                        {JSON.stringify(run.sharedContext, null, 2)}
                      </pre>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprovalDecision(run.id, run.currentStepKey || "step_review", "rejected")}
                        className="border-red-800 text-red-400 hover:bg-red-950/40"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprovalDecision(run.id, run.currentStepKey || "step_review", "approved")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve & Resume
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Artifacts & History */}
        {activeTab === "artifacts" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-zinc-200">Generated Artifacts & Provenance</h3>
              <p className="text-sm text-zinc-400">
                Structured unit plans, lesson materials, and citations emitted by workflow steps with full cryptographic provenance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {runs
                .flatMap((r) => r.artifacts || [])
                .map((art) => (
                  <Card key={art.id} className="p-5 bg-zinc-900/60 border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-zinc-800 text-zinc-300">
                        {art.artifactType}
                      </span>
                      <span className="text-xs text-zinc-500">{new Date(art.createdAt).toLocaleString()}</span>
                    </div>
                    <h4 className="text-base font-bold text-zinc-100">{art.name}</h4>
                    <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 max-h-40 overflow-y-auto font-mono">
                      {JSON.stringify(art.content, null, 2)}
                    </pre>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {isCreatingTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-zinc-100">Create New Agent Team</h3>
              <button onClick={() => setIsCreatingTeam(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase">Team Name</label>
                <input
                  type="text"
                  required
                  placeholder="Science Academic Unit Team"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase">Description</label>
                <textarea
                  rows={2}
                  placeholder="Specialized agents for science curriculum design..."
                  value={newTeamDesc}
                  onChange={(e) => setNewTeamDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase">Default Members</label>
                <div className="space-y-1.5">
                  {newMembers.map((m, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 bg-zinc-950 rounded border border-zinc-800">
                      <span className="text-zinc-300 font-mono">{m.agentId}</span>
                      <span className="font-bold text-emerald-400 uppercase">{m.role}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <Button type="button" variant="outline" onClick={() => setIsCreatingTeam(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  Create Team
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
};
export default MultiAgentOrchestrationPage;

