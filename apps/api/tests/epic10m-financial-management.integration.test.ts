import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../src/common/logging/logger.js';
import { loadConfig, type ApiConfig } from '../src/config/env.js';
import { createDatabaseClient, type DatabaseClient } from '../src/database/client.js';
import { migrate } from '../src/database/mysql94-migrator.js';
import { AuthService } from '../src/modules/auth/services/auth.service.js';
import { SisFinanceService } from '../src/modules/education/sis-finance.service.js';
import { SisService } from '../src/modules/education/sis.service.js';

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === 'true' ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, '../src/database/migrations');

describeDatabase('Epic 10M: Financial Management Enhancement Integration Suite', () => {
  let config: ApiConfig;
  let database: DatabaseClient;

  beforeAll(async () => {
    config = loadConfig({ ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'error' });
    database = createDatabaseClient(config.database, createLogger(config));
    try {
      await migrate(database.db, { migrationsFolder });
    } catch (error) {
      const code = (error as { cause?: { code?: string } }).cause?.code;
      if (code !== 'ER_TABLE_EXISTS_ERROR') throw error;
    }
  });

  afterAll(async () => {
    await database.close();
  });

  it('handles fee structures, categories, and bulk assignment with duplicate prevention', async () => {
    const { tenant } = await createSisTenant(database, 'e10m-assign');
    const sis = new SisService(database);
    const finance = new SisFinanceService(database);
    const fixture = await createClassFixture(sis, tenant);
    const owner = { userId: 'owner-user', role: 'Owner' };

    // 1. Create categories and structures
    const cat = await finance.createCategory(tenant, { name: 'Tuition Fee', code: 'TUI-' + randomUUID().slice(0, 6), status: 'active', displayOrder: 1 }, owner);
    const struct = await finance.createStructure(tenant, {
      name: 'Term 1 Tuition',
      academicYearId: fixture.year.id,
      gradeId: fixture.grade.id,
      feeCategoryId: cat.id,
      amountCents: 150000,
      frequency: 'term_based',
      effectiveFrom: '2026-09-01',
      status: 'active',
    }, owner);

    // 2. Bulk assign fee
    const bulkRes = await finance.bulkAssignFee(tenant, {
      academicYearId: fixture.year.id,
      gradeId: fixture.grade.id,
      feeStructureId: struct.id,
    }, owner);
    expect(bulkRes.count).toBeGreaterThanOrEqual(1);

    // 3. Prevent duplicate active assignment (idempotent return)
    const secondAssign = await finance.assignFee(tenant, fixture.student.id, fixture.enrollment.id, struct.id, owner);
    expect(secondAssign.feeStructureId).toBe(struct.id);
    const studentAssignments = await finance.listStudentFeeAssignments(tenant, fixture.student.id);
    expect(studentAssignments.length).toBe(1);

    // 4. Delete safeguard on fee category with active structures
    await expect(finance.deleteCategory(tenant, cat.id, owner)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('generates recurring invoices with strict duplicate prevention per billing period', async () => {
    const { tenant } = await createSisTenant(database, 'e10m-recur');
    const sis = new SisService(database);
    const finance = new SisFinanceService(database);
    const fixture = await createClassFixture(sis, tenant);
    const owner = { userId: 'owner-user', role: 'Owner' };

    const cat = await finance.createCategory(tenant, { name: 'Monthly Fee', code: 'MON-' + randomUUID().slice(0, 6), status: 'active', displayOrder: 1 }, owner);
    const struct = await finance.createStructure(tenant, {
      name: 'Monthly Tuition Oct 2026',
      academicYearId: fixture.year.id,
      gradeId: fixture.grade.id,
      feeCategoryId: cat.id,
      amountCents: 50000,
      frequency: 'monthly',
      effectiveFrom: '2026-10-01',
      status: 'active',
    }, owner);

    await finance.assignFee(tenant, fixture.student.id, fixture.enrollment.id, struct.id, owner);

    // First generation run
    const run1 = await finance.generateRecurringInvoices(tenant, {
      academicYearId: fixture.year.id,
      billingPeriod: '2026-10',
      gradeId: fixture.grade.id,
      feeStructureIds: [struct.id],
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      issueNow: true,
    }, owner);

    expect(run1.createdInvoicesCount).toBe(1);
    expect(run1.skippedDuplicatesCount).toBe(0);
    expect(run1.invoices[0].status).toBe('issued');

    // Second generation run for the exact same billing period - duplicate prevention!
    const run2 = await finance.generateRecurringInvoices(tenant, {
      academicYearId: fixture.year.id,
      billingPeriod: '2026-10',
      gradeId: fixture.grade.id,
      feeStructureIds: [struct.id],
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
    }, owner);

    expect(run2.createdInvoicesCount).toBe(0);
    expect(run2.skippedDuplicatesCount).toBe(1);
  });

  it('enforces invoice voiding, payment reconciliation lifecycle, and banking locks', async () => {
    const { tenant } = await createSisTenant(database, 'e10m-recon');
    const sis = new SisService(database);
    const finance = new SisFinanceService(database);
    const fixture = await createClassFixture(sis, tenant);
    const owner = { userId: 'bursar-user', role: 'Owner' };

    const cat = await finance.createCategory(tenant, { name: 'Exam Fee', code: 'EXM-' + randomUUID().slice(0, 6), status: 'active', displayOrder: 1 }, owner);
    const struct = await finance.createStructure(tenant, {
      name: 'Term Exam Fee',
      academicYearId: fixture.year.id,
      gradeId: fixture.grade.id,
      feeCategoryId: cat.id,
      amountCents: 20000,
      frequency: 'term_based',
      effectiveFrom: '2026-10-01',
      status: 'active',
    }, owner);

    const invoice = await finance.createInvoice(tenant, {
      studentId: fixture.student.id,
      enrollmentId: fixture.enrollment.id,
      academicYearId: fixture.year.id,
      issueDate: '2026-10-01',
      dueDate: '2026-10-20',
      currency: 'USD',
      feeStructureIds: [struct.id],
      status: 'issued',
    }, owner);

    // Record Payment
    const paymentRes = await finance.recordPayment(tenant, {
      invoiceId: invoice.id,
      amountCents: 20000,
      paymentDate: '2026-10-05',
      paymentMethod: 'bank_transfer',
      referenceNumber: 'TXN-' + randomUUID().slice(0, 8),
      receivedBy: 'Chief Accountant',
    }, owner);

    expect(paymentRes.payment.status).toBe('recorded');
    expect(paymentRes.payment.reconciliationStatus).toBe('unreconciled');

    // 1. Reconcile Payment with Bank Statement
    const reconciled = await finance.reconcilePayment(tenant, paymentRes.payment.id, {
      bankStatementRef: 'STMT-OCT-2026-991',
      notes: 'Cleared in Chase bank operating account',
      reconciledBy: 'Senior Auditor',
    }, owner);

    expect(reconciled.reconciliationStatus).toBe('reconciled');
    expect(reconciled.bankStatementRef).toBe('STMT-OCT-2026-991');

    // 2. Reconciled Payment Void Lock Safeguard
    await expect(finance.voidPayment(tenant, paymentRes.payment.id, { reason: 'Test void' }, owner)).rejects.toMatchObject({
      statusCode: 400,
    });

    // 3. Unreconcile Payment
    const unreconciled = await finance.unreconcilePayment(tenant, paymentRes.payment.id, {
      reason: 'Audit correction required',
      authorizedBy: 'Bursar',
    }, owner);
    expect(unreconciled.reconciliationStatus).toBe('unreconciled');

    // 4. Voiding now permitted once unreconciled
    const voided = await finance.voidPayment(tenant, paymentRes.payment.id, {
      reason: 'Check bounced / administrative correction',
      authorizedBy: 'Bursar',
    }, owner);
    expect(voided.status).toBe('voided');
  });

  it('evaluates late-fee policies and applies penalty adjustments idempotently', async () => {
    const { tenant } = await createSisTenant(database, 'e10m-latefees');
    const sis = new SisService(database);
    const finance = new SisFinanceService(database);
    const fixture = await createClassFixture(sis, tenant);
    const owner = { userId: 'admin-user', role: 'Owner' };

    // Create policy: fixed $25 penalty after 3 days grace
    const policy = await finance.createLateFeePolicy(tenant, {
      code: 'LATE-FIXED-25',
      name: 'Fixed Late Charge $25',
      academicYearId: fixture.year.id,
      gracePeriodDays: 3,
      feeType: 'fixed',
      amountCents: 2500,
      maxCapCents: 5000,
      status: 'active',
      applyAutomatically: true,
    }, owner);

    expect(policy.code).toBe('LATE-FIXED-25');

    // Create an overdue invoice
    const cat = await finance.createCategory(tenant, { name: 'Overdue Item', code: 'OVR-' + randomUUID().slice(0, 6), status: 'active', displayOrder: 1 }, owner);
    const struct = await finance.createStructure(tenant, {
      name: 'Past Term Tuition',
      academicYearId: fixture.year.id,
      gradeId: fixture.grade.id,
      feeCategoryId: cat.id,
      amountCents: 100000,
      frequency: 'term_based',
      effectiveFrom: '2026-08-01',
      status: 'active',
    }, owner);

    const pastInvoice = await finance.createInvoice(tenant, {
      studentId: fixture.student.id,
      enrollmentId: fixture.enrollment.id,
      academicYearId: fixture.year.id,
      issueDate: '2026-08-01',
      dueDate: '2026-08-15', // Overdue by more than grace period!
      currency: 'USD',
      feeStructureIds: [struct.id],
      status: 'issued',
    }, owner);

    // Apply late fees
    const applyRes1 = await finance.applyLateFees(tenant, { policyId: policy.id, asOfDate: '2026-09-01' }, owner);
    expect(applyRes1.appliedCount).toBe(1);
    expect(applyRes1.totalLateFeesCents).toBe(2500);

    // Re-run apply late fees: idempotent duplicate prevention!
    const applyRes2 = await finance.applyLateFees(tenant, { policyId: policy.id, asOfDate: '2026-09-01' }, owner);
    expect(applyRes2.appliedCount).toBe(0);
  });

  it('implements complete expense approval lifecycle from draft to disbursement with state locks', async () => {
    const { tenant } = await createSisTenant(database, 'e10m-expenses');
    const finance = new SisFinanceService(database);
    const owner = { userId: 'approver-user', role: 'Owner' };
    const requester = { userId: 'requester-user', role: 'Admin' };

    // 1. Create expense category
    const cat = await finance.createExpenseCategory(tenant, {
      code: 'LAB-SUPPLIES',
      name: 'Laboratory Equipment & Supplies',
      description: 'Chemicals, glassware, apparatus',
      status: 'active',
      displayOrder: 1,
    }, owner);

    // 2. Create draft expense
    const expense = await finance.createExpense(tenant, {
      title: 'Microscopes for Science Lab',
      categoryId: cat.id,
      amountCents: 450000,
      expenseDate: '2026-10-15',
      payee: 'Scientific Equipment Co.',
      paymentMethod: 'bank_transfer',
      description: 'Replacement optics',
    }, requester);

    expect(expense.status).toBe('draft');

    // 3. Submit expense
    const submitted = await finance.submitExpense(tenant, expense.id, requester);
    expect(submitted.status).toBe('submitted');

    // 4. Reject and re-submit test
    const rejected = await finance.rejectExpense(tenant, expense.id, {
      rejectionReason: 'Please attach detailed vendor quotation.',
      rejectedBy: 'Head of Finance',
    }, owner);
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toContain('quotation');

    // Edit rejected expense and re-submit
    await finance.updateExpense(tenant, expense.id, { title: 'Microscopes (Quotation Attached)' }, requester);
    await finance.submitExpense(tenant, expense.id, requester);

    // 5. Approve expense
    const approved = await finance.approveExpense(tenant, expense.id, { approvedBy: 'Finance Director' }, owner);
    expect(approved.status).toBe('approved');

    // 6. Safeguard: Cannot edit approved expense!
    await expect(finance.updateExpense(tenant, expense.id, { title: 'Modified Title' }, requester)).rejects.toMatchObject({
      statusCode: 400,
    });

    // 7. Disburse expense (marks paid)
    const disbursed = await finance.disburseExpense(tenant, expense.id, {
      paymentMethod: 'bank_transfer',
      referenceNumber: 'WIRE-EXP-4401',
      disbursedBy: 'Disbursement Officer',
    }, owner);
    expect(disbursed.status).toBe('paid');

    // 8. Safeguard: Cannot delete paid expense!
    await expect(finance.deleteExpense(tenant, expense.id, owner)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('manages non-tuition income register and delivers comprehensive financial reports', async () => {
    const { tenant } = await createSisTenant(database, 'e10m-reports');
    const sis = new SisService(database);
    const finance = new SisFinanceService(database);
    const fixture = await createClassFixture(sis, tenant);
    const owner = { userId: 'bursar-1', role: 'Owner' };

    // Non-tuition income
    const inc = await finance.createIncome(tenant, {
      source: 'Alumni Association Donation',
      category: 'Donations & Grants',
      amountCents: 500000,
      receivedDate: '2026-10-10',
      paymentMethod: 'bank_transfer',
      referenceNumber: 'DON-2026-001',
      receivedBy: 'Development Office',
    }, owner);
    expect(inc.receiptNumber).toMatch(/^INC-/);

    // Student fee payment
    const cat = await finance.createCategory(tenant, { name: 'General Fee', code: 'GEN-' + randomUUID().slice(0, 6), status: 'active', displayOrder: 1 }, owner);
    const struct = await finance.createStructure(tenant, {
      name: 'Standard Fee',
      academicYearId: fixture.year.id,
      gradeId: fixture.grade.id,
      feeCategoryId: cat.id,
      amountCents: 100000,
      frequency: 'one_time',
      effectiveFrom: '2026-10-01',
      status: 'active',
    }, owner);

    const invoice = await finance.createInvoice(tenant, {
      studentId: fixture.student.id,
      enrollmentId: fixture.enrollment.id,
      academicYearId: fixture.year.id,
      issueDate: '2026-10-01',
      dueDate: '2026-10-31',
      currency: 'USD',
      feeStructureIds: [struct.id],
      status: 'issued',
    }, owner);

    await finance.recordPayment(tenant, {
      invoiceId: invoice.id,
      amountCents: 100000,
      paymentDate: '2026-10-12',
      paymentMethod: 'card',
      receivedBy: 'Cashier',
    }, owner);

    // Ledger reconciliation audit
    const ledgerAudit = await finance.reconcileStudentLedger(tenant, fixture.student.id);
    expect(ledgerAudit.isBalanced).toBe(true);
    expect(ledgerAudit.discrepancyCents).toBe(0);

    const allAudit = await finance.auditLedgerIntegrity(tenant);
    expect(allAudit.totalStudentsChecked).toBeGreaterThanOrEqual(1);
    expect(allAudit.discrepancyStudentsCount).toBe(0);

    // Income vs Expense Report
    const plReport = await finance.incomeExpenseReport(tenant);
    expect(plReport.totalRevenueCents).toBeGreaterThanOrEqual(600000);
    expect(plReport.totalOtherIncomeCents).toBeGreaterThanOrEqual(500000);
    expect(plReport.totalFeeIncomeCents).toBeGreaterThanOrEqual(100000);

    // Cash Flow Report
    const cfReport = await finance.cashFlowReport(tenant);
    expect(cfReport.totalInflowCents).toBeGreaterThanOrEqual(600000);
    expect(cfReport.timeline.length).toBeGreaterThanOrEqual(2);
  });
});

async function createSisTenant(database: DatabaseClient, label: string) {
  const suffix = randomUUID().slice(0, 8);
  const auth = await new AuthService(database).register({
    firstName: 'E10M',
    lastName: 'Owner',
    email: label + '-' + suffix + '@example.com',
    password: 'password123',
    organizationName: 'E10M ' + label + ' ' + suffix,
    organizationType: 'School',
    industry: 'Education',
    country: 'United States',
  });
  const tenant = await new SisService(database).getTenant(auth.memberships[0].organizationId);
  return { auth, tenant };
}

async function createClassFixture(service: SisService, tenant: Awaited<ReturnType<SisService['getTenant']>>) {
  const suffix = randomUUID().slice(0, 6);
  const year = await service.createAcademicYear(tenant, { name: '2026-' + suffix, startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' });
  const grade = await service.createGrade(tenant, { name: 'Grade ' + suffix, level: 1, order: 1, status: 'active' });
  const section = await service.createSection(tenant, { gradeId: grade.id, name: 'A', capacity: 30, status: 'active' });
  const student = await service.createStudent(tenant, {
    admissionNumber: 'ADM-' + suffix,
    firstName: 'Student',
    lastName: 'Learner',
    dateOfBirth: '2016-05-01',
    gender: 'male',
    admissionDate: '2026-01-15',
    status: 'active',
    portalAccessEnabled: true,
  });
  const enrollment = await service.createEnrollment(tenant, {
    studentId: student.id,
    academicYear: year.name,
    gradeId: grade.id,
    sectionId: section.id,
    enrollmentDate: '2026-01-15',
    status: 'active',
  });
  return { year, grade, section, student, enrollment };
}
