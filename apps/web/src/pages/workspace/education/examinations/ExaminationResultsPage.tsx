import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { useOrganization } from "@/org/use-organization";
import { useAuth } from "@/auth/use-auth";
import { Link } from "@/routes/router";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { EnrollmentService } from "@/modules/education/sis/enrollment.service";
import { ExaminationService } from "@/modules/education/sis/examination.service";
import { StaffService } from "@/modules/education/sis/staff.service";
import { StudentService } from "@/modules/education/sis/student.service";
import type {
  AcademicYear,
  Assessment,
  AssessmentType,
  Examination,
  ExaminationResultRegister,
  ExaminationSubject,
  ExaminationType,
  Grade,
  GradingRule,
  MarkRecord,
  MissingMarksReportItem,
  ResultCorrectionRequest,
  ResultPublication,
  Section,
  Staff,
  Student,
  StudentResult,
  StudentResultCard,
  Subject,
  SubjectPerformance,
} from "@/modules/education/sis/sis.types";
import {
  AdminPageHeader,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  GradebookStatCard,
  GradeBadge,
} from "@haza-aios/ui";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  FileCheck2,
  GraduationCap,
  Save,
  CheckCircle2,
  AlertTriangle,
  Users,
  Printer,
  Download,
  ShieldCheck,
  Send,
  RotateCcw,
  Lock,
  Edit3,
  Award,
  FileText,
  Clock,
  Trash2,
  Archive,
} from "lucide-react";

export type ExamTab =
  | "examinations"
  | "assessments"
  | "marks"
  | "results"
  | "corrections"
  | "cards"
  | "reports";

interface ExaminationResultsPageProps {
  initialTab?: ExamTab;
}

const examTypes: Array<{ label: string; value: ExaminationType }> = [
  { label: "Monthly Test", value: "monthly_test" },
  { label: "Mid-Term", value: "mid_term" },
  { label: "Final-Term", value: "final_term" },
  { label: "Annual Examination", value: "annual" },
  { label: "Entry / Assessment Test", value: "entry_assessment" },
  { label: "Other", value: "other" },
];

const assessmentTypes: Array<{ label: string; value: AssessmentType }> = [
  { label: "Class Test", value: "class_test" },
  { label: "Assignment", value: "assignment" },
  { label: "Quiz", value: "quiz" },
  { label: "Project", value: "project" },
  { label: "Practical Work", value: "practical" },
  { label: "Oral Assessment", value: "oral" },
  { label: "Other", value: "other" },
];

function today() {
  return new Date().toISOString().split("T")[0];
}

export function ExaminationResultsPage({ initialTab = "examinations" }: ExaminationResultsPageProps) {
  const { currentOrganization, currentMembership } = useOrganization();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ExamTab>(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [examinations, setExaminations] = useState<Examination[]>([]);
  const [examSubjects, setExamSubjects] = useState<ExaminationSubject[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [gradingRules, setGradingRules] = useState<GradingRule[]>([]);
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [calculatedResults, setCalculatedResults] = useState<StudentResult[]>([]);
  const [subjectPerformance, setSubjectPerformance] = useState<SubjectPerformance | null>(null);
  const [publications, setPublications] = useState<ResultPublication[]>([]);
  const [corrections, setCorrections] = useState<ResultCorrectionRequest[]>([]);

  // Examination form
  const [examForm, setExamForm] = useState({
    name: "",
    academicYearId: "",
    termId: "",
    type: "mid_term" as ExaminationType,
    startDate: today(),
    endDate: today(),
    status: "scheduled" as const,
    description: "",
  });

  const [examSubjectForm, setExamSubjectForm] = useState({
    examinationId: "",
    gradeId: "",
    sectionId: "",
    subjectId: "",
    maximumMarks: 100,
    passingMarks: 40,
    weightage: 100,
    examDate: today(),
  });

  const [assessmentForm, setAssessmentForm] = useState({
    title: "",
    academicYearId: "",
    termId: "",
    gradeId: "",
    sectionId: "",
    subjectId: "",
    teacherId: "",
    type: "class_test" as AssessmentType,
    maximumMarks: 20,
    passingMarks: 8,
    weightage: 10,
    assessmentDate: today(),
  });

  // Gradebook / Marks Entry Selection
  const [markSourceType, setMarkSourceType] = useState<"examination" | "assessment">("examination");
  const [marksGradeId, setMarksGradeId] = useState("");
  const [marksSectionId, setMarksSectionId] = useState("");
  const [marksExamId, setMarksExamId] = useState("");
  const [marksExamSubjectId, setMarksExamSubjectId] = useState("");
  const [marksAssessmentId, setMarksAssessmentId] = useState("");

  const [enrolledRosterStudentIds, setEnrolledRosterStudentIds] = useState<string[]>([]);
  const [markInputs, setMarkInputs] = useState<
    Record<string, { obtainedMarks: string; status: "present" | "absent" | "exempt"; remarks: string }>
  >({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSavingMarks, setIsSavingMarks] = useState(false);
  const [hasUnsavedMarks, setHasUnsavedMarks] = useState(false);

  // Results Tab Selection & Workflow State
  const [resultSelection, setResultSelection] = useState({
    examinationId: "",
    gradeId: "",
    sectionId: "",
    studentId: "",
  });
  const [reviewComments, setReviewComments] = useState("");

  // Correction Request State
  const [correctionForm, setCorrectionForm] = useState({
    examinationId: "",
    gradeId: "",
    sectionId: "",
    studentId: "",
    subjectId: "",
    newMarks: "",
    reason: "",
  });
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

  // Result Cards Tab State
  const [cardSelection, setCardSelection] = useState({
    examinationId: "",
    gradeId: "",
    sectionId: "",
    studentId: "",
    mode: "single" as "single" | "batch",
  });
  const [singleResultCard, setSingleResultCard] = useState<StudentResultCard | null>(null);
  const [batchResultCards, setBatchResultCards] = useState<StudentResultCard[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(false);

  // Reports Tab State
  const [reportSelection, setReportSelection] = useState({
    examinationId: "",
    gradeId: "",
    sectionId: "",
    reportType: "register" as "register" | "missing" | "summary",
  });
  const [resultRegister, setResultRegister] = useState<ExaminationResultRegister | null>(null);
  const [missingMarksReport, setMissingMarksReport] = useState<MissingMarksReportItem[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const activeExamSubject = useMemo(() => {
    return examSubjects.find((item) => item.id === marksExamSubjectId);
  }, [examSubjects, marksExamSubjectId]);

  const selectedExamForMarks = useMemo(() => {
    return examinations.find((item) => item.id === marksExamId);
  }, [examinations, marksExamId]);

  const activeAssessment = useMemo(() => {
    return assessments.find((item) => item.id === marksAssessmentId);
  }, [assessments, marksAssessmentId]);

  const activeMaxMarks = useMemo(() => {
    if (markSourceType === "examination") {
      return activeExamSubject?.maximumMarks ?? 100;
    }
    return activeAssessment?.maximumMarks ?? 100;
  }, [markSourceType, activeExamSubject, activeAssessment]);

  const activePassingMarks = useMemo(() => {
    if (markSourceType === "examination") {
      return activeExamSubject?.passingMarks ?? 40;
    }
    return activeAssessment?.passingMarks ?? 40;
  }, [markSourceType, activeExamSubject, activeAssessment]);

  const activeSubjectId = useMemo(() => {
    if (markSourceType === "examination") {
      return activeExamSubject?.subjectId ?? "";
    }
    return activeAssessment?.subjectId ?? "";
  }, [markSourceType, activeExamSubject, activeAssessment]);

  const enrolledStudents = useMemo(() => {
    return (students || []).filter((s) => (enrolledRosterStudentIds || []).includes(s.id));
  }, [students, enrolledRosterStudentIds]);

  const currentPublication = useMemo(() => {
    return (publications || []).find(
      (p) =>
        p.examinationId === resultSelection.examinationId &&
        p.gradeId === resultSelection.gradeId &&
        p.sectionId === resultSelection.sectionId
    );
  }, [publications, resultSelection]);

  const isExamPublished = useMemo(() => {
    const exam = (examinations || []).find((e) => e.id === marksExamId);
    return exam?.status === "published" || currentPublication?.status === "published";
  }, [examinations, marksExamId, currentPublication]);

  const userRole = currentMembership?.role ?? "Teacher";

  useEffect(() => {
    void loadData();
  }, [currentOrganization]);

  useEffect(() => {
    if (!currentOrganization) return;
    if (markSourceType === "examination" && activeExamSubject && selectedExamForMarks) {
      void loadMarksRoster();
    } else if (markSourceType === "assessment" && activeAssessment) {
      void loadMarksRoster();
    }
  }, [
    currentOrganization,
    markSourceType,
    marksExamSubjectId,
    marksExamId,
    marksAssessmentId,
  ]);

  async function loadData(throwOnError = false) {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      const [
        yearsData,
        gradesData,
        sectionsData,
        subjectsData,
        studentsData,
        staffData,
        examsData,
        examSubjectsData,
        assessmentsData,
        gradingData,
        marksData,
        pubsData,
        correctionsData,
      ] = await Promise.all([
        AcademicService.getAcademicYears(orgId),
        AcademicService.getGrades(orgId),
        AcademicService.getSections(orgId),
        AcademicService.getSubjects(orgId),
        StudentService.getStudents(orgId),
        StaffService.getStaffList(orgId),
        ExaminationService.getExaminations(orgId),
        ExaminationService.getExaminationSubjects(orgId),
        ExaminationService.getAssessments(orgId),
        ExaminationService.getGradingRules(orgId),
        ExaminationService.getMarks(orgId),
        ExaminationService.getResultPublications(orgId),
        ExaminationService.getResultCorrections(orgId),
      ]);

      setAcademicYears(Array.isArray(yearsData) ? yearsData : []);
      setGrades(Array.isArray(gradesData) ? gradesData : []);
      setSections(Array.isArray(sectionsData) ? sectionsData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setTeachers(Array.isArray(staffData) ? staffData.filter((member) => member.staffType === "teacher") : []);
      setExaminations(Array.isArray(examsData) ? examsData : []);
      setExamSubjects(Array.isArray(examSubjectsData) ? examSubjectsData : []);
      setAssessments(Array.isArray(assessmentsData) ? assessmentsData : []);
      setGradingRules(Array.isArray(gradingData) ? gradingData : []);
      setMarks(Array.isArray(marksData) ? marksData : []);
      setPublications(Array.isArray(pubsData) ? pubsData : []);
      setCorrections(Array.isArray(correctionsData) ? correctionsData : []);

      const activeYear = yearsData.find((year) => year.status === "active") || yearsData[0];
      setExamForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || activeYear?.id || "",
      }));
      setAssessmentForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || activeYear?.id || "",
      }));
      setExamSubjectForm((current) => ({
        ...current,
        examinationId: current.examinationId || examsData[0]?.id || "",
        gradeId: current.gradeId || gradesData[0]?.id || "",
        sectionId: current.sectionId || sectionsData[0]?.id || "",
        subjectId: current.subjectId || subjectsData[0]?.id || "",
      }));

      if (examsData[0]) {
        setMarksExamId(examsData[0].id);
        setResultSelection((c) => ({ ...c, examinationId: examsData[0].id }));
        setCardSelection((c) => ({ ...c, examinationId: examsData[0].id }));
        setReportSelection((c) => ({ ...c, examinationId: examsData[0].id }));
      }
      if (examSubjectsData[0]) {
        setMarksExamSubjectId(examSubjectsData[0].id);
        setMarksGradeId(examSubjectsData[0].gradeId);
        setMarksSectionId(examSubjectsData[0].sectionId || "");
      }
      if (gradesData[0]) {
        setResultSelection((c) => ({ ...c, gradeId: gradesData[0].id }));
        setCardSelection((c) => ({ ...c, gradeId: gradesData[0].id }));
        setReportSelection((c) => ({ ...c, gradeId: gradesData[0].id }));
      }
      if (sectionsData[0]) {
        setResultSelection((c) => ({ ...c, sectionId: sectionsData[0].id }));
        setCardSelection((c) => ({ ...c, sectionId: sectionsData[0].id }));
        setReportSelection((c) => ({ ...c, sectionId: sectionsData[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load examination data.");
      if (throwOnError) throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMarksRoster(throwOnError = false) {
    if (!currentOrganization) return;
    try {
      const orgId = currentOrganization.id;
      let targetGradeId = marksGradeId;
      let targetSectionId = marksSectionId;

      if (markSourceType === "examination" && activeExamSubject) {
        targetGradeId = activeExamSubject.gradeId;
        targetSectionId = activeExamSubject.sectionId || "";
      } else if (markSourceType === "assessment" && activeAssessment) {
        targetGradeId = activeAssessment.gradeId;
        targetSectionId = activeAssessment.sectionId;
      }

      if (!targetGradeId) {
        setEnrolledRosterStudentIds([]);
        setMarkInputs({});
        return;
      }

      const enrollments = await EnrollmentService.getEnrollments(orgId, {
        gradeId: targetGradeId,
        sectionId: targetSectionId || undefined,
        status: "active",
      });

      const rosterStudentIds = enrollments.map((e) => e.studentId);
      setEnrolledRosterStudentIds(rosterStudentIds);

      // Pre-fill existing marks
      const filterSourceId =
        markSourceType === "examination" ? marksExamId : marksAssessmentId;
      const relevantMarks = await ExaminationService.getMarks(orgId, {
        sourceType: markSourceType,
        sourceId: filterSourceId,
        gradeId: targetGradeId,
        sectionId: targetSectionId || undefined,
        subjectId: activeSubjectId,
      });

      const inputs: Record<string, { obtainedMarks: string; status: "present" | "absent" | "exempt"; remarks: string }> = {};
      for (const studentId of rosterStudentIds) {
        const found = relevantMarks.find((m) => m.studentId === studentId);
        if (found) {
          const isAbs = found.remarks?.startsWith("[ABSENT]") || found.grade === "ABS";
          const isExm = found.remarks?.startsWith("[EXEMPT]") || found.grade === "EXM";
          inputs[studentId] = {
            obtainedMarks: isAbs || isExm ? "" : String(found.obtainedMarks),
            status: isAbs ? "absent" : isExm ? "exempt" : "present",
            remarks: (found.remarks ?? "").replace(/^\[(ABSENT|EXEMPT)\]\s*/, ""),
          };
        } else {
          inputs[studentId] = { obtainedMarks: "", status: "present", remarks: "" };
        }
      }
      setMarkInputs(inputs);
      setValidationErrors({});
      setHasUnsavedMarks(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load class roster.");
      if (throwOnError) throw err;
    }
  }

  function handleMarkInputChange(studentId: string, value: string) {
    setHasUnsavedMarks(true);
    setMarkInputs((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: "present", remarks: "" }),
        obtainedMarks: value,
      },
    }));

    if (value === "") {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      return;
    }

    const num = Number(value);
    if (!Number.isFinite(num)) {
      setValidationErrors((prev) => ({ ...prev, [studentId]: "Must be a valid number" }));
    } else if (num < 0) {
      setValidationErrors((prev) => ({ ...prev, [studentId]: "Cannot be negative" }));
    } else if (num > activeMaxMarks) {
      setValidationErrors((prev) => ({
        ...prev,
        [studentId]: `Cannot exceed maximum marks (${activeMaxMarks})`,
      }));
    } else {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  }

  function handleStatusChange(studentId: string, status: "present" | "absent" | "exempt") {
    setHasUnsavedMarks(true);
    setMarkInputs((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { obtainedMarks: "", remarks: "" }),
        status,
        obtainedMarks: status === "present" ? prev[studentId]?.obtainedMarks || "" : "",
      },
    }));
    if (status !== "present") {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  }

  function handleRemarkInputChange(studentId: string, remarks: string) {
    setHasUnsavedMarks(true);
    setMarkInputs((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { obtainedMarks: "", status: "present" }),
        remarks,
      },
    }));
  }

  async function handleSaveMarks() {
    if (!currentOrganization) return;
    if (isSavingMarks) return;
    if (Object.keys(validationErrors).length > 0) {
      setError("Please fix marks validation errors before saving.");
      return;
    }
    if (isExamPublished) {
      setError("Cannot modify marks: this examination is published and locked. Submit a formal correction request.");
      return;
    }

    setIsSavingMarks(true);
    setError(null);
    setMessage(null);

    try {
      const orgId = currentOrganization.id;
      const sourceId = markSourceType === "examination" ? marksExamId : marksAssessmentId;
      const enteredBy = user?.displayName || user?.email || "staff-user";

      const inputsToSave = Object.entries(markInputs)
        .filter(([, val]) => val.status !== "present" || val.obtainedMarks.trim() !== "")
        .map(([studentId, val]) => ({
          sourceType: markSourceType,
          sourceId,
          examinationSubjectId:
            markSourceType === "examination" ? marksExamSubjectId : undefined,
          sectionId: marksSectionId || undefined,
          studentId,
          obtainedMarks: val.status === "present" ? Number(val.obtainedMarks) : 0,
          isAbsent: val.status === "absent",
          isExempt: val.status === "exempt",
          remarks: val.remarks.trim() || undefined,
          enteredBy,
        }));

      if (inputsToSave.length === 0) {
        setMessage("No marks entered to save.");
        setIsSavingMarks(false);
        return;
      }

      try {
        await ExaminationService.bulkEnterMarks(orgId, inputsToSave);
        setMessage("Gradebook marks saved successfully.");
        setHasUnsavedMarks(false);
      } catch (saveErr) {
        // Preserve unsaved marks in state on save failure
        const rawMessage = saveErr instanceof Error ? saveErr.message : String(saveErr);
        const safeMessage = rawMessage.includes("500") || rawMessage.toLowerCase().includes("internal server error")
          ? "An unexpected error occurred while saving marks. Please check your entries and try again."
          : rawMessage;
        setError(safeMessage);
        return;
      }

      // Distinguish save failures from post-save refresh failures
      try {
        await loadData(true);
        await loadMarksRoster(true);
      } catch (refreshErr) {
        setError("Marks were saved successfully, but refreshing the roster failed. Please reload the page.");
      }
    } finally {
      setIsSavingMarks(false);
    }
  }

  function calculateStudentGrade(obtainedMarksStr: string, status = "present") {
    if (status === "absent") return { pct: 0, gradeLetter: "ABS", passed: false };
    if (status === "exempt") return { pct: 100, gradeLetter: "EXM", passed: true };
    if (!obtainedMarksStr || obtainedMarksStr.trim() === "") return null;
    const obtained = Number(obtainedMarksStr);
    if (!Number.isFinite(obtained) || obtained < 0 || obtained > activeMaxMarks) return null;
    const pct = Math.round((obtained / activeMaxMarks) * 10000) / 100;
    const rule = gradingRules.find(
      (r) => pct >= r.minPercentage && pct <= r.maxPercentage
    );
    return {
      pct,
      gradeLetter: rule?.grade || "F",
      passed: obtained >= activePassingMarks,
    };
  }

  const gradebookStats = useMemo(() => {
    const validScores: number[] = [];
    let passCount = 0;
    let absentCount = 0;
    let exemptCount = 0;

    for (const student of enrolledStudents) {
      const input = markInputs[student.id];
      if (!input) continue;
      if (input.status === "absent") {
        absentCount++;
      } else if (input.status === "exempt") {
        exemptCount++;
      } else if (input.obtainedMarks.trim() !== "") {
        const num = Number(input.obtainedMarks);
        if (Number.isFinite(num) && num >= 0 && num <= activeMaxMarks) {
          validScores.push(num);
          if (num >= activePassingMarks) passCount++;
        }
      }
    }

    const totalStudents = enrolledStudents.length;
    const marksEnteredCount = validScores.length + absentCount + exemptCount;
    const average =
      validScores.length > 0
        ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
        : 0;
    const averagePct =
      validScores.length > 0
        ? Math.round((average / activeMaxMarks) * 1000) / 10
        : 0;
    const highest = validScores.length > 0 ? Math.max(...validScores) : 0;
    const lowest = validScores.length > 0 ? Math.min(...validScores) : 0;

    return {
      totalStudents,
      marksEnteredCount,
      averagePercentage: averagePct,
      highestPercentage:
        validScores.length > 0 ? Math.round((highest / activeMaxMarks) * 1000) / 10 : 0,
      lowestPercentage:
        validScores.length > 0 ? Math.round((lowest / activeMaxMarks) * 1000) / 10 : 0,
      passCount,
      absentCount,
      exemptCount,
    };
  }, [enrolledStudents, markInputs, activeMaxMarks, activePassingMarks]);

  // Exam CRUD Handlers
  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.createExamination(currentOrganization.id, examForm);
      setMessage("Examination scheduled successfully.");
      setExamForm({
        name: "",
        academicYearId: academicYears[0]?.id || "",
        termId: "",
        type: "mid_term",
        startDate: today(),
        endDate: today(),
        status: "scheduled",
        description: "",
      });
      await loadData();
    });
  }

  async function handleArchiveExam(id: string) {
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.archiveExamination(currentOrganization.id, id);
      setMessage("Examination archived successfully.");
      await loadData();
    });
  }

  async function handleDeleteExam(id: string) {
    if (!currentOrganization) return;
    if (!confirm("Are you sure you want to delete this examination?")) return;
    await runAction(async () => {
      await ExaminationService.deleteExamination(currentOrganization.id, id);
      setMessage("Examination deleted successfully.");
      await loadData();
    });
  }

  async function handleAddExamSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.addExaminationSubject(currentOrganization.id, {
        ...examSubjectForm,
        sectionId: examSubjectForm.sectionId || undefined,
        status: "scheduled",
      });
      setMessage("Subject added to examination schedule.");
      await loadData();
    });
  }

  async function handleDeleteExamSubject(id: string) {
    if (!currentOrganization) return;
    if (!confirm("Delete this subject from the examination schedule?")) return;
    await runAction(async () => {
      await ExaminationService.deleteExaminationSubject(currentOrganization.id, id);
      setMessage("Examination subject removed.");
      await loadData();
    });
  }

  async function handleCreateAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.createAssessment(currentOrganization.id, {
        ...assessmentForm,
        status: "draft",
      });
      setMessage("Assessment created successfully.");
      await loadData();
    });
  }

  // Result Calculation & Approval Handlers
  async function handleCalculateResults() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const res = await ExaminationService.calculateClassResults(
        currentOrganization.id,
        resultSelection.examinationId,
        resultSelection.gradeId,
        resultSelection.sectionId
      );
      setCalculatedResults(res);
      setMessage(`Authoritative results calculated for ${res.length} student(s) with class rankings.`);
    });
  }

  async function handleSubmitForReview() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.submitForReview(
        currentOrganization.id,
        resultSelection.examinationId,
        resultSelection.gradeId,
        resultSelection.sectionId,
        { userId: user?.displayName || user?.email || "teacher", role: userRole as "Owner" | "Admin" | "Teacher" }
      );
      setMessage("Results submitted for review successfully.");
      await loadData();
      await handleCalculateResults();
    });
  }

  async function handleReviewDecision(decision: "approved" | "rejected") {
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.reviewResults(
        currentOrganization.id,
        resultSelection.examinationId,
        resultSelection.gradeId,
        resultSelection.sectionId,
        decision,
        reviewComments,
        { userId: user?.displayName || user?.email || "reviewer", role: userRole as "Owner" | "Admin" | "Teacher" }
      );
      setMessage(decision === "approved" ? "Results approved! Ready for publication." : "Results rejected and returned to draft for corrections.");
      setReviewComments("");
      await loadData();
    });
  }

  async function handlePublishResults() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.publishResults(
        currentOrganization.id,
        resultSelection.examinationId,
        resultSelection.gradeId,
        resultSelection.sectionId,
        { userId: user?.displayName || user?.email || "admin", role: "Admin" }
      );
      setMessage("Results published and locked successfully! Results are now visible in student/parent portals.");
      await loadData();
      await handleCalculateResults();
    });
  }

  // Result Corrections Handlers
  async function handleRequestCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.requestResultCorrection(currentOrganization.id, {
        examinationId: correctionForm.examinationId,
        gradeId: correctionForm.gradeId,
        sectionId: correctionForm.sectionId,
        studentId: correctionForm.studentId,
        subjectId: correctionForm.subjectId,
        newMarks: Number(correctionForm.newMarks),
        reason: correctionForm.reason,
        requestedBy: user?.displayName || user?.email || "teacher",
      });
      setMessage("Correction request submitted for approval.");
      setIsCorrectionModalOpen(false);
      setCorrectionForm({ examinationId: "", gradeId: "", sectionId: "", studentId: "", subjectId: "", newMarks: "", reason: "" });
      await loadData();
    });
  }

  async function handleReviewCorrection(id: string, decision: "approved" | "rejected") {
    if (!currentOrganization) return;
    const comments = prompt(`Enter comments for ${decision} decision:`) || undefined;
    await runAction(async () => {
      await ExaminationService.reviewResultCorrection(
        currentOrganization.id,
        id,
        decision,
        comments,
        { userId: user?.displayName || user?.email || "admin", role: "Admin" }
      );
      setMessage(`Correction request ${decision}. Class results automatically recalculated and updated.`);
      await loadData();
    });
  }

  // Result Cards Handlers
  async function handleLoadResultCards() {
    if (!currentOrganization || !cardSelection.examinationId) return;
    setIsLoadingCards(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      if (cardSelection.mode === "single") {
        if (!cardSelection.studentId) {
          setError("Please select a student to generate result card.");
          setIsLoadingCards(false);
          return;
        }
        const card = await ExaminationService.getResultCard(orgId, cardSelection.examinationId, cardSelection.studentId);
        setSingleResultCard(card);
        setBatchResultCards([]);
      } else {
        if (!cardSelection.gradeId || !cardSelection.sectionId) {
          setError("Please select class and section for batch card printing.");
          setIsLoadingCards(false);
          return;
        }
        const cards = await ExaminationService.getBatchResultCards(
          orgId,
          cardSelection.examinationId,
          cardSelection.gradeId,
          cardSelection.sectionId
        );
        setBatchResultCards(cards);
        setSingleResultCard(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load result card(s).");
    } finally {
      setIsLoadingCards(false);
    }
  }

  // Reports Handlers
  async function handleLoadReport() {
    if (!currentOrganization || !reportSelection.examinationId) return;
    setIsLoadingReport(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      if (reportSelection.reportType === "register") {
        if (!reportSelection.gradeId || !reportSelection.sectionId) {
          setError("Please select class and section for Result Register.");
          setIsLoadingReport(false);
          return;
        }
        const reg = await ExaminationService.getExamResultRegister(
          orgId,
          reportSelection.examinationId,
          reportSelection.gradeId,
          reportSelection.sectionId
        );
        setResultRegister(reg);
      } else if (reportSelection.reportType === "missing") {
        const missing = await ExaminationService.getMissingMarksReport(
          orgId,
          reportSelection.examinationId,
          reportSelection.gradeId || undefined,
          reportSelection.sectionId || undefined
        );
        setMissingMarksReport(missing);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setIsLoadingReport(false);
    }
  }

  function handleExportRegisterCSV() {
    if (!resultRegister) return;
    const headers = [
      "Roll / Admission No",
      "Student Name",
      ...resultRegister.subjects.map((s) => `${s.name} (${s.maximumMarks})`),
      "Total Obtained",
      "Total Max",
      "Percentage",
      "Grade",
      "Result",
      "Rank",
    ];

    const rows = resultRegister.students.map((st) => [
      st.admissionNumber,
      `"${st.name}"`,
      ...resultRegister.subjects.map((s) => {
        const sm = st.subjectMarks[s.id];
        if (!sm) return "N/A";
        if (sm.isAbsent) return "ABS";
        if (sm.isExempt) return "EXM";
        return sm.obtainedMarks;
      }),
      st.totalObtained,
      st.totalMaximum,
      `${st.percentage}%`,
      st.grade || "-",
      st.passed ? "PASSED" : "FAILED",
      st.rankLabel || st.position || "-",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(csvContent, `Result_Register_${resultRegister.examination.name}.csv`);
  }

  function handleExportMissingCSV() {
    if (!missingMarksReport.length) return;
    const headers = ["Admission No", "Student Name", "Class", "Section", "Subject", "Examination"];
    const rows = missingMarksReport.map((m) => [
      m.admissionNumber,
      `"${m.studentName}"`,
      m.gradeName,
      m.sectionName,
      m.subjectName,
      `"${m.examinationName}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(csvContent, "Missing_Marks_Report.csv");
  }

  function downloadCSV(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function runAction(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  }

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name || "Subject";
  const gradeName = (id: string) => grades.find((g) => g.id === id)?.name || "Grade";
  const sectionName = (id?: string) => (id ? sections.find((s) => s.id === id)?.name || "" : "All");
  const studentName = (id: string) => {
    const st = students.find((s) => s.id === id);
    return st ? `${st.firstName} ${st.lastName}`.trim() : "Student";
  };

  if (!currentOrganization) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-24 print:p-0 print:space-y-0">
        <div className="flex items-center gap-2 text-slate-400 print:hidden">
          <Link to="/workspace" className="inline-flex items-center gap-1 text-sm hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to Workspace
          </Link>
        </div>

        <div className="print:hidden">
          <AdminPageHeader
            title="Examination & Results Management"
            description="Manage examinations, rosters, gradebook marks, controlled approvals, corrections, result cards and reports."
            actions={<Badge variant="secondary">Epic 10L • Production Ready</Badge>}
          />
        </div>

        {message && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2 print:hidden">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2 print:hidden">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Global Summary Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 print:hidden">
          <SummaryCard icon={<FileCheck2 className="h-5 w-5" />} label="Examinations" value={examinations.length} />
          <SummaryCard icon={<BookOpenCheck className="h-5 w-5" />} label="Marks Records" value={marks.length} />
          <SummaryCard icon={<ShieldCheck className="h-5 w-5" />} label="Publications" value={publications.length} />
          <SummaryCard icon={<RotateCcw className="h-5 w-5" />} label="Corrections" value={corrections.length} />
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/5 bg-[#0f141f] p-2 print:hidden">
          {[
            ["examinations", "Examinations & Schedule"],
            ["assessments", "Assessments"],
            ["marks", "Gradebook & Marks"],
            ["results", "Calculation & Approval"],
            ["corrections", "Result Corrections"],
            ["cards", "Printable Result Cards"],
            ["reports", "Reports & Registers"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id as ExamTab);
                setMessage(null);
                setError(null);
              }}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === id
                  ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-white/5 bg-[#0f141f] p-12 text-center text-slate-400">
            Loading examination data...
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. EXAMINATIONS & SUBJECTS CONFIGURATION */}
            {activeTab === "examinations" && (
              <div className="space-y-6">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-4 p-6">
                    <h2 className="text-lg font-semibold text-white">Create Examination</h2>
                    <form onSubmit={handleCreateExam} className="grid gap-3 lg:grid-cols-3">
                      <Input
                        placeholder="Examination name"
                        value={examForm.name}
                        onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                        required
                      />
                      <Select
                        value={examForm.type}
                        onChange={(e) => setExamForm({ ...examForm, type: e.target.value as ExaminationType })}
                      >
                        {examTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={examForm.academicYearId}
                        onChange={(e) => setExamForm({ ...examForm, academicYearId: e.target.value })}
                        required
                      >
                        <option value="">Academic Year</option>
                        {academicYears.map((year) => (
                          <option key={year.id} value={year.id}>
                            {year.name}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="date"
                        value={examForm.startDate}
                        onChange={(e) => setExamForm({ ...examForm, startDate: e.target.value })}
                      />
                      <Input
                        type="date"
                        value={examForm.endDate}
                        onChange={(e) => setExamForm({ ...examForm, endDate: e.target.value })}
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={examForm.description}
                        onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                      />
                      <div className="lg:col-span-3">
                        <Button type="submit">Create Examination</Button>
                      </div>
                    </form>

                    <div className="overflow-x-auto rounded-xl border border-white/5 mt-4">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Examination</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Dates</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {examinations.map((exam) => (
                            <tr key={exam.id} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-3 font-medium text-white">{exam.name}</td>
                              <td className="px-4 py-3 capitalize">{exam.type.replace("_", " ")}</td>
                              <td className="px-4 py-3 text-xs text-slate-400">
                                {exam.startDate} to {exam.endDate}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={
                                    exam.status === "published"
                                      ? "success"
                                      : exam.status === "scheduled"
                                        ? "secondary"
                                        : "default"
                                  }
                                >
                                  {exam.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right space-x-2">
                                {exam.status !== "published" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleArchiveExam(exam.id)}
                                      className="text-slate-400 hover:text-white"
                                    >
                                      <Archive className="w-4 h-4 mr-1" />
                                      Archive
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteExam(exam.id)}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" />
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-4 p-6">
                    <h2 className="text-lg font-semibold text-white">Configure Examination Subjects</h2>
                    <form onSubmit={handleAddExamSubject} className="grid gap-3 lg:grid-cols-4">
                      <Select
                        value={examSubjectForm.examinationId}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, examinationId: e.target.value })}
                        required
                      >
                        <option value="">Select Examination</option>
                        {examinations.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={examSubjectForm.gradeId}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, gradeId: e.target.value })}
                        required
                      >
                        <option value="">Select Class</option>
                        {grades.map((grade) => (
                          <option key={grade.id} value={grade.id}>
                            {grade.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={examSubjectForm.sectionId}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, sectionId: e.target.value })}
                      >
                        <option value="">All Sections</option>
                        {sections
                          .filter((s) => !examSubjectForm.gradeId || s.gradeId === examSubjectForm.gradeId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </Select>
                      <Select
                        value={examSubjectForm.subjectId}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, subjectId: e.target.value })}
                        required
                      >
                        <option value="">Select Subject</option>
                        {subjects.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name} ({sub.code})
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Maximum Marks"
                        value={examSubjectForm.maximumMarks}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, maximumMarks: Number(e.target.value) })}
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Passing Marks"
                        value={examSubjectForm.passingMarks}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, passingMarks: Number(e.target.value) })}
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="Weightage %"
                        value={examSubjectForm.weightage}
                        onChange={(e) => setExamSubjectForm({ ...examSubjectForm, weightage: Number(e.target.value) })}
                      />
                      <Button type="submit">Add Subject</Button>
                    </form>

                    <div className="overflow-x-auto rounded-xl border border-white/5 mt-4">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3">Class & Section</th>
                            <th className="px-4 py-3 text-center">Max Marks</th>
                            <th className="px-4 py-3 text-center">Passing</th>
                            <th className="px-4 py-3 text-center">Weightage</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {examSubjects.map((es) => (
                            <tr key={es.id} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-3 font-medium text-white">{subjectName(es.subjectId)}</td>
                              <td className="px-4 py-3">
                                {gradeName(es.gradeId)} — {sectionName(es.sectionId)}
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-slate-200">{es.maximumMarks}</td>
                              <td className="px-4 py-3 text-center font-semibold text-emerald-400">{es.passingMarks}</td>
                              <td className="px-4 py-3 text-center">{es.weightage ?? 100}%</td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteExamSubject(es.id)}
                                  className="text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Remove
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 2. ASSESSMENTS */}
            {activeTab === "assessments" && (
              <Card className="bg-[#0f141f] border-white/5">
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-lg font-semibold text-white">Create Assessment</h2>
                  <form onSubmit={handleCreateAssessment} className="grid gap-3 lg:grid-cols-4">
                    <Input
                      placeholder="Assessment title"
                      value={assessmentForm.title}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, title: e.target.value })}
                      required
                    />
                    <Select
                      value={assessmentForm.type}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, type: e.target.value as AssessmentType })}
                    >
                      {assessmentTypes.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={assessmentForm.academicYearId}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, academicYearId: e.target.value })}
                      required
                    >
                      <option value="">Academic Year</option>
                      {academicYears.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="date"
                      value={assessmentForm.assessmentDate}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, assessmentDate: e.target.value })}
                    />
                    <Select
                      value={assessmentForm.gradeId}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, gradeId: e.target.value })}
                      required
                    >
                      <option value="">Class</option>
                      {grades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={assessmentForm.sectionId}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, sectionId: e.target.value })}
                      required
                    >
                      <option value="">Section</option>
                      {sections
                        .filter((s) => !assessmentForm.gradeId || s.gradeId === assessmentForm.gradeId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </Select>
                    <Select
                      value={assessmentForm.subjectId}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, subjectId: e.target.value })}
                      required
                    >
                      <option value="">Subject</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={assessmentForm.teacherId}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, teacherId: e.target.value })}
                      required
                    >
                      <option value="">Teacher</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.firstName} {t.lastName}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Max Marks"
                      value={assessmentForm.maximumMarks}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, maximumMarks: Number(e.target.value) })}
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Passing Marks"
                      value={assessmentForm.passingMarks}
                      onChange={(e) => setAssessmentForm({ ...assessmentForm, passingMarks: Number(e.target.value) })}
                    />
                    <Button type="submit">Create Assessment</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* 3. GRADEBOOK & MARKS ENTRY */}
            {activeTab === "marks" && (
              <div className="space-y-6">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold text-white">Student Gradebook</h2>
                          {isExamPublished && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Lock className="w-3 h-3" /> Published & Locked
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">
                          Enter and validate marks with absent / exempt handling and real-time grading preview.
                        </p>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setMarkSourceType("examination");
                            setValidationErrors({});
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            markSourceType === "examination"
                              ? "bg-red-500 text-white shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Formal Examination
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMarkSourceType("assessment");
                            setValidationErrors({});
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            markSourceType === "assessment"
                              ? "bg-red-500 text-white shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Class Assessment
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end pt-2">
                      {markSourceType === "examination" ? (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Examination</label>
                            <Select
                              value={marksExamId}
                              onChange={(e) => {
                                setMarksExamId(e.target.value);
                                setMarksExamSubjectId("");
                              }}
                            >
                              <option value="">Select Examination</option>
                              {examinations.map((exam) => (
                                <option key={exam.id} value={exam.id}>
                                  {exam.name} ({exam.type})
                                </option>
                              ))}
                            </Select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Class & Subject</label>
                            <Select
                              value={marksExamSubjectId}
                              onChange={(e) => {
                                setMarksExamSubjectId(e.target.value);
                                const subj = examSubjects.find((s) => s.id === e.target.value);
                                if (subj) {
                                  setMarksGradeId(subj.gradeId);
                                  setMarksSectionId(subj.sectionId || "");
                                }
                              }}
                              disabled={!marksExamId}
                            >
                              <option value="">Select Subject</option>
                              {examSubjects
                                .filter((item) => item.examinationId === marksExamId)
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {subjectName(item.subjectId)} — {gradeName(item.gradeId)} {sectionName(item.sectionId)} ({item.maximumMarks} max)
                                  </option>
                                ))}
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Class / Grade</label>
                            <Select
                              value={marksGradeId}
                              onChange={(e) => {
                                setMarksGradeId(e.target.value);
                                setMarksSectionId("");
                              }}
                            >
                              <option value="">Select Class</option>
                              {grades.map((grade) => (
                                <option key={grade.id} value={grade.id}>
                                  {grade.name}
                                </option>
                              ))}
                            </Select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">Section</label>
                            <Select
                              value={marksSectionId}
                              onChange={(e) => setMarksSectionId(e.target.value)}
                              disabled={!marksGradeId}
                            >
                              <option value="">Select Section</option>
                              {sections
                                .filter((s) => !marksGradeId || s.gradeId === marksGradeId)
                                .map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="lg:col-span-2 flex justify-end gap-2">
                        {hasUnsavedMarks && (
                          <span className="text-amber-400 text-xs self-center flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Unsaved changes
                          </span>
                        )}
                        <Button
                          onClick={handleSaveMarks}
                          disabled={
                            (!activeExamSubject && !activeAssessment) ||
                            enrolledStudents.length === 0 ||
                            Object.keys(validationErrors).length > 0 ||
                            isSavingMarks ||
                            isExamPublished
                          }
                          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950/20"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {isSavingMarks ? "Saving..." : "Save Gradebook Marks"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {enrolledStudents.length > 0 && (
                  <GradebookStatCard
                    totalStudents={gradebookStats.totalStudents}
                    marksEnteredCount={gradebookStats.marksEnteredCount}
                    averagePercentage={gradebookStats.averagePercentage}
                    highestPercentage={gradebookStats.highestPercentage}
                    lowestPercentage={gradebookStats.lowestPercentage}
                    passCount={gradebookStats.passCount}
                  />
                )}

                <Card className="bg-[#0f141f] border-white/5">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-white">Student Marks Entry Roster</h3>
                      <p className="text-sm text-slate-400">
                        Max Marks: <span className="font-semibold text-white">{activeMaxMarks}</span> | Passing:{" "}
                        <span className="font-semibold text-emerald-400">{activePassingMarks}</span>
                      </p>
                    </div>
                    {isExamPublished && (
                      <span className="text-xs text-red-400 font-semibold bg-red-950/40 border border-red-800/40 px-3 py-1.5 rounded-lg">
                        Direct edits disabled for published exam. Use "Result Corrections" tab.
                      </span>
                    )}
                  </div>

                  <CardContent className="p-0">
                    {enrolledStudents.length === 0 ? (
                      <div className="py-16 text-center text-slate-400">
                        <BookOpenCheck className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                        <p className="text-base font-medium text-white">
                          Select an examination and examination subject to load the roster.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="bg-slate-900/60 text-xs uppercase text-slate-400 tracking-wider">
                            <tr>
                              <th className="px-5 py-4 font-semibold">Student</th>
                              <th className="px-4 py-4 font-semibold text-center">Attendance / Status</th>
                              <th className="px-5 py-4 font-semibold w-40">Obtained Marks</th>
                              <th className="px-4 py-4 font-semibold text-center">Percentage</th>
                              <th className="px-4 py-4 font-semibold text-center">Grade</th>
                              <th className="px-4 py-4 font-semibold text-center">Result</th>
                              <th className="px-5 py-4 font-semibold">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {enrolledStudents.map((student) => {
                              const input = markInputs[student.id] || {
                                obtainedMarks: "",
                                status: "present" as const,
                                remarks: "",
                              };
                              const calc = calculateStudentGrade(input.obtainedMarks, input.status);
                              const fieldError = validationErrors[student.id];

                              return (
                                <tr key={student.id} className="hover:bg-white/[0.02]">
                                  <td className="px-5 py-4">
                                    <div className="font-medium text-white">
                                      {student.firstName} {student.lastName}
                                    </div>
                                    <div className="text-xs text-slate-500">{student.admissionNumber}</div>
                                  </td>

                                  <td className="px-4 py-4 text-center">
                                    <select
                                      value={input.status}
                                      onChange={(e) =>
                                        handleStatusChange(
                                          student.id,
                                          e.target.value as "present" | "absent" | "exempt"
                                        )
                                      }
                                      disabled={isExamPublished}
                                      className="h-8 bg-slate-900/80 border border-white/10 rounded-lg text-xs text-slate-200 px-2"
                                    >
                                      <option value="present">Present</option>
                                      <option value="absent">Absent (ABS)</option>
                                      <option value="exempt">Exempt (EXM)</option>
                                    </select>
                                  </td>

                                  <td className="px-5 py-4">
                                    <div className="space-y-1">
                                      <Input
                                        type="number"
                                        min="0"
                                        max={activeMaxMarks}
                                        disabled={input.status !== "present" || isExamPublished}
                                        aria-label={`Obtained marks for ${student.firstName} ${student.lastName}`}
                                        value={input.obtainedMarks}
                                        onChange={(e) => handleMarkInputChange(student.id, e.target.value)}
                                        className={`h-9 bg-slate-900/60 text-white rounded-lg ${
                                          fieldError
                                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                            : "border-white/10"
                                        }`}
                                      />
                                      {fieldError && (
                                        <p className="text-[11px] text-red-400 font-medium">{fieldError}</p>
                                      )}
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 text-center font-medium text-slate-300">
                                    {calc ? `${calc.pct}%` : "—"}
                                  </td>

                                  <td className="px-4 py-4 text-center">
                                    {calc ? <GradeBadge grade={calc.gradeLetter} /> : "—"}
                                  </td>

                                  <td className="px-4 py-4 text-center">
                                    {calc ? (
                                      <Badge
                                        variant={calc.passed ? "success" : "destructive"}
                                        className="text-[10px] tracking-wide uppercase"
                                      >
                                        {calc.passed ? "Passed" : "Failed"}
                                      </Badge>
                                    ) : (
                                      <span className="text-slate-500 text-xs">Unmarked</span>
                                    )}
                                  </td>

                                  <td className="px-5 py-4">
                                    <Input
                                      placeholder="Add remarks..."
                                      disabled={isExamPublished}
                                      aria-label={`Remarks for ${student.firstName} ${student.lastName}`}
                                      value={input.remarks}
                                      onChange={(e) => handleRemarkInputChange(student.id, e.target.value)}
                                      className="h-9 bg-slate-900/60 border-white/10 text-white rounded-lg text-xs"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 4. CALCULATION & CONTROLLED APPROVAL WORKFLOW */}
            {activeTab === "results" && (
              <div className="space-y-6">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Result Calculation & Controlled Approval</h2>
                        <p className="text-sm text-slate-400">
                          Workflow: Draft → Submitted → Under Review → Approved → Published
                        </p>
                      </div>

                      {currentPublication && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 uppercase font-semibold">Workflow Status:</span>
                          <Badge
                            variant={
                              currentPublication.status === "published"
                                ? "success"
                                : currentPublication.status === "completed"
                                  ? "secondary"
                                  : currentPublication.status === "in_progress"
                                    ? "primary"
                                    : "default"
                            }
                            className="text-xs font-semibold uppercase"
                          >
                            {currentPublication.status === "in_progress"
                              ? "Submitted / Under Review"
                              : currentPublication.status === "completed"
                                ? "Approved"
                                : currentPublication.status}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-3 lg:grid-cols-4 items-end pt-2">
                      <Select
                        value={resultSelection.examinationId}
                        onChange={(e) => setResultSelection({ ...resultSelection, examinationId: e.target.value })}
                      >
                        <option value="">Select Examination</option>
                        {examinations.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={resultSelection.gradeId}
                        onChange={(e) => setResultSelection({ ...resultSelection, gradeId: e.target.value })}
                      >
                        <option value="">Select Class</option>
                        {grades.map((grade) => (
                          <option key={grade.id} value={grade.id}>
                            {grade.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={resultSelection.sectionId}
                        onChange={(e) => setResultSelection({ ...resultSelection, sectionId: e.target.value })}
                      >
                        <option value="">Select Section</option>
                        {sections
                          .filter((s) => !resultSelection.gradeId || s.gradeId === resultSelection.gradeId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </Select>
                      <Button onClick={handleCalculateResults} className="bg-red-500 hover:bg-red-600 text-white">
                        <BarChart3 className="w-4 h-4 mr-1.5" /> Calculate Results
                      </Button>
                    </div>

                    {/* Controlled Workflow Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        {(!currentPublication || currentPublication.status === "draft") && (
                          <Button
                            onClick={handleSubmitForReview}
                            disabled={calculatedResults.length === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Send className="w-4 h-4 mr-1.5" /> Submit for Review
                          </Button>
                        )}

                        {currentPublication?.status === "in_progress" && (
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Reviewer remarks..."
                              value={reviewComments}
                              onChange={(e) => setReviewComments(e.target.value)}
                              className="h-9 w-64 text-xs"
                            />
                            <Button
                              onClick={() => handleReviewDecision("approved")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve Results
                            </Button>
                            <Button
                              onClick={() => handleReviewDecision("rejected")}
                              variant="destructive"
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              <RotateCcw className="w-4 h-4 mr-1.5" /> Reject / Request Corrections
                            </Button>
                          </div>
                        )}

                        {currentPublication?.status === "completed" && (
                          <Button
                            onClick={handlePublishResults}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950/20"
                          >
                            <ShieldCheck className="w-4 h-4 mr-1.5" /> Publish to Portals
                          </Button>
                        )}

                        {currentPublication?.status === "published" && (
                          <div className="flex items-center gap-2">
                            <Badge variant="success" className="px-3 py-1 flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5" /> Results Published & Locked
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setActiveTab("corrections");
                                setCorrectionForm((c) => ({
                                  ...c,
                                  examinationId: resultSelection.examinationId,
                                  gradeId: resultSelection.gradeId,
                                  sectionId: resultSelection.sectionId,
                                }));
                              }}
                            >
                              <Edit3 className="w-3.5 h-3.5 mr-1" /> Request Correction
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-slate-400">
                        {currentPublication?.publishedAt && (
                          <span>Published on: {new Date(currentPublication.publishedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Authoritative Class Results Table with Positions */}
                <Card className="bg-[#0f141f] border-white/5">
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-white">Class Position & Performance Register</h3>
                      <p className="text-sm text-slate-400">Authoritative calculated positions and grades.</p>
                    </div>
                  </div>

                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-3 text-center">Rank</th>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3 text-center">Total Marks</th>
                            <th className="px-4 py-3 text-center">Percentage</th>
                            <th className="px-4 py-3 text-center">Overall Grade</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3">Subject Breakdown</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {calculatedResults.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                                Click "Calculate Results" above to compute authoritative scores and positions.
                              </td>
                            </tr>
                          ) : (
                            calculatedResults.map((res) => (
                              <tr key={res.studentId} className="hover:bg-white/[0.02]">
                                <td className="px-4 py-3 text-center font-bold text-amber-400">
                                  {res.rankLabel || res.position || "-"}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="font-medium text-white">{studentName(res.studentId)}</div>
                                  <div className="text-xs text-slate-500">{res.admissionNumber}</div>
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-slate-200">
                                  {res.obtainedMarks} / {res.maximumMarks}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-white">{res.percentage}%</td>
                                <td className="px-4 py-3 text-center">
                                  <GradeBadge grade={res.grade || "F"} />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Badge variant={res.passed ? "success" : "destructive"}>
                                    {res.passed ? "PASSED" : "FAILED"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    {res.subjects.map((sub) => (
                                      <span
                                        key={sub.subjectId}
                                        className={`text-[11px] px-2 py-0.5 rounded border ${
                                          sub.isAbsent
                                            ? "bg-red-950/40 border-red-800 text-red-300"
                                            : sub.isExempt
                                              ? "bg-blue-950/40 border-blue-800 text-blue-300"
                                              : sub.passed
                                                ? "bg-slate-900 border-white/10 text-slate-300"
                                                : "bg-red-950/20 border-red-900/50 text-red-400"
                                        }`}
                                      >
                                        {sub.subjectName || "Sub"}: {sub.isAbsent ? "ABS" : sub.isExempt ? "EXM" : sub.obtainedMarks}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 5. PUBLISHED RESULT CORRECTIONS WORKFLOW */}
            {activeTab === "corrections" && (
              <div className="space-y-6">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Controlled Result Corrections</h2>
                        <p className="text-sm text-slate-400">
                          Formal correction workflow for published marks with full audit history and automatic recalculation.
                        </p>
                      </div>

                      <Button
                        onClick={() => setIsCorrectionModalOpen(true)}
                        className="bg-red-500 hover:bg-red-600 text-white"
                      >
                        <Edit3 className="w-4 h-4 mr-1.5" /> Request Result Correction
                      </Button>
                    </div>

                    {/* Correction Requests Table */}
                    <div className="overflow-x-auto rounded-xl border border-white/5 mt-4">
                      <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                          <tr>
                            <th className="px-4 py-3">Student</th>
                            <th className="px-4 py-3">Subject</th>
                            <th className="px-4 py-3 text-center">Old Marks</th>
                            <th className="px-4 py-3 text-center">Revised Marks</th>
                            <th className="px-4 py-3">Reason & Justification</th>
                            <th className="px-4 py-3 text-center">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {corrections.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                No correction requests submitted.
                              </td>
                            </tr>
                          ) : (
                            corrections.map((cr) => (
                              <tr key={cr.id} className="hover:bg-white/[0.02]">
                                <td className="px-4 py-3 font-medium text-white">{studentName(cr.studentId)}</td>
                                <td className="px-4 py-3">{subjectName(cr.subjectId)}</td>
                                <td className="px-4 py-3 text-center text-slate-400">{cr.oldMarks}</td>
                                <td className="px-4 py-3 text-center font-bold text-white">{cr.newMarks}</td>
                                <td className="px-4 py-3 text-xs text-slate-300">{cr.reason}</td>
                                <td className="px-4 py-3 text-center">
                                  <Badge
                                    variant={
                                      cr.status === "approved"
                                        ? "success"
                                        : cr.status === "rejected"
                                          ? "destructive"
                                          : "secondary"
                                    }
                                  >
                                    {cr.status}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {cr.status === "pending" && (
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() => handleReviewCorrection(cr.id, "approved")}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleReviewCorrection(cr.id, "rejected")}
                                      >
                                        Reject
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Correction Request Modal Form */}
                {isCorrectionModalOpen && (
                  <Card className="bg-[#0f141f] border-red-500/20 shadow-2xl">
                    <CardContent className="space-y-4 p-6">
                      <h3 className="text-lg font-semibold text-white">Submit Result Correction Request</h3>
                      <form onSubmit={handleRequestCorrection} className="grid gap-3 sm:grid-cols-2">
                        <Select
                          value={correctionForm.examinationId}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, examinationId: e.target.value })}
                          required
                        >
                          <option value="">Select Examination</option>
                          {examinations.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                              {exam.name}
                            </option>
                          ))}
                        </Select>

                        <Select
                          value={correctionForm.gradeId}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, gradeId: e.target.value })}
                          required
                        >
                          <option value="">Select Class</option>
                          {grades.map((grade) => (
                            <option key={grade.id} value={grade.id}>
                              {grade.name}
                            </option>
                          ))}
                        </Select>

                        <Select
                          value={correctionForm.sectionId}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, sectionId: e.target.value })}
                          required
                        >
                          <option value="">Select Section</option>
                          {sections
                            .filter((s) => !correctionForm.gradeId || s.gradeId === correctionForm.gradeId)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                        </Select>

                        <Select
                          value={correctionForm.studentId}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, studentId: e.target.value })}
                          required
                        >
                          <option value="">Select Student</option>
                          {students.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.firstName} {st.lastName} ({st.admissionNumber})
                            </option>
                          ))}
                        </Select>

                        <Select
                          value={correctionForm.subjectId}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, subjectId: e.target.value })}
                          required
                        >
                          <option value="">Select Subject</option>
                          {subjects.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name}
                            </option>
                          ))}
                        </Select>

                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Corrected / Revised Marks"
                          value={correctionForm.newMarks}
                          onChange={(e) => setCorrectionForm({ ...correctionForm, newMarks: e.target.value })}
                          required
                        />

                        <div className="sm:col-span-2">
                          <Input
                            placeholder="Reason and supporting explanation for correction..."
                            value={correctionForm.reason}
                            onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
                            required
                          />
                        </div>

                        <div className="sm:col-span-2 flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsCorrectionModalOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" className="bg-red-500 hover:bg-red-600 text-white">
                            Submit Correction
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* 6. PRINTABLE STUDENT RESULT CARDS (A4) */}
            {activeTab === "cards" && (
              <div className="space-y-6">
                <Card className="bg-[#0f141f] border-white/5 print:hidden">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Printable Student Result Cards (A4)</h2>
                        <p className="text-sm text-slate-400">
                          Professional school-branded A4 report cards with individual or batch printing.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => window.print()}
                          disabled={!singleResultCard && batchResultCards.length === 0}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <Printer className="w-4 h-4 mr-1.5" /> Print Result Card(s)
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end pt-2">
                      <Select
                        value={cardSelection.examinationId}
                        onChange={(e) => setCardSelection({ ...cardSelection, examinationId: e.target.value })}
                      >
                        <option value="">Select Examination</option>
                        {examinations.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.name}
                          </option>
                        ))}
                      </Select>

                      <Select
                        value={cardSelection.mode}
                        onChange={(e) =>
                          setCardSelection({
                            ...cardSelection,
                            mode: e.target.value as "single" | "batch",
                          })
                        }
                      >
                        <option value="single">Single Student Card</option>
                        <option value="batch">Batch (Whole Class/Section)</option>
                      </Select>

                      <Select
                        value={cardSelection.gradeId}
                        onChange={(e) => setCardSelection({ ...cardSelection, gradeId: e.target.value })}
                      >
                        <option value="">Select Class</option>
                        {grades.map((grade) => (
                          <option key={grade.id} value={grade.id}>
                            {grade.name}
                          </option>
                        ))}
                      </Select>

                      <Select
                        value={cardSelection.sectionId}
                        onChange={(e) => setCardSelection({ ...cardSelection, sectionId: e.target.value })}
                      >
                        <option value="">Select Section</option>
                        {sections
                          .filter((s) => !cardSelection.gradeId || s.gradeId === cardSelection.gradeId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </Select>

                      {cardSelection.mode === "single" ? (
                        <Select
                          value={cardSelection.studentId}
                          onChange={(e) => setCardSelection({ ...cardSelection, studentId: e.target.value })}
                        >
                          <option value="">Select Student</option>
                          {students.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.firstName} {st.lastName} ({st.admissionNumber})
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <div />
                      )}

                      <div className="lg:col-span-5 flex justify-end">
                        <Button onClick={handleLoadResultCards} className="bg-red-500 hover:bg-red-600 text-white">
                          Generate Result Card Preview
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Printable Cards Preview Area */}
                {isLoadingCards ? (
                  <div className="text-center py-12 text-slate-400">Loading result cards...</div>
                ) : singleResultCard ? (
                  <div className="flex justify-center">
                    <ResultCardView card={singleResultCard} />
                  </div>
                ) : batchResultCards.length > 0 ? (
                  <div className="space-y-8">
                    {batchResultCards.map((card, idx) => (
                      <div key={card.student.id} className="page-break-after">
                        <ResultCardView card={card} />
                        {idx < batchResultCards.length - 1 && (
                          <div className="h-6 print:hidden border-b border-dashed border-slate-700 my-6" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-500 border border-dashed border-white/5 rounded-2xl">
                    <Printer className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                    <p className="text-base font-medium text-white">No result card loaded yet.</p>
                    <p className="text-sm">Select an examination and student/class above, then click Generate Preview.</p>
                  </div>
                )}
              </div>
            )}

            {/* 7. EXAMINATION REPORTS & REGISTERS */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                <Card className="bg-[#0f141f] border-white/5 print:hidden">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Examination Performance Reports</h2>
                        <p className="text-sm text-slate-400">
                          Official result register, missing marks report, and class performance statistics.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {reportSelection.reportType === "register" && resultRegister && (
                          <Button onClick={handleExportRegisterCSV} variant="secondary">
                            <Download className="w-4 h-4 mr-1.5" /> Export Register CSV
                          </Button>
                        )}
                        {reportSelection.reportType === "missing" && missingMarksReport.length > 0 && (
                          <Button onClick={handleExportMissingCSV} variant="secondary">
                            <Download className="w-4 h-4 mr-1.5" /> Export Missing CSV
                          </Button>
                        )}
                        <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Printer className="w-4 h-4 mr-1.5" /> Print Report
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end pt-2">
                      <Select
                        value={reportSelection.examinationId}
                        onChange={(e) => setReportSelection({ ...reportSelection, examinationId: e.target.value })}
                      >
                        <option value="">Select Examination</option>
                        {examinations.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.name}
                          </option>
                        ))}
                      </Select>

                      <Select
                        value={reportSelection.reportType}
                        onChange={(e) =>
                          setReportSelection({
                            ...reportSelection,
                            reportType: e.target.value as "register" | "missing" | "summary",
                          })
                        }
                      >
                        <option value="register">Full Result Register</option>
                        <option value="missing">Missing Marks Report</option>
                      </Select>

                      <Select
                        value={reportSelection.gradeId}
                        onChange={(e) => setReportSelection({ ...reportSelection, gradeId: e.target.value })}
                      >
                        <option value="">Select Class</option>
                        {grades.map((grade) => (
                          <option key={grade.id} value={grade.id}>
                            {grade.name}
                          </option>
                        ))}
                      </Select>

                      <Select
                        value={reportSelection.sectionId}
                        onChange={(e) => setReportSelection({ ...reportSelection, sectionId: e.target.value })}
                      >
                        <option value="">Select Section</option>
                        {sections
                          .filter((s) => !reportSelection.gradeId || s.gradeId === reportSelection.gradeId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </Select>

                      <Button onClick={handleLoadReport} className="bg-red-500 hover:bg-red-600 text-white">
                        Generate Report
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Report View Area */}
                {isLoadingReport ? (
                  <div className="text-center py-12 text-slate-400">Generating report...</div>
                ) : reportSelection.reportType === "register" && resultRegister ? (
                  <Card className="bg-[#0f141f] border-white/5">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          Result Register: {resultRegister.examination.name} ({resultRegister.grade.name} {resultRegister.section.name})
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Enrolled: {resultRegister.summary.totalEnrolled} | Appeared: {resultRegister.summary.totalAppeared} | Passed:{" "}
                          <span className="text-emerald-400 font-semibold">{resultRegister.summary.totalPassed}</span> | Failed:{" "}
                          <span className="text-red-400 font-semibold">{resultRegister.summary.totalFailed}</span> | Pass Rate:{" "}
                          <span className="text-white font-bold">{resultRegister.summary.passPercentage}%</span> | Class Avg:{" "}
                          <span className="text-white font-bold">{resultRegister.summary.averagePercentage}%</span>
                        </p>
                      </div>
                    </div>

                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-900/60 uppercase text-slate-400">
                            <tr>
                              <th className="px-3 py-3 text-center">Rank</th>
                              <th className="px-3 py-3">Adm No</th>
                              <th className="px-3 py-3">Student Name</th>
                              {resultRegister.subjects.map((s) => (
                                <th key={s.id} className="px-3 py-3 text-center">
                                  {s.name}
                                  <div className="text-[10px] text-slate-500 font-normal">/{s.maximumMarks}</div>
                                </th>
                              ))}
                              <th className="px-3 py-3 text-center">Obt/Max</th>
                              <th className="px-3 py-3 text-center">%</th>
                              <th className="px-3 py-3 text-center">Grade</th>
                              <th className="px-3 py-3 text-center">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {resultRegister.students.map((st) => (
                              <tr key={st.studentId} className="hover:bg-white/[0.02]">
                                <td className="px-3 py-2.5 text-center font-bold text-amber-400">
                                  {st.rankLabel || st.position || "-"}
                                </td>
                                <td className="px-3 py-2.5 text-slate-400">{st.admissionNumber}</td>
                                <td className="px-3 py-2.5 font-medium text-white">{st.name}</td>
                                {resultRegister.subjects.map((sub) => {
                                  const mark = st.subjectMarks[sub.id];
                                  return (
                                    <td key={sub.id} className="px-3 py-2.5 text-center font-mono">
                                      {!mark ? (
                                        "—"
                                      ) : mark.isAbsent ? (
                                        <span className="text-red-400 font-bold">ABS</span>
                                      ) : mark.isExempt ? (
                                        <span className="text-blue-400 font-bold">EXM</span>
                                      ) : (
                                        <span className={mark.passed ? "text-slate-200" : "text-red-400 font-semibold"}>
                                          {mark.obtainedMarks}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-2.5 text-center font-semibold text-slate-200">
                                  {st.totalObtained}/{st.totalMaximum}
                                </td>
                                <td className="px-3 py-2.5 text-center font-bold text-white">{st.percentage}%</td>
                                <td className="px-3 py-2.5 text-center font-bold">{st.grade || "-"}</td>
                                <td className="px-3 py-2.5 text-center">
                                  <span
                                    className={`font-semibold text-[10px] uppercase ${
                                      st.passed ? "text-emerald-400" : "text-red-400"
                                    }`}
                                  >
                                    {st.passed ? "PASS" : "FAIL"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ) : reportSelection.reportType === "missing" ? (
                  <Card className="bg-[#0f141f] border-white/5">
                    <div className="p-6 border-b border-white/5">
                      <h3 className="text-lg font-bold text-white">Missing Marks Report</h3>
                      <p className="text-sm text-slate-400">Students with unentered marks for configured subjects.</p>
                    </div>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                            <tr>
                              <th className="px-4 py-3">Admission No</th>
                              <th className="px-4 py-3">Student Name</th>
                              <th className="px-4 py-3">Class</th>
                              <th className="px-4 py-3">Section</th>
                              <th className="px-4 py-3">Missing Subject</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {missingMarksReport.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-emerald-400">
                                  ✓ All marks have been entered for this examination! No missing entries found.
                                </td>
                              </tr>
                            ) : (
                              missingMarksReport.map((item, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02]">
                                  <td className="px-4 py-3 text-slate-400">{item.admissionNumber}</td>
                                  <td className="px-4 py-3 font-medium text-white">{item.studentName}</td>
                                  <td className="px-4 py-3">{item.gradeName}</td>
                                  <td className="px-4 py-3">{item.sectionName}</td>
                                  <td className="px-4 py-3 font-semibold text-amber-400">{item.subjectName}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Result Card Component (A4 Printable Layout)
function ResultCardView({ card }: { card: StudentResultCard }) {
  return (
    <div className="w-full max-w-[800px] bg-white text-slate-900 rounded-xl p-8 shadow-2xl border border-slate-200 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full">
      {/* School Header */}
      <div className="text-center border-b-2 border-red-600 pb-5">
        <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900">
          {card.school.name}
        </h1>
        {card.school.address && (
          <p className="text-xs text-slate-600 mt-1 font-medium">{card.school.address}</p>
        )}
        <p className="text-xs text-slate-500 mt-0.5">
          Email: {card.school.email} | Website: {card.school.website}
        </p>
        <div className="inline-block mt-3 px-4 py-1 bg-red-600 text-white text-xs font-bold uppercase tracking-widest rounded-full">
          Official Student Progress Report Card
        </div>
      </div>

      {/* Student Details Grid */}
      <div className="grid grid-cols-2 gap-4 text-xs mt-6 pb-4 border-b border-slate-200">
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wide">Student Name:</span>{" "}
          <span className="font-bold text-slate-900 text-sm">{card.student.name}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wide">Admission No:</span>{" "}
          <span className="font-bold text-slate-900">{card.student.admissionNumber}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wide">Class & Section:</span>{" "}
          <span className="font-bold text-slate-900">
            {card.student.gradeName} {card.student.sectionName ? `(${card.student.sectionName})` : ""}
          </span>
        </div>
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wide">Academic Session:</span>{" "}
          <span className="font-bold text-slate-900">{card.examination.academicYear}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wide">Examination:</span>{" "}
          <span className="font-bold text-slate-900">{card.examination.name}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-500 uppercase tracking-wide">Class Rank / Position:</span>{" "}
          <span className="font-black text-red-600 text-sm">
            {card.result.rankLabel || `${card.result.position || "-"} of ${card.result.totalStudents || "-"}`}
          </span>
        </div>
      </div>

      {/* Subject Marks Table */}
      <div className="mt-6">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 border-b-2 border-slate-300 text-slate-700">
              <th className="py-2.5 px-3 font-bold uppercase">Subject Name</th>
              <th className="py-2.5 px-3 text-center font-bold uppercase">Max Marks</th>
              <th className="py-2.5 px-3 text-center font-bold uppercase">Marks Obtained</th>
              <th className="py-2.5 px-3 text-center font-bold uppercase">Percentage</th>
              <th className="py-2.5 px-3 text-center font-bold uppercase">Grade</th>
              <th className="py-2.5 px-3 text-center font-bold uppercase">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {card.result.subjects.map((sub) => (
              <tr key={sub.subjectId}>
                <td className="py-2 px-3 font-semibold text-slate-800">{sub.subjectName || "Subject"}</td>
                <td className="py-2 px-3 text-center text-slate-600">{sub.maximumMarks}</td>
                <td className="py-2 px-3 text-center font-bold text-slate-900">
                  {sub.isAbsent ? (
                    <span className="text-red-600">ABS</span>
                  ) : sub.isExempt ? (
                    <span className="text-blue-600">EXM</span>
                  ) : (
                    sub.obtainedMarks
                  )}
                </td>
                <td className="py-2 px-3 text-center font-semibold text-slate-700">{sub.percentage}%</td>
                <td className="py-2 px-3 text-center font-bold text-slate-900">{sub.grade || "-"}</td>
                <td className="py-2 px-3 text-center font-bold text-xs">
                  {sub.passed ? (
                    <span className="text-emerald-700">PASSED</span>
                  ) : (
                    <span className="text-red-700">FAILED</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total & Percentage Summary Box */}
      <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-4 text-center divide-x divide-slate-200">
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-500">Total Marks</div>
          <div className="text-base font-black text-slate-900 mt-1">
            {card.result.obtainedMarks} / {card.result.maximumMarks}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-500">Aggregate %</div>
          <div className="text-base font-black text-slate-900 mt-1">{card.result.percentage}%</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-500">Final Grade</div>
          <div className="text-base font-black text-red-600 mt-1">{card.result.grade || "F"}</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-500">Overall Result</div>
          <div
            className={`text-base font-black mt-1 ${
              card.result.passed ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {card.result.passed ? "PASSED" : "FAILED"}
          </div>
        </div>
      </div>

      {/* Signatures & Stamp Area */}
      <div className="mt-12 pt-8 grid grid-cols-3 gap-6 text-center text-xs">
        <div>
          <div className="h-10 border-b border-slate-400" />
          <p className="mt-2 font-bold text-slate-800">{card.signatories.classTeacher}</p>
          <p className="text-[10px] text-slate-500">Class In-charge</p>
        </div>
        <div>
          <div className="h-10 border-b border-slate-400" />
          <p className="mt-2 font-bold text-slate-800">{card.signatories.examinationController}</p>
          <p className="text-[10px] text-slate-500">Exam Controller</p>
        </div>
        <div>
          <div className="h-10 border-b border-slate-400" />
          <p className="mt-2 font-bold text-slate-800">{card.signatories.principal}</p>
          <p className="text-[10px] text-slate-500">Principal Signature & Stamp</p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="bg-[#0f141f] border-white/5">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
        </div>
        <div className="rounded-xl bg-red-500/10 p-3 text-red-400">{icon}</div>
      </CardContent>
    </Card>
  );
}
