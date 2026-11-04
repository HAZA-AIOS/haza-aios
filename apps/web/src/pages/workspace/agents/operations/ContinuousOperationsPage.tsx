import React, { useEffect, useState, useCallback } from "react";
import { AppShell } from "../../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import { Card } from "@haza-aios/ui/components/card";
import {
  AutonomyBadge,
  OperationalStatusBadge,
  HeartbeatIndicator,
  TaskMetricCard,
  ApprovalActionCard,
  type AutonomyLevel,
} from "@haza-aios/ui/components/autonomous-operations-primitives";
import {
  AutonomousService,
  type AutonomousTaskDefinition,
  type AutonomousTaskPolicy,
  type AutonomousTaskTrigger,
  type AutonomousTaskRun,
  type AutonomousTaskCheckpoint,
  type AutonomousTaskEvent,
  type CreateTaskDefinitionPayload,
  type CreateTriggerPayload,
  type TaskStatus,
  type TriggerType,
} from "../../../../agents/autonomous-service";
import { useOrganization } from "../../../../org/use-organization";
import {
  Activity,
  Play,
  Pause,
  AlertOctagon,
  Clock,
  Shield,
  Zap,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  ChevronRight,
  Sliders,
  Calendar,
  Radio,
  History,
  FileCheck,
  AlertTriangle,
} from "lucide-react";

const autonomousService = new AutonomousService();

export const ContinuousOperationsPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id || "org-mentor-school";

  const [activeTab, setActiveTab] = useState<
    "tasks" | "triggers" | "active" | "approvals" | "history" | "policies"
  >("tasks");

  const [policy, setPolicy] = useState<AutonomousTaskPolicy | null>(null);
  const [tasks, setTasks] = useState<AutonomousTaskDefinition[]>([]);
  const [triggers, setTriggers] = useState<AutonomousTaskTrigger[]>([]);
  const [runs, setRuns] = useState<AutonomousTaskRun[]>([]);
  const [selectedTask, setSelectedTask] = useState<AutonomousTaskDefinition | null>(null);
  const [selectedRun, setSelectedRun] = useState<AutonomousTaskRun | null>(null);
  const [checkpoints, setCheckpoints] = useState<AutonomousTaskCheckpoint[]>([]);
  const [events, setEvents] = useState<AutonomousTaskEvent[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Modals
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateTriggerOpen, setIsCreateTriggerOpen] = useState(false);

  // Create Task Form State
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskLevel, setNewTaskLevel] = useState<AutonomyLevel>("L2");
  const [newTaskTargetType, setNewTaskTargetType] = useState<"workflow" | "agent">("workflow");
  const [newTaskTargetId, setNewTaskTargetId] = useState("");
  const [newTaskMaxRuntime, setNewTaskMaxRuntime] = useState(3600);
  const [newTaskMaxRetries, setNewTaskMaxRetries] = useState(3);
  const [newTaskMaxCost, setNewTaskMaxCost] = useState(5.0);

  // Create Trigger Form State
  const [newTriggerTaskId, setNewTriggerTaskId] = useState("");
  const [newTriggerName, setNewTriggerName] = useState("");
  const [newTriggerType, setNewTriggerType] = useState<TriggerType>("schedule");
  const [newTriggerCron, setNewTriggerCron] = useState("0 6 * * *");
  const [newTriggerTimezone, setNewTriggerTimezone] = useState("Asia/Singapore");
  const [newTriggerEventPattern, setNewTriggerEventPattern] = useState("education.term.*");
  const [newTriggerMissedPolicy, setNewTriggerMissedPolicy] = useState<"run_once" | "skip" | "run_all">("run_once");

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedPolicy, fetchedTasks, fetchedRuns] = await Promise.all([
        autonomousService.getPolicy(organizationId),
        autonomousService.listTasks(organizationId),
        autonomousService.listRuns(organizationId, { limit: 50 }),
      ]);

      setPolicy(fetchedPolicy);
      setTasks(fetchedTasks);
      setRuns(fetchedRuns);

      if (fetchedTasks.length > 0 && !selectedTask) {
        setSelectedTask(fetchedTasks[0]);
        const fetchedTriggers = await autonomousService.listTriggers(
          organizationId,
          fetchedTasks[0].id,
        );
        setTriggers(fetchedTriggers);
      }
    } catch (err: unknown) {
      console.error("Failed to load autonomous continuous operations data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [organizationId, selectedTask]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      // Periodic background refresh for live active operations
      autonomousService.listRuns(organizationId, { limit: 50 }).then((fetchedRuns) => {
        setRuns(fetchedRuns);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData, organizationId]);

  const handleSelectTask = async (task: AutonomousTaskDefinition) => {
    setSelectedTask(task);
    try {
      const fetchedTriggers = await autonomousService.listTriggers(organizationId, task.id);
      setTriggers(fetchedTriggers);
    } catch {
      setTriggers([]);
    }
  };

  const handleSelectRun = async (run: AutonomousTaskRun) => {
    setSelectedRun(run);
    try {
      const [fetchedCheckpoints, fetchedEvents] = await Promise.all([
        autonomousService.getCheckpoints(organizationId, run.id),
        autonomousService.getEvents(organizationId, run.id),
      ]);
      setCheckpoints(fetchedCheckpoints);
      setEvents(fetchedEvents);
    } catch (err) {
      console.error("Failed to load run details:", err);
    }
  };

  const handleRunTaskNow = async (taskId: string) => {
    try {
      setActionMessage(null);
      const newRun = await autonomousService.runTaskNow(organizationId, taskId);
      setActionMessage({ type: "success", text: `Run ${newRun.id.slice(0, 8)} queued successfully!` });
      await loadData();
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Run execution failed." });
    }
  };

  const handlePauseTask = async (taskId: string) => {
    try {
      await autonomousService.pauseTask(organizationId, taskId);
      setActionMessage({ type: "success", text: "Task paused." });
      await loadData();
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Pause failed." });
    }
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      await autonomousService.resumeTask(organizationId, taskId);
      setActionMessage({ type: "success", text: "Task resumed to active state." });
      await loadData();
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Resume failed." });
    }
  };

  const handleEmergencyStopTask = async (taskId: string) => {
    try {
      await autonomousService.emergencyStopTask(organizationId, taskId, "Admin console emergency stop");
      setActionMessage({ type: "success", text: "Emergency stop applied to task." });
      await loadData();
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Emergency stop failed." });
    }
  };

  const handleToggleGlobalEmergency = async () => {
    if (!policy) return;
    try {
      if (policy.emergencyStopAll) {
        await autonomousService.resumeAll(organizationId);
        setActionMessage({ type: "success", text: "Global emergency freeze lifted." });
      } else {
        await autonomousService.emergencyStopAll(organizationId, "Administrative global freeze triggered");
        setActionMessage({ type: "success", text: "GLOBAL EMERGENCY FREEZE ACTIVATED." });
      }
      await loadData();
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Action failed." });
    }
  };

  const handleApproveRun = async (runId: string, feedback?: string) => {
    try {
      await autonomousService.approveRun(organizationId, runId, feedback);
      setActionMessage({ type: "success", text: `Run approved and released to queue.` });
      await loadData();
      if (selectedRun?.id === runId) {
        const updated = await autonomousService.getRun(organizationId, runId);
        setSelectedRun(updated);
      }
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Approval failed." });
    }
  };

  const handleRejectRun = async (runId: string, reason: string) => {
    try {
      await autonomousService.rejectRun(organizationId, runId, reason);
      setActionMessage({ type: "success", text: `Run rejected and halted.` });
      await loadData();
      if (selectedRun?.id === runId) {
        const updated = await autonomousService.getRun(organizationId, runId);
        setSelectedRun(updated);
      }
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Rejection failed." });
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    try {
      const payload: CreateTaskDefinitionPayload = {
        name: newTaskName,
        description: newTaskDesc,
        autonomyLevel: newTaskLevel,
        targetType: newTaskTargetType,
        workflowDefinitionId: newTaskTargetType === "workflow" ? newTaskTargetId || undefined : undefined,
        agentId: newTaskTargetType === "agent" ? newTaskTargetId || undefined : undefined,
        executionPolicy: {
          maxRuntimeSeconds: newTaskMaxRuntime,
          maxRetries: newTaskMaxRetries,
          timeoutSeconds: newTaskMaxRuntime,
          maxConcurrency: 1,
          retryDelaySeconds: 30,
        },
        approvalPolicy: {
          requireApprovalForMutations: newTaskLevel !== "L3",
          requireApprovalOnReplanning: true,
          allowedApproverRoles: ["admin", "owner", "supervisor"],
        },
        limits: {
          maxDailyRuns: 50,
          maxTokensPerRun: 100000,
          maxCostUsdPerRun: newTaskMaxCost,
        },
        defaultInput: {},
      };

      const created = await autonomousService.createTask(organizationId, payload);
      setIsCreateTaskOpen(false);
      setNewTaskName("");
      setNewTaskDesc("");
      setActionMessage({ type: "success", text: `Task "${created.name}" created.` });
      await loadData();
      setSelectedTask(created);
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Creation failed." });
    }
  };

  const handleCreateTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    const taskId = newTriggerTaskId || selectedTask?.id;
    if (!taskId || !newTriggerName.trim()) return;

    try {
      const payload: CreateTriggerPayload = {
        name: newTriggerName,
        triggerType: newTriggerType,
        scheduleType: newTriggerType === "schedule" ? "recurring" : undefined,
        cronExpression: newTriggerType === "schedule" ? newTriggerCron : undefined,
        timezone: newTriggerTimezone,
        eventPattern: newTriggerType === "event" ? newTriggerEventPattern : undefined,
        missedSchedulePolicy: newTriggerMissedPolicy,
        isEnabled: true,
      };

      await autonomousService.createTrigger(organizationId, taskId, payload);
      setIsCreateTriggerOpen(false);
      setNewTriggerName("");
      setActionMessage({ type: "success", text: "Trigger registered successfully." });
      if (selectedTask?.id === taskId) {
        const fetchedTriggers = await autonomousService.listTriggers(organizationId, taskId);
        setTriggers(fetchedTriggers);
      }
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Trigger creation failed." });
    }
  };

  const handleDeleteTrigger = async (taskId: string, triggerId: string) => {
    try {
      await autonomousService.deleteTrigger(organizationId, taskId, triggerId);
      setTriggers(triggers.filter((t) => t.id !== triggerId));
      setActionMessage({ type: "success", text: "Trigger deleted." });
    } catch (err: unknown) {
      setActionMessage({ type: "error", text: err instanceof Error ? err.message : "Delete failed." });
    }
  };

  // Operational metrics
  const runningRuns = runs.filter((r) => r.status === "running" || r.status === "leased");
  const pendingApprovals = runs.filter((r) => r.status === "waiting_approval");
  const activeTasks = tasks.filter((t) => t.status === "active");

  return (
    <AppShell>
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-950/70 border border-purple-800/80 rounded-lg text-purple-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100">
                  Continuous Operations Console
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Autonomous task execution, resilient scheduling triggers, and continuous operations
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsRefreshing(true);
                loadData();
              }}
              disabled={isRefreshing}
              className="border-slate-800 text-slate-300 hover:bg-slate-900"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            {policy?.emergencyStopAll ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleToggleGlobalEmergency}
                className="bg-red-900 hover:bg-red-800 text-white font-semibold"
              >
                <AlertOctagon className="w-3.5 h-3.5 mr-1.5" />
                Lift Global Freeze
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleGlobalEmergency}
                className="border-red-800/80 text-red-400 hover:bg-red-950/50"
              >
                <AlertOctagon className="w-3.5 h-3.5 mr-1.5" />
                Global Emergency Freeze
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => setIsCreateTaskOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-medium"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              New Task
            </Button>
          </div>
        </div>

        {/* Global Emergency Alert Banner */}
        {policy?.emergencyStopAll && (
          <div className="p-4 rounded-lg bg-red-950/80 border border-red-700 text-red-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-6 h-6 text-red-400 animate-bounce" />
              <div>
                <h3 className="text-sm font-bold text-red-100">GLOBAL EMERGENCY FREEZE ACTIVE</h3>
                <p className="text-xs text-red-300">
                  All autonomous task executions, lease acquisitions, and background dispatches are halted.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleGlobalEmergency}
              className="border-red-600 text-red-200 hover:bg-red-900"
            >
              Resume All Tasks
            </Button>
          </div>
        )}

        {/* Operational Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TaskMetricCard
            title="Active Operations"
            value={runningRuns.length}
            subtitle="leased or running"
            statusColor={runningRuns.length > 0 ? "emerald" : "slate"}
            icon={<Activity className="w-4 h-4 text-emerald-400" />}
          />
          <TaskMetricCard
            title="Pending Approvals"
            value={pendingApprovals.length}
            subtitle="human sign-off required"
            statusColor={pendingApprovals.length > 0 ? "amber" : "slate"}
            icon={<FileCheck className="w-4 h-4 text-amber-400" />}
          />
          <TaskMetricCard
            title="Autonomous Tasks"
            value={activeTasks.length}
            subtitle={`${tasks.length} configured`}
            statusColor="purple"
            icon={<Zap className="w-4 h-4 text-purple-400" />}
          />
          <TaskMetricCard
            title="Default Autonomy"
            value={policy?.defaultAutonomyLevel || "L0"}
            subtitle={`Cap: ${policy?.maxGlobalConcurrency ?? 5} concurrent`}
            statusColor="indigo"
            icon={<Shield className="w-4 h-4 text-indigo-400" />}
          />
        </div>

        {/* Action Message Feedback */}
        {actionMessage && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
              actionMessage.type === "success"
                ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
                : "bg-rose-950/60 border border-rose-800 text-rose-300"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 gap-1 overflow-x-auto">
          {[
            { id: "tasks", label: "Autonomous Tasks", icon: Zap, badge: tasks.length },
            { id: "triggers", label: "Schedules & Triggers", icon: Calendar, badge: triggers.length },
            { id: "active", label: "Active Operations", icon: Activity, badge: runningRuns.length },
            { id: "approvals", label: "Approvals & Exceptions", icon: FileCheck, badge: pendingApprovals.length },
            { id: "history", label: "Execution History", icon: History, badge: runs.length },
            { id: "policies", label: "Policies & Limits", icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
                  isActive
                    ? "border-purple-500 text-purple-400 bg-purple-950/20"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      tab.id === "approvals"
                        ? "bg-amber-900 text-amber-200"
                        : tab.id === "active"
                        ? "bg-emerald-900 text-emerald-200"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: AUTONOMOUS TASKS */}
        {activeTab === "tasks" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Configured Autonomous Tasks</h3>
                <span className="text-xs text-slate-400 font-mono">{tasks.length} total</span>
              </div>

              {tasks.length === 0 ? (
                <Card className="p-8 text-center bg-slate-900 border-slate-800">
                  <Zap className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                  <p className="text-sm text-slate-300">No autonomous tasks configured yet.</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Create an autonomous task to schedule continuous workflows or event-driven execution.
                  </p>
                  <Button
                    size="sm"
                    className="mt-4 bg-purple-600 hover:bg-purple-500 text-white"
                    onClick={() => setIsCreateTaskOpen(true)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Create Task
                  </Button>
                </Card>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const isSelected = selectedTask?.id === task.id;
                    return (
                      <Card
                        key={task.id}
                        onClick={() => handleSelectTask(task)}
                        className={`p-4 cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-slate-900 border-purple-500/80 shadow-md shadow-purple-950/20"
                            : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-100">{task.name}</span>
                              <AutonomyBadge level={task.autonomyLevel} showDescription />
                              <OperationalStatusBadge status={task.status} />
                            </div>
                            <p className="text-xs text-slate-400 line-clamp-2">{task.description}</p>
                            <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 font-mono">
                              <span>Target: <strong className="text-slate-300">{task.targetType}</strong></span>
                              <span>Max Retries: <strong className="text-slate-300">{task.executionPolicy?.maxRetries ?? 3}</strong></span>
                              <span>Cost Cap: <strong className="text-slate-300">${task.limits?.maxCostUsdPerRun ?? 5.0}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRunTaskNow(task.id)}
                              className="border-purple-800/60 text-purple-300 hover:bg-purple-950/50 h-8 px-2.5"
                              title="Trigger immediate execution"
                            >
                              <Play className="w-3.5 h-3.5 mr-1" /> Run Now
                            </Button>
                            {task.status === "active" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePauseTask(task.id)}
                                className="border-amber-800/60 text-amber-300 hover:bg-amber-950/50 h-8 px-2"
                                title="Pause task"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResumeTask(task.id)}
                                className="border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/50 h-8 px-2"
                                title="Resume task"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEmergencyStopTask(task.id)}
                              className="border-red-900/60 text-red-400 hover:bg-red-950/50 h-8 px-2"
                              title="Emergency Stop"
                            >
                              <AlertOctagon className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected Task Details Panel */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">Task Specification & Policies</h3>
              {selectedTask ? (
                <Card className="p-4 bg-slate-900 border-slate-800 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-100">{selectedTask.name}</h4>
                      <AutonomyBadge level={selectedTask.autonomyLevel} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{selectedTask.description}</p>
                  </div>

                  <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                    <div className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                      Execution Policy
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-400 font-mono text-[11px]">
                      <div>Timeout: {selectedTask.executionPolicy?.timeoutSeconds ?? 3600}s</div>
                      <div>Max Retries: {selectedTask.executionPolicy?.maxRetries ?? 3}</div>
                      <div>Retry Delay: {selectedTask.executionPolicy?.retryDelaySeconds ?? 30}s</div>
                      <div>Max Concurrency: {selectedTask.executionPolicy?.maxConcurrency ?? 1}</div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                    <div className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                      Approval Policy
                    </div>
                    <div className="text-slate-400 text-[11px] space-y-1">
                      <div>Require Mutation Approval: <span className="font-mono text-slate-200">{String(selectedTask.approvalPolicy?.requireApprovalForMutations ?? true)}</span></div>
                      <div>Require Replan Approval: <span className="font-mono text-slate-200">{String(selectedTask.approvalPolicy?.requireApprovalOnReplanning ?? true)}</span></div>
                      <div>Approver Roles: <span className="font-mono text-slate-200">{selectedTask.approvalPolicy?.allowedApproverRoles?.join(", ") || "admin"}</span></div>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                        Attached Triggers ({triggers.length})
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewTriggerTaskId(selectedTask.id);
                          setIsCreateTriggerOpen(true);
                        }}
                        className="text-[11px] h-6 px-2 border-slate-700 text-slate-300"
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>

                    {triggers.length === 0 ? (
                      <p className="text-[11px] text-slate-500">No triggers attached to this task.</p>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        {triggers.map((trig) => (
                          <div
                            key={trig.id}
                            className="p-2 rounded bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-slate-200">{trig.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {trig.triggerType === "schedule" ? trig.cronExpression : trig.eventPattern}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteTrigger(selectedTask.id, trig.id)}
                              className="h-6 w-6 p-0 border-slate-800 text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-6 text-center bg-slate-900 border-slate-800 text-xs text-slate-500">
                  Select a task to inspect policies and triggers.
                </Card>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SCHEDULES & TRIGGERS */}
        {activeTab === "triggers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Schedules & Event Triggers</h3>
                <p className="text-xs text-slate-400">Timezone-aware recurring cron triggers and domain event triggers</p>
              </div>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-500 text-white"
                onClick={() => {
                  setNewTriggerTaskId(tasks[0]?.id || "");
                  setIsCreateTriggerOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Register Trigger
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {triggers.length === 0 ? (
                <div className="col-span-full">
                  <Card className="p-8 text-center bg-slate-900 border-slate-800 text-slate-400">
                    <Calendar className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                    <p className="text-sm">No triggers found for current selection.</p>
                  </Card>
                </div>
              ) : (
                triggers.map((trig) => (
                  <Card key={trig.id} className="p-4 bg-slate-900 border-slate-800 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                          {trig.triggerType}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-100 mt-1">{trig.name}</h4>
                      </div>
                      <OperationalStatusBadge status={trig.isEnabled ? "active" : "disabled"} />
                    </div>

                    <div className="space-y-1 text-xs text-slate-400 font-mono">
                      {trig.triggerType === "schedule" ? (
                        <>
                          <div>Cron: <span className="text-purple-300">{trig.cronExpression}</span></div>
                          <div>Timezone: <span className="text-slate-200">{trig.timezone}</span></div>
                          <div>Next Run: <span className="text-slate-300">{trig.nextRunAt ? new Date(trig.nextRunAt).toLocaleString() : "Pending calculation"}</span></div>
                        </>
                      ) : (
                        <>
                          <div>Pattern: <span className="text-sky-300">{trig.eventPattern}</span></div>
                          <div>Missed Policy: <span className="text-slate-300">{trig.missedSchedulePolicy}</span></div>
                        </>
                      )}
                    </div>

                    <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Missed: {trig.missedSchedulePolicy}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteTrigger(trig.taskDefinitionId, trig.id)}
                        className="text-xs text-rose-400 border-slate-800 hover:bg-rose-950/40 h-7"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ACTIVE OPERATIONS */}
        {activeTab === "active" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">Active Operational Leases & Heartbeats</h3>
                <p className="text-xs text-slate-400">Live background worker leases, heartbeats, and recovery states</p>
              </div>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Monitoring Active
              </span>
            </div>

            {runningRuns.length === 0 ? (
              <Card className="p-8 text-center bg-slate-900 border-slate-800 text-slate-400">
                <Activity className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                <p className="text-sm">No active operations running right now.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Worker leases and running tasks will automatically appear here with live heartbeat countdowns.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {runningRuns.map((run) => (
                  <Card key={run.id} className="p-4 bg-slate-900 border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-purple-400">RUN: {run.id.slice(0, 8)}</span>
                        <AutonomyBadge level={run.autonomyLevel} />
                        <OperationalStatusBadge status={run.status} />
                      </div>
                      <HeartbeatIndicator
                        lastHeartbeat={run.heartbeatAt}
                        leaseExpiresAt={run.leaseExpiresAt}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-400">
                      <div>Worker: <span className="text-slate-200">{run.workerId || "unassigned"}</span></div>
                      <div>Attempt: <span className="text-slate-200">{run.retryCount} / {run.maxRetries}</span></div>
                      <div>Plan Rev: <span className="text-slate-200">{run.currentPlanRevision}</span></div>
                      <div>Started: <span className="text-slate-200">{run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : "queued"}</span></div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectRun(run)}
                        className="text-xs border-slate-700 text-slate-300"
                      >
                        Inspect Run Details
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: APPROVALS & EXCEPTIONS */}
        {activeTab === "approvals" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Pending Approvals Queue</h3>
                <span className="text-xs font-mono text-amber-400">{pendingApprovals.length} waiting</span>
              </div>

              {pendingApprovals.length === 0 ? (
                <Card className="p-8 text-center bg-slate-900 border-slate-800 text-slate-400">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-sm">Approval inbox is clear.</p>
                  <p className="text-xs text-slate-500 mt-1">No autonomous runs are currently paused waiting for human authorization.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map((run) => (
                    <ApprovalActionCard
                      key={run.id}
                      runId={run.id}
                      taskName={tasks.find((t) => t.id === run.taskDefinitionId)?.name || "Autonomous Task"}
                      reason={String(run.errorDetails?.reason || "Human review requested for consequential action or plan adaptation.")}
                      autonomyLevel={run.autonomyLevel}
                      retryCount={run.retryCount}
                      requiresMutation={true}
                      onApprove={(feedback) => handleApproveRun(run.id, feedback)}
                      onReject={(reason) => handleRejectRun(run.id, reason)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">Exception & Recovery Intelligence</h3>
              <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Failure Classification Engine</span>
                </div>
                <p className="text-xs text-slate-400">
                  Autonomous runs classify errors into <strong className="text-emerald-400">Retryable</strong> (rate limits, concurrency locks, transient timeouts) and <strong className="text-rose-400">Terminal</strong> (authorization failures, malformed requests, constraint violations).
                </p>
                <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-200">Automatic Bounded Replanning</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Transients trigger automatic exponential backoff up to 3 revisions. Bounded adaptations never expand agent scopes.
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-200">Consequential Mutation Gates</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Any state modification under L1/L2 autonomy halts execution into <code className="text-amber-300">waiting_approval</code> until an authorized supervisor approves.
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 5: EXECUTION HISTORY */}
        {activeTab === "history" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Run History & Checkpoint Audit</h3>
                <span className="text-xs text-slate-400 font-mono">{runs.length} runs</span>
              </div>

              {runs.length === 0 ? (
                <Card className="p-8 text-center bg-slate-900 border-slate-800 text-slate-400">
                  <History className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                  <p className="text-sm">No task runs recorded yet.</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {runs.map((run) => {
                    const isSelected = selectedRun?.id === run.id;
                    const task = tasks.find((t) => t.id === run.taskDefinitionId);
                    return (
                      <div
                        key={run.id}
                        onClick={() => handleSelectRun(run)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-slate-900 border-purple-500 text-slate-100 shadow-sm shadow-purple-950/20"
                            : "bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-purple-400">{run.id.slice(0, 8)}</span>
                            <span className="font-semibold text-slate-200">{task?.name || "Autonomous Run"}</span>
                            <AutonomyBadge level={run.autonomyLevel} />
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3">
                            <span>Key: {run.idempotencyKey.slice(0, 16)}...</span>
                            <span>Retries: {run.retryCount}</span>
                            <span>Created: {new Date(run.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <OperationalStatusBadge status={run.status} />
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Run Drawer Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-200">Execution Inspector</h3>
              {selectedRun ? (
                <Card className="p-4 bg-slate-900 border-slate-800 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-purple-400">ID: {selectedRun.id}</span>
                      <OperationalStatusBadge status={selectedRun.status} />
                    </div>
                    <div className="mt-2 text-xs font-mono text-slate-400 space-y-1">
                      <div>Autonomy: <strong className="text-slate-200">{selectedRun.autonomyLevel}</strong></div>
                      <div>Worker: <strong className="text-slate-200">{selectedRun.workerId || "unassigned"}</strong></div>
                      <div>Plan Revision: <strong className="text-slate-200">{selectedRun.currentPlanRevision}</strong></div>
                      <div>Retries: <strong className="text-slate-200">{selectedRun.retryCount} / {selectedRun.maxRetries}</strong></div>
                    </div>
                  </div>

                  {/* Checkpoints */}
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Checkpoints ({checkpoints.length})
                    </span>
                    {checkpoints.length === 0 ? (
                      <p className="text-[11px] text-slate-500">No checkpoints recorded.</p>
                    ) : (
                      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                        {checkpoints.map((cp) => (
                          <div key={cp.id} className="p-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono">
                            <span className="text-emerald-400">{cp.checkpointType}</span>
                            <span className="text-slate-500 ml-2">{new Date(cp.createdAt).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Events Stream */}
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Event Stream ({events.length})
                    </span>
                    {events.length === 0 ? (
                      <p className="text-[11px] text-slate-500">No events captured.</p>
                    ) : (
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {events.map((ev) => (
                          <div key={ev.id} className="p-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono flex items-center justify-between">
                            <span className="text-purple-300">{ev.eventType}</span>
                            <span className="text-slate-500 text-[10px]">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-6 text-center bg-slate-900 border-slate-800 text-xs text-slate-500">
                  Select a run to inspect its checkpoints and event timeline.
                </Card>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: POLICIES & LIMITS */}
        {activeTab === "policies" && (
          <div className="max-w-2xl space-y-4">
            <h3 className="text-sm font-semibold text-slate-200">Organization Autonomous Task Policy</h3>
            {policy ? (
              <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Default Autonomy Level</label>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono">
                      {policy.defaultAutonomyLevel}
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Max Global Concurrency</label>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono">
                      {policy.maxGlobalConcurrency} concurrent tasks
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Max Active Tasks</label>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono">
                      {policy.maxActiveTasks}
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Allowed Autonomy Levels</label>
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono">
                      {policy.allowedAutonomyLevels?.join(", ") || "L0, L1, L2, L3"}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-200">Emergency Stop Switch</div>
                    <div className="text-xs text-slate-400">Immediately freeze all execution across this organization</div>
                  </div>
                  <Button
                    variant={policy.emergencyStopAll ? "destructive" : "outline"}
                    size="sm"
                    onClick={handleToggleGlobalEmergency}
                  >
                    {policy.emergencyStopAll ? "Lift Freeze" : "Activate Freeze"}
                  </Button>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center bg-slate-900 border-slate-800 text-xs text-slate-500">
                Loading policy...
              </Card>
            )}
          </div>
        )}

        {/* MODAL: CREATE TASK */}
        {isCreateTaskOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-100">Create Autonomous Task</h3>
                <button
                  onClick={() => setIsCreateTaskOpen(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Task Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
                    placeholder="e.g. Weekly Academic Progress Synthesis"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Description</label>
                  <textarea
                    rows={2}
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
                    placeholder="Describe the operational goal and recurring outcome..."
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Autonomy Level</label>
                    <select
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
                      value={newTaskLevel}
                      onChange={(e) => setNewTaskLevel(e.target.value as AutonomyLevel)}
                    >
                      <option value="L0">L0 - Read-Only</option>
                      <option value="L1">L1 - Bounded Advisory</option>
                      <option value="L2">L2 - Supervised Execution</option>
                      <option value="L3">L3 - Continuous Operations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Target Type</label>
                    <select
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
                      value={newTaskTargetType}
                      onChange={(e) => setNewTaskTargetType(e.target.value as "workflow" | "agent")}
                    >
                      <option value="workflow">Workflow</option>
                      <option value="agent">Agent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Timeout (s)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                      value={newTaskMaxRuntime}
                      onChange={(e) => setNewTaskMaxRuntime(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Max Retries</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                      value={newTaskMaxRetries}
                      onChange={(e) => setNewTaskMaxRetries(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Cost Cap ($)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                      value={newTaskMaxCost}
                      onChange={(e) => setNewTaskMaxCost(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateTaskOpen(false)}
                    className="border-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white">
                    Create Task
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: CREATE TRIGGER */}
        {isCreateTriggerOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-slate-100">Register Task Trigger</h3>
                <button
                  onClick={() => setIsCreateTriggerOpen(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTrigger} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Trigger Name</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                    placeholder="e.g. Daily 6AM Batch Schedule"
                    value={newTriggerName}
                    onChange={(e) => setNewTriggerName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Trigger Type</label>
                  <select
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                    value={newTriggerType}
                    onChange={(e) => setNewTriggerType(e.target.value as TriggerType)}
                  >
                    <option value="schedule">Schedule (Cron)</option>
                    <option value="event">Domain Event</option>
                  </select>
                </div>

                {newTriggerType === "schedule" ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Cron Expression</label>
                        <input
                          type="text"
                          required
                          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono"
                          placeholder="0 6 * * *"
                          value={newTriggerCron}
                          onChange={(e) => setNewTriggerCron(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Timezone</label>
                        <input
                          type="text"
                          required
                          className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                          placeholder="Asia/Singapore"
                          value={newTriggerTimezone}
                          onChange={(e) => setNewTriggerTimezone(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Event Pattern</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 font-mono"
                      placeholder="education.curriculum.published.*"
                      value={newTriggerEventPattern}
                      onChange={(e) => setNewTriggerEventPattern(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Missed Schedule Policy</label>
                  <select
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
                    value={newTriggerMissedPolicy}
                    onChange={(e) => setNewTriggerMissedPolicy(e.target.value as "run_once" | "skip" | "run_all")}
                  >
                    <option value="run_once">Run Once (Catch-up single execution)</option>
                    <option value="skip">Skip (Wait for next cycle)</option>
                    <option value="run_all">Run All (Replay missed slots)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateTriggerOpen(false)}
                    className="border-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white">
                    Register Trigger
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
