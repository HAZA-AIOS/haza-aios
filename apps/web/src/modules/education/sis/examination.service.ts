import { workspaceService } from "@/workspace/workspace-service";
import { AcademicService } from "./academic.service";
import { EnrollmentService } from "./enrollment.service";
import { StudentService } from "./student.service";
import { StaffService } from "./staff.service";
import type {
  Assessment,
  Examination,
  ExaminationSubject,
  GradingRule,
  MarkRecord,
  MarkSourceType,
  ResultPublication,
  StudentResult,
  SubjectPerformance,
} from "./sis.types";

const EXAMINATIONS_KEY = "haza-aios.sis.examinations";
const EXAM_SUBJECTS_KEY = "haza-aios.sis.examination-subjects";
const ASSESSMENTS_KEY = "haza-aios.sis.assessments";
const MARKS_KEY = "haza-aios.sis.marks";
const GRADING_RULES_KEY = "haza-aios.sis.grading-rules";
const RESULTS_KEY = "haza-aios.sis.results";

type ActorRole = "Owner" | "Admin" | "Member" | "Teacher";
type Permission =
  | "examination.view"
  | "examination.create"
  | "examination.update"
  | "assessment.view"
  | "assessment.create"
  | "assessment.update"
  | "marks.view"
  | "marks.enter"
  | "marks.update"
  | "results.view"
  | "results.publish"
  | "results.manage";

interface ActorContext {
  userId: string;
  role: ActorRole;
}

interface MarkInput {
  sourceType: MarkSourceType;
  sourceId: string;
  examinationSubjectId?: string;
  studentId: string;
  obtainedMarks: number;
  remarks?: string;
  enteredBy: string;
}

const adminPermissions = new Set<Permission>([
  "examination.view",
  "examination.create",
  "examination.update",
  "assessment.view",
  "assessment.create",
  "assessment.update",
  "marks.view",
  "marks.enter",
  "marks.update",
  "results.view",
  "results.publish",
  "results.manage",
]);

const teacherPermissions = new Set<Permission>([
  "examination.view",
  "assessment.view",
  "assessment.create",
  "assessment.update",
  "marks.view",
  "marks.enter",
  "marks.update",
  "results.view",
]);

function readCollection<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  if (!data) return [];

  try {
    return JSON.parse(data) as T[];
  } catch {
    return [];
  }
}

function writeCollection<T>(key: string, values: T[]): void {
  localStorage.setItem(key, JSON.stringify(values));
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultActor(): ActorContext {
  return { userId: "system", role: "Owner" };
}

function assertPermission(actor: ActorContext | undefined, permission: Permission): void {
  const activeActor = actor || defaultActor();
  if (activeActor.role === "Owner" || activeActor.role === "Admin") {
    if (adminPermissions.has(permission)) return;
  }
  if (activeActor.role === "Teacher" && teacherPermissions.has(permission)) return;
  throw new Error(`Unauthorized: missing permission ${permission}`);
}

function assertSameOrganization(
  organizationId: string,
  record: { organizationId?: string },
): void {
  if (record.organizationId && record.organizationId !== organizationId) {
    throw new Error("Organization isolation violation");
  }
}

function assertMarks(maximumMarks: number, obtainedMarks?: number, passingMarks?: number): void {
  if (maximumMarks <= 0) {
    throw new Error("Maximum marks must be greater than zero.");
  }
  if (passingMarks !== undefined && (passingMarks < 0 || passingMarks > maximumMarks)) {
    throw new Error("Passing marks must be between zero and maximum marks.");
  }
  if (obtainedMarks !== undefined && obtainedMarks < 0) {
    throw new Error("Obtained marks cannot be negative.");
  }
  if (obtainedMarks !== undefined && obtainedMarks > maximumMarks) {
    throw new Error("Obtained marks cannot exceed maximum marks.");
  }
}

function percentage(obtained: number, maximum: number): number {
  if (maximum <= 0) return 0;
  return Math.round((obtained / maximum) * 10000) / 100;
}

export class ExaminationServiceClass {
  private getExaminationsDb(): Examination[] {
    return readCollection<Examination>(EXAMINATIONS_KEY);
  }

  private saveExaminationsDb(examinations: Examination[]): void {
    writeCollection(EXAMINATIONS_KEY, examinations);
  }

  private getExamSubjectsDb(): ExaminationSubject[] {
    return readCollection<ExaminationSubject>(EXAM_SUBJECTS_KEY);
  }

  private saveExamSubjectsDb(subjects: ExaminationSubject[]): void {
    writeCollection(EXAM_SUBJECTS_KEY, subjects);
  }

  private getAssessmentsDb(): Assessment[] {
    return readCollection<Assessment>(ASSESSMENTS_KEY);
  }

  private saveAssessmentsDb(assessments: Assessment[]): void {
    writeCollection(ASSESSMENTS_KEY, assessments);
  }

  private getMarksDb(): MarkRecord[] {
    return readCollection<MarkRecord>(MARKS_KEY);
  }

  private saveMarksDb(marks: MarkRecord[]): void {
    writeCollection(MARKS_KEY, marks);
  }

  private getGradingRulesDb(): GradingRule[] {
    return readCollection<GradingRule>(GRADING_RULES_KEY);
  }

  private saveGradingRulesDb(rules: GradingRule[]): void {
    writeCollection(GRADING_RULES_KEY, rules);
  }

  private getResultsDb(): ResultPublication[] {
    return readCollection<ResultPublication>(RESULTS_KEY);
  }

  private saveResultsDb(results: ResultPublication[]): void {
    writeCollection(RESULTS_KEY, results);
  }

  private async audit(organizationId: string, action: string, details: string): Promise<void> {
    await workspaceService.addActivityLog(organizationId, {
      action,
      actor: "System Operator",
      details,
    });
  }

  private async getAcademicYearName(organizationId: string, academicYearId: string): Promise<string> {
    const year = await AcademicService.getAcademicYears(organizationId).then((years) =>
      years.find((item) => item.id === academicYearId),
    );
    if (!year) throw new Error("Academic year not found.");
    return year.name;
  }

  async getExaminations(organizationId: string): Promise<Examination[]> {
    return this.getExaminationsDb()
      .filter((exam) => exam.organizationId === organizationId)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }

  async createExamination(
    organizationId: string,
    data: Omit<Examination, "id" | "organizationId" | "createdAt" | "updatedAt">,
    actor?: ActorContext,
  ): Promise<Examination> {
    assertPermission(actor, "examination.create");

    if (!data.name.trim()) throw new Error("Examination name is required.");
    if (new Date(data.startDate) > new Date(data.endDate)) {
      throw new Error("Examination start date must be before end date.");
    }

    const year = await AcademicService.getAcademicYears(organizationId).then((years) =>
      years.find((item) => item.id === data.academicYearId),
    );
    if (!year) throw new Error("Academic year not found.");

    if (data.termId) {
      const term = await AcademicService.getTerms(organizationId, data.academicYearId).then((terms) =>
        terms.find((item) => item.id === data.termId),
      );
      if (!term) throw new Error("Term not found for selected academic year.");
    }

    const now = new Date().toISOString();
    const examination: Examination = {
      ...data,
      name: data.name.trim(),
      id: createId("exam"),
      organizationId,
      createdAt: now,
      updatedAt: now,
    };

    const examinations = this.getExaminationsDb();
    examinations.push(examination);
    this.saveExaminationsDb(examinations);
    await this.audit(organizationId, "Examination Created", `Created examination ${examination.name}.`);
    return examination;
  }

  async updateExamination(
    organizationId: string,
    id: string,
    updates: Partial<Examination>,
    actor?: ActorContext,
  ): Promise<Examination> {
    assertPermission(actor, "examination.update");
    const examinations = this.getExaminationsDb();
    const index = examinations.findIndex((exam) => exam.id === id && exam.organizationId === organizationId);
    if (index === -1) throw new Error("Examination not found.");
    if (examinations[index].status === "published") {
      throw new Error("Published examinations cannot be modified silently.");
    }

    const updated = { ...examinations[index], ...updates, organizationId, updatedAt: new Date().toISOString() };
    if (new Date(updated.startDate) > new Date(updated.endDate)) {
      throw new Error("Examination start date must be before end date.");
    }
    examinations[index] = updated;
    this.saveExaminationsDb(examinations);
    await this.audit(organizationId, "Examination Updated", `Updated examination ${updated.name}.`);
    return updated;
  }

  async getExaminationSubjects(organizationId: string, examinationId?: string): Promise<ExaminationSubject[]> {
    return this.getExamSubjectsDb().filter(
      (subject) =>
        subject.organizationId === organizationId &&
        (!examinationId || subject.examinationId === examinationId),
    );
  }

  async addExaminationSubject(
    organizationId: string,
    data: Omit<ExaminationSubject, "id" | "organizationId" | "createdAt" | "updatedAt">,
    actor?: ActorContext,
  ): Promise<ExaminationSubject> {
    assertPermission(actor, "examination.update");
    assertMarks(data.maximumMarks, undefined, data.passingMarks);

    const exam = this.getExaminationsDb().find(
      (item) => item.id === data.examinationId && item.organizationId === organizationId,
    );
    if (!exam) throw new Error("Examination not found.");
    if (exam.status === "published") throw new Error("Published examinations cannot be modified silently.");

    const [grade, subject] = await Promise.all([
      AcademicService.getGrade(data.gradeId, organizationId),
      AcademicService.getSubjects(organizationId).then((subjects) =>
        subjects.find((item) => item.id === data.subjectId),
      ),
    ]);
    if (!grade) throw new Error("Class/grade not found.");
    if (!subject) throw new Error("Subject not found.");
    if (data.sectionId) {
      const section = await AcademicService.getSection(data.sectionId, organizationId);
      if (!section || section.gradeId !== data.gradeId) throw new Error("Section not found for selected class.");
    }

    const subjects = this.getExamSubjectsDb();
    const duplicate = subjects.find(
      (item) =>
        item.organizationId === organizationId &&
        item.examinationId === data.examinationId &&
        item.gradeId === data.gradeId &&
        item.sectionId === data.sectionId &&
        item.subjectId === data.subjectId,
    );
    if (duplicate) throw new Error("This examination subject is already configured.");

    const now = new Date().toISOString();
    const examSubject: ExaminationSubject = {
      ...data,
      id: createId("exam-subject"),
      organizationId,
      createdAt: now,
      updatedAt: now,
    };
    subjects.push(examSubject);
    this.saveExamSubjectsDb(subjects);
    await this.audit(organizationId, "Examination Subject Added", "Configured examination subject marks.");
    return examSubject;
  }

  async getAssessments(organizationId: string): Promise<Assessment[]> {
    return this.getAssessmentsDb()
      .filter((assessment) => assessment.organizationId === organizationId)
      .sort((a, b) => new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime());
  }

  async createAssessment(
    organizationId: string,
    data: Omit<Assessment, "id" | "organizationId" | "createdAt" | "updatedAt">,
    actor?: ActorContext,
  ): Promise<Assessment> {
    assertPermission(actor, "assessment.create");
    assertMarks(data.maximumMarks, undefined, data.passingMarks);

    const [year, grade, section, subject, teacher] = await Promise.all([
      AcademicService.getAcademicYears(organizationId).then((years) =>
        years.find((item) => item.id === data.academicYearId),
      ),
      AcademicService.getGrade(data.gradeId, organizationId),
      AcademicService.getSection(data.sectionId, organizationId),
      AcademicService.getSubjects(organizationId).then((subjects) =>
        subjects.find((item) => item.id === data.subjectId),
      ),
      StaffService.getStaffById(data.teacherId, organizationId),
    ]);

    if (!year) throw new Error("Academic year not found.");
    if (!grade) throw new Error("Class/grade not found.");
    if (!section || section.gradeId !== data.gradeId) throw new Error("Section not found for selected class.");
    if (!subject) throw new Error("Subject not found.");
    if (!teacher || teacher.staffType !== "teacher") throw new Error("Teacher not found for this organization.");

    const now = new Date().toISOString();
    const assessment: Assessment = {
      ...data,
      id: createId("assessment"),
      organizationId,
      title: data.title.trim(),
      createdAt: now,
      updatedAt: now,
    };
    if (!assessment.title) throw new Error("Assessment title is required.");

    const assessments = this.getAssessmentsDb();
    assessments.push(assessment);
    this.saveAssessmentsDb(assessments);
    await this.audit(organizationId, "Assessment Created", `Created assessment ${assessment.title}.`);
    return assessment;
  }

  async getGradingRules(organizationId: string): Promise<GradingRule[]> {
    const existing = this.getGradingRulesDb().filter((rule) => rule.organizationId === organizationId);
    if (existing.length > 0) return existing.sort((a, b) => b.minPercentage - a.minPercentage);

    const now = new Date().toISOString();
    const defaults: GradingRule[] = [
      { grade: "A", minPercentage: 80, maxPercentage: 100, gradePoint: 4, description: "Excellent" },
      { grade: "B", minPercentage: 70, maxPercentage: 79.99, gradePoint: 3, description: "Good" },
      { grade: "C", minPercentage: 60, maxPercentage: 69.99, gradePoint: 2, description: "Satisfactory" },
      { grade: "D", minPercentage: 50, maxPercentage: 59.99, gradePoint: 1, description: "Needs improvement" },
      { grade: "F", minPercentage: 0, maxPercentage: 49.99, gradePoint: 0, description: "Fail" },
    ].map((rule) => ({
      ...rule,
      id: createId("grade-rule"),
      organizationId,
      createdAt: now,
      updatedAt: now,
    }));

    this.saveGradingRulesDb([...this.getGradingRulesDb(), ...defaults]);
    return defaults;
  }

  async saveGradingRule(
    organizationId: string,
    data: Omit<GradingRule, "id" | "organizationId" | "createdAt" | "updatedAt"> &
      Partial<Pick<GradingRule, "id">>,
    actor?: ActorContext,
  ): Promise<GradingRule> {
    assertPermission(actor, "results.manage");
    if (!data.grade.trim()) throw new Error("Grade label is required.");
    if (data.minPercentage < 0 || data.maxPercentage > 100 || data.minPercentage > data.maxPercentage) {
      throw new Error("Grade percentage boundaries are invalid.");
    }

    const rules = this.getGradingRulesDb();
    const index = data.id
      ? rules.findIndex((rule) => rule.id === data.id && rule.organizationId === organizationId)
      : -1;
    const now = new Date().toISOString();
    const rule: GradingRule = {
      ...data,
      grade: data.grade.trim(),
      id: data.id || createId("grade-rule"),
      organizationId,
      createdAt: index >= 0 ? rules[index].createdAt : now,
      updatedAt: now,
    };

    if (index >= 0) rules[index] = rule;
    else rules.push(rule);
    this.saveGradingRulesDb(rules);
    await this.audit(organizationId, "Grading Rule Saved", `Saved grading rule ${rule.grade}.`);
    return rule;
  }

  async calculateGrade(organizationId: string, value: number): Promise<Pick<GradingRule, "grade" | "gradePoint"> | null> {
    const rules = await this.getGradingRules(organizationId);
    return rules.find((rule) => value >= rule.minPercentage && value <= rule.maxPercentage) || null;
  }

  async enterMark(organizationId: string, input: MarkInput, actor?: ActorContext): Promise<MarkRecord> {
    assertPermission(actor, "marks.enter");

    const source =
      input.sourceType === "examination"
        ? await this.resolveExaminationMarkSource(organizationId, input.sourceId, input.examinationSubjectId)
        : await this.resolveAssessmentMarkSource(organizationId, input.sourceId);

    const student = await StudentService.getStudent(input.studentId, organizationId);
    if (!student) throw new Error("Student not found for this organization.");

    const enrollments = await EnrollmentService.getEnrollments(organizationId, {
      studentId: input.studentId,
      academicYear: source.academicYearName,
      gradeId: source.gradeId,
      sectionId: source.sectionId,
      status: "active",
    });
    if (enrollments.length === 0) {
      throw new Error("Student is not actively enrolled in the selected academic context.");
    }

    assertMarks(source.maximumMarks, input.obtainedMarks, source.passingMarks);

    const marks = this.getMarksDb();
    const existingIndex = marks.findIndex(
      (mark) =>
        mark.organizationId === organizationId &&
        mark.sourceType === input.sourceType &&
        mark.sourceId === input.sourceId &&
        mark.subjectId === source.subjectId &&
        mark.studentId === input.studentId,
    );

    const existing = existingIndex >= 0 ? marks[existingIndex] : null;
    if (existing) {
      const exam = input.sourceType === "examination"
        ? this.getExaminationsDb().find((item) => item.id === input.sourceId)
        : undefined;
      if (exam?.status === "published") {
        throw new Error("Published results cannot be modified silently.");
      }
    }

    const markPercentage = percentage(input.obtainedMarks, source.maximumMarks);
    const grade = await this.calculateGrade(organizationId, markPercentage);
    const now = new Date().toISOString();
    const mark: MarkRecord = {
      id: existing?.id || createId("mark"),
      organizationId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      examinationSubjectId: input.examinationSubjectId,
      academicYearId: source.academicYearId,
      termId: source.termId,
      gradeId: source.gradeId,
      sectionId: source.sectionId,
      subjectId: source.subjectId,
      studentId: input.studentId,
      maximumMarks: source.maximumMarks,
      obtainedMarks: input.obtainedMarks,
      percentage: markPercentage,
      grade: grade?.grade,
      gradePoint: grade?.gradePoint,
      remarks: input.remarks,
      enteredBy: input.enteredBy,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (existingIndex >= 0) marks[existingIndex] = mark;
    else marks.push(mark);
    this.saveMarksDb(marks);
    await this.audit(organizationId, existing ? "Marks Updated" : "Marks Entered", "Saved student marks.");
    return mark;
  }

  async bulkEnterMarks(
    organizationId: string,
    inputs: MarkInput[],
    actor?: ActorContext,
  ): Promise<MarkRecord[]> {
    const saved: MarkRecord[] = [];
    for (const input of inputs) {
      saved.push(await this.enterMark(organizationId, input, actor));
    }
    return saved;
  }

  async getMarks(
    organizationId: string,
    filters?: Partial<Pick<MarkRecord, "sourceType" | "sourceId" | "studentId" | "gradeId" | "sectionId" | "subjectId">>,
  ): Promise<MarkRecord[]> {
    assertPermission(undefined, "marks.view");
    return this.getMarksDb().filter((mark) => {
      if (mark.organizationId !== organizationId) return false;
      if (filters?.sourceType && mark.sourceType !== filters.sourceType) return false;
      if (filters?.sourceId && mark.sourceId !== filters.sourceId) return false;
      if (filters?.studentId && mark.studentId !== filters.studentId) return false;
      if (filters?.gradeId && mark.gradeId !== filters.gradeId) return false;
      if (filters?.sectionId && mark.sectionId !== filters.sectionId) return false;
      if (filters?.subjectId && mark.subjectId !== filters.subjectId) return false;
      return true;
    });
  }

  async calculateClassResults(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
  ): Promise<StudentResult[]> {
    const examination = this.getExaminationsDb().find(
      (item) => item.id === examinationId && item.organizationId === organizationId,
    );
    if (!examination) throw new Error("Examination not found.");

    const examSubjects = await this.getExaminationSubjects(organizationId, examinationId).then((subjects) =>
      subjects.filter((subject) => subject.gradeId === gradeId && (!subject.sectionId || subject.sectionId === sectionId)),
    );
    if (examSubjects.length === 0) throw new Error("No examination subjects configured for this class.");

    const academicYearName = await this.getAcademicYearName(organizationId, examination.academicYearId);
    const enrollments = await EnrollmentService.getEnrollments(organizationId, {
      academicYear: academicYearName,
      gradeId,
      sectionId,
      status: "active",
    });

    const results: StudentResult[] = [];
    const marks = await this.getMarks(organizationId, { sourceType: "examination", sourceId: examinationId });

    for (const enrollment of enrollments) {
      const subjectResults = [];
      for (const examSubject of examSubjects) {
        const mark = marks.find(
          (item) => item.studentId === enrollment.studentId && item.subjectId === examSubject.subjectId,
        );
        if (!mark) throw new Error("Incomplete marks prevent result calculation.");
        subjectResults.push({
          subjectId: examSubject.subjectId,
          maximumMarks: examSubject.maximumMarks,
          obtainedMarks: mark.obtainedMarks,
          percentage: mark.percentage,
          grade: mark.grade,
          gradePoint: mark.gradePoint,
          passed: mark.obtainedMarks >= examSubject.passingMarks,
          remarks: mark.remarks,
        });
      }

      const maximumMarks = subjectResults.reduce((sum, item) => sum + item.maximumMarks, 0);
      const obtainedMarks = subjectResults.reduce((sum, item) => sum + item.obtainedMarks, 0);
      const overallPercentage = percentage(obtainedMarks, maximumMarks);
      const grade = await this.calculateGrade(organizationId, overallPercentage);
      results.push({
        studentId: enrollment.studentId,
        maximumMarks,
        obtainedMarks,
        percentage: overallPercentage,
        grade: grade?.grade,
        gradePoint: grade?.gradePoint,
        passed: subjectResults.every((item) => item.passed),
        subjects: subjectResults,
      });
    }

    return results;
  }

  async publishResults(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
    actor?: ActorContext,
  ): Promise<ResultPublication> {
    assertPermission(actor, "results.publish");
    const examination = this.getExaminationsDb().find(
      (item) => item.id === examinationId && item.organizationId === organizationId,
    );
    if (!examination) throw new Error("Examination not found.");

    const calculated = await this.calculateClassResults(organizationId, examinationId, gradeId, sectionId);
    const now = new Date().toISOString();
    const results = this.getResultsDb();
    const existingIndex = results.findIndex(
      (item) =>
        item.organizationId === organizationId &&
        item.examinationId === examinationId &&
        item.gradeId === gradeId &&
        item.sectionId === sectionId,
    );
    const publication: ResultPublication = {
      id: existingIndex >= 0 ? results[existingIndex].id : createId("result"),
      organizationId,
      examinationId,
      academicYearId: examination.academicYearId,
      termId: examination.termId,
      gradeId,
      sectionId,
      status: "published",
      results: calculated,
      publishedAt: now,
      publishedBy: actor?.userId || "system",
      createdAt: existingIndex >= 0 ? results[existingIndex].createdAt : now,
      updatedAt: now,
    };

    if (existingIndex >= 0) results[existingIndex] = publication;
    else results.push(publication);
    this.saveResultsDb(results);

    await this.updateExamination(organizationId, examinationId, {
      status: "published",
      publishedAt: now,
      publishedBy: actor?.userId || "system",
    }, { userId: actor?.userId || "system", role: "Owner" });
    await this.audit(organizationId, "Results Published", `Published results for ${examination.name}.`);
    return publication;
  }

  async getResultPublications(organizationId: string, examinationId?: string): Promise<ResultPublication[]> {
    return this.getResultsDb().filter(
      (result) =>
        result.organizationId === organizationId &&
        (!examinationId || result.examinationId === examinationId),
    );
  }

  async getStudentResult(
    organizationId: string,
    examinationId: string,
    studentId: string,
  ): Promise<StudentResult | null> {
    const publications = await this.getResultPublications(organizationId, examinationId);
    for (const publication of publications) {
      const result = publication.results.find((item) => item.studentId === studentId);
      if (result) return result;
    }
    return null;
  }

  async getSubjectPerformance(
    organizationId: string,
    examinationId: string,
    gradeId: string,
    sectionId: string,
    subjectId: string,
  ): Promise<SubjectPerformance | null> {
    const results = await this.calculateClassResults(organizationId, examinationId, gradeId, sectionId);
    const subjectResults = results
      .map((result) => result.subjects.find((subject) => subject.subjectId === subjectId))
      .filter((result): result is NonNullable<typeof result> => Boolean(result));

    if (subjectResults.length === 0) return null;

    const scores = subjectResults.map((result) => result.obtainedMarks);
    const gradeDistribution: Record<string, number> = {};
    for (const result of subjectResults) {
      gradeDistribution[result.grade || "Ungraded"] = (gradeDistribution[result.grade || "Ungraded"] || 0) + 1;
    }

    return {
      subjectId,
      maximumMarks: subjectResults[0].maximumMarks,
      average: Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100,
      highest: Math.max(...scores),
      lowest: Math.min(...scores),
      passRate: Math.round((subjectResults.filter((result) => result.passed).length / subjectResults.length) * 10000) / 100,
      gradeDistribution,
    };
  }

  private async resolveExaminationMarkSource(
    organizationId: string,
    examinationId: string,
    examinationSubjectId?: string,
  ) {
    const examination = this.getExaminationsDb().find(
      (item) => item.id === examinationId && item.organizationId === organizationId,
    );
    if (!examination) throw new Error("Examination not found.");

    const examSubject = this.getExamSubjectsDb().find(
      (item) =>
        item.organizationId === organizationId &&
        item.examinationId === examinationId &&
        (!examinationSubjectId || item.id === examinationSubjectId),
    );
    if (!examSubject) throw new Error("Examination subject not found.");
    assertSameOrganization(organizationId, examSubject);

    return {
      academicYearId: examination.academicYearId,
      academicYearName: await this.getAcademicYearName(organizationId, examination.academicYearId),
      termId: examination.termId,
      gradeId: examSubject.gradeId,
      sectionId: examSubject.sectionId || "",
      subjectId: examSubject.subjectId,
      maximumMarks: examSubject.maximumMarks,
      passingMarks: examSubject.passingMarks,
    };
  }

  private async resolveAssessmentMarkSource(organizationId: string, assessmentId: string) {
    const assessment = this.getAssessmentsDb().find(
      (item) => item.id === assessmentId && item.organizationId === organizationId,
    );
    if (!assessment) throw new Error("Assessment not found.");
    assertSameOrganization(organizationId, assessment);

    return {
      academicYearId: assessment.academicYearId,
      academicYearName: await this.getAcademicYearName(organizationId, assessment.academicYearId),
      termId: assessment.termId,
      gradeId: assessment.gradeId,
      sectionId: assessment.sectionId,
      subjectId: assessment.subjectId,
      maximumMarks: assessment.maximumMarks,
      passingMarks: assessment.passingMarks,
    };
  }
}

export const ExaminationService = new ExaminationServiceClass();
