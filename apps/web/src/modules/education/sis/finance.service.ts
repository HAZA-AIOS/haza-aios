import { jsonBody, sisRequest } from "./sis-api";
import type {
  FeeCategory,
  FeeCollectionReportRow,
  FeeCollectionSummary,
  FeeDiscount,
  FeePayment,
  FeeReceipt,
  FeeReportFilters,
  FeeStructure,
  GradeFeeSummaryRow,
  InvoiceAdjustment,
  InvoiceStatus,
  PaymentMethod,
  PaymentReportRow,
  StudentFeeAssignment,
  StudentFeeLedgerEntry,
  StudentInvoice,
} from "./sis.types";

type ActorRole = "Owner" | "Admin" | "Member" | "Teacher" | "Accountant";
interface ActorContext { userId: string; role: ActorRole }
interface CreateInvoiceInput { studentId: string; enrollmentId: string; academicYearId: string; issueDate: string; dueDate: string; currency: string; feeStructureIds?: string[]; assignmentIds?: string[]; discountIds?: string[]; adjustments?: Array<Omit<InvoiceAdjustment, "id" | "createdAt">>; status?: Extract<InvoiceStatus, "draft" | "issued"> }
interface RecordPaymentInput { invoiceId: string; amountCents: number; paymentDate: string; paymentMethod: PaymentMethod; referenceNumber?: string; receivedBy: string; notes?: string }

function query(filters?: FeeReportFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== "") params.set(key, String(value)); });
  const text = params.toString();
  return text ? `?${text}` : "";
}
function actorBody<T>(data: T, actor?: ActorContext): T & { actor?: ActorContext } { return (actor ? { ...data, actor } : data) as T & { actor?: ActorContext }; }

export class FinanceServiceClass {
  async getFeeCategories(organizationId: string): Promise<FeeCategory[]> { return (await sisRequest<{ categories: FeeCategory[] }>(organizationId, "/finance/categories")).categories; }
  async createFeeCategory(organizationId: string, data: Omit<FeeCategory, "id" | "organizationId" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<FeeCategory> { return (await sisRequest<{ category: FeeCategory }>(organizationId, "/finance/categories", { method: "POST", ...jsonBody(actorBody(data, actor)) })).category; }
  async updateFeeCategory(organizationId: string, id: string, updates: Partial<FeeCategory>, actor?: ActorContext): Promise<FeeCategory> { return (await sisRequest<{ category: FeeCategory }>(organizationId, `/finance/categories/${id}`, { method: "PATCH", ...jsonBody(actorBody(updates, actor)) })).category; }
  async getFeeStructures(organizationId: string): Promise<FeeStructure[]> { return (await sisRequest<{ structures: FeeStructure[] }>(organizationId, "/finance/structures")).structures; }
  async createFeeStructure(organizationId: string, data: Omit<FeeStructure, "id" | "organizationId" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<FeeStructure> { return (await sisRequest<{ structure: FeeStructure }>(organizationId, "/finance/structures", { method: "POST", ...jsonBody(actorBody(data, actor)) })).structure; }
  async updateFeeStructure(organizationId: string, id: string, updates: Partial<FeeStructure>, actor?: ActorContext): Promise<FeeStructure> { return (await sisRequest<{ structure: FeeStructure }>(organizationId, `/finance/structures/${id}`, { method: "PATCH", ...jsonBody(actorBody(updates, actor)) })).structure; }
  async assignFeeStructureToStudent(organizationId: string, studentId: string, enrollmentId: string, feeStructureId: string, actor?: ActorContext): Promise<StudentFeeAssignment> { return (await sisRequest<{ assignment: StudentFeeAssignment }>(organizationId, "/finance/assignments", { method: "POST", ...jsonBody({ studentId, enrollmentId, feeStructureId, actor }) })).assignment; }
  async getStudentFeeAssignments(organizationId: string, studentId?: string): Promise<StudentFeeAssignment[]> { return (await sisRequest<{ assignments: StudentFeeAssignment[] }>(organizationId, `/finance/assignments${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`)).assignments; }
  async createDiscount(organizationId: string, data: Omit<FeeDiscount, "id" | "organizationId" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<FeeDiscount> { return (await sisRequest<{ discount: FeeDiscount }>(organizationId, "/finance/discounts", { method: "POST", ...jsonBody(actorBody(data, actor)) })).discount; }
  async getDiscounts(organizationId: string): Promise<FeeDiscount[]> { return (await sisRequest<{ discounts: FeeDiscount[] }>(organizationId, "/finance/discounts")).discounts; }
  async createInvoice(organizationId: string, input: CreateInvoiceInput, actor?: ActorContext): Promise<StudentInvoice> { return (await sisRequest<{ invoice: StudentInvoice }>(organizationId, "/finance/invoices", { method: "POST", ...jsonBody(actorBody(input, actor)) })).invoice; }
  async issueInvoice(organizationId: string, invoiceId: string, actor?: ActorContext): Promise<StudentInvoice> { return (await sisRequest<{ invoice: StudentInvoice }>(organizationId, `/finance/invoices/${invoiceId}/issue`, { method: "POST", ...jsonBody({ actor }) })).invoice; }
  async getInvoices(organizationId: string, filters?: FeeReportFilters): Promise<StudentInvoice[]> { return (await sisRequest<{ invoices: StudentInvoice[] }>(organizationId, `/finance/invoices${query(filters)}`)).invoices; }
  async recordPayment(organizationId: string, input: RecordPaymentInput, actor?: ActorContext): Promise<{ payment: FeePayment; receipt: FeeReceipt; invoice: StudentInvoice }> { return sisRequest(organizationId, "/finance/payments", { method: "POST", ...jsonBody(actorBody(input, actor)) }); }
  async voidPayment(organizationId: string, paymentId: string, reason: string, authorizedBy: string, actor?: ActorContext): Promise<FeePayment> { return (await sisRequest<{ payment: FeePayment }>(organizationId, `/finance/payments/${paymentId}/void`, { method: "POST", ...jsonBody({ reason, authorizedBy, actor }) })).payment; }
  async getPayments(organizationId: string, studentId?: string): Promise<FeePayment[]> { return (await sisRequest<{ payments: FeePayment[] }>(organizationId, `/finance/payments${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`)).payments; }
  async getReceipts(organizationId: string, studentId?: string): Promise<FeeReceipt[]> { return (await sisRequest<{ receipts: FeeReceipt[] }>(organizationId, `/finance/receipts${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`)).receipts; }
  async getStudentLedger(organizationId: string, studentId: string): Promise<StudentFeeLedgerEntry[]> { return (await sisRequest<{ ledger: StudentFeeLedgerEntry[] }>(organizationId, `/finance/ledger/${studentId}`)).ledger; }
  async getCollectionSummary(organizationId: string): Promise<FeeCollectionSummary> { return (await sisRequest<{ summary: FeeCollectionSummary }>(organizationId, "/finance/reports/summary")).summary; }
  async getCollectionReport(organizationId: string, filters?: FeeReportFilters): Promise<FeeCollectionReportRow[]> { return (await sisRequest<{ rows: FeeCollectionReportRow[] }>(organizationId, `/finance/reports/collection${query(filters)}`)).rows; }
  async getOutstandingReport(organizationId: string, filters?: FeeReportFilters): Promise<FeeCollectionReportRow[]> { return (await sisRequest<{ rows: FeeCollectionReportRow[] }>(organizationId, `/finance/reports/outstanding${query(filters)}`)).rows; }
  async getPaymentReport(organizationId: string, filters?: FeeReportFilters): Promise<PaymentReportRow[]> { return (await sisRequest<{ rows: PaymentReportRow[] }>(organizationId, `/finance/reports/payments${query(filters)}`)).rows; }
  async getGradeFeeSummary(organizationId: string, filters?: FeeReportFilters): Promise<GradeFeeSummaryRow[]> { return (await sisRequest<{ rows: GradeFeeSummaryRow[] }>(organizationId, `/finance/reports/grades${query(filters)}`)).rows; }
}

export const FinanceService = new FinanceServiceClass();
