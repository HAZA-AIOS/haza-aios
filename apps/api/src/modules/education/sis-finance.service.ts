import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../common/errors/api-error.js';
import type { DatabaseClient } from '../../database/client.js';
import { mapDatabaseError } from '../../database/errors.js';
import { withTransaction } from '../../database/transactions.js';
import {
  academicYears,
  enrollments,
  financeDiscounts,
  financeExpenseCategories,
  financeExpenses,
  financeFeeCategories,
  financeFeeStructures,
  financeIncomes,
  financeInvoices,
  financeLateFeePolicies,
  financePayments,
  financeReceipts,
  financeStudentFeeAssignments,
  gradeLevels,
  students,
} from '../../database/schema.js';

type JsonRecord = Record<string, unknown>;
type Tenant = { organizationId: string; workspaceId: string };
type Actor = { userId?: string; role?: string } | undefined;

type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'voided';
type Invoice = JsonRecord & {
  id: string;
  organizationId: string;
  studentId: string;
  enrollmentId: string;
  academicYearId: string;
  invoiceNumber: string;
  billingPeriod?: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  totalCents: number;
  paidAmountCents: number;
  balanceCents: number;
  adjustments?: JsonRecord[];
  items?: JsonRecord[];
  voidedAt?: string;
  voidReason?: string;
  voidedBy?: string;
};

type Payment = JsonRecord & {
  id: string;
  organizationId: string;
  invoiceId: string;
  studentId: string;
  amountCents: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
  status: string;
  reconciliationStatus?: 'unreconciled' | 'verified' | 'reconciled' | 'disputed';
  reconciledAt?: string;
  reconciledBy?: string;
  bankStatementRef?: string;
  reconciliationNotes?: string;
  unreconciledAt?: string;
  unreconciledBy?: string;
  unreconcileReason?: string;
};

type Receipt = JsonRecord & {
  id: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  studentId: string;
  receiptNumber: string;
  amountCents: number;
  receiptDate: string;
};

function uuid(): string { return randomUUID(); }
function now(): string { return new Date().toISOString(); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function payloadOf(value: unknown): JsonRecord {
  if (typeof value === 'string') {
    try { return JSON.parse(value) as JsonRecord; } catch { return {}; }
  }
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}
function clean<T extends JsonRecord>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
function str(value: unknown): string { return typeof value === 'string' ? value : ''; }
function positive(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new ApiError(400, 'VALIDATION_FAILED', `${label} must be greater than zero.`);
  return Math.round(n);
}
function assertText(value: unknown, label: string): string {
  const out = String(value ?? '').trim();
  if (!out) throw new ApiError(400, 'VALIDATION_FAILED', `${label} is required.`);
  return out;
}
function assertFinance(actor: Actor, permission: string): void {
  if (!actor || ['Owner', 'Admin', 'Accountant'].includes(String(actor.role ?? 'Owner'))) return;
  throw new ApiError(403, 'FORBIDDEN', `Unauthorized: missing permission ${permission}`);
}
function dbError(error: unknown): never {
  const mapped = mapDatabaseError(error);
  if (mapped.code === 'DATABASE_UNIQUE_CONSTRAINT') {
    throw new ApiError(409, 'DATABASE_UNIQUE_CONSTRAINT', 'A finance record with the same unique scope already exists.');
  }
  throw error;
}
function status(invoice: Invoice): InvoiceStatus {
  if (invoice.status === 'draft' || invoice.status === 'cancelled' || invoice.status === 'voided') return invoice.status;
  if (invoice.balanceCents <= 0) return 'paid';
  if (invoice.paidAmountCents > 0) return 'partially_paid';
  if (invoice.dueDate < today()) return 'overdue';
  return 'issued';
}
function dto<T extends JsonRecord>(tenant: Tenant, row: { payload: JsonRecord }): T {
  return { ...payloadOf(row.payload), organizationId: tenant.organizationId } as unknown as T;
}

export class SisFinanceService {
  constructor(private readonly database: DatabaseClient) {}

  // --- Fee Categories ---
  async listCategories(tenant: Tenant) {
    return (await this.database.db.select().from(financeFeeCategories).where(eq(financeFeeCategories.workspaceId, tenant.workspaceId))).map((r) => dto(tenant, r));
  }
  async createCategory(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fees.manage');
    const record = this.withTenant(tenant, {
      ...data,
      id: uuid(),
      name: assertText(data.name, 'Fee category name'),
      code: assertText(data.code, 'Fee category code'),
      status: str(data.status) || 'active',
      displayOrder: Number(data.displayOrder ?? 0),
      createdAt: now(),
      updatedAt: now(),
    });
    await this.database.db.insert(financeFeeCategories).values({
      id: record.id,
      workspaceId: tenant.workspaceId,
      code: String(record.code),
      name: String(record.name),
      status: String(record.status),
      displayOrder: Number(record.displayOrder),
      payload: record,
    }).catch(dbError);
    return record;
  }
  async updateCategory(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fees.manage');
    const current = await this.getPayload(tenant, financeFeeCategories, financeFeeCategories.id, id, 'Fee category');
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, updatedAt: now() });
    await this.database.db.update(financeFeeCategories).set({
      code: String(record.code),
      name: String(record.name),
      status: String(record.status),
      displayOrder: Number(record.displayOrder ?? 0),
      payload: record,
      updatedAt: new Date(),
    }).where(and(eq(financeFeeCategories.workspaceId, tenant.workspaceId), eq(financeFeeCategories.id, id))).catch(dbError);
    return record;
  }
  async deleteCategory(tenant: Tenant, id: string, actor?: Actor) {
    assertFinance(actor, 'fees.manage');
    const structures = await this.database.db.select().from(financeFeeStructures).where(and(eq(financeFeeStructures.workspaceId, tenant.workspaceId), eq(financeFeeStructures.feeCategoryId, id)));
    if (structures.length > 0) throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot delete fee category with existing fee structures.');
    await this.database.db.delete(financeFeeCategories).where(and(eq(financeFeeCategories.workspaceId, tenant.workspaceId), eq(financeFeeCategories.id, id)));
    return { success: true, id };
  }

  // --- Fee Structures ---
  async listStructures(tenant: Tenant) {
    return (await this.database.db.select().from(financeFeeStructures).where(eq(financeFeeStructures.workspaceId, tenant.workspaceId))).map((r) => dto(tenant, r));
  }
  async createStructure(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fee_structure.manage');
    const amountCents = positive(data.amountCents, 'Fee amount');
    await Promise.all([
      this.assertRow(academicYears, academicYears.id, tenant.workspaceId, str(data.academicYearId), 'Academic year'),
      this.assertRow(gradeLevels, gradeLevels.id, tenant.workspaceId, str(data.gradeId), 'Grade'),
      this.assertRow(financeFeeCategories, financeFeeCategories.id, tenant.workspaceId, str(data.feeCategoryId), 'Fee category'),
    ]);
    const record = this.withTenant<JsonRecord>(tenant, {
      ...data,
      id: uuid(),
      name: assertText(data.name, 'Fee structure name'),
      amountCents,
      status: str(data.status) || 'active',
      createdAt: now(),
      updatedAt: now(),
    });
    await this.database.db.insert(financeFeeStructures).values({
      id: String(record.id),
      workspaceId: tenant.workspaceId,
      academicYearId: str(record.academicYearId),
      gradeId: str(record.gradeId),
      feeCategoryId: str(record.feeCategoryId),
      name: String(record.name),
      amountCents,
      status: String(record.status),
      payload: record,
    }).catch(dbError);
    return record;
  }
  async updateStructure(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fee_structure.manage');
    const current = await this.getPayload(tenant, financeFeeStructures, financeFeeStructures.id, id, 'Fee structure');
    const amountCents = data.amountCents === undefined ? Number(current.amountCents) : positive(data.amountCents, 'Fee amount');
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, amountCents, updatedAt: now() });
    await this.database.db.update(financeFeeStructures).set({
      name: String(record.name),
      amountCents,
      status: String(record.status),
      payload: record,
      updatedAt: new Date(),
    }).where(and(eq(financeFeeStructures.workspaceId, tenant.workspaceId), eq(financeFeeStructures.id, id))).catch(dbError);
    return record;
  }
  async deleteStructure(tenant: Tenant, id: string, actor?: Actor) {
    assertFinance(actor, 'fee_structure.manage');
    const assignments = await this.database.db.select().from(financeStudentFeeAssignments).where(and(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId), eq(financeStudentFeeAssignments.feeStructureId, id)));
    if (assignments.length > 0) throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot delete fee structure currently assigned to students. Deactivate it instead.');
    await this.database.db.delete(financeFeeStructures).where(and(eq(financeFeeStructures.workspaceId, tenant.workspaceId), eq(financeFeeStructures.id, id)));
    return { success: true, id };
  }

  // --- Student Fee Assignments ---
  async assignFee(tenant: Tenant, studentId: string, enrollmentId: string, feeStructureId: string, actor?: Actor) {
    assertFinance(actor, 'fee_structure.manage');
    await Promise.all([
      this.assertRow(students, students.id, tenant.workspaceId, studentId, 'Student'),
      this.assertRow(enrollments, enrollments.id, tenant.workspaceId, enrollmentId, 'Enrollment'),
    ]);
    const structure = await this.getPayload<JsonRecord & { amountCents: number; status: string }>(tenant, financeFeeStructures, financeFeeStructures.id, feeStructureId, 'Fee structure');
    if (structure.status !== 'active') throw new ApiError(400, 'VALIDATION_FAILED', 'Only active fee structures can be assigned.');
    const existing = (await this.database.db.select().from(financeStudentFeeAssignments).where(and(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId), eq(financeStudentFeeAssignments.studentId, studentId), eq(financeStudentFeeAssignments.enrollmentId, enrollmentId), eq(financeStudentFeeAssignments.feeStructureId, feeStructureId))).limit(1))[0];
    if (existing) return dto(tenant, existing);
    const record = this.withTenant(tenant, {
      id: uuid(),
      studentId,
      enrollmentId,
      feeStructureId,
      amountCents: Number(structure.amountCents),
      status: 'active',
      assignedAt: now(),
      createdAt: now(),
      updatedAt: now(),
    });
    await this.database.db.insert(financeStudentFeeAssignments).values({
      id: record.id,
      workspaceId: tenant.workspaceId,
      studentId,
      enrollmentId,
      feeStructureId,
      status: 'active',
      amountCents: Number(record.amountCents),
      payload: record,
    }).catch(dbError);
    return record;
  }
  async unassignFee(tenant: Tenant, assignmentId: string, actor?: Actor) {
    assertFinance(actor, 'fee_structure.manage');
    await this.getPayload(tenant, financeStudentFeeAssignments, financeStudentFeeAssignments.id, assignmentId, 'Fee assignment');
    await this.database.db.delete(financeStudentFeeAssignments).where(and(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId), eq(financeStudentFeeAssignments.id, assignmentId)));
    return { success: true, id: assignmentId };
  }
  async bulkAssignFee(tenant: Tenant, data: { academicYearId: string; gradeId?: string; sectionId?: string; feeStructureId: string }, actor?: Actor) {
    assertFinance(actor, 'fee_structure.manage');
    const structure = await this.getPayload<JsonRecord & { amountCents: number; status: string }>(tenant, financeFeeStructures, financeFeeStructures.id, data.feeStructureId, 'Fee structure');
    if (structure.status !== 'active') throw new ApiError(400, 'VALIDATION_FAILED', 'Only active fee structures can be assigned.');

    const enrollmentRows = await this.database.db.select().from(enrollments).where(eq(enrollments.workspaceId, tenant.workspaceId));
    const targetEnrollments = enrollmentRows.filter((e) => {
      if (e.status !== 'active') return false;
      if (data.gradeId && e.gradeId !== data.gradeId) return false;
      if (data.sectionId && e.sectionId !== data.sectionId) return false;
      return true;
    });

    const existingAssignments = await this.database.db.select().from(financeStudentFeeAssignments).where(and(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId), eq(financeStudentFeeAssignments.feeStructureId, data.feeStructureId)));
    const assignedStudentIds = new Set(existingAssignments.map((a) => a.studentId));

    const created: JsonRecord[] = [];
    for (const enr of targetEnrollments) {
      if (assignedStudentIds.has(enr.studentId)) continue;
      const record = this.withTenant(tenant, {
        id: uuid(),
        studentId: enr.studentId,
        enrollmentId: enr.id,
        feeStructureId: data.feeStructureId,
        amountCents: Number(structure.amountCents),
        status: 'active',
        assignedAt: now(),
        createdAt: now(),
        updatedAt: now(),
      });
      await this.database.db.insert(financeStudentFeeAssignments).values({
        id: record.id,
        workspaceId: tenant.workspaceId,
        studentId: enr.studentId,
        enrollmentId: enr.id,
        feeStructureId: data.feeStructureId,
        status: 'active',
        amountCents: Number(record.amountCents),
        payload: record,
      }).catch(() => null);
      created.push(record);
    }
    return { success: true, count: created.length, assignedCount: created.length, totalEligible: targetEnrollments.length, assignments: created };
  }
  async listAssignments(tenant: Tenant, studentId?: string) {
    const rows = studentId ? await this.database.db.select().from(financeStudentFeeAssignments).where(and(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId), eq(financeStudentFeeAssignments.studentId, studentId))) : await this.database.db.select().from(financeStudentFeeAssignments).where(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId));
    return rows.map((r) => dto(tenant, r));
  }
  async listStudentFeeAssignments(tenant: Tenant, studentId?: string) {
    return this.listAssignments(tenant, studentId);
  }

  // --- Discounts ---
  async listDiscounts(tenant: Tenant) {
    return (await this.database.db.select().from(financeDiscounts).where(eq(financeDiscounts.workspaceId, tenant.workspaceId))).map((r) => dto(tenant, r));
  }
  async createDiscount(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'discount.manage');
    if (data.type === 'fixed') positive(data.value, 'Discount');
    if (data.type === 'percentage' && (Number(data.value) <= 0 || Number(data.value) > 100)) throw new ApiError(400, 'VALIDATION_FAILED', 'Percentage discount must be between 0 and 100.');
    if (data.studentId) await this.assertRow(students, students.id, tenant.workspaceId, str(data.studentId), 'Student');
    if (data.feeCategoryId) await this.assertRow(financeFeeCategories, financeFeeCategories.id, tenant.workspaceId, str(data.feeCategoryId), 'Fee category');
    const record = this.withTenant<JsonRecord>(tenant, {
      ...data,
      id: uuid(),
      name: assertText(data.name, 'Discount name'),
      reason: assertText(data.reason, 'Discount reason'),
      authorizedBy: assertText(data.authorizedBy, 'Discount authorizer'),
      status: str(data.status) || 'active',
      createdAt: now(),
      updatedAt: now(),
    });
    await this.database.db.insert(financeDiscounts).values({
      id: String(record.id),
      workspaceId: tenant.workspaceId,
      studentId: str(record.studentId) || undefined,
      feeCategoryId: str(record.feeCategoryId) || undefined,
      name: String(record.name),
      discountType: String(record.type),
      status: String(record.status),
      payload: record,
    }).catch(dbError);
    return record;
  }

  // --- Invoices ---
  async createInvoice(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'invoice.create');
    if (new Date(str(data.issueDate)) > new Date(str(data.dueDate))) throw new ApiError(400, 'VALIDATION_FAILED', 'Invoice issue date must be before due date.');
    const studentId = str(data.studentId);
    const enrollmentId = str(data.enrollmentId);
    const academicYearId = str(data.academicYearId);
    const [enrollment] = await Promise.all([
      this.assertRow(enrollments, enrollments.id, tenant.workspaceId, enrollmentId, 'Enrollment'),
      this.assertRow(students, students.id, tenant.workspaceId, studentId, 'Student'),
      this.assertRow(academicYears, academicYears.id, tenant.workspaceId, academicYearId, 'Academic year'),
    ]);
    if ((enrollment as { studentId?: string }).studentId !== studentId) throw new ApiError(400, 'VALIDATION_FAILED', 'Enrollment does not belong to student.');
    const requestedStructures = new Set((Array.isArray(data.feeStructureIds) ? data.feeStructureIds : []).map(String));
    const assignmentRows = await this.database.db.select().from(financeStudentFeeAssignments).where(and(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId), eq(financeStudentFeeAssignments.studentId, studentId), eq(financeStudentFeeAssignments.enrollmentId, enrollmentId)));
    const assignments = assignmentRows.map((r) => dto<JsonRecord & { id: string; feeStructureId: string; amountCents: number; status: string }>(tenant, r)).filter((a) => a.status === 'active' && ((Array.isArray(data.assignmentIds) && data.assignmentIds.map(String).includes(a.id)) || requestedStructures.has(a.feeStructureId)));
    for (const structureId of requestedStructures) {
      if (!assignments.some((a) => a.feeStructureId === structureId)) {
        assignments.push((await this.assignFee(tenant, studentId, enrollmentId, structureId, actor)) as JsonRecord & { id: string; feeStructureId: string; amountCents: number; status: string });
      }
    }
    if (!assignments.length) throw new ApiError(400, 'VALIDATION_FAILED', 'At least one active fee assignment is required to create an invoice.');
    const structures = (await this.listStructures(tenant)) as Array<JsonRecord & { id: string; name: string; feeCategoryId: string }>;
    const discounts = ((await this.listDiscounts(tenant)) as Array<JsonRecord & { id: string; type: string; value: number; studentId?: string; feeCategoryId?: string; status: string }>).filter((d) => d.status === 'active' && Array.isArray(data.discountIds) && data.discountIds.map(String).includes(d.id));
    const lineItems = assignments.map((assignment) => {
      const structure = structures.find((s) => s.id === assignment.feeStructureId);
      if (!structure) throw new ApiError(404, 'NOT_FOUND', 'Fee structure not found for assignment.');
      const discountCents = discounts.filter((d) => (!d.studentId || d.studentId === studentId) && (!d.feeCategoryId || d.feeCategoryId === structure.feeCategoryId)).reduce((sum, d) => sum + (d.type === 'fixed' ? Number(d.value) : Math.round((Number(assignment.amountCents) * Number(d.value)) / 100)), 0);
      const finalDiscount = Math.min(discountCents, Number(assignment.amountCents));
      return {
        id: uuid(),
        feeCategoryId: structure.feeCategoryId,
        feeStructureId: structure.id,
        description: structure.name,
        quantity: 1,
        amountCents: Number(assignment.amountCents),
        discountCents: finalDiscount,
        adjustmentCents: 0,
        finalAmountCents: Number(assignment.amountCents) - finalDiscount,
      };
    });
    const adjustments = (Array.isArray(data.adjustments) ? data.adjustments : []).map((a) => ({
      ...(a as JsonRecord),
      id: uuid(),
      amountCents: positive((a as JsonRecord).amountCents, 'Adjustment'),
      createdAt: now(),
    }));
    const subtotalCents = lineItems.reduce((sum, i) => sum + i.amountCents, 0);
    const discountCents = lineItems.reduce((sum, i) => sum + i.discountCents, 0);
    const adjustmentCents = adjustments.reduce((sum, i) => sum + Number(i.amountCents), 0);
    const totalCents = Math.max(0, subtotalCents - discountCents - adjustmentCents);
    const invoiceNumber = await this.nextNumber(tenant, 'INV', financeInvoices, financeInvoices.invoiceNumber);
    const record = this.withTenant<JsonRecord>(tenant, {
      id: uuid(),
      studentId,
      enrollmentId,
      academicYearId,
      invoiceNumber,
      billingPeriod: str(data.billingPeriod) || undefined,
      issueDate: str(data.issueDate),
      dueDate: str(data.dueDate),
      status: (str(data.status) || 'draft') as InvoiceStatus,
      currency: str(data.currency) || 'USD',
      items: lineItems,
      discountCents,
      adjustmentCents,
      subtotalCents,
      totalCents,
      paidAmountCents: 0,
      balanceCents: totalCents,
      adjustments,
      notificationEvents: data.status === 'issued' ? ['invoice.issued'] : [],
      issuedAt: data.status === 'issued' ? now() : undefined,
      createdAt: now(),
      updatedAt: now(),
    }) as Invoice & { items: JsonRecord[] };
    record.status = status(record);
    await this.database.db.insert(financeInvoices).values({
      id: record.id,
      workspaceId: tenant.workspaceId,
      studentId,
      enrollmentId,
      academicYearId,
      invoiceNumber,
      issueDate: record.issueDate,
      dueDate: record.dueDate,
      status: record.status,
      totalCents,
      paidAmountCents: 0,
      balanceCents: totalCents,
      payload: record,
    }).catch(dbError);
    return record;
  }

  async issueInvoice(tenant: Tenant, invoiceId: string, actor?: Actor) {
    assertFinance(actor, 'invoice.update');
    const invoice = await this.getPayload<Invoice>(tenant, financeInvoices, financeInvoices.id, invoiceId, 'Invoice');
    if (invoice.status !== 'draft') throw new ApiError(400, 'VALIDATION_FAILED', 'Only draft invoices can be issued.');
    const updated = {
      ...invoice,
      status: 'issued' as InvoiceStatus,
      issuedAt: now(),
      notificationEvents: [...(Array.isArray(invoice.notificationEvents) ? invoice.notificationEvents : []), 'invoice.issued'],
      updatedAt: now(),
    };
    updated.status = status(updated);
    await this.saveInvoice(tenant, updated);
    return updated;
  }

  async voidInvoice(tenant: Tenant, invoiceId: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'invoice.update');
    const reason = assertText(data.reason, 'Void reason');
    const invoice = await this.getPayload<Invoice>(tenant, financeInvoices, financeInvoices.id, invoiceId, 'Invoice');
    if (invoice.status === 'voided') throw new ApiError(400, 'VALIDATION_FAILED', 'Invoice is already voided.');
    if (invoice.paidAmountCents > 0) throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot void an invoice with recorded payments. Void the payments first.');
    const updated: Invoice = {
      ...invoice,
      status: 'voided' as InvoiceStatus,
      balanceCents: 0,
      voidedAt: now(),
      voidReason: reason,
      voidedBy: str(data.authorizedBy) || actor?.userId || 'Finance Admin',
      updatedAt: now(),
    };
    await this.saveInvoice(tenant, updated);
    return updated;
  }

  async generateRecurringInvoices(
    tenant: Tenant,
    data: {
      academicYearId: string;
      billingPeriod: string;
      gradeId?: string;
      sectionId?: string;
      feeStructureIds: string[];
      issueDate: string;
      dueDate: string;
      issueNow?: boolean;
    },
    actor?: Actor
  ) {
    assertFinance(actor, 'invoice.create');
    if (!data.billingPeriod) throw new ApiError(400, 'VALIDATION_FAILED', 'Billing period is required (e.g. 2026-10).');
    if (!Array.isArray(data.feeStructureIds) || !data.feeStructureIds.length) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'At least one fee structure is required for recurring billing.');
    }
    if (new Date(data.issueDate) > new Date(data.dueDate)) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Issue date must be before due date.');
    }

    await this.assertRow(academicYears, academicYears.id, tenant.workspaceId, data.academicYearId, 'Academic year');

    const enrollmentRows = await this.database.db.select().from(enrollments).where(eq(enrollments.workspaceId, tenant.workspaceId));
    const activeEnrollments = enrollmentRows.filter((e) => {
      if (e.status !== 'active') return false;
      if (data.gradeId && e.gradeId !== data.gradeId) return false;
      if (data.sectionId && e.sectionId !== data.sectionId) return false;
      return true;
    });

    if (!activeEnrollments.length) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'No active student enrollments found matching selected criteria.');
    }

    const existingInvoices = ((await this.listInvoices(tenant, { academicYearId: data.academicYearId })) as Invoice[]).filter(
      (i) => !['cancelled', 'voided'].includes(i.status)
    );

    const studentsList = await this.database.db.select().from(students).where(eq(students.workspaceId, tenant.workspaceId));
    const studentMap = new Map(studentsList.map((s) => [s.id, s]));

    const generated: Invoice[] = [];
    const skippedDetails: Array<{ studentId: string; studentName: string; reason: string }> = [];

    for (const enr of activeEnrollments) {
      const st = studentMap.get(enr.studentId);
      const studentName = st ? `${st.firstName} ${st.lastName}` : enr.studentId;

      if (st && st.status === 'archived') {
        skippedDetails.push({
          studentId: enr.studentId,
          studentName,
          reason: `Student is archived`,
        });
        continue;
      }

      const duplicate = existingInvoices.find((inv) => {
        if (inv.studentId !== enr.studentId) return false;
        if (inv.billingPeriod === data.billingPeriod) return true;
        return false;
      });

      if (duplicate) {
        skippedDetails.push({
          studentId: enr.studentId,
          studentName,
          reason: `Invoice ${duplicate.invoiceNumber} already exists for billing period ${data.billingPeriod}`,
        });
        continue;
      }

      const invoice = await this.createInvoice(
        tenant,
        {
          studentId: enr.studentId,
          enrollmentId: enr.id,
          academicYearId: data.academicYearId,
          billingPeriod: data.billingPeriod,
          feeStructureIds: data.feeStructureIds,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          status: data.issueNow ? 'issued' : 'draft',
        },
        actor
      );
      generated.push(invoice);
    }

    return {
      success: true,
      billingPeriod: data.billingPeriod,
      createdInvoicesCount: generated.length,
      generatedCount: generated.length,
      skippedDuplicatesCount: skippedDetails.length,
      skippedCount: skippedDetails.length,
      totalBilledCents: generated.reduce((s, i) => s + i.totalCents, 0),
      invoices: generated,
      skippedDetails,
    };
  }

  async listInvoices(tenant: Tenant, filters: URLSearchParams | JsonRecord = {}) {
    const rows = await this.database.db.select().from(financeInvoices).where(eq(financeInvoices.workspaceId, tenant.workspaceId)).orderBy(desc(financeInvoices.issueDate));
    const get = (k: string) => (filters instanceof URLSearchParams ? filters.get(k) ?? undefined : (filters[k] as string | undefined));
    return rows
      .map((r) => {
        const invoice = dto<Invoice & { items?: JsonRecord[] }>(tenant, r);
        return { ...invoice, status: status(invoice) };
      })
      .filter((i) => (!get('academicYearId') || i.academicYearId === get('academicYearId')) && (!get('studentId') || i.studentId === get('studentId')) && (!get('status') || i.status === get('status')) && (!get('billingPeriod') || i.billingPeriod === get('billingPeriod')) && (!get('dateFrom') || i.issueDate >= String(get('dateFrom'))) && (!get('dateTo') || i.issueDate <= String(get('dateTo'))) && (!get('feeCategoryId') || (Array.isArray(i.items) && i.items.some((item: JsonRecord) => item.feeCategoryId === get('feeCategoryId')))));
  }

  // --- Payments & Reconciliation ---
  async recordPayment(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'payment.record');
    const amountCents = positive(data.amountCents, 'Payment');
    return withTransaction(this.database, async () => {
      const invoice = await this.getPayload<Invoice>(tenant, financeInvoices, financeInvoices.id, str(data.invoiceId), 'Invoice');
      if (['draft', 'cancelled', 'voided'].includes(invoice.status)) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Payments can only be recorded against issued invoices.');
      }
      if (amountCents > invoice.balanceCents) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Payment exceeds outstanding invoice balance.');
      }
      const referenceNumber = str(data.referenceNumber).trim() || undefined;
      if (referenceNumber) {
        const refs = await this.database.db.select().from(financePayments).where(and(eq(financePayments.workspaceId, tenant.workspaceId), eq(financePayments.referenceNumber, referenceNumber)));
        if (refs.some((r) => (payloadOf(r.payload) as Payment).status !== 'voided')) {
          throw new ApiError(409, 'DATABASE_UNIQUE_CONSTRAINT', 'Payment reference number already exists.');
        }
      }
      const payment = this.withTenant<JsonRecord>(tenant, {
        id: uuid(),
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amountCents,
        paymentDate: str(data.paymentDate),
        paymentMethod: str(data.paymentMethod),
        referenceNumber,
        receivedBy: str(data.receivedBy),
        notes: str(data.notes) || undefined,
        status: 'recorded',
        reconciliationStatus: 'unreconciled',
        createdAt: now(),
        updatedAt: now(),
      }) as Payment;
      const receiptNumber = await this.nextNumber(tenant, 'RCT', financeReceipts, financeReceipts.receiptNumber);
      const receipt = this.withTenant<JsonRecord>(tenant, {
        id: uuid(),
        invoiceId: invoice.id,
        paymentId: payment.id,
        studentId: invoice.studentId,
        receiptNumber,
        amountCents,
        paymentMethod: payment.paymentMethod,
        referenceNumber,
        receiptDate: payment.paymentDate,
        createdAt: now(),
        updatedAt: now(),
      }) as Receipt;
      const updatedInvoice: Invoice = {
        ...invoice,
        paidAmountCents: invoice.paidAmountCents + amountCents,
        balanceCents: Math.max(0, invoice.totalCents - invoice.paidAmountCents - amountCents),
        notificationEvents: [...(Array.isArray(invoice.notificationEvents) ? invoice.notificationEvents : []), 'payment.received'],
        updatedAt: now(),
      };
      updatedInvoice.status = status(updatedInvoice);
      await this.database.db.insert(financePayments).values({
        id: payment.id,
        workspaceId: tenant.workspaceId,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amountCents,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        referenceNumber,
        status: payment.status,
        payload: payment,
      });
      await this.database.db.insert(financeReceipts).values({
        id: receipt.id,
        workspaceId: tenant.workspaceId,
        invoiceId: invoice.id,
        paymentId: payment.id,
        studentId: invoice.studentId,
        receiptNumber,
        amountCents,
        receiptDate: receipt.receiptDate,
        payload: receipt,
      });
      await this.saveInvoice(tenant, updatedInvoice);
      return { payment, receipt, invoice: updatedInvoice };
    });
  }

  async reconcilePayment(tenant: Tenant, paymentId: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'payment.reconcile');
    const payment = await this.getPayload<Payment>(tenant, financePayments, financePayments.id, paymentId, 'Payment');
    if (payment.status === 'voided') throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot reconcile a voided payment.');
    const targetStatus = (str(data.status) || 'reconciled') as 'verified' | 'reconciled';
    const reconciledPayment: Payment = {
      ...payment,
      reconciliationStatus: targetStatus,
      reconciledAt: now(),
      reconciledBy: str(data.reconciledBy) || actor?.userId || 'Accountant',
      bankStatementRef: str(data.bankStatementRef) || payment.referenceNumber || '',
      reconciliationNotes: str(data.notes) || undefined,
      updatedAt: now(),
    };
    await this.database.db.update(financePayments).set({
      payload: reconciledPayment,
      updatedAt: new Date(),
    }).where(and(eq(financePayments.workspaceId, tenant.workspaceId), eq(financePayments.id, paymentId)));
    return reconciledPayment;
  }

  async unreconcilePayment(tenant: Tenant, paymentId: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'payment.reconcile');
    const payment = await this.getPayload<Payment>(tenant, financePayments, financePayments.id, paymentId, 'Payment');
    const unreconciledPayment: Payment = {
      ...payment,
      reconciliationStatus: 'unreconciled',
      unreconciledAt: now(),
      unreconciledBy: str(data.authorizedBy) || actor?.userId || 'Accountant',
      unreconcileReason: assertText(data.reason, 'Unreconcile reason'),
      updatedAt: now(),
    };
    await this.database.db.update(financePayments).set({
      payload: unreconciledPayment,
      updatedAt: new Date(),
    }).where(and(eq(financePayments.workspaceId, tenant.workspaceId), eq(financePayments.id, paymentId)));
    return unreconciledPayment;
  }

  async voidPayment(tenant: Tenant, paymentId: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'payment.void');
    const reason = assertText(data.reason, 'Void reason');
    const authorizedBy = assertText(data.authorizedBy, 'Void authorizer');
    const payment = await this.getPayload<Payment>(tenant, financePayments, financePayments.id, paymentId, 'Payment');
    if (payment.status === 'voided') throw new ApiError(400, 'VALIDATION_FAILED', 'Payment is already voided.');
    if (payment.reconciliationStatus === 'reconciled') {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot void a reconciled payment. Please unreconcile the payment first.');
    }
    const invoice = await this.getPayload<Invoice>(tenant, financeInvoices, financeInvoices.id, payment.invoiceId, 'Invoice');
    const updatedPayment: Payment = {
      ...payment,
      status: 'voided',
      voidedAt: now(),
      voidReason: reason,
      voidedBy: authorizedBy,
      updatedAt: now(),
    };
    const updatedInvoice: Invoice = {
      ...invoice,
      paidAmountCents: Math.max(0, invoice.paidAmountCents - payment.amountCents),
      balanceCents: Math.max(0, invoice.totalCents - Math.max(0, invoice.paidAmountCents - payment.amountCents)),
      updatedAt: now(),
    };
    updatedInvoice.status = status(updatedInvoice);
    await this.database.db.update(financePayments).set({
      status: 'voided',
      payload: updatedPayment,
      updatedAt: new Date(),
    }).where(and(eq(financePayments.workspaceId, tenant.workspaceId), eq(financePayments.id, paymentId)));
    await this.saveInvoice(tenant, updatedInvoice);
    return updatedPayment;
  }

  async listPayments(tenant: Tenant, studentId?: string) {
    const rows = studentId ? await this.database.db.select().from(financePayments).where(and(eq(financePayments.workspaceId, tenant.workspaceId), eq(financePayments.studentId, studentId))) : await this.database.db.select().from(financePayments).where(eq(financePayments.workspaceId, tenant.workspaceId));
    return rows.map((r) => dto(tenant, r));
  }
  async listReceipts(tenant: Tenant, studentId?: string) {
    const rows = studentId ? await this.database.db.select().from(financeReceipts).where(and(eq(financeReceipts.workspaceId, tenant.workspaceId), eq(financeReceipts.studentId, studentId))) : await this.database.db.select().from(financeReceipts).where(eq(financeReceipts.workspaceId, tenant.workspaceId));
    return rows.map((r) => dto(tenant, r));
  }

  // --- Late Fee Policies ---
  async listLateFeePolicies(tenant: Tenant) {
    const rows = await this.database.db.select().from(financeLateFeePolicies).where(eq(financeLateFeePolicies.workspaceId, tenant.workspaceId));
    return rows.map((r) => dto(tenant, r));
  }

  async createLateFeePolicy(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'late_fee.manage');
    const academicYearId = str(data.academicYearId);
    await this.assertRow(academicYears, academicYears.id, tenant.workspaceId, academicYearId, 'Academic year');
    const feeType = str(data.feeType) || 'fixed';
    const amountCents = data.amountCents ? Number(data.amountCents) : 0;
    const percentageRate = data.percentageRate ? Number(data.percentageRate) : 0;
    const maxCapCents = data.maxCapCents ? Number(data.maxCapCents) : 0;
    const gracePeriodDays = Math.max(0, Number(data.gracePeriodDays ?? 5));
    const record = this.withTenant(tenant, {
      id: uuid(),
      academicYearId,
      name: assertText(data.name, 'Policy name'),
      code: assertText(data.code, 'Policy code'),
      gracePeriodDays,
      feeType,
      amountCents,
      percentageRate,
      maxCapCents,
      status: str(data.status) || 'active',
      applyAutomatically: Boolean(data.applyAutomatically),
      createdAt: now(),
      updatedAt: now(),
    });
    await this.database.db.insert(financeLateFeePolicies).values({
      id: record.id,
      workspaceId: tenant.workspaceId,
      academicYearId,
      code: String(record.code),
      name: String(record.name),
      gracePeriodDays,
      feeType,
      amountCents,
      percentageRate,
      maxCapCents,
      status: String(record.status),
      applyAutomatically: Boolean(record.applyAutomatically),
      payload: record,
    }).catch(dbError);
    return record;
  }

  async updateLateFeePolicy(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'late_fee.manage');
    const current = await this.getPayload(tenant, financeLateFeePolicies, financeLateFeePolicies.id, id, 'Late fee policy');
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, updatedAt: now() });
    await this.database.db.update(financeLateFeePolicies).set({
      name: String(record.name),
      code: String(record.code),
      gracePeriodDays: Number(record.gracePeriodDays ?? 5),
      feeType: String(record.feeType ?? 'fixed'),
      amountCents: Number(record.amountCents ?? 0),
      percentageRate: Number(record.percentageRate ?? 0),
      maxCapCents: Number(record.maxCapCents ?? 0),
      status: String(record.status ?? 'active'),
      applyAutomatically: Boolean(record.applyAutomatically),
      payload: record,
      updatedAt: new Date(),
    }).where(and(eq(financeLateFeePolicies.workspaceId, tenant.workspaceId), eq(financeLateFeePolicies.id, id))).catch(dbError);
    return record;
  }

  async deleteLateFeePolicy(tenant: Tenant, id: string, actor?: Actor) {
    assertFinance(actor, 'late_fee.manage');
    await this.database.db.delete(financeLateFeePolicies).where(and(eq(financeLateFeePolicies.workspaceId, tenant.workspaceId), eq(financeLateFeePolicies.id, id)));
    return { success: true, id };
  }

  async applyLateFees(tenant: Tenant, data: { policyId?: string; academicYearId?: string; asOfDate?: string }, actor?: Actor) {
    assertFinance(actor, 'late_fee.manage');
    const checkDate = data.asOfDate || today();
    const policies = ((await this.listLateFeePolicies(tenant)) as Array<JsonRecord & { id: string; academicYearId: string; gracePeriodDays: number; feeType: string; amountCents: number; percentageRate: number; maxCapCents: number; status: string; name: string }>);
    const activePolicies = policies.filter((p) => p.status === 'active' && (!data.policyId || p.id === data.policyId) && (!data.academicYearId || p.academicYearId === data.academicYearId));
    if (!activePolicies.length) throw new ApiError(400, 'VALIDATION_FAILED', 'No active late fee policy found.');

    const policy = activePolicies[0];
    const invoices = ((await this.listInvoices(tenant)) as Invoice[]).filter((i) => {
      if (['draft', 'paid', 'cancelled', 'voided'].includes(i.status)) return false;
      if (policy.academicYearId && i.academicYearId !== policy.academicYearId) return false;
      if (i.dueDate >= checkDate) return false;
      const dueTime = new Date(i.dueDate).getTime();
      const currentTime = new Date(checkDate).getTime();
      const daysOverdue = Math.floor((currentTime - dueTime) / (1000 * 60 * 60 * 24));
      return daysOverdue > policy.gracePeriodDays;
    });

    let assessedCount = 0;
    let totalPenaltyCents = 0;
    const updatedInvoices: Invoice[] = [];

    for (const invoice of invoices) {
      const existingAdjustments = Array.isArray(invoice.adjustments) ? invoice.adjustments : [];
      const alreadyApplied = existingAdjustments.some((a: JsonRecord) => a.type === 'penalty' && (a.policyId === policy.id || String(a.description).toLowerCase().includes('late fee')));
      if (alreadyApplied) continue;

      let penaltyCents = 0;
      if (policy.feeType === 'fixed') {
        penaltyCents = policy.amountCents;
      } else if (policy.feeType === 'percentage') {
        penaltyCents = Math.round((invoice.balanceCents * policy.percentageRate) / 100);
      } else if (policy.feeType === 'daily_fixed') {
        const daysOverdue = Math.floor((new Date(checkDate).getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)) - policy.gracePeriodDays;
        penaltyCents = Math.max(0, daysOverdue * policy.amountCents);
      }
      if (policy.maxCapCents > 0) {
        penaltyCents = Math.min(penaltyCents, policy.maxCapCents);
      }
      if (penaltyCents <= 0) continue;

      const adjustment = {
        id: uuid(),
        type: 'penalty',
        policyId: policy.id,
        description: `Late fee assessed (${policy.name})`,
        amountCents: penaltyCents,
        reason: `Overdue past ${policy.gracePeriodDays}-day grace period`,
        authorizedBy: actor?.userId || 'System',
        createdAt: now(),
      };

      const newTotalCents = invoice.totalCents + penaltyCents;
      const newBalanceCents = invoice.balanceCents + penaltyCents;
      const updatedInvoice: Invoice = {
        ...invoice,
        totalCents: newTotalCents,
        balanceCents: newBalanceCents,
        adjustments: [...existingAdjustments, adjustment],
        updatedAt: now(),
      };
      updatedInvoice.status = status(updatedInvoice);
      await this.saveInvoice(tenant, updatedInvoice);
      updatedInvoices.push(updatedInvoice);
      assessedCount++;
      totalPenaltyCents += penaltyCents;
    }

    return {
      appliedCount: assessedCount,
      assessedCount,
      totalLateFeesCents: totalPenaltyCents,
      totalPenaltyCents,
      policyName: policy.name,
      invoices: updatedInvoices,
    };
  }

  // --- Expenses & Approval Workflows ---
  async listExpenseCategories(tenant: Tenant) {
    const rows = await this.database.db.select().from(financeExpenseCategories).where(eq(financeExpenseCategories.workspaceId, tenant.workspaceId));
    return rows.map((r) => dto(tenant, r));
  }

  async createExpenseCategory(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'expense.manage');
    const record = this.withTenant(tenant, {
      id: uuid(),
      name: assertText(data.name, 'Expense category name'),
      code: assertText(data.code, 'Expense category code'),
      status: str(data.status) || 'active',
      displayOrder: Number(data.displayOrder ?? 0),
      createdAt: now(),
      updatedAt: now(),
    });
    await this.database.db.insert(financeExpenseCategories).values({
      id: record.id,
      workspaceId: tenant.workspaceId,
      code: String(record.code),
      name: String(record.name),
      status: String(record.status),
      displayOrder: Number(record.displayOrder),
      payload: record,
    }).catch(dbError);
    return record;
  }

  async updateExpenseCategory(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'expense.manage');
    const current = await this.getPayload(tenant, financeExpenseCategories, financeExpenseCategories.id, id, 'Expense category');
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, updatedAt: now() });
    await this.database.db.update(financeExpenseCategories).set({
      code: String(record.code),
      name: String(record.name),
      status: String(record.status),
      displayOrder: Number(record.displayOrder ?? 0),
      payload: record,
      updatedAt: new Date(),
    }).where(and(eq(financeExpenseCategories.workspaceId, tenant.workspaceId), eq(financeExpenseCategories.id, id))).catch(dbError);
    return record;
  }

  async deleteExpenseCategory(tenant: Tenant, id: string, actor?: Actor) {
    assertFinance(actor, 'expense.manage');
    const expenses = await this.database.db.select().from(financeExpenses).where(and(eq(financeExpenses.workspaceId, tenant.workspaceId), eq(financeExpenses.categoryId, id)));
    if (expenses.length > 0) throw new ApiError(400, 'VALIDATION_FAILED', 'Cannot delete expense category with recorded expenses.');
    await this.database.db.delete(financeExpenseCategories).where(and(eq(financeExpenseCategories.workspaceId, tenant.workspaceId), eq(financeExpenseCategories.id, id)));
    return { success: true, id };
  }

  async listExpenses(tenant: Tenant, filters: URLSearchParams | JsonRecord = {}) {
    const rows = await this.database.db.select().from(financeExpenses).where(eq(financeExpenses.workspaceId, tenant.workspaceId)).orderBy(desc(financeExpenses.expenseDate));
    const get = (k: string) => (filters instanceof URLSearchParams ? filters.get(k) ?? undefined : (filters[k] as string | undefined));
    return rows
      .map((r) => dto<JsonRecord & { status: string; categoryId: string; expenseDate: string; payee: string; title: string }>(tenant, r))
      .filter((e) => {
        if (get('status') && e.status !== get('status')) return false;
        if (get('categoryId') && e.categoryId !== get('categoryId')) return false;
        if (get('dateFrom') && e.expenseDate < String(get('dateFrom'))) return false;
        if (get('dateTo') && e.expenseDate > String(get('dateTo'))) return false;
        if (get('search')) {
          const q = String(get('search')).toLowerCase();
          if (!e.title.toLowerCase().includes(q) && !e.payee.toLowerCase().includes(q)) return false;
        }
        return true;
      });
  }

  async createExpense(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'expense.create');
    const amountCents = positive(data.amountCents, 'Expense amount');
    const categoryId = assertText(data.categoryId, 'Expense category');
    await this.assertRow(financeExpenseCategories, financeExpenseCategories.id, tenant.workspaceId, categoryId, 'Expense category');
    const expenseNumber = await this.nextNumber(tenant, 'EXP', financeExpenses, financeExpenses.expenseNumber);
    const expStatus = str(data.status) || 'draft';
    const record = this.withTenant(tenant, {
      id: uuid(),
      categoryId,
      expenseNumber,
      title: assertText(data.title, 'Expense title'),
      amountCents,
      expenseDate: str(data.expenseDate) || today(),
      payee: assertText(data.payee, 'Payee'),
      paymentMethod: str(data.paymentMethod) || 'bank_transfer',
      status: expStatus,
      submittedBy: expStatus === 'submitted' ? (actor?.userId || 'Staff') : undefined,
      submittedAt: expStatus === 'submitted' ? now() : undefined,
      notes: str(data.notes) || undefined,
      createdAt: now(),
      updatedAt: now(),
    });
    await this.database.db.insert(financeExpenses).values({
      id: record.id,
      workspaceId: tenant.workspaceId,
      categoryId,
      expenseNumber,
      title: String(record.title),
      amountCents,
      expenseDate: String(record.expenseDate),
      payee: String(record.payee),
      paymentMethod: String(record.paymentMethod),
      status: String(record.status),
      payload: record,
    }).catch(dbError);
    return record;
  }

  async updateExpense(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'expense.create');
    const current = await this.getPayload<JsonRecord & { status: string; amountCents: number }>(tenant, financeExpenses, financeExpenses.id, id, 'Expense');
    if (!['draft', 'rejected'].includes(current.status)) {
      throw new ApiError(400, 'VALIDATION_FAILED', `Cannot edit an expense that is ${current.status}. Only draft or rejected expenses can be modified.`);
    }
    const amountCents = data.amountCents !== undefined ? positive(data.amountCents, 'Expense amount') : current.amountCents;
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, amountCents, updatedAt: now() });
    await this.database.db.update(financeExpenses).set({
      title: String(record.title),
      amountCents,
      expenseDate: String(record.expenseDate),
      payee: String(record.payee),
      paymentMethod: String(record.paymentMethod),
      payload: record,
      updatedAt: new Date(),
    }).where(and(eq(financeExpenses.workspaceId, tenant.workspaceId), eq(financeExpenses.id, id))).catch(dbError);
    return record;
  }

  async submitExpense(tenant: Tenant, id: string, actor?: Actor) {
    assertFinance(actor, 'expense.create');
    const current = await this.getPayload<JsonRecord & { status: string }>(tenant, financeExpenses, financeExpenses.id, id, 'Expense');
    if (!['draft', 'rejected'].includes(current.status)) throw new ApiError(400, 'VALIDATION_FAILED', 'Only draft or rejected expenses can be submitted.');
    const updated = {
      ...current,
      status: 'submitted',
      submittedBy: actor?.userId || 'Staff',
      submittedAt: now(),
      updatedAt: now(),
    };
    await this.database.db.update(financeExpenses).set({
      status: 'submitted',
      payload: updated,
      updatedAt: new Date(),
    }).where(and(eq(financeExpenses.workspaceId, tenant.workspaceId), eq(financeExpenses.id, id)));
    return updated;
  }

  async approveExpense(tenant: Tenant, id: string, data: JsonRecord = {}, actor?: Actor) {
    assertFinance(actor, 'expense.approve');
    const current = await this.getPayload<JsonRecord & { status: string }>(tenant, financeExpenses, financeExpenses.id, id, 'Expense');
    if (current.status !== 'submitted') throw new ApiError(400, 'VALIDATION_FAILED', 'Only submitted expenses can be approved.');
    const updated = {
      ...current,
      status: 'approved',
      approvedBy: str(data.approvedBy) || actor?.userId || 'Accountant',
      approvedAt: now(),
      approvalNotes: str(data.notes) || undefined,
      updatedAt: now(),
    };
    await this.database.db.update(financeExpenses).set({
      status: 'approved',
      payload: updated,
      updatedAt: new Date(),
    }).where(and(eq(financeExpenses.workspaceId, tenant.workspaceId), eq(financeExpenses.id, id)));
    return updated;
  }

  async rejectExpense(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'expense.approve');
    const reason = assertText(data.reason || data.rejectionReason, 'Rejection reason');
    const current = await this.getPayload<JsonRecord & { status: string }>(tenant, financeExpenses, financeExpenses.id, id, 'Expense');
    if (current.status !== 'submitted') throw new ApiError(400, 'VALIDATION_FAILED', 'Only submitted expenses can be rejected.');
    const updated = {
      ...current,
      status: 'rejected',
      rejectedBy: str(data.rejectedBy) || actor?.userId || 'Accountant',
      rejectedAt: now(),
      rejectionReason: reason,
      updatedAt: now(),
    };
    await this.database.db.update(financeExpenses).set({
      status: 'rejected',
      payload: updated,
      updatedAt: new Date(),
    }).where(and(eq(financeExpenses.workspaceId, tenant.workspaceId), eq(financeExpenses.id, id)));
    return updated;
  }

  async disburseExpense(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'expense.manage');
    const current = await this.getPayload<JsonRecord & { status: string; paymentMethod: string }>(tenant, financeExpenses, financeExpenses.id, id, 'Expense');
    if (current.status !== 'approved') throw new ApiError(400, 'VALIDATION_FAILED', 'Only approved expenses can be disbursed.');
    const updated = {
      ...current,
      status: 'paid',
      paidAt: now(),
      disbursedBy: actor?.userId || 'Accountant',
      paymentReference: str(data.referenceNumber) || undefined,
      paymentMethod: str(data.paymentMethod) || current.paymentMethod,
      updatedAt: now(),
    };
    await this.database.db.update(financeExpenses).set({
      status: 'paid',
      paymentMethod: String(updated.paymentMethod),
      payload: updated,
      updatedAt: new Date(),
    }).where(and(eq(financeExpenses.workspaceId, tenant.workspaceId), eq(financeExpenses.id, id)));
    return updated;
  }

  async deleteExpense(tenant: Tenant, id: string, actor?: Actor) {
    assertFinance(actor, 'expense.manage');
    const current = await this.getPayload<JsonRecord & { status: string }>(tenant, financeExpenses, financeExpenses.id, id, 'Expense');
    if (['approved', 'paid'].includes(current.status)) {
      throw new ApiError(400, 'VALIDATION_FAILED', `Cannot delete an expense that is ${current.status}. It is locked for audit integrity.`);
    }
    await this.database.db.delete(financeExpenses).where(and(eq(financeExpenses.workspaceId, tenant.workspaceId), eq(financeExpenses.id, id)));
    return { success: true, id };
  }

  // --- Other Incomes ---
  async listIncomes(tenant: Tenant, filters: URLSearchParams | JsonRecord = {}) {
    const rows = await this.database.db.select().from(financeIncomes).where(eq(financeIncomes.workspaceId, tenant.workspaceId)).orderBy(desc(financeIncomes.receivedDate));
    const get = (k: string) => (filters instanceof URLSearchParams ? filters.get(k) ?? undefined : (filters[k] as string | undefined));
    return rows
      .map((r) => dto<JsonRecord & { category: string; receivedDate: string; source: string }>(tenant, r))
      .filter((inc) => {
        if (get('category') && inc.category !== get('category')) return false;
        if (get('dateFrom') && inc.receivedDate < String(get('dateFrom'))) return false;
        if (get('dateTo') && inc.receivedDate > String(get('dateTo'))) return false;
        if (get('search')) {
          const q = String(get('search')).toLowerCase();
          if (!inc.source.toLowerCase().includes(q)) return false;
        }
        return true;
      });
  }

  async createIncome(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fees.manage');
    const amountCents = positive(data.amountCents, 'Income amount');
    const incomeNumber = await this.nextNumber(tenant, 'INC', financeIncomes, financeIncomes.incomeNumber);
    const record = this.withTenant(tenant, {
      id: uuid(),
      incomeNumber,
      receiptNumber: incomeNumber,
      source: assertText(data.source, 'Income source'),
      category: assertText(data.category, 'Income category'),
      amountCents,
      receivedDate: str(data.receivedDate) || today(),
      paymentMethod: str(data.paymentMethod) || 'cash',
      status: 'received',
      notes: str(data.notes) || undefined,
      receivedBy: str(data.receivedBy) || actor?.userId || 'Finance Desk',
      createdAt: now(),
      updatedAt: now(),
    });
    await this.database.db.insert(financeIncomes).values({
      id: record.id,
      workspaceId: tenant.workspaceId,
      incomeNumber,
      source: String(record.source),
      category: String(record.category),
      amountCents,
      receivedDate: String(record.receivedDate),
      paymentMethod: String(record.paymentMethod),
      status: 'received',
      payload: record,
    }).catch(dbError);
    return record;
  }

  async updateIncome(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fees.manage');
    const current = await this.getPayload(tenant, financeIncomes, financeIncomes.id, id, 'Income record');
    const amountCents = data.amountCents !== undefined ? positive(data.amountCents, 'Income amount') : Number(current.amountCents);
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, amountCents, updatedAt: now() });
    await this.database.db.update(financeIncomes).set({
      source: String(record.source),
      category: String(record.category),
      amountCents,
      receivedDate: String(record.receivedDate),
      paymentMethod: String(record.paymentMethod),
      payload: record,
      updatedAt: new Date(),
    }).where(and(eq(financeIncomes.workspaceId, tenant.workspaceId), eq(financeIncomes.id, id))).catch(dbError);
    return record;
  }

  async deleteIncome(tenant: Tenant, id: string, actor?: Actor) {
    assertFinance(actor, 'fees.manage');
    await this.database.db.delete(financeIncomes).where(and(eq(financeIncomes.workspaceId, tenant.workspaceId), eq(financeIncomes.id, id)));
    return { success: true, id };
  }

  // --- Ledgers & Balance Integrity ---
  async ledger(tenant: Tenant, studentId: string) {
    const invoices = (await this.listInvoices(tenant, { studentId })) as Invoice[];
    const payments = (await this.listPayments(tenant, studentId)) as Payment[];
    const receipts = (await this.listReceipts(tenant, studentId)) as Receipt[];
    let balanceCents = 0;
    return [
      ...invoices
        .filter((i) => !['voided', 'cancelled'].includes(i.status))
        .map((i) => ({
          id: `ledger-${i.id}`,
          organizationId: tenant.organizationId,
          studentId,
          invoiceId: i.id,
          type: 'invoice',
          description: `Invoice ${i.invoiceNumber}`,
          debitCents: i.totalCents,
          creditCents: 0,
          occurredAt: i.issueDate,
        })),
      ...payments.map((p) => ({
        id: `ledger-${p.id}`,
        organizationId: tenant.organizationId,
        studentId,
        invoiceId: p.invoiceId,
        paymentId: p.id,
        receiptId: receipts.find((r) => r.paymentId === p.id)?.id,
        type: p.status === 'voided' ? 'payment_void' : 'payment',
        description: p.status === 'voided' ? `Voided payment ${p.referenceNumber || p.id}` : `Payment ${p.referenceNumber || p.id}`,
        debitCents: p.status === 'voided' ? p.amountCents : 0,
        creditCents: p.status === 'voided' ? 0 : p.amountCents,
        occurredAt: p.paymentDate,
      })),
    ]
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
      .map((e) => {
        balanceCents += e.debitCents - e.creditCents;
        return { ...e, balanceCents };
      });
  }

  async reconcileStudentLedger(tenant: Tenant, studentId: string) {
    const ledgerEntries = await this.ledger(tenant, studentId);
    const studentInvoices = ((await this.listInvoices(tenant, { studentId })) as Invoice[]).filter(
      (i) => !['cancelled', 'voided'].includes(i.status)
    );
    const recordedBalanceCents = studentInvoices.reduce((s, i) => s + i.balanceCents, 0);
    const calculatedBalanceCents = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].balanceCents : 0;
    const discrepancyCents = Math.abs(recordedBalanceCents - calculatedBalanceCents);
    const isBalanced = discrepancyCents === 0;

    return {
      studentId,
      isBalanced,
      calculatedBalanceCents,
      recordedBalanceCents,
      discrepancyCents,
      totalDebitsCents: ledgerEntries.reduce((s, e) => s + e.debitCents, 0),
      totalCreditsCents: ledgerEntries.reduce((s, e) => s + e.creditCents, 0),
      entriesCount: ledgerEntries.length,
      invoicesCount: studentInvoices.length,
      status: isBalanced ? 'balanced' : 'discrepancy_detected',
    };
  }

  async auditLedgerIntegrity(tenant: Tenant) {
    const invoices = ((await this.listInvoices(tenant)) as Invoice[]).filter(
      (i) => !['cancelled', 'voided'].includes(i.status)
    );
    const studentIds = [...new Set(invoices.map((i) => i.studentId))];
    const results = [];
    let totalBalanced = 0;
    let totalDiscrepancies = 0;

    for (const studentId of studentIds) {
      const res = await this.reconcileStudentLedger(tenant, studentId);
      if (res.isBalanced) totalBalanced++;
      else {
        totalDiscrepancies++;
        results.push(res);
      }
    }

    return {
      totalStudentsChecked: studentIds.length,
      totalAuditedStudents: studentIds.length,
      balancedStudentsCount: totalBalanced,
      totalBalanced,
      discrepancyStudentsCount: totalDiscrepancies,
      totalDiscrepancies,
      isHealthy: totalDiscrepancies === 0,
      discrepancies: results,
    };
  }

  // --- Financial Reporting ---
  async collectionSummary(tenant: Tenant) {
    const invoices = ((await this.listInvoices(tenant)) as Invoice[]).filter((i) => !['cancelled', 'voided'].includes(i.status));
    const payments = (await this.listPayments(tenant)) as Payment[];
    const totalBilledCents = invoices.reduce((s, i) => s + i.totalCents, 0);
    const totalCollectedCents = invoices.reduce((s, i) => s + i.paidAmountCents, 0);
    return {
      totalBilledCents,
      totalCollectedCents,
      outstandingCents: invoices.reduce((s, i) => s + i.balanceCents, 0),
      overdueCents: invoices.filter((i) => status(i) === 'overdue').reduce((s, i) => s + i.balanceCents, 0),
      collectionRate: totalBilledCents === 0 ? 0 : Math.round((totalCollectedCents / totalBilledCents) * 10000) / 100,
      paymentsTodayCents: payments.filter((p) => p.status === 'recorded' && p.paymentDate === today()).reduce((s, p) => s + p.amountCents, 0),
      outstandingStudents: new Set(invoices.filter((i) => i.balanceCents > 0).map((i) => i.studentId)).size,
    };
  }

  async collectionReport(tenant: Tenant, filters: URLSearchParams) {
    return ((await this.listInvoices(tenant, filters)) as Invoice[])
      .filter((i) => !['cancelled', 'voided'].includes(i.status))
      .map((i) => ({
        invoiceId: i.id,
        invoiceNumber: i.invoiceNumber,
        studentId: i.studentId,
        totalCents: i.totalCents,
        paidCents: i.paidAmountCents,
        balanceCents: i.balanceCents,
        status: i.status,
      }));
  }

  async outstandingReport(tenant: Tenant, filters: URLSearchParams) {
    return (await this.collectionReport(tenant, filters)).filter((r) => r.balanceCents > 0);
  }

  async paymentReport(tenant: Tenant, filters: URLSearchParams) {
    const invoiceIds = new Set(((await this.listInvoices(tenant, filters)) as Invoice[]).map((i) => i.id));
    return ((await this.listPayments(tenant)) as Payment[])
      .filter((p) => invoiceIds.has(p.invoiceId))
      .filter((p) => !filters.get('dateFrom') || p.paymentDate >= String(filters.get('dateFrom')))
      .filter((p) => !filters.get('dateTo') || p.paymentDate <= String(filters.get('dateTo')))
      .map((p) => ({
        paymentId: p.id,
        invoiceId: p.invoiceId,
        studentId: p.studentId,
        amountCents: p.amountCents,
        paymentDate: p.paymentDate,
        method: p.paymentMethod,
        status: p.status,
      }));
  }

  async gradeSummary(tenant: Tenant, filters: URLSearchParams) {
    const rows = new Map<string, { gradeId: string; billedCents: number; collectedCents: number; outstandingCents: number }>();
    const enrollmentRows = await this.database.db.select().from(enrollments).where(eq(enrollments.workspaceId, tenant.workspaceId));
    for (const invoice of ((await this.listInvoices(tenant, filters)) as Invoice[]).filter((i) => !['cancelled', 'voided'].includes(i.status))) {
      const enrollment = enrollmentRows.find((e) => e.id === invoice.enrollmentId);
      if (!enrollment) continue;
      if (filters.get('gradeId') && enrollment.gradeId !== filters.get('gradeId')) continue;
      if (filters.get('sectionId') && enrollment.sectionId !== filters.get('sectionId')) continue;
      const row = rows.get(enrollment.gradeId) ?? { gradeId: enrollment.gradeId, billedCents: 0, collectedCents: 0, outstandingCents: 0 };
      row.billedCents += invoice.totalCents;
      row.collectedCents += invoice.paidAmountCents;
      row.outstandingCents += invoice.balanceCents;
      rows.set(row.gradeId, row);
    }
    return [...rows.values()];
  }

  async incomeExpenseReport(tenant: Tenant, filters: URLSearchParams | JsonRecord = {}) {
    const get = (k: string) => (filters instanceof URLSearchParams ? filters.get(k) ?? undefined : (filters[k] as string | undefined));
    const dateFrom = get('dateFrom');
    const dateTo = get('dateTo');

    const payments = ((await this.listPayments(tenant)) as Payment[]).filter((p) => {
      if (p.status === 'voided') return false;
      if (dateFrom && p.paymentDate < dateFrom) return false;
      if (dateTo && p.paymentDate > dateTo) return false;
      return true;
    });
    const totalFeeIncomeCents = payments.reduce((s, p) => s + p.amountCents, 0);

    const incomes = (await this.listIncomes(tenant, filters)) as unknown as Array<JsonRecord & { amountCents: number; category: string }>;
    const totalOtherIncomeCents = incomes.reduce((s, i) => s + Number(i.amountCents), 0);
    const totalRevenueCents = totalFeeIncomeCents + totalOtherIncomeCents;

    const expenses = ((await this.listExpenses(tenant, filters)) as unknown as Array<JsonRecord & { amountCents: number; categoryId: string; status: string }>).filter((e) => ['approved', 'paid'].includes(e.status));
    const totalExpenseCents = expenses.reduce((s, e) => s + Number(e.amountCents), 0);

    const netSurplusCents = totalRevenueCents - totalExpenseCents;
    const marginPercentage = totalRevenueCents === 0 ? 0 : Math.round((netSurplusCents / totalRevenueCents) * 10000) / 100;

    const expenseCats = (await this.listExpenseCategories(tenant)) as Array<JsonRecord & { id: string; name: string }>;
    const catMap = new Map(expenseCats.map((c) => [c.id, c.name]));
    const expenseByCategory: Record<string, number> = {};
    for (const e of expenses) {
      const catName = catMap.get(e.categoryId) || 'General Operations';
      expenseByCategory[catName] = (expenseByCategory[catName] || 0) + Number(e.amountCents);
    }

    const incomeByCategory: Record<string, number> = { 'Tuition & Academic Fees': totalFeeIncomeCents };
    for (const i of incomes) {
      const cat = String(i.category || 'General');
      incomeByCategory[cat] = (incomeByCategory[cat] || 0) + Number(i.amountCents);
    }

    return {
      totalRevenueCents,
      totalFeeIncomeCents,
      totalOtherIncomeCents,
      totalExpenseCents,
      netSurplusCents,
      marginPercentage,
      expenseByCategory,
      incomeByCategory,
      paymentsCount: payments.length,
      incomesCount: incomes.length,
      expensesCount: expenses.length,
    };
  }

  async cashFlowReport(tenant: Tenant, filters: URLSearchParams | JsonRecord = {}) {
    const get = (k: string) => (filters instanceof URLSearchParams ? filters.get(k) ?? undefined : (filters[k] as string | undefined));
    const dateFrom = get('dateFrom');
    const dateTo = get('dateTo');

    const payments = ((await this.listPayments(tenant)) as Payment[]).filter((p) => {
      if (p.status === 'voided') return false;
      if (dateFrom && p.paymentDate < dateFrom) return false;
      if (dateTo && p.paymentDate > dateTo) return false;
      return true;
    });

    const incomes = (await this.listIncomes(tenant, filters)) as unknown as Array<JsonRecord & { amountCents: number; receivedDate: string; source: string }>;
    const expenses = ((await this.listExpenses(tenant, filters)) as unknown as Array<JsonRecord & { amountCents: number; expenseDate: string; payee: string; status: string }>).filter((e) => e.status === 'paid');

    const timeline: Array<{ date: string; type: 'fee_payment' | 'other_income' | 'expense_paid'; description: string; inflowCents: number; outflowCents: number }> = [];

    let totalInflowCents = 0;
    let totalOutflowCents = 0;

    for (const p of payments) {
      totalInflowCents += p.amountCents;
      timeline.push({
        date: p.paymentDate,
        type: 'fee_payment',
        description: `Fee Payment (${p.paymentMethod}) - Ref: ${p.referenceNumber || p.id.slice(0, 8)}`,
        inflowCents: p.amountCents,
        outflowCents: 0,
      });
    }

    for (const i of incomes) {
      totalInflowCents += Number(i.amountCents);
      timeline.push({
        date: String(i.receivedDate),
        type: 'other_income',
        description: `Income: ${i.source}`,
        inflowCents: Number(i.amountCents),
        outflowCents: 0,
      });
    }

    for (const e of expenses) {
      totalOutflowCents += Number(e.amountCents);
      timeline.push({
        date: String(e.expenseDate),
        type: 'expense_paid',
        description: `Expense: ${e.payee}`,
        inflowCents: 0,
        outflowCents: Number(e.amountCents),
      });
    }

    timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningNet = 0;
    const timelineWithNet = timeline.map((item) => {
      runningNet += item.inflowCents - item.outflowCents;
      return { ...item, netCashFlowCents: runningNet };
    });

    return {
      totalInflowCents,
      totalOutflowCents,
      netCashFlowCents: totalInflowCents - totalOutflowCents,
      timeline: timelineWithNet,
    };
  }

  async lateFeesReport(tenant: Tenant, filters: URLSearchParams | JsonRecord = {}) {
    const invoices = (await this.listInvoices(tenant, filters)) as Invoice[];
    const policies = (await this.listLateFeePolicies(tenant)) as Array<JsonRecord & { status: string }>;
    const activePoliciesCount = policies.filter((p) => p.status === 'active').length;
    const overdueInvoices = invoices.filter((i) => i.status === 'overdue');
    const totalOverdueBalanceCents = overdueInvoices.reduce((sum, i) => sum + Number(i.balanceCents || 0), 0);
    const rows = [];
    for (const inv of invoices) {
      const adjustments = Array.isArray(inv.adjustments) ? inv.adjustments : [];
      const lateFeeAdjustments = adjustments.filter((a: JsonRecord) => a.type === 'penalty' || String(a.description).toLowerCase().includes('late fee'));
      if (lateFeeAdjustments.length > 0) {
        const totalLateFeeCents = lateFeeAdjustments.reduce((s: number, a: JsonRecord) => s + Number(a.amountCents || 0), 0);
        rows.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          studentId: inv.studentId,
          dueDate: inv.dueDate,
          invoiceBalanceCents: inv.balanceCents,
          totalLateFeeCents,
          adjustments: lateFeeAdjustments,
          status: inv.status,
        });
      }
    }
    return {
      overdueInvoicesCount: overdueInvoices.length,
      totalOverdueBalanceCents,
      activePoliciesCount,
      invoices: rows,
    };
  }

  // --- Helpers ---
  private withTenant<T extends JsonRecord>(tenant: Tenant, data: T): T & { organizationId: string } {
    return { ...clean(data), organizationId: tenant.organizationId } as unknown as T & { organizationId: string };
  }
  private async saveInvoice(tenant: Tenant, invoice: Invoice) {
    await this.database.db.update(financeInvoices).set({
      status: invoice.status,
      paidAmountCents: invoice.paidAmountCents,
      balanceCents: invoice.balanceCents,
      payload: invoice,
      updatedAt: new Date(),
    }).where(and(eq(financeInvoices.workspaceId, tenant.workspaceId), eq(financeInvoices.id, invoice.id)));
  }
  private async getPayload<T extends JsonRecord>(tenant: Tenant, table: { payload: unknown; workspaceId: unknown }, idCol: unknown, id: string, label: string): Promise<T> {
    const row = ((await this.database.db.select().from(table as never).where(and(eq(table.workspaceId as never, tenant.workspaceId), eq(idCol as never, id))).limit(1))[0]) as { payload: T } | undefined;
    if (!row) throw new ApiError(404, 'NOT_FOUND', `${label} not found.`);
    return { ...payloadOf(row.payload), organizationId: tenant.organizationId } as unknown as T;
  }
  private async assertRow(table: { workspaceId: unknown }, idCol: unknown, workspaceId: string, id: string, label: string): Promise<JsonRecord> {
    const row = ((await this.database.db.select().from(table as never).where(and(eq(table.workspaceId as never, workspaceId), eq(idCol as never, id))).limit(1))[0]) as JsonRecord | undefined;
    if (!row) throw new ApiError(404, 'NOT_FOUND', `${label} not found for this organization.`);
    return row;
  }
  private async nextNumber(tenant: Tenant, prefix: string, table: { workspaceId: unknown }, column: unknown): Promise<string> {
    const rows = ((await this.database.db.select().from(table as never).where(eq(table.workspaceId as never, tenant.workspaceId))) as Array<Record<string, string>>);
    const numbers = rows.map((r) => String(r[String((column as { name?: string }).name ?? '')] ?? Object.values(r).find((v) => typeof v === 'string' && v.startsWith(`${prefix}-`)) ?? '')).map((v) => Number(v.split('-').at(-1))).filter(Number.isFinite);
    return `${prefix}-${tenant.organizationId.slice(0, 4).toUpperCase()}-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(5, '0')}`;
  }
}
