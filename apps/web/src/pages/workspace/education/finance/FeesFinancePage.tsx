import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { EnrollmentService } from "@/modules/education/sis/enrollment.service";
import { FinanceService } from "@/modules/education/sis/finance.service";
import { StudentService } from "@/modules/education/sis/student.service";
import { useOrganization } from "@/org/use-organization";
import { navigate } from "@/routes/navigation";
import { Link } from "@/routes/router";
import type {
  AcademicYear,
  CashFlowReport,
  ExpenseCategory,
  ExpenseRecord,
  ExpenseStatus,
  FeeCategory,
  FeeCollectionReportRow,
  FeeDiscount,
  FeeFrequency,
  FeePayment,
  FeeReceipt,
  FeeStructure,
  Grade,
  GradeFeeSummaryRow,
  IncomeExpenseReport,
  IncomeRecord,
  InvoiceAdjustment,
  InvoiceStatus,
  LateFeePolicy,
  LateFeeType,
  LateFeesReport,
  LedgerReconciliationResult,
  PaymentMethod,
  PaymentReportRow,
  ReconciliationStatus,
  RecurringInvoiceGenerationResult,
  Student,
  StudentFeeAssignment,
  StudentFeeLedgerEntry,
  StudentInvoice,
} from "@/modules/education/sis/sis.types";
import {
  AdminPageHeader,
  Badge,
  Button,
  Card,
  CardContent,
  ExpenseStatusBadge,
  Input,
  InvoiceStatusBadge,
  PaymentMethodBadge,
  PaymentStatusBadge,
  ReconciliationStatusBadge,
  Select,
} from "@haza-aios/ui";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  Banknote,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Layers,
  Plus,
  Printer,
  Receipt,
  ReceiptText,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Undo2,
  UserCheck,
  WalletCards,
  X,
} from "lucide-react";

export type FinanceTab =
  | "overview"
  | "structures"
  | "invoices"
  | "payments"
  | "expenses"
  | "income"
  | "policies"
  | "accounts"
  | "reports";

interface FeesFinancePageProps {
  initialTab?: FinanceTab;
}

const frequencies: Array<{ label: string; value: FeeFrequency }> = [
  { label: "One-Time", value: "one_time" },
  { label: "Monthly", value: "monthly" },
  { label: "Quarterly", value: "quarterly" },
  { label: "Term-Based", value: "term_based" },
  { label: "Annual", value: "annual" },
  { label: "Custom", value: "custom" },
];

const paymentMethods: Array<{ label: string; value: PaymentMethod }> = [
  { label: "Cash", value: "cash" },
  { label: "Bank Transfer", value: "bank_transfer" },
  { label: "Card", value: "card" },
  { label: "Online", value: "online" },
  { label: "Cheque", value: "cheque" },
  { label: "Other", value: "other" },
];

function today() {
  return new Date().toISOString().split("T")[0];
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function toCents(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Math.round((Number.isFinite(parsed) ? parsed : 0) * 100);
}

function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export function FeesFinancePage({ initialTab = "overview" }: FeesFinancePageProps) {
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState<FinanceTab>(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Core Data Collections
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [assignments, setAssignments] = useState<StudentFeeAssignment[]>([]);
  const [discounts, setDiscounts] = useState<FeeDiscount[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [ledger, setLedger] = useState<StudentFeeLedgerEntry[]>([]);

  // Epic 10M Collections
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [lateFeePolicies, setLateFeePolicies] = useState<LateFeePolicy[]>([]);
  const [studentLedgerAudit, setStudentLedgerAudit] = useState<LedgerReconciliationResult | null>(null);
  const [systemLedgerAudit, setSystemLedgerAudit] = useState<{
    totalStudentsChecked: number;
    balancedStudentsCount: number;
    discrepancyStudentsCount: number;
    isBalanced: boolean;
  } | null>(null);

  // Modals & Selected Records
  const [activeModal, setActiveModal] = useState<
    | "createInvoice"
    | "recordPayment"
    | "viewInvoice"
    | "viewReceipt"
    | "voidPayment"
    | "assignFee"
    | "voidInvoice"
    | "recurringBilling"
    | "reconcilePayment"
    | "unreconcilePayment"
    | "createExpense"
    | "createExpenseCategory"
    | "approveExpense"
    | "rejectExpense"
    | "disburseExpense"
    | "createIncome"
    | "createPolicy"
    | null
  >(null);

  const [selectedInvoice, setSelectedInvoice] = useState<StudentInvoice | null>(null);
  const [selectedInvoiceToVoid, setSelectedInvoiceToVoid] = useState<StudentInvoice | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceipt | null>(null);
  const [selectedPaymentToVoid, setSelectedPaymentToVoid] = useState<FeePayment | null>(null);
  const [selectedPaymentToReconcile, setSelectedPaymentToReconcile] = useState<FeePayment | null>(null);
  const [selectedPaymentToUnreconcile, setSelectedPaymentToUnreconcile] = useState<FeePayment | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null);

  // Forms
  const [categoryForm, setCategoryForm] = useState({ name: "Tuition Fee", code: "TUITION", description: "" });
  const [structureForm, setStructureForm] = useState({
    name: "Monthly Tuition",
    academicYearId: "",
    gradeId: "",
    feeCategoryId: "",
    amount: "500.00",
    frequency: "monthly" as FeeFrequency,
    effectiveFrom: today(),
    effectiveTo: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    studentId: "",
    feeStructureId: "",
  });
  const [discountForm, setDiscountForm] = useState({
    name: "Merit Scholarship",
    type: "fixed" as "fixed" | "percentage",
    value: "100.00",
    reason: "Approved concession",
    authorizedBy: "Finance Admin",
    studentId: "",
    feeCategoryId: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    studentId: "",
    academicYearId: "",
    feeStructureId: "",
    discountId: "",
    issueDate: today(),
    dueDate: addDays(15),
    issueNow: true,
  });
  const [paymentForm, setPaymentForm] = useState({
    invoiceId: "",
    amount: "",
    paymentMethod: "cash" as PaymentMethod,
    referenceNumber: "",
    receivedBy: "Finance Desk",
    notes: "",
  });
  const [voidForm, setVoidForm] = useState({
    reason: "Correction / Administrative adjustment",
    authorizedBy: "Finance Director",
  });
  const [voidInvoiceForm, setVoidInvoiceForm] = useState({
    reason: "Administrative cancellation / Billing error",
    authorizedBy: "Bursar",
  });
  const [recurringForm, setRecurringForm] = useState({
    academicYearId: "",
    billingPeriod: new Date().toISOString().slice(0, 7),
    gradeId: "",
    feeStructureIds: [] as string[],
    issueDate: today(),
    dueDate: addDays(15),
    issueNow: true,
  });
  const [reconcileForm, setReconcileForm] = useState({
    bankStatementRef: "",
    notes: "Verified against cleared bank ledger",
    reconciledBy: "Finance Controller",
  });
  const [unreconcileForm, setUnreconcileForm] = useState({
    reason: "Statement discrepancy / Reversal requested",
    authorizedBy: "Finance Director",
  });
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    categoryId: "",
    amount: "",
    expenseDate: today(),
    payee: "",
    paymentMethod: "bank_transfer" as PaymentMethod,
    description: "",
  });
  const [expenseCategoryForm, setExpenseCategoryForm] = useState({
    code: "",
    name: "",
    description: "",
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [disbursementForm, setDisbursementForm] = useState({
    paymentMethod: "bank_transfer" as PaymentMethod,
    referenceNumber: "",
    disbursedBy: "Disbursement Officer",
  });
  const [incomeForm, setIncomeForm] = useState({
    source: "",
    category: "General",
    amount: "",
    receivedDate: today(),
    paymentMethod: "bank_transfer" as PaymentMethod,
    referenceNumber: "",
    receivedBy: "Finance Desk",
    notes: "",
  });
  const [policyForm, setPolicyForm] = useState({
    code: "",
    name: "",
    academicYearId: "",
    gracePeriodDays: 5,
    feeType: "fixed" as LateFeeType,
    amount: "25.00",
    percentage: "5",
    maxCap: "100.00",
    applyAutomatically: true,
  });

  // Filters & Selected Account
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>("all");
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<string>("all");
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [incomeSearchQuery, setIncomeSearchQuery] = useState("");

  // Reports State
  const [reportType, setReportType] = useState<
    "collection" | "outstanding" | "payments" | "grades" | "pl" | "cashflow" | "latefees"
  >("collection");
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportGradeId, setReportGradeId] = useState("");
  const [reportRows, setReportRows] = useState<
    Array<{ id: string; label: string; meta: string; amount: string; status?: string }>
  >([]);
  const [plReportData, setPlReportData] = useState<IncomeExpenseReport | null>(null);
  const [cashFlowReportData, setCashFlowReportData] = useState<CashFlowReport | null>(null);
  const [lateFeesReportData, setLateFeesReportData] = useState<LateFeesReport | null>(null);

  // Sync initialTab when props change
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const summary = useMemo(() => {
    const active = invoices.filter((invoice) => invoice.status !== "cancelled" && invoice.status !== "voided");
    const billed = active.reduce((sum, invoice) => sum + invoice.totalCents, 0);
    const collected = active.reduce((sum, invoice) => sum + invoice.paidAmountCents, 0);
    const outstanding = active.reduce((sum, invoice) => sum + invoice.balanceCents, 0);
    const overdue = active
      .filter((invoice) => invoice.balanceCents > 0 && invoice.dueDate < today())
      .reduce((sum, invoice) => sum + invoice.balanceCents, 0);
    const paymentsToday = payments
      .filter((p) => p.status === "recorded" && p.paymentDate === today())
      .reduce((sum, p) => sum + p.amountCents, 0);

    return {
      billed,
      collected,
      outstanding,
      overdue,
      paymentsToday,
      collectionRate: billed === 0 ? 0 : Math.round((collected / billed) * 10000) / 100,
      outstandingStudents: new Set(active.filter((invoice) => invoice.balanceCents > 0).map((invoice) => invoice.studentId)).size,
    };
  }, [invoices, payments]);

  useEffect(() => {
    void loadData();
  }, [currentOrganization]);

  useEffect(() => {
    if (!currentOrganization || !selectedStudentId) return;
    void Promise.resolve(FinanceService.getStudentLedger(currentOrganization.id, selectedStudentId))
      .then((res) => setLedger(res || []))
      .catch(() => setLedger([]));
    void Promise.resolve(FinanceService.getStudentLedgerReconciliation(currentOrganization.id, selectedStudentId))
      .then((res) => setStudentLedgerAudit(res || null))
      .catch(() => setStudentLedgerAudit(null));
  }, [currentOrganization, selectedStudentId, invoices.length, payments.length]);

  async function loadData() {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      const [
        yearsData,
        gradesData,
        studentsData,
        categoriesData,
        structuresData,
        assignmentsData,
        discountsData,
        invoicesData,
        paymentsData,
        receiptsData,
        expensesData,
        expenseCategoriesData,
        incomesData,
        policiesData,
      ] = await Promise.all([
        Promise.resolve(AcademicService.getAcademicYears(orgId)).catch(() => []),
        Promise.resolve(AcademicService.getGrades(orgId)).catch(() => []),
        Promise.resolve(StudentService.getStudents(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getFeeCategories(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getFeeStructures(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getStudentFeeAssignments(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getDiscounts(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getInvoices(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getPayments(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getReceipts(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getExpenses(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getExpenseCategories(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getIncomes(orgId)).catch(() => []),
        Promise.resolve(FinanceService.getLateFeePolicies(orgId)).catch(() => []),
      ]);

      setAcademicYears(yearsData);
      setGrades(gradesData);
      setStudents(studentsData);
      setCategories(categoriesData);
      setStructures(structuresData);
      setAssignments(assignmentsData);
      setDiscounts(discountsData);
      setInvoices(invoicesData);
      setPayments(paymentsData);
      setReceipts(receiptsData);
      setExpenses(expensesData || []);
      setExpenseCategories(expenseCategoriesData || []);
      setIncomes(incomesData || []);
      setLateFeePolicies(policiesData || []);

      const activeYear = yearsData.find((year) => year.status === "active") || yearsData[0];
      setStructureForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || activeYear?.id || "",
        gradeId: current.gradeId || gradesData[0]?.id || "",
        feeCategoryId: current.feeCategoryId || categoriesData[0]?.id || "",
      }));
      setAssignmentForm((current) => ({
        ...current,
        studentId: current.studentId || studentsData[0]?.id || "",
        feeStructureId: current.feeStructureId || structuresData[0]?.id || "",
      }));
      setInvoiceForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || activeYear?.id || "",
        studentId: current.studentId || studentsData[0]?.id || "",
        feeStructureId: current.feeStructureId || structuresData[0]?.id || "",
      }));
      setPaymentForm((current) => ({
        ...current,
        invoiceId: current.invoiceId || invoicesData.find((invoice) => invoice.balanceCents > 0)?.id || "",
      }));
      setRecurringForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || activeYear?.id || "",
        feeStructureIds: current.feeStructureIds.length ? current.feeStructureIds : structuresData.slice(0, 1).map((s) => s.id),
      }));
      setExpenseForm((current) => ({
        ...current,
        categoryId: current.categoryId || expenseCategoriesData[0]?.id || "",
      }));
      setPolicyForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || activeYear?.id || "",
      }));
      setSelectedStudentId((current) => current || studentsData[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load finance data.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setMessage(null);
    setError(null);
    setIsSubmitting(true);
    try {
      await action();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finance action failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- Handlers ---

  async function handleCreateCategory() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.createFeeCategory(currentOrganization.id, {
        name: categoryForm.name.trim(),
        code: categoryForm.code.trim().toUpperCase(),
        description: categoryForm.description.trim() || undefined,
        status: "active",
        displayOrder: categories.length + 1,
      });
      setMessage("Fee category created successfully.");
      setCategoryForm({ name: "", code: "", description: "" });
    });
  }

  async function handleCreateStructure() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.createFeeStructure(currentOrganization.id, {
        name: structureForm.name.trim(),
        academicYearId: structureForm.academicYearId,
        gradeId: structureForm.gradeId,
        feeCategoryId: structureForm.feeCategoryId,
        amountCents: toCents(structureForm.amount),
        frequency: structureForm.frequency,
        effectiveFrom: structureForm.effectiveFrom,
        effectiveTo: structureForm.effectiveTo || undefined,
        status: "active",
      });
      setMessage("Fee structure created successfully.");
      setStructureForm((curr) => ({ ...curr, name: "", amount: "500.00" }));
    });
  }

  async function handleAssignFee() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const enrollment = await EnrollmentService.getCurrentEnrollment(assignmentForm.studentId, currentOrganization.id);
      if (!enrollment) throw new Error("Selected student does not have an active enrollment.");
      await FinanceService.assignFeeStructureToStudent(
        currentOrganization.id,
        assignmentForm.studentId,
        enrollment.id,
        assignmentForm.feeStructureId
      );
      setMessage("Fee structure assigned to student successfully.");
      setActiveModal(null);
    });
  }

  async function handleCreateDiscount() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.createDiscount(currentOrganization.id, {
        name: discountForm.name.trim(),
        type: discountForm.type,
        value: discountForm.type === "fixed" ? toCents(discountForm.value) : Number(discountForm.value),
        reason: discountForm.reason.trim(),
        authorizedBy: discountForm.authorizedBy.trim(),
        studentId: discountForm.studentId || undefined,
        feeCategoryId: discountForm.feeCategoryId || undefined,
        status: "active",
      });
      setMessage("Discount rule created successfully.");
      setDiscountForm((curr) => ({ ...curr, name: "", value: "100.00" }));
    });
  }

  async function handleCreateInvoice() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const enrollment = await EnrollmentService.getCurrentEnrollment(invoiceForm.studentId, currentOrganization.id);
      if (!enrollment) throw new Error("Selected student does not have an active enrollment.");
      await FinanceService.createInvoice(currentOrganization.id, {
        studentId: invoiceForm.studentId,
        enrollmentId: enrollment.id,
        academicYearId: invoiceForm.academicYearId,
        issueDate: invoiceForm.issueDate,
        dueDate: invoiceForm.dueDate,
        currency: currentOrganization.currency || "USD",
        feeStructureIds: [invoiceForm.feeStructureId].filter(Boolean),
        discountIds: [invoiceForm.discountId].filter(Boolean),
        status: invoiceForm.issueNow ? "issued" : "draft",
      });
      setMessage("Invoice generated successfully.");
      setActiveModal(null);
    });
  }

  async function handleIssueDraftInvoice(invoiceId: string) {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.issueInvoice(currentOrganization.id, invoiceId);
      setMessage("Draft invoice issued successfully.");
    });
  }

  async function handleVoidInvoice() {
    if (!currentOrganization || !selectedInvoiceToVoid) return;
    await runAction(async () => {
      await FinanceService.voidInvoice(
        currentOrganization.id,
        selectedInvoiceToVoid.id,
        voidInvoiceForm.reason.trim(),
        voidInvoiceForm.authorizedBy.trim()
      );
      setMessage(`Invoice ${selectedInvoiceToVoid.invoiceNumber} voided.`);
      setActiveModal(null);
      setSelectedInvoiceToVoid(null);
    });
  }

  async function handleGenerateRecurring() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const res = await FinanceService.generateRecurringInvoices(currentOrganization.id, {
        academicYearId: recurringForm.academicYearId,
        billingPeriod: recurringForm.billingPeriod,
        gradeId: recurringForm.gradeId || undefined,
        feeStructureIds: recurringForm.feeStructureIds,
        issueDate: recurringForm.issueDate,
        dueDate: recurringForm.dueDate,
        issueNow: recurringForm.issueNow,
      });
      setMessage(`Batch Recurring Run: ${res.createdInvoicesCount} invoices generated, ${res.skippedDuplicatesCount} duplicate active assignments skipped.`);
      setActiveModal(null);
    });
  }

  async function handleRecordPayment() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const result = await FinanceService.recordPayment(currentOrganization.id, {
        invoiceId: paymentForm.invoiceId,
        amountCents: toCents(paymentForm.amount),
        paymentDate: today(),
        paymentMethod: paymentForm.paymentMethod,
        referenceNumber: paymentForm.referenceNumber.trim() || undefined,
        receivedBy: paymentForm.receivedBy.trim() || "Finance Desk",
        notes: paymentForm.notes.trim() || undefined,
      });
      setMessage(`Payment recorded. Receipt ${result.receipt.receiptNumber} generated.`);
      setActiveModal(null);
      setPaymentForm((curr) => ({ ...curr, amount: "", referenceNumber: "", notes: "" }));
    });
  }

  async function handleVoidPayment() {
    if (!currentOrganization || !selectedPaymentToVoid) return;
    await runAction(async () => {
      await FinanceService.voidPayment(
        currentOrganization.id,
        selectedPaymentToVoid.id,
        voidForm.reason.trim(),
        voidForm.authorizedBy.trim()
      );
      setMessage(`Payment ${selectedPaymentToVoid.referenceNumber || selectedPaymentToVoid.id} voided and invoice balance adjusted.`);
      setActiveModal(null);
      setSelectedPaymentToVoid(null);
    });
  }

  async function handleReconcilePayment() {
    if (!currentOrganization || !selectedPaymentToReconcile) return;
    await runAction(async () => {
      await FinanceService.reconcilePayment(currentOrganization.id, selectedPaymentToReconcile.id, {
        bankStatementRef: reconcileForm.bankStatementRef.trim(),
        notes: reconcileForm.notes.trim() || undefined,
        reconciledBy: reconcileForm.reconciledBy.trim(),
      });
      setMessage(`Payment ${selectedPaymentToReconcile.referenceNumber || selectedPaymentToReconcile.id} reconciled against bank ledger.`);
      setActiveModal(null);
      setSelectedPaymentToReconcile(null);
    });
  }

  async function handleUnreconcilePayment() {
    if (!currentOrganization || !selectedPaymentToUnreconcile) return;
    await runAction(async () => {
      await FinanceService.unreconcilePayment(currentOrganization.id, selectedPaymentToUnreconcile.id, {
        reason: unreconcileForm.reason.trim(),
        authorizedBy: unreconcileForm.authorizedBy.trim(),
      });
      setMessage(`Payment ${selectedPaymentToUnreconcile.referenceNumber || selectedPaymentToUnreconcile.id} unreconciled for adjustment.`);
      setActiveModal(null);
      setSelectedPaymentToUnreconcile(null);
    });
  }

  // Expenses Handlers
  async function handleCreateExpense() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.createExpense(currentOrganization.id, {
        title: expenseForm.title.trim(),
        categoryId: expenseForm.categoryId,
        amountCents: toCents(expenseForm.amount),
        expenseDate: expenseForm.expenseDate,
        payee: expenseForm.payee.trim(),
        paymentMethod: expenseForm.paymentMethod,
        description: expenseForm.description.trim() || undefined,
      });
      setMessage("Expense request created in draft status.");
      setActiveModal(null);
      setExpenseForm({
        title: "",
        categoryId: expenseCategories[0]?.id || "",
        amount: "",
        expenseDate: today(),
        payee: "",
        paymentMethod: "bank_transfer",
        description: "",
      });
    });
  }

  async function handleCreateExpenseCategory() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.createExpenseCategory(currentOrganization.id, {
        code: expenseCategoryForm.code.trim().toUpperCase(),
        name: expenseCategoryForm.name.trim(),
        description: expenseCategoryForm.description.trim() || undefined,
        status: "active",
        displayOrder: expenseCategories.length + 1,
      });
      setMessage("Expense category created successfully.");
      setActiveModal(null);
      setExpenseCategoryForm({ code: "", name: "", description: "" });
    });
  }

  async function handleSubmitExpense(id: string) {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.submitExpense(currentOrganization.id, id);
      setMessage("Expense submitted for administrative approval.");
    });
  }

  async function handleApproveExpense() {
    if (!currentOrganization || !selectedExpense) return;
    await runAction(async () => {
      await FinanceService.approveExpense(currentOrganization.id, selectedExpense.id, "Finance Director");
      setMessage(`Expense "${selectedExpense.title}" approved.`);
      setActiveModal(null);
      setSelectedExpense(null);
    });
  }

  async function handleRejectExpense() {
    if (!currentOrganization || !selectedExpense) return;
    await runAction(async () => {
      await FinanceService.rejectExpense(
        currentOrganization.id,
        selectedExpense.id,
        rejectionReason.trim(),
        "Finance Director"
      );
      setMessage(`Expense "${selectedExpense.title}" rejected.`);
      setActiveModal(null);
      setSelectedExpense(null);
      setRejectionReason("");
    });
  }

  async function handleDisburseExpense() {
    if (!currentOrganization || !selectedExpense) return;
    await runAction(async () => {
      await FinanceService.disburseExpense(currentOrganization.id, selectedExpense.id, {
        paymentMethod: disbursementForm.paymentMethod,
        referenceNumber: disbursementForm.referenceNumber.trim() || undefined,
        disbursedBy: disbursementForm.disbursedBy.trim(),
      });
      setMessage(`Expense "${selectedExpense.title}" disbursed and marked paid.`);
      setActiveModal(null);
      setSelectedExpense(null);
    });
  }

  async function handleDeleteExpense(id: string) {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.deleteExpense(currentOrganization.id, id);
      setMessage("Expense deleted.");
    });
  }

  // Non-Tuition Income Handlers
  async function handleCreateIncome() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const res = await FinanceService.createIncome(currentOrganization.id, {
        source: incomeForm.source.trim(),
        category: incomeForm.category.trim(),
        amountCents: toCents(incomeForm.amount),
        receivedDate: incomeForm.receivedDate,
        paymentMethod: incomeForm.paymentMethod,
        referenceNumber: incomeForm.referenceNumber.trim() || undefined,
        receivedBy: incomeForm.receivedBy.trim(),
        notes: incomeForm.notes.trim() || undefined,
        status: "active",
      });
      setMessage(`Income recorded. Receipt voucher ${res.receiptNumber} issued.`);
      setActiveModal(null);
      setIncomeForm({
        source: "",
        category: "General",
        amount: "",
        receivedDate: today(),
        paymentMethod: "bank_transfer",
        referenceNumber: "",
        receivedBy: "Finance Desk",
        notes: "",
      });
    });
  }

  async function handleDeleteIncome(id: string) {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.deleteIncome(currentOrganization.id, id);
      setMessage("Income entry deleted.");
    });
  }

  // Late Fee Policy Handlers
  async function handleCreatePolicy() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.createLateFeePolicy(currentOrganization.id, {
        code: policyForm.code.trim().toUpperCase(),
        name: policyForm.name.trim(),
        academicYearId: policyForm.academicYearId,
        gracePeriodDays: Number(policyForm.gracePeriodDays),
        feeType: policyForm.feeType,
        amountCents: policyForm.feeType === "fixed" ? toCents(policyForm.amount) : 0,
        percentageRate: policyForm.feeType === "percentage" ? Number(policyForm.percentage) : 0,
        maxCapCents: policyForm.maxCap ? toCents(policyForm.maxCap) : 0,
        status: "active",
        applyAutomatically: policyForm.applyAutomatically,
      });
      setMessage("Late fee policy created successfully.");
      setActiveModal(null);
      setPolicyForm({
        code: "",
        name: "",
        academicYearId: academicYears[0]?.id || "",
        gracePeriodDays: 5,
        feeType: "fixed",
        amount: "25.00",
        percentage: "5",
        maxCap: "100.00",
        applyAutomatically: true,
      });
    });
  }

  async function handleDeletePolicy(id: string) {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.deleteLateFeePolicy(currentOrganization.id, id);
      setMessage("Late fee policy deleted.");
    });
  }

  async function handleApplyLateFees(policyId?: string) {
    if (!currentOrganization) return;
    await runAction(async () => {
      const res = await FinanceService.applyLateFees(currentOrganization.id, {
        policyId,
        asOfDate: today(),
      });
      setMessage(
        `Late fee evaluation completed: ${res.appliedCount} overdue invoices adjusted. Total penalties applied: ${money(
          res.totalLateFeesCents
        )}.`
      );
    });
  }

  async function handleAuditSystemLedger() {
    if (!currentOrganization) return;
    await runAction(async () => {
      const res = await FinanceService.auditLedgerIntegrity(currentOrganization.id);
      setSystemLedgerAudit({
        totalStudentsChecked: res.totalStudentsChecked,
        balancedStudentsCount: res.balancedStudentsCount,
        discrepancyStudentsCount: res.discrepancyStudentsCount,
        isBalanced: res.discrepancyStudentsCount === 0,
      });
      setMessage(
        `System-wide ledger audit completed. ${res.totalStudentsChecked} students checked. Discrepancies: ${res.discrepancyStudentsCount}.`
      );
    });
  }

  async function handleRunReport() {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const filters = {
        dateFrom: reportDateFrom || undefined,
        dateTo: reportDateTo || undefined,
        gradeId: reportGradeId || undefined,
      };

      if (reportType === "pl") {
        const rep = await FinanceService.getIncomeExpenseReport(currentOrganization.id, filters);
        setPlReportData(rep);
        setReportRows([
          {
            id: "pl-rev",
            label: "Total Revenue",
            meta: `Tuition: ${money(rep.totalFeeIncomeCents)} • Other: ${money(rep.totalOtherIncomeCents)}`,
            amount: money(rep.totalRevenueCents),
            status: "Income",
          },
          {
            id: "pl-exp",
            label: "Total Expenses",
            meta: `${rep.expensesCount} operating expenses`,
            amount: money(rep.totalExpenseCents),
            status: "Expense",
          },
          {
            id: "pl-net",
            label: "Net Operating Surplus",
            meta: `Operating Margin: ${rep.marginPercentage}%`,
            amount: money(rep.netSurplusCents),
            status: rep.netSurplusCents >= 0 ? "Surplus" : "Deficit",
          },
          ...Object.entries(rep.incomeByCategory).map(([cat, amt]) => ({
            id: `pl-inc-${cat}`,
            label: `Income Category: ${cat}`,
            meta: "Revenue Stream",
            amount: money(amt),
            status: "Income",
          })),
          ...Object.entries(rep.expenseByCategory).map(([cat, amt]) => ({
            id: `pl-exp-${cat}`,
            label: `Expense Category: ${cat}`,
            meta: "Operating Outflow",
            amount: money(amt),
            status: "Expense",
          })),
        ]);
      } else if (reportType === "cashflow") {
        const rep = await FinanceService.getCashFlowReport(currentOrganization.id, filters);
        setCashFlowReportData(rep);
        setReportRows(
          rep.timeline.map((item, idx) => ({
            id: `cf-${idx}-${item.date}`,
            label: `${item.date} • ${item.description}`,
            meta: item.inflowCents > 0 ? `Inflow: +${money(item.inflowCents)}` : `Outflow: -${money(item.outflowCents)}`,
            amount: item.inflowCents > 0 ? `+${money(item.inflowCents)}` : `-${money(item.outflowCents)}`,
            status: item.type.replace(/_/g, " "),
          }))
        );
      } else if (reportType === "latefees") {
        const rep = await FinanceService.getLateFeesReport(currentOrganization.id, filters);
        setLateFeesReportData(rep);
        setReportRows(
          rep.invoices.map((inv) => ({
            id: inv.invoiceId,
            label: `${inv.invoiceNumber} • ${studentName(inv.studentId)}`,
            meta: `Due Date: ${inv.dueDate} • ${inv.daysOverdue} days overdue`,
            amount: money(inv.balanceCents),
            status: inv.status,
          }))
        );
      } else if (reportType === "outstanding") {
        const rows = await FinanceService.getOutstandingReport(currentOrganization.id, filters);
        setReportRows(
          rows.map((row) => ({
            id: row.invoiceId,
            label: `${row.invoiceNumber} • ${studentName(row.studentId)}`,
            meta: `Total ${money(row.totalCents)} • Paid ${money(row.paidCents)}`,
            amount: money(row.balanceCents),
            status: row.status,
          }))
        );
      } else if (reportType === "payments") {
        const rows = await FinanceService.getPaymentReport(currentOrganization.id, filters);
        setReportRows(
          rows.map((row) => ({
            id: row.paymentId,
            label: `${studentName(row.studentId)} • Ref: ${row.paymentId.slice(0, 8)}`,
            meta: `Date: ${row.paymentDate} • Method: ${row.method}`,
            amount: money(row.amountCents),
            status: row.status,
          }))
        );
      } else if (reportType === "grades") {
        const rows = await FinanceService.getGradeFeeSummary(currentOrganization.id, filters);
        setReportRows(
          rows.map((row) => ({
            id: row.gradeId,
            label: `Grade: ${gradeName(row.gradeId)}`,
            meta: `Billed: ${money(row.billedCents)} • Collected: ${money(row.collectedCents)}`,
            amount: `Bal: ${money(row.outstandingCents)}`,
            status: row.billedCents === 0 ? "0%" : `${Math.round((row.collectedCents / row.billedCents) * 100)}% Collected`,
          }))
        );
      } else {
        const rows = await FinanceService.getCollectionReport(currentOrganization.id, filters);
        setReportRows(
          rows.map((row) => ({
            id: row.invoiceId,
            label: `${row.invoiceNumber} • ${studentName(row.studentId)}`,
            meta: `Paid ${money(row.paidCents)} of ${money(row.totalCents)}`,
            amount: money(row.balanceCents),
            status: row.status,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleExportCsv() {
    if (reportRows.length === 0) return;
    const headers = ["Label", "Details", "Amount", "Status"];
    const lines = reportRows.map((r) =>
      [`"${r.label.replace(/"/g, '""')}"`, `"${r.meta.replace(/"/g, '""')}"`, `"${r.amount}"`, `"${r.status || ""}"`].join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...lines].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finance-${reportType}-report-${today()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function openPayModalForInvoice(inv: StudentInvoice) {
    setPaymentForm((curr) => ({
      ...curr,
      invoiceId: inv.id,
      amount: fromCents(inv.balanceCents),
    }));
    setActiveModal("recordPayment");
  }

  // --- Formatters & Helpers ---

  function money(cents: number) {
    return `${currentOrganization?.currency || "USD"} ${fromCents(cents)}`;
  }

  function studentName(id: string) {
    const student = students.find((item) => item.id === id);
    return student ? `${student.firstName} ${student.lastName}` : id;
  }

  function studentAdmission(id: string) {
    const student = students.find((item) => item.id === id);
    return student?.admissionNumber || "";
  }

  function gradeName(id: string) {
    return grades.find((grade) => grade.id === id)?.name || id;
  }

  function categoryName(id: string) {
    return categories.find((category) => category.id === id)?.name || id;
  }

  function expenseCategoryName(id: string) {
    return expenseCategories.find((c) => c.id === id)?.name || id;
  }

  // Filtered lists
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchQuery =
        !invoiceSearchQuery ||
        inv.invoiceNumber.toLowerCase().includes(invoiceSearchQuery.toLowerCase()) ||
        studentName(inv.studentId).toLowerCase().includes(invoiceSearchQuery.toLowerCase());
      const matchStatus = invoiceStatusFilter === "all" || inv.status === invoiceStatusFilter;
      return matchQuery && matchStatus;
    });
  }, [invoices, invoiceSearchQuery, invoiceStatusFilter, students]);

  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      const matchQuery =
        !paymentSearchQuery ||
        (pay.referenceNumber && pay.referenceNumber.toLowerCase().includes(paymentSearchQuery.toLowerCase())) ||
        studentName(pay.studentId).toLowerCase().includes(paymentSearchQuery.toLowerCase());
      const matchMethod = paymentMethodFilter === "all" || pay.paymentMethod === paymentMethodFilter;
      const matchStatus = paymentStatusFilter === "all" || pay.status === paymentStatusFilter;
      return matchQuery && matchMethod && matchStatus;
    });
  }, [payments, paymentSearchQuery, paymentMethodFilter, paymentStatusFilter, students]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchQuery =
        !expenseSearchQuery ||
        e.title.toLowerCase().includes(expenseSearchQuery.toLowerCase()) ||
        e.payee.toLowerCase().includes(expenseSearchQuery.toLowerCase());
      const matchStatus = expenseStatusFilter === "all" || e.status === expenseStatusFilter;
      return matchQuery && matchStatus;
    });
  }, [expenses, expenseSearchQuery, expenseStatusFilter]);

  const filteredIncomes = useMemo(() => {
    return incomes.filter((i) => {
      return (
        !incomeSearchQuery ||
        i.source.toLowerCase().includes(incomeSearchQuery.toLowerCase()) ||
        i.category.toLowerCase().includes(incomeSearchQuery.toLowerCase()) ||
        (i.referenceNumber && i.referenceNumber.toLowerCase().includes(incomeSearchQuery.toLowerCase()))
      );
    });
  }, [incomes, incomeSearchQuery]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedStudentInvoices = invoices.filter(
    (i) => i.studentId === selectedStudentId && i.status !== "cancelled" && i.status !== "voided"
  );
  const studentTotalBilled = selectedStudentInvoices.reduce((s, i) => s + i.totalCents, 0);
  const studentTotalPaid = selectedStudentInvoices.reduce((s, i) => s + i.paidAmountCents, 0);
  const studentOutstanding = selectedStudentInvoices.reduce((s, i) => s + i.balanceCents, 0);

  return (
    <AppShell>
      <div className="max-w-7xl space-y-6">
        <AdminPageHeader
          title="Fee & Billing Management"
          description="Enterprise SIS financial operations, configurable fee structures, automated student invoicing, receipts, payments, ledger tracking, and collection analytics."
          breadcrumbs={[
            { label: "Workspace", onClick: () => navigate("/workspace") },
            { label: "Education", onClick: () => navigate("/workspace/education/finance") },
            { label: "Fees & Finance" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="border-white/10 bg-white/5 text-slate-300">
                Currency: {currentOrganization?.currency || "USD"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadData()}
                disabled={isLoading}
                className="border-white/10 text-slate-300 hover:bg-white/5"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          }
        />

        <div className="flex items-center justify-between">
          <Link to="/workspace" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Workspace
          </Link>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setActiveModal("createInvoice")}
              className="bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm shadow-red-500/20"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Generate Invoice
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveModal("recordPayment")}
              className="border-white/10 text-slate-200 hover:bg-white/5"
            >
              <CreditCard className="mr-1.5 h-4 w-4" /> Record Payment
            </Button>
          </div>
        </div>

        {message && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{message}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Financial KPI Dashboard Cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <SummaryKpiCard icon={<Banknote className="h-5 w-5" />} label="Total Billed" value={money(summary.billed)} />
          <SummaryKpiCard icon={<WalletCards className="h-5 w-5" />} label="Collected" value={money(summary.collected)} color="emerald" />
          <SummaryKpiCard icon={<Landmark className="h-5 w-5" />} label="Outstanding" value={money(summary.outstanding)} color="amber" />
          <SummaryKpiCard icon={<FileText className="h-5 w-5" />} label="Overdue" value={money(summary.overdue)} color="rose" />
          <SummaryKpiCard icon={<ReceiptText className="h-5 w-5" />} label="Collection Rate" value={`${summary.collectionRate}%`} color="indigo" />
          <SummaryKpiCard icon={<DollarSign className="h-5 w-5" />} label="Today's Receipts" value={money(summary.paymentsToday)} color="purple" />
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-white/5 pb-3">
          {(
            [
              { id: "overview", label: "Overview", icon: Landmark },
              { id: "structures", label: "Fee Structures", icon: Layers },
              { id: "invoices", label: `Invoices (${invoices.length})`, icon: FileText },
              { id: "payments", label: `Payments & Receipts (${payments.length})`, icon: CreditCard },
              { id: "expenses", label: `Expenses (${expenses.length})`, icon: ArrowDownRight },
              { id: "income", label: `Other Income (${incomes.length})`, icon: ArrowUpRight },
              { id: "policies", label: `Late Fee Policies (${lateFeePolicies.length})`, icon: Calendar },
              { id: "accounts", label: "Student Accounts", icon: UserCheck },
              { id: "reports", label: "Reports & Analytics", icon: FileSpreadsheet },
            ] as Array<{ id: FinanceTab; label: string; icon: React.ComponentType<{ className?: string }> }>
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Button
                key={tab.id}
                data-testid={`finance-tab-${tab.id}`}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab(tab.id)}
                className={
                  isActive
                    ? "bg-red-600 hover:bg-red-700 text-white font-medium"
                    : "border-white/5 bg-[#0f141f] text-slate-300 hover:bg-white/5 hover:text-white"
                }
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {tab.label}
              </Button>
            );
          })}
        </div>

        {isLoading ? (
          <Card className="border-white/5 bg-[#0f141f]">
            <CardContent className="flex items-center justify-center p-12 text-slate-400">
              <RefreshCw className="mr-3 h-5 w-5 animate-spin text-red-500" />
              Loading finance ledger and accounts...
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 1. OVERVIEW TAB */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Recent Invoices Card */}
                  <Card className="border-white/5 bg-[#0f141f]">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-5 w-5 text-red-400" />
                          <h2 className="text-base font-semibold text-white">Recent Invoices</h2>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab("invoices")}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          View All ({invoices.length}) <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {invoices.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                          No invoices generated yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5 rounded-xl border border-white/5 overflow-hidden">
                          {invoices.slice(0, 5).map((invoice) => (
                            <div key={invoice.id} className="flex items-center justify-between p-3.5 hover:bg-white/[0.02]">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-white">{invoice.invoiceNumber}</span>
                                  <InvoiceStatusBadge status={invoice.status} />
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {studentName(invoice.studentId)} • Due: {invoice.dueDate}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-sm text-white">{money(invoice.totalCents)}</p>
                                <p className="text-xs text-amber-400">Bal: {money(invoice.balanceCents)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Recent Payments Card */}
                  <Card className="border-white/5 bg-[#0f141f]">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-5 w-5 text-emerald-400" />
                          <h2 className="text-base font-semibold text-white">Recent Receipts & Payments</h2>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveTab("payments")}
                          className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          View All ({payments.length}) <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {payments.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                          No payments recorded yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5 rounded-xl border border-white/5 overflow-hidden">
                          {payments.slice(0, 5).map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between p-3.5 hover:bg-white/[0.02]">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm text-white">{studentName(payment.studentId)}</span>
                                  <PaymentMethodBadge method={payment.paymentMethod} />
                                  <PaymentStatusBadge status={payment.status} />
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  Date: {payment.paymentDate} • Ref: {payment.referenceNumber || "Direct"}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-sm text-emerald-400">+{money(payment.amountCents)}</p>
                                <p className="text-xs text-slate-500">{payment.receivedBy}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* 2. FEE STRUCTURES TAB */}
            {activeTab === "structures" && (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Create Structure Card */}
                  <Card className="border-white/5 bg-[#0f141f]">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-red-400" />
                        <h2 className="text-base font-semibold text-white">Create Fee Structure</h2>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="text-xs text-slate-400">Structure Name</label>
                          <Input
                            placeholder="e.g. Monthly Tuition"
                            value={structureForm.name}
                            onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">Academic Year</label>
                          <Select
                            value={structureForm.academicYearId}
                            onChange={(e) => setStructureForm({ ...structureForm, academicYearId: e.target.value })}
                            className="mt-1"
                          >
                            {academicYears.map((year) => (
                              <option key={year.id} value={year.id}>
                                {year.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">Target Grade</label>
                          <Select
                            value={structureForm.gradeId}
                            onChange={(e) => setStructureForm({ ...structureForm, gradeId: e.target.value })}
                            className="mt-1"
                          >
                            {grades.map((grade) => (
                              <option key={grade.id} value={grade.id}>
                                {grade.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">Fee Category</label>
                          <Select
                            value={structureForm.feeCategoryId}
                            onChange={(e) => setStructureForm({ ...structureForm, feeCategoryId: e.target.value })}
                            className="mt-1"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.code})
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">Amount ({currentOrganization?.currency || "USD"})</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={structureForm.amount}
                            onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">Billing Frequency</label>
                          <Select
                            value={structureForm.frequency}
                            onChange={(e) => setStructureForm({ ...structureForm, frequency: e.target.value as FeeFrequency })}
                            className="mt-1"
                          >
                            {frequencies.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">Effective Date</label>
                          <Input
                            type="date"
                            value={structureForm.effectiveFrom}
                            onChange={(e) => setStructureForm({ ...structureForm, effectiveFrom: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleCreateStructure}
                        disabled={isSubmitting || !structureForm.name}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-medium"
                      >
                        <Plus className="mr-1.5 h-4 w-4" /> Save Fee Structure
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Create Category Card */}
                  <Card className="border-white/5 bg-[#0f141f]">
                    <CardContent className="space-y-4 p-6">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-5 w-5 text-indigo-400" />
                        <h2 className="text-base font-semibold text-white">Create Fee Category</h2>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs text-slate-400">Category Name</label>
                          <Input
                            placeholder="e.g. Science Lab Fee"
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400">Code</label>
                          <Input
                            placeholder="e.g. LAB"
                            value={categoryForm.code}
                            onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                            className="mt-1 font-mono uppercase"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-slate-400">Description</label>
                          <Input
                            placeholder="Optional category description"
                            value={categoryForm.description}
                            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleCreateCategory}
                        disabled={isSubmitting || !categoryForm.name || !categoryForm.code}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                      >
                        <Plus className="mr-1.5 h-4 w-4" /> Add Category
                      </Button>

                      {/* Existing Categories List */}
                      <div className="pt-2">
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Active Categories</h3>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => (
                            <Badge key={cat.id} variant="secondary" className="border-white/10 bg-slate-900/60 text-slate-200">
                              {cat.name} ({cat.code})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Structures Table */}
                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-red-400" />
                        <h2 className="text-base font-semibold text-white">Configured Fee Structures ({structures.length})</h2>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveModal("assignFee")}
                        className="border-white/10 text-slate-200 hover:bg-white/5"
                      >
                        <UserCheck className="mr-1.5 h-4 w-4" /> Assign Structure to Student
                      </Button>
                    </div>

                    {structures.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-500">No fee structures configured yet.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                            <tr>
                              <th className="p-3">Structure Name</th>
                              <th className="p-3">Category</th>
                              <th className="p-3">Grade</th>
                              <th className="p-3">Frequency</th>
                              <th className="p-3">Effective</th>
                              <th className="p-3 text-right">Amount</th>
                              <th className="p-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {structures.map((s) => (
                              <tr key={s.id} className="hover:bg-white/[0.02]">
                                <td className="p-3 font-medium text-white">{s.name}</td>
                                <td className="p-3">{categoryName(s.feeCategoryId)}</td>
                                <td className="p-3">{gradeName(s.gradeId)}</td>
                                <td className="p-3 capitalize">{s.frequency.replace("_", " ")}</td>
                                <td className="p-3 text-slate-400">{s.effectiveFrom}</td>
                                <td className="p-3 text-right font-semibold text-white">{money(s.amountCents)}</td>
                                <td className="p-3">
                                  <Badge variant="secondary" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px]">
                                    {s.status}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Discounts Card */}
                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-2">
                      <WalletCards className="h-5 w-5 text-amber-400" />
                      <h2 className="text-base font-semibold text-white">Discounts, Scholarships & Concessions</h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="text-xs text-slate-400">Concession Name</label>
                        <Input
                          placeholder="e.g. Sibling Concession"
                          value={discountForm.name}
                          onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">Type</label>
                        <Select
                          value={discountForm.type}
                          onChange={(e) => setDiscountForm({ ...discountForm, type: e.target.value as "fixed" | "percentage" })}
                          className="mt-1"
                        >
                          <option value="fixed">Fixed Amount ({currentOrganization?.currency || "USD"})</option>
                          <option value="percentage">Percentage (%)</option>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">Value</label>
                        <Input
                          value={discountForm.value}
                          onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">Reason</label>
                        <Input
                          value={discountForm.reason}
                          onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">Authorizer</label>
                        <Input
                          value={discountForm.authorizedBy}
                          onChange={(e) => setDiscountForm({ ...discountForm, authorizedBy: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={handleCreateDiscount}
                          disabled={isSubmitting || !discountForm.name}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium"
                        >
                          <Plus className="mr-1.5 h-4 w-4" /> Save Discount
                        </Button>
                      </div>
                    </div>

                    {/* Active Discounts Table */}
                    <div className="pt-2">
                      {discounts.length > 0 && (
                        <div className="overflow-x-auto rounded-xl border border-white/5">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                              <tr>
                                <th className="p-2.5">Rule Name</th>
                                <th className="p-2.5">Type</th>
                                <th className="p-2.5">Value</th>
                                <th className="p-2.5">Reason</th>
                                <th className="p-2.5">Authorized By</th>
                                <th className="p-2.5">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {discounts.map((d) => (
                                <tr key={d.id} className="hover:bg-white/[0.02]">
                                  <td className="p-2.5 font-medium text-white">{d.name}</td>
                                  <td className="p-2.5 capitalize">{d.type}</td>
                                  <td className="p-2.5 font-semibold text-amber-400">
                                    {d.type === "fixed" ? money(d.value) : `${d.value}%`}
                                  </td>
                                  <td className="p-2.5 text-slate-400">{d.reason}</td>
                                  <td className="p-2.5 text-slate-400">{d.authorizedBy}</td>
                                  <td className="p-2.5">
                                    <Badge variant="secondary" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px]">
                                      {d.status}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 3. INVOICES & BILLING TAB */}
            {activeTab === "invoices" && (
              <div className="space-y-6">
                {/* Search & Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search invoice # or student..."
                        value={invoiceSearchQuery}
                        onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                        className="pl-9 text-xs"
                      />
                    </div>
                    <Select
                      value={invoiceStatusFilter}
                      onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                      className="w-40 text-xs"
                    >
                      <option value="all">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="issued">Issued</option>
                      <option value="partially_paid">Partially Paid</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="voided">Voided</option>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setActiveModal("recurringBilling")}
                      className="border-white/10 text-slate-200 hover:bg-white/5"
                    >
                      <RefreshCw className="mr-1.5 h-4 w-4" /> Batch Recurring Billing
                    </Button>
                    <Button
                      onClick={() => setActiveModal("createInvoice")}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm shadow-red-500/20"
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Generate Invoice
                    </Button>
                  </div>
                </div>

                {/* Invoices List Table */}
                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="p-0">
                    {filteredInvoices.length === 0 ? (
                      <div className="py-16 text-center text-sm text-slate-500">
                        No invoices match the specified criteria.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                            <tr>
                              <th className="p-3.5">Invoice #</th>
                              <th className="p-3.5">Student</th>
                              <th className="p-3.5">Issue Date</th>
                              <th className="p-3.5">Due Date</th>
                              <th className="p-3.5 text-right">Total</th>
                              <th className="p-3.5 text-right">Paid</th>
                              <th className="p-3.5 text-right">Balance</th>
                              <th className="p-3.5">Status</th>
                              <th className="p-3.5 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredInvoices.map((invoice) => (
                              <tr key={invoice.id} className="hover:bg-white/[0.02]">
                                <td className="p-3.5 font-mono font-medium text-white">{invoice.invoiceNumber}</td>
                                <td className="p-3.5 font-medium text-white">
                                  {studentName(invoice.studentId)}
                                  <span className="block text-[10px] text-slate-500">#{studentAdmission(invoice.studentId)}</span>
                                </td>
                                <td className="p-3.5 text-slate-400">{invoice.issueDate}</td>
                                <td className="p-3.5 text-slate-400">{invoice.dueDate}</td>
                                <td className="p-3.5 text-right font-semibold text-white">{money(invoice.totalCents)}</td>
                                <td className="p-3.5 text-right text-emerald-400">{money(invoice.paidAmountCents)}</td>
                                <td className="p-3.5 text-right font-semibold text-amber-400">{money(invoice.balanceCents)}</td>
                                <td className="p-3.5">
                                  <InvoiceStatusBadge status={invoice.status} />
                                </td>
                                <td className="p-3.5">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      data-testid={`view-invoice-${invoice.id}`}
                                      onClick={() => {
                                        setSelectedInvoice(invoice);
                                        setActiveModal("viewInvoice");
                                      }}
                                      className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/5"
                                    >
                                      <Eye className="h-3.5 w-3.5 mr-1" /> View
                                    </Button>

                                    {invoice.status === "draft" && (
                                      <Button
                                        size="sm"
                                        onClick={() => void handleIssueDraftInvoice(invoice.id)}
                                        className="h-7 px-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                                      >
                                        Issue
                                      </Button>
                                    )}

                                    {invoice.balanceCents > 0 && invoice.status !== "draft" && (
                                      <Button
                                        size="sm"
                                        onClick={() => openPayModalForInvoice(invoice)}
                                        className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                      >
                                        Pay
                                      </Button>
                                    )}

                                    {invoice.status !== "voided" && invoice.status !== "paid" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setSelectedInvoiceToVoid(invoice);
                                          setActiveModal("voidInvoice");
                                        }}
                                        className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                      >
                                        <Ban className="h-3.5 w-3.5 mr-1" /> Void
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 4. PAYMENTS & RECEIPTS TAB */}
            {activeTab === "payments" && (
              <div className="space-y-6">
                {/* Search & Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search student or ref #..."
                        value={paymentSearchQuery}
                        onChange={(e) => setPaymentSearchQuery(e.target.value)}
                        className="pl-9 text-xs"
                      />
                    </div>
                    <Select
                      value={paymentMethodFilter}
                      onChange={(e) => setPaymentMethodFilter(e.target.value)}
                      className="w-36 text-xs"
                    >
                      <option value="all">All Methods</option>
                      {paymentMethods.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={paymentStatusFilter}
                      onChange={(e) => setPaymentStatusFilter(e.target.value)}
                      className="w-36 text-xs"
                    >
                      <option value="all">All Statuses</option>
                      <option value="recorded">Recorded</option>
                      <option value="voided">Voided</option>
                    </Select>
                  </div>
                  <Button
                    onClick={() => setActiveModal("recordPayment")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm shadow-emerald-500/20"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Record New Payment
                  </Button>
                </div>

                {/* Payments Table */}
                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-emerald-400" />
                      <h2 className="text-base font-semibold text-white">Payment Transactions ({filteredPayments.length})</h2>
                    </div>

                    {filteredPayments.length === 0 ? (
                      <div className="py-12 text-center text-sm text-slate-500">
                        No payment transactions recorded yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                            <tr>
                              <th className="p-3.5">Date</th>
                              <th className="p-3.5">Student</th>
                              <th className="p-3.5">Method</th>
                              <th className="p-3.5">Reference #</th>
                              <th className="p-3.5">Received By</th>
                              <th className="p-3.5 text-right">Amount</th>
                              <th className="p-3.5">Reconciliation</th>
                              <th className="p-3.5">Status</th>
                              <th className="p-3.5 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredPayments.map((payment) => {
                              const receipt = receipts.find((r) => r.paymentId === payment.id);
                              const isReconciled = payment.reconciliationStatus === "reconciled";
                              return (
                                <tr key={payment.id} className="hover:bg-white/[0.02]">
                                  <td className="p-3.5 text-slate-400">{payment.paymentDate}</td>
                                  <td className="p-3.5 font-medium text-white">{studentName(payment.studentId)}</td>
                                  <td className="p-3.5">
                                    <PaymentMethodBadge method={payment.paymentMethod} />
                                  </td>
                                  <td className="p-3.5 font-mono text-slate-400">{payment.referenceNumber || "—"}</td>
                                  <td className="p-3.5 text-slate-400">{payment.receivedBy}</td>
                                  <td className="p-3.5 text-right font-semibold text-emerald-400">+{money(payment.amountCents)}</td>
                                  <td className="p-3.5">
                                    <ReconciliationStatusBadge status={payment.reconciliationStatus || "unreconciled"} />
                                  </td>
                                  <td className="p-3.5">
                                    <PaymentStatusBadge status={payment.status} />
                                  </td>
                                  <td className="p-3.5">
                                    <div className="flex items-center justify-center gap-1.5">
                                      {receipt && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          data-testid={`view-receipt-${receipt.id}`}
                                          onClick={() => {
                                            setSelectedReceipt(receipt);
                                            setActiveModal("viewReceipt");
                                          }}
                                          className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/5"
                                        >
                                          <Receipt className="h-3.5 w-3.5 mr-1" /> Receipt
                                        </Button>
                                      )}

                                      {payment.status === "recorded" && (
                                        <>
                                          {isReconciled ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setSelectedPaymentToUnreconcile(payment);
                                                setActiveModal("unreconcilePayment");
                                              }}
                                              className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                            >
                                              <Undo2 className="h-3.5 w-3.5 mr-1" /> Unreconcile
                                            </Button>
                                          ) : (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setSelectedPaymentToReconcile(payment);
                                                setActiveModal("reconcilePayment");
                                              }}
                                              className="h-7 px-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                                            >
                                              <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Reconcile
                                            </Button>
                                          )}

                                          {!isReconciled ? (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                setSelectedPaymentToVoid(payment);
                                                setActiveModal("voidPayment");
                                              }}
                                              className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                            >
                                              <Ban className="h-3.5 w-3.5 mr-1" /> Void
                                            </Button>
                                          ) : (
                                            <span className="text-[10px] text-slate-500 italic px-1">Void Locked</span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Receipts Sub-table */}
                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-indigo-400" />
                      <h2 className="text-base font-semibold text-white">Generated Receipts ({receipts.length})</h2>
                    </div>

                    {receipts.length === 0 ? (
                      <div className="py-8 text-center text-sm text-slate-500">No receipts issued yet.</div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                            <tr>
                              <th className="p-3">Receipt #</th>
                              <th className="p-3">Date</th>
                              <th className="p-3">Student</th>
                              <th className="p-3">Method</th>
                              <th className="p-3 text-right">Amount</th>
                              <th className="p-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {receipts.map((rcpt) => (
                              <tr key={rcpt.id} className="hover:bg-white/[0.02]">
                                <td className="p-3 font-mono font-medium text-white">{rcpt.receiptNumber}</td>
                                <td className="p-3 text-slate-400">{rcpt.receiptDate}</td>
                                <td className="p-3 font-medium text-white">{studentName(rcpt.studentId)}</td>
                                <td className="p-3 capitalize">{rcpt.paymentMethod.replace("_", " ")}</td>
                                <td className="p-3 text-right font-semibold text-white">{money(rcpt.amountCents)}</td>
                                <td className="p-3 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedReceipt(rcpt);
                                      setActiveModal("viewReceipt");
                                    }}
                                    className="h-7 px-2 text-xs text-slate-300 hover:text-white hover:bg-white/5"
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" /> View Voucher
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 5. EXPENSES & DISBURSEMENT TAB */}
            {activeTab === "expenses" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input
                        placeholder="Search expenses or payee..."
                        value={expenseSearchQuery}
                        onChange={(e) => setExpenseSearchQuery(e.target.value)}
                        className="pl-9 text-xs"
                      />
                    </div>
                    <Select
                      value={expenseStatusFilter}
                      onChange={(e) => setExpenseStatusFilter(e.target.value)}
                      className="w-36 text-xs"
                    >
                      <option value="all">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="paid">Paid</option>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setActiveModal("createExpenseCategory")}
                      className="border-white/10 text-slate-200 hover:bg-white/5"
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Add Category
                    </Button>
                    <Button
                      onClick={() => setActiveModal("createExpense")}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm shadow-red-500/20"
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> New Expense Request
                    </Button>
                  </div>
                </div>

                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowDownRight className="h-5 w-5 text-rose-400" />
                        <h2 className="text-base font-semibold text-white">Expense Register ({filteredExpenses.length})</h2>
                      </div>
                    </div>

                    {filteredExpenses.length === 0 ? (
                      <div className="py-12 text-center text-sm text-slate-500">
                        No expense records match the specified filters.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                            <tr>
                              <th className="p-3.5">Date</th>
                              <th className="p-3.5">Title & Payee</th>
                              <th className="p-3.5">Category</th>
                              <th className="p-3.5">Payment Method</th>
                              <th className="p-3.5 text-right">Amount</th>
                              <th className="p-3.5">Status</th>
                              <th className="p-3.5 text-center">Approval Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredExpenses.map((exp) => (
                              <tr key={exp.id} className="hover:bg-white/[0.02]">
                                <td className="p-3.5 text-slate-400">{exp.expenseDate}</td>
                                <td className="p-3.5 font-medium text-white">
                                  {exp.title}
                                  <span className="block text-[10px] text-slate-400">Payee: {exp.payee}</span>
                                </td>
                                <td className="p-3.5">{expenseCategoryName(exp.categoryId)}</td>
                                <td className="p-3.5 capitalize">{exp.paymentMethod.replace("_", " ")}</td>
                                <td className="p-3.5 text-right font-semibold text-rose-400">{money(exp.amountCents)}</td>
                                <td className="p-3.5">
                                  <ExpenseStatusBadge status={exp.status} />
                                </td>
                                <td className="p-3.5">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {exp.status === "draft" && (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => void handleSubmitExpense(exp.id)}
                                          className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                        >
                                          Submit
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => void handleDeleteExpense(exp.id)}
                                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        >
                                          Delete
                                        </Button>
                                      </>
                                    )}

                                    {exp.status === "submitted" && (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            setSelectedExpense(exp);
                                            setActiveModal("approveExpense");
                                          }}
                                          className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                          Approve
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            setSelectedExpense(exp);
                                            setActiveModal("rejectExpense");
                                          }}
                                          className="h-7 px-2 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                                        >
                                          Reject
                                        </Button>
                                      </>
                                    )}

                                    {exp.status === "approved" && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setSelectedExpense(exp);
                                          setActiveModal("disburseExpense");
                                        }}
                                        className="h-7 px-2 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                                      >
                                        Disburse Funds
                                      </Button>
                                    )}

                                    {exp.status === "rejected" && (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => void handleSubmitExpense(exp.id)}
                                          className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                                        >
                                          Resubmit
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => void handleDeleteExpense(exp.id)}
                                          className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        >
                                          Delete
                                        </Button>
                                      </>
                                    )}

                                    {exp.status === "paid" && (
                                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                                        <Check className="h-3 w-3" /> Disbursed ({exp.referenceNumber || "Done"})
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 6. NON-TUITION OTHER INCOME TAB */}
            {activeTab === "income" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search income source..."
                      value={incomeSearchQuery}
                      onChange={(e) => setIncomeSearchQuery(e.target.value)}
                      className="pl-9 text-xs"
                    />
                  </div>
                  <Button
                    onClick={() => setActiveModal("createIncome")}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm shadow-emerald-500/20"
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Record Other Income
                  </Button>
                </div>

                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                        <h2 className="text-base font-semibold text-white">Non-Tuition Revenue Register ({filteredIncomes.length})</h2>
                      </div>
                    </div>

                    {filteredIncomes.length === 0 ? (
                      <div className="py-12 text-center text-sm text-slate-500">
                        No non-tuition income recorded yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                            <tr>
                              <th className="p-3.5">Receipt #</th>
                              <th className="p-3.5">Date</th>
                              <th className="p-3.5">Source & Details</th>
                              <th className="p-3.5">Category</th>
                              <th className="p-3.5">Method</th>
                              <th className="p-3.5">Reference #</th>
                              <th className="p-3.5 text-right">Amount</th>
                              <th className="p-3.5 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredIncomes.map((inc) => (
                              <tr key={inc.id} className="hover:bg-white/[0.02]">
                                <td className="p-3.5 font-mono font-medium text-white">{inc.receiptNumber}</td>
                                <td className="p-3.5 text-slate-400">{inc.receivedDate}</td>
                                <td className="p-3.5 font-medium text-white">{inc.source}</td>
                                <td className="p-3.5">
                                  <Badge variant="secondary" className="border-white/10 bg-slate-900/60 text-slate-300">
                                    {inc.category}
                                  </Badge>
                                </td>
                                <td className="p-3.5 capitalize">{inc.paymentMethod.replace("_", " ")}</td>
                                <td className="p-3.5 font-mono text-slate-400">{inc.referenceNumber || "—"}</td>
                                <td className="p-3.5 text-right font-semibold text-emerald-400">+{money(inc.amountCents)}</td>
                                <td className="p-3.5 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => void handleDeleteIncome(inc.id)}
                                    className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  >
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 7. LATE FEE POLICIES TAB */}
            {activeTab === "policies" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-white">Late-Fee Policy Engine</h2>
                    <p className="text-xs text-slate-400">
                      Configure automated grace periods, fixed or percentage penalties, penalty caps, and run evaluations.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void handleApplyLateFees()}
                      disabled={isSubmitting}
                      className="border-white/10 text-slate-200 hover:bg-white/5"
                    >
                      <Clock className="mr-1.5 h-4 w-4 text-amber-400" /> Run Late Fee Evaluation
                    </Button>
                    <Button
                      onClick={() => setActiveModal("createPolicy")}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm shadow-red-500/20"
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> New Policy
                    </Button>
                  </div>
                </div>

                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="space-y-4 p-6">
                    {lateFeePolicies.length === 0 ? (
                      <div className="py-12 text-center text-sm text-slate-500">
                        No late fee policies configured yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-white/5">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                            <tr>
                              <th className="p-3.5">Code</th>
                              <th className="p-3.5">Policy Name</th>
                              <th className="p-3.5">Grace Period</th>
                              <th className="p-3.5">Type</th>
                              <th className="p-3.5 text-right">Penalty</th>
                              <th className="p-3.5 text-right">Max Cap</th>
                              <th className="p-3.5">Auto-Apply</th>
                              <th className="p-3.5">Status</th>
                              <th className="p-3.5 text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {lateFeePolicies.map((pol) => (
                              <tr key={pol.id} className="hover:bg-white/[0.02]">
                                <td className="p-3.5 font-mono font-medium text-white">{pol.code}</td>
                                <td className="p-3.5 font-medium text-white">{pol.name}</td>
                                <td className="p-3.5 text-slate-300">{pol.gracePeriodDays} days</td>
                                <td className="p-3.5 capitalize">{pol.feeType}</td>
                                <td className="p-3.5 text-right font-semibold text-amber-400">
                                  {pol.feeType === "fixed" ? money(pol.amountCents || 0) : `${pol.percentageRate}%`}
                                </td>
                                <td className="p-3.5 text-right text-slate-400">
                                  {pol.maxCapCents ? money(pol.maxCapCents) : "None"}
                                </td>
                                <td className="p-3.5">
                                  <Badge
                                    variant="secondary"
                                    className={
                                      pol.applyAutomatically
                                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px]"
                                        : "border-slate-500/20 bg-slate-500/10 text-slate-400 text-[10px]"
                                    }
                                  >
                                    {pol.applyAutomatically ? "Automatic" : "Manual"}
                                  </Badge>
                                </td>
                                <td className="p-3.5">
                                  <Badge
                                    variant="secondary"
                                    className={
                                      pol.status === "active"
                                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[10px]"
                                        : "border-slate-500/20 bg-slate-500/10 text-slate-400 text-[10px]"
                                    }
                                  >
                                    {pol.status}
                                  </Badge>
                                </td>
                                <td className="p-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => void handleApplyLateFees(pol.id)}
                                      className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                    >
                                      Evaluate
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => void handleDeletePolicy(pol.id)}
                                      className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 8. STUDENT ACCOUNT & LEDGER TAB */}
            {activeTab === "accounts" && (
              <div className="space-y-6">
                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-white">Student Account & Fee Ledger</h2>
                        <p className="text-xs text-slate-400">Complete double-entry transactional history per enrolled student.</p>
                      </div>
                      <div className="w-72">
                        <Select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                          {students.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.firstName} {student.lastName} ({student.admissionNumber || "No ID"})
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    {/* Student Financial Summary Bar */}
                    {selectedStudent && (
                      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 rounded-xl border border-white/5 bg-slate-900/60 p-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase">Student Name</p>
                          <p className="font-semibold text-white mt-0.5">
                            {selectedStudent.firstName} {selectedStudent.lastName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase">Total Invoiced</p>
                          <p className="font-semibold text-white mt-0.5">{money(studentTotalBilled)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase">Total Paid</p>
                          <p className="font-semibold text-emerald-400 mt-0.5">{money(studentTotalPaid)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 uppercase">Outstanding Balance</p>
                          <p className="font-semibold text-amber-400 mt-0.5">{money(studentOutstanding)}</p>
                        </div>
                      </div>
                    )}

                    {/* Mathematical Balance Integrity Live Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/40 p-4">
                      <div className="flex items-center gap-3">
                        <Scale className="h-5 w-5 text-indigo-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">Mathematical Balance Integrity</span>
                            {studentLedgerAudit ? (
                              studentLedgerAudit.isBalanced ? (
                                <Badge variant="secondary" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs">
                                  ✓ Verified Balanced: Debits - Credits === Balance
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="border-red-500/20 bg-red-500/10 text-red-400 text-xs">
                                  Discrepancy: {money(studentLedgerAudit.discrepancyCents)}
                                </Badge>
                              )
                            ) : (
                              <span className="text-xs text-slate-500">Evaluating account balance...</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Debits: {money(studentLedgerAudit?.totalInvoicesDebitCents ?? studentTotalBilled)} • Credits: {money(studentLedgerAudit?.totalPaymentsCreditCents ?? studentTotalPaid)} • Net Balance: {money(studentLedgerAudit?.calculatedNetDueCents ?? studentOutstanding)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAuditSystemLedger}
                        disabled={isSubmitting}
                        className="border-white/10 text-slate-200 hover:bg-white/5"
                      >
                        <ShieldCheck className="mr-1.5 h-4 w-4 text-emerald-400" /> Run System Ledger Audit
                      </Button>
                    </div>

                    {systemLedgerAudit && (
                      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3.5 text-xs text-indigo-300">
                        System-wide ledger audit completed across <strong>{systemLedgerAudit.totalStudentsChecked}</strong> students.
                        Balanced: <strong>{systemLedgerAudit.balancedStudentsCount}</strong> | Discrepancies: <strong>{systemLedgerAudit.discrepancyStudentsCount}</strong>.
                      </div>
                    )}

                    {/* Ledger Entries Table */}
                    <div className="pt-2">
                      <h3 className="text-sm font-semibold text-white mb-2">Statement of Account</h3>
                      {ledger.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
                          No transactions found on this student's account.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/5">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                              <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Type</th>
                                <th className="p-3">Description</th>
                                <th className="p-3 text-right">Debit (Charges)</th>
                                <th className="p-3 text-right">Credit (Payments)</th>
                                <th className="p-3 text-right">Running Balance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {ledger.map((entry) => (
                                <tr key={entry.id} className="hover:bg-white/[0.02]">
                                  <td className="p-3 text-slate-400">{entry.occurredAt}</td>
                                  <td className="p-3">
                                    <Badge
                                      variant="secondary"
                                      className={
                                        entry.type === "invoice"
                                          ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                                          : entry.type === "payment"
                                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                          : "border-red-500/20 bg-red-500/10 text-red-400"
                                      }
                                    >
                                      {entry.type.replace("_", " ")}
                                    </Badge>
                                  </td>
                                  <td className="p-3 font-medium text-white">{entry.description}</td>
                                  <td className="p-3 text-right text-rose-400">{entry.debitCents > 0 ? money(entry.debitCents) : "—"}</td>
                                  <td className="p-3 text-right text-emerald-400">{entry.creditCents > 0 ? money(entry.creditCents) : "—"}</td>
                                  <td className="p-3 text-right font-semibold text-white">{money(entry.balanceCents)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* 9. REPORTS & ANALYTICS TAB */}
            {activeTab === "reports" && (
              <div className="space-y-6">
                <Card className="border-white/5 bg-[#0f141f]">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-base font-semibold text-white">Financial & Collection Reports</h2>
                        <p className="text-xs text-slate-400">Generate, review and export audit-ready institutional billing reports.</p>
                      </div>
                      {reportRows.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleExportCsv}
                          className="border-white/10 text-slate-300 hover:bg-white/5"
                        >
                          <Download className="mr-1.5 h-4 w-4" /> Export CSV
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <label className="text-xs text-slate-400">Report Type</label>
                        <Select
                          value={reportType}
                          onChange={(e) =>
                            setReportType(
                              e.target.value as "collection" | "outstanding" | "payments" | "grades" | "pl" | "cashflow" | "latefees"
                            )
                          }
                          className="mt-1"
                        >
                          <option value="collection">Fee Collection Report</option>
                          <option value="outstanding">Outstanding Balances Report</option>
                          <option value="payments">Payment Transactions Report</option>
                          <option value="grades">Grade-Wise Fee Summary</option>
                          <option value="pl">Income vs Expense (P&L Surplus)</option>
                          <option value="cashflow">Cash Flow Timeline</option>
                          <option value="latefees">Late Fees & Overdue Aging</option>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">From Date</label>
                        <Input
                          type="date"
                          value={reportDateFrom}
                          onChange={(e) => setReportDateFrom(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400">To Date</label>
                        <Input
                          type="date"
                          value={reportDateTo}
                          onChange={(e) => setReportDateTo(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={handleRunReport}
                          disabled={isLoading}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-medium"
                        >
                          <Filter className="mr-1.5 h-4 w-4" /> Run Report
                        </Button>
                      </div>
                    </div>

                    {/* Report Output Table */}
                    <div className="pt-4 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Report Results ({reportRows.length})</h3>
                      </div>

                      {reportRows.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-500">
                          Select filters above and click "Run Report" to generate records.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-white/5">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                              <tr>
                                <th className="p-3">Reference / Item</th>
                                <th className="p-3">Details</th>
                                <th className="p-3 text-right">Amount</th>
                                <th className="p-3">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {reportRows.map((row) => (
                                <tr key={row.id} className="hover:bg-white/[0.02]">
                                  <td className="p-3 font-medium text-white">{row.label}</td>
                                  <td className="p-3 text-slate-400">{row.meta}</td>
                                  <td className="p-3 text-right font-semibold text-white">{row.amount}</td>
                                  <td className="p-3">
                                    {row.status && (
                                      <Badge variant="secondary" className="border-white/10 text-slate-300 text-[10px]">
                                        {row.status}
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* ──────── MODALS ──────── */}

        {/* Modal: Generate Invoice */}
        {activeModal === "createInvoice" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-red-400" />
                  <h3 className="text-base font-semibold text-white">Generate Student Invoice</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Select Enrolled Student</label>
                  <Select
                    value={invoiceForm.studentId}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })}
                    className="mt-1"
                  >
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName} ({student.admissionNumber || "No ID"})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Academic Year</label>
                  <Select
                    value={invoiceForm.academicYearId}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, academicYearId: e.target.value })}
                    className="mt-1"
                  >
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Fee Structure to Bill</label>
                  <Select
                    value={invoiceForm.feeStructureId}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, feeStructureId: e.target.value })}
                    className="mt-1"
                  >
                    {structures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {money(s.amountCents)} ({s.frequency})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Discount or Concession (Optional)</label>
                  <Select
                    value={invoiceForm.discountId}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, discountId: e.target.value })}
                    className="mt-1"
                  >
                    <option value="">No Discount</option>
                    {discounts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.type === "fixed" ? money(d.value) : `${d.value}%`})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Issue Date</label>
                    <Input
                      type="date"
                      value={invoiceForm.issueDate}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Due Date</label>
                    <Input
                      type="date"
                      value={invoiceForm.dueDate}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="issueNow"
                    checked={invoiceForm.issueNow}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, issueNow: e.target.checked })}
                    className="rounded border-white/20 bg-slate-900 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="issueNow" className="text-xs text-slate-300">
                    Issue immediately (uncheck to save as draft)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateInvoice}
                  disabled={isSubmitting || !invoiceForm.studentId || !invoiceForm.feeStructureId}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {isSubmitting ? "Generating..." : "Generate Invoice"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Batch Recurring Billing */}
        {activeModal === "recurringBilling" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-indigo-400" />
                  <h3 className="text-base font-semibold text-white">Batch Recurring Invoicing</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Academic Year</label>
                  <Select
                    value={recurringForm.academicYearId}
                    onChange={(e) => setRecurringForm({ ...recurringForm, academicYearId: e.target.value })}
                    className="mt-1"
                  >
                    {academicYears.map((year) => (
                      <option key={year.id} value={year.id}>
                        {year.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Billing Period (YYYY-MM)</label>
                    <Input
                      placeholder="e.g. 2026-11"
                      value={recurringForm.billingPeriod}
                      onChange={(e) => setRecurringForm({ ...recurringForm, billingPeriod: e.target.value })}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Target Grade (Optional)</label>
                    <Select
                      value={recurringForm.gradeId}
                      onChange={(e) => setRecurringForm({ ...recurringForm, gradeId: e.target.value })}
                      className="mt-1"
                    >
                      <option value="">All Grades</option>
                      {grades.map((grade) => (
                        <option key={grade.id} value={grade.id}>
                          {grade.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Issue Date</label>
                    <Input
                      type="date"
                      value={recurringForm.issueDate}
                      onChange={(e) => setRecurringForm({ ...recurringForm, issueDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Due Date</label>
                    <Input
                      type="date"
                      value={recurringForm.dueDate}
                      onChange={(e) => setRecurringForm({ ...recurringForm, dueDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-300">
                  Idempotent generation: Invoices will be generated only for active fee assignments without an existing invoice for period <strong>{recurringForm.billingPeriod}</strong>.
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateRecurring}
                  disabled={isSubmitting || !recurringForm.billingPeriod || !recurringForm.academicYearId}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {isSubmitting ? "Processing..." : "Run Batch Invoicing"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Void Invoice */}
        {activeModal === "voidInvoice" && selectedInvoiceToVoid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-400" />
                  <h3 className="text-base font-semibold text-white">Void Student Invoice</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                Are you sure you want to void invoice <strong>{selectedInvoiceToVoid.invoiceNumber}</strong> ({money(selectedInvoiceToVoid.totalCents)})?
                This will reverse student debt and lock the invoice from further payments.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Void Reason</label>
                  <Input
                    value={voidInvoiceForm.reason}
                    onChange={(e) => setVoidInvoiceForm({ ...voidInvoiceForm, reason: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Authorized By</label>
                  <Input
                    value={voidInvoiceForm.authorizedBy}
                    onChange={(e) => setVoidInvoiceForm({ ...voidInvoiceForm, authorizedBy: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleVoidInvoice}
                  disabled={isSubmitting || !voidInvoiceForm.reason}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {isSubmitting ? "Voiding..." : "Confirm Void"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: View Invoice Details */}
        {activeModal === "viewInvoice" && selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-red-400" />
                  <h3 className="text-base font-semibold text-white">Invoice Details: {selectedInvoice.invoiceNumber}</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/5 bg-slate-900/40 p-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Student Name:</span>
                  <span className="font-semibold text-white">{studentName(selectedInvoice.studentId)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Admission Number:</span>
                  <span className="font-mono text-slate-200">#{studentAdmission(selectedInvoice.studentId)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Issue Date:</span>
                  <span className="text-slate-200">{selectedInvoice.issueDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Due Date:</span>
                  <span className="text-slate-200">{selectedInvoice.dueDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status:</span>
                  <InvoiceStatusBadge status={selectedInvoice.status} />
                </div>
                <div>
                  <span className="text-slate-500 block">Currency:</span>
                  <span className="font-semibold text-white">{selectedInvoice.currency}</span>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Itemized Line Items</h4>
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="border-b border-white/5 bg-slate-900/60 font-semibold text-slate-400">
                      <tr>
                        <th className="p-2.5">Item Description</th>
                        <th className="p-2.5 text-right">Amount</th>
                        <th className="p-2.5 text-right">Discount</th>
                        <th className="p-2.5 text-right">Net Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="p-2.5 font-medium text-white">{item.description}</td>
                          <td className="p-2.5 text-right text-slate-300">{money(item.amountCents)}</td>
                          <td className="p-2.5 text-right text-amber-400">
                            {item.discountCents > 0 ? `-${money(item.discountCents)}` : "—"}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-white">{money(item.finalAmountCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span>{money(selectedInvoice.subtotalCents)}</span>
                  </div>
                  {selectedInvoice.discountCents > 0 && (
                    <div className="flex justify-between text-amber-400">
                      <span>Discount:</span>
                      <span>-{money(selectedInvoice.discountCents)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-white border-t border-white/10 pt-1 text-sm">
                    <span>Total Billed:</span>
                    <span>{money(selectedInvoice.totalCents)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400">
                    <span>Amount Paid:</span>
                    <span>{money(selectedInvoice.paidAmountCents)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-400 border-t border-white/10 pt-1">
                    <span>Remaining Balance:</span>
                    <span>{money(selectedInvoice.balanceCents)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Close
                </Button>
                {selectedInvoice.balanceCents > 0 && selectedInvoice.status !== "draft" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveModal(null);
                      openPayModalForInvoice(selectedInvoice);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    <CreditCard className="mr-1.5 h-4 w-4" /> Record Payment
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: View Receipt Voucher */}
        {activeModal === "viewReceipt" && selectedReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-indigo-400" />
                  <h3 className="text-base font-semibold text-white">Receipt Voucher</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-6 space-y-4 text-center print:bg-white print:text-black">
                <div className="border-b border-white/10 pb-4">
                  <h4 className="text-lg font-bold text-white tracking-wide">{currentOrganization?.name || "HAZA AIOS Education SIS"}</h4>
                  <p className="text-xs text-slate-400">Official Student Fee Receipt</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-left text-xs">
                  <div>
                    <span className="text-slate-500 block">Receipt Number:</span>
                    <span className="font-mono font-bold text-white">{selectedReceipt.receiptNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Receipt Date:</span>
                    <span className="text-slate-200">{selectedReceipt.receiptDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Student Name:</span>
                    <span className="font-semibold text-white">{studentName(selectedReceipt.studentId)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Payment Method:</span>
                    <span className="capitalize text-slate-200">{selectedReceipt.paymentMethod.replace("_", " ")}</span>
                  </div>
                  {selectedReceipt.referenceNumber && (
                    <div className="col-span-2">
                      <span className="text-slate-500 block">Reference / Cheque #:</span>
                      <span className="font-mono text-slate-300">{selectedReceipt.referenceNumber}</span>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <span className="text-xs text-emerald-400 uppercase font-semibold tracking-wider block">Total Amount Received</span>
                  <span className="text-2xl font-bold text-white mt-1 block">{money(selectedReceipt.amountCents)}</span>
                </div>

                <p className="text-[10px] text-slate-500 italic">This is an authorized computer-generated document issued by HAZA AIOS SIS.</p>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => window.print()} className="border-white/10 text-slate-300">
                  <Printer className="mr-1.5 h-4 w-4" /> Print Voucher
                </Button>
                <Button size="sm" onClick={() => setActiveModal(null)} className="bg-red-600 hover:bg-red-700 text-white font-medium">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Record Payment */}
        {activeModal === "recordPayment" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base font-semibold text-white">Record Fee Payment</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Target Invoice</label>
                  <Select
                    value={paymentForm.invoiceId}
                    onChange={(e) => {
                      const invId = e.target.value;
                      const inv = invoices.find((i) => i.id === invId);
                      setPaymentForm({
                        ...paymentForm,
                        invoiceId: invId,
                        amount: inv ? fromCents(inv.balanceCents) : "",
                      });
                    }}
                    className="mt-1"
                  >
                    {invoices
                      .filter((i) => i.status !== "voided" && i.status !== "cancelled")
                      .map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} — {studentName(inv.studentId)} (Balance: {money(inv.balanceCents)})
                        </option>
                      ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Payment Amount ({currentOrganization?.currency || "USD"})</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Payment Method</label>
                    <Select
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as PaymentMethod })}
                      className="mt-1"
                    >
                      {paymentMethods.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Reference / Cheque #</label>
                    <Input
                      placeholder="e.g. TXN-109923"
                      value={paymentForm.referenceNumber}
                      onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                      className="mt-1 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Received By</label>
                    <Input
                      value={paymentForm.receivedBy}
                      onChange={(e) => setPaymentForm({ ...paymentForm, receivedBy: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Notes (Optional)</label>
                    <Input
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleRecordPayment}
                  disabled={isSubmitting || !paymentForm.invoiceId || !paymentForm.amount}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  {isSubmitting ? "Recording..." : "Save Payment & Issue Receipt"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Reconcile Payment */}
        {activeModal === "reconcilePayment" && selectedPaymentToReconcile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-indigo-500/20 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-indigo-400" />
                  <h3 className="text-base font-semibold text-white">Bank Reconciliation</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3 text-xs text-indigo-300">
                Reconciling payment of <strong>{money(selectedPaymentToReconcile.amountCents)}</strong> (Ref: {selectedPaymentToReconcile.referenceNumber || selectedPaymentToReconcile.id}).
                Once reconciled, this payment cannot be voided without prior unreconciliation.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Bank Statement Reference</label>
                  <Input
                    placeholder="e.g. STMT-OCT-2026-991"
                    value={reconcileForm.bankStatementRef}
                    onChange={(e) => setReconcileForm({ ...reconcileForm, bankStatementRef: e.target.value })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Reconciled By</label>
                  <Input
                    value={reconcileForm.reconciledBy}
                    onChange={(e) => setReconcileForm({ ...reconcileForm, reconciledBy: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Audit Notes</label>
                  <Input
                    value={reconcileForm.notes}
                    onChange={(e) => setReconcileForm({ ...reconcileForm, notes: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleReconcilePayment}
                  disabled={isSubmitting || !reconcileForm.bankStatementRef}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {isSubmitting ? "Reconciling..." : "Confirm Reconciliation"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Unreconcile Payment */}
        {activeModal === "unreconcilePayment" && selectedPaymentToUnreconcile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Undo2 className="h-5 w-5 text-amber-400" />
                  <h3 className="text-base font-semibold text-white">Unreconcile Payment</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-300">
                Unlock reconciliation for payment of <strong>{money(selectedPaymentToUnreconcile.amountCents)}</strong>.
                Authorized audit action.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Unreconcile Reason</label>
                  <Input
                    value={unreconcileForm.reason}
                    onChange={(e) => setUnreconcileForm({ ...unreconcileForm, reason: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Authorized By</label>
                  <Input
                    value={unreconcileForm.authorizedBy}
                    onChange={(e) => setUnreconcileForm({ ...unreconcileForm, authorizedBy: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleUnreconcilePayment}
                  disabled={isSubmitting || !unreconcileForm.reason}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  {isSubmitting ? "Unreconciling..." : "Unlock & Unreconcile"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Void Payment Confirmation */}
        {activeModal === "voidPayment" && selectedPaymentToVoid && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-red-400" />
                  <h3 className="text-base font-semibold text-white">Void Payment Transaction</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-xs text-red-300">
                Are you sure you want to void this payment of <strong>{money(selectedPaymentToVoid.amountCents)}</strong>?
                This will automatically adjust the invoice balance and append a reversal entry to the student ledger.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Void Reason</label>
                  <Input
                    value={voidForm.reason}
                    onChange={(e) => setVoidForm({ ...voidForm, reason: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Authorized By</label>
                  <Input
                    value={voidForm.authorizedBy}
                    onChange={(e) => setVoidForm({ ...voidForm, authorizedBy: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleVoidPayment}
                  disabled={isSubmitting || !voidForm.reason || !voidForm.authorizedBy}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {isSubmitting ? "Voiding..." : "Confirm Void"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create Expense Request */}
        {activeModal === "createExpense" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-5 w-5 text-rose-400" />
                  <h3 className="text-base font-semibold text-white">Create Expense Request</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Expense Title</label>
                  <Input
                    placeholder="e.g. Science Lab Reagents"
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Category</label>
                    <Select
                      value={expenseForm.categoryId}
                      onChange={(e) => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                      className="mt-1"
                    >
                      {expenseCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Amount ({currentOrganization?.currency || "USD"})</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Payee / Vendor</label>
                    <Input
                      placeholder="e.g. Lab Supplies Co."
                      value={expenseForm.payee}
                      onChange={(e) => setExpenseForm({ ...expenseForm, payee: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Expense Date</label>
                    <Input
                      type="date"
                      value={expenseForm.expenseDate}
                      onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Payment Method</label>
                  <Select
                    value={expenseForm.paymentMethod}
                    onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value as PaymentMethod })}
                    className="mt-1"
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Description / Justification</label>
                  <Input
                    placeholder="Details about this expenditure"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateExpense}
                  disabled={isSubmitting || !expenseForm.title || !expenseForm.amount || !expenseForm.payee}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {isSubmitting ? "Creating..." : "Save Draft"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create Expense Category */}
        {activeModal === "createExpenseCategory" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-400" />
                  <h3 className="text-base font-semibold text-white">New Expense Category</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Category Name</label>
                  <Input
                    placeholder="e.g. Science Lab Supplies"
                    value={expenseCategoryForm.name}
                    onChange={(e) => setExpenseCategoryForm({ ...expenseCategoryForm, name: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Code</label>
                  <Input
                    placeholder="e.g. LAB-SUPP"
                    value={expenseCategoryForm.code}
                    onChange={(e) => setExpenseCategoryForm({ ...expenseCategoryForm, code: e.target.value })}
                    className="mt-1 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Description (Optional)</label>
                  <Input
                    placeholder="Category notes"
                    value={expenseCategoryForm.description}
                    onChange={(e) => setExpenseCategoryForm({ ...expenseCategoryForm, description: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateExpenseCategory}
                  disabled={isSubmitting || !expenseCategoryForm.name || !expenseCategoryForm.code}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  Save Category
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Approve Expense */}
        {activeModal === "approveExpense" && selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-emerald-500/20 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base font-semibold text-white">Approve Expense</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
                Are you sure you want to approve expense <strong>"{selectedExpense.title}"</strong> for <strong>{money(selectedExpense.amountCents)}</strong> payable to {selectedExpense.payee}?
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleApproveExpense}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  {isSubmitting ? "Approving..." : "Confirm Approval"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Reject Expense */}
        {activeModal === "rejectExpense" && selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-rose-500/20 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-5 w-5 text-rose-400" />
                  <h3 className="text-base font-semibold text-white">Reject Expense</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-xs text-slate-400">Rejection Reason</label>
                <Input
                  placeholder="Explain why this request is rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleRejectExpense}
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-medium"
                >
                  {isSubmitting ? "Rejecting..." : "Confirm Rejection"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Disburse Expense */}
        {activeModal === "disburseExpense" && selectedExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-purple-500/20 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-purple-400" />
                  <h3 className="text-base font-semibold text-white">Disburse Approved Expense</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3 text-xs text-purple-300">
                Disbursing <strong>{money(selectedExpense.amountCents)}</strong> to <strong>{selectedExpense.payee}</strong>.
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Payment Method</label>
                  <Select
                    value={disbursementForm.paymentMethod}
                    onChange={(e) => setDisbursementForm({ ...disbursementForm, paymentMethod: e.target.value as PaymentMethod })}
                    className="mt-1"
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Payment Reference / Transaction #</label>
                  <Input
                    placeholder="e.g. WIRE-EXP-9921"
                    value={disbursementForm.referenceNumber}
                    onChange={(e) => setDisbursementForm({ ...disbursementForm, referenceNumber: e.target.value })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Disbursed By</label>
                  <Input
                    value={disbursementForm.disbursedBy}
                    onChange={(e) => setDisbursementForm({ ...disbursementForm, disbursedBy: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleDisburseExpense}
                  disabled={isSubmitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium"
                >
                  {isSubmitting ? "Disbursing..." : "Confirm Disbursement"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create Other Income */}
        {activeModal === "createIncome" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-emerald-400" />
                  <h3 className="text-base font-semibold text-white">Record Non-Tuition Income</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Income Source / Remitter</label>
                  <Input
                    placeholder="e.g. Alumni Association Donation"
                    value={incomeForm.source}
                    onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Category</label>
                    <Input
                      placeholder="e.g. Donations, Cafeteria, Grants"
                      value={incomeForm.category}
                      onChange={(e) => setIncomeForm({ ...incomeForm, category: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Amount ({currentOrganization?.currency || "USD"})</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={incomeForm.amount}
                      onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Received Date</label>
                    <Input
                      type="date"
                      value={incomeForm.receivedDate}
                      onChange={(e) => setIncomeForm({ ...incomeForm, receivedDate: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Payment Method</label>
                    <Select
                      value={incomeForm.paymentMethod}
                      onChange={(e) => setIncomeForm({ ...incomeForm, paymentMethod: e.target.value as PaymentMethod })}
                      className="mt-1"
                    >
                      {paymentMethods.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Reference / Cheque #</label>
                    <Input
                      placeholder="e.g. CHQ-88219"
                      value={incomeForm.referenceNumber}
                      onChange={(e) => setIncomeForm({ ...incomeForm, referenceNumber: e.target.value })}
                      className="mt-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Received By</label>
                    <Input
                      value={incomeForm.receivedBy}
                      onChange={(e) => setIncomeForm({ ...incomeForm, receivedBy: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Notes (Optional)</label>
                  <Input
                    placeholder="Description or fund allocation"
                    value={incomeForm.notes}
                    onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateIncome}
                  disabled={isSubmitting || !incomeForm.source || !incomeForm.amount}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  {isSubmitting ? "Recording..." : "Record & Issue Receipt"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create Late Fee Policy */}
        {activeModal === "createPolicy" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-400" />
                  <h3 className="text-base font-semibold text-white">New Late Fee Policy</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Policy Code</label>
                    <Input
                      placeholder="e.g. LATE-FIXED-25"
                      value={policyForm.code}
                      onChange={(e) => setPolicyForm({ ...policyForm, code: e.target.value })}
                      className="mt-1 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Academic Year</label>
                    <Select
                      value={policyForm.academicYearId}
                      onChange={(e) => setPolicyForm({ ...policyForm, academicYearId: e.target.value })}
                      className="mt-1"
                    >
                      {academicYears.map((year) => (
                        <option key={year.id} value={year.id}>
                          {year.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400">Policy Name</label>
                  <Input
                    placeholder="e.g. $25 Fixed Overdue Charge"
                    value={policyForm.name}
                    onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Grace Period (Days)</label>
                    <Input
                      type="number"
                      value={policyForm.gracePeriodDays}
                      onChange={(e) => setPolicyForm({ ...policyForm, gracePeriodDays: Number(e.target.value) })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Fee Type</label>
                    <Select
                      value={policyForm.feeType}
                      onChange={(e) => setPolicyForm({ ...policyForm, feeType: e.target.value as LateFeeType })}
                      className="mt-1"
                    >
                      <option value="fixed">Fixed Penalty</option>
                      <option value="percentage">Percentage Rate</option>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">
                      {policyForm.feeType === "fixed" ? `Penalty (${currentOrganization?.currency || "USD"})` : "Rate (%)"}
                    </label>
                    <Input
                      value={policyForm.feeType === "fixed" ? policyForm.amount : policyForm.percentage}
                      onChange={(e) =>
                        policyForm.feeType === "fixed"
                          ? setPolicyForm({ ...policyForm, amount: e.target.value })
                          : setPolicyForm({ ...policyForm, percentage: e.target.value })
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Penalty Cap / Max Charge ({currentOrganization?.currency || "USD"})</label>
                    <Input
                      value={policyForm.maxCap}
                      onChange={(e) => setPolicyForm({ ...policyForm, maxCap: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="applyAuto"
                    checked={policyForm.applyAutomatically}
                    onChange={(e) => setPolicyForm({ ...policyForm, applyAutomatically: e.target.checked })}
                    className="rounded border-white/20 bg-slate-900 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="applyAuto" className="text-xs text-slate-300">
                    Apply automatically during scheduled evaluation runs
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreatePolicy}
                  disabled={isSubmitting || !policyForm.code || !policyForm.name}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  {isSubmitting ? "Saving..." : "Create Policy"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Assign Fee Structure to Student */}
        {activeModal === "assignFee" && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f141f] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-red-400" />
                  <h3 className="text-base font-semibold text-white">Assign Fee Structure</h3>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400">Target Student</label>
                  <Select
                    value={assignmentForm.studentId}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, studentId: e.target.value })}
                    className="mt-1"
                  >
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.firstName} {student.lastName} ({student.admissionNumber || "No ID"})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Fee Structure</label>
                  <Select
                    value={assignmentForm.feeStructureId}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, feeStructureId: e.target.value })}
                    className="mt-1"
                  >
                    {structures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {money(s.amountCents)} ({s.frequency})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/5 pt-4">
                <Button variant="outline" size="sm" onClick={() => setActiveModal(null)} className="border-white/10 text-slate-300">
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAssignFee}
                  disabled={isSubmitting || !assignmentForm.studentId || !assignmentForm.feeStructureId}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium"
                >
                  {isSubmitting ? "Assigning..." : "Assign Fee"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function SummaryKpiCard({
  icon,
  label,
  value,
  color = "red",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: "red" | "emerald" | "amber" | "rose" | "indigo" | "purple";
}) {
  const colorMap = {
    red: "bg-red-500/10 text-red-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    rose: "bg-rose-500/10 text-rose-400",
    indigo: "bg-indigo-500/10 text-indigo-400",
    purple: "bg-purple-500/10 text-purple-400",
  };

  return (
    <Card className="border-white/5 bg-[#0f141f]">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-bold text-white truncate">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 shrink-0 ${colorMap[color]}`}>{icon}</div>
      </CardContent>
    </Card>
  );
}
