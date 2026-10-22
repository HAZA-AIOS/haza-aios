import { fetchCompleteSisDataset, jsonBody, sisRequest } from "./sis-api";
import type {
  CashFlowReport,
  ExpenseCategory,
  ExpenseRecord,
  FeeCategory,
  FeeCollectionReportRow,
  FeeCollectionSummary,
  FeeDiscount,
  FeePayment,
  FeeReceipt,
  FeeReportFilters,
  FeeStructure,
  GradeFeeSummaryRow,
  IncomeExpenseReport,
  IncomeRecord,
  InvoiceAdjustment,
  InvoiceStatus,
  LateFeePolicy,
  LateFeesReport,
  LedgerReconciliationResult,
  PaymentMethod,
  PaymentReportRow,
  RecurringInvoiceGenerationResult,
  StudentFeeAssignment,
  StudentFeeLedgerEntry,
  StudentInvoice,
} from "./sis.types";

type ActorRole = "Owner" | "Admin" | "Member" | "Teacher" | "Accountant";
interface ActorContext { userId: string; role: ActorRole }
interface CreateInvoiceInput { studentId: string; enrollmentId: string; academicYearId: string; issueDate: string; dueDate: string; currency: string; feeStructureIds?: string[]; assignmentIds?: string[]; discountIds?: string[]; adjustments?: Array<Omit<InvoiceAdjustment, "id" | "createdAt">>; status?: Extract<InvoiceStatus, "draft" | "issued"> }
interface RecordPaymentInput { invoiceId: string; amountCents: number; paymentDate: string; paymentMethod: PaymentMethod; referenceNumber?: string; receivedBy: string; notes?: string }

function query(filters?: FeeReportFilters | Record<string, unknown>, defaultAll = true): string {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    });
  }
  const hasPage = params.has("page") || params.has("pageSize") || params.has("limit") || params.has("offset");
  if (!hasPage && defaultAll && !params.has("all")) {
    params.set("all", "true");
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}
function actorBody<T>(data: T, actor?: ActorContext): T & { actor?: ActorContext } { return (actor ? { ...data, actor } : data) as T & { actor?: ActorContext }; }

export class FinanceServiceClass {
  // Categories & Structures
  async getFeeCategories(organizationId: string): Promise<FeeCategory[]> { return (await sisRequest<{ categories: FeeCategory[] }>(organizationId, "/finance/categories")).categories; }
  async createFeeCategory(organizationId: string, data: Omit<FeeCategory, "id" | "organizationId" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<FeeCategory> { return (await sisRequest<{ category: FeeCategory }>(organizationId, "/finance/categories", { method: "POST", ...jsonBody(actorBody(data, actor)) })).category; }
  async updateFeeCategory(organizationId: string, id: string, updates: Partial<FeeCategory>, actor?: ActorContext): Promise<FeeCategory> { return (await sisRequest<{ category: FeeCategory }>(organizationId, `/finance/categories/${id}`, { method: "PATCH", ...jsonBody(actorBody(updates, actor)) })).category; }
  async deleteFeeCategory(organizationId: string, id: string, actor?: ActorContext): Promise<{ success: boolean; id: string }> { return sisRequest(organizationId, `/finance/categories/${id}`, { method: "DELETE", ...jsonBody({ actor }) }); }

  async getFeeStructures(organizationId: string): Promise<FeeStructure[]> { return (await sisRequest<{ structures: FeeStructure[] }>(organizationId, "/finance/structures")).structures; }
  async createFeeStructure(organizationId: string, data: Omit<FeeStructure, "id" | "organizationId" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<FeeStructure> { return (await sisRequest<{ structure: FeeStructure }>(organizationId, "/finance/structures", { method: "POST", ...jsonBody(actorBody(data, actor)) })).structure; }
  async updateFeeStructure(organizationId: string, id: string, updates: Partial<FeeStructure>, actor?: ActorContext): Promise<FeeStructure> { return (await sisRequest<{ structure: FeeStructure }>(organizationId, `/finance/structures/${id}`, { method: "PATCH", ...jsonBody(actorBody(updates, actor)) })).structure; }
  async deleteFeeStructure(organizationId: string, id: string, actor?: ActorContext): Promise<{ success: boolean; id: string }> { return sisRequest(organizationId, `/finance/structures/${id}`, { method: "DELETE", ...jsonBody({ actor }) }); }

  // Assignments
  async assignFeeStructureToStudent(organizationId: string, studentId: string, enrollmentId: string, feeStructureId: string, actor?: ActorContext): Promise<StudentFeeAssignment> { return (await sisRequest<{ assignment: StudentFeeAssignment }>(organizationId, "/finance/assignments", { method: "POST", ...jsonBody({ studentId, enrollmentId, feeStructureId, actor }) })).assignment; }
  async getStudentFeeAssignments(organizationId: string, studentId?: string): Promise<StudentFeeAssignment[]> { return (await sisRequest<{ assignments: StudentFeeAssignment[] }>(organizationId, `/finance/assignments${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ""}`)).assignments; }
  async unassignFeeStructure(organizationId: string, id: string, actor?: ActorContext): Promise<{ success: boolean; id: string }> { return sisRequest(organizationId, `/finance/assignments/${id}`, { method: "DELETE", ...jsonBody({ actor }) }); }
  async bulkAssignFeeStructure(organizationId: string, data: { academicYearId: string; gradeId?: string; sectionId?: string; feeStructureId: string }, actor?: ActorContext): Promise<{ success: boolean; count: number; assignments: StudentFeeAssignment[] }> { return sisRequest(organizationId, "/finance/assignments/bulk", { method: "POST", ...jsonBody(actorBody(data, actor)) }); }

  // Discounts
  async createDiscount(organizationId: string, data: Omit<FeeDiscount, "id" | "organizationId" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<FeeDiscount> { return (await sisRequest<{ discount: FeeDiscount }>(organizationId, "/finance/discounts", { method: "POST", ...jsonBody(actorBody(data, actor)) })).discount; }
  async getDiscounts(organizationId: string): Promise<FeeDiscount[]> { return (await sisRequest<{ discounts: FeeDiscount[] }>(organizationId, "/finance/discounts")).discounts; }

  // Invoices & Billing
  async createInvoice(organizationId: string, input: CreateInvoiceInput, actor?: ActorContext): Promise<StudentInvoice> { return (await sisRequest<{ invoice: StudentInvoice }>(organizationId, "/finance/invoices", { method: "POST", ...jsonBody(actorBody(input, actor)) })).invoice; }
  async issueInvoice(organizationId: string, invoiceId: string, actor?: ActorContext): Promise<StudentInvoice> { return (await sisRequest<{ invoice: StudentInvoice }>(organizationId, `/finance/invoices/${invoiceId}/issue`, { method: "POST", ...jsonBody({ actor }) })).invoice; }
  async voidInvoice(organizationId: string, invoiceId: string, reason: string, authorizedBy?: string, actor?: ActorContext): Promise<StudentInvoice> { return (await sisRequest<{ invoice: StudentInvoice }>(organizationId, `/finance/invoices/${invoiceId}/void`, { method: "POST", ...jsonBody(actorBody({ reason, authorizedBy }, actor)) })).invoice; }
  async getInvoices(organizationId: string, filters?: FeeReportFilters & { page?: number; pageSize?: number }): Promise<StudentInvoice[]> {
    if (filters?.page || filters?.pageSize) {
      const body = await sisRequest<{ invoices?: StudentInvoice[]; data?: StudentInvoice[] }>(organizationId, `/finance/invoices${query(filters, false)}`);
      return body.invoices ?? body.data ?? [];
    }
    return fetchCompleteSisDataset<StudentInvoice>(organizationId, `/finance/invoices${query(filters, false)}`);
  }
  async generateRecurringInvoices(organizationId: string, input: { academicYearId: string; billingPeriod: string; gradeId?: string; sectionId?: string; feeStructureIds: string[]; issueDate: string; dueDate: string; issueNow?: boolean }, actor?: ActorContext): Promise<RecurringInvoiceGenerationResult> { return sisRequest(organizationId, "/finance/invoices/generate-recurring", { method: "POST", ...jsonBody(actorBody(input, actor)) }); }

  // Payments & Receipts & Reconciliation
  async recordPayment(organizationId: string, input: RecordPaymentInput, actor?: ActorContext): Promise<{ payment: FeePayment; receipt: FeeReceipt; invoice: StudentInvoice }> { return sisRequest(organizationId, "/finance/payments", { method: "POST", ...jsonBody(actorBody(input, actor)) }); }
  async voidPayment(organizationId: string, paymentId: string, reason: string, authorizedBy: string, actor?: ActorContext): Promise<FeePayment> { return (await sisRequest<{ payment: FeePayment }>(organizationId, `/finance/payments/${paymentId}/void`, { method: "POST", ...jsonBody({ reason, authorizedBy, actor }) })).payment; }
  async reconcilePayment(organizationId: string, paymentId: string, input: { bankStatementRef?: string; notes?: string; reconciledBy: string }, actor?: ActorContext): Promise<FeePayment> { return (await sisRequest<{ payment: FeePayment }>(organizationId, `/finance/payments/${paymentId}/reconcile`, { method: "POST", ...jsonBody(actorBody(input, actor)) })).payment; }
  async unreconcilePayment(organizationId: string, paymentId: string, input: { reason: string; authorizedBy: string }, actor?: ActorContext): Promise<FeePayment> { return (await sisRequest<{ payment: FeePayment }>(organizationId, `/finance/payments/${paymentId}/unreconcile`, { method: "POST", ...jsonBody(actorBody(input, actor)) })).payment; }
  async getPayments(organizationId: string, studentId?: string, options?: { page?: number; pageSize?: number }): Promise<FeePayment[]> {
    if (options?.page || options?.pageSize) {
      const body = await sisRequest<{ payments?: FeePayment[]; data?: FeePayment[] }>(organizationId, `/finance/payments${query({ studentId, ...options }, false)}`);
      return body.payments ?? body.data ?? [];
    }
    return fetchCompleteSisDataset<FeePayment>(organizationId, `/finance/payments${query({ studentId, ...options }, false)}`);
  }
  async getReceipts(organizationId: string, studentId?: string, options?: { page?: number; pageSize?: number }): Promise<FeeReceipt[]> { return (await sisRequest<{ receipts: FeeReceipt[] }>(organizationId, `/finance/receipts${query({ studentId, ...options })}`)).receipts; }

  // Student Ledger & Reconciliation
  async getStudentLedger(organizationId: string, studentId: string): Promise<StudentFeeLedgerEntry[]> { return (await sisRequest<{ ledger: StudentFeeLedgerEntry[] }>(organizationId, `/finance/ledger/${studentId}`)).ledger; }
  async getStudentLedgerReconciliation(organizationId: string, studentId: string): Promise<LedgerReconciliationResult> { return (await sisRequest<{ audit: LedgerReconciliationResult }>(organizationId, `/finance/ledger/${studentId}/reconciliation`)).audit; }
  async auditLedgerIntegrity(organizationId: string): Promise<{ totalStudentsChecked: number; balancedStudentsCount: number; discrepancyStudentsCount: number; discrepancies: LedgerReconciliationResult[] }> { return sisRequest(organizationId, "/finance/ledger-audit"); }

  // Late Fee Policies
  async getLateFeePolicies(organizationId: string): Promise<LateFeePolicy[]> { return (await sisRequest<{ policies: LateFeePolicy[] }>(organizationId, "/finance/late-fee-policies")).policies; }
  async createLateFeePolicy(organizationId: string, data: Omit<LateFeePolicy, "id" | "organizationId" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<LateFeePolicy> { return (await sisRequest<{ policy: LateFeePolicy }>(organizationId, "/finance/late-fee-policies", { method: "POST", ...jsonBody(actorBody(data, actor)) })).policy; }
  async updateLateFeePolicy(organizationId: string, id: string, updates: Partial<LateFeePolicy>, actor?: ActorContext): Promise<LateFeePolicy> { return (await sisRequest<{ policy: LateFeePolicy }>(organizationId, `/finance/late-fee-policies/${id}`, { method: "PATCH", ...jsonBody(actorBody(updates, actor)) })).policy; }
  async deleteLateFeePolicy(organizationId: string, id: string, actor?: ActorContext): Promise<{ success: boolean; id: string }> { return (await sisRequest<{ policy: { success: boolean; id: string } }>(organizationId, `/finance/late-fee-policies/${id}`, { method: "DELETE", ...jsonBody({ actor }) })).policy; }
  async applyLateFees(organizationId: string, input?: { policyId?: string; asOfDate?: string }, actor?: ActorContext): Promise<{ evaluatedInvoicesCount: number; appliedCount: number; totalLateFeesCents: number }> { return sisRequest(organizationId, "/finance/late-fee-policies/apply", { method: "POST", ...jsonBody(actorBody(input ?? {}, actor)) }); }

  // Expense Categories & Expenses
  async getExpenseCategories(organizationId: string): Promise<ExpenseCategory[]> { return (await sisRequest<{ categories: ExpenseCategory[] }>(organizationId, "/finance/expense-categories")).categories; }
  async createExpenseCategory(organizationId: string, data: Omit<ExpenseCategory, "id" | "organizationId" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<ExpenseCategory> { return (await sisRequest<{ category: ExpenseCategory }>(organizationId, "/finance/expense-categories", { method: "POST", ...jsonBody(actorBody(data, actor)) })).category; }
  async updateExpenseCategory(organizationId: string, id: string, updates: Partial<ExpenseCategory>, actor?: ActorContext): Promise<ExpenseCategory> { return (await sisRequest<{ category: ExpenseCategory }>(organizationId, `/finance/expense-categories/${id}`, { method: "PATCH", ...jsonBody(actorBody(updates, actor)) })).category; }
  async deleteExpenseCategory(organizationId: string, id: string, actor?: ActorContext): Promise<{ success: boolean; id: string }> { return (await sisRequest<{ category: { success: boolean; id: string } }>(organizationId, `/finance/expense-categories/${id}`, { method: "DELETE", ...jsonBody({ actor }) })).category; }

  async getExpenses(organizationId: string, filters?: { categoryId?: string; status?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }): Promise<ExpenseRecord[]> {
    if (filters?.page || filters?.pageSize) {
      const body = await sisRequest<{ expenses?: ExpenseRecord[]; data?: ExpenseRecord[] }>(organizationId, `/finance/expenses${query(filters, false)}`);
      return body.expenses ?? body.data ?? [];
    }
    return fetchCompleteSisDataset<ExpenseRecord>(organizationId, `/finance/expenses${query(filters, false)}`);
  }
  async createExpense(organizationId: string, data: Omit<ExpenseRecord, "id" | "organizationId" | "expenseNumber" | "status" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<ExpenseRecord> { return (await sisRequest<{ expense: ExpenseRecord }>(organizationId, "/finance/expenses", { method: "POST", ...jsonBody(actorBody(data, actor)) })).expense; }
  async updateExpense(organizationId: string, id: string, updates: Partial<ExpenseRecord>, actor?: ActorContext): Promise<ExpenseRecord> { return (await sisRequest<{ expense: ExpenseRecord }>(organizationId, `/finance/expenses/${id}`, { method: "PATCH", ...jsonBody(actorBody(updates, actor)) })).expense; }
  async deleteExpense(organizationId: string, id: string, actor?: ActorContext): Promise<{ success: boolean; id: string }> { return (await sisRequest<{ expense: { success: boolean; id: string } }>(organizationId, `/finance/expenses/${id}`, { method: "DELETE", ...jsonBody({ actor }) })).expense; }
  async submitExpense(organizationId: string, id: string, actor?: ActorContext): Promise<ExpenseRecord> { return (await sisRequest<{ expense: ExpenseRecord }>(organizationId, `/finance/expenses/${id}/submit`, { method: "POST", ...jsonBody({ actor }) })).expense; }
  async approveExpense(organizationId: string, id: string, approvedBy: string, actor?: ActorContext): Promise<ExpenseRecord> { return (await sisRequest<{ expense: ExpenseRecord }>(organizationId, `/finance/expenses/${id}/approve`, { method: "POST", ...jsonBody(actorBody({ approvedBy }, actor)) })).expense; }
  async rejectExpense(organizationId: string, id: string, rejectionReason: string, rejectedBy: string, actor?: ActorContext): Promise<ExpenseRecord> { return (await sisRequest<{ expense: ExpenseRecord }>(organizationId, `/finance/expenses/${id}/reject`, { method: "POST", ...jsonBody(actorBody({ rejectionReason, rejectedBy }, actor)) })).expense; }
  async disburseExpense(organizationId: string, id: string, data: { paymentMethod: PaymentMethod; referenceNumber?: string; disbursedBy: string }, actor?: ActorContext): Promise<ExpenseRecord> { return (await sisRequest<{ expense: ExpenseRecord }>(organizationId, `/finance/expenses/${id}/disburse`, { method: "POST", ...jsonBody(actorBody(data, actor)) })).expense; }

  // Other Incomes
  async getIncomes(organizationId: string, filters?: { category?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number }): Promise<IncomeRecord[]> {
    if (filters?.page || filters?.pageSize) {
      const body = await sisRequest<{ incomes?: IncomeRecord[]; data?: IncomeRecord[] }>(organizationId, `/finance/incomes${query(filters, false)}`);
      return body.incomes ?? body.data ?? [];
    }
    return fetchCompleteSisDataset<IncomeRecord>(organizationId, `/finance/incomes${query(filters, false)}`);
  }
  async createIncome(organizationId: string, data: Omit<IncomeRecord, "id" | "organizationId" | "receiptNumber" | "createdAt" | "updatedAt">, actor?: ActorContext): Promise<IncomeRecord> { return (await sisRequest<{ income: IncomeRecord }>(organizationId, "/finance/incomes", { method: "POST", ...jsonBody(actorBody(data, actor)) })).income; }
  async updateIncome(organizationId: string, id: string, updates: Partial<IncomeRecord>, actor?: ActorContext): Promise<IncomeRecord> { return (await sisRequest<{ income: IncomeRecord }>(organizationId, `/finance/incomes/${id}`, { method: "PATCH", ...jsonBody(actorBody(updates, actor)) })).income; }
  async deleteIncome(organizationId: string, id: string, actor?: ActorContext): Promise<{ success: boolean; id: string }> { return (await sisRequest<{ income: { success: boolean; id: string } }>(organizationId, `/finance/incomes/${id}`, { method: "DELETE", ...jsonBody({ actor }) })).income; }

  // Reports
  async getCollectionSummary(organizationId: string): Promise<FeeCollectionSummary> { return (await sisRequest<{ summary: FeeCollectionSummary }>(organizationId, "/finance/reports/summary")).summary; }
  async getCollectionReport(organizationId: string, filters?: FeeReportFilters): Promise<FeeCollectionReportRow[]> { return (await sisRequest<{ rows: FeeCollectionReportRow[] }>(organizationId, `/finance/reports/collection${query(filters)}`)).rows; }
  async getOutstandingReport(organizationId: string, filters?: FeeReportFilters): Promise<FeeCollectionReportRow[]> { return (await sisRequest<{ rows: FeeCollectionReportRow[] }>(organizationId, `/finance/reports/outstanding${query(filters)}`)).rows; }
  async getPaymentReport(organizationId: string, filters?: FeeReportFilters): Promise<PaymentReportRow[]> { return (await sisRequest<{ rows: PaymentReportRow[] }>(organizationId, `/finance/reports/payments${query(filters)}`)).rows; }
  async getGradeFeeSummary(organizationId: string, filters?: FeeReportFilters): Promise<GradeFeeSummaryRow[]> { return (await sisRequest<{ rows: GradeFeeSummaryRow[] }>(organizationId, `/finance/reports/grades${query(filters)}`)).rows; }
  async getIncomeExpenseReport(organizationId: string, filters?: FeeReportFilters): Promise<IncomeExpenseReport> { return (await sisRequest<{ report: IncomeExpenseReport }>(organizationId, `/finance/reports/income-expense${query(filters)}`)).report; }
  async getCashFlowReport(organizationId: string, filters?: FeeReportFilters): Promise<CashFlowReport> { return (await sisRequest<{ report: CashFlowReport }>(organizationId, `/finance/reports/cash-flow${query(filters)}`)).report; }
  async getLateFeesReport(organizationId: string, filters?: FeeReportFilters): Promise<LateFeesReport> { return (await sisRequest<{ report: LateFeesReport }>(organizationId, `/finance/reports/late-fees${query(filters)}`)).report; }
}

export const FinanceService = new FinanceServiceClass();

