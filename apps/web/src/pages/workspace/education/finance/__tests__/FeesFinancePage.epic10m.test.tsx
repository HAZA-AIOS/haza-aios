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
import type { ExpenseCategory, ExpenseRecord, IncomeRecord, LateFeePolicy } from "@/modules/education/sis/sis.types";

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
  id: "user-finance-director",
  firstName: "Finance",
  lastName: "Director",
  displayName: "Finance Director",
  email: "director@alhaza.edu",
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
  id: "org-finance-epic10m",
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
  { id: "ay-10m", organizationId: mockOrg.id, name: "2026-2027", startDate: "2026-09-01", endDate: "2027-06-30", status: "active" as const, createdAt: "", updatedAt: "" },
];

const sampleStudents = [
  {
    id: "st-10m",
    organizationId: mockOrg.id,
    admissionNumber: "ADM-9001",
    firstName: "Zayd",
    lastName: "Mansoor",
    dateOfBirth: "2011-05-15",
    gender: "male" as const,
    enrollmentDate: "2026-09-01",
    status: "active" as const,
    createdAt: "",
    updatedAt: "",
  },
];

const sampleExpenseCategories: ExpenseCategory[] = [
  { id: "ecat-1", organizationId: mockOrg.id, code: "FACILITIES", name: "Facilities & Maintenance", displayOrder: 1, status: "active", createdAt: "", updatedAt: "" },
  { id: "ecat-2", organizationId: mockOrg.id, code: "ACADEMICS", name: "Academic Supplies", displayOrder: 2, status: "active", createdAt: "", updatedAt: "" },
];

const sampleExpenses: ExpenseRecord[] = [
  {
    id: "exp-1",
    organizationId: mockOrg.id,
    expenseNumber: "EXP-2026-00001",
    title: "Classroom Whiteboards & Projectors",
    categoryId: "ecat-2",
    amountCents: 125000,
    expenseDate: "2026-10-12",
    payee: "Global AV Supplies Inc.",
    paymentMethod: "bank_transfer",
    status: "submitted",
    submittedBy: "Head of Academics",
    submittedAt: "2026-10-12T08:00:00Z",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "exp-2",
    organizationId: mockOrg.id,
    expenseNumber: "EXP-2026-00002",
    title: "Campus HVAC Filter Replacement",
    categoryId: "ecat-1",
    amountCents: 45000,
    expenseDate: "2026-10-14",
    payee: "CoolAir Services",
    paymentMethod: "bank_transfer",
    status: "approved",
    approvedBy: "Finance Director",
    approvedAt: "2026-10-14T09:30:00Z",
    createdAt: "",
    updatedAt: "",
  },
];

const sampleIncomes: IncomeRecord[] = [
  {
    id: "inc-1",
    organizationId: mockOrg.id,
    receiptNumber: "INC-2026-00001",
    source: "Alumni Association Endowment",
    category: "Donation",
    amountCents: 500000,
    receivedDate: "2026-10-01",
    paymentMethod: "bank_transfer",
    referenceNumber: "WIRE-DONATION-882",
    receivedBy: "Development Office",
    status: "active",
    createdAt: "",
    updatedAt: "",
  },
];

const sampleLateFeePolicies: LateFeePolicy[] = [
  {
    id: "pol-1",
    organizationId: mockOrg.id,
    academicYearId: "ay-10m",
    code: "LATE-FIXED-25",
    name: "$25 Fixed Overdue Penalty",
    gracePeriodDays: 7,
    feeType: "fixed",
    amountCents: 2500,
    percentageRate: 0,
    maxCapCents: 5000,
    status: "active",
    applyAutomatically: true,
    createdAt: "",
    updatedAt: "",
  },
];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AuthContext.Provider value={mockAuthContextValue as any}>
      <OrgContext.Provider value={mockOrgContextValue as any}>{ui}</OrgContext.Provider>
    </AuthContext.Provider>
  );
}

describe("FeesFinancePage - Epic 10M Financial Management Features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AcademicService.getAcademicYears).mockResolvedValue(sampleAcademicYears);
    vi.mocked(AcademicService.getGrades).mockResolvedValue([]);
    vi.mocked(StudentService.getStudents).mockResolvedValue(sampleStudents as any);
    vi.mocked(FinanceService.getFeeCategories).mockResolvedValue([]);
    vi.mocked(FinanceService.getFeeStructures).mockResolvedValue([]);
    vi.mocked(FinanceService.getStudentFeeAssignments).mockResolvedValue([]);
    vi.mocked(FinanceService.getDiscounts).mockResolvedValue([]);
    vi.mocked(FinanceService.getInvoices).mockResolvedValue([]);
    vi.mocked(FinanceService.getPayments).mockResolvedValue([]);
    vi.mocked(FinanceService.getReceipts).mockResolvedValue([]);
    vi.mocked(FinanceService.getStudentLedger).mockResolvedValue([]);
    vi.mocked(FinanceService.getExpenses).mockResolvedValue(sampleExpenses);
    vi.mocked(FinanceService.getExpenseCategories).mockResolvedValue(sampleExpenseCategories);
    vi.mocked(FinanceService.getIncomes).mockResolvedValue(sampleIncomes);
    vi.mocked(FinanceService.getLateFeePolicies).mockResolvedValue(sampleLateFeePolicies);
    vi.mocked(FinanceService.getStudentLedgerReconciliation).mockResolvedValue({
      studentId: "st-10m",
      totalInvoicesDebitCents: 50000,
      totalDiscountsCreditCents: 0,
      totalPaymentsCreditCents: 50000,
      totalVoidedDebitsCents: 0,
      calculatedNetDueCents: 0,
      currentInvoiceBalanceCents: 0,
      isBalanced: true,
      discrepancyCents: 0,
      checkedAt: new Date().toISOString(),
    });
    vi.mocked(FinanceService.auditLedgerIntegrity).mockResolvedValue({
      totalStudentsChecked: 45,
      balancedStudentsCount: 45,
      discrepancyStudentsCount: 0,
      discrepancies: [],
    });
    vi.mocked(FinanceService.getCollectionSummary).mockResolvedValue({
      totalBilledCents: 50000,
      totalCollectedCents: 50000,
      outstandingCents: 0,
      overdueCents: 0,
      collectionRate: 100,
      paymentsTodayCents: 0,
      outstandingStudents: 0,
    });
  });

  it("renders Epic 10M navigation tabs for Expenses, Other Income, Late Fee Policies, Student Accounts", async () => {
    renderWithProviders(<FeesFinancePage />);
    expect(await screen.findByText("Fee & Billing Management")).toBeInTheDocument();

    expect(screen.getByTestId("finance-tab-expenses")).toBeInTheDocument();
    expect(screen.getByTestId("finance-tab-income")).toBeInTheDocument();
    expect(screen.getByTestId("finance-tab-policies")).toBeInTheDocument();
    expect(screen.getByTestId("finance-tab-accounts")).toBeInTheDocument();
    expect(screen.getByTestId("finance-tab-reports")).toBeInTheDocument();
  });

  it("displays expense records with approval states and allows approving a submitted expense", async () => {
    vi.mocked(FinanceService.approveExpense).mockResolvedValue({
      ...sampleExpenses[0],
      status: "approved",
      approvedBy: "Finance Director",
    });

    renderWithProviders(<FeesFinancePage initialTab="expenses" />);

    expect(await screen.findByText("Classroom Whiteboards & Projectors")).toBeInTheDocument();
    expect(screen.getByText("Campus HVAC Filter Replacement")).toBeInTheDocument();
    expect(screen.getByText(/Global AV Supplies Inc\./)).toBeInTheDocument();

    // Find and click Approve button for the submitted expense
    const approveBtn = screen.getByRole("button", { name: /^Approve$/i });
    fireEvent.click(approveBtn);

    // Modal opens
    const confirmApproveBtn = await screen.findByRole("button", { name: /Confirm Approval/i });
    expect(confirmApproveBtn).toBeInTheDocument();
    fireEvent.click(confirmApproveBtn);

    await waitFor(() => {
      expect(FinanceService.approveExpense).toHaveBeenCalledWith(
        mockOrg.id,
        "exp-1",
        "Finance Director"
      );
    });
  });

  it("displays non-tuition income records and receipt vouchers", async () => {
    renderWithProviders(<FeesFinancePage initialTab="income" />);

    expect(await screen.findByText("Alumni Association Endowment")).toBeInTheDocument();
    expect(screen.getByText("INC-2026-00001")).toBeInTheDocument();
    expect(screen.getByText("WIRE-DONATION-882")).toBeInTheDocument();
  });

  it("displays configurable late-fee policies with grace periods and penalty rates", async () => {
    renderWithProviders(<FeesFinancePage initialTab="policies" />);

    expect(await screen.findByText("LATE-FIXED-25")).toBeInTheDocument();
    expect(screen.getByText("$25 Fixed Overdue Penalty")).toBeInTheDocument();
    expect(screen.getByText("7 days")).toBeInTheDocument();
  });

  it("verifies mathematical ledger balance integrity and triggers system-wide ledger audit", async () => {
    renderWithProviders(<FeesFinancePage initialTab="accounts" />);

    expect(await screen.findByText(/Verified Balanced: Debits - Credits === Balance/i)).toBeInTheDocument();

    const auditBtn = screen.getByRole("button", { name: /Run System Ledger Audit/i });
    fireEvent.click(auditBtn);

    await waitFor(() => {
      expect(FinanceService.auditLedgerIntegrity).toHaveBeenCalledWith(mockOrg.id);
    });
  });

  it("runs financial P&L report comparing revenue vs expenses and calculates net operating surplus", async () => {
    vi.mocked(FinanceService.getIncomeExpenseReport).mockResolvedValue({
      totalRevenueCents: 550000,
      totalFeeIncomeCents: 50000,
      totalOtherIncomeCents: 500000,
      totalExpenseCents: 170000,
      netSurplusCents: 380000,
      marginPercentage: 69.09,
      expenseByCategory: { "Facilities & Maintenance": 45000, "Academic Supplies": 125000 },
      incomeByCategory: { "Tuition & Academic Fees": 50000, Donation: 500000 },
      paymentsCount: 1,
      incomesCount: 1,
      expensesCount: 2,
    });

    renderWithProviders(<FeesFinancePage initialTab="reports" />);

    expect(await screen.findByText("Financial & Collection Reports")).toBeInTheDocument();

    // Select P&L report type
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "pl" } });

    const runBtn = screen.getByRole("button", { name: /Run Report/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(FinanceService.getIncomeExpenseReport).toHaveBeenCalled();
    });

    expect(await screen.findByText("Total Revenue")).toBeInTheDocument();
    expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    expect(screen.getByText("Net Operating Surplus")).toBeInTheDocument();
  });
});
