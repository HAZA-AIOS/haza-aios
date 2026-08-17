import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { useOrganization } from "@/org/use-organization";
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
import { AdminPageHeader, Badge, Button, Card, CardContent, Input, Select } from "@haza-aios/ui";
import { ArrowLeft, BarChart3, BookOpenCheck, ClipboardList, FileCheck2, GraduationCap } from "lucide-react";

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

  const [marksSelection, setMarksSelection] = useState({
    examinationId: "",
    examinationSubjectId: "",
  });
  const [markInputs, setMarkInputs] = useState<Record<string, { obtainedMarks: string; remarks: string }>>({});

  const [resultSelection, setResultSelection] = useState({
    examinationId: "",
    gradeId: "",
    sectionId: "",
    studentId: "",
  });

  const activeExamSubject = examSubjects.find((item) => item.id === marksSelection.examinationSubjectId);
  const selectedExamForMarks = examinations.find((item) => item.id === marksSelection.examinationId);

  const enrolledStudents = useMemo(() => {
    if (!activeExamSubject || !selectedExamForMarks) return [];
    return students.filter((student) => markInputs[student.id] !== undefined);
  }, [activeExamSubject, markInputs, selectedExamForMarks, students]);

  useEffect(() => {
    void loadData();
  }, [currentOrganization]);

  useEffect(() => {
    if (!currentOrganization || !activeExamSubject || !selectedExamForMarks) return;
    void loadMarksRoster();
  }, [currentOrganization, activeExamSubject?.id, selectedExamForMarks?.id]);

  async function loadData() {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      const [yearsData, gradesData, sectionsData, subjectsData, studentsData, staffData, examsData, examSubjectsData, assessmentsData, gradingData, marksData] =
        await Promise.all([
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
      setExamForm((current) => ({ ...current, academicYearId: current.academicYearId || activeYear?.id || "" }));
      setAssessmentForm((current) => ({ ...current, academicYearId: current.academicYearId || activeYear?.id || "" }));
      setExamSubjectForm((current) => ({
        ...current,
        examinationId: current.examinationId || examsData[0]?.id || "",
        gradeId: current.gradeId || gradesData[0]?.id || "",
        sectionId: current.sectionId || sectionsData[0]?.id || "",
        subjectId: current.subjectId || subjectsData[0]?.id || "",
      }));
      setMarksSelection((current) => ({
        ...current,
        examinationId: current.examinationId || examsData[0]?.id || "",
        examinationSubjectId: current.examinationSubjectId || examSubjectsData[0]?.id || "",
      }));
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
    if (!currentOrganization || !activeExamSubject || !selectedExamForMarks) return;
    const academicYearName = academicYears.find((year) => year.id === selectedExamForMarks.academicYearId)?.name;
    const enrollments = await EnrollmentService.getEnrollments(currentOrganization.id, {
      academicYear: academicYearName || selectedExamForMarks.academicYearId,
      gradeId: activeExamSubject.gradeId,
      sectionId: activeExamSubject.sectionId || "",
      status: "active",
    });
    const existingMarks = await ExaminationService.getMarks(currentOrganization.id, {
      sourceType: "examination",
      sourceId: selectedExamForMarks.id,
      subjectId: activeExamSubject.subjectId,
    });

    const nextInputs: Record<string, { obtainedMarks: string; remarks: string }> = {};
    for (const enrollment of enrollments) {
      const mark = existingMarks.find((item) => item.studentId === enrollment.studentId);
      nextInputs[enrollment.studentId] = {
        obtainedMarks: mark ? String(mark.obtainedMarks) : "",
        remarks: mark?.remarks || "",
      };
    }
    setMarkInputs(nextInputs);
  }

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
    if (!currentOrganization || !activeExamSubject || !selectedExamForMarks) return;
    await runAction(async () => {
      await ExaminationService.bulkEnterMarks(
        currentOrganization.id,
        Object.entries(markInputs)
          .filter(([, input]) => input.obtainedMarks !== "")
          .map(([studentId, input]) => ({
            sourceType: "examination",
            sourceId: selectedExamForMarks.id,
            examinationSubjectId: activeExamSubject.id,
            studentId,
            obtainedMarks: Number(input.obtainedMarks),
            remarks: input.remarks || undefined,
            enteredBy: "workspace-user",
          })),
      );
      setMessage("Marks saved.");
      await loadData();
    });
  }

  async function handleCalculateResults() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const results = await ExaminationService.calculateClassResults(
        currentOrganization.id,
        resultSelection.examinationId,
        resultSelection.gradeId,
        resultSelection.sectionId,
      );
      setCalculatedResults(results);
      const firstSubject = examSubjects.find((item) => item.examinationId === resultSelection.examinationId);
      if (firstSubject) {
        setSubjectPerformance(
          await ExaminationService.getSubjectPerformance(
            currentOrganization.id,
            resultSelection.examinationId,
            resultSelection.gradeId,
            resultSelection.sectionId,
            firstSubject.subjectId,
          ),
        );
      }
      setMessage("Results calculated.");
    });
  }

  async function handlePublishResults() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const publication = await ExaminationService.publishResults(
        currentOrganization.id,
        resultSelection.examinationId,
        resultSelection.gradeId,
        resultSelection.sectionId,
      );
      setCalculatedResults(publication.results);
      setMessage("Results published.");
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

  const setupMissing = academicYears.length === 0 || grades.length === 0 || subjects.length === 0;

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
          description="Manage examinations, assessments, marks, grading, result calculation, and publication."
          actions={<Badge variant="secondary">SIS Foundation</Badge>}
        />

        {message && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}
        {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
        {setupMissing && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Academic setup is required before full marks entry: create an academic year, class, section, subject, enrolled student, and teacher in the existing SIS modules.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <SummaryCard icon={<FileCheck2 className="h-5 w-5" />} label="Examinations" value={examinations.length} />
          <SummaryCard icon={<ClipboardList className="h-5 w-5" />} label="Assessments" value={assessments.length} />
          <SummaryCard icon={<BookOpenCheck className="h-5 w-5" />} label="Marks" value={marks.length} />
          <SummaryCard icon={<GraduationCap className="h-5 w-5" />} label="Grade Rules" value={gradingRules.length} />
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/5 bg-[#0f141f] p-2">
          {[
            ["examinations", "Examinations"],
            ["assessments", "Assessments"],
            ["marks", "Marks Entry"],
            ["results", "Results"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as ExamTab)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                activeTab === id ? "bg-red-500 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400">Loading examination workspace...</div>
        ) : (
          <>
            {activeTab === "examinations" && (
              <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-4 p-6">
                    <h2 className="text-lg font-semibold text-white">Create Examination</h2>
                    <form onSubmit={handleCreateExam} className="space-y-3">
                      <Input placeholder="Examination name" value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })} required />
                      <Select value={examForm.academicYearId} onChange={(e) => setExamForm({ ...examForm, academicYearId: e.target.value })} required>
                        <option value="">Academic Year</option>
                        {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                      </Select>
                      <Select value={examForm.type} onChange={(e) => setExamForm({ ...examForm, type: e.target.value as ExaminationType })}>
                        {examTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </Select>
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="date" value={examForm.startDate} onChange={(e) => setExamForm({ ...examForm, startDate: e.target.value })} />
                        <Input type="date" value={examForm.endDate} onChange={(e) => setExamForm({ ...examForm, endDate: e.target.value })} />
                      </div>
                      <Input placeholder="Description" value={examForm.description} onChange={(e) => setExamForm({ ...examForm, description: e.target.value })} />
                      <Button type="submit" className="w-full">Create Examination</Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-4 p-6">
                    <h2 className="text-lg font-semibold text-white">Configure Examination Subjects</h2>
                    <form onSubmit={handleAddExamSubject} className="grid gap-3 lg:grid-cols-4">
                      <Select value={examSubjectForm.examinationId} onChange={(e) => setExamSubjectForm({ ...examSubjectForm, examinationId: e.target.value })} required>
                        <option value="">Examination</option>
                        {examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
                      </Select>
                      <Select value={examSubjectForm.gradeId} onChange={(e) => setExamSubjectForm({ ...examSubjectForm, gradeId: e.target.value })} required>
                        <option value="">Class</option>
                        {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                      </Select>
                      <Select value={examSubjectForm.sectionId} onChange={(e) => setExamSubjectForm({ ...examSubjectForm, sectionId: e.target.value })} required>
                        <option value="">Section</option>
                        {sections.filter((section) => !examSubjectForm.gradeId || section.gradeId === examSubjectForm.gradeId).map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                      </Select>
                      <Select value={examSubjectForm.subjectId} onChange={(e) => setExamSubjectForm({ ...examSubjectForm, subjectId: e.target.value })} required>
                        <option value="">Subject</option>
                        {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                      </Select>
                      <Input type="number" min="1" value={examSubjectForm.maximumMarks} onChange={(e) => setExamSubjectForm({ ...examSubjectForm, maximumMarks: Number(e.target.value) })} />
                      <Input type="number" min="0" value={examSubjectForm.passingMarks} onChange={(e) => setExamSubjectForm({ ...examSubjectForm, passingMarks: Number(e.target.value) })} />
                      <Input type="number" min="0" value={examSubjectForm.weightage} onChange={(e) => setExamSubjectForm({ ...examSubjectForm, weightage: Number(e.target.value) })} />
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
                    <Input placeholder="Assessment title" value={assessmentForm.title} onChange={(e) => setAssessmentForm({ ...assessmentForm, title: e.target.value })} required />
                    <Select value={assessmentForm.type} onChange={(e) => setAssessmentForm({ ...assessmentForm, type: e.target.value as AssessmentType })}>
                      {assessmentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </Select>
                    <Select value={assessmentForm.academicYearId} onChange={(e) => setAssessmentForm({ ...assessmentForm, academicYearId: e.target.value })} required>
                      <option value="">Academic Year</option>
                      {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
                    </Select>
                    <Input type="date" value={assessmentForm.assessmentDate} onChange={(e) => setAssessmentForm({ ...assessmentForm, assessmentDate: e.target.value })} />
                    <Select value={assessmentForm.gradeId} onChange={(e) => setAssessmentForm({ ...assessmentForm, gradeId: e.target.value })} required>
                      <option value="">Class</option>
                      {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                    </Select>
                    <Select value={assessmentForm.sectionId} onChange={(e) => setAssessmentForm({ ...assessmentForm, sectionId: e.target.value })} required>
                      <option value="">Section</option>
                      {sections.filter((section) => !assessmentForm.gradeId || section.gradeId === assessmentForm.gradeId).map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                    </Select>
                    <Select value={assessmentForm.subjectId} onChange={(e) => setAssessmentForm({ ...assessmentForm, subjectId: e.target.value })} required>
                      <option value="">Subject</option>
                      {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                    </Select>
                    <Select value={assessmentForm.teacherId} onChange={(e) => setAssessmentForm({ ...assessmentForm, teacherId: e.target.value })} required>
                      <option value="">Teacher</option>
                      {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.firstName} {teacher.lastName}</option>)}
                    </Select>
                    <Input type="number" min="1" value={assessmentForm.maximumMarks} onChange={(e) => setAssessmentForm({ ...assessmentForm, maximumMarks: Number(e.target.value) })} />
                    <Input type="number" min="0" value={assessmentForm.passingMarks} onChange={(e) => setAssessmentForm({ ...assessmentForm, passingMarks: Number(e.target.value) })} />
                    <Input type="number" min="0" value={assessmentForm.weightage} onChange={(e) => setAssessmentForm({ ...assessmentForm, weightage: Number(e.target.value) })} />
                    <Button type="submit">Create Assessment</Button>
                  </form>
                  <DataList rows={assessments.map((item) => ({ id: item.id, title: item.title, meta: `${subjectName(item.subjectId)} - ${gradeName(item.gradeId)} ${sectionName(item.sectionId)} / ${item.maximumMarks} marks` }))} empty="No assessments created." />
                </CardContent>
              </Card>
            )}

            {activeTab === "marks" && (
              <Card className="bg-[#0f141f] border-white/5">
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-lg font-semibold text-white">Bulk Marks Entry</h2>
                  <div className="grid gap-3 lg:grid-cols-3">
                    <Select value={marksSelection.examinationId} onChange={(e) => setMarksSelection({ examinationId: e.target.value, examinationSubjectId: "" })}>
                      <option value="">Select examination</option>
                      {examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
                    </Select>
                    <Select value={marksSelection.examinationSubjectId} onChange={(e) => setMarksSelection({ ...marksSelection, examinationSubjectId: e.target.value })}>
                      <option value="">Select subject</option>
                      {examSubjects.filter((item) => item.examinationId === marksSelection.examinationId).map((item) => (
                        <option key={item.id} value={item.id}>{subjectName(item.subjectId)} - {gradeName(item.gradeId)} {sectionName(item.sectionId)}</option>
                      ))}
                    </Select>
                    <Button onClick={handleSaveMarks} disabled={!activeExamSubject}>Save Marks</Button>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Max Marks</th>
                          <th className="px-4 py-3">Obtained</th>
                          <th className="px-4 py-3">Grade</th>
                          <th className="px-4 py-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {enrolledStudents.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No enrolled students found for this class/section.</td></tr>
                        ) : enrolledStudents.map((student) => {
                          const existing = marks.find((mark) => mark.studentId === student.id && mark.sourceId === marksSelection.examinationId && mark.subjectId === activeExamSubject?.subjectId);
                          return (
                            <tr key={student.id}>
                              <td className="px-4 py-3 text-white">{student.firstName} {student.lastName}</td>
                              <td className="px-4 py-3">{activeExamSubject?.maximumMarks}</td>
                              <td className="px-4 py-3"><Input type="number" min="0" max={activeExamSubject?.maximumMarks} value={markInputs[student.id]?.obtainedMarks || ""} onChange={(e) => setMarkInputs({ ...markInputs, [student.id]: { ...markInputs[student.id], obtainedMarks: e.target.value } })} /></td>
                              <td className="px-4 py-3">{existing?.grade || "-"}</td>
                              <td className="px-4 py-3"><Input value={markInputs[student.id]?.remarks || ""} onChange={(e) => setMarkInputs({ ...markInputs, [student.id]: { ...markInputs[student.id], remarks: e.target.value } })} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "results" && (
              <Card className="bg-[#0f141f] border-white/5">
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-lg font-semibold text-white">Result Calculation & Publication</h2>
                  <div className="grid gap-3 lg:grid-cols-5">
                    <Select value={resultSelection.examinationId} onChange={(e) => setResultSelection({ ...resultSelection, examinationId: e.target.value })}>
                      <option value="">Examination</option>
                      {examinations.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
                    </Select>
                    <Select value={resultSelection.gradeId} onChange={(e) => setResultSelection({ ...resultSelection, gradeId: e.target.value })}>
                      <option value="">Class</option>
                      {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                    </Select>
                    <Select value={resultSelection.sectionId} onChange={(e) => setResultSelection({ ...resultSelection, sectionId: e.target.value })}>
                      <option value="">Section</option>
                      {sections.filter((section) => !resultSelection.gradeId || section.gradeId === resultSelection.gradeId).map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                    </Select>
                    <Button onClick={handleCalculateResults}>Calculate</Button>
                    <Button onClick={handlePublishResults} variant="secondary">Publish</Button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    {subjectPerformance && (
                      <SummaryCard icon={<BarChart3 className="h-5 w-5" />} label={`${subjectName(subjectPerformance.subjectId)} Avg`} value={`${subjectPerformance.average}%`} />
                    )}
                    {subjectPerformance && <SummaryCard icon={<BarChart3 className="h-5 w-5" />} label="Pass Rate" value={`${subjectPerformance.passRate}%`} />}
                    {subjectPerformance && <SummaryCard icon={<BarChart3 className="h-5 w-5" />} label="High / Low" value={`${subjectPerformance.highest} / ${subjectPerformance.lowest}`} />}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/5">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-900/60 text-xs uppercase text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Marks</th>
                          <th className="px-4 py-3">Percentage</th>
                          <th className="px-4 py-3">Grade</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {calculatedResults.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Calculate results to preview class performance.</td></tr>
                        ) : calculatedResults.map((result) => (
                          <tr key={result.studentId}>
                            <td className="px-4 py-3 text-white">{studentName(result.studentId)}</td>
                            <td className="px-4 py-3">{result.obtainedMarks} / {result.maximumMarks}</td>
                            <td className="px-4 py-3">{result.percentage}%</td>
                            <td className="px-4 py-3">{result.grade || "-"}</td>
                            <td className="px-4 py-3"><Badge variant={result.passed ? "success" : "destructive"}>{result.passed ? "Pass" : "Fail"}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
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

function DataList({ rows, empty }: { rows: Array<{ id: string; title: string; meta: string }>; empty: string }) {
  if (rows.length === 0) {
    return <div className="rounded-xl border border-white/5 py-8 text-center text-sm text-slate-500">{empty}</div>;
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
