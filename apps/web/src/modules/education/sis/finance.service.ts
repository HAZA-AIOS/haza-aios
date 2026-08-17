import { workspaceService } from "@/workspace/workspace-service";
import { AcademicService } from "./academic.service";
import { EnrollmentService } from "./enrollment.service";
import { StudentService } from "./student.service";
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
  InvoiceLineItem,
  InvoiceStatus,
  PaymentMethod,
  PaymentReportRow,
  StudentFeeAssignment,
  StudentFeeLedgerEntry,
  StudentInvoice,
} from "./sis.types";

const CATEGORIES_KEY = "haza-aios.sis.finance.categories";
const STRUCTURES_KEY = "haza-aios.sis.finance.structures";
const ASSIGNMENTS_KEY = "haza-aios.sis.finance.assignments";
const DISCOUNTS_KEY = "haza-aios.sis.finance.discounts";
const INVOICES_KEY = "haza-aios.sis.finance.invoices";
const PAYMENTS_KEY = "haza-aios.sis.finance.payments";
const RECEIPTS_KEY = "haza-aios.sis.finance.receipts";

type ActorRole = "Owner" | "Admin" | "Member" | "Teacher" | "Accountant";
type FinancePermission =
  | "fees.view"
  | "fees.manage"
  | "fee_structure.view"
  | "fee_structure.manage"
  | "invoice.view"
  | "invoice.create"
  | "invoice.update"
  | "payment.view"
  | "payment.record"
  | "payment.void"
  | "discount.view"
  | "discount.manage"
  | "finance.report"
  | "finance.manage";

interface ActorContext {
  userId: string;
  role: ActorRole;
}

interface CreateInvoiceInput {
  studentId: string;
  enrollmentId: string;
  academicYearId: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  feeStructureIds?: string[];
  assignmentIds?: string[];
  discountIds?: string[];
  adjustments?: Array<Omit<InvoiceAdjustment, "id" | "createdAt">>;
  status?: Extract<InvoiceStatus, "draft" | "issued">;
}

interface RecordPaymentInput {
  invoiceId: string;
  amountCents: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  receivedBy: string;
  notes?: string;
}

const financeManagers = new Set<ActorRole>(["Owner", "Admin", "Accountant"]);
const financePermissions = new Set<FinancePermission>([
  "fees.view",
  "fees.manage",
  "fee_structure.view",
  "fee_structure.manage",
  "invoice.view",
  "invoice.create",
  "invoice.update",
  "payment.view",
  "payment.record",
  "payment.void",
  "discount.view",
  "discount.manage",
  "finance.report",
  "finance.manage",
]);

function readCollection<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  if (!data) return [];
  try {
    return JSON.parse(data) as T[];
  } catch {
    return [];
  }
}

function writeCollection<T>(key: string, values: T[]): void {
  localStorage.setItem(key, JSON.stringify(values));
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultActor(): ActorContext {
  return { userId: "system", role: "Owner" };
}

function assertPermission(actor: ActorContext | undefined, permission: FinancePermission): void {
  const activeActor = actor || defaultActor();
  if (financeManagers.has(activeActor.role) && financePermissions.has(permission)) return;
  throw new Error(`Unauthorized: missing permission ${permission}`);
}

function assertPositiveCents(amountCents: number, label = "Amount"): void {
  if (!Number.isInteger(amountCents)) throw new Error(`${label} must be stored as integer cents.`);
  if (amountCents <= 0) throw new Error(`${label} must be greater than zero.`);
}

function clampToCents(value: number): number {
  return Math.max(0, Math.round(value));
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function isOverdue(invoice: StudentInvoice, asOf = todayIso()): boolean {
  return invoice.balanceCents > 0 && invoice.status !== "cancelled" && invoice.status !== "voided" && invoice.dueDate < asOf;
}

function calculateInvoiceStatus(invoice: StudentInvoice): InvoiceStatus {
  if (invoice.status === "cancelled" || invoice.status === "voided" || invoice.status === "draft") return invoice.status;
  if (invoice.balanceCents <= 0) return "paid";
  if (invoice.paidAmountCents > 0) return "partially_paid";
  if (isOverdue(invoice)) return "overdue";
  return "issued";
}

function nextDocumentNumber(prefix: string, organizationId: string, existing: Array<{ organizationId: string; invoiceNumber?: string; receiptNumber?: string }>): string {
  const count = existing.filter((item) => item.organizationId === organizationId).length + 1;
  return `${prefix}-${new Date().getFullYear()}-${count.toString().padStart(5, "0")}`;
}

export class FinanceServiceClass {
  private getCategoriesDb(): FeeCategory[] {
    return readCollection<FeeCategory>(CATEGORIES_KEY);
  }

  private saveCategoriesDb(categories: FeeCategory[]) {
    writeCollection(CATEGORIES_KEY, categories);
  }

  private getStructuresDb(): FeeStructure[] {
    return readCollection<FeeStructure>(STRUCTURES_KEY);
  }

  private saveStructuresDb(structures: FeeStructure[]) {
    writeCollection(STRUCTURES_KEY, structures);
  }

  private getAssignmentsDb(): StudentFeeAssignment[] {
    return readCollection<StudentFeeAssignment>(ASSIGNMENTS_KEY);
  }

  private saveAssignmentsDb(assignments: StudentFeeAssignment[]) {
    writeCollection(ASSIGNMENTS_KEY, assignments);
  }

  private getDiscountsDb(): FeeDiscount[] {
    return readCollection<FeeDiscount>(DISCOUNTS_KEY);
  }

  private saveDiscountsDb(discounts: FeeDiscount[]) {
    writeCollection(DISCOUNTS_KEY, discounts);
  }

  private getInvoicesDb(): StudentInvoice[] {
    return readCollection<StudentInvoice>(INVOICES_KEY);
  }

  private saveInvoicesDb(invoices: StudentInvoice[]) {
    writeCollection(INVOICES_KEY, invoices);
  }

  private getPaymentsDb(): FeePayment[] {
    return readCollection<FeePayment>(PAYMENTS_KEY);
  }

  private savePaymentsDb(payments: FeePayment[]) {
    writeCollection(PAYMENTS_KEY, payments);
  }

  private getReceiptsDb(): FeeReceipt[] {
    return readCollection<FeeReceipt>(RECEIPTS_KEY);
  }

  private saveReceiptsDb(receipts: FeeReceipt[]) {
    writeCollection(RECEIPTS_KEY, receipts);
  }

  private async audit(organizationId: string, action: string, details: string): Promise<void> {
    await workspaceService.addActivityLog(organizationId, {
      action,
      actor: "System Operator",
      details,
    });
  }

  async getFeeCategories(organizationId: string): Promise<FeeCategory[]> {
    assertPermission(undefined, "fees.view");
    return this.getCategoriesDb()
      .filter((category) => category.organizationId === organizationId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async createFeeCategory(
    organizationId: string,
    data: Omit<FeeCategory, "id" | "organizationId" | "createdAt" | "updatedAt">,
    actor?: ActorContext,
  ): Promise<FeeCategory> {
    assertPermission(actor, "fees.manage");
    if (!data.name.trim()) throw new Error("Fee category name is required.");
    const categories = this.getCategoriesDb();
    if (data.code && categories.some((item) => item.organizationId === organizationId && item.code?.toLowerCase() === data.code?.toLowerCase())) {
      throw new Error("Fee category code must be unique within organization.");
    }
    const now = new Date().toISOString();
    const category: FeeCategory = {
      ...data,
      id: createId("fee-category"),
      organizationId,
      name: data.name.trim(),
      code: data.code?.trim(),
      createdAt: now,
      updatedAt: now,
    };
    categories.push(category);
    this.saveCategoriesDb(categories);
    await this.audit(organizationId, "Fee Category Created", `Created fee category ${category.name}.`);
    return category;
  }

  async updateFeeCategory(organizationId: string, id: string, updates: Partial<FeeCategory>, actor?: ActorContext): Promise<FeeCategory> {
    assertPermission(actor, "fees.manage");
    const categories = this.getCategoriesDb();
    const index = categories.findIndex((item) => item.id === id && item.organizationId === organizationId);
    if (index === -1) throw new Error("Fee category not found.");
    categories[index] = { ...categories[index], ...updates, organizationId, updatedAt: new Date().toISOString() };
    this.saveCategoriesDb(categories);
    await this.audit(organizationId, "Fee Category Updated", `Updated fee category ${categories[index].name}.`);
    return categories[index];
  }

  async getFeeStructures(organizationId: string): Promise<FeeStructure[]> {
    assertPermission(undefined, "fee_structure.view");
    return this.getStructuresDb().filter((structure) => structure.organizationId === organizationId);
  }

  async createFeeStructure(
    organizationId: string,
    data: Omit<FeeStructure, "id" | "organizationId" | "createdAt" | "updatedAt">,
    actor?: ActorContext,
  ): Promise<FeeStructure> {
    assertPermission(actor, "fee_structure.manage");
    assertPositiveCents(data.amountCents);
    if (new Date(data.effectiveFrom) > new Date(data.effectiveTo || data.effectiveFrom)) {
      throw new Error("Fee structure effective dates are invalid.");
    }
    const [year, grade, category] = await Promise.all([
      AcademicService.getAcademicYears(organizationId).then((years) => years.find((item) => item.id === data.academicYearId)),
      AcademicService.getGrade(data.gradeId, organizationId),
      this.getFeeCategories(organizationId).then((categories) => categories.find((item) => item.id === data.feeCategoryId)),
    ]);
    if (!year) throw new Error("Academic year not found.");
    if (!grade) throw new Error("Class/grade not found.");
    if (!category) throw new Error("Fee category not found.");
    const now = new Date().toISOString();
    const structure: FeeStructure = {
      ...data,
      id: createId("fee-structure"),
      organizationId,
      name: data.name.trim(),
      createdAt: now,
      updatedAt: now,
    };
    if (!structure.name) throw new Error("Fee structure name is required.");
    const structures = this.getStructuresDb();
    structures.push(structure);
    this.saveStructuresDb(structures);
    await this.audit(organizationId, "Fee Structure Created", `Created fee structure ${structure.name}.`);
    return structure;
  }

  async updateFeeStructure(organizationId: string, id: string, updates: Partial<FeeStructure>, actor?: ActorContext): Promise<FeeStructure> {
    assertPermission(actor, "fee_structure.manage");
    const structures = this.getStructuresDb();
    const index = structures.findIndex((item) => item.id === id && item.organizationId === organizationId);
    if (index === -1) throw new Error("Fee structure not found.");
    if (updates.amountCents !== undefined) assertPositiveCents(updates.amountCents);
    structures[index] = { ...structures[index], ...updates, organizationId, updatedAt: new Date().toISOString() };
    this.saveStructuresDb(structures);
    await this.audit(organizationId, "Fee Structure Updated", `Updated fee structure ${structures[index].name}.`);
    return structures[index];
  }

  async assignFeeStructureToStudent(
    organizationId: string,
    studentId: string,
    enrollmentId: string,
    feeStructureId: string,
    actor?: ActorContext,
  ): Promise<StudentFeeAssignment> {
    assertPermission(actor, "fees.manage");
    const [student, enrollment, structure] = await Promise.all([
      StudentService.getStudent(studentId, organizationId),
      EnrollmentService.getEnrollments(organizationId, { studentId }).then((items) => items.find((item) => item.id === enrollmentId)),
      this.getFeeStructures(organizationId).then((items) => items.find((item) => item.id === feeStructureId)),
    ]);
    if (!student) throw new Error("Student not found for this organization.");
    if (!enrollment) throw new Error("Enrollment not found for this organization.");
    if (!structure) throw new Error("Fee structure not found.");
    const academicYear = await AcademicService.getAcademicYears(organizationId).then((years) => years.find((year) => year.id === structure.academicYearId));
    if (!academicYear || enrollment.academicYear !== academicYear.name || enrollment.gradeId !== structure.gradeId) {
      throw new Error("Fee structure does not match the student's enrollment.");
    }
    const assignments = this.getAssignmentsDb();
    const duplicate = assignments.find(
      (item) => item.organizationId === organizationId && item.studentId === studentId && item.enrollmentId === enrollmentId && item.feeStructureId === feeStructureId && item.status === "active",
    );
    if (duplicate) return duplicate;
    const now = new Date().toISOString();
    const assignment: StudentFeeAssignment = {
      id: createId("fee-assignment"),
      organizationId,
      studentId,
      enrollmentId,
      academicYearId: structure.academicYearId,
      feeStructureId,
      amountCents: structure.amountCents,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    assignments.push(assignment);
    this.saveAssignmentsDb(assignments);
    await this.audit(organizationId, "Student Fee Assignment Created", `Assigned fee structure ${structure.name}.`);
    return assignment;
  }

  async getStudentFeeAssignments(organizationId: string, studentId?: string): Promise<StudentFeeAssignment[]> {
    return this.getAssignmentsDb().filter((assignment) => assignment.organizationId === organizationId && (!studentId || assignment.studentId === studentId));
  }

  async createDiscount(
    organizationId: string,
    data: Omit<FeeDiscount, "id" | "organizationId" | "createdAt" | "updatedAt">,
    actor?: ActorContext,
  ): Promise<FeeDiscount> {
    assertPermission(actor, "discount.manage");
    if (!data.name.trim()) throw new Error("Discount name is required.");
    if (!data.reason.trim()) throw new Error("Discount reason is required.");
    if (!data.authorizedBy.trim()) throw new Error("Discount authorizer is required.");
    if (data.type === "fixed") assertPositiveCents(data.value, "Discount");
    if (data.type === "percentage" && (data.value <= 0 || data.value > 100)) {
      throw new Error("Percentage discount must be between 0 and 100.");
    }
    if (data.studentId) {
      const student = await StudentService.getStudent(data.studentId, organizationId);
      if (!student) throw new Error("Student not found for this organization.");
    }
    if (data.feeCategoryId) {
      const category = await this.getFeeCategories(organizationId).then((items) => items.find((item) => item.id === data.feeCategoryId));
      if (!category) throw new Error("Fee category not found.");
    }
    const now = new Date().toISOString();
    const discount: FeeDiscount = {
      ...data,
      id: createId("fee-discount"),
      organizationId,
      name: data.name.trim(),
      reason: data.reason.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const discounts = this.getDiscountsDb();
    discounts.push(discount);
    this.saveDiscountsDb(discounts);
    await this.audit(organizationId, "Discount Created", `Created discount ${discount.name}.`);
    return discount;
  }

  async getDiscounts(organizationId: string): Promise<FeeDiscount[]> {
    assertPermission(undefined, "discount.view");
    return this.getDiscountsDb().filter((discount) => discount.organizationId === organizationId);
  }

  async createInvoice(organizationId: string, input: CreateInvoiceInput, actor?: ActorContext): Promise<StudentInvoice> {
    assertPermission(actor, "invoice.create");
    if (new Date(input.issueDate) > new Date(input.dueDate)) throw new Error("Invoice issue date must be before due date.");
    const [student, enrollment, year] = await Promise.all([
      StudentService.getStudent(input.studentId, organizationId),
      EnrollmentService.getEnrollments(organizationId, { studentId: input.studentId }).then((items) => items.find((item) => item.id === input.enrollmentId)),
      AcademicService.getAcademicYears(organizationId).then((years) => years.find((item) => item.id === input.academicYearId)),
    ]);
    if (!student) throw new Error("Student not found for this organization.");
    if (!enrollment) throw new Error("Enrollment not found for this organization.");
    if (!year || enrollment.academicYear !== year.name) throw new Error("Academic year does not match enrollment.");

    const structureIds = new Set(input.feeStructureIds || []);
    const assignments = this.getAssignmentsDb().filter(
      (assignment) =>
        assignment.organizationId === organizationId &&
        assignment.studentId === input.studentId &&
        assignment.enrollmentId === input.enrollmentId &&
        assignment.status === "active" &&
        (input.assignmentIds?.includes(assignment.id) || structureIds.has(assignment.feeStructureId)),
    );
    for (const id of structureIds) {
      if (!assignments.some((assignment) => assignment.feeStructureId === id)) {
        assignments.push(await this.assignFeeStructureToStudent(organizationId, input.studentId, input.enrollmentId, id, actor));
      }
    }
    if (assignments.length === 0) throw new Error("At least one active fee assignment is required to create an invoice.");

    const structures = await this.getFeeStructures(organizationId);
    const discounts = this.getDiscountsDb().filter((discount) => discount.organizationId === organizationId && discount.status === "active" && (input.discountIds || []).includes(discount.id));
    const now = new Date().toISOString();
    const items: InvoiceLineItem[] = assignments.map((assignment) => {
      const structure = structures.find((item) => item.id === assignment.feeStructureId);
      if (!structure) throw new Error("Fee structure not found for assignment.");
      const matchingDiscounts = discounts.filter(
        (discount) =>
          (!discount.studentId || discount.studentId === input.studentId) &&
          (!discount.feeCategoryId || discount.feeCategoryId === structure.feeCategoryId),
      );
      const discountCents = matchingDiscounts.reduce((sum, discount) => {
        if (discount.type === "fixed") return sum + discount.value;
        return sum + clampToCents((assignment.amountCents * discount.value) / 100);
      }, 0);
      const finalDiscount = Math.min(discountCents, assignment.amountCents);
      return {
        id: createId("invoice-item"),
        feeCategoryId: structure.feeCategoryId,
        feeStructureId: structure.id,
        description: structure.name,
        quantity: 1,
        amountCents: assignment.amountCents,
        discountCents: finalDiscount,
        adjustmentCents: 0,
        finalAmountCents: assignment.amountCents - finalDiscount,
      };
    });
    const adjustments: InvoiceAdjustment[] = (input.adjustments || []).map((adjustment) => {
      assertPositiveCents(adjustment.amountCents, "Adjustment");
      if (!adjustment.reason.trim() || !adjustment.authorizedBy.trim()) {
        throw new Error("Adjustment reason and authorizer are required.");
      }
      return { ...adjustment, id: createId("invoice-adjustment"), createdAt: now };
    });
    const subtotalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
    const discountCents = items.reduce((sum, item) => sum + item.discountCents, 0);
    const adjustmentCents = adjustments.reduce((sum, item) => sum + item.amountCents, 0);
    const totalCents = Math.max(0, subtotalCents - discountCents - adjustmentCents);
    const invoices = this.getInvoicesDb();
    const invoice: StudentInvoice = {
      id: createId("invoice"),
      organizationId,
      studentId: input.studentId,
      enrollmentId: input.enrollmentId,
      academicYearId: input.academicYearId,
      invoiceNumber: nextDocumentNumber("INV", organizationId, invoices),
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      status: input.status || "draft",
      currency: input.currency,
      items,
      discountCents,
      adjustmentCents,
      subtotalCents,
      totalCents,
      paidAmountCents: 0,
      balanceCents: totalCents,
      adjustments,
      notificationEvents: input.status === "issued" ? ["invoice.issued"] : [],
      issuedAt: input.status === "issued" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };
    invoice.status = calculateInvoiceStatus(invoice);
    invoices.push(invoice);
    this.saveInvoicesDb(invoices);
    await this.audit(organizationId, "Invoice Created", `Created invoice ${invoice.invoiceNumber}.`);
    return invoice;
  }

  async issueInvoice(organizationId: string, invoiceId: string, actor?: ActorContext): Promise<StudentInvoice> {
    assertPermission(actor, "invoice.update");
    const invoices = this.getInvoicesDb();
    const index = invoices.findIndex((invoice) => invoice.id === invoiceId && invoice.organizationId === organizationId);
    if (index === -1) throw new Error("Invoice not found.");
    if (invoices[index].status !== "draft") throw new Error("Only draft invoices can be issued.");
    invoices[index] = {
      ...invoices[index],
      status: "issued",
      issuedAt: new Date().toISOString(),
      notificationEvents: [...(invoices[index].notificationEvents || []), "invoice.issued"],
      updatedAt: new Date().toISOString(),
    };
    this.saveInvoicesDb(invoices);
    await this.audit(organizationId, "Invoice Issued", `Issued invoice ${invoices[index].invoiceNumber}.`);
    return invoices[index];
  }

  async getInvoices(organizationId: string, filters?: FeeReportFilters): Promise<StudentInvoice[]> {
    assertPermission(undefined, "invoice.view");
    return this.getInvoicesDb().filter((invoice) => {
      if (invoice.organizationId !== organizationId) return false;
      if (filters?.academicYearId && invoice.academicYearId !== filters.academicYearId) return false;
      if (filters?.studentId && invoice.studentId !== filters.studentId) return false;
      if (filters?.status && invoice.status !== filters.status) return false;
      if (filters?.dateFrom && invoice.issueDate < filters.dateFrom) return false;
      if (filters?.dateTo && invoice.issueDate > filters.dateTo) return false;
      if (filters?.feeCategoryId && !invoice.items.some((item) => item.feeCategoryId === filters.feeCategoryId)) return false;
      return true;
    }).map((invoice) => ({ ...invoice, status: calculateInvoiceStatus(invoice) }));
  }

  async recordPayment(organizationId: string, input: RecordPaymentInput, actor?: ActorContext): Promise<{ payment: FeePayment; receipt: FeeReceipt; invoice: StudentInvoice }> {
    assertPermission(actor, "payment.record");
    assertPositiveCents(input.amountCents, "Payment");
    const invoices = this.getInvoicesDb();
    const invoiceIndex = invoices.findIndex((invoice) => invoice.id === input.invoiceId && invoice.organizationId === organizationId);
    if (invoiceIndex === -1) throw new Error("Invoice not found.");
    const invoice = { ...invoices[invoiceIndex] };
    if (invoice.status === "draft" || invoice.status === "cancelled" || invoice.status === "voided") {
      throw new Error("Payments can only be recorded against issued invoices.");
    }
    if (input.amountCents > invoice.balanceCents) throw new Error("Payment exceeds outstanding invoice balance.");
    const payments = this.getPaymentsDb();
    if (input.referenceNumber && payments.some((payment) => payment.organizationId === organizationId && payment.referenceNumber === input.referenceNumber && payment.status !== "voided")) {
      throw new Error("Payment reference number already exists.");
    }
    const now = new Date().toISOString();
    const payment: FeePayment = {
      id: createId("payment"),
      organizationId,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      amountCents: input.amountCents,
      paymentDate: input.paymentDate,
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber?.trim(),
      receivedBy: input.receivedBy,
      notes: input.notes,
      status: "recorded",
      createdAt: now,
      updatedAt: now,
    };
    const receipts = this.getReceiptsDb();
    const receipt: FeeReceipt = {
      id: createId("receipt"),
      organizationId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      studentId: invoice.studentId,
      receiptNumber: nextDocumentNumber("RCT", organizationId, receipts),
      amountCents: payment.amountCents,
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      receiptDate: input.paymentDate,
      createdAt: now,
      updatedAt: now,
    };
    invoice.paidAmountCents += payment.amountCents;
    invoice.balanceCents = Math.max(0, invoice.totalCents - invoice.paidAmountCents);
    invoice.status = calculateInvoiceStatus(invoice);
    invoice.notificationEvents = [...(invoice.notificationEvents || []), "payment.received"];
    invoice.updatedAt = now;
    payments.push(payment);
    receipts.push(receipt);
    invoices[invoiceIndex] = invoice;
    this.savePaymentsDb(payments);
    this.saveReceiptsDb(receipts);
    this.saveInvoicesDb(invoices);
    await this.audit(organizationId, "Payment Recorded", `Recorded payment for invoice ${invoice.invoiceNumber}.`);
    await this.audit(organizationId, "Receipt Generated", `Generated receipt ${receipt.receiptNumber}.`);
    return { payment, receipt, invoice };
  }

  async voidPayment(organizationId: string, paymentId: string, reason: string, authorizedBy: string, actor?: ActorContext): Promise<FeePayment> {
    assertPermission(actor, "payment.void");
    if (!reason.trim() || !authorizedBy.trim()) throw new Error("Void reason and authorizer are required.");
    const payments = this.getPaymentsDb();
    const paymentIndex = payments.findIndex((payment) => payment.id === paymentId && payment.organizationId === organizationId);
    if (paymentIndex === -1) throw new Error("Payment not found.");
    if (payments[paymentIndex].status === "voided") throw new Error("Payment is already voided.");
    const invoices = this.getInvoicesDb();
    const invoiceIndex = invoices.findIndex((invoice) => invoice.id === payments[paymentIndex].invoiceId && invoice.organizationId === organizationId);
    if (invoiceIndex === -1) throw new Error("Invoice not found for payment.");
    const now = new Date().toISOString();
    payments[paymentIndex] = {
      ...payments[paymentIndex],
      status: "voided",
      voidedAt: now,
      voidReason: reason.trim(),
      voidedBy: authorizedBy.trim(),
      updatedAt: now,
    };
    const invoice = { ...invoices[invoiceIndex] };
    invoice.paidAmountCents = Math.max(0, invoice.paidAmountCents - payments[paymentIndex].amountCents);
    invoice.balanceCents = Math.max(0, invoice.totalCents - invoice.paidAmountCents);
    invoice.status = calculateInvoiceStatus(invoice);
    invoice.updatedAt = now;
    invoices[invoiceIndex] = invoice;
    this.savePaymentsDb(payments);
    this.saveInvoicesDb(invoices);
    await this.audit(organizationId, "Payment Voided", `Voided payment for invoice ${invoice.invoiceNumber}.`);
    return payments[paymentIndex];
  }

  async getPayments(organizationId: string, studentId?: string): Promise<FeePayment[]> {
    assertPermission(undefined, "payment.view");
    return this.getPaymentsDb().filter((payment) => payment.organizationId === organizationId && (!studentId || payment.studentId === studentId));
  }

  async getReceipts(organizationId: string, studentId?: string): Promise<FeeReceipt[]> {
    return this.getReceiptsDb().filter((receipt) => receipt.organizationId === organizationId && (!studentId || receipt.studentId === studentId));
  }

  async getStudentLedger(organizationId: string, studentId: string): Promise<StudentFeeLedgerEntry[]> {
    const invoices = await this.getInvoices(organizationId, { studentId });
    const payments = await this.getPayments(organizationId, studentId);
    const receipts = await this.getReceipts(organizationId, studentId);
    const rawEntries = [
      ...invoices.filter((invoice) => invoice.status !== "voided" && invoice.status !== "cancelled").map((invoice) => ({
        id: `ledger-${invoice.id}`,
        organizationId,
        studentId,
        invoiceId: invoice.id,
        type: "invoice" as const,
        description: `Invoice ${invoice.invoiceNumber}`,
        debitCents: invoice.totalCents,
        creditCents: 0,
        occurredAt: invoice.issueDate,
      })),
      ...payments.map((payment) => ({
        id: `ledger-${payment.id}`,
        organizationId,
        studentId,
        invoiceId: payment.invoiceId,
        paymentId: payment.id,
        receiptId: receipts.find((receipt) => receipt.paymentId === payment.id)?.id,
        type: payment.status === "voided" ? "payment_void" as const : "payment" as const,
        description: payment.status === "voided" ? `Voided payment ${payment.referenceNumber || payment.id}` : `Payment ${payment.referenceNumber || payment.id}`,
        debitCents: payment.status === "voided" ? payment.amountCents : 0,
        creditCents: payment.status === "voided" ? 0 : payment.amountCents,
        occurredAt: payment.paymentDate,
      })),
    ].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    let balanceCents = 0;
    return rawEntries.map((entry) => {
      balanceCents += entry.debitCents - entry.creditCents;
      return { ...entry, balanceCents };
    });
  }

  async getCollectionSummary(organizationId: string): Promise<FeeCollectionSummary> {
    const invoices = await this.getInvoices(organizationId);
    const activeInvoices = invoices.filter((invoice) => invoice.status !== "cancelled" && invoice.status !== "voided");
    const payments = await this.getPayments(organizationId);
    const today = todayIso();
    const totalBilledCents = activeInvoices.reduce((sum, invoice) => sum + invoice.totalCents, 0);
    const totalCollectedCents = activeInvoices.reduce((sum, invoice) => sum + invoice.paidAmountCents, 0);
    const overdueCents = activeInvoices.filter((invoice) => isOverdue(invoice)).reduce((sum, invoice) => sum + invoice.balanceCents, 0);
    const outstandingCents = activeInvoices.reduce((sum, invoice) => sum + invoice.balanceCents, 0);
    const paymentsTodayCents = payments
      .filter((payment) => payment.status === "recorded" && payment.paymentDate === today)
      .reduce((sum, payment) => sum + payment.amountCents, 0);
    const outstandingStudents = new Set(activeInvoices.filter((invoice) => invoice.balanceCents > 0).map((invoice) => invoice.studentId)).size;
    return {
      totalBilledCents,
      totalCollectedCents,
      outstandingCents,
      overdueCents,
      collectionRate: totalBilledCents === 0 ? 0 : Math.round((totalCollectedCents / totalBilledCents) * 10000) / 100,
      paymentsTodayCents,
      outstandingStudents,
    };
  }

  async getCollectionReport(organizationId: string, filters?: FeeReportFilters): Promise<FeeCollectionReportRow[]> {
    const invoices = await this.getInvoices(organizationId, filters);
    return invoices
      .filter((invoice) => invoice.status !== "cancelled" && invoice.status !== "voided")
      .map((invoice) => ({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        studentId: invoice.studentId,
        totalCents: invoice.totalCents,
        paidCents: invoice.paidAmountCents,
        balanceCents: invoice.balanceCents,
        status: invoice.status,
      }));
  }

  async getOutstandingReport(organizationId: string, filters?: FeeReportFilters): Promise<FeeCollectionReportRow[]> {
    return (await this.getCollectionReport(organizationId, filters)).filter((row) => row.balanceCents > 0);
  }

  async getPaymentReport(organizationId: string, filters?: FeeReportFilters): Promise<PaymentReportRow[]> {
    const invoices = await this.getInvoices(organizationId, filters);
    const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
    return (await this.getPayments(organizationId))
      .filter((payment) => invoiceIds.has(payment.invoiceId))
      .filter((payment) => !filters?.dateFrom || payment.paymentDate >= filters.dateFrom)
      .filter((payment) => !filters?.dateTo || payment.paymentDate <= filters.dateTo)
      .map((payment) => ({
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        studentId: payment.studentId,
        amountCents: payment.amountCents,
        paymentDate: payment.paymentDate,
        method: payment.paymentMethod,
        status: payment.status,
      }));
  }

  async getGradeFeeSummary(organizationId: string, filters?: FeeReportFilters): Promise<GradeFeeSummaryRow[]> {
    const invoices = await this.getInvoices(organizationId, filters);
    const enrollments = await EnrollmentService.getEnrollments(organizationId);
    const rows = new Map<string, GradeFeeSummaryRow>();
    for (const invoice of invoices.filter((item) => item.status !== "cancelled" && item.status !== "voided")) {
      const enrollment = enrollments.find((item) => item.id === invoice.enrollmentId);
      if (!enrollment) continue;
      if (filters?.gradeId && enrollment.gradeId !== filters.gradeId) continue;
      if (filters?.sectionId && enrollment.sectionId !== filters.sectionId) continue;
      const current = rows.get(enrollment.gradeId) || { gradeId: enrollment.gradeId, billedCents: 0, collectedCents: 0, outstandingCents: 0 };
      current.billedCents += invoice.totalCents;
      current.collectedCents += invoice.paidAmountCents;
      current.outstandingCents += invoice.balanceCents;
      rows.set(enrollment.gradeId, current);
    }
    return Array.from(rows.values());
  }
}

export const FinanceService = new FinanceServiceClass();
