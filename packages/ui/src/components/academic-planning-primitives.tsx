import React from "react";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Download,
  Send,
  Edit3,
  Save,
  Check,
  ChevronRight,
  ListOrdered,
  Lightbulb,
  FileCheck,
  Target,
  Wrench,
  HelpCircle,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Types & Models
   ───────────────────────────────────────────────────────────── */

export type LessonPlanStatus = "draft" | "reviewed" | "approved" | "published" | "archived";

export type CurriculumVerificationStatus = "institutional_verified" | "general_guidance";

export interface TeachingStep {
  phase: string;
  durationMinutes: number;
  teacherActions: string;
  studentActions: string;
}

export interface LessonPlanContent {
  title: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  learningObjectives: string[];
  requiredMaterials: string[];
  priorKnowledge: string;
  lessonIntroduction: string;
  teachingSequence: TeachingStep[];
  guidedPractice: string;
  independentActivities: string;
  differentiation: {
    support: string;
    core: string;
    extension: string;
  };
  formativeAssessment: string;
  exitTicket: string;
  teacherNotes: string;
  homeworkSuggestions?: string;
  curriculumStandard?: string;
  verificationStatus?: CurriculumVerificationStatus;
}

export interface AcademicPlanningFormData {
  gradeLevel: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  learningGoals: string;
  curriculumReference?: string;
  teachingLanguage: string;
  teacherInstructions?: string;
  priorKnowledge?: string;
  availableResources?: string;
  activityPreference?: string;
  assessmentPreference?: string;
}

/* ─────────────────────────────────────────────────────────────
   Curriculum Verification Badge
   ───────────────────────────────────────────────────────────── */

export function CurriculumVerificationBadge({
  status = "general_guidance",
  className,
}: {
  status?: CurriculumVerificationStatus | string;
  className?: string;
}) {
  const isVerified = status === "institutional_verified";

  if (isVerified) {
    return (
      <span
        title="Institutional curriculum citation verified against connected academic standard."
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300",
          className,
        )}
      >
        <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
        Institutional Standard Verified
      </span>
    );
  }

  return (
    <span
      title="Unverified curriculum reference: Treated as general pedagogical planning guidance."
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300",
        className,
      )}
    >
      <ShieldAlert className="size-3.5 text-amber-400 shrink-0" />
      General Planning Guidance
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   Lesson Plan Status Badge
   ───────────────────────────────────────────────────────────── */

export function LessonPlanStatusBadge({
  status,
  className,
}: {
  status: LessonPlanStatus | string;
  className?: string;
}) {
  const norm = status?.toLowerCase() || "draft";

  const styles: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
    draft: {
      bg: "bg-amber-500/10",
      text: "text-amber-300",
      border: "border-amber-500/20",
      dot: "bg-amber-400",
      label: "Draft",
    },
    reviewed: {
      bg: "bg-blue-500/10",
      text: "text-blue-300",
      border: "border-blue-500/20",
      dot: "bg-blue-400",
      label: "Reviewed",
    },
    approved: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-300",
      border: "border-emerald-500/20",
      dot: "bg-emerald-400",
      label: "Teacher Approved",
    },
    published: {
      bg: "bg-purple-500/10",
      text: "text-purple-300",
      border: "border-purple-500/20",
      dot: "bg-purple-400",
      label: "Published to LMS",
    },
    archived: {
      bg: "bg-slate-500/10",
      text: "text-slate-400",
      border: "border-slate-500/20",
      dot: "bg-slate-400",
      label: "Archived",
    },
  };

  const current = styles[norm] || styles.draft;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        current.bg,
        current.text,
        current.border,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", current.dot)} />
      {current.label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   Academic Planning Request Card
   ───────────────────────────────────────────────────────────── */

export interface AcademicPlanningRequestCardProps {
  initialValues?: Partial<AcademicPlanningFormData>;
  onSubmit: (values: AcademicPlanningFormData) => void;
  isLoading?: boolean;
  className?: string;
  inferenceMode?: "live" | "mock_fallback";
}

export function AcademicPlanningRequestCard({
  initialValues,
  onSubmit,
  isLoading = false,
  className,
  inferenceMode = "mock_fallback",
}: AcademicPlanningRequestCardProps) {
  const [formData, setFormData] = React.useState<AcademicPlanningFormData>({
    gradeLevel: initialValues?.gradeLevel || "Grade 8",
    subject: initialValues?.subject || "Science",
    topic: initialValues?.topic || "Cellular Respiration and Photosynthesis",
    durationMinutes: initialValues?.durationMinutes || 45,
    learningGoals:
      initialValues?.learningGoals ||
      "Students will compare the biochemical inputs and outputs of photosynthesis and cellular respiration.",
    curriculumReference: initialValues?.curriculumReference || "",
    teachingLanguage: initialValues?.teachingLanguage || "English",
    teacherInstructions: initialValues?.teacherInstructions || "",
    priorKnowledge: initialValues?.priorKnowledge || "",
    availableResources: initialValues?.availableResources || "",
    activityPreference: initialValues?.activityPreference || "Collaborative lab inquiry and diagram synthesis",
    assessmentPreference: initialValues?.assessmentPreference || "Formative exit ticket with diagram labeling",
  });

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.topic.trim() || !formData.learningGoals.trim()) return;
    onSubmit(formData);
  };

  return (
    <Card className={cn("border-slate-800 bg-slate-900/90 backdrop-blur-md p-6 shadow-xl", className)}>
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">Plan a New Lesson</h3>
            <p className="text-xs text-slate-400">
              Generate structured, standards-aware pedagogical sequences with 17-point differentiation.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inferenceMode === "live" ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
              <Sparkles className="size-3" /> Live AI Engine
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-400 border border-slate-700">
              Deterministic Assistant
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Grade Level <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Grade 8, Grade 10, K-5"
              value={formData.gradeLevel}
              onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Subject <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Science, Mathematics, English"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Duration (Minutes) <span className="text-rose-400">*</span>
            </label>
            <select
              value={formData.durationMinutes}
              onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value={30}>30 Minutes</option>
              <option value={45}>45 Minutes (Standard)</option>
              <option value={60}>60 Minutes</option>
              <option value={90}>90 Minutes (Block)</option>
              <option value={120}>120 Minutes (Extended)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Topic <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cellular Respiration and Photosynthesis"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Teaching Language</label>
            <select
              value={formData.teachingLanguage}
              onChange={(e) => setFormData({ ...formData, teachingLanguage: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Arabic">Arabic</option>
              <option value="Urdu">Urdu</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Learning Goals or Objectives <span className="text-rose-400">*</span>
          </label>
          <textarea
            required
            rows={2}
            placeholder="Specific learning outcome(s) learners should achieve by the end of the lesson."
            value={formData.learningGoals}
            onChange={(e) => setFormData({ ...formData, learningGoals: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">
              Curriculum Standard Reference <span className="text-slate-500">(Optional)</span>
            </label>
            <span className="text-[10px] text-amber-400/90">
              If not institutional, will be labeled as general guidance
            </span>
          </div>
          <input
            type="text"
            placeholder="e.g. NGSS MS-LS1-6, CCSS.MATH.CONTENT.8.EE.A.1, Cambridge IGCSE 0610"
            value={formData.curriculumReference}
            onChange={(e) => setFormData({ ...formData, curriculumReference: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
          >
            {showAdvanced ? "Hide Context & Preferences" : "Show Context & Preferences (Prior Knowledge, Differentiation)"}
          </button>
        </div>

        {showAdvanced && (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 animate-in fade-in duration-150">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Prior Knowledge & Concepts</label>
              <input
                type="text"
                placeholder="What foundational concepts have students already covered?"
                value={formData.priorKnowledge}
                onChange={(e) => setFormData({ ...formData, priorKnowledge: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Available Classroom Resources</label>
              <input
                type="text"
                placeholder="e.g. Interactive whiteboard, student tablets, microscopes, lab worksheet"
                value={formData.availableResources}
                onChange={(e) => setFormData({ ...formData, availableResources: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Preferred Activity Style</label>
                <input
                  type="text"
                  placeholder="e.g. Hands-on inquiry, peer discussion, solo problem-solving"
                  value={formData.activityPreference}
                  onChange={(e) => setFormData({ ...formData, activityPreference: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assessment Preference</label>
                <input
                  type="text"
                  placeholder="e.g. Quick check questions, 3-question rubric, graphic organizer"
                  value={formData.assessmentPreference}
                  onChange={(e) => setFormData({ ...formData, assessmentPreference: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Additional Teacher Instructions</label>
              <textarea
                rows={2}
                placeholder="Specific differentiation needs, student accommodation pointers, or pacing emphasis."
                value={formData.teacherInstructions}
                onChange={(e) => setFormData({ ...formData, teacherInstructions: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            disabled={isLoading || !formData.topic.trim() || !formData.learningGoals.trim()}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-lg shadow-cyan-900/30 transition-all"
          >
            {isLoading ? (
              <>
                <span className="size-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                Submitting Request...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate Structured Lesson Plan
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   Lesson Plan 17-Point Viewer
   ───────────────────────────────────────────────────────────── */

export interface LessonPlanViewerProps {
  plan: LessonPlanContent;
  status: LessonPlanStatus | string;
  planId?: string;
  onEdit?: () => void;
  onApprove?: () => void;
  onPublish?: () => void;
  onExportMarkdown?: () => void;
  onExportJson?: () => void;
  isApproving?: boolean;
  isPublishing?: boolean;
  canApprove?: boolean;
  className?: string;
}

export function LessonPlanViewer({
  plan,
  status,
  onEdit,
  onApprove,
  onPublish,
  onExportMarkdown,
  onExportJson,
  isApproving = false,
  isPublishing = false,
  canApprove = true,
  className,
}: LessonPlanViewerProps) {
  const isApproved = status === "approved" || status === "published";
  const isPublished = status === "published";

  return (
    <div className={cn("space-y-6 text-slate-100", className)}>
      {/* Top Banner / Actions */}
      <Card className="border-slate-800 bg-slate-900/90 p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <LessonPlanStatusBadge status={status} />
              <CurriculumVerificationBadge status={plan.verificationStatus || "general_guidance"} />
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="size-3 text-slate-400" />
                {plan.durationMinutes} Minutes
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <BookOpen className="size-3 text-slate-400" />
                {plan.gradeLevel} &bull; {plan.subject}
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">{plan.title}</h2>
            <p className="text-sm text-slate-300 mt-1">Topic: {plan.topic}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onExportMarkdown && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportMarkdown}
                className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs"
              >
                <Download className="size-3.5 mr-1.5" /> Markdown
              </Button>
            )}
            {onExportJson && (
              <Button
                variant="outline"
                size="sm"
                onClick={onExportJson}
                className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs"
              >
                <Download className="size-3.5 mr-1.5" /> JSON
              </Button>
            )}
            {onEdit && !isPublished && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs"
              >
                <Edit3 className="size-3.5 mr-1.5" /> Edit Draft
              </Button>
            )}
            {canApprove && !isApproved && onApprove && (
              <Button
                size="sm"
                onClick={onApprove}
                disabled={isApproving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-md shadow-emerald-950/40"
              >
                <CheckCircle2 className="size-3.5 mr-1.5" />
                {isApproving ? "Approving..." : "Approve as Teacher"}
              </Button>
            )}
            {isApproved && !isPublished && onPublish && (
              <Button
                size="sm"
                onClick={onPublish}
                disabled={isPublishing}
                className="bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs shadow-md shadow-purple-950/40"
              >
                <Send className="size-3.5 mr-1.5" />
                {isPublishing ? "Publishing..." : "Publish to LMS"}
              </Button>
            )}
          </div>
        </div>

        {/* Governance note */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Pedagogical Governance:</strong> This lesson plan is human-supervised and requires teacher review
              before curricular publication.
            </span>
          </div>
          {plan.curriculumStandard && (
            <span className="text-[11px] text-slate-300">Standard Citation: {plan.curriculumStandard}</span>
          )}
        </div>
      </Card>

      {/* Grid: Objectives & Prior Knowledge & Materials */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Objectives */}
        <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md md:col-span-2">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-cyan-400">
            <Target className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Learning Objectives</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {plan.learningObjectives?.map((obj, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-200">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-[11px] font-bold text-cyan-400 border border-cyan-500/20">
                  {i + 1}
                </span>
                <span>{obj}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Required Materials */}
        <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-amber-400">
            <Wrench className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Required Materials</h3>
          </div>
          <ul className="mt-3 space-y-1.5">
            {plan.requiredMaterials?.map((mat, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className="text-amber-400 mt-0.5">&bull;</span>
                <span>{mat}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Introduction & Prior Knowledge */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-blue-400">
            <Layers className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Prior Knowledge Required</h3>
          </div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">{plan.priorKnowledge}</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-emerald-400">
            <Lightbulb className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Lesson Introduction (Hook)</h3>
          </div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">{plan.lessonIntroduction}</p>
        </Card>
      </div>

      {/* Teaching Sequence (Table / Phase Sequence) */}
      <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-100">
          <div className="flex items-center gap-2 text-cyan-400">
            <ListOrdered className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Step-by-Step Teaching Sequence</h3>
          </div>
          <span className="text-xs text-slate-400">
            Total Allocated: {plan.teachingSequence?.reduce((acc, step) => acc + (step.durationMinutes || 0), 0)} min
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3 w-1/5">Phase & Timing</th>
                <th className="py-2.5 px-3 w-2/5">Teacher Actions</th>
                <th className="py-2.5 px-3 w-2/5">Student Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {plan.teachingSequence?.map((step, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-3 align-top font-medium text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-cyan-400">{step.phase}</span>
                    </div>
                    <span className="inline-block mt-1 text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {step.durationMinutes} min
                    </span>
                  </td>
                  <td className="py-3 px-3 align-top text-slate-300 leading-relaxed">{step.teacherActions}</td>
                  <td className="py-3 px-3 align-top text-slate-300 leading-relaxed">{step.studentActions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Guided Practice & Independent Activities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-cyan-400">
            <FileText className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Guided Practice</h3>
          </div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">{plan.guidedPractice}</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-indigo-400">
            <FileCheck className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Independent Activities</h3>
          </div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">{plan.independentActivities}</p>
        </Card>
      </div>

      {/* 3-Tier Differentiation Card */}
      <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-purple-400">
          <Layers className="size-4" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">
            Curriculum Differentiation (3-Tier Support)
          </h3>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-400">
              Support / Remediation
            </span>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">{plan.differentiation?.support}</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-cyan-400">Core Instruction</span>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">{plan.differentiation?.core}</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
              Extension / Advanced Learners
            </span>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">{plan.differentiation?.extension}</p>
          </div>
        </div>
      </Card>

      {/* Formative Assessment & Exit Ticket */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-rose-400">
            <Target className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Formative Assessment</h3>
          </div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">{plan.formativeAssessment}</p>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-teal-400">
            <CheckCircle2 className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Exit Ticket (5 min check)</h3>
          </div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">{plan.exitTicket}</p>
        </Card>
      </div>

      {/* Teacher Notes & Optional Homework */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-400">
            <HelpCircle className="size-4" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">Teacher Pedagogical Notes</h3>
          </div>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">{plan.teacherNotes}</p>
        </Card>

        {plan.homeworkSuggestions && (
          <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-md">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-slate-400">
              <BookOpen className="size-4" />
              <h3 className="text-sm font-semibold uppercase tracking-wider">Homework Suggestions</h3>
            </div>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">{plan.homeworkSuggestions}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Lesson Plan Editor (Teacher Draft Modification)
   ───────────────────────────────────────────────────────────── */

export interface LessonPlanEditorProps {
  initialContent: LessonPlanContent;
  onSaveDraft: (updatedContent: LessonPlanContent) => void;
  onCancel: () => void;
  isSaving?: boolean;
  className?: string;
}

export function LessonPlanEditor({
  initialContent,
  onSaveDraft,
  onCancel,
  isSaving = false,
  className,
}: LessonPlanEditorProps) {
  const [content, setContent] = React.useState<LessonPlanContent>(initialContent);

  const handleSequenceChange = (index: number, field: keyof TeachingStep, val: any) => {
    const updated = [...(content.teachingSequence || [])];
    updated[index] = { ...updated[index], [field]: val };
    setContent({ ...content, teachingSequence: updated });
  };

  const handleAddObjective = () => {
    setContent({ ...content, learningObjectives: [...(content.learningObjectives || []), ""] });
  };

  const handleObjectiveChange = (index: number, val: string) => {
    const updated = [...(content.learningObjectives || [])];
    updated[index] = val;
    setContent({ ...content, learningObjectives: updated });
  };

  const handleRemoveObjective = (index: number) => {
    const updated = content.learningObjectives.filter((_, i) => i !== index);
    setContent({ ...content, learningObjectives: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveDraft(content);
  };

  return (
    <Card className={cn("border-slate-800 bg-slate-900/90 p-6 shadow-xl", className)}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-semibold text-white">Edit Lesson Plan Draft</h3>
            <p className="text-xs text-slate-400">
              Modify pedagogical targets, teaching sequence, and classroom differentiation before approval.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="border-slate-700 bg-slate-800 text-slate-300 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSaving}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-1.5"
            >
              <Save className="size-3.5" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Lesson Title</label>
            <input
              type="text"
              required
              value={content.title}
              onChange={(e) => setContent({ ...content, title: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Topic</label>
            <input
              type="text"
              required
              value={content.topic}
              onChange={(e) => setContent({ ...content, topic: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Objectives */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-300">Learning Objectives</label>
            <button
              type="button"
              onClick={handleAddObjective}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              + Add Objective
            </button>
          </div>
          <div className="space-y-2">
            {content.learningObjectives?.map((obj, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={obj}
                  onChange={(e) => handleObjectiveChange(i, e.target.value)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveObjective(i)}
                  className="text-slate-500 hover:text-rose-400 text-xs px-2"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Introduction */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Lesson Introduction / Hook</label>
          <textarea
            rows={2}
            value={content.lessonIntroduction}
            onChange={(e) => setContent({ ...content, lessonIntroduction: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Step-by-Step Sequence */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">Teaching Sequence Steps</label>
          <div className="space-y-3">
            {content.teachingSequence?.map((step, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={step.phase}
                    placeholder="Phase name"
                    onChange={(e) => handleSequenceChange(idx, "phase", e.target.value)}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  />
                  <input
                    type="number"
                    value={step.durationMinutes}
                    placeholder="Duration (min)"
                    onChange={(e) => handleSequenceChange(idx, "durationMinutes", Number(e.target.value))}
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                  />
                </div>
                <textarea
                  rows={2}
                  value={step.teacherActions}
                  placeholder="Teacher Actions"
                  onChange={(e) => handleSequenceChange(idx, "teacherActions", e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                />
                <textarea
                  rows={2}
                  value={step.studentActions}
                  placeholder="Student Actions"
                  onChange={(e) => handleSequenceChange(idx, "studentActions", e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Differentiation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-amber-400 mb-1">Support Tier</label>
            <textarea
              rows={2}
              value={content.differentiation?.support || ""}
              onChange={(e) =>
                setContent({
                  ...content,
                  differentiation: { ...content.differentiation, support: e.target.value },
                })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-cyan-400 mb-1">Core Tier</label>
            <textarea
              rows={2}
              value={content.differentiation?.core || ""}
              onChange={(e) =>
                setContent({
                  ...content,
                  differentiation: { ...content.differentiation, core: e.target.value },
                })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-emerald-400 mb-1">Extension Tier</label>
            <textarea
              rows={2}
              value={content.differentiation?.extension || ""}
              onChange={(e) =>
                setContent({
                  ...content,
                  differentiation: { ...content.differentiation, extension: e.target.value },
                })
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Assessment & Exit Ticket */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Formative Assessment</label>
            <textarea
              rows={2}
              value={content.formativeAssessment}
              onChange={(e) => setContent({ ...content, formativeAssessment: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Exit Ticket</label>
            <textarea
              rows={2}
              value={content.exitTicket}
              onChange={(e) => setContent({ ...content, exitTicket: e.target.value })}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Teacher Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Teacher Notes</label>
          <textarea
            rows={2}
            value={content.teacherNotes}
            onChange={(e) => setContent({ ...content, teacherNotes: e.target.value })}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </form>
    </Card>
  );
}
