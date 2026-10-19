import { and, desc, eq, or } from 'drizzle-orm';
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
  organizations,
  portalUpdateRequests,
  resultPublications,
  sections,
  staffMembers,
  students,
  subjects,
  teachingAssignments,
} from '../../database/schema.js';

type JsonRecord = Record<string, unknown>;
type Tenant = { organizationId: string; workspaceId: string };
export type StudentResult = {
  studentId: string;
  studentName?: string;
  admissionNumber?: string;
  maximumMarks: number;
  obtainedMarks: number;
  percentage: number;
  grade?: string;
  gradePoint?: number;
  passed: boolean;
  position?: number;
  rankLabel?: string;
  totalStudents?: number;
  remarks?: string;
  subjects: Array<{
    subjectId: string;
    subjectName?: string;
    maximumMarks: number;
    obtainedMarks: number;
    percentage: number;
    grade?: string;
    gradePoint?: number;
    passed: boolean;
    remarks?: string;
    isAbsent?: boolean;
    isExempt?: boolean;
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

function payloadOf(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function databaseError(error: unknown): never {
  const mapped = mapDatabaseError(error);
  if (mapped.code === 'DATABASE_UNIQUE_CONSTRAINT') {
    throw new ApiError(409, 'DATABASE_UNIQUE_CONSTRAINT', 'A SIS examination record with the same unique scope already exists.');
  }
  if (mapped.code === 'DATABASE_FOREIGN_KEY_CONSTRAINT') {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Referenced educational entity was not found or has an invalid relationship.');
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

  async archiveExamination(tenant: Tenant, id: string) {
    await this.getExaminationRow(tenant.workspaceId, id);
    await this.database.db.update(examinations).set({ status: 'archived', updatedAt: new Date() }).where(and(eq(examinations.id, id), eq(examinations.workspaceId, tenant.workspaceId)));
    return (await this.listExaminations(tenant)).find((row) => row.id === id)!;
  }

  async deleteExamination(tenant: Tenant, id: string) {
    const current = await this.getExaminationRow(tenant.workspaceId, id);
    if (current.status === 'published') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Published examinations cannot be deleted. Archive the examination instead.');
    }
    const marks = await this.database.db.select().from(markRecords).where(and(eq(markRecords.workspaceId, tenant.workspaceId), eq(markRecords.sourceType, 'examination'), eq(markRecords.sourceId, id))).limit(1);
    if (marks.length > 0) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Examination has associated marks records and cannot be deleted. Archive instead.');
    }
    await this.database.db.delete(examinationSubjects).where(and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.examinationId, id)));
    await this.database.db.delete(examinations).where(and(eq(examinations.workspaceId, tenant.workspaceId), eq(examinations.id, id)));
    return { success: true, id };
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

  async updateExaminationSubject(tenant: Tenant, id: string, data: JsonRecord) {
    const subjectRow = (await this.database.db.select().from(examinationSubjects).where(and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.id, id))).limit(1))[0];
    if (!subjectRow) this.notFound('Examination subject');
    const exam = await this.getExaminationRow(tenant.workspaceId, subjectRow.examinationId);
    if (exam.status === 'published') throw new ApiError(400, 'VALIDATION_FAILED', 'Published examinations cannot be modified silently.');
    if (data.maximumMarks !== undefined || data.passingMarks !== undefined) {
      assertMarks(data.maximumMarks ?? subjectRow.maximumMarks, undefined, data.passingMarks ?? subjectRow.passingMarks);
    }
    const updates = { ...data };
    delete updates.id;
    delete updates.organizationId;
    delete updates.examinationId;
    delete updates.createdAt;
    delete updates.updatedAt;
    await this.database.db.update(examinationSubjects).set({ ...clean(updates), updatedAt: new Date() }).where(and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.id, id))).catch(databaseError);
    return (await this.listExaminationSubjects(tenant, subjectRow.examinationId)).find((row) => row.id === id) ?? this.notFound('Examination subject');
  }

  async deleteExaminationSubject(tenant: Tenant, id: string) {
    const subjectRow = (await this.database.db.select().from(examinationSubjects).where(and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.id, id))).limit(1))[0];
    if (!subjectRow) this.notFound('Examination subject');
    const exam = await this.getExaminationRow(tenant.workspaceId, subjectRow.examinationId);
    if (exam.status === 'published') throw new ApiError(400, 'VALIDATION_FAILED', 'Published examinations cannot be modified silently.');
    const marks = await this.database.db.select().from(markRecords).where(and(eq(markRecords.workspaceId, tenant.workspaceId), eq(markRecords.examinationSubjectId, id))).limit(1);
    if (marks.length > 0) throw new ApiError(400, 'VALIDATION_FAILED', 'Subject has associated mark records and cannot be deleted.');
    await this.database.db.delete(examinationSubjects).where(and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.id, id)));
    return { success: true, id };
  }

  async listAssessments(tenant: Tenant) {
    const rows = await this.database.db.select().from(assessments).where(eq(assessments.workspaceId, tenant.workspaceId)).orderBy(desc(assessments.assessmentDate));
    return rows.map((row) => this.assessmentDto(tenant, row));
  }

  async getAssessment(tenant: Tenant, id: string) {
    const row = await this.getAssessmentRow(tenant.workspaceId, id);
    return this.assessmentDto(tenant, row);
  }

  async createAssessment(tenant: Tenant, data: JsonRecord) {
    const title = String(data.title ?? '').trim();
    if (!title) throw new ApiError(400, 'VALIDATION_FAILED', 'Assessment title is required.');
    assertMarks(data.maximumMarks, undefined, data.passingMarks);
    await Promise.all([
      this.assertAcademicYear(tenant.workspaceId, String(data.academicYearId)),
      this.assertGrade(tenant.workspaceId, String(data.gradeId)),
      this.assertSectionInGrade(tenant.workspaceId, String(data.sectionId), String(data.gradeId)),
      this.assertSubject(tenant.workspaceId, String(data.subjectId)),
    ]);
    if (data.termId) await this.assertTermInAcademicYear(tenant.workspaceId, String(data.termId), String(data.academicYearId));

    let resolvedTeacherId = typeof data.teacherId === 'string' && data.teacherId.trim() ? data.teacherId.trim() : undefined;
    if (resolvedTeacherId) {
      const teacher = (await this.database.db.select().from(staffMembers).where(and(eq(staffMembers.workspaceId, tenant.workspaceId), eq(staffMembers.id, resolvedTeacherId))).limit(1))[0];
      if (!teacher || teacher.staffType !== 'teacher') throw new ApiError(404, 'NOT_FOUND', 'Teacher not found for this organization.');
    } else {
      const assignment = (await this.database.db.select().from(teachingAssignments).where(and(eq(teachingAssignments.workspaceId, tenant.workspaceId), eq(teachingAssignments.subjectId, String(data.subjectId)), eq(teachingAssignments.gradeId, String(data.gradeId)), eq(teachingAssignments.isActive, true))).limit(1))[0];
      if (assignment) {
        resolvedTeacherId = assignment.staffId;
      } else {
        const anyTeacher = (await this.database.db.select().from(staffMembers).where(and(eq(staffMembers.workspaceId, tenant.workspaceId), eq(staffMembers.staffType, 'teacher'), eq(staffMembers.status, 'active'))).limit(1))[0];
        if (anyTeacher) {
          resolvedTeacherId = anyTeacher.id;
        } else {
          throw new ApiError(404, 'NOT_FOUND', 'Teacher not found for this organization.');
        }
      }
    }

    const assessmentDate = String(data.assessmentDate ?? '');
    if (!assessmentDate) throw new ApiError(400, 'VALIDATION_FAILED', 'Assessment date is required.');

    const duplicate = (await this.database.db.select().from(assessments).where(
      and(
        eq(assessments.workspaceId, tenant.workspaceId),
        eq(assessments.academicYearId, String(data.academicYearId)),
        eq(assessments.gradeId, String(data.gradeId)),
        eq(assessments.sectionId, String(data.sectionId)),
        eq(assessments.subjectId, String(data.subjectId)),
        eq(assessments.title, title),
        eq(assessments.assessmentDate, assessmentDate)
      )
    ).limit(1))[0];
    if (duplicate) {
      throw new ApiError(409, 'DATABASE_UNIQUE_CONSTRAINT', `An assessment with title "${title}" already exists for this class, section, subject, and date.`);
    }

    const id = uuid();
    await this.database.db.insert(assessments).values({
      id,
      workspaceId: tenant.workspaceId,
      title,
      academicYearId: String(data.academicYearId),
      termId: typeof data.termId === 'string' && data.termId ? data.termId : undefined,
      gradeId: String(data.gradeId),
      sectionId: String(data.sectionId),
      subjectId: String(data.subjectId),
      teacherId: resolvedTeacherId,
      type: String(data.type ?? 'class_test') as typeof assessments.$inferInsert.type,
      maximumMarks: Number(data.maximumMarks),
      passingMarks: Number(data.passingMarks),
      weightage: data.weightage === undefined ? undefined : Number(data.weightage),
      assessmentDate,
      status: String(data.status ?? 'draft') as typeof assessments.$inferInsert.status,
      description: typeof data.description === 'string' ? data.description : undefined,
    }).catch(databaseError);

    return this.getAssessment(tenant, id);
  }

  async updateAssessment(tenant: Tenant, id: string, data: JsonRecord) {
    const current = await this.getAssessmentRow(tenant.workspaceId, id);
    const existingMarks = await this.database.db.select().from(markRecords).where(
      and(
        eq(markRecords.workspaceId, tenant.workspaceId),
        eq(markRecords.sourceType, 'assessment'),
        eq(markRecords.sourceId, id)
      )
    );

    if (existingMarks.length > 0) {
      if (data.academicYearId && data.academicYearId !== current.academicYearId) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot change academic session for an assessment that already has recorded marks.');
      }
      if (data.gradeId && data.gradeId !== current.gradeId) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot change grade for an assessment that already has recorded marks.');
      }
      if (data.sectionId && data.sectionId !== current.sectionId) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot change section for an assessment that already has recorded marks.');
      }
      if (data.subjectId && data.subjectId !== current.subjectId) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot change subject for an assessment that already has recorded marks.');
      }
      if (data.maximumMarks !== undefined) {
        const newMax = Number(data.maximumMarks);
        const highestMark = Math.max(...existingMarks.map((m) => m.obtainedMarks));
        if (newMax < highestMark) {
          throw new ApiError(400, 'VALIDATION_FAILED', `Maximum marks (${newMax}) cannot be reduced below the highest recorded student mark (${highestMark}).`);
        }
      }
    }

    if (data.maximumMarks !== undefined || data.passingMarks !== undefined) {
      assertMarks(data.maximumMarks ?? current.maximumMarks, undefined, data.passingMarks ?? current.passingMarks);
    }
    if (data.academicYearId) await this.assertAcademicYear(tenant.workspaceId, String(data.academicYearId));
    if (data.gradeId) await this.assertGrade(tenant.workspaceId, String(data.gradeId));
    if (data.sectionId) await this.assertSectionInGrade(tenant.workspaceId, String(data.sectionId), String(data.gradeId ?? current.gradeId));
    if (data.subjectId) await this.assertSubject(tenant.workspaceId, String(data.subjectId));
    if (data.termId) await this.assertTermInAcademicYear(tenant.workspaceId, String(data.termId), String(data.academicYearId ?? current.academicYearId));
    if (data.teacherId) {
      const teacher = (await this.database.db.select().from(staffMembers).where(and(eq(staffMembers.workspaceId, tenant.workspaceId), eq(staffMembers.id, String(data.teacherId)))).limit(1))[0];
      if (!teacher || teacher.staffType !== 'teacher') throw new ApiError(404, 'NOT_FOUND', 'Teacher not found for this organization.');
    }

    const updates = { ...data };
    delete updates.id;
    delete updates.organizationId;
    delete updates.workspaceId;
    delete updates.createdAt;
    delete updates.updatedAt;
    if (typeof updates.title === 'string') updates.title = updates.title.trim();

    await this.database.db.update(assessments).set({
      ...clean(updates),
      updatedAt: new Date(),
    } as Partial<typeof assessments.$inferInsert>).where(
      and(eq(assessments.id, id), eq(assessments.workspaceId, tenant.workspaceId))
    ).catch(databaseError);

    return this.getAssessment(tenant, id);
  }

  async deleteAssessment(tenant: Tenant, id: string) {
    await this.getAssessmentRow(tenant.workspaceId, id);
    const marks = await this.database.db.select().from(markRecords).where(
      and(
        eq(markRecords.workspaceId, tenant.workspaceId),
        eq(markRecords.sourceType, 'assessment'),
        eq(markRecords.sourceId, id)
      )
    ).limit(1);
    if (marks.length > 0) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Assessment has associated mark records and cannot be deleted. Remove the marks first or archive the assessment.');
    }
    await this.database.db.delete(assessments).where(
      and(eq(assessments.workspaceId, tenant.workspaceId), eq(assessments.id, id))
    );
    return { success: true, id };
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

    const targetSectionFilter = (source.sectionId && source.sectionId.trim())
      ? source.sectionId.trim()
      : (typeof input.sectionId === 'string' && input.sectionId.trim())
        ? input.sectionId.trim()
        : undefined;

    const enrollment = await this.findActiveEnrollment(tenant.workspaceId, String(input.studentId), source.academicYearName, source.academicYearId, source.gradeId, targetSectionFilter);
    const resolvedSectionId = (source.sectionId && source.sectionId.trim())
      ? source.sectionId.trim()
      : enrollment.sectionId;

    if (!resolvedSectionId) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Could not resolve an active section enrollment for student.');
    }
    
    if (sourceType === 'examination') {
      const exam = await this.getExaminationRow(tenant.workspaceId, String(input.sourceId));
      if (exam.status === 'published') throw new ApiError(400, 'VALIDATION_FAILED', 'Published results cannot be modified silently. Submit a formal correction request.');
    }

    const isAbsent = Boolean(input.isAbsent === true || input.status === 'absent');
    const isExempt = Boolean(input.isExempt === true || input.status === 'exempt');

    let obtainedMarks = 0;
    let markPercentage = 0;
    let gradeLabel: string | undefined;
    let gradePointVal: number | undefined;
    let finalRemarks = typeof input.remarks === 'string' ? input.remarks : undefined;

    if (isAbsent) {
      obtainedMarks = 0;
      markPercentage = 0;
      gradeLabel = 'ABS';
      gradePointVal = 0;
      finalRemarks = `[ABSENT]${finalRemarks ? ' ' + finalRemarks : ''}`;
    } else if (isExempt) {
      obtainedMarks = 0;
      markPercentage = 0;
      gradeLabel = 'EXM';
      gradePointVal = 0;
      finalRemarks = `[EXEMPT]${finalRemarks ? ' ' + finalRemarks : ''}`;
    } else {
      assertMarks(source.maximumMarks, input.obtainedMarks, source.passingMarks);
      obtainedMarks = Number(input.obtainedMarks);
      markPercentage = percentage(obtainedMarks, source.maximumMarks);
      const grade = await this.calculateGrade(tenant, markPercentage);
      gradeLabel = grade?.grade;
      gradePointVal = grade?.gradePoint;
    }

    const existing = (await this.database.db.select().from(markRecords).where(and(eq(markRecords.workspaceId, tenant.workspaceId), eq(markRecords.sourceType, sourceType), eq(markRecords.sourceId, String(input.sourceId)), eq(markRecords.studentId, String(input.studentId)), eq(markRecords.subjectId, source.subjectId))).limit(1))[0];
    const id = existing?.id ?? uuid();
    const values = {
      sourceType,
      sourceId: String(input.sourceId),
      examinationSubjectId: typeof input.examinationSubjectId === 'string' ? input.examinationSubjectId : undefined,
      academicYearId: source.academicYearId,
      termId: source.termId,
      gradeId: source.gradeId,
      sectionId: resolvedSectionId,
      subjectId: source.subjectId,
      studentId: String(input.studentId),
      maximumMarks: source.maximumMarks,
      obtainedMarks,
      percentageBasisPoints: toBasisPoints(markPercentage),
      grade: gradeLabel,
      gradePointBasisPoints: gradePointVal === undefined ? undefined : toBasisPoints(gradePointVal),
      remarks: finalRemarks,
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
    const activeEnrollments = await this.findActiveEnrollments(tenant.workspaceId, academicYear.name, examination.academicYearId, gradeId, sectionId);
    const marks = await this.listMarks(tenant, { sourceType: 'examination', sourceId: examinationId });
    const studentRows = await this.database.db.select().from(students).where(eq(students.workspaceId, tenant.workspaceId));
    const subjectRows = await this.database.db.select().from(subjects).where(eq(subjects.workspaceId, tenant.workspaceId));
    const results: StudentResult[] = [];

    for (const enrollment of activeEnrollments) {
      const student = studentRows.find((s) => s.id === enrollment.studentId);
      const studentName = student ? `${student.firstName} ${student.lastName}`.trim() : 'Learner';
      const subjectResults = [];
      for (const examSubject of examSubjects) {
        const mark = marks.find((item) => item.studentId === enrollment.studentId && item.subjectId === examSubject.subjectId);
        if (!mark) throw new ApiError(400, 'VALIDATION_FAILED', 'Incomplete marks prevent result calculation.');
        const sub = subjectRows.find((s) => s.id === examSubject.subjectId);
        const isAbsent = Boolean(mark.remarks?.startsWith('[ABSENT]') || mark.grade === 'ABS');
        const isExempt = Boolean(mark.remarks?.startsWith('[EXEMPT]') || mark.grade === 'EXM');
        const passed = isAbsent ? false : isExempt ? true : mark.obtainedMarks >= examSubject.passingMarks;
        subjectResults.push({
          subjectId: examSubject.subjectId,
          subjectName: sub?.name,
          maximumMarks: examSubject.maximumMarks,
          obtainedMarks: mark.obtainedMarks,
          percentage: mark.percentage,
          grade: mark.grade,
          gradePoint: mark.gradePoint,
          passed,
          remarks: mark.remarks,
          isAbsent,
          isExempt,
        });
      }
      const nonExempt = subjectResults.filter((s) => !s.isExempt);
      const maximumMarks = nonExempt.reduce((sum, item) => sum + item.maximumMarks, 0);
      const obtainedMarks = nonExempt.reduce((sum, item) => sum + item.obtainedMarks, 0);
      const overallPercentage = maximumMarks > 0 ? percentage(obtainedMarks, maximumMarks) : 100;
      const grade = await this.calculateGrade(tenant, overallPercentage);
      const allPassed = subjectResults.every((item) => item.passed);
      results.push({
        studentId: enrollment.studentId,
        studentName,
        admissionNumber: student?.admissionNumber,
        maximumMarks,
        obtainedMarks,
        percentage: overallPercentage,
        grade: grade?.grade,
        gradePoint: grade?.gradePoint,
        passed: allPassed,
        subjects: subjectResults,
      });
    }

    // Rank / Position Calculation
    results.sort((a, b) => b.percentage - a.percentage);
    const totalStudents = results.length;
    results.forEach((res, idx) => {
      res.position = idx + 1;
      res.rankLabel = ordinal(idx + 1);
      res.totalStudents = totalStudents;
    });

    return results;
  }

  async submitForReview(tenant: Tenant, examinationId: string, gradeId: string, sectionId: string, submitter: { userId: string; role?: string }) {
    const examination = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const existing = (await this.database.db.select().from(resultPublications).where(and(eq(resultPublications.workspaceId, tenant.workspaceId), eq(resultPublications.examinationId, examinationId), eq(resultPublications.gradeId, gradeId), eq(resultPublications.sectionId, sectionId))).limit(1))[0];
    if (existing?.status === 'published') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Published results cannot be resubmitted. Use correction workflow.');
    }
    const calculated = await this.calculateClassResults(tenant, examinationId, gradeId, sectionId);
    const id = existing?.id ?? uuid();
    const values = {
      examinationId,
      academicYearId: examination.academicYearId,
      termId: examination.termId ?? undefined,
      gradeId,
      sectionId,
      status: 'in_progress' as const,
      results: calculated as unknown as Array<Record<string, unknown>>,
      publishedBy: submitter.userId,
    };
    if (existing) {
      await this.database.db.update(resultPublications).set({ ...values, updatedAt: new Date() }).where(eq(resultPublications.id, id));
    } else {
      await this.database.db.insert(resultPublications).values({ id, workspaceId: tenant.workspaceId, ...values });
    }
    return (await this.listResultPublications(tenant, examinationId)).find((row) => row.id === id)!;
  }

  async reviewResults(
    tenant: Tenant,
    examinationId: string,
    gradeId: string,
    sectionId: string,
    reviewer: { userId: string; role?: string },
    decision: 'approved' | 'rejected',
    comments?: string
  ) {
    void comments;
    const pub = (await this.database.db.select().from(resultPublications).where(and(eq(resultPublications.workspaceId, tenant.workspaceId), eq(resultPublications.examinationId, examinationId), eq(resultPublications.gradeId, gradeId), eq(resultPublications.sectionId, sectionId))).limit(1))[0];
    if (!pub) throw new ApiError(404, 'NOT_FOUND', 'Result publication record not found.');
    if (pub.status !== 'in_progress') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Only results currently submitted and under review can be reviewed.');
    }
    if (pub.publishedBy === reviewer.userId && !['Admin', 'Owner'].includes(reviewer.role ?? '')) {
      throw new ApiError(403, 'FORBIDDEN', 'Separation of duties: Reviewer cannot be the same as the submitter.');
    }
    if (decision === 'approved') {
      await this.database.db.update(resultPublications).set({
        status: 'completed' as const,
        updatedAt: new Date(),
      }).where(eq(resultPublications.id, pub.id));
    } else {
      await this.database.db.update(resultPublications).set({
        status: 'draft' as const,
        updatedAt: new Date(),
      }).where(eq(resultPublications.id, pub.id));
    }
    return (await this.listResultPublications(tenant, examinationId)).find((row) => row.id === pub.id)!;
  }

  async publishResults(tenant: Tenant, examinationId: string, gradeId: string, sectionId: string, publishedBy = 'system') {
    const examination = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const existing = (await this.database.db.select().from(resultPublications).where(and(eq(resultPublications.workspaceId, tenant.workspaceId), eq(resultPublications.examinationId, examinationId), eq(resultPublications.gradeId, gradeId), eq(resultPublications.sectionId, sectionId))).limit(1))[0];
    
    // Idempotency: if already published, return existing
    if (existing && existing.status === 'published') {
      return (await this.listResultPublications(tenant, examinationId)).find((row) => row.id === existing.id)!;
    }

    // Require results to be approved (status: 'completed') unless publishedBy is system or direct admin publish
    if (existing && existing.status !== 'completed' && existing.status !== 'draft') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Results must be approved before publication.');
    }

    const calculated = await this.calculateClassResults(tenant, examinationId, gradeId, sectionId);
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

  // Published Result Corrections Workflow
  async requestResultCorrection(
    tenant: Tenant,
    input: {
      examinationId: string;
      gradeId: string;
      sectionId: string;
      studentId: string;
      subjectId: string;
      newMarks: number;
      reason: string;
      requestedBy: string;
    }
  ) {
    if (!input.reason?.trim()) throw new ApiError(400, 'VALIDATION_FAILED', 'Correction reason is required.');
    const pub = (await this.database.db.select().from(resultPublications).where(and(eq(resultPublications.workspaceId, tenant.workspaceId), eq(resultPublications.examinationId, input.examinationId), eq(resultPublications.gradeId, input.gradeId), eq(resultPublications.sectionId, input.sectionId))).limit(1))[0];
    if (!pub || pub.status !== 'published') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Corrections can only be requested for published results.');
    }
    const currentMark = (await this.database.db.select().from(markRecords).where(and(eq(markRecords.workspaceId, tenant.workspaceId), eq(markRecords.sourceType, 'examination'), eq(markRecords.sourceId, input.examinationId), eq(markRecords.studentId, input.studentId), eq(markRecords.subjectId, input.subjectId))).limit(1))[0];
    if (!currentMark) throw new ApiError(404, 'NOT_FOUND', 'Mark record not found for this student and subject.');
    assertMarks(currentMark.maximumMarks, input.newMarks);

    const id = uuid();
    const payload = {
      examinationId: input.examinationId,
      gradeId: input.gradeId,
      sectionId: input.sectionId,
      studentId: input.studentId,
      subjectId: input.subjectId,
      oldMarks: currentMark.obtainedMarks,
      newMarks: Number(input.newMarks),
      reason: input.reason.trim(),
      requestedBy: input.requestedBy,
      requestedAt: new Date().toISOString(),
    };

    await this.database.db.insert(portalUpdateRequests).values({
      id,
      workspaceId: tenant.workspaceId,
      requesterUserId: input.requestedBy,
      requesterRole: 'staff',
      studentId: input.studentId,
      requestType: 'result_correction',
      status: 'pending',
      payload,
    }).catch(databaseError);

    return { id, status: 'pending', ...payload };
  }

  async listResultCorrections(tenant: Tenant, examinationId?: string) {
    const rows = await this.database.db.select().from(portalUpdateRequests).where(and(eq(portalUpdateRequests.workspaceId, tenant.workspaceId), eq(portalUpdateRequests.requestType, 'result_correction'))).orderBy(desc(portalUpdateRequests.createdAt));
    return rows.map((r) => {
      const payload = payloadOf(r.payload);
      return {
        id: r.id,
        status: r.status,
        createdAt: iso(r.createdAt),
        updatedAt: iso(r.updatedAt),
        ...payload,
      };
    }).filter((r) => !examinationId || (r as Record<string, unknown>).examinationId === examinationId);
  }

  async reviewResultCorrection(
    tenant: Tenant,
    correctionId: string,
    reviewer: { userId: string; role?: string },
    decision: 'approved' | 'rejected',
    reviewerComments?: string
  ) {
    const rows = await this.database.db.select().from(portalUpdateRequests).where(and(eq(portalUpdateRequests.workspaceId, tenant.workspaceId), eq(portalUpdateRequests.id, correctionId), eq(portalUpdateRequests.requestType, 'result_correction'))).limit(1);
    const req = rows[0];
    if (!req) throw new ApiError(404, 'NOT_FOUND', 'Correction request not found.');
    if (req.status !== 'pending') throw new ApiError(400, 'VALIDATION_FAILED', 'Correction request has already been processed.');

    const payload = payloadOf(req.payload);
    const now = new Date().toISOString();

    if (decision === 'rejected') {
      const updatedPayload = { ...payload, reviewerComments, reviewedBy: reviewer.userId, reviewedAt: now };
      await this.database.db.update(portalUpdateRequests).set({
        status: 'rejected',
        payload: updatedPayload,
        updatedAt: new Date(),
      }).where(eq(portalUpdateRequests.id, req.id));
      return { id: req.id, status: 'rejected', ...updatedPayload };
    }

    const studentId = String(payload.studentId);
    const subjectId = String(payload.subjectId);
    const examinationId = String(payload.examinationId);
    const gradeId = String(payload.gradeId);
    const sectionId = String(payload.sectionId);
    const newMarks = Number(payload.newMarks);

    const markRow = (await this.database.db.select().from(markRecords).where(and(eq(markRecords.workspaceId, tenant.workspaceId), eq(markRecords.sourceType, 'examination'), eq(markRecords.sourceId, examinationId), eq(markRecords.studentId, studentId), eq(markRecords.subjectId, subjectId))).limit(1))[0];
    if (markRow) {
      const grade = await this.calculateGrade(tenant, percentage(newMarks, markRow.maximumMarks));
      await this.database.db.update(markRecords).set({
        obtainedMarks: newMarks,
        percentageBasisPoints: toBasisPoints(percentage(newMarks, markRow.maximumMarks)),
        grade: grade?.grade,
        gradePointBasisPoints: grade?.gradePoint ? toBasisPoints(grade.gradePoint) : undefined,
        remarks: `[REVISED] ${String(payload.reason ?? '')}`,
        updatedAt: new Date(),
      }).where(eq(markRecords.id, markRow.id));
    }

    const recalculated = await this.calculateClassResults(tenant, examinationId, gradeId, sectionId);
    await this.database.db.update(resultPublications).set({
      results: recalculated as unknown as Array<Record<string, unknown>>,
      publishedAt: now,
      publishedBy: reviewer.userId,
      updatedAt: new Date(),
    }).where(and(eq(resultPublications.workspaceId, tenant.workspaceId), eq(resultPublications.examinationId, examinationId), eq(resultPublications.gradeId, gradeId), eq(resultPublications.sectionId, sectionId)));

    const updatedPayload = { ...payload, reviewerComments, reviewedBy: reviewer.userId, reviewedAt: now, revisedAt: now };
    await this.database.db.update(portalUpdateRequests).set({
      status: 'approved',
      payload: updatedPayload,
      updatedAt: new Date(),
    }).where(eq(portalUpdateRequests.id, req.id));

    return { id: req.id, status: 'approved', ...updatedPayload };
  }

  // Printable Result Cards
  async getResultCard(tenant: Tenant, examinationId: string, studentId: string): Promise<Record<string, unknown>> {
    const org = (await this.database.db.select().from(organizations).where(eq(organizations.id, tenant.organizationId)).limit(1))[0];
    const exam = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const academicYear = await this.getAcademicYearRow(tenant.workspaceId, exam.academicYearId);
    const student = (await this.database.db.select().from(students).where(and(eq(students.workspaceId, tenant.workspaceId), eq(students.id, studentId))).limit(1))[0];
    if (!student) throw new ApiError(404, 'NOT_FOUND', 'Student not found.');

    const enrollmentsList = await this.database.db.select().from(enrollments).where(and(eq(enrollments.workspaceId, tenant.workspaceId), eq(enrollments.studentId, studentId), eq(enrollments.status, 'active'))).limit(1);
    const enrollment = enrollmentsList[0];
    const grade = enrollment ? (await this.database.db.select().from(gradeLevels).where(and(eq(gradeLevels.workspaceId, tenant.workspaceId), eq(gradeLevels.id, enrollment.gradeId))).limit(1))[0] : null;
    const section = enrollment?.sectionId ? (await this.database.db.select().from(sections).where(and(eq(sections.workspaceId, tenant.workspaceId), eq(sections.id, enrollment.sectionId))).limit(1))[0] : null;

    let studentResult = await this.getStudentResult(tenant, examinationId, studentId);
    if (!studentResult && enrollment && section) {
      const calculated = await this.calculateClassResults(tenant, examinationId, enrollment.gradeId, section.id);
      studentResult = calculated.find((s) => s.studentId === studentId) ?? null;
    }

    if (!studentResult) {
      throw new ApiError(404, 'NOT_FOUND', 'Result record not found for this student.');
    }

    const subjectRows = await this.database.db.select().from(subjects).where(eq(subjects.workspaceId, tenant.workspaceId));
    const enrichedSubjects = studentResult.subjects.map((s) => {
      const sub = subjectRows.find((subRow) => subRow.id === s.subjectId);
      return {
        ...s,
        subjectName: sub?.name ?? 'Subject',
        subjectCode: sub?.code ?? '',
      };
    });

    return {
      school: {
        name: org?.name ?? 'HAZA Academy',
        legalName: org?.legalName ?? org?.name ?? 'HAZA Academy',
        logoUrl: undefined,
        address: org?.country ?? 'School Campus',
        email: org?.email ?? 'contact@school.edu',
        phone: '+1 (555) 019-2834',
        website: 'https://haza.edu',
      },
      examination: {
        id: exam.id,
        name: exam.name,
        academicYear: academicYear.name,
        type: exam.type,
        startDate: exam.startDate,
        endDate: exam.endDate,
      },
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`.trim(),
        admissionNumber: student.admissionNumber,
        gender: student.gender,
        dateOfBirth: student.dateOfBirth,
        gradeName: grade?.name ?? 'Grade',
        sectionName: section?.name ?? '',
      },
      result: {
        ...studentResult,
        subjects: enrichedSubjects,
      },
      signatories: {
        classTeacher: 'Class Teacher',
        examinationController: 'Controller of Examinations',
        principal: 'Principal / Head of School',
      },
      issuedAt: new Date().toISOString(),
    };
  }

  async getBatchResultCards(tenant: Tenant, examinationId: string, gradeId: string, sectionId: string) {
    const exam = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const academicYear = await this.getAcademicYearRow(tenant.workspaceId, exam.academicYearId);
    const activeEnrollments = await this.findActiveEnrollments(tenant.workspaceId, academicYear.name, exam.academicYearId, gradeId, sectionId);
    const cards = [];
    for (const enrollment of activeEnrollments) {
      try {
        const card = await this.getResultCard(tenant, examinationId, enrollment.studentId);
        cards.push(card);
      } catch {
        // Continue if marks not complete for some students
      }
    }
    return cards;
  }

  // Examination Reports
  async getExamResultRegister(tenant: Tenant, examinationId: string, gradeId: string, sectionId: string) {
    const exam = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const academicYear = await this.getAcademicYearRow(tenant.workspaceId, exam.academicYearId);
    const grade = (await this.database.db.select().from(gradeLevels).where(and(eq(gradeLevels.workspaceId, tenant.workspaceId), eq(gradeLevels.id, gradeId))).limit(1))[0];
    const section = (await this.database.db.select().from(sections).where(and(eq(sections.workspaceId, tenant.workspaceId), eq(sections.id, sectionId))).limit(1))[0];
    const examSubjects = (await this.listExaminationSubjects(tenant, examinationId)).filter((s) => s.gradeId === gradeId && (!s.sectionId || s.sectionId === sectionId));
    const subjectRows = await this.database.db.select().from(subjects).where(eq(subjects.workspaceId, tenant.workspaceId));
    const calculated = await this.calculateClassResults(tenant, examinationId, gradeId, sectionId);

    const subjectHeaders = examSubjects.map((es) => {
      const sub = subjectRows.find((s) => s.id === es.subjectId);
      return {
        id: es.subjectId,
        name: sub?.name ?? 'Subject',
        code: sub?.code ?? '',
        maximumMarks: es.maximumMarks,
        passingMarks: es.passingMarks,
      };
    });

    const studentsList = calculated.map((res) => ({
      studentId: res.studentId,
      name: res.studentName ?? 'Student',
      admissionNumber: res.admissionNumber ?? '',
      subjectMarks: Object.fromEntries(res.subjects.map((s) => [s.subjectId, {
        obtainedMarks: s.obtainedMarks,
        percentage: s.percentage,
        grade: s.grade,
        passed: s.passed,
        isAbsent: s.isAbsent,
        isExempt: s.isExempt,
      }])),
      totalMaximum: res.maximumMarks,
      totalObtained: res.obtainedMarks,
      percentage: res.percentage,
      grade: res.grade,
      passed: res.passed,
      position: res.position,
      rankLabel: res.rankLabel,
    }));

    const totalEnrolled = studentsList.length;
    const totalAppeared = studentsList.filter((s) => Object.values(s.subjectMarks).some((m) => !m.isAbsent)).length;
    const totalPassed = studentsList.filter((s) => s.passed).length;
    const totalFailed = totalEnrolled - totalPassed;
    const scores = studentsList.map((s) => s.percentage);

    return {
      examination: { id: exam.id, name: exam.name, type: exam.type, academicYear: academicYear.name },
      grade: { id: grade?.id, name: grade?.name ?? 'Grade' },
      section: { id: section?.id, name: section?.name ?? '' },
      subjects: subjectHeaders,
      students: studentsList,
      summary: {
        totalEnrolled,
        totalAppeared,
        totalPassed,
        totalFailed,
        passPercentage: totalEnrolled > 0 ? Math.round((totalPassed / totalEnrolled) * 10000) / 100 : 0,
        averagePercentage: totalEnrolled > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / totalEnrolled) * 100) / 100 : 0,
        highestPercentage: scores.length ? Math.max(...scores) : 0,
        lowestPercentage: scores.length ? Math.min(...scores) : 0,
      },
    };
  }

  async getMissingMarksReport(tenant: Tenant, examinationId: string, gradeId?: string, sectionId?: string) {
    const exam = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const academicYear = await this.getAcademicYearRow(tenant.workspaceId, exam.academicYearId);
    let examSubjects = await this.listExaminationSubjects(tenant, examinationId);
    if (gradeId) examSubjects = examSubjects.filter((s) => s.gradeId === gradeId);
    if (sectionId) examSubjects = examSubjects.filter((s) => !s.sectionId || s.sectionId === sectionId);

    const studentRows = await this.database.db.select().from(students).where(eq(students.workspaceId, tenant.workspaceId));
    const gradeRows = await this.database.db.select().from(gradeLevels).where(eq(gradeLevels.workspaceId, tenant.workspaceId));
    const sectionRows = await this.database.db.select().from(sections).where(eq(sections.workspaceId, tenant.workspaceId));
    const subjectRows = await this.database.db.select().from(subjects).where(eq(subjects.workspaceId, tenant.workspaceId));
    const existingMarks = await this.listMarks(tenant, { sourceType: 'examination', sourceId: examinationId });

    const missingItems = [];
    for (const es of examSubjects) {
      const activeEnrollments = await this.findActiveEnrollments(tenant.workspaceId, academicYear.name, exam.academicYearId, es.gradeId, es.sectionId);
      for (const enr of activeEnrollments) {
        const hasMark = existingMarks.some((m) => m.studentId === enr.studentId && m.subjectId === es.subjectId);
        if (!hasMark) {
          const student = studentRows.find((s) => s.id === enr.studentId);
          const grade = gradeRows.find((g) => g.id === es.gradeId);
          const section = sectionRows.find((sec) => sec.id === (es.sectionId ?? enr.sectionId));
          const sub = subjectRows.find((s) => s.id === es.subjectId);
          missingItems.push({
            examinationId: exam.id,
            examinationName: exam.name,
            gradeId: es.gradeId,
            gradeName: grade?.name ?? 'Grade',
            sectionId: es.sectionId ?? enr.sectionId ?? '',
            sectionName: section?.name ?? '',
            subjectId: es.subjectId,
            subjectName: sub?.name ?? 'Subject',
            studentId: enr.studentId,
            studentName: student ? `${student.firstName} ${student.lastName}`.trim() : 'Student',
            admissionNumber: student?.admissionNumber ?? '',
          });
        }
      }
    }
    return missingItems;
  }

  private async getExaminationRow(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(examinations).where(and(eq(examinations.workspaceId, workspaceId), eq(examinations.id, id))).limit(1);
    return rows[0] ?? this.notFound('Examination');
  }

  private async getAssessmentRow(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(assessments).where(and(eq(assessments.workspaceId, workspaceId), eq(assessments.id, id))).limit(1);
    return rows[0] ?? this.notFound('Assessment');
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

  private async findActiveEnrollment(workspaceId: string, studentId: string, academicYearName: string, academicYearId: string, gradeId: string, sectionId?: string) {
    const conditions = [
      eq(enrollments.workspaceId, workspaceId),
      eq(enrollments.studentId, studentId),
      or(eq(enrollments.academicYear, academicYearName), eq(enrollments.academicYear, academicYearId)),
      eq(enrollments.gradeId, gradeId),
      eq(enrollments.status, 'active'),
    ];
    if (sectionId) {
      conditions.push(eq(enrollments.sectionId, sectionId));
    }
    const rows = await this.database.db.select().from(enrollments).where(and(...conditions)).limit(1);
    if (rows.length) return rows[0];

    // Fallback if enrollment has academicYear naming variation: match active enrollment in grade (and section)
    const fallbackConditions = [
      eq(enrollments.workspaceId, workspaceId),
      eq(enrollments.studentId, studentId),
      eq(enrollments.gradeId, gradeId),
      eq(enrollments.status, 'active'),
    ];
    if (sectionId) {
      fallbackConditions.push(eq(enrollments.sectionId, sectionId));
    }
    const fallbackRows = await this.database.db.select().from(enrollments).where(and(...fallbackConditions)).limit(1);
    if (!fallbackRows.length) throw new ApiError(400, 'VALIDATION_FAILED', 'Student is not actively enrolled in the selected academic context.');
    return fallbackRows[0];
  }

  private async findActiveEnrollments(workspaceId: string, academicYearName: string, academicYearId: string, gradeId: string, sectionId?: string) {
    const conditions = [
      eq(enrollments.workspaceId, workspaceId),
      or(eq(enrollments.academicYear, academicYearName), eq(enrollments.academicYear, academicYearId)),
      eq(enrollments.gradeId, gradeId),
      eq(enrollments.status, 'active'),
    ];
    if (sectionId) {
      conditions.push(eq(enrollments.sectionId, sectionId));
    }
    const rows = await this.database.db.select().from(enrollments).where(and(...conditions));
    if (rows.length > 0) return rows;

    // Fallback: active enrollments in grade (and section)
    const fallbackConditions = [
      eq(enrollments.workspaceId, workspaceId),
      eq(enrollments.gradeId, gradeId),
      eq(enrollments.status, 'active'),
    ];
    if (sectionId) {
      fallbackConditions.push(eq(enrollments.sectionId, sectionId));
    }
    return this.database.db.select().from(enrollments).where(and(...fallbackConditions));
  }

  private async resolveExaminationMarkSource(tenant: Tenant, examinationId: string, examinationSubjectId?: string) {
    const examination = await this.getExaminationRow(tenant.workspaceId, examinationId);
    const condition = examinationSubjectId ? and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.examinationId, examinationId), eq(examinationSubjects.id, examinationSubjectId)) : and(eq(examinationSubjects.workspaceId, tenant.workspaceId), eq(examinationSubjects.examinationId, examinationId));
    const examSubject = (await this.database.db.select().from(examinationSubjects).where(condition).limit(1))[0];
    if (!examSubject) this.notFound('Examination subject');
    const academicYear = await this.getAcademicYearRow(tenant.workspaceId, examination.academicYearId);
    return { academicYearId: examination.academicYearId, academicYearName: academicYear.name, termId: examination.termId ?? undefined, gradeId: examSubject.gradeId, sectionId: examSubject.sectionId ?? undefined, subjectId: examSubject.subjectId, maximumMarks: examSubject.maximumMarks, passingMarks: examSubject.passingMarks };
  }

  private async resolveAssessmentMarkSource(tenant: Tenant, assessmentId: string) {
    const assessment = await this.getAssessmentRow(tenant.workspaceId, assessmentId);
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
    const isAbsent = Boolean(row.remarks?.startsWith('[ABSENT]') || row.grade === 'ABS');
    const isExempt = Boolean(row.remarks?.startsWith('[EXEMPT]') || row.grade === 'EXM');
    return {
      ...row,
      organizationId: tenant.organizationId,
      examinationSubjectId: row.examinationSubjectId ?? undefined,
      termId: row.termId ?? undefined,
      percentage: fromBasisPoints(row.percentageBasisPoints) ?? 0,
      grade: row.grade ?? undefined,
      gradePoint: fromBasisPoints(row.gradePointBasisPoints),
      remarks: row.remarks ?? undefined,
      isAbsent,
      isExempt,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private resultPublicationDto(tenant: Tenant, row: typeof resultPublications.$inferSelect) {
    const results = typeof row.results === 'string' ? JSON.parse(row.results) as StudentResult[] : row.results as StudentResult[];
    return { ...row, organizationId: tenant.organizationId, termId: row.termId ?? undefined, results, publishedAt: row.publishedAt ?? undefined, publishedBy: row.publishedBy ?? undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private notFound(label: string): never {
    throw new ApiError(404, 'NOT_FOUND', label + ' not found.');
  }
}
