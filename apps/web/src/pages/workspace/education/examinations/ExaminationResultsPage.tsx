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
  ExaminationSubject,
  ExaminationType,
  Grade,
  GradingRule,
  MarkRecord,
  Section,
  Staff,
  Student,
  StudentResult,
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
} from "lucide-react";

type ExamTab = "examinations" | "assessments" | "marks" | "results";

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
  const { currentOrganization } = useOrganization();
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

  // Forms for creating exams and subjects
  const [examForm, setExamForm] = useState({
    name: "",
    academicYearId: "",
    termId: "",
    type: "mid_term" as ExaminationType,
    startDate: today(),
    endDate: today(),
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
  const [markInputs, setMarkInputs] = useState<Record<string, { obtainedMarks: string; remarks: string }>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSavingMarks, setIsSavingMarks] = useState(false);

  // Results Tab Selection
  const [resultSelection, setResultSelection] = useState({
    examinationId: "",
    gradeId: "",
    sectionId: "",
    studentId: "",
  });

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
    return students.filter((s) => enrolledRosterStudentIds.includes(s.id));
  }, [students, enrolledRosterStudentIds]);

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

  async function loadData() {
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
      ]);

      setAcademicYears(yearsData);
      setGrades(gradesData);
      setSections(sectionsData);
      setSubjects(subjectsData);
      setStudents(studentsData);
      setTeachers(staffData.filter((member) => member.staffType === "teacher"));
      setExaminations(examsData);
      setExamSubjects(examSubjectsData);
      setAssessments(assessmentsData);
      setGradingRules(gradingData);
      setMarks(marksData);

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

      // Set initial gradebook selections
      if (examsData[0]) {
        setMarksExamId(examsData[0].id);
      }
      if (examSubjectsData[0]) {
        setMarksExamSubjectId(examSubjectsData[0].id);
        setMarksGradeId(examSubjectsData[0].gradeId);
        setMarksSectionId(examSubjectsData[0].sectionId || "");
      }
      if (assessmentsData[0]) {
        setMarksAssessmentId(assessmentsData[0].id);
      }

      setResultSelection((current) => ({
        ...current,
        examinationId: current.examinationId || examsData[0]?.id || "",
        gradeId: current.gradeId || gradesData[0]?.id || "",
        sectionId: current.sectionId || sectionsData[0]?.id || "",
        studentId: current.studentId || studentsData[0]?.id || "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load examination data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMarksRoster() {
    if (!currentOrganization) return;
    let targetGradeId = marksGradeId;
    let targetSectionId = marksSectionId;
    let targetSubjectId = activeSubjectId;
    let targetSourceId = "";

    if (markSourceType === "examination") {
      if (!selectedExamForMarks || !activeExamSubject) return;
      targetGradeId = activeExamSubject.gradeId || marksGradeId;
      targetSectionId = activeExamSubject.sectionId || marksSectionId;
      targetSubjectId = activeExamSubject.subjectId;
      targetSourceId = selectedExamForMarks.id;
    } else {
      if (!activeAssessment) return;
      targetGradeId = activeAssessment.gradeId || marksGradeId;
      targetSectionId = activeAssessment.sectionId || marksSectionId;
      targetSubjectId = activeAssessment.subjectId;
      targetSourceId = activeAssessment.id;
    }

    if (!targetGradeId) return;

    try {
      const [enrollments, existingMarks] = await Promise.all([
        EnrollmentService.getEnrollments(currentOrganization.id, {
          gradeId: targetGradeId,
          sectionId: targetSectionId || undefined,
          status: "active",
        }),
        ExaminationService.getMarks(currentOrganization.id, {
          sourceType: markSourceType,
          sourceId: targetSourceId,
          subjectId: targetSubjectId,
        }),
      ]);

      const enrolledIds = enrollments.map((e) => e.studentId);
      setEnrolledRosterStudentIds(enrolledIds);

      const nextInputs: Record<string, { obtainedMarks: string; remarks: string }> = {};
      for (const studentId of enrolledIds) {
        const mark = existingMarks.find((item) => item.studentId === studentId);
        nextInputs[studentId] = {
          obtainedMarks: mark ? String(mark.obtainedMarks) : "",
          remarks: mark?.remarks || "",
        };
      }
      setMarkInputs(nextInputs);
      setValidationErrors({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gradebook roster.");
    }
  }

  function handleMarkInputChange(studentId: string, value: string) {
    setMarkInputs((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], obtainedMarks: value },
    }));

    if (value.trim() === "") {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      return;
    }

    const num = Number(value);
    if (isNaN(num)) {
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

  function handleRemarkInputChange(studentId: string, value: string) {
    setMarkInputs((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], remarks: value },
    }));
  }

  function calculateStudentGrade(obtainedStr: string) {
    if (!obtainedStr.trim()) return null;
    const num = Number(obtainedStr);
    if (isNaN(num) || activeMaxMarks <= 0) return null;
    const pct = Math.round((num / activeMaxMarks) * 10000) / 100;
    const rule = gradingRules.find((r) => pct >= r.minPercentage && pct <= r.maxPercentage);
    const gradeLetter =
      rule?.grade ||
      (pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 50 ? "D" : "F");
    const passed = num >= activePassingMarks;
    return { pct, gradeLetter, passed };
  }

  const gradebookStats = useMemo(() => {
    const entered = enrolledStudents.filter(
      (s) =>
        markInputs[s.id]?.obtainedMarks !== undefined &&
        markInputs[s.id].obtainedMarks.trim() !== "" &&
        !isNaN(Number(markInputs[s.id].obtainedMarks))
    );
    const values = entered.map((s) => Number(markInputs[s.id].obtainedMarks));
    const totalStudents = enrolledStudents.length;
    const marksEnteredCount = entered.length;

    if (marksEnteredCount === 0 || activeMaxMarks <= 0) {
      return {
        totalStudents,
        marksEnteredCount,
        averagePercentage: 0,
        highestPercentage: 0,
        lowestPercentage: 0,
        passCount: 0,
      };
    }

    const totalObtained = values.reduce((sum, v) => sum + v, 0);
    const average = Math.round((totalObtained / (marksEnteredCount * activeMaxMarks)) * 10000) / 100;
    const highest = Math.max(...values);
    const highestPercentage = Math.round((highest / activeMaxMarks) * 10000) / 100;
    const lowest = Math.min(...values);
    const lowestPercentage = Math.round((lowest / activeMaxMarks) * 10000) / 100;
    const passCount = values.filter((v) => v >= activePassingMarks).length;

    return {
      totalStudents,
      marksEnteredCount,
      averagePercentage: average,
      highestPercentage,
      lowestPercentage,
      passCount,
    };
  }, [enrolledStudents, markInputs, activeMaxMarks, activePassingMarks]);

  function subjectName(id: string) {
    return subjects.find((subject) => subject.id === id)?.name || id;
  }

  function gradeName(id: string) {
    return grades.find((grade) => grade.id === id)?.name || id;
  }

  function sectionName(id?: string) {
    return sections.find((section) => section.id === id)?.name || id || "All sections";
  }

  function studentName(id: string) {
    const student = students.find((item) => item.id === id);
    return student ? `${student.firstName} ${student.lastName}` : id;
  }

  async function handleCreateExam(event: React.FormEvent) {
    event.preventDefault();
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.createExamination(currentOrganization.id, {
        ...examForm,
        termId: examForm.termId || undefined,
        status: "draft",
        description: examForm.description || undefined,
      });
      setExamForm((current) => ({ ...current, name: "", description: "" }));
      setMessage("Examination created.");
      await loadData();
    });
  }

  async function handleAddExamSubject(event: React.FormEvent) {
    event.preventDefault();
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.addExaminationSubject(currentOrganization.id, {
        ...examSubjectForm,
        sectionId: examSubjectForm.sectionId || undefined,
        status: "scheduled",
      });
      setMessage("Examination subject configured.");
      await loadData();
    });
  }

  async function handleCreateAssessment(event: React.FormEvent) {
    event.preventDefault();
    if (!currentOrganization) return;
    await runAction(async () => {
      await ExaminationService.createAssessment(currentOrganization.id, {
        ...assessmentForm,
        termId: assessmentForm.termId || undefined,
        status: "assigned",
      });
      setAssessmentForm((current) => ({ ...current, title: "" }));
      setMessage("Assessment created.");
      await loadData();
    });
  }

  async function handleSaveMarks() {
    if (!currentOrganization) return;
    let targetSourceId = "";
    let targetExamSubjectId: string | undefined = undefined;

    if (markSourceType === "examination") {
      if (!selectedExamForMarks || !activeExamSubject) {
        setError("Please select both an examination and an examination subject.");
        return;
      }
      targetSourceId = selectedExamForMarks.id;
      targetExamSubjectId = activeExamSubject.id;
    } else {
      if (!activeAssessment) {
        setError("Please select an assessment.");
        return;
      }
      targetSourceId = activeAssessment.id;
    }

    if (Object.keys(validationErrors).length > 0) {
      setError("Please fix marks validation errors before saving.");
      return;
    }

    for (const [studentId, input] of Object.entries(markInputs)) {
      if (!input.obtainedMarks.trim()) continue;
      const num = Number(input.obtainedMarks);
      if (isNaN(num) || num < 0 || num > activeMaxMarks) {
        setError(`Mark for ${studentName(studentId)} must be between 0 and ${activeMaxMarks}.`);
        return;
      }
    }

    setIsSavingMarks(true);
    await runAction(async () => {
      const marksToSave = Object.entries(markInputs)
        .filter(([, input]) => input.obtainedMarks.trim() !== "")
        .map(([studentId, input]) => ({
          sourceType: markSourceType,
          sourceId: targetSourceId,
          examinationSubjectId: targetExamSubjectId,
          studentId,
          obtainedMarks: Number(input.obtainedMarks),
          remarks: input.remarks.trim() || undefined,
          enteredBy: user?.displayName || user?.email || "workspace-user",
        }));

      await ExaminationService.bulkEnterMarks(currentOrganization.id, marksToSave);
      setMessage("Gradebook marks saved successfully.");
      await loadData();
      await loadMarksRoster();
    });
    setIsSavingMarks(false);
  }

  async function handleCalculateResults() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const results = await ExaminationService.calculateClassResults(
        currentOrganization.id,
        resultSelection.examinationId,
        resultSelection.gradeId,
        resultSelection.sectionId
      );
      setCalculatedResults(results);
      const firstSubject = examSubjects.find(
        (item) => item.examinationId === resultSelection.examinationId
      );
      if (firstSubject) {
        setSubjectPerformance(
          await ExaminationService.getSubjectPerformance(
            currentOrganization.id,
            resultSelection.examinationId,
            resultSelection.gradeId,
            resultSelection.sectionId,
            firstSubject.subjectId
          )
        );
      }
      setMessage("Results calculated successfully.");
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
        { userId: user?.displayName || user?.email || "workspace-user", role: "Admin" }
      );
      setMessage("Results published successfully.");
      await loadData();
    });
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

  if (!currentOrganization) return null;

  const setupMissing =
    academicYears.length === 0 || grades.length === 0 || subjects.length === 0;

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        <div className="flex items-center gap-2 text-slate-400">
          <Link to="/workspace" className="inline-flex items-center gap-1 text-sm hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to Workspace
          </Link>
        </div>

        <AdminPageHeader
          title="Examination & Results"
          description="Manage examinations, assessments, marks entry, gradebook rosters, result calculation, and publication."
          actions={<Badge variant="secondary">SIS Foundation</Badge>}
        />

        {message && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {setupMissing && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Academic setup is required before full marks entry: create an academic year, class,
            section, subject, enrolled student, and teacher in the existing SIS modules.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <SummaryCard
            icon={<FileCheck2 className="h-5 w-5" />}
            label="Examinations"
            value={examinations.length}
          />
          <SummaryCard
            icon={<ClipboardList className="h-5 w-5" />}
            label="Assessments"
            value={assessments.length}
          />
          <SummaryCard
            icon={<BookOpenCheck className="h-5 w-5" />}
            label="Marks"
            value={marks.length}
          />
          <SummaryCard
            icon={<GraduationCap className="h-5 w-5" />}
            label="Grade Rules"
            value={gradingRules.length}
          />
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/5 bg-[#0f141f] p-2">
          {[
            ["examinations", "Examinations"],
            ["assessments", "Assessments"],
            ["marks", "Gradebook & Marks"],
            ["results", "Results"],
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
                        onChange={(e) =>
                          setExamForm({ ...examForm, type: e.target.value as ExaminationType })
                        }
                      >
                        {examTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={examForm.academicYearId}
                        onChange={(e) =>
                          setExamForm({ ...examForm, academicYearId: e.target.value })
                        }
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
                        onChange={(e) =>
                          setExamForm({ ...examForm, description: e.target.value })
                        }
                      />
                      <div className="lg:col-span-3">
                        <Button type="submit">Create Examination</Button>
                      </div>
                    </form>
                    <DataList
                      rows={examinations.map((item) => ({
                        id: item.id,
                        title: item.name,
                        meta: `${item.startDate} to ${item.endDate} / ${item.status}`,
                      }))}
                      empty="No examinations created."
                    />
                  </CardContent>
                </Card>

                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-4 p-6">
                    <h2 className="text-lg font-semibold text-white">Configure Examination Subjects</h2>
                    <form onSubmit={handleAddExamSubject} className="grid gap-3 lg:grid-cols-4">
                      <Select
                        value={examSubjectForm.examinationId}
                        onChange={(e) =>
                          setExamSubjectForm({
                            ...examSubjectForm,
                            examinationId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Examination</option>
                        {examinations.map((exam) => (
                          <option key={exam.id} value={exam.id}>
                            {exam.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={examSubjectForm.gradeId}
                        onChange={(e) =>
                          setExamSubjectForm({ ...examSubjectForm, gradeId: e.target.value })
                        }
                        required
                      >
                        <option value="">Class</option>
                        {grades.map((grade) => (
                          <option key={grade.id} value={grade.id}>
                            {grade.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        value={examSubjectForm.sectionId}
                        onChange={(e) =>
                          setExamSubjectForm({ ...examSubjectForm, sectionId: e.target.value })
                        }
                        required
                      >
                        <option value="">Section</option>
                        {sections
                          .filter(
                            (section) =>
                              !examSubjectForm.gradeId ||
                              section.gradeId === examSubjectForm.gradeId
                          )
                          .map((section) => (
                            <option key={section.id} value={section.id}>
                              {section.name}
                            </option>
                          ))}
                      </Select>
                      <Select
                        value={examSubjectForm.subjectId}
                        onChange={(e) =>
                          setExamSubjectForm({ ...examSubjectForm, subjectId: e.target.value })
                        }
                        required
                      >
                        <option value="">Subject</option>
                        {subjects.map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                          </option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={examSubjectForm.maximumMarks}
                        onChange={(e) =>
                          setExamSubjectForm({
                            ...examSubjectForm,
                            maximumMarks: Number(e.target.value),
                          })
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        value={examSubjectForm.passingMarks}
                        onChange={(e) =>
                          setExamSubjectForm({
                            ...examSubjectForm,
                            passingMarks: Number(e.target.value),
                          })
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        value={examSubjectForm.weightage}
                        onChange={(e) =>
                          setExamSubjectForm({
                            ...examSubjectForm,
                            weightage: Number(e.target.value),
                          })
                        }
                      />
                      <Button type="submit">Add Subject</Button>
                    </form>

                    <DataList
                      rows={examSubjects.map((item) => ({
                        id: item.id,
                        title: `${subjectName(item.subjectId)} - ${gradeName(item.gradeId)} ${sectionName(item.sectionId)}`,
                        meta: `${item.maximumMarks} max / ${item.passingMarks} pass / ${item.status}`,
                      }))}
                      empty="No examination subjects configured."
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "assessments" && (
              <Card className="bg-[#0f141f] border-white/5">
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-lg font-semibold text-white">Create Assessment</h2>
                  <form onSubmit={handleCreateAssessment} className="grid gap-3 lg:grid-cols-4">
                    <Input
                      placeholder="Assessment title"
                      value={assessmentForm.title}
                      onChange={(e) =>
                        setAssessmentForm({ ...assessmentForm, title: e.target.value })
                      }
                      required
                    />
                    <Select
                      value={assessmentForm.type}
                      onChange={(e) =>
                        setAssessmentForm({
                          ...assessmentForm,
                          type: e.target.value as AssessmentType,
                        })
                      }
                    >
                      {assessmentTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={assessmentForm.academicYearId}
                      onChange={(e) =>
                        setAssessmentForm({ ...assessmentForm, academicYearId: e.target.value })
                      }
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
                      value={assessmentForm.assessmentDate}
                      onChange={(e) =>
                        setAssessmentForm({
                          ...assessmentForm,
                          assessmentDate: e.target.value,
                        })
                      }
                    />
                    <Select
                      value={assessmentForm.gradeId}
                      onChange={(e) =>
                        setAssessmentForm({ ...assessmentForm, gradeId: e.target.value })
                      }
                      required
                    >
                      <option value="">Class</option>
                      {grades.map((grade) => (
                        <option key={grade.id} value={grade.id}>
                          {grade.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={assessmentForm.sectionId}
                      onChange={(e) =>
                        setAssessmentForm({ ...assessmentForm, sectionId: e.target.value })
                      }
                      required
                    >
                      <option value="">Section</option>
                      {sections
                        .filter(
                          (section) =>
                            !assessmentForm.gradeId ||
                            section.gradeId === assessmentForm.gradeId
                        )
                        .map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                    </Select>
                    <Select
                      value={assessmentForm.subjectId}
                      onChange={(e) =>
                        setAssessmentForm({ ...assessmentForm, subjectId: e.target.value })
                      }
                      required
                    >
                      <option value="">Subject</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={assessmentForm.teacherId}
                      onChange={(e) =>
                        setAssessmentForm({ ...assessmentForm, teacherId: e.target.value })
                      }
                      required
                    >
                      <option value="">Teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.firstName} {teacher.lastName}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min="1"
                      value={assessmentForm.maximumMarks}
                      onChange={(e) =>
                        setAssessmentForm({
                          ...assessmentForm,
                          maximumMarks: Number(e.target.value),
                        })
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      value={assessmentForm.passingMarks}
                      onChange={(e) =>
                        setAssessmentForm({
                          ...assessmentForm,
                          passingMarks: Number(e.target.value),
                        })
                      }
                    />
                    <Input
                      type="number"
                      min="0"
                      value={assessmentForm.weightage}
                      onChange={(e) =>
                        setAssessmentForm({
                          ...assessmentForm,
                          weightage: Number(e.target.value),
                        })
                      }
                    />
                    <Button type="submit">Create Assessment</Button>
                  </form>
                  <DataList
                    rows={assessments.map((item) => ({
                      id: item.id,
                      title: item.title,
                      meta: `${subjectName(item.subjectId)} - ${gradeName(item.gradeId)} ${sectionName(item.sectionId)} / ${item.maximumMarks} marks`,
                    }))}
                    empty="No assessments created."
                  />
                </CardContent>
              </Card>
            )}

            {/* GRADEBOOK & MARKS ENTRY TAB */}
            {activeTab === "marks" && (
              <div className="space-y-6">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-white">Student Gradebook</h2>
                        <p className="text-sm text-slate-400">
                          Select class, section, and examination or assessment to enter and validate marks
                        </p>
                      </div>

                      {/* Source Type Toggle */}
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

                    {/* Filter / Selector Row */}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end pt-2">
                      {markSourceType === "examination" ? (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                              Examination
                            </label>
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
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                              Class & Subject
                            </label>
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
                                    {subjectName(item.subjectId)} — {gradeName(item.gradeId)}{" "}
                                    {sectionName(item.sectionId)} ({item.maximumMarks} max)
                                  </option>
                                ))}
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                              Class / Grade
                            </label>
                            <Select
                              value={marksGradeId}
                              onChange={(e) => {
                                setMarksGradeId(e.target.value);
                                setMarksSectionId("");
                                setMarksAssessmentId("");
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
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                              Section
                            </label>
                            <Select
                              value={marksSectionId}
                              onChange={(e) => {
                                setMarksSectionId(e.target.value);
                                setMarksAssessmentId("");
                              }}
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

                          <div className="lg:col-span-2">
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                              Assessment
                            </label>
                            <Select
                              value={marksAssessmentId}
                              onChange={(e) => setMarksAssessmentId(e.target.value)}
                            >
                              <option value="">Select Assessment</option>
                              {assessments
                                .filter(
                                  (item) =>
                                    (!marksGradeId || item.gradeId === marksGradeId) &&
                                    (!marksSectionId || item.sectionId === marksSectionId)
                                )
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.title} — {subjectName(item.subjectId)} (
                                    {gradeName(item.gradeId)} {sectionName(item.sectionId)}) /{" "}
                                    {item.maximumMarks} marks
                                  </option>
                                ))}
                            </Select>
                          </div>
                        </>
                      )}

                      {markSourceType === "examination" && (
                        <div className="lg:col-span-2 flex justify-end">
                          <Button
                            onClick={handleSaveMarks}
                            disabled={
                              !activeExamSubject ||
                              enrolledStudents.length === 0 ||
                              Object.keys(validationErrors).length > 0 ||
                              isSavingMarks
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950/20"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {isSavingMarks ? "Saving..." : "Save Gradebook Marks"}
                          </Button>
                        </div>
                      )}

                      {markSourceType === "assessment" && (
                        <div className="lg:col-span-4 flex justify-end pt-2">
                          <Button
                            onClick={handleSaveMarks}
                            disabled={
                              !activeAssessment ||
                              enrolledStudents.length === 0 ||
                              Object.keys(validationErrors).length > 0 ||
                              isSavingMarks
                            }
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-950/20"
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {isSavingMarks ? "Saving..." : "Save Assessment Marks"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Gradebook Summary Statistics Banner */}
                {((markSourceType === "examination" && activeExamSubject) ||
                  (markSourceType === "assessment" && activeAssessment)) &&
                  enrolledStudents.length > 0 && (
                    <GradebookStatCard
                      totalStudents={gradebookStats.totalStudents}
                      marksEnteredCount={gradebookStats.marksEnteredCount}
                      averagePercentage={gradebookStats.averagePercentage}
                      highestPercentage={gradebookStats.highestPercentage}
                      lowestPercentage={gradebookStats.lowestPercentage}
                      passCount={gradebookStats.passCount}
                    />
                  )}

                {/* Student Gradebook Roster Table */}
                <Card className="bg-[#0f141f] border-white/5">
                  <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-white">
                          Student Marks Entry Roster
                        </h3>
                        <p className="text-sm text-slate-400">
                          Maximum Marks:{" "}
                          <span className="font-semibold text-white">{activeMaxMarks}</span> |
                          Passing Marks:{" "}
                          <span className="font-semibold text-emerald-400">
                            {activePassingMarks}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400">
                      Grading scale based on {gradingRules.length} registered grading rules
                    </div>
                  </div>

                  <CardContent className="p-0">
                    {enrolledStudents.length === 0 ? (
                      <div className="py-16 text-center text-slate-400">
                        <BookOpenCheck className="w-10 h-10 mx-auto text-slate-600 mb-3" />
                        <p className="text-base font-medium text-white">
                          {markSourceType === "examination" && !activeExamSubject
                            ? "Select an examination and examination subject to load the roster."
                            : markSourceType === "assessment" && !activeAssessment
                              ? "Select an assessment to load the roster."
                              : "No active student enrollments found for this class and section."}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-300">
                          <thead className="bg-slate-900/60 text-xs uppercase text-slate-400 tracking-wider">
                            <tr>
                              <th className="px-5 py-4 font-semibold">Student</th>
                              <th className="px-4 py-4 font-semibold text-center">Max Marks</th>
                              <th className="px-4 py-4 font-semibold text-center">Passing</th>
                              <th className="px-5 py-4 font-semibold w-40">Obtained Marks</th>
                              <th className="px-4 py-4 font-semibold text-center">Percentage</th>
                              <th className="px-4 py-4 font-semibold text-center">Grade</th>
                              <th className="px-4 py-4 font-semibold text-center">Status</th>
                              <th className="px-5 py-4 font-semibold">Remarks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {enrolledStudents.map((student) => {
                              const input = markInputs[student.id] || {
                                obtainedMarks: "",
                                remarks: "",
                              };
                              const calc = calculateStudentGrade(input.obtainedMarks);
                              const fieldError = validationErrors[student.id];

                              return (
                                <tr
                                  key={student.id}
                                  className="hover:bg-white/[0.02] transition-colors"
                                >
                                  <td className="px-5 py-4">
                                    <div className="font-medium text-white">
                                      {student.firstName} {student.lastName}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {student.admissionNumber}
                                    </div>
                                  </td>

                                  <td className="px-4 py-4 text-center font-semibold text-slate-300">
                                    {activeMaxMarks}
                                  </td>

                                  <td className="px-4 py-4 text-center font-semibold text-slate-400">
                                    {activePassingMarks}
                                  </td>

                                  <td className="px-5 py-4">
                                    <div className="space-y-1">
                                      <Input
                                        type="number"
                                        min="0"
                                        max={activeMaxMarks}
                                        aria-label={`Obtained marks for ${student.firstName} ${student.lastName}`}
                                        value={input.obtainedMarks}
                                        onChange={(e) =>
                                          handleMarkInputChange(student.id, e.target.value)
                                        }
                                        className={`h-9 bg-slate-900/60 text-white rounded-lg ${
                                          fieldError
                                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                            : "border-white/10"
                                        }`}
                                      />
                                      {fieldError && (
                                        <p className="text-[11px] text-red-400 font-medium">
                                          {fieldError}
                                        </p>
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
                                      aria-label={`Remarks for ${student.firstName} ${student.lastName}`}
                                      value={input.remarks}
                                      onChange={(e) =>
                                        handleRemarkInputChange(student.id, e.target.value)
                                      }
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

            {activeTab === "results" && (
              <Card className="bg-[#0f141f] border-white/5">
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-lg font-semibold text-white">Result Calculation & Publication</h2>
                  <div className="grid gap-3 lg:grid-cols-5">
                    <Select
                      value={resultSelection.examinationId}
                      onChange={(e) =>
                        setResultSelection({
                          ...resultSelection,
                          examinationId: e.target.value,
                        })
                      }
                    >
                      <option value="">Examination</option>
                      {examinations.map((exam) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={resultSelection.gradeId}
                      onChange={(e) =>
                        setResultSelection({ ...resultSelection, gradeId: e.target.value })
                      }
                    >
                      <option value="">Class</option>
                      {grades.map((grade) => (
                        <option key={grade.id} value={grade.id}>
                          {grade.name}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={resultSelection.sectionId}
                      onChange={(e) =>
                        setResultSelection({ ...resultSelection, sectionId: e.target.value })
                      }
                    >
                      <option value="">Section</option>
                      {sections
                        .filter(
                          (section) =>
                            !resultSelection.gradeId ||
                            section.gradeId === resultSelection.gradeId
                        )
                        .map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                    </Select>
                    <Button onClick={handleCalculateResults}>Calculate</Button>
                    <Button onClick={handlePublishResults} variant="secondary">
                      Publish
                    </Button>
                  </div>

                  {subjectPerformance && (
                    <div className="grid gap-4 md:grid-cols-4">
                      <SummaryCard
                        icon={<BarChart3 className="h-5 w-5" />}
                        label="Subject Average"
                        value={`${subjectPerformance.average}%`}
                      />
                      <SummaryCard
                        icon={<BarChart3 className="h-5 w-5" />}
                        label="Pass Rate"
                        value={`${subjectPerformance.passRate}%`}
                      />
                      <SummaryCard
                        icon={<BarChart3 className="h-5 w-5" />}
                        label="Highest"
                        value={subjectPerformance.highest}
                      />
                      <SummaryCard
                        icon={<BarChart3 className="h-5 w-5" />}
                        label="Lowest"
                        value={subjectPerformance.lowest}
                      />
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Obtained / Max</th>
                          <th className="px-4 py-3">Percentage</th>
                          <th className="px-4 py-3">Grade</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {calculatedResults.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                              No results calculated yet.
                            </td>
                          </tr>
                        ) : (
                          calculatedResults.map((result) => (
                            <tr key={result.studentId}>
                              <td className="px-4 py-3 text-white">
                                {studentName(result.studentId)}
                              </td>
                              <td className="px-4 py-3">
                                {result.obtainedMarks} / {result.maximumMarks}
                              </td>
                              <td className="px-4 py-3">{result.percentage}%</td>
                              <td className="px-4 py-3">{result.grade || "-"}</td>
                              <td className="px-4 py-3">
                                <Badge variant={result.passed ? "success" : "destructive"}>
                                  {result.passed ? "Passed" : "Failed"}
                                </Badge>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
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

function DataList({
  rows,
  empty,
}: {
  rows: Array<{ id: string; title: string; meta: string }>;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 py-8 text-center text-sm text-slate-500">
        {empty}
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5 rounded-xl border border-white/5">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between px-4 py-3">
          <p className="font-medium text-white">{row.title}</p>
          <p className="text-sm text-slate-400">{row.meta}</p>
        </div>
      ))}
    </div>
  );
}
