import { migrate } from 'drizzle-orm/mysql2/migrator';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../src/common/logging/logger.js';
import { loadConfig, type ApiConfig } from '../src/config/env.js';
import { createDatabaseClient, type DatabaseClient } from '../src/database/client.js';
import { AuthService } from '../src/modules/auth/services/auth.service.js';
import { SisCommunicationService } from '../src/modules/education/sis-communication.service.js';
import { SisFinanceService } from '../src/modules/education/sis-finance.service.js';
import { SisPortalService } from '../src/modules/education/sis-portal.service.js';
import { SisService } from '../src/modules/education/sis.service.js';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, '../src/database/migrations');

describeDatabase('DB-8 finance communication and portal persistence', () => {
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

  it('persists finance invoices, receipts, communications, and portal records', async () => {
    const { tenant } = await createSisTenant(database, 'db8-main');
    const sis = new SisService(database);
    const finance = new SisFinanceService(database);
    const communication = new SisCommunicationService(database);
    const portal = new SisPortalService(database);
    const fixture = await createClassFixture(sis, tenant);
    const owner = { userId: 'owner', role: 'Owner' };

    const category = await finance.createCategory(tenant, { name: 'Tuition', code: 'TUI-' + randomUUID().slice(0, 6), status: 'active', displayOrder: 1 }, owner);
    const structure = await finance.createStructure(tenant, { name: 'Monthly Tuition', academicYearId: fixture.year.id, gradeId: fixture.grade.id, feeCategoryId: category.id, amountCents: 100000, frequency: 'monthly', effectiveFrom: '2026-08-01', status: 'active' }, owner);
    await finance.assignFee(tenant, fixture.student.id, fixture.enrollment.id, structure.id, owner);
    const invoice = await finance.createInvoice(tenant, { studentId: fixture.student.id, enrollmentId: fixture.enrollment.id, academicYearId: fixture.year.id, issueDate: '2026-08-01', dueDate: '2026-08-31', currency: 'USD', feeStructureIds: [structure.id], status: 'issued' }, owner);
    const paymentResult = await finance.recordPayment(tenant, { invoiceId: invoice.id, amountCents: 40000, paymentDate: '2026-08-10', paymentMethod: 'cash', referenceNumber: 'DB8-' + randomUUID().slice(0, 8), receivedBy: 'Cashier' }, owner);

    const message = await communication.sendCommunication(tenant, { subject: 'Fee reminder', body: 'Payment due', senderId: 'owner', audience: { type: 'selected_students', studentIds: [fixture.student.id] }, channels: ['in_app', 'email'], priority: 'important', idempotencyKey: 'db8-' + randomUUID() }, owner);
    const duplicate = await communication.sendCommunication(tenant, { subject: 'Different', body: 'Ignored', senderId: 'owner', audience: { type: 'selected_students', studentIds: [fixture.student.id] }, channels: ['in_app'], priority: 'normal', idempotencyKey: message.idempotencyKey }, owner);
    const policy = await portal.savePolicy(tenant, { studentFinanceVisible: true, studentMessagingEnabled: true, parentMessagingEnabled: true });
    const request = await portal.submitRequest(tenant, { userId: 'parent-user', role: 'parent' }, { studentId: fixture.student.id, type: 'profile_update', subject: 'Phone update', details: 'Please update phone.' });

    expect(paymentResult.invoice.status).toBe('partially_paid');
    expect(paymentResult.receipt.receiptNumber).toMatch(/^RCT-/);
    expect(duplicate.id).toBe(message.id);
    expect((await communication.listNotifications(tenant, { kind: 'student', id: fixture.student.id }))).toHaveLength(1);
    expect(policy.studentFinanceVisible).toBe(true);
    expect((await portal.listRequests(tenant, { userId: 'parent-user', role: 'parent' }))[0].id).toBe(request.id);

    const reloaded = createDatabaseClient(config.database, createLogger(config));
    try {
      expect((await new SisFinanceService(reloaded).listInvoices(tenant, new URLSearchParams('studentId=' + fixture.student.id)))[0].balanceCents).toBe(60000);
    } finally {
      await reloaded.close();
    }
  });

  it('keeps DB-8 records tenant scoped and rejects invalid financial mutations', async () => {
    const orgA = await createSisTenant(database, 'db8-a');
    const orgB = await createSisTenant(database, 'db8-b');
    const sis = new SisService(database);
    const finance = new SisFinanceService(database);
    const fixtureA = await createClassFixture(sis, orgA.tenant);
    const fixtureB = await createClassFixture(sis, orgB.tenant);
    const actor = { userId: 'acct', role: 'Accountant' };
    const category = await finance.createCategory(orgA.tenant, { name: 'Lab', code: 'LAB-' + randomUUID().slice(0, 6), status: 'active', displayOrder: 1 }, actor);
    const structure = await finance.createStructure(orgA.tenant, { name: 'Lab Fee', academicYearId: fixtureA.year.id, gradeId: fixtureA.grade.id, feeCategoryId: category.id, amountCents: 25000, frequency: 'term', effectiveFrom: '2026-08-01', status: 'active' }, actor);

    await expect(finance.assignFee(orgA.tenant, fixtureB.student.id, fixtureB.enrollment.id, structure.id, actor)).rejects.toMatchObject({ statusCode: 404 });
    await finance.assignFee(orgA.tenant, fixtureA.student.id, fixtureA.enrollment.id, structure.id, actor);
    const invoice = await finance.createInvoice(orgA.tenant, { studentId: fixtureA.student.id, enrollmentId: fixtureA.enrollment.id, academicYearId: fixtureA.year.id, issueDate: '2026-09-01', dueDate: '2026-09-30', currency: 'USD', feeStructureIds: [structure.id], status: 'issued' }, actor);

    await expect(finance.recordPayment(orgA.tenant, { invoiceId: invoice.id, amountCents: 25001, paymentDate: '2026-09-05', paymentMethod: 'cash', receivedBy: 'Cashier' }, actor)).rejects.toMatchObject({ cause: { statusCode: 400 } });
    expect(await finance.listInvoices(orgB.tenant, new URLSearchParams())).toHaveLength(0);
  });
});

async function createSisTenant(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({ firstName: 'DB8', lastName: 'Owner', email: label + '-' + suffix + '@example.com', password: 'password123', organizationName: 'DB8 ' + label + ' ' + suffix, organizationType: 'School', industry: 'Education', country: 'United States' });
  const tenant = await new SisService(database).getTenant(auth.memberships[0].organizationId);
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
  const student = await service.createStudent(tenant, { admissionNumber: 'ADM-' + suffix, firstName: 'Student', lastName: 'Learner', dateOfBirth: '2016-05-01', gender: 'male', admissionDate: '2026-01-15', status: 'active', portalAccessEnabled: true, guardians: [{ firstName: 'Parent', lastName: 'Learner', relationship: 'guardian', email: 'parent-' + suffix + '@example.com', phone: '555-0100', isEmergencyContact: true, isPrimaryContact: true, portalAccessEnabled: true }] });
  const enrollment = await service.createEnrollment(tenant, { studentId: student.id, academicYear: year.name, gradeId: grade.id, sectionId: section.id, enrollmentDate: '2026-01-15', status: 'active' });
  return { year, grade, section, subject, staff, student, enrollment };
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
