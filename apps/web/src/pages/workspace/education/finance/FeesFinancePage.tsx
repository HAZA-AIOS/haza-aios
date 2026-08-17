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
  FeeCategory,
  FeeDiscount,
  FeeFrequency,
  FeePayment,
  FeeReceipt,
  FeeStructure,
  Grade,
  PaymentMethod,
  Student,
  StudentFeeLedgerEntry,
  StudentInvoice,
} from "@/modules/education/sis/sis.types";
import { AdminPageHeader, Badge, Button, Card, CardContent, Input, Select } from "@haza-aios/ui";
import { ArrowLeft, Banknote, FileText, Landmark, ReceiptText, WalletCards } from "lucide-react";

type FinanceTab = "overview" | "structures" | "invoices" | "payments" | "accounts" | "reports";

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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [discounts, setDiscounts] = useState<FeeDiscount[]>([]);
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [receipts, setReceipts] = useState<FeeReceipt[]>([]);
  const [ledger, setLedger] = useState<StudentFeeLedgerEntry[]>([]);
  const [reportRows, setReportRows] = useState<Array<{ label: string; amount: string; status?: string }>>([]);

  const [categoryForm, setCategoryForm] = useState({ name: "Tuition Fee", code: "TUITION", description: "" });
  const [structureForm, setStructureForm] = useState({
    name: "Monthly Tuition",
    academicYearId: "",
    gradeId: "",
    feeCategoryId: "",
    amount: "10000",
    frequency: "monthly" as FeeFrequency,
    effectiveFrom: today(),
    effectiveTo: "",
  });
  const [discountForm, setDiscountForm] = useState({
    name: "Merit Scholarship",
    type: "fixed" as "fixed" | "percentage",
    value: "1000",
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
  });
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [reportType, setReportType] = useState("collection");

  const summary = useMemo(() => {
    const active = invoices.filter((invoice) => invoice.status !== "cancelled" && invoice.status !== "voided");
    const billed = active.reduce((sum, invoice) => sum + invoice.totalCents, 0);
    const collected = active.reduce((sum, invoice) => sum + invoice.paidAmountCents, 0);
    const outstanding = active.reduce((sum, invoice) => sum + invoice.balanceCents, 0);
    const overdue = active.filter((invoice) => invoice.balanceCents > 0 && invoice.dueDate < today()).reduce((sum, invoice) => sum + invoice.balanceCents, 0);
    return {
      billed,
      collected,
      outstanding,
      overdue,
      collectionRate: billed === 0 ? 0 : Math.round((collected / billed) * 10000) / 100,
      outstandingStudents: new Set(active.filter((invoice) => invoice.balanceCents > 0).map((invoice) => invoice.studentId)).size,
    };
  }, [invoices]);

  useEffect(() => {
    void loadData();
  }, [currentOrganization]);

  useEffect(() => {
    if (!currentOrganization || !selectedStudentId) return;
    void FinanceService.getStudentLedger(currentOrganization.id, selectedStudentId).then(setLedger);
  }, [currentOrganization, selectedStudentId, invoices.length, payments.length]);

  async function loadData() {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const orgId = currentOrganization.id;
      const [yearsData, gradesData, studentsData, categoriesData, structuresData, discountsData, invoicesData, paymentsData, receiptsData] =
        await Promise.all([
          AcademicService.getAcademicYears(orgId),
          AcademicService.getGrades(orgId),
          StudentService.getStudents(orgId),
          FinanceService.getFeeCategories(orgId),
          FinanceService.getFeeStructures(orgId),
          FinanceService.getDiscounts(orgId),
          FinanceService.getInvoices(orgId),
          FinanceService.getPayments(orgId),
          FinanceService.getReceipts(orgId),
        ]);
      setAcademicYears(yearsData);
      setGrades(gradesData);
      setStudents(studentsData);
      setCategories(categoriesData);
      setStructures(structuresData);
      setDiscounts(discountsData);
      setInvoices(invoicesData);
      setPayments(paymentsData);
      setReceipts(receiptsData);
      const activeYear = yearsData.find((year) => year.status === "active") || yearsData[0];
      setStructureForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || activeYear?.id || "",
        gradeId: current.gradeId || gradesData[0]?.id || "",
        feeCategoryId: current.feeCategoryId || categoriesData[0]?.id || "",
      }));
      setInvoiceForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || activeYear?.id || "",
        studentId: current.studentId || studentsData[0]?.id || "",
        feeStructureId: current.feeStructureId || structuresData[0]?.id || "",
      }));
      setPaymentForm((current) => ({ ...current, invoiceId: current.invoiceId || invoicesData.find((invoice) => invoice.balanceCents > 0)?.id || "" }));
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
    try {
      await action();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Finance action failed.");
    }
  }

  async function handleCreateCategory() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.createFeeCategory(currentOrganization.id, {
        name: categoryForm.name,
        code: categoryForm.code,
        description: categoryForm.description,
        status: "active",
        displayOrder: categories.length + 1,
      });
      setMessage("Fee category created.");
    });
  }

  async function handleCreateStructure() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.createFeeStructure(currentOrganization.id, {
        name: structureForm.name,
        academicYearId: structureForm.academicYearId,
        gradeId: structureForm.gradeId,
        feeCategoryId: structureForm.feeCategoryId,
        amountCents: toCents(structureForm.amount),
        frequency: structureForm.frequency,
        effectiveFrom: structureForm.effectiveFrom,
        effectiveTo: structureForm.effectiveTo || undefined,
        status: "active",
      });
      setMessage("Fee structure created.");
    });
  }

  async function handleCreateDiscount() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.createDiscount(currentOrganization.id, {
        name: discountForm.name,
        type: discountForm.type,
        value: discountForm.type === "fixed" ? toCents(discountForm.value) : Number(discountForm.value),
        reason: discountForm.reason,
        authorizedBy: discountForm.authorizedBy,
        studentId: discountForm.studentId || undefined,
        feeCategoryId: discountForm.feeCategoryId || undefined,
        status: "active",
      });
      setMessage("Discount or scholarship rule created.");
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
      setMessage("Invoice generated.");
    });
  }

  async function handleRecordPayment() {
    if (!currentOrganization) return;
    await runAction(async () => {
      await FinanceService.recordPayment(currentOrganization.id, {
        invoiceId: paymentForm.invoiceId,
        amountCents: toCents(paymentForm.amount),
        paymentDate: today(),
        paymentMethod: paymentForm.paymentMethod,
        referenceNumber: paymentForm.referenceNumber || undefined,
        receivedBy: paymentForm.receivedBy,
      });
      setMessage("Payment recorded and receipt generated.");
    });
  }

  async function handleRunReport() {
    if (!currentOrganization) return;
    if (reportType === "outstanding") {
      const rows = await FinanceService.getOutstandingReport(currentOrganization.id);
      setReportRows(rows.map((row) => ({ label: `${row.invoiceNumber} - ${studentName(row.studentId)}`, amount: money(row.balanceCents), status: row.status })));
    } else if (reportType === "payments") {
      const rows = await FinanceService.getPaymentReport(currentOrganization.id);
      setReportRows(rows.map((row) => ({ label: `${studentName(row.studentId)} - ${row.method}`, amount: money(row.amountCents), status: row.status })));
    } else {
      const rows = await FinanceService.getCollectionReport(currentOrganization.id);
      setReportRows(rows.map((row) => ({ label: `${row.invoiceNumber} - ${studentName(row.studentId)}`, amount: `${money(row.paidCents)} / ${money(row.totalCents)}`, status: row.status })));
    }
  }

  function money(cents: number) {
    return `${currentOrganization?.currency || "USD"} ${fromCents(cents)}`;
  }

  function studentName(id: string) {
    const student = students.find((item) => item.id === id);
    return student ? `${student.firstName} ${student.lastName}` : id;
  }

  function gradeName(id: string) {
    return grades.find((grade) => grade.id === id)?.name || id;
  }

  function categoryName(id: string) {
    return categories.find((category) => category.id === id)?.name || id;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <AdminPageHeader
          title="Fees & Finance"
          description="Manage SIS fee structures, billing, payments, receipts, balances, and practical finance reports."
          breadcrumbs={[{ label: "Workspace", onClick: () => navigate("/workspace") }, { label: "Education" }, { label: "Fees & Finance" }]}
          actions={<Badge variant="secondary">Currency {currentOrganization?.currency || "USD"}</Badge>}
        />

        <Link to="/workspace" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Workspace
        </Link>

        {message && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}
        {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}

        <div className="grid gap-4 md:grid-cols-5">
          <SummaryCard icon={<Banknote className="h-5 w-5" />} label="Billed" value={money(summary.billed)} />
          <SummaryCard icon={<WalletCards className="h-5 w-5" />} label="Collected" value={money(summary.collected)} />
          <SummaryCard icon={<Landmark className="h-5 w-5" />} label="Outstanding" value={money(summary.outstanding)} />
          <SummaryCard icon={<FileText className="h-5 w-5" />} label="Overdue" value={money(summary.overdue)} />
          <SummaryCard icon={<ReceiptText className="h-5 w-5" />} label="Collection Rate" value={`${summary.collectionRate}%`} />
        </div>

        <div className="flex flex-wrap gap-2">
          {(["overview", "structures", "invoices", "payments", "accounts", "reports"] as FinanceTab[]).map((tab) => (
            <Button key={tab} variant={activeTab === tab ? "default" : "outline"} onClick={() => setActiveTab(tab)}>
              {tab === "overview" ? "Overview" : tab === "structures" ? "Fee Structures" : tab === "invoices" ? "Invoices" : tab === "payments" ? "Payments" : tab === "accounts" ? "Student Account" : "Reports"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <Card className="bg-[#0f141f] border-white/5"><CardContent className="p-8 text-slate-400">Loading finance records...</CardContent></Card>
        ) : (
          <>
            {activeTab === "overview" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <FinanceList title="Recent Invoices" rows={invoices.slice(0, 6).map((invoice) => ({ id: invoice.id, title: invoice.invoiceNumber, meta: `${studentName(invoice.studentId)} - ${money(invoice.balanceCents)} due`, status: invoice.status }))} empty="No invoices generated yet." />
                <FinanceList title="Recent Payments" rows={payments.slice(0, 6).map((payment) => ({ id: payment.id, title: studentName(payment.studentId), meta: `${money(payment.amountCents)} via ${payment.paymentMethod}`, status: payment.status }))} empty="No payments recorded yet." />
              </div>
            )}

            {activeTab === "structures" && (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-3 p-6">
                    <h2 className="text-lg font-semibold text-white">Fee Category</h2>
                    <Input placeholder="Name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} />
                    <Input placeholder="Code" value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} />
                    <Input placeholder="Description" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
                    <Button onClick={handleCreateCategory}>Create Category</Button>
                  </CardContent>
                </Card>
                <Card className="bg-[#0f141f] border-white/5 lg:col-span-2">
                  <CardContent className="space-y-3 p-6">
                    <h2 className="text-lg font-semibold text-white">Fee Structure</h2>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Input placeholder="Name" value={structureForm.name} onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })} />
                      <Select value={structureForm.academicYearId} onChange={(e) => setStructureForm({ ...structureForm, academicYearId: e.target.value })}>{academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</Select>
                      <Select value={structureForm.gradeId} onChange={(e) => setStructureForm({ ...structureForm, gradeId: e.target.value })}>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</Select>
                      <Select value={structureForm.feeCategoryId} onChange={(e) => setStructureForm({ ...structureForm, feeCategoryId: e.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
                      <Input type="number" placeholder="Amount" value={structureForm.amount} onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })} />
                      <Select value={structureForm.frequency} onChange={(e) => setStructureForm({ ...structureForm, frequency: e.target.value as FeeFrequency })}>{frequencies.map((frequency) => <option key={frequency.value} value={frequency.value}>{frequency.label}</option>)}</Select>
                    </div>
                    <Button onClick={handleCreateStructure}>Create Structure</Button>
                    <FinanceList title="Configured Structures" rows={structures.map((structure) => ({ id: structure.id, title: structure.name, meta: `${gradeName(structure.gradeId)} - ${categoryName(structure.feeCategoryId)} - ${money(structure.amountCents)}`, status: structure.status }))} empty="No fee structures configured." />
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "invoices" && (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-3 p-6">
                    <h2 className="text-lg font-semibold text-white">Generate Invoice</h2>
                    <Select value={invoiceForm.studentId} onChange={(e) => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })}>{students.map((student) => <option key={student.id} value={student.id}>{studentName(student.id)}</option>)}</Select>
                    <Select value={invoiceForm.academicYearId} onChange={(e) => setInvoiceForm({ ...invoiceForm, academicYearId: e.target.value })}>{academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}</Select>
                    <Select value={invoiceForm.feeStructureId} onChange={(e) => setInvoiceForm({ ...invoiceForm, feeStructureId: e.target.value })}>{structures.map((structure) => <option key={structure.id} value={structure.id}>{structure.name}</option>)}</Select>
                    <Select value={invoiceForm.discountId} onChange={(e) => setInvoiceForm({ ...invoiceForm, discountId: e.target.value })}><option value="">No discount</option>{discounts.map((discount) => <option key={discount.id} value={discount.id}>{discount.name}</option>)}</Select>
                    <div className="grid grid-cols-2 gap-2"><Input type="date" value={invoiceForm.issueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })} /><Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} /></div>
                    <Button onClick={handleCreateInvoice}>Generate Invoice</Button>
                  </CardContent>
                </Card>
                <div className="lg:col-span-2"><FinanceList title="Invoices" rows={invoices.map((invoice) => ({ id: invoice.id, title: invoice.invoiceNumber, meta: `${studentName(invoice.studentId)} - total ${money(invoice.totalCents)} - balance ${money(invoice.balanceCents)}`, status: invoice.status }))} empty="No invoices yet." /></div>
              </div>
            )}

            {activeTab === "payments" && (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-3 p-6">
                    <h2 className="text-lg font-semibold text-white">Record Payment</h2>
                    <Select value={paymentForm.invoiceId} onChange={(e) => setPaymentForm({ ...paymentForm, invoiceId: e.target.value })}>{invoices.filter((invoice) => invoice.balanceCents > 0).map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} - {money(invoice.balanceCents)}</option>)}</Select>
                    <Input type="number" placeholder="Payment amount" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                    <Select value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value as PaymentMethod })}>{paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</Select>
                    <Input placeholder="Reference number" value={paymentForm.referenceNumber} onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })} />
                    <Input placeholder="Received by" value={paymentForm.receivedBy} onChange={(e) => setPaymentForm({ ...paymentForm, receivedBy: e.target.value })} />
                    <Button onClick={handleRecordPayment}>Record Payment</Button>
                  </CardContent>
                </Card>
                <div className="lg:col-span-2"><FinanceList title="Receipts" rows={receipts.map((receipt) => ({ id: receipt.id, title: receipt.receiptNumber, meta: `${studentName(receipt.studentId)} - ${money(receipt.amountCents)}`, status: receipt.paymentMethod }))} empty="No receipts yet." /></div>
              </div>
            )}

            {activeTab === "accounts" && (
              <Card className="bg-[#0f141f] border-white/5">
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-lg font-semibold text-white">Student Fee Account</h2>
                  <Select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{studentName(student.id)}</option>)}</Select>
                  <FinanceList title="Ledger" rows={ledger.map((entry) => ({ id: entry.id, title: entry.description, meta: `Debit ${money(entry.debitCents)} - Credit ${money(entry.creditCents)} - Balance ${money(entry.balanceCents)}`, status: entry.type }))} empty="No ledger entries for this student." />
                </CardContent>
              </Card>
            )}

            {activeTab === "reports" && (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="bg-[#0f141f] border-white/5">
                  <CardContent className="space-y-3 p-6">
                    <h2 className="text-lg font-semibold text-white">Reports</h2>
                    <Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                      <option value="collection">Fee Collection Report</option>
                      <option value="outstanding">Outstanding Fee Report</option>
                      <option value="payments">Payment Report</option>
                    </Select>
                    <Button onClick={handleRunReport}>Generate Report</Button>
                  </CardContent>
                </Card>
                <div className="lg:col-span-2"><FinanceList title="Report Results" rows={reportRows.map((row, index) => ({ id: `${index}`, title: row.label, meta: row.amount, status: row.status || "" }))} empty="Generate a report to see results." /></div>
              </div>
            )}

            {activeTab === "structures" && (
              <Card className="bg-[#0f141f] border-white/5">
                <CardContent className="space-y-3 p-6">
                  <h2 className="text-lg font-semibold text-white">Discounts & Scholarships</h2>
                  <div className="grid gap-3 md:grid-cols-4">
                    <Input value={discountForm.name} onChange={(e) => setDiscountForm({ ...discountForm, name: e.target.value })} />
                    <Select value={discountForm.type} onChange={(e) => setDiscountForm({ ...discountForm, type: e.target.value as "fixed" | "percentage" })}><option value="fixed">Fixed Amount</option><option value="percentage">Percentage</option></Select>
                    <Input type="number" value={discountForm.value} onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })} />
                    <Select value={discountForm.studentId} onChange={(e) => setDiscountForm({ ...discountForm, studentId: e.target.value })}><option value="">Any student</option>{students.map((student) => <option key={student.id} value={student.id}>{studentName(student.id)}</option>)}</Select>
                  </div>
                  <Button onClick={handleCreateDiscount}>Create Discount</Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card className="bg-[#0f141f] border-white/5">
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold text-white">{value}</p>
        </div>
        <div className="rounded-xl bg-red-500/10 p-3 text-red-400">{icon}</div>
      </CardContent>
    </Card>
  );
}

function FinanceList({ title, rows, empty }: { title: string; rows: Array<{ id: string; title: string; meta: string; status?: string }>; empty: string }) {
  return (
    <Card className="bg-[#0f141f] border-white/5">
      <CardContent className="space-y-3 p-6">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/5 py-8 text-center text-sm text-slate-500">{empty}</div>
        ) : (
          <div className="divide-y divide-white/5 rounded-xl border border-white/5">
            {rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{row.title}</p>
                  <p className="text-sm text-slate-400">{row.meta}</p>
                </div>
                {row.status && <Badge variant="secondary">{row.status}</Badge>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
