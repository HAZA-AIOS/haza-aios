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
  financeFeeCategories,
  financeFeeStructures,
  financeInvoices,
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
type Invoice = JsonRecord & { id: string; organizationId: string; studentId: string; enrollmentId: string; academicYearId: string; invoiceNumber: string; issueDate: string; dueDate: string; status: InvoiceStatus; totalCents: number; paidAmountCents: number; balanceCents: number };
type Payment = JsonRecord & { id: string; organizationId: string; invoiceId: string; studentId: string; amountCents: number; paymentDate: string; paymentMethod: string; referenceNumber?: string; status: string };
type Receipt = JsonRecord & { id: string; organizationId: string; invoiceId: string; paymentId: string; studentId: string; receiptNumber: string; amountCents: number; receiptDate: string };

function uuid(): string { return randomUUID(); }
function now(): string { return new Date().toISOString(); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function payloadOf(value: unknown): JsonRecord { if (typeof value === 'string') { try { return JSON.parse(value) as JsonRecord; } catch { return {}; } } return value && typeof value === 'object' ? value as JsonRecord : {}; }
function clean<T extends JsonRecord>(value: T): T { return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T; }
function str(value: unknown): string { return typeof value === 'string' ? value : ''; }
function positive(value: unknown, label: string): number { const n = Number(value); if (!Number.isFinite(n) || n <= 0) throw new ApiError(400, 'VALIDATION_FAILED', `${label} must be greater than zero.`); return Math.round(n); }
function assertText(value: unknown, label: string): string { const out = String(value ?? '').trim(); if (!out) throw new ApiError(400, 'VALIDATION_FAILED', `${label} is required.`); return out; }
function assertFinance(actor: Actor, permission: string): void { if (!actor || ['Owner', 'Admin', 'Accountant'].includes(String(actor.role ?? 'Owner'))) return; throw new ApiError(403, 'FORBIDDEN', `Unauthorized: missing permission ${permission}`); }
function dbError(error: unknown): never { const mapped = mapDatabaseError(error); if (mapped.code === 'DATABASE_UNIQUE_CONSTRAINT') throw new ApiError(409, 'DATABASE_UNIQUE_CONSTRAINT', 'A finance record with the same unique scope already exists.'); throw error; }
function status(invoice: Invoice): InvoiceStatus { if (invoice.status === 'draft' || invoice.status === 'cancelled' || invoice.status === 'voided') return invoice.status; if (invoice.balanceCents <= 0) return 'paid'; if (invoice.paidAmountCents > 0) return 'partially_paid'; if (invoice.dueDate < today()) return 'overdue'; return 'issued'; }
function dto<T extends JsonRecord>(tenant: Tenant, row: { payload: JsonRecord }): T { return { ...payloadOf(row.payload), organizationId: tenant.organizationId } as unknown as T; }

export class SisFinanceService {
  constructor(private readonly database: DatabaseClient) {}

  async listCategories(tenant: Tenant) { return (await this.database.db.select().from(financeFeeCategories).where(eq(financeFeeCategories.workspaceId, tenant.workspaceId))).map((r) => dto(tenant, r)); }
  async createCategory(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fees.manage');
    const record = this.withTenant(tenant, { ...data, id: uuid(), name: assertText(data.name, 'Fee category name'), code: assertText(data.code, 'Fee category code'), status: str(data.status) || 'active', displayOrder: Number(data.displayOrder ?? 0), createdAt: now(), updatedAt: now() });
    await this.database.db.insert(financeFeeCategories).values({ id: record.id, workspaceId: tenant.workspaceId, code: String(record.code), name: String(record.name), status: String(record.status), displayOrder: Number(record.displayOrder), payload: record }).catch(dbError);
    return record;
  }
  async updateCategory(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fees.manage');
    const current = await this.getPayload(tenant, financeFeeCategories, financeFeeCategories.id, id, 'Fee category');
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, updatedAt: now() });
    await this.database.db.update(financeFeeCategories).set({ code: String(record.code), name: String(record.name), status: String(record.status), displayOrder: Number(record.displayOrder ?? 0), payload: record, updatedAt: new Date() }).where(and(eq(financeFeeCategories.workspaceId, tenant.workspaceId), eq(financeFeeCategories.id, id))).catch(dbError);
    return record;
  }

  async listStructures(tenant: Tenant) { return (await this.database.db.select().from(financeFeeStructures).where(eq(financeFeeStructures.workspaceId, tenant.workspaceId))).map((r) => dto(tenant, r)); }
  async createStructure(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fee_structure.manage');
    const amountCents = positive(data.amountCents, 'Fee amount');
    await Promise.all([this.assertRow(academicYears, academicYears.id, tenant.workspaceId, str(data.academicYearId), 'Academic year'), this.assertRow(gradeLevels, gradeLevels.id, tenant.workspaceId, str(data.gradeId), 'Grade'), this.assertRow(financeFeeCategories, financeFeeCategories.id, tenant.workspaceId, str(data.feeCategoryId), 'Fee category')]);
    const record = this.withTenant<JsonRecord>(tenant, { ...data, id: uuid(), name: assertText(data.name, 'Fee structure name'), amountCents, status: str(data.status) || 'active', createdAt: now(), updatedAt: now() });
    await this.database.db.insert(financeFeeStructures).values({ id: String(record.id), workspaceId: tenant.workspaceId, academicYearId: str(record.academicYearId), gradeId: str(record.gradeId), feeCategoryId: str(record.feeCategoryId), name: String(record.name), amountCents, status: String(record.status), payload: record }).catch(dbError);
    return record;
  }
  async updateStructure(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'fee_structure.manage');
    const current = await this.getPayload(tenant, financeFeeStructures, financeFeeStructures.id, id, 'Fee structure');
    const amountCents = data.amountCents === undefined ? Number(current.amountCents) : positive(data.amountCents, 'Fee amount');
    const record = this.withTenant<JsonRecord>(tenant, { ...current, ...data, id, amountCents, updatedAt: now() });
    await this.database.db.update(financeFeeStructures).set({ name: String(record.name), amountCents, status: String(record.status), payload: record, updatedAt: new Date() }).where(and(eq(financeFeeStructures.workspaceId, tenant.workspaceId), eq(financeFeeStructures.id, id))).catch(dbError);
    return record;
  }

  async assignFee(tenant: Tenant, studentId: string, enrollmentId: string, feeStructureId: string, actor?: Actor) {
    assertFinance(actor, 'fee_structure.manage');
    await Promise.all([this.assertRow(students, students.id, tenant.workspaceId, studentId, 'Student'), this.assertRow(enrollments, enrollments.id, tenant.workspaceId, enrollmentId, 'Enrollment')]);
    const structure = await this.getPayload<JsonRecord & { amountCents: number; status: string }>(tenant, financeFeeStructures, financeFeeStructures.id, feeStructureId, 'Fee structure');
    if (structure.status !== 'active') throw new ApiError(400, 'VALIDATION_FAILED', 'Only active fee structures can be assigned.');
    const existing = (await this.database.db.select().from(financeStudentFeeAssignments).where(and(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId), eq(financeStudentFeeAssignments.studentId, studentId), eq(financeStudentFeeAssignments.enrollmentId, enrollmentId), eq(financeStudentFeeAssignments.feeStructureId, feeStructureId))).limit(1))[0];
    if (existing) return dto(tenant, existing);
    const record = this.withTenant(tenant, { id: uuid(), studentId, enrollmentId, feeStructureId, amountCents: Number(structure.amountCents), status: 'active', assignedAt: now(), createdAt: now(), updatedAt: now() });
    await this.database.db.insert(financeStudentFeeAssignments).values({ id: record.id, workspaceId: tenant.workspaceId, studentId, enrollmentId, feeStructureId, status: 'active', amountCents: Number(record.amountCents), payload: record }).catch(dbError);
    return record;
  }
  async listAssignments(tenant: Tenant, studentId?: string) {
    const rows = studentId ? await this.database.db.select().from(financeStudentFeeAssignments).where(and(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId), eq(financeStudentFeeAssignments.studentId, studentId))) : await this.database.db.select().from(financeStudentFeeAssignments).where(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId));
    return rows.map((r) => dto(tenant, r));
  }

  async listDiscounts(tenant: Tenant) { return (await this.database.db.select().from(financeDiscounts).where(eq(financeDiscounts.workspaceId, tenant.workspaceId))).map((r) => dto(tenant, r)); }
  async createDiscount(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'discount.manage');
    if (data.type === 'fixed') positive(data.value, 'Discount');
    if (data.type === 'percentage' && (Number(data.value) <= 0 || Number(data.value) > 100)) throw new ApiError(400, 'VALIDATION_FAILED', 'Percentage discount must be between 0 and 100.');
    if (data.studentId) await this.assertRow(students, students.id, tenant.workspaceId, str(data.studentId), 'Student');
    if (data.feeCategoryId) await this.assertRow(financeFeeCategories, financeFeeCategories.id, tenant.workspaceId, str(data.feeCategoryId), 'Fee category');
    const record = this.withTenant<JsonRecord>(tenant, { ...data, id: uuid(), name: assertText(data.name, 'Discount name'), reason: assertText(data.reason, 'Discount reason'), authorizedBy: assertText(data.authorizedBy, 'Discount authorizer'), status: str(data.status) || 'active', createdAt: now(), updatedAt: now() });
    await this.database.db.insert(financeDiscounts).values({ id: String(record.id), workspaceId: tenant.workspaceId, studentId: str(record.studentId) || undefined, feeCategoryId: str(record.feeCategoryId) || undefined, name: String(record.name), discountType: String(record.type), status: String(record.status), payload: record }).catch(dbError);
    return record;
  }

  async createInvoice(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'invoice.create');
    if (new Date(str(data.issueDate)) > new Date(str(data.dueDate))) throw new ApiError(400, 'VALIDATION_FAILED', 'Invoice issue date must be before due date.');
    const studentId = str(data.studentId); const enrollmentId = str(data.enrollmentId); const academicYearId = str(data.academicYearId);
    const [enrollment] = await Promise.all([this.assertRow(enrollments, enrollments.id, tenant.workspaceId, enrollmentId, 'Enrollment'), this.assertRow(students, students.id, tenant.workspaceId, studentId, 'Student'), this.assertRow(academicYears, academicYears.id, tenant.workspaceId, academicYearId, 'Academic year')]);
    if ((enrollment as { studentId?: string }).studentId !== studentId) throw new ApiError(400, 'VALIDATION_FAILED', 'Enrollment does not belong to student.');
    const requestedStructures = new Set((Array.isArray(data.feeStructureIds) ? data.feeStructureIds : []).map(String));
    const assignmentRows = await this.database.db.select().from(financeStudentFeeAssignments).where(and(eq(financeStudentFeeAssignments.workspaceId, tenant.workspaceId), eq(financeStudentFeeAssignments.studentId, studentId), eq(financeStudentFeeAssignments.enrollmentId, enrollmentId)));
    const assignments = assignmentRows.map((r) => dto<JsonRecord & { id: string; feeStructureId: string; amountCents: number; status: string }>(tenant, r)).filter((a) => a.status === 'active' && ((Array.isArray(data.assignmentIds) && data.assignmentIds.map(String).includes(a.id)) || requestedStructures.has(a.feeStructureId)));
    for (const structureId of requestedStructures) if (!assignments.some((a) => a.feeStructureId === structureId)) assignments.push(await this.assignFee(tenant, studentId, enrollmentId, structureId, actor) as JsonRecord & { id: string; feeStructureId: string; amountCents: number; status: string });
    if (!assignments.length) throw new ApiError(400, 'VALIDATION_FAILED', 'At least one active fee assignment is required to create an invoice.');
    const structures = await this.listStructures(tenant) as Array<JsonRecord & { id: string; name: string; feeCategoryId: string }>;
    const discounts = (await this.listDiscounts(tenant) as Array<JsonRecord & { id: string; type: string; value: number; studentId?: string; feeCategoryId?: string; status: string }>).filter((d) => d.status === 'active' && Array.isArray(data.discountIds) && data.discountIds.map(String).includes(d.id));
    const lineItems = assignments.map((assignment) => {
      const structure = structures.find((s) => s.id === assignment.feeStructureId); if (!structure) throw new ApiError(404, 'NOT_FOUND', 'Fee structure not found for assignment.');
      const discountCents = discounts.filter((d) => (!d.studentId || d.studentId === studentId) && (!d.feeCategoryId || d.feeCategoryId === structure.feeCategoryId)).reduce((sum, d) => sum + (d.type === 'fixed' ? Number(d.value) : Math.round(Number(assignment.amountCents) * Number(d.value) / 100)), 0);
      const finalDiscount = Math.min(discountCents, Number(assignment.amountCents));
      return { id: uuid(), feeCategoryId: structure.feeCategoryId, feeStructureId: structure.id, description: structure.name, quantity: 1, amountCents: Number(assignment.amountCents), discountCents: finalDiscount, adjustmentCents: 0, finalAmountCents: Number(assignment.amountCents) - finalDiscount };
    });
    const adjustments = (Array.isArray(data.adjustments) ? data.adjustments : []).map((a) => ({ ...(a as JsonRecord), id: uuid(), amountCents: positive((a as JsonRecord).amountCents, 'Adjustment'), createdAt: now() }));
    const subtotalCents = lineItems.reduce((sum, i) => sum + i.amountCents, 0);
    const discountCents = lineItems.reduce((sum, i) => sum + i.discountCents, 0);
    const adjustmentCents = adjustments.reduce((sum, i) => sum + Number(i.amountCents), 0);
    const totalCents = Math.max(0, subtotalCents - discountCents - adjustmentCents);
    const invoiceNumber = await this.nextNumber(tenant, 'INV', financeInvoices, financeInvoices.invoiceNumber);
    const record = this.withTenant<JsonRecord>(tenant, { id: uuid(), studentId, enrollmentId, academicYearId, invoiceNumber, issueDate: str(data.issueDate), dueDate: str(data.dueDate), status: (str(data.status) || 'draft') as InvoiceStatus, currency: str(data.currency) || 'USD', items: lineItems, discountCents, adjustmentCents, subtotalCents, totalCents, paidAmountCents: 0, balanceCents: totalCents, adjustments, notificationEvents: data.status === 'issued' ? ['invoice.issued'] : [], issuedAt: data.status === 'issued' ? now() : undefined, createdAt: now(), updatedAt: now() }) as Invoice & { items: JsonRecord[] };
    record.status = status(record);
    await this.database.db.insert(financeInvoices).values({ id: record.id, workspaceId: tenant.workspaceId, studentId, enrollmentId, academicYearId, invoiceNumber, issueDate: record.issueDate, dueDate: record.dueDate, status: record.status, totalCents, paidAmountCents: 0, balanceCents: totalCents, payload: record }).catch(dbError);
    return record;
  }
  async issueInvoice(tenant: Tenant, invoiceId: string, actor?: Actor) {
    assertFinance(actor, 'invoice.update');
    const invoice = await this.getPayload<Invoice>(tenant, financeInvoices, financeInvoices.id, invoiceId, 'Invoice');
    if (invoice.status !== 'draft') throw new ApiError(400, 'VALIDATION_FAILED', 'Only draft invoices can be issued.');
    const updated = { ...invoice, status: 'issued' as InvoiceStatus, issuedAt: now(), notificationEvents: [...(Array.isArray(invoice.notificationEvents) ? invoice.notificationEvents : []), 'invoice.issued'], updatedAt: now() };
    updated.status = status(updated);
    await this.saveInvoice(tenant, updated);
    return updated;
  }
  async listInvoices(tenant: Tenant, filters: URLSearchParams | JsonRecord = {}) {
    const rows = await this.database.db.select().from(financeInvoices).where(eq(financeInvoices.workspaceId, tenant.workspaceId)).orderBy(desc(financeInvoices.issueDate));
    const get = (k: string) => filters instanceof URLSearchParams ? filters.get(k) ?? undefined : filters[k] as string | undefined;
    return rows.map((r) => { const invoice = dto<Invoice & { items?: JsonRecord[] }>(tenant, r); return { ...invoice, status: status(invoice) }; }).filter((i) => (!get('academicYearId') || i.academicYearId === get('academicYearId')) && (!get('studentId') || i.studentId === get('studentId')) && (!get('status') || i.status === get('status')) && (!get('dateFrom') || i.issueDate >= String(get('dateFrom'))) && (!get('dateTo') || i.issueDate <= String(get('dateTo'))) && (!get('feeCategoryId') || (Array.isArray(i.items) && i.items.some((item: JsonRecord) => item.feeCategoryId === get('feeCategoryId'))))); 
  }
  async recordPayment(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'payment.record');
    const amountCents = positive(data.amountCents, 'Payment');
    return withTransaction(this.database, async () => {
      const invoice = await this.getPayload<Invoice>(tenant, financeInvoices, financeInvoices.id, str(data.invoiceId), 'Invoice');
      if (['draft', 'cancelled', 'voided'].includes(invoice.status)) throw new ApiError(400, 'VALIDATION_FAILED', 'Payments can only be recorded against issued invoices.');
      if (amountCents > invoice.balanceCents) throw new ApiError(400, 'VALIDATION_FAILED', 'Payment exceeds outstanding invoice balance.');
      const referenceNumber = str(data.referenceNumber).trim() || undefined;
      if (referenceNumber) {
        const refs = await this.database.db.select().from(financePayments).where(and(eq(financePayments.workspaceId, tenant.workspaceId), eq(financePayments.referenceNumber, referenceNumber)));
        if (refs.some((r) => (payloadOf(r.payload) as Payment).status !== 'voided')) throw new ApiError(409, 'DATABASE_UNIQUE_CONSTRAINT', 'Payment reference number already exists.');
      }
      const payment = this.withTenant<JsonRecord>(tenant, { id: uuid(), invoiceId: invoice.id, studentId: invoice.studentId, amountCents, paymentDate: str(data.paymentDate), paymentMethod: str(data.paymentMethod), referenceNumber, receivedBy: str(data.receivedBy), notes: str(data.notes) || undefined, status: 'recorded', createdAt: now(), updatedAt: now() }) as Payment;
      const receiptNumber = await this.nextNumber(tenant, 'RCT', financeReceipts, financeReceipts.receiptNumber);
      const receipt = this.withTenant<JsonRecord>(tenant, { id: uuid(), invoiceId: invoice.id, paymentId: payment.id, studentId: invoice.studentId, receiptNumber, amountCents, paymentMethod: payment.paymentMethod, referenceNumber, receiptDate: payment.paymentDate, createdAt: now(), updatedAt: now() }) as Receipt;
      const updatedInvoice = { ...invoice, paidAmountCents: invoice.paidAmountCents + amountCents, balanceCents: Math.max(0, invoice.totalCents - invoice.paidAmountCents - amountCents), notificationEvents: [...(Array.isArray(invoice.notificationEvents) ? invoice.notificationEvents : []), 'payment.received'], updatedAt: now() };
      updatedInvoice.status = status(updatedInvoice);
      await this.database.db.insert(financePayments).values({ id: payment.id, workspaceId: tenant.workspaceId, invoiceId: invoice.id, studentId: invoice.studentId, amountCents, paymentDate: payment.paymentDate, paymentMethod: payment.paymentMethod, referenceNumber, status: payment.status, payload: payment });
      await this.database.db.insert(financeReceipts).values({ id: receipt.id, workspaceId: tenant.workspaceId, invoiceId: invoice.id, paymentId: payment.id, studentId: invoice.studentId, receiptNumber, amountCents, receiptDate: receipt.receiptDate, payload: receipt });
      await this.saveInvoice(tenant, updatedInvoice);
      return { payment, receipt, invoice: updatedInvoice };
    });
  }
  async voidPayment(tenant: Tenant, paymentId: string, data: JsonRecord, actor?: Actor) {
    assertFinance(actor, 'payment.void');
    const reason = assertText(data.reason, 'Void reason'); const authorizedBy = assertText(data.authorizedBy, 'Void authorizer');
    const payment = await this.getPayload<Payment>(tenant, financePayments, financePayments.id, paymentId, 'Payment');
    if (payment.status === 'voided') throw new ApiError(400, 'VALIDATION_FAILED', 'Payment is already voided.');
    const invoice = await this.getPayload<Invoice>(tenant, financeInvoices, financeInvoices.id, payment.invoiceId, 'Invoice');
    const updatedPayment = { ...payment, status: 'voided', voidedAt: now(), voidReason: reason, voidedBy: authorizedBy, updatedAt: now() };
    const updatedInvoice = { ...invoice, paidAmountCents: Math.max(0, invoice.paidAmountCents - payment.amountCents), balanceCents: Math.max(0, invoice.totalCents - Math.max(0, invoice.paidAmountCents - payment.amountCents)), updatedAt: now() };
    updatedInvoice.status = status(updatedInvoice);
    await this.database.db.update(financePayments).set({ status: 'voided', payload: updatedPayment, updatedAt: new Date() }).where(and(eq(financePayments.workspaceId, tenant.workspaceId), eq(financePayments.id, paymentId)));
    await this.saveInvoice(tenant, updatedInvoice);
    return updatedPayment;
  }
  async listPayments(tenant: Tenant, studentId?: string) { const rows = studentId ? await this.database.db.select().from(financePayments).where(and(eq(financePayments.workspaceId, tenant.workspaceId), eq(financePayments.studentId, studentId))) : await this.database.db.select().from(financePayments).where(eq(financePayments.workspaceId, tenant.workspaceId)); return rows.map((r) => dto(tenant, r)); }
  async listReceipts(tenant: Tenant, studentId?: string) { const rows = studentId ? await this.database.db.select().from(financeReceipts).where(and(eq(financeReceipts.workspaceId, tenant.workspaceId), eq(financeReceipts.studentId, studentId))) : await this.database.db.select().from(financeReceipts).where(eq(financeReceipts.workspaceId, tenant.workspaceId)); return rows.map((r) => dto(tenant, r)); }
  async ledger(tenant: Tenant, studentId: string) { const invoices = await this.listInvoices(tenant, { studentId }) as Invoice[]; const payments = await this.listPayments(tenant, studentId) as Payment[]; const receipts = await this.listReceipts(tenant, studentId) as Receipt[]; let balanceCents = 0; return [...invoices.filter((i) => !['voided', 'cancelled'].includes(i.status)).map((i) => ({ id: `ledger-${i.id}`, organizationId: tenant.organizationId, studentId, invoiceId: i.id, type: 'invoice', description: `Invoice ${i.invoiceNumber}`, debitCents: i.totalCents, creditCents: 0, occurredAt: i.issueDate })), ...payments.map((p) => ({ id: `ledger-${p.id}`, organizationId: tenant.organizationId, studentId, invoiceId: p.invoiceId, paymentId: p.id, receiptId: receipts.find((r) => r.paymentId === p.id)?.id, type: p.status === 'voided' ? 'payment_void' : 'payment', description: p.status === 'voided' ? `Voided payment ${p.referenceNumber || p.id}` : `Payment ${p.referenceNumber || p.id}`, debitCents: p.status === 'voided' ? p.amountCents : 0, creditCents: p.status === 'voided' ? 0 : p.amountCents, occurredAt: p.paymentDate }))].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()).map((e) => { balanceCents += e.debitCents - e.creditCents; return { ...e, balanceCents }; }); }
  async collectionSummary(tenant: Tenant) { const invoices = (await this.listInvoices(tenant) as Invoice[]).filter((i) => !['cancelled', 'voided'].includes(i.status)); const payments = await this.listPayments(tenant) as Payment[]; const totalBilledCents = invoices.reduce((s, i) => s + i.totalCents, 0); const totalCollectedCents = invoices.reduce((s, i) => s + i.paidAmountCents, 0); return { totalBilledCents, totalCollectedCents, outstandingCents: invoices.reduce((s, i) => s + i.balanceCents, 0), overdueCents: invoices.filter((i) => status(i) === 'overdue').reduce((s, i) => s + i.balanceCents, 0), collectionRate: totalBilledCents === 0 ? 0 : Math.round((totalCollectedCents / totalBilledCents) * 10000) / 100, paymentsTodayCents: payments.filter((p) => p.status === 'recorded' && p.paymentDate === today()).reduce((s, p) => s + p.amountCents, 0), outstandingStudents: new Set(invoices.filter((i) => i.balanceCents > 0).map((i) => i.studentId)).size }; }
  async collectionReport(tenant: Tenant, filters: URLSearchParams) { return (await this.listInvoices(tenant, filters) as Invoice[]).filter((i) => !['cancelled', 'voided'].includes(i.status)).map((i) => ({ invoiceId: i.id, invoiceNumber: i.invoiceNumber, studentId: i.studentId, totalCents: i.totalCents, paidCents: i.paidAmountCents, balanceCents: i.balanceCents, status: i.status })); }
  async outstandingReport(tenant: Tenant, filters: URLSearchParams) { return (await this.collectionReport(tenant, filters)).filter((r) => r.balanceCents > 0); }
  async paymentReport(tenant: Tenant, filters: URLSearchParams) { const invoiceIds = new Set((await this.listInvoices(tenant, filters) as Invoice[]).map((i) => i.id)); return (await this.listPayments(tenant) as Payment[]).filter((p) => invoiceIds.has(p.invoiceId)).filter((p) => !filters.get('dateFrom') || p.paymentDate >= String(filters.get('dateFrom'))).filter((p) => !filters.get('dateTo') || p.paymentDate <= String(filters.get('dateTo'))).map((p) => ({ paymentId: p.id, invoiceId: p.invoiceId, studentId: p.studentId, amountCents: p.amountCents, paymentDate: p.paymentDate, method: p.paymentMethod, status: p.status })); }
  async gradeSummary(tenant: Tenant, filters: URLSearchParams) { const rows = new Map<string, { gradeId: string; billedCents: number; collectedCents: number; outstandingCents: number }>(); const enrollmentRows = await this.database.db.select().from(enrollments).where(eq(enrollments.workspaceId, tenant.workspaceId)); for (const invoice of (await this.listInvoices(tenant, filters) as Invoice[]).filter((i) => !['cancelled', 'voided'].includes(i.status))) { const enrollment = enrollmentRows.find((e) => e.id === invoice.enrollmentId); if (!enrollment) continue; if (filters.get('gradeId') && enrollment.gradeId !== filters.get('gradeId')) continue; if (filters.get('sectionId') && enrollment.sectionId !== filters.get('sectionId')) continue; const row = rows.get(enrollment.gradeId) ?? { gradeId: enrollment.gradeId, billedCents: 0, collectedCents: 0, outstandingCents: 0 }; row.billedCents += invoice.totalCents; row.collectedCents += invoice.paidAmountCents; row.outstandingCents += invoice.balanceCents; rows.set(row.gradeId, row); } return [...rows.values()]; }

  private withTenant<T extends JsonRecord>(tenant: Tenant, data: T): T & { organizationId: string } { return { ...clean(data), organizationId: tenant.organizationId } as unknown as T & { organizationId: string }; }
  private async saveInvoice(tenant: Tenant, invoice: Invoice) { await this.database.db.update(financeInvoices).set({ status: invoice.status, paidAmountCents: invoice.paidAmountCents, balanceCents: invoice.balanceCents, payload: invoice, updatedAt: new Date() }).where(and(eq(financeInvoices.workspaceId, tenant.workspaceId), eq(financeInvoices.id, invoice.id))); }
  private async getPayload<T extends JsonRecord>(tenant: Tenant, table: { payload: unknown; workspaceId: unknown }, idCol: unknown, id: string, label: string): Promise<T> { const row = (await this.database.db.select().from(table as never).where(and(eq(table.workspaceId as never, tenant.workspaceId), eq(idCol as never, id))).limit(1))[0] as { payload: T } | undefined; if (!row) throw new ApiError(404, 'NOT_FOUND', `${label} not found.`); return { ...payloadOf(row.payload), organizationId: tenant.organizationId } as unknown as T; }
  private async assertRow(table: { workspaceId: unknown }, idCol: unknown, workspaceId: string, id: string, label: string): Promise<JsonRecord> { const row = (await this.database.db.select().from(table as never).where(and(eq(table.workspaceId as never, workspaceId), eq(idCol as never, id))).limit(1))[0] as JsonRecord | undefined; if (!row) throw new ApiError(404, 'NOT_FOUND', `${label} not found for this organization.`); return row; }
  private async nextNumber(tenant: Tenant, prefix: string, table: { workspaceId: unknown }, column: unknown): Promise<string> { const rows = await this.database.db.select().from(table as never).where(eq(table.workspaceId as never, tenant.workspaceId)) as Array<Record<string, string>>; const numbers = rows.map((r) => String(r[String((column as { name?: string }).name ?? '')] ?? Object.values(r).find((v) => typeof v === 'string' && v.startsWith(`${prefix}-`)) ?? '')).map((v) => Number(v.split('-').at(-1))).filter(Number.isFinite); return `${prefix}-${tenant.organizationId.slice(0, 4).toUpperCase()}-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(5, '0')}`; }
}
