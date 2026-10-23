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
];

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <AuthContext.Provider value={mockAuthContextValue as any}>
      <OrgContext.Provider value={mockOrgContextValue as any}>{ui}</OrgContext.Provider>
    </AuthContext.Provider>
  );
}

describe("FeesFinancePage UX-002: Double-Submission Prevention", () => {
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
    vi.mocked(FinanceService.getIncomes).mockResolvedValue([]);
    vi.mocked(FinanceService.getLateFeePolicies).mockResolvedValue([]);
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

  it("prevents duplicate execution when running system ledger audit on rapid double-clicks", async () => {
    let resolveAudit: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveAudit = resolve;
    });

    vi.mocked(FinanceService.auditLedgerIntegrity).mockImplementation(() => pendingPromise as any);

    renderWithProviders(<FeesFinancePage initialTab="accounts" />);

    const auditBtn = await screen.findByRole("button", { name: /Run System Ledger Audit/i });

    // Rapid double click
    fireEvent.click(auditBtn);
    fireEvent.click(auditBtn);

    // Called only once
    expect(FinanceService.auditLedgerIntegrity).toHaveBeenCalledTimes(1);

    // Button disabled during processing
    expect(auditBtn).toBeDisabled();

    // Resolve
    resolveAudit({
      totalStudentsChecked: 45,
      balancedStudentsCount: 45,
      discrepancyStudentsCount: 0,
      discrepancies: [],
    });

    await waitFor(() => {
      expect(auditBtn).not.toBeDisabled();
    });
  });

  it("prevents duplicate execution when approving an expense on rapid double-clicks", async () => {
    let resolveApprove: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveApprove = resolve;
    });

    vi.mocked(FinanceService.approveExpense).mockImplementation(() => pendingPromise as any);

    renderWithProviders(<FeesFinancePage initialTab="expenses" />);

    expect(await screen.findByText("Classroom Whiteboards & Projectors")).toBeInTheDocument();

    const approveBtn = screen.getByRole("button", { name: /^Approve$/i });
    fireEvent.click(approveBtn);

    const confirmApproveBtn = await screen.findByRole("button", { name: /Confirm Approval/i });

    // Rapid double click
    fireEvent.click(confirmApproveBtn);
    fireEvent.click(confirmApproveBtn);

    // Must be called exactly once
    expect(FinanceService.approveExpense).toHaveBeenCalledTimes(1);
    expect(confirmApproveBtn).toBeDisabled();

    resolveApprove({
      ...sampleExpenses[0],
      status: "approved",
      approvedBy: "Finance Director",
    });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Confirm Approval/i })).not.toBeInTheDocument();
    });
  });

  it("restores submit button when an operation fails", async () => {
    let rejectAudit: (err: any) => void = () => {};
    const pendingPromise = new Promise((_, reject) => {
      rejectAudit = reject;
    });

    vi.mocked(FinanceService.auditLedgerIntegrity).mockImplementation(() => pendingPromise as any);

    renderWithProviders(<FeesFinancePage initialTab="accounts" />);

    const auditBtn = await screen.findByRole("button", { name: /Run System Ledger Audit/i });
    fireEvent.click(auditBtn);

    expect(auditBtn).toBeDisabled();

    // Reject
    rejectAudit(new Error("Audit calculation timeout"));

    await waitFor(() => {
      expect(auditBtn).not.toBeDisabled();
    });
  });
});
