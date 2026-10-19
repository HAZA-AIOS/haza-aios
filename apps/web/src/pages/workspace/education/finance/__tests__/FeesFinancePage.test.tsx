import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AuthContext } from "@/auth/AuthProvider";
import { OrgContext } from "@/org/OrgContext";
import { FeesFinancePage } from "../FeesFinancePage";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { EnrollmentService } from "@/modules/education/sis/enrollment.service";
import { FinanceService } from "@/modules/education/sis/finance.service";
import { StudentService } from "@/modules/education/sis/student.service";

vi.mock("@/modules/education/sis/academic.service");
vi.mock("@/modules/education/sis/enrollment.service");
vi.mock("@/modules/education/sis/finance.service");
vi.mock("@/modules/education/sis/student.service");
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));
vi.mock("@/routes/router", () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const mockUser = {
  id: "user-finance-1",
  firstName: "Accountant",
  lastName: "Officer",
  displayName: "Accountant Officer",
  email: "finance@test.com",
  emailVerified: true,
  status: "active" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAuthContextValue = {
  status: "authenticated" as const,
  user: mockUser,
  session: null,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  forgotPassword: async () => {},
  resetPassword: async () => {},
  verifyEmail: async () => {},
  clearError: () => {},
};

const mockOrg = {
  id: "org-finance-1",
  name: "Al-Haza International Academy",
  legalName: "Al-Haza Academy Inc.",
  slug: "al-haza",
  industry: "Education",
  organizationType: "School",
  email: "bursar@alhaza.edu",
  country: "United States",
  timezone: "UTC",
  currency: "USD",
  status: "active" as const,
  ownerId: "owner-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockOrgContextValue = {
  currentOrganization: mockOrg,
  organizations: [mockOrg],
  currentMembership: {
    id: "mem-1",
    organizationId: mockOrg.id,
    userId: mockUser.id,
    role: "Admin" as const,
    status: "active" as const,
    joinedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  isLoading: false,
  error: null,
  createOrg: async () => ({ organization: mockOrg as any, membership: {} as any }),
  switchOrg: async () => {},
  refresh: async () => {},
};

const sampleAcademicYears = [
  { id: "ay-1", organizationId: mockOrg.id, name: "2026-2027", startDate: "2026-09-01", endDate: "2027-06-30", status: "active" as const, createdAt: "", updatedAt: "" },
];

const sampleGrades = [
  { id: "gr-1", organizationId: mockOrg.id, name: "Grade 10", level: 10, status: "active" as const, createdAt: "", updatedAt: "" },
];

const sampleStudents = [
  {
    id: "st-1",
    organizationId: mockOrg.id,
    admissionNumber: "ADM-1001",
    firstName: "Bilal",
    lastName: "Tariq",
    dateOfBirth: "2010-04-12",
    gender: "male" as const,
    enrollmentDate: "2026-09-01",
    status: "active" as const,
    createdAt: "",
    updatedAt: "",
  },
];

const sampleCategories = [
  { id: "cat-1", organizationId: mockOrg.id, name: "Tuition Fee", code: "TUITION", status: "active" as const, displayOrder: 1, createdAt: "", updatedAt: "" },
  { id: "cat-2", organizationId: mockOrg.id, name: "Lab Fee", code: "LAB", status: "active" as const, displayOrder: 2, createdAt: "", updatedAt: "" },
];

const sampleStructures = [
  {
    id: "fs-1",
    organizationId: mockOrg.id,
    academicYearId: "ay-1",
    gradeId: "gr-1",
    feeCategoryId: "cat-1",
    name: "Grade 10 Monthly Tuition",
    amountCents: 50000,
    frequency: "monthly" as const,
    effectiveFrom: "2026-09-01",
    status: "active" as const,
    createdAt: "",
    updatedAt: "",
  },
];

const sampleDiscounts = [
  {
    id: "disc-1",
    organizationId: mockOrg.id,
    name: "Academic Excellence Scholarship",
    type: "fixed" as const,
    value: 10000,
    reason: "Merit award",
    authorizedBy: "Principal",
    status: "active" as const,
    createdAt: "",
    updatedAt: "",
  },
];

const sampleInvoices = [
  {
    id: "inv-1",
    organizationId: mockOrg.id,
    studentId: "st-1",
    enrollmentId: "enr-1",
    academicYearId: "ay-1",
    invoiceNumber: "INV-HAZA-00001",
    issueDate: "2026-10-01",
    dueDate: "2026-10-15",
    status: "issued" as const,
    currency: "USD",
    items: [
      {
        id: "li-1",
        feeCategoryId: "cat-1",
        description: "Grade 10 Monthly Tuition",
        quantity: 1,
        amountCents: 50000,
        discountCents: 10000,
        adjustmentCents: 0,
        finalAmountCents: 40000,
      },
    ],
    discountCents: 10000,
    adjustmentCents: 0,
    subtotalCents: 50000,
    totalCents: 40000,
    paidAmountCents: 10000,
    balanceCents: 30000,
    adjustments: [],
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "inv-2",
    organizationId: mockOrg.id,
    studentId: "st-1",
    enrollmentId: "enr-1",
    academicYearId: "ay-1",
    invoiceNumber: "INV-HAZA-00002",
    issueDate: "2026-10-10",
    dueDate: "2026-10-25",
    status: "draft" as const,
    currency: "USD",
    items: [
      {
        id: "li-2",
        feeCategoryId: "cat-2",
        description: "Science Lab Fee",
        quantity: 1,
        amountCents: 15000,
        discountCents: 0,
        adjustmentCents: 0,
        finalAmountCents: 15000,
      },
    ],
    discountCents: 0,
    adjustmentCents: 0,
    subtotalCents: 15000,
    totalCents: 15000,
    paidAmountCents: 0,
    balanceCents: 15000,
    adjustments: [],
    createdAt: "",
    updatedAt: "",
  },
];

const samplePayments = [
  {
    id: "pay-1",
    organizationId: mockOrg.id,
    invoiceId: "inv-1",
    studentId: "st-1",
    amountCents: 10000,
    paymentDate: "2026-10-05",
    paymentMethod: "bank_transfer" as const,
    referenceNumber: "WIRE-77312",
    receivedBy: "Bursar Desk",
    status: "recorded" as const,
    createdAt: "",
    updatedAt: "",
  },
];

const sampleReceipts = [
  {
    id: "rcpt-1",
    organizationId: mockOrg.id,
    invoiceId: "inv-1",
    paymentId: "pay-1",
    studentId: "st-1",
    receiptNumber: "RCT-HAZA-00001",
    amountCents: 10000,
    paymentMethod: "bank_transfer" as const,
    referenceNumber: "WIRE-77312",
    receiptDate: "2026-10-05",
    createdAt: "",
    updatedAt: "",
  },
];

const sampleLedger = [
  {
    id: "led-1",
    organizationId: mockOrg.id,
    studentId: "st-1",
    type: "invoice" as const,
    description: "Invoice INV-HAZA-00001",
    debitCents: 40000,
    creditCents: 0,
    balanceCents: 40000,
    occurredAt: "2026-10-01",
  },
  {
    id: "led-2",
    organizationId: mockOrg.id,
    studentId: "st-1",
    type: "payment" as const,
    description: "Payment WIRE-77312",
    debitCents: 0,
    creditCents: 10000,
    balanceCents: 30000,
    occurredAt: "2026-10-05",
  },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AuthContext.Provider value={mockAuthContextValue as any}>
      <OrgContext.Provider value={mockOrgContextValue as any}>{ui}</OrgContext.Provider>
    </AuthContext.Provider>
  );
}

describe("FeesFinancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AcademicService.getAcademicYears).mockResolvedValue(sampleAcademicYears);
    vi.mocked(AcademicService.getGrades).mockResolvedValue(sampleGrades);
    vi.mocked(StudentService.getStudents).mockResolvedValue(sampleStudents as any);
    vi.mocked(EnrollmentService.getCurrentEnrollment).mockResolvedValue({
      id: "enr-1",
      studentId: "st-1",
      academicYear: "2026-2027",
      gradeId: "gr-1",
      sectionId: "sec-1",
      enrollmentDate: "2026-09-01",
      status: "active",
      organizationId: mockOrg.id,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(FinanceService.getFeeCategories).mockResolvedValue(sampleCategories);
    vi.mocked(FinanceService.getFeeStructures).mockResolvedValue(sampleStructures);
    vi.mocked(FinanceService.getStudentFeeAssignments).mockResolvedValue([]);
    vi.mocked(FinanceService.getDiscounts).mockResolvedValue(sampleDiscounts);
    vi.mocked(FinanceService.getInvoices).mockResolvedValue(sampleInvoices);
    vi.mocked(FinanceService.getPayments).mockResolvedValue(samplePayments);
    vi.mocked(FinanceService.getReceipts).mockResolvedValue(sampleReceipts);
    vi.mocked(FinanceService.getStudentLedger).mockResolvedValue(sampleLedger);
    vi.mocked(FinanceService.getExpenses).mockResolvedValue([]);
    vi.mocked(FinanceService.getExpenseCategories).mockResolvedValue([]);
    vi.mocked(FinanceService.getIncomes).mockResolvedValue([]);
    vi.mocked(FinanceService.getLateFeePolicies).mockResolvedValue([]);
    vi.mocked(FinanceService.getStudentLedgerReconciliation).mockResolvedValue({
      studentId: "st-1",
      totalInvoicesDebitCents: 40000,
      totalDiscountsCreditCents: 10000,
      totalPaymentsCreditCents: 10000,
      totalVoidedDebitsCents: 0,
      calculatedNetDueCents: 30000,
      currentInvoiceBalanceCents: 30000,
      isBalanced: true,
      discrepancyCents: 0,
      checkedAt: new Date().toISOString(),
    });
    vi.mocked(FinanceService.getCollectionSummary).mockResolvedValue({
      totalBilledCents: 55000,
      totalCollectedCents: 10000,
      outstandingCents: 45000,
      overdueCents: 0,
      collectionRate: 18.18,
      paymentsTodayCents: 10000,
      outstandingStudents: 1,
    });
  });

  it("renders the finance workspace header and overview financial KPIs", async () => {
    renderWithProviders(<FeesFinancePage />);

    expect(await screen.findByText("Fee & Billing Management")).toBeInTheDocument();
    expect(screen.getByText("Currency: USD")).toBeInTheDocument();

    // Verify Financial KPI labels
    expect(screen.getByText("Total Billed")).toBeInTheDocument();
    expect(screen.getByText("Collected")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Collection Rate")).toBeInTheDocument();

    // Verify Recent Invoices on overview
    expect(screen.getByText("Recent Invoices")).toBeInTheDocument();
    expect(screen.getByText("INV-HAZA-00001")).toBeInTheDocument();
  });

  it("switches tabs and displays fee structure configuration and categories", async () => {
    renderWithProviders(<FeesFinancePage />);
    await screen.findByText("Fee & Billing Management");

    const structuresTabBtn = screen.getByTestId("finance-tab-structures");
    fireEvent.click(structuresTabBtn);

    expect(await screen.findByText("Create Fee Category")).toBeInTheDocument();
    expect(screen.getByText("Create Fee Structure")).toBeInTheDocument();
    expect(screen.getByText("Discounts, Scholarships & Concessions")).toBeInTheDocument();
    expect(screen.getByText("Grade 10 Monthly Tuition")).toBeInTheDocument();
  });

  it("switches to invoices tab, lists invoices with status badges, and opens invoice details", async () => {
    renderWithProviders(<FeesFinancePage />);
    await screen.findByText("Fee & Billing Management");

    const invoicesTabBtn = screen.getByTestId("finance-tab-invoices");
    fireEvent.click(invoicesTabBtn);

    expect(await screen.findByText("INV-HAZA-00001")).toBeInTheDocument();
    expect(screen.getByText("INV-HAZA-00002")).toBeInTheDocument();

    // Click view details for invoice 1
    const viewButton = screen.getByTestId("view-invoice-inv-1");
    fireEvent.click(viewButton);

    expect(await screen.findByText(/Invoice Details/i)).toBeInTheDocument();
    expect(screen.getByText("Itemized Line Items")).toBeInTheDocument();
  });

  it("handles issuing a draft invoice directly", async () => {
    vi.mocked(FinanceService.issueInvoice).mockResolvedValue({
      ...sampleInvoices[1],
      status: "issued",
    });

    renderWithProviders(<FeesFinancePage initialTab="invoices" />);
    expect(await screen.findByText("INV-HAZA-00002")).toBeInTheDocument();

    const issueBtn = screen.getByRole("button", { name: /^Issue$/i });
    fireEvent.click(issueBtn);

    await waitFor(() => {
      expect(FinanceService.issueInvoice).toHaveBeenCalledWith(mockOrg.id, "inv-2");
    });
  });

  it("switches to payments tab, displays transactions, and allows viewing receipt voucher", async () => {
    renderWithProviders(<FeesFinancePage initialTab="payments" />);

    expect(await screen.findByText(/Payment Transactions/i)).toBeInTheDocument();
    expect(screen.getByText("WIRE-77312")).toBeInTheDocument();

    // Click view receipt
    const receiptBtn = screen.getByTestId("view-receipt-rcpt-1");
    fireEvent.click(receiptBtn);

    expect(await screen.findByText("Receipt Voucher")).toBeInTheDocument();
    expect(screen.getAllByText("RCT-HAZA-00001").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Total Amount Received")).toBeInTheDocument();
  });

  it("switches to student accounts tab and displays student ledger and debit/credit breakdown", async () => {
    renderWithProviders(<FeesFinancePage initialTab="accounts" />);

    expect(await screen.findByText("Student Account & Fee Ledger")).toBeInTheDocument();
    expect(await screen.findByText("Invoice INV-HAZA-00001")).toBeInTheDocument();
    expect(screen.getByText("Payment WIRE-77312")).toBeInTheDocument();
    expect(screen.getByText("Statement of Account")).toBeInTheDocument();
  });

  it("switches to reports tab, runs collection reports, and allows CSV export", async () => {
    vi.mocked(FinanceService.getCollectionReport).mockResolvedValue([
      {
        invoiceId: "inv-1",
        invoiceNumber: "INV-HAZA-00001",
        studentId: "st-1",
        totalCents: 40000,
        paidCents: 10000,
        balanceCents: 30000,
        status: "issued",
      },
    ]);

    renderWithProviders(<FeesFinancePage initialTab="reports" />);

    expect(await screen.findByText("Financial & Collection Reports")).toBeInTheDocument();
    const runBtn = screen.getByRole("button", { name: /Run Report/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(FinanceService.getCollectionReport).toHaveBeenCalled();
    });

    expect(await screen.findByText(/Export CSV/i)).toBeInTheDocument();
  });
});
