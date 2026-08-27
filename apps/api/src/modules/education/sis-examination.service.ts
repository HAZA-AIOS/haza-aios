import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../common/errors/api-error.js';
import type { DatabaseClient } from '../../database/client.js';
import { mapDatabaseError } from '../../database/errors.js';
import { withTransaction } from '../../database/transactions.js';
import {
  academicTerms,
  academicYears,
  assessments,
  enrollments,
  examinationSubjects,
  examinations,
  gradeLevels,
  gradingRules,
  markRecords,
  resultPublications,
  sections,
  staffMembers,
  students,
  subjects,
} from '../../database/schema.js';

type JsonRecord = Record<string, unknown>;
type Tenant = { organizationId: string; workspaceId: string };
type StudentResult = {
  studentId: string;
  maximumMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade?: string;
  gradePoint?: number;
  passed: boolean;
  subjects: Array<{
    subjectId: string;
    maximumMarks: number;
    obtainedMarks: number;
    percentage: number;
    grade?: string;
    gradePoint?: number;
    passed: boolean;
    remarks?: string;
  }>;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function clean<T extends JsonRecord>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

function uuid(): string {
  return randomUUID();
}

function databaseError(error: unknown): never {
  const mapped = mapDatabaseError(error);
  if (mapped.code === 'DATABASE_UNIQUE_CONSTRAINT') {
    throw new ApiError(409, 'DATABASE_UNIQUE_CONSTRAINT', 'A SIS examination record with the same unique scope already exists.');
  }
  throw error;
}

function toBasisPoints(value: unknown): number {
  return Math.round(Number(value) * 100);
}

function fromBasisPoints(value: number | null | undefined): number | undefined {
  return value === null || value === undefined ? undefined : Math.round(value) / 100;
}

function percentage(obtained: number, maximum: number): number {
  if (maximum <= 0) return 0;
  return Math.round((obtained / maximum) * 10000) / 100;
}

function assertMarks(maximumMarks: unknown, obtainedMarks?: unknown, passingMarks?: unknown): void {
  const maximum = Number(maximumMarks);
  const obtained = obtainedMarks === undefined ? undefined : Number(obtainedMarks);
  const passing = passingMarks === undefined ? undefined : Number(passingMarks);
  if (!Number.isFinite(maximum) || maximum <= 0) throw new ApiError(400, 'VALIDATION_FAILED', 'Maximum marks must be greater than zero.');
  if (passing !== undefined && (!Number.isFinite(passing) || passing < 0 || passing > maximum)) throw new ApiError(400, 'VALIDATION_FAILED', 'Passing marks must be between zero and maximum marks.');
  if (obtained !== undefined && (!Number.isFinite(obtained) || obtained < 0)) throw new ApiError(400, 'VALIDATION_FAILED', 'Obtained marks cannot be negative.');
  if (obtained !== undefined && obtained > maximum) throw new ApiError(400, 'VALIDATION_FAILED', 'Obtained marks cannot exceed maximum marks.');
}

export class SisExaminationService {
  constructor(private readonly database: DatabaseClient) {}

  async listExaminations(tenant: Tenant) {
    const rows = await this.database.db.select().from(examinations).where(eq(examinations.workspaceId, tenant.workspaceId)).orderBy(desc(examinations.startDate));
    return rows.map((row) => this.examinationDto(tenant, row));
  }

  async createExamination(tenant: Tenant, data: JsonRecord) {
    if (!String(data.name ?? '').trim()) throw new ApiError(400, 'VALIDATION_FAILED', 'Examination name is required.');
    await Promise.all([this.assertAcademicYear(tenant.workspaceId, String(data.academicYearId)), this.assertDateOrder(data.startDate, data.endDate)]);
    if (data.termId) await this.assertTermInAcademicYear(tenant.workspaceId, String(data.termId), String(data.academicYearId));
    const id = uuid();
    await this.database.db.insert(examinations).values({
      id,
      workspaceId: tenant.workspaceId,
      name: String(data.name).trim(),
      academicYearId: String(data.academicYearId),
      termId: typeof data.termId === 'string' && data.termId ? data.termId : undefined,
      type: String(data.type ?? 'other') as typeof examinations.$inferInsert.type,
      startDate: String(data.startDate),
      endDate: String(data.endDate),
      status: String(data.status ?? 'draft') as typeof examinations.$inferInsert.status,
      description: typeof data.description === 'string' ? data.description : undefined,
    }).catch(databaseError);
    return (await this.listExaminations(tenant)).find((row) => row.id === id)!;
  }

  async updateExamination(tenant: Tenant, id: string, data: JsonRecord) {
    const current = await this.getExaminationRow(tenant.workspaceId, id);
    if (current.status === 'published' && Object.keys(data).some((key) => !['status', 'publishedAt', 'publishedBy'].includes(key))) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Published examinations cannot be modified silently.');
    }
    await this.assertDateOrder(data.startDate ?? current.startDate, data.endDate ?? current.endDate);
    if (data.termId) await this.assertTermInAcademicYear(tenant.workspaceId, String(data.termId), String(data.academicYearId ?? current.academicYearId));
    const updates = { ...data };
    delete updates.id;
    delete updates.organizationId;
    delete updates.createdAt;
    delete updates.updatedAt;
    if (typeof updates.name === 'string') updates.name = updates.name.trim();
    await this.database.db.update(examinations).set({ ...clean(updates), updatedAt: new Date() } as Partial<typeof examinations.$inferInsert>).where(and(eq(examinations.id, id), eq(examinations.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.listExaminations(tenant)).find((row) => row.id === id) ?? this.notFound('Examination');
  }

  async listExaminationSubjects(tenant: Tenant, examinationId?: string) {
    const condition = examinationId ? and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.examinationId, examinationId)) : eq(examinationSubjects.workspaceId, tenant.workspaceId);
    const rows = await this.database.db.select().from(examinationSubjects).where(condition);
    return rows.map((row) => this.examinationSubjectDto(tenant, row));
  }

  async addExaminationSubject(tenant: Tenant, data: JsonRecord) {
    assertMarks(data.maximumMarks, undefined, data.passingMarks);
    const exam = await this.getExaminationRow(tenant.workspaceId, String(data.examinationId));
    if (exam.status === 'published') throw new ApiError(400, 'VALIDATION_FAILED', 'Published examinations cannot be modified silently.');
    await Promise.all([this.assertGrade(tenant.workspaceId, String(data.gradeId)), this.assertSubject(tenant.workspaceId, String(data.subjectId))]);
    if (data.sectionId) await this.assertSectionInGrade(tenant.workspaceId, String(data.sectionId), String(data.gradeId));
    const id = uuid();
    await this.database.db.insert(examinationSubjects).values({
      id,
      workspaceId: tenant.workspaceId,
      examinationId: String(data.examinationId),
      gradeId: String(data.gradeId),
      sectionId: typeof data.sectionId === 'string' && data.sectionId ? data.sectionId : undefined,
      subjectId: String(data.subjectId),
      maximumMarks: Number(data.maximumMarks),
      passingMarks: Number(data.passingMarks),
      weightage: data.weightage === undefined ? undefined : Number(data.weightage),
      examDate: typeof data.examDate === 'string' ? data.examDate : undefined,
      status: String(data.status ?? 'draft') as typeof examinationSubjects.$inferInsert.status,
    }).catch(databaseError);
    return (await this.listExaminationSubjects(tenant, String(data.examinationId))).find((row) => row.id === id)!;
  }

  async listAssessments(tenant: Tenant) {
    const rows = await this.database.db.select().from(assessments).where(eq(assessments.workspaceId, tenant.workspaceId)).orderBy(desc(assessments.assessmentDate));
    return rows.map((row) => this.assessmentDto(tenant, row));
  }

  async createAssessment(tenant: Tenant, data: JsonRecord) {
    if (!String(data.title ?? '').trim()) throw new ApiError(400, 'VALIDATION_FAILED', 'Assessment title is required.');
    assertMarks(data.maximumMarks, undefined, data.passingMarks);
    await Promise.all([this.assertAcademicYear(tenant.workspaceId, String(data.academicYearId)), this.assertGrade(tenant.workspaceId, String(data.gradeId)), this.assertSectionInGrade(tenant.workspaceId, String(data.sectionId), String(data.gradeId)), this.assertSubject(tenant.workspaceId, String(data.subjectId))]);
    if (data.termId) await this.assertTermInAcademicYear(tenant.workspaceId, String(data.termId), String(data.academicYearId));
    const teacher = (await this.database.db.select().from(staffMembers).where(and(eq(staffMembers.workspaceId, tenant.workspaceId), eq(staffMembers.id, String(data.teacherId)))).limit(1))[0];
    if (!teacher || teacher.staffType !== 'teacher') throw new ApiError(404, 'NOT_FOUND', 'Teacher not found for this organization.');
    const id = uuid();
    await this.database.db.insert(assessments).values({
      id,
      workspaceId: tenant.workspaceId,
      title: String(data.title).trim(),
      academicYearId: String(data.academicYearId),
      termId: typeof data.termId === 'string' && data.termId ? data.termId : undefined,
      gradeId: String(data.gradeId),
      sectionId: String(data.sectionId),
      subjectId: String(data.subjectId),
      teacherId: String(data.teacherId),
      type: String(data.type ?? 'other') as typeof assessments.$inferInsert.type,
      maximumMarks: Number(data.maximumMarks),
      passingMarks: Number(data.passingMarks),
      weightage: data.weightage === undefined ? undefined : Number(data.weightage),
      assessmentDate: String(data.assessmentDate),
      status: String(data.status ?? 'draft') as typeof assessments.$inferInsert.status,
      description: typeof data.description === 'string' ? data.description : undefined,
    }).catch(databaseError);
    return (await this.listAssessments(tenant)).find((row) => row.id === id)!;
  }

  async listGradingRules(tenant: Tenant): Promise<Array<ReturnType<SisExaminationService["gradingRuleDto"]>>> {
    const rows = await this.database.db.select().from(gradingRules).where(eq(gradingRules.workspaceId, tenant.workspaceId)).orderBy(desc(gradingRules.minPercentageBasisPoints));
    if (rows.length) return rows.map((row) => this.gradingRuleDto(tenant, row));
    const defaults = [
      { grade: 'A', minPercentage: 80, maxPercentage: 100, gradePoint: 4, description: 'Excellent' },
      { grade: 'B', minPercentage: 70, maxPercentage: 79.99, gradePoint: 3, description: 'Good' },
      { grade: 'C', minPercentage: 60, maxPercentage: 69.99, gradePoint: 2, description: 'Satisfactory' },
      { grade: 'D', minPercentage: 50, maxPercentage: 59.99, gradePoint: 1, description: 'Needs improvement' },
      { grade: 'F', minPercentage: 0, maxPercentage: 49.99, gradePoint: 0, description: 'Fail' },
    ];
    for (const rule of defaults) await this.saveGradingRule(tenant, rule);
    return this.listGradingRules(tenant);
  }

  async saveGradingRule(tenant: Tenant, data: JsonRecord) {
    const grade = String(data.grade ?? '').trim();
    if (!grade) throw new ApiError(400, 'VALIDATION_FAILED', 'Grade label is required.');
    const min = Number(data.minPercentage);
    const max = Number(data.maxPercentage);
    if (min < 0 || max > 100 || min > max) throw new ApiError(400, 'VALIDATION_FAILED', 'Grade percentage boundaries are invalid.');
    const id = typeof data.id === 'string' ? data.id : uuid();
    const existing = typeof data.id === 'string' ? (await this.database.db.select().from(gradingRules).where(and(eq(gradingRules.workspaceId, tenant.workspaceId), eq(gradingRules.id, id))).limit(1))[0] : null;
    const values = { grade, minPercentageBasisPoints: toBasisPoints(min), maxPercentageBasisPoints: toBasisPoints(max), gradePointBasisPoints: data.gradePoint === undefined ? undefined : toBasisPoints(data.gradePoint), description: typeof data.description === 'string' ? data.description : undefined };
    if (existing) await this.database.db.update(gradingRules).set({ ...values, updatedAt: new Date() }).where(and(eq(gradingRules.workspaceId, tenant.workspaceId), eq(gradingRules.id, id))).catch(databaseError);
    else await this.database.db.insert(gradingRules).values({ id, workspaceId: tenant.workspaceId, ...values }).catch(databaseError);
    return (await this.listGradingRules(tenant)).find((row) => row.id === id) ?? this.notFound('Grading rule');
  }

  async calculateGrade(tenant: Tenant, value: number): Promise<{ grade: string; gradePoint?: number } | null> {
    const scaled = toBasisPoints(value);
    const rules = await this.listGradingRules(tenant);
    return rules.find((rule) => scaled >= toBasisPoints(rule.minPercentage) && scaled <= toBasisPoints(rule.maxPercentage)) ?? null;
  }

  async enterMark(tenant: Tenant, input: JsonRecord) {
    const sourceType = String(input.sourceType ?? 'examination') as typeof markRecords.$inferInsert.sourceType;
    const source = sourceType === 'assessment' ? await this.resolveAssessmentMarkSource(tenant, String(input.sourceId)) : await this.resolveExaminationMarkSource(tenant, String(input.sourceId), typeof input.examinationSubjectId === 'string' ? input.examinationSubjectId : undefined);
    const student = (await this.database.db.select().from(students).where(and(eq(students.workspaceId, tenant.workspaceId), eq(students.id, String(input.studentId)))).limit(1))[0];
    if (!student) throw new ApiError(404, 'NOT_FOUND', 'Student not found for this organization.');
    await this.findActiveEnrollment(tenant.workspaceId, String(input.studentId), source.academicYearName, source.gradeId, source.sectionId);
    assertMarks(source.maximumMarks, input.obtainedMarks, source.passingMarks);
    if (sourceType === 'examination') {
      const exam = await this.getExaminationRow(tenant.workspaceId, String(input.sourceId));
      if (exam.status === 'published') throw new ApiError(400, 'VALIDATION_FAILED', 'Published results cannot be modified silently.');
    }
    const markPercentage = percentage(Number(input.obtainedMarks), source.maximumMarks);
    const grade = await this.calculateGrade(tenant, markPercentage);
    const existing = (await this.database.db.select().from(markRecords).where(and(eq(markRecords.workspaceId, tenant.workspaceId), eq(markRecords.sourceType, sourceType), eq(markRecords.sourceId, String(input.sourceId)), eq(markRecords.studentId, String(input.studentId)), eq(markRecords.subjectId, source.subjectId))).limit(1))[0];
    const id = existing?.id ?? uuid();
    const values = {
      sourceType,
      sourceId: String(input.sourceId),
      examinationSubjectId: typeof input.examinationSubjectId === 'string' ? input.examinationSubjectId : undefined,
      academicYearId: source.academicYearId,
      termId: source.termId,
      gradeId: source.gradeId,
      sectionId: source.sectionId,
      subjectId: source.subjectId,
      studentId: String(input.studentId),
      maximumMarks: source.maximumMarks,
      obtainedMarks: Number(input.obtainedMarks),
      percentageBasisPoints: toBasisPoints(markPercentage),
      grade: grade?.grade,
      gradePointBasisPoints: grade?.gradePoint === undefined ? undefined : toBasisPoints(grade.gradePoint),
      remarks: typeof input.remarks === 'string' ? input.remarks : undefined,
      enteredBy: String(input.enteredBy ?? 'system'),
    };
    if (existing) await this.database.db.update(markRecords).set({ ...values, updatedAt: new Date() }).where(eq(markRecords.id, existing.id)).catch(databaseError);
    else await this.database.db.insert(markRecords).values({ id, workspaceId: tenant.workspaceId, ...values }).catch(databaseError);
    return (await this.listMarks(tenant, { sourceType, sourceId: String(input.sourceId), studentId: String(input.studentId), subjectId: source.subjectId }))[0] ?? this.notFound('Mark');
  }

  async bulkEnterMarks(tenant: Tenant, inputs: JsonRecord[]) {
    const saved = [];
    for (const input of inputs) saved.push(await this.enterMark(tenant, input));
    return saved;
  }

  async listMarks(tenant: Tenant, filters: { sourceType?: string; sourceId?: string; studentId?: string; gradeId?: string; sectionId?: string; subjectId?: string }) {
    const rows = await this.database.db.select().from(markRecords).where(eq(markRecords.workspaceId, tenant.workspaceId));
    return rows.filter((row) => (!filters.sourceType || row.sourceType === filters.sourceType) && (!filters.sourceId || row.sourceId === filters.sourceId) && (!filters.studentId || row.studentId === filters.studentId) && (!filters.gradeId || row.gradeId === filters.gradeId) && (!filters.sectionId || row.sectionId === filters.sectionId) && (!filters.subjectId || row.subjectId === filters.subjectId)).map((row) => this.markDto(tenant, row));
  }

  async calculateClassResults(tenant: Tenant, examinationId: string, gradeId: string, sectionId: string): Promise<StudentResult[]> {
    const examination = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const examSubjects = (await this.listExaminationSubjects(tenant, examinationId)).filter((subject) => subject.gradeId === gradeId && (!subject.sectionId || subject.sectionId === sectionId));
    if (!examSubjects.length) throw new ApiError(400, 'VALIDATION_FAILED', 'No examination subjects configured for this class.');
    const academicYear = await this.getAcademicYearRow(tenant.workspaceId, examination.academicYearId);
    const activeEnrollments = await this.findActiveEnrollments(tenant.workspaceId, academicYear.name, gradeId, sectionId);
    const marks = await this.listMarks(tenant, { sourceType: 'examination', sourceId: examinationId });
    const results: StudentResult[] = [];
    for (const enrollment of activeEnrollments) {
      const subjectResults = [];
      for (const examSubject of examSubjects) {
        const mark = marks.find((item) => item.studentId === enrollment.studentId && item.subjectId === examSubject.subjectId);
        if (!mark) throw new ApiError(400, 'VALIDATION_FAILED', 'Incomplete marks prevent result calculation.');
        subjectResults.push({ subjectId: examSubject.subjectId, maximumMarks: examSubject.maximumMarks, obtainedMarks: mark.obtainedMarks, percentage: mark.percentage, grade: mark.grade, gradePoint: mark.gradePoint, passed: mark.obtainedMarks >= examSubject.passingMarks, remarks: mark.remarks });
      }
      const maximumMarks = subjectResults.reduce((sum, item) => sum + item.maximumMarks, 0);
      const obtainedMarks = subjectResults.reduce((sum, item) => sum + item.obtainedMarks, 0);
      const overallPercentage = percentage(obtainedMarks, maximumMarks);
      const grade = await this.calculateGrade(tenant, overallPercentage);
      results.push({ studentId: enrollment.studentId, maximumMarks, obtainedMarks, percentage: overallPercentage, grade: grade?.grade, gradePoint: grade?.gradePoint, passed: subjectResults.every((item) => item.passed), subjects: subjectResults });
    }
    return results;
  }

  async publishResults(tenant: Tenant, examinationId: string, gradeId: string, sectionId: string, publishedBy = 'system') {
    const examination = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const calculated = await this.calculateClassResults(tenant, examinationId, gradeId, sectionId);
    const existing = (await this.database.db.select().from(resultPublications).where(and(eq(resultPublications.workspaceId, tenant.workspaceId), eq(resultPublications.examinationId, examinationId), eq(resultPublications.gradeId, gradeId), eq(resultPublications.sectionId, sectionId))).limit(1))[0];
    const id = existing?.id ?? uuid();
    const publishedAt = new Date().toISOString();
    await withTransaction(this.database, async ({ tx }) => {
      const values = { examinationId, academicYearId: examination.academicYearId, termId: examination.termId ?? undefined, gradeId, sectionId, status: 'published' as const, results: calculated as unknown as Array<Record<string, unknown>>, publishedAt, publishedBy };
      if (existing) await tx.update(resultPublications).set({ ...values, updatedAt: new Date() }).where(eq(resultPublications.id, id));
      else await tx.insert(resultPublications).values({ id, workspaceId: tenant.workspaceId, ...values });
      await tx.update(examinations).set({ status: 'published', publishedAt, publishedBy, updatedAt: new Date() }).where(and(eq(examinations.workspaceId, tenant.workspaceId), eq(examinations.id, examinationId)));
    });
    return (await this.listResultPublications(tenant, examinationId)).find((row) => row.id === id)!;
  }

  async listResultPublications(tenant: Tenant, examinationId?: string) {
    const condition = examinationId ? and(eq(resultPublications.workspaceId, tenant.workspaceId), eq(resultPublications.examinationId, examinationId)) : eq(resultPublications.workspaceId, tenant.workspaceId);
    const rows = await this.database.db.select().from(resultPublications).where(condition);
    return rows.map((row) => this.resultPublicationDto(tenant, row));
  }

  async getStudentResult(tenant: Tenant, examinationId: string, studentId: string) {
    const publications = await this.listResultPublications(tenant, examinationId);
    for (const publication of publications) {
      const result = publication.results.find((item) => item.studentId === studentId);
      if (result) return result;
    }
    return null;
  }

  async getSubjectPerformance(tenant: Tenant, examinationId: string, gradeId: string, sectionId: string, subjectId: string) {
    const results = await this.calculateClassResults(tenant, examinationId, gradeId, sectionId);
    const subjectResults = results.map((result) => result.subjects.find((subject) => subject.subjectId === subjectId)).filter((result): result is NonNullable<typeof result> => Boolean(result));
    if (!subjectResults.length) return null;
    const scores = subjectResults.map((result) => result.obtainedMarks);
    const gradeDistribution: Record<string, number> = {};
    for (const result of subjectResults) gradeDistribution[result.grade || 'Ungraded'] = (gradeDistribution[result.grade || 'Ungraded'] || 0) + 1;
    return { subjectId, maximumMarks: subjectResults[0].maximumMarks, average: Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100, highest: Math.max(...scores), lowest: Math.min(...scores), passRate: Math.round((subjectResults.filter((result) => result.passed).length / subjectResults.length) * 10000) / 100, gradeDistribution };
  }

  private async getExaminationRow(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(examinations).where(and(eq(examinations.workspaceId, workspaceId), eq(examinations.id, id))).limit(1);
    return rows[0] ?? this.notFound('Examination');
  }

  private async getAcademicYearRow(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(academicYears).where(and(eq(academicYears.workspaceId, workspaceId), eq(academicYears.id, id))).limit(1);
    return rows[0] ?? this.notFound('Academic year');
  }

  private async assertDateOrder(start: unknown, end: unknown) {
    if (typeof start === 'string' && typeof end === 'string' && new Date(start) > new Date(end)) throw new ApiError(400, 'VALIDATION_FAILED', 'Examination start date must be before end date.');
  }

  private async assertAcademicYear(workspaceId: string, id: string) {
    await this.getAcademicYearRow(workspaceId, id);
  }

  private async assertTermInAcademicYear(workspaceId: string, termId: string, academicYearId: string) {
    const rows = await this.database.db.select().from(academicTerms).where(and(eq(academicTerms.workspaceId, workspaceId), eq(academicTerms.id, termId), eq(academicTerms.academicYearId, academicYearId))).limit(1);
    if (!rows.length) throw new ApiError(400, 'VALIDATION_FAILED', 'Term not found for selected academic year.');
  }

  private async assertGrade(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(gradeLevels).where(and(eq(gradeLevels.workspaceId, workspaceId), eq(gradeLevels.id, id))).limit(1);
    if (!rows.length) this.notFound('Grade');
  }

  private async assertSectionInGrade(workspaceId: string, sectionId: string, gradeId: string) {
    const rows = await this.database.db.select().from(sections).where(and(eq(sections.workspaceId, workspaceId), eq(sections.id, sectionId), eq(sections.gradeId, gradeId))).limit(1);
    if (!rows.length) throw new ApiError(400, 'VALIDATION_FAILED', 'Section does not belong to the selected grade.');
  }

  private async assertSubject(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(subjects).where(and(eq(subjects.workspaceId, workspaceId), eq(subjects.id, id))).limit(1);
    if (!rows.length) this.notFound('Subject');
  }

  private async findActiveEnrollment(workspaceId: string, studentId: string, academicYear: string, gradeId: string, sectionId: string) {
    const rows = await this.database.db.select().from(enrollments).where(and(eq(enrollments.workspaceId, workspaceId), eq(enrollments.studentId, studentId), eq(enrollments.academicYear, academicYear), eq(enrollments.gradeId, gradeId), eq(enrollments.sectionId, sectionId), eq(enrollments.status, 'active'))).limit(1);
    if (!rows.length) throw new ApiError(400, 'VALIDATION_FAILED', 'Student is not actively enrolled in the selected academic context.');
    return rows[0];
  }

  private async findActiveEnrollments(workspaceId: string, academicYear: string, gradeId: string, sectionId: string) {
    return this.database.db.select().from(enrollments).where(and(eq(enrollments.workspaceId, workspaceId), eq(enrollments.academicYear, academicYear), eq(enrollments.gradeId, gradeId), eq(enrollments.sectionId, sectionId), eq(enrollments.status, 'active')));
  }

  private async resolveExaminationMarkSource(tenant: Tenant, examinationId: string, examinationSubjectId?: string) {
    const examination = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const condition = examinationSubjectId ? and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.examinationId, examinationId), eq(examinationSubjects.id, examinationSubjectId)) : and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.examinationId, examinationId));
    const examSubject = (await this.database.db.select().from(examinationSubjects).where(condition).limit(1))[0];
    if (!examSubject) this.notFound('Examination subject');
    const academicYear = await this.getAcademicYearRow(tenant.workspaceId, examination.academicYearId);
    return { academicYearId: examination.academicYearId, academicYearName: academicYear.name, termId: examination.termId ?? undefined, gradeId: examSubject.gradeId, sectionId: examSubject.sectionId ?? '', subjectId: examSubject.subjectId, maximumMarks: examSubject.maximumMarks, passingMarks: examSubject.passingMarks };
  }

  private async resolveAssessmentMarkSource(tenant: Tenant, assessmentId: string) {
    const assessment = (await this.database.db.select().from(assessments).where(and(eq(assessments.workspaceId, tenant.workspaceId), eq(assessments.id, assessmentId))).limit(1))[0];
    if (!assessment) this.notFound('Assessment');
    const academicYear = await this.getAcademicYearRow(tenant.workspaceId, assessment.academicYearId);
    return { academicYearId: assessment.academicYearId, academicYearName: academicYear.name, termId: assessment.termId ?? undefined, gradeId: assessment.gradeId, sectionId: assessment.sectionId, subjectId: assessment.subjectId, maximumMarks: assessment.maximumMarks, passingMarks: assessment.passingMarks };
  }

  private examinationDto(tenant: Tenant, row: typeof examinations.$inferSelect) {
    return { ...row, organizationId: tenant.organizationId, termId: row.termId ?? undefined, description: row.description ?? undefined, publishedAt: row.publishedAt ?? undefined, publishedBy: row.publishedBy ?? undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private examinationSubjectDto(tenant: Tenant, row: typeof examinationSubjects.$inferSelect) {
    return { ...row, organizationId: tenant.organizationId, sectionId: row.sectionId ?? undefined, weightage: row.weightage ?? undefined, examDate: row.examDate ?? undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private assessmentDto(tenant: Tenant, row: typeof assessments.$inferSelect) {
    return { ...row, organizationId: tenant.organizationId, termId: row.termId ?? undefined, weightage: row.weightage ?? undefined, description: row.description ?? undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private gradingRuleDto(tenant: Tenant, row: typeof gradingRules.$inferSelect) {
    return { id: row.id, organizationId: tenant.organizationId, grade: row.grade, minPercentage: fromBasisPoints(row.minPercentageBasisPoints) ?? 0, maxPercentage: fromBasisPoints(row.maxPercentageBasisPoints) ?? 0, gradePoint: fromBasisPoints(row.gradePointBasisPoints), description: row.description ?? undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private markDto(tenant: Tenant, row: typeof markRecords.$inferSelect) {
    return { ...row, organizationId: tenant.organizationId, examinationSubjectId: row.examinationSubjectId ?? undefined, termId: row.termId ?? undefined, percentage: fromBasisPoints(row.percentageBasisPoints) ?? 0, grade: row.grade ?? undefined, gradePoint: fromBasisPoints(row.gradePointBasisPoints), remarks: row.remarks ?? undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private resultPublicationDto(tenant: Tenant, row: typeof resultPublications.$inferSelect) {
    const results = typeof row.results === 'string' ? JSON.parse(row.results) as StudentResult[] : row.results as StudentResult[];
    return { ...row, organizationId: tenant.organizationId, termId: row.termId ?? undefined, results, publishedAt: row.publishedAt ?? undefined, publishedBy: row.publishedBy ?? undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private notFound(label: string): never {
    throw new ApiError(404, 'NOT_FOUND', label + ' not found.');
  }
}


