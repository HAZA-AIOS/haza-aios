import React, { useState, useEffect, useRef } from "react";
import {
  AcademicPlanningRequestCard,
  LessonPlanViewer,
  LessonPlanEditor,
  LessonPlanStatusBadge,
  CurriculumVerificationBadge,
  Button,
  Card,
  Badge,
  type AcademicPlanningFormData,
  type LessonPlanContent,
} from "@haza-aios/ui";
import { useOrganization } from "@/org/use-organization";
import { Link } from "@/routes/router";
import { AppShell } from "@/components/AppShell";
import {
  ArrowLeft,
  GraduationCap,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ListFilter,
  Download,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  AcademicPlanningService,
  type AcademicAssistantStatus,
  type AcademicLessonPlanItem,
} from "@/modules/education/services/academic-planning.service";

export const AcademicPlanningAssistantPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Status & Metadata
  const [status, setStatus] = useState<AcademicAssistantStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Active View Tab: 'plan' | 'history'
  const [activeTab, setActiveTab] = useState<"plan" | "history">("plan");

  // Current Generation / Run State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [generationPhase, setGenerationPhase] = useState<string>("");
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Current Active Lesson Plan
  const [currentPlan, setCurrentPlan] = useState<AcademicLessonPlanItem | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // History State
  const [plans, setPlans] = useState<AcademicLessonPlanItem[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const pollIntervalRef = useRef<number | null>(null);

  // 1. Initial Load: Resolve default workspace and agent availability
  useEffect(() => {
    if (!currentOrganization) return;

    let isMounted = true;
    async function loadWorkspaceAndStatus() {
      setIsLoadingStatus(true);
      try {
        const wsId = await AcademicPlanningService.getDefaultWorkspaceId(currentOrganization!.id);
        if (!isMounted) return;
        setWorkspaceId(wsId);

        const st = await AcademicPlanningService.getStatus(currentOrganization!.id, wsId);
        if (!isMounted) return;
        setStatus(st);
      } catch (err: any) {
        console.error("Failed to load academic assistant status:", err);
      } finally {
        if (isMounted) setIsLoadingStatus(false);
      }
    }

    loadWorkspaceAndStatus();
    return () => {
      isMounted = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [currentOrganization]);

  // 2. Load Plans for History Tab
  const loadPlans = async () => {
    if (!currentOrganization || !workspaceId) return;
    setIsLoadingPlans(true);
    try {
      const res = await AcademicPlanningService.listLessonPlans(currentOrganization.id, workspaceId, {
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchQuery.trim() || undefined,
        pageSize: 50,
      });
      setPlans(res.plans);
    } catch (err: any) {
      console.error("Failed to load lesson plans:", err);
    } finally {
      setIsLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadPlans();
    }
  }, [activeTab, currentOrganization, workspaceId, statusFilter, searchQuery]);

  // 3. Handle Plan Generation Request
  const handleGenerate = async (formData: AcademicPlanningFormData) => {
    if (!currentOrganization || !workspaceId) return;
    setIsGenerating(true);
    setGenerationError(null);
    setCurrentPlan(null);
    setIsEditingDraft(false);
    setGenerationPhase("Queuing generation task with pedagogical instructions...");

    try {
      const res = await AcademicPlanningService.generateLessonPlan(
        currentOrganization.id,
        workspaceId,
        formData,
        false, // Queued for unattended worker execution
      );

      const runId = res.run.id;
      setCurrentRunId(runId);
      setGenerationPhase("Task claimed by runtime worker. Generating 17-point structured lesson plan...");

      // Poll until completed or failed
      const startTime = Date.now();
      const interval = window.setInterval(async () => {
        try {
          const runPoll = await AcademicPlanningService.pollRun(currentOrganization.id, runId);
          const currentStatus = runPoll.run.status;

          if (currentStatus === "running") {
            setGenerationPhase("Validating curriculum objectives, differentiation tiers, and assessment...");
          } else if (currentStatus === "completed") {
            window.clearInterval(interval);
            pollIntervalRef.current = null;
            setIsGenerating(false);
            setGenerationPhase("Draft completed and validated! Loading lesson plan...");

            // Fetch the newly created lesson plan from list
            const plansRes = await AcademicPlanningService.listLessonPlans(currentOrganization.id, workspaceId, {
              pageSize: 5,
            });
            const createdPlan = plansRes.plans.find((p) => p.agentRunId === runId) || plansRes.plans[0];
            if (createdPlan) {
              setCurrentPlan(createdPlan);
            }
          } else if (currentStatus === "failed" || currentStatus === "cancelled") {
            window.clearInterval(interval);
            pollIntervalRef.current = null;
            setIsGenerating(false);
            setGenerationError(
              runPoll.run.safeErrorMessage || runPoll.run.errorMessage || "Lesson plan generation encountered an error.",
            );
          } else if (Date.now() - startTime > 120000) {
            // Timeout after 2 minutes
            window.clearInterval(interval);
            pollIntervalRef.current = null;
            setIsGenerating(false);
            setGenerationError("Generation timed out. The worker task is still progressing in background.");
          }
        } catch (pollErr: any) {
          console.warn("Error polling agent run:", pollErr);
        }
      }, 2000);

      pollIntervalRef.current = interval;
    } catch (err: any) {
      setIsGenerating(false);
      setGenerationError(err.message || "Failed to initiate lesson plan generation.");
    }
  };

  // 4. Save Draft
  const handleSaveDraft = async (updatedContent: LessonPlanContent) => {
    if (!currentOrganization || !currentPlan) return;
    setIsSavingDraft(true);
    try {
      const res = await AcademicPlanningService.updateLessonPlanDraft(
        currentOrganization.id,
        currentPlan.id,
        updatedContent,
      );
      setCurrentPlan(res.plan);
      setIsEditingDraft(false);
    } catch (err: any) {
      alert("Failed to save draft: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingDraft(false);
    }
  };

  // 5. Teacher Approval
  const handleApprove = async () => {
    if (!currentOrganization || !currentPlan) return;
    const confirmApprove = window.confirm(
      "Approve this lesson plan as institutional curriculum draft? This certifies that the pedagogical sequence and differentiation have been reviewed by a qualified educator.",
    );
    if (!confirmApprove) return;

    setIsApproving(true);
    try {
      const res = await AcademicPlanningService.approveLessonPlan(
        currentOrganization.id,
        currentPlan.id,
        "Reviewed and approved for classroom instruction by authorized teacher.",
      );
      setCurrentPlan(res.plan);
    } catch (err: any) {
      alert("Approval failed: " + (err.message || "Unknown error"));
    } finally {
      setIsApproving(false);
    }
  };

  // 6. Publish to LMS
  const handlePublish = async () => {
    if (!currentOrganization || !currentPlan) return;
    const confirmPublish = window.confirm(
      "Publish this approved lesson plan to LMS? It will become visible in the course syllabus and teacher planner.",
    );
    if (!confirmPublish) return;

    setIsPublishing(true);
    try {
      const res = await AcademicPlanningService.publishLessonPlan(currentOrganization.id, currentPlan.id, {
        publishTarget: "lms_course_syllabus",
      });
      setCurrentPlan(res.plan);
    } catch (err: any) {
      alert("Publish failed: " + (err.message || "Unknown error"));
    } finally {
      setIsPublishing(false);
    }
  };

  // 7. Direct Exports
  const handleExport = async (format: "markdown" | "json") => {
    if (!currentOrganization || !currentPlan) return;
    try {
      const exp = await AcademicPlanningService.exportLessonPlan(currentOrganization.id, currentPlan.id, format);
      const blob = new Blob([exp.content], { type: exp.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exp.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Export failed: " + (err.message || "Unknown error"));
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/workspace/education/academic"
              className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg bg-slate-900 border border-slate-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                <Link to="/workspace/education" className="hover:text-slate-200">
                  Education
                </Link>
                <span>/</span>
                <Link to="/workspace/education/academic" className="hover:text-slate-200">
                  Academics &amp; LMS
                </Link>
                <span>/</span>
                <span className="text-cyan-400 font-medium">Academic Planning Assistant</span>
              </div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
                  <GraduationCap className="size-7" />
                </span>
                HAZA Academic Planning Assistant
              </h1>
              <p className="text-slate-400 mt-1 text-sm">
                Human-supervised institutional AI agent for curriculum-aligned lesson planning and 3-tier differentiation.
              </p>
            </div>
          </div>

          {/* Engine Status Pill */}
          <div className="flex items-center gap-3">
            {status?.inferenceMode === "live" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <Zap className="size-4" />
                <span>Live AI Inference (Production)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium">
                <ShieldCheck className="size-4 text-cyan-400" />
                <span>Deterministic Pedagogical Assistant</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-px">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("plan")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "plan"
                  ? "border-cyan-500 text-cyan-400 bg-cyan-500/5 rounded-t-lg"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="size-4" />
              Generate &amp; Plan
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === "history"
                  ? "border-cyan-500 text-cyan-400 bg-cyan-500/5 rounded-t-lg"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="size-4" />
              Lesson Plan Archive &amp; Drafts
            </button>
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">
            Epic 15 &bull; Enterprise Human-in-the-Loop Governance
          </div>
        </div>

        {/* TAB 1: GENERATE & PLAN */}
        {activeTab === "plan" && (
          <div className="space-y-8">
            {/* If no plan is loaded and not generating, show request form */}
            {!currentPlan && !isGenerating && (
              <AcademicPlanningRequestCard
                onSubmit={handleGenerate}
                isLoading={isGenerating}
                inferenceMode={status?.inferenceMode}
              />
            )}

            {/* Live Generation Panel */}
            {isGenerating && (
              <Card className="border-cyan-500/30 bg-slate-900/90 p-8 text-center space-y-4 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5 animate-pulse" />
                <div className="relative z-10 flex flex-col items-center">
                  <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-2 animate-bounce">
                    <Sparkles className="size-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Synthesizing Pedagogical Sequence</h3>
                  <p className="text-sm text-cyan-300 mt-2 max-w-md">{generationPhase}</p>

                  <div className="w-full max-w-md bg-slate-950 rounded-full h-2 mt-6 overflow-hidden border border-slate-800">
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full w-2/3 animate-[pulse_1.5s_infinite]" />
                  </div>

                  <p className="text-xs text-slate-400 mt-4">
                    Autonomous worker running lease-fenced queue claim. Zero browser hang.
                  </p>
                </div>
              </Card>
            )}

            {/* Error Message */}
            {generationError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Generation Notice:</strong>
                  <span>{generationError}</span>
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setGenerationError(null)}
                      className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs"
                    >
                      Dismiss &amp; Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Active Plan: Viewer or Editor */}
            {currentPlan && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPlan(null);
                      setIsEditingDraft(false);
                    }}
                    className="border-slate-800 bg-slate-900 text-slate-300 text-xs hover:bg-slate-800"
                  >
                    &larr; Create Another Lesson Plan
                  </Button>
                </div>

                {isEditingDraft ? (
                  <LessonPlanEditor
                    initialContent={currentPlan.content}
                    onSaveDraft={handleSaveDraft}
                    onCancel={() => setIsEditingDraft(false)}
                    isSaving={isSavingDraft}
                  />
                ) : (
                  <LessonPlanViewer
                    plan={currentPlan.content}
                    status={currentPlan.status}
                    planId={currentPlan.id}
                    onEdit={() => setIsEditingDraft(true)}
                    onApprove={handleApprove}
                    onPublish={handlePublish}
                    onExportMarkdown={() => handleExport("markdown")}
                    onExportJson={() => handleExport("json")}
                    isApproving={isApproving}
                    isPublishing={isPublishing}
                    canApprove={true}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: HISTORY & DRAFTS */}
        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by topic, grade, or subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-800 bg-slate-900 text-sm text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Drafts</option>
                  <option value="approved">Teacher Approved</option>
                  <option value="published">Published to LMS</option>
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadPlans}
                disabled={isLoadingPlans}
                className="border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 text-xs flex items-center gap-2"
              >
                <RefreshCw className={`size-3.5 ${isLoadingPlans ? "animate-spin" : ""}`} />
                Refresh Archive
              </Button>
            </div>

            {isLoadingPlans ? (
              <div className="p-12 text-center text-slate-500">Loading lesson plans archive...</div>
            ) : plans.length === 0 ? (
              <Card className="border-slate-800 bg-slate-900/50 p-12 text-center">
                <div className="p-3 rounded-full bg-slate-800/80 text-slate-400 w-fit mx-auto mb-3">
                  <FileText className="size-6" />
                </div>
                <h4 className="text-base font-semibold text-slate-200">No Lesson Plans Found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No lesson plans match the selected criteria. Return to Generate &amp; Plan to craft your first lesson.
                </p>
                <div className="mt-4">
                  <Button size="sm" onClick={() => setActiveTab("plan")} className="bg-cyan-600 hover:bg-cyan-500 text-xs">
                    Start New Lesson Plan
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((p) => (
                  <Card
                    key={p.id}
                    className="border-slate-800 bg-slate-900/80 hover:border-slate-700 transition-all p-5 shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <LessonPlanStatusBadge status={p.status} />
                        <span className="text-[11px] text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="text-base font-bold text-white line-clamp-1">{p.title}</h4>
                      <p className="text-xs text-cyan-400 mt-0.5">
                        {p.gradeLevel} &bull; {p.subject}
                      </p>
                      <p className="text-xs text-slate-300 mt-2 line-clamp-2">Topic: {p.topic}</p>

                      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        <CurriculumVerificationBadge status={p.verificationStatus} />
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-slate-500" />
                          {p.durationMinutes}m
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setCurrentPlan(p);
                          setIsEditingDraft(false);
                          setActiveTab("plan");
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                      >
                        Open Plan &rarr;
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          title="Download Markdown"
                          onClick={async () => {
                            if (!currentOrganization) return;
                            const exp = await AcademicPlanningService.exportLessonPlan(
                              currentOrganization.id,
                              p.id,
                              "markdown",
                            );
                            const blob = new Blob([exp.content], { type: exp.mimeType });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = exp.filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        >
                          <Download className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};
