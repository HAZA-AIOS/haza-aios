import { migrate } from 'drizzle-orm/mysql2/migrator';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../src/common/logging/logger.js';
import { loadConfig, type ApiConfig } from '../src/config/env.js';
import { createDatabaseClient, type DatabaseClient } from '../src/database/client.js';
import { AuthService } from '../src/modules/auth/services/auth.service.js';
import { SisAnalyticsService } from '../src/modules/education/sis-analytics.service.js';
import { SisCommunicationService } from '../src/modules/education/sis-communication.service.js';
import { SisExaminationService } from '../src/modules/education/sis-examination.service.js';
import { SisFinanceService } from '../src/modules/education/sis-finance.service.js';
import { SisService } from '../src/modules/education/sis.service.js';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, '../src/database/migrations');

describeDatabase('DB-9 SIS analytics and reporting persistence', () => {
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

  it('derives overview and reports from tenant-scoped database records', async () => {
    const { tenant } = await createSisTenant(database, 'db9-main');
    const fixture = await createAnalyticsFixture(database, tenant);
    const analytics = new SisAnalyticsService(database);
    const filters = new URLSearchParams({ academicYearId: fixture.year.id, gradeId: fixture.grade.id, sectionId: fixture.section.id });

    const overview = await analytics.getOverview(tenant, filters, { userId: 'owner', role: 'Owner' });
    const attendanceReport = await analytics.getReport(tenant, 'attendance_summary', filters, { userId: 'owner', role: 'Owner' });
    const resultsReport = await analytics.getReport(tenant, 'results_summary', filters, { userId: 'owner', role: 'Owner' });
    const financeReport = await analytics.getReport(tenant, 'finance_collection', filters, { userId: 'owner', role: 'Owner' });
    const csv = await analytics.exportCsv(tenant, 'student_directory', filters, { userId: 'owner', role: 'Owner' });

    expect(overview.students.total).toBe(1);
    expect(overview.attendance.attendancePercentage).toBe(100);
    expect(overview.results.publishedResults).toBe(1);
    expect(overview.results.averagePerformance).toBe(88);
    expect(overview.finance.outstandingCents).toBe(70000);
    expect(overview.communication.communicationsSent).toBe(1);
    expect(attendanceReport.rows).toHaveLength(1);
    expect(resultsReport.rows[0]).toMatchObject({ passRate: 100, average: 88 });
    expect(financeReport.rows[0]).toMatchObject({ balanceCents: 70000 });
    expect(csv).toContain('Admission Number,Name,Status,Class,Section,Guardian Count');
  }, 20000);

  it('prevents cross-tenant aggregate leakage and unauthorized report access', async () => {
    const orgA = await createSisTenant(database, 'db9-a');
    const orgB = await createSisTenant(database, 'db9-b');
    const fixtureA = await createAnalyticsFixture(database, orgA.tenant);
    await createAnalyticsFixture(database, orgB.tenant);
    const analytics = new SisAnalyticsService(database);

    await expect(analytics.getOverview(orgA.tenant, new URLSearchParams({ gradeId: fixtureA.grade.id }), { userId: 'member', role: 'Member' })).rejects.toMatchObject({ statusCode: 403 });
    const overviewA = await analytics.getOverview(orgA.tenant, new URLSearchParams({ gradeId: fixtureA.grade.id }), { userId: 'owner', role: 'Owner' });
    const overviewB = await analytics.getOverview(orgB.tenant, new URLSearchParams({ gradeId: fixtureA.grade.id }), { userId: 'owner', role: 'Owner' }).catch((error: unknown) => error);

    expect(overviewA.students.total).toBe(1);
    expect(overviewB).toMatchObject({ statusCode: 404 });
  }, 20000);
});

async function createSisTenant(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({ firstName: 'DB9', lastName: 'Owner', email: label + '-' + suffix + '@example.com', password: 'password123', organizationName: 'DB9 ' + label + ' ' + suffix, organizationType: 'School', industry: 'Education', country: 'United States' });
  const tenant = await new SisService(database).getTenant(auth.memberships[0].organizationId);
  return { auth, tenant };
}

async function createAnalyticsFixture(database: DatabaseClient, tenant: Awaited<ReturnType<SisService['getTenant']>>) {
  const sis = new SisService(database);
  const exams = new SisExaminationService(database);
  const finance = new SisFinanceService(database);
  const communication = new SisCommunicationService(database);
  const suffix = randomUUID().slice(0, 6);
  const owner = { userId: 'owner', role: 'Owner' };
  const year = await sis.createAcademicYear(tenant, { name: '2026-' + suffix, startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' });
  const grade = await sis.createGrade(tenant, { name: 'Grade ' + suffix, level: 1, order: 1, status: 'active' });
  const section = await sis.createSection(tenant, { gradeId: grade.id, name: 'A', capacity: 30, status: 'active' });
  const subject = await sis.createSubject(tenant, { name: 'Science ' + suffix, code: 'SCI-' + suffix, status: 'active', displayOrder: 1 });
  const staff = await sis.createStaff(tenant, { firstName: 'Ada', lastName: 'Teacher', hireDate: '2026-01-01', staffType: 'teacher', employmentStatus: 'full_time', status: 'active' });
  await sis.createTeachingAssignment(tenant, { staffId: staff.id, academicYear: year.name, gradeId: grade.id, sectionId: section.id, subjectId: subject.id, isActive: true });
  const period = await sis.savePeriod(tenant, { name: 'Period 1', startTime: '08:00', endTime: '08:45', type: 'teaching', displayOrder: 1 });
  await sis.saveTimetableEntry(tenant, { academicYearId: year.id, gradeId: grade.id, sectionId: section.id, subjectId: subject.id, teacherId: staff.id, dayOfWeek: 1, periodId: period.id, roomId: 'Lab-1' });
  const student = await sis.createStudent(tenant, { admissionNumber: 'ADM-' + suffix, firstName: 'Student', lastName: 'Learner', dateOfBirth: '2016-05-01', gender: 'male', admissionDate: '2026-01-15', status: 'active', portalAccessEnabled: true, guardians: [{ firstName: 'Parent', lastName: 'Learner', relationship: 'guardian', email: 'parent-' + suffix + '@example.com', phone: '555-0100', isEmergencyContact: true, isPrimaryContact: true, portalAccessEnabled: true, authorizedForPortal: true }] });
  const enrollment = await sis.createEnrollment(tenant, { studentId: student.id, academicYear: year.name, gradeId: grade.id, sectionId: section.id, enrollmentDate: '2026-01-15', status: 'active' });
  const session = await sis.createAttendanceSession(tenant, { academicYearId: year.id, date: '2026-08-17', gradeId: grade.id, sectionId: section.id, sessionType: 'daily', status: 'draft', markedBy: 'admin' });
  await sis.saveAttendanceRecords(tenant, session.id, [{ studentId: student.id, status: 'present' }], 'admin');
  const exam = await exams.createExamination(tenant, { name: 'Final Term ' + suffix, academicYearId: year.id, type: 'final_term', startDate: '2026-11-01', endDate: '2026-11-05', status: 'completed' });
  const examSubject = await exams.addExaminationSubject(tenant, { examinationId: exam.id, gradeId: grade.id, sectionId: section.id, subjectId: subject.id, maximumMarks: 100, passingMarks: 40, status: 'completed' });
  await exams.enterMark(tenant, { sourceType: 'examination', sourceId: exam.id, examinationSubjectId: examSubject.id, studentId: student.id, obtainedMarks: 88, enteredBy: 'admin' });
  await exams.publishResults(tenant, exam.id, grade.id, section.id, 'admin');
  const category = await finance.createCategory(tenant, { name: 'Tuition', code: 'TUI-' + suffix, status: 'active', displayOrder: 1 }, owner);
  const structure = await finance.createStructure(tenant, { name: 'Monthly Tuition', academicYearId: year.id, gradeId: grade.id, feeCategoryId: category.id, amountCents: 100000, frequency: 'monthly', effectiveFrom: '2026-08-01', status: 'active' }, owner);
  await finance.assignFee(tenant, student.id, enrollment.id, structure.id, owner);
  const invoice = await finance.createInvoice(tenant, { studentId: student.id, enrollmentId: enrollment.id, academicYearId: year.id, issueDate: '2026-08-01', dueDate: '2026-08-31', currency: 'USD', feeStructureIds: [structure.id], status: 'issued' }, owner);
  await finance.recordPayment(tenant, { invoiceId: invoice.id, amountCents: 30000, paymentDate: '2026-08-10', paymentMethod: 'cash', referenceNumber: 'DB9-' + suffix, receivedBy: 'Cashier' }, owner);
  await communication.sendCommunication(tenant, { subject: 'Analytics ready', body: 'Report data available', senderId: 'owner', audience: { type: 'selected_students', studentIds: [student.id] }, channels: ['in_app'], priority: 'normal', idempotencyKey: 'db9-' + suffix }, owner);
  return { year, grade, section, subject, student, enrollment };
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
