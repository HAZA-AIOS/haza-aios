import { migrate } from "../src/database/mysql94-migrator.js";
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../src/common/logging/logger.js';
import { loadConfig, type ApiConfig } from '../src/config/env.js';
import { createDatabaseClient, type DatabaseClient } from '../src/database/client.js';
import { AuthService } from '../src/modules/auth/services/auth.service.js';
import { SisExaminationService } from '../src/modules/education/sis-examination.service.js';
import { SisService } from '../src/modules/education/sis.service.js';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, '../src/database/migrations');

describeDatabase('DB-7 examination assessment and results persistence', () => {
  let config: ApiConfig;
  let database: DatabaseClient;

  beforeAll(async () => {
    config = loadConfig({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'error' });
    database = createDatabaseClient(config.database, createLogger(config));
    await migrateIfNeeded(database);
  });

  afterAll(async () => {
    await database.close();
  });

  it('persists examinations, marks, calculated results, and publications', async () => {
    const { tenant } = await createSisTenant(database, 'exam');
    const sis = new SisService(database);
    const exams = new SisExaminationService(database);
    const fixture = await createClassFixture(sis, tenant);
    const exam = await exams.createExamination(tenant, { name: 'Mid Term ' + randomUUID().slice(0, 4), academicYearId: fixture.year.id, type: 'mid_term', startDate: '2026-10-01', endDate: '2026-10-10', status: 'scheduled' });
    const examSubject = await exams.addExaminationSubject(tenant, { examinationId: exam.id, gradeId: fixture.grade.id, sectionId: fixture.section.id, subjectId: fixture.subject.id, maximumMarks: 100, passingMarks: 40, status: 'scheduled', examDate: '2026-10-02' });

    await exams.enterMark(tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSubject.id, studentId: fixture.students[0].id, obtainedMarks: 90, enteredBy: fixture.staff.id });
    await exams.enterMark(tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSubject.id, studentId: fixture.students[1].id, obtainedMarks: 45, enteredBy: fixture.staff.id });

    const calculated = await exams.calculateClassResults(tenant, exam.id, fixture.grade.id, fixture.section.id);
    const publication = await exams.publishResults(tenant, exam.id, fixture.grade.id, fixture.section.id, fixture.staff.id);
    const studentResult = await exams.getStudentResult(tenant, exam.id, fixture.students[0].id);
    const performance = await exams.getSubjectPerformance(tenant, exam.id, fixture.grade.id, fixture.section.id, fixture.subject.id);

    expect(calculated).toHaveLength(2);
    expect(publication.status).toBe('published');
    expect(studentResult?.grade).toBe('A');
    expect(performance?.average).toBe(67.5);

    const secondClient = createDatabaseClient(config.database, createLogger(config));
    try {
      const reloaded = await new SisExaminationService(secondClient).getStudentResult(tenant, exam.id, fixture.students[0].id);
      expect(reloaded?.obtainedMarks).toBe(90);
    } finally {
      await secondClient.close();
    }
  });

  it('enforces tenant isolation and published result protection', async () => {
    const orgA = await createSisTenant(database, 'exam-a');
    const orgB = await createSisTenant(database, 'exam-b');
    const sis = new SisService(database);
    const exams = new SisExaminationService(database);
    const fixtureA = await createClassFixture(sis, orgA.tenant);
    const fixtureB = await createClassFixture(sis, orgB.tenant);
    const exam = await exams.createExamination(orgA.tenant, { name: 'Final ' + randomUUID().slice(0, 4), academicYearId: fixtureA.year.id, type: 'annual', startDate: '2026-11-01', endDate: '2026-11-10', status: 'scheduled' });
    const examSubject = await exams.addExaminationSubject(orgA.tenant, { examinationId: exam.id, gradeId: fixtureA.grade.id, sectionId: fixtureA.section.id, subjectId: fixtureA.subject.id, maximumMarks: 100, passingMarks: 40, status: 'scheduled' });

    await expect(exams.enterMark(orgA.tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSubject.id, studentId: fixtureB.students[0].id, obtainedMarks: 80, enteredBy: fixtureA.staff.id })).rejects.toMatchObject({ statusCode: 404 });

    // Reject marks exceeding maximum marks (100)
    await expect(exams.enterMark(orgA.tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSubject.id, studentId: fixtureA.students[0].id, obtainedMarks: 105, enteredBy: fixtureA.staff.id })).rejects.toMatchObject({ statusCode: 400 });

    for (const student of fixtureA.students) await exams.enterMark(orgA.tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSubject.id, studentId: student.id, obtainedMarks: 80, enteredBy: fixtureA.staff.id });
    await exams.publishResults(orgA.tenant, exam.id, fixtureA.grade.id, fixtureA.section.id, fixtureA.staff.id);
    await expect(exams.enterMark(orgA.tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSubject.id, studentId: fixtureA.students[0].id, obtainedMarks: 81, enteredBy: fixtureA.staff.id })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('handles absent/exempt marks, authoritative ranking, approval workflow, corrections, cards and reports', async () => {
    const { tenant } = await createSisTenant(database, 'exam-full');
    const sis = new SisService(database);
    const exams = new SisExaminationService(database);
    const fixture = await createClassFixture(sis, tenant);

    const exam = await exams.createExamination(tenant, {
      name: 'Term 1 Exam ' + randomUUID().slice(0, 4),
      academicYearId: fixture.year.id,
      type: 'mid_term',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      status: 'scheduled',
    });

    const subject2 = await sis.createSubject(tenant, { name: 'Science ' + randomUUID().slice(0, 4), code: 'SCI', status: 'active', displayOrder: 2 });
    await sis.createTeachingAssignment(tenant, { staffId: fixture.staff.id, academicYear: fixture.year.name, gradeId: fixture.grade.id, sectionId: fixture.section.id, subjectId: subject2.id, isActive: true });

    const examSub1 = await exams.addExaminationSubject(tenant, { examinationId: exam.id, gradeId: fixture.grade.id, sectionId: fixture.section.id, subjectId: fixture.subject.id, maximumMarks: 100, passingMarks: 40, status: 'scheduled' });
    const examSub2 = await exams.addExaminationSubject(tenant, { examinationId: exam.id, gradeId: fixture.grade.id, sectionId: fixture.section.id, subjectId: subject2.id, maximumMarks: 100, passingMarks: 40, status: 'scheduled' });

    // Missing marks report detects all missing marks initially
    const initialMissing = await exams.getMissingMarksReport(tenant, exam.id, fixture.grade.id, fixture.section.id);
    expect(initialMissing.length).toBe(4); // 2 students x 2 subjects

    // Student 0: Math = 95, Science = Exempt
    await exams.enterMark(tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSub1.id, studentId: fixture.students[0].id, obtainedMarks: 95, enteredBy: fixture.staff.id });
    await exams.enterMark(tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSub2.id, studentId: fixture.students[0].id, isExempt: true, enteredBy: fixture.staff.id });

    // Student 1: Math = 80, Science = Absent
    await exams.enterMark(tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSub1.id, studentId: fixture.students[1].id, obtainedMarks: 80, enteredBy: fixture.staff.id });
    await exams.enterMark(tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSub2.id, studentId: fixture.students[1].id, isAbsent: true, enteredBy: fixture.staff.id });

    // Missing marks report is now empty
    const updatedMissing = await exams.getMissingMarksReport(tenant, exam.id, fixture.grade.id, fixture.section.id);
    expect(updatedMissing).toHaveLength(0);

    // Calculate class results with positions and rankings
    const calculated = await exams.calculateClassResults(tenant, exam.id, fixture.grade.id, fixture.section.id);
    expect(calculated).toHaveLength(2);

    const s0 = calculated.find((s) => s.studentId === fixture.students[0].id)!;
    const s1 = calculated.find((s) => s.studentId === fixture.students[1].id)!;

    // Student 0: Science was exempt, so percentage is 95% from Math (exempt excluded from total max marks), position 1st
    expect(s0.percentage).toBe(95);
    expect(s0.position).toBe(1);
    expect(s0.rankLabel).toBe('1st');
    expect(s0.passed).toBe(true);

    // Student 1: Science was absent, so passed = false
    expect(s1.position).toBe(2);
    expect(s1.passed).toBe(false);

    // Controlled Workflow: Teacher submits for review
    const teacherId = fixture.staff.id;
    const submitted = await exams.submitForReview(tenant, exam.id, fixture.grade.id, fixture.section.id, { userId: teacherId, role: 'Teacher' });
    expect(submitted.status).toBe('in_progress');

    // Reviewer: Separation of duties rejects self-review by the same teacher
    await expect(
      exams.reviewResults(tenant, exam.id, fixture.grade.id, fixture.section.id, { userId: teacherId, role: 'Teacher' }, 'approved')
    ).rejects.toMatchObject({ statusCode: 403 });

    // Principal / Admin approves
    const adminReviewerId = randomUUID();
    const approved = await exams.reviewResults(tenant, exam.id, fixture.grade.id, fixture.section.id, { userId: adminReviewerId, role: 'Admin' }, 'approved', 'Class performed well');
    expect(approved.status).toBe('completed');

    // Publish results
    const published = await exams.publishResults(tenant, exam.id, fixture.grade.id, fixture.section.id, adminReviewerId);
    expect(published.status).toBe('published');

    // Idempotent publishing returns the same published record
    const repub = await exams.publishResults(tenant, exam.id, fixture.grade.id, fixture.section.id, adminReviewerId);
    expect(repub.id).toBe(published.id);

    // Correction request: Student 1 Math mark was wrongly entered as 80, should be 88
    const correction = await exams.requestResultCorrection(tenant, {
      examinationId: exam.id,
      gradeId: fixture.grade.id,
      sectionId: fixture.section.id,
      studentId: fixture.students[1].id,
      subjectId: fixture.subject.id,
      newMarks: 88,
      reason: 'Recounting error in Question 4',
      requestedBy: teacherId,
    });
    expect(correction.status).toBe('pending');
    expect(correction.oldMarks).toBe(80);
    expect(correction.newMarks).toBe(88);

    // Review and approve correction
    const reviewedCorrection = await exams.reviewResultCorrection(tenant, correction.id, { userId: adminReviewerId, role: 'Admin' }, 'approved', 'Recount verified');
    expect(reviewedCorrection.status).toBe('approved');

    // Check that recalculated results reflect the updated mark
    const postCorrectionPub = (await exams.listResultPublications(tenant, exam.id))[0];
    const updatedS1 = postCorrectionPub.results.find((s) => s.studentId === fixture.students[1].id)!;
    const updatedMath = updatedS1.subjects.find((sub) => sub.subjectId === fixture.subject.id)!;
    expect(updatedMath.obtainedMarks).toBe(88);

    // Printable Result Card
    const card = await exams.getResultCard(tenant, exam.id, fixture.students[0].id);
    expect(card.student).toBeDefined();
    expect(card.school).toBeDefined();
    expect(card.result).toBeDefined();
    expect((card.result as { percentage: number }).percentage).toBe(95);

    // Batch Result Cards
    const batchCards = await exams.getBatchResultCards(tenant, exam.id, fixture.grade.id, fixture.section.id);
    expect(batchCards).toHaveLength(2);

    // Examination Result Register Report
    const register = await exams.getExamResultRegister(tenant, exam.id, fixture.grade.id, fixture.section.id);
    expect(register.subjects).toHaveLength(2);
    expect(register.students).toHaveLength(2);
    expect(register.summary.totalEnrolled).toBe(2);
  });
});

async function createSisTenant(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({ firstName: 'SIS', lastName: 'Owner', email: label + '-' + suffix + '@example.com', password: 'password123', organizationName: 'SIS ' + label + ' ' + suffix, organizationType: 'School', industry: 'Education', country: 'United States' });
  const organizationId = auth.memberships[0].organizationId;
  const tenant = await new SisService(database).getTenant(organizationId);
  return { auth, tenant };
}

async function createClassFixture(service: SisService, tenant: Awaited<ReturnType<SisService['getTenant']>>) {
  const suffix = randomUUID().slice(0, 6);
  const year = await service.createAcademicYear(tenant, { name: '2026-' + suffix, startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' });
  const grade = await service.createGrade(tenant, { name: 'Grade ' + suffix, level: 1, order: 1, status: 'active' });
  const section = await service.createSection(tenant, { gradeId: grade.id, name: 'A', capacity: 30, status: 'active' });
  const subject = await service.createSubject(tenant, { name: 'Math ' + suffix, code: 'M-' + suffix, status: 'active', displayOrder: 1 });
  const staff = await service.createStaff(tenant, { firstName: 'Ada', lastName: 'Teacher', hireDate: '2026-01-01', staffType: 'teacher', employmentStatus: 'full_time', status: 'active' });
  await service.createTeachingAssignment(tenant, { staffId: staff.id, academicYear: year.name, gradeId: grade.id, sectionId: section.id, subjectId: subject.id, isActive: true });
  const students = [];
  for (const index of [0, 1]) {
    students.push(await service.createStudent(tenant, { admissionNumber: 'ADM-' + suffix + '-' + index, firstName: 'Student' + index, lastName: 'Learner', dateOfBirth: '2016-05-01', gender: 'male', admissionDate: '2026-01-15', status: 'active', guardians: [] }));
  }
  for (const student of students) await service.createEnrollment(tenant, { studentId: student.id, academicYear: year.name, gradeId: grade.id, sectionId: section.id, enrollmentDate: '2026-01-15', status: 'active' });
  return { year, grade, section, subject, staff, students };
}

async function migrateIfNeeded(database: DatabaseClient): Promise<void> {
  try {
    await migrate(database.db, { migrationsFolder });
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === 'ER_TABLE_EXISTS_ERROR') return;
    throw error;
  }
}

