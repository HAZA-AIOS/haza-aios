import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AuthContext } from "@/auth/AuthProvider";
import { OrgContext } from "@/org/OrgContext";
import { AdmissionsPage } from "../AdmissionsPage";
import { AdmissionsService } from "@/modules/education/sis/admissions.service";
import { AcademicService } from "@/modules/education/sis/academic.service";

vi.mock("@/modules/education/sis/admissions.service");
vi.mock("@/modules/education/sis/academic.service");
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
  id: "user-admin-101",
  firstName: "Registrar",
  lastName: "Director",
  displayName: "Registrar Director",
  email: "registrar@alhaza.edu",
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
  id: "org-edu-1",
  name: "Al-Haza International Academy",
  legalName: "Al-Haza Academy Inc.",
  slug: "al-haza",
  industry: "Education",
  organizationType: "School",
  email: "admissions@alhaza.edu",
  phone: "+92 300 1234567",
  status: "active" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockOrgContextValue = {
  currentOrganization: mockOrg,
  userOrganizations: [mockOrg],
  isLoading: false,
  error: null,
  selectOrganization: async () => {},
  createOrganization: async () => mockOrg,
  updateOrganization: async () => mockOrg,
  refreshOrganizations: async () => {},
};

const mockDashboardData = {
  totalEnquiries: 1,
  pendingApplications: 1,
  applicationsUnderAssessment: 0,
  approvedApplications: 1,
  rejectedApplications: 0,
  waitlistedApplications: 0,
  enrolledStudents: 0,
  conversionRatePercentage: 50.0,
  recentActivity: [],
};

const mockEnquiries = [
  {
    id: "enq-1",
    organizationId: "org-edu-1",
    referenceNumber: "ENQ-2026-0001",
    studentName: "Tariq Ali",
    guardianName: "Muhammad Ali",
    phone: "+92 300 1112233",
    email: "mali@example.com",
    desiredGradeId: "grade-5",
    preferredCampus: "Main Campus",
    source: "direct",
    enquiryDate: "2026-10-01",
    status: "open" as const,
    notes: "Interested in Cambridge stream.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockApplications = [
  {
    id: "app-1",
    organizationId: "org-edu-1",
    applicationNumber: "APP-2026-0001",
    desiredGradeId: "grade-5",
    campus: "Main Campus",
    academicYear: "2026-2027",
    admissionCategory: "general",
    status: "approved" as const,
    student: {
      firstName: "Zainab",
      lastName: "Khan",
      dateOfBirth: "2015-08-20",
      gender: "female" as const,
      email: "zkhan@example.com",
    },
    guardians: [
      {
        id: "grd-1",
        firstName: "Kamran",
        lastName: "Khan",
        relationship: "father" as const,
        phone: "+92 321 9876543",
        email: "kamran.khan@example.com",
        isPrimaryContact: true,
        isEmergencyContact: true,
      },
    ],
    documents: [],
    decision: {
      status: "approved" as const,
      decisionDate: "2026-10-15",
      reviewerUserId: "user-other",
      reviewerName: "Committee Head",
      remarks: "Excellent academic credentials.",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const renderComponent = () => {
  return render(
    <AuthContext.Provider value={mockAuthContextValue as any}>
      <OrgContext.Provider value={mockOrgContextValue as any}>
        <AdmissionsPage />
      </OrgContext.Provider>
    </AuthContext.Provider>
  );
};

describe("AdmissionsPage UX-002: Double-Submission Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(AdmissionsService.getDashboard).mockResolvedValue(mockDashboardData as any);
    vi.mocked(AdmissionsService.listEnquiries).mockResolvedValue(mockEnquiries as any);
    vi.mocked(AdmissionsService.listApplications).mockResolvedValue(mockApplications as any);
    vi.mocked(AdmissionsService.listAssessments).mockResolvedValue([] as any);

    vi.mocked(AcademicService.getAcademicYears).mockResolvedValue([
      { id: "ay-2026", name: "Academic Year 2026-2027", code: "AY2026", startDate: "2026-08-01", endDate: "2027-06-30", status: "active" } as any,
    ]);
    vi.mocked(AcademicService.getGrades).mockResolvedValue([
      { id: "grade-5", name: "Grade 5", code: "G5", level: 5, status: "active" } as any,
    ]);
    vi.mocked(AcademicService.getSections).mockResolvedValue([
      { id: "sec-a", name: "Section A", code: "A", gradeId: "grade-5", capacity: 30, status: "active" } as any,
    ]);
  });

  it("prevents duplicate submissions on rapid double-clicks when creating an enquiry", async () => {
    let resolveCreate: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveCreate = resolve;
    });

    vi.mocked(AdmissionsService.createEnquiry).mockImplementation(() => pendingPromise as any);

    renderComponent();

    // Switch to Enquiries tab
    const enquiriesTab = screen.getByRole("button", { name: /Enquiries/i });
    fireEvent.click(enquiriesTab);

    // Open enquiry modal
    const logEnquiryBtn = screen.getByRole("button", { name: /Log Enquiry/i });
    fireEvent.click(logEnquiryBtn);

    const studentNameInput = screen.getByPlaceholderText(/Candidate full name/i);
    fireEvent.change(studentNameInput, { target: { value: "Hamza Bilal" } });

    const guardianNameInput = screen.getByPlaceholderText(/Parent\/Guardian/i);
    fireEvent.change(guardianNameInput, { target: { value: "Bilal Ahmad" } });

    const phoneInput = screen.getByPlaceholderText(/Contact number/i);
    fireEvent.change(phoneInput, { target: { value: "+92 333 4445555" } });

    const submitBtn = screen.getByRole("button", { name: /Save Enquiry/i });

    // Rapid double click
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    // Should only have called createEnquiry ONCE
    expect(AdmissionsService.createEnquiry).toHaveBeenCalledTimes(1);

    // Verify button shows loading text and is disabled
    expect(submitBtn).toBeDisabled();
    expect(screen.getByText(/Saving\.\.\./i)).toBeInTheDocument();

    // Resolve promise
    resolveCreate(mockEnquiries[0]);

    await waitFor(() => {
      expect(screen.queryByText(/Log Prospect Candidate Enquiry/i)).not.toBeInTheDocument();
    });
  });

  it("restores submit button and preserves entered form fields on failed enquiry submission", async () => {
    let rejectCreate: (err: any) => void = () => {};
    const pendingPromise = new Promise((_, reject) => {
      rejectCreate = reject;
    });

    vi.mocked(AdmissionsService.createEnquiry).mockImplementation(() => pendingPromise as any);

    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /Enquiries/i }));
    fireEvent.click(screen.getByRole("button", { name: /Log Enquiry/i }));

    const studentNameInput = screen.getByPlaceholderText(/Candidate full name/i) as HTMLInputElement;
    fireEvent.change(studentNameInput, { target: { value: "Ahmad Raza" } });

    const guardianNameInput = screen.getByPlaceholderText(/Parent\/Guardian/i) as HTMLInputElement;
    fireEvent.change(guardianNameInput, { target: { value: "Raza Ali" } });

    const phoneInput = screen.getByPlaceholderText(/Contact number/i) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: "+92 333 9999999" } });

    const submitBtn = screen.getByRole("button", { name: /Save Enquiry/i });
    fireEvent.click(submitBtn);

    expect(submitBtn).toBeDisabled();

    // Simulate rejection
    rejectCreate(new Error("Network timeout or duplicate submission error"));

    await waitFor(() => {
      // Button must be restored (enabled again for retry)
      expect(submitBtn).not.toBeDisabled();
      expect(screen.getByText(/Save Enquiry/i)).toBeInTheDocument();
    });

    // Form inputs must remain intact so user does not lose data
    expect(studentNameInput.value).toBe("Ahmad Raza");
    expect(guardianNameInput.value).toBe("Raza Ali");
    expect(phoneInput.value).toBe("+92 333 9999999");
  });

  it("prevents duplicate submissions on rapid double-click in enrollment conversion dialog", async () => {
    let resolveConversion: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveConversion = resolve;
    });

    vi.mocked(AdmissionsService.convertToEnrollment).mockImplementation(() => pendingPromise as any);

    renderComponent();

    // Switch to Applications tab
    const appsTab = screen.getByRole("button", { name: /Applications/i });
    fireEvent.click(appsTab);

    await waitFor(() => {
      expect(screen.getByText("APP-2026-0001")).toBeInTheDocument();
    });

    // Click "Enroll" button on the approved application row
    const convertBtn = screen.getByRole("button", { name: /^Enroll$/i });
    fireEvent.click(convertBtn);

    // Modal opens
    expect(screen.getByText(/Confirm Student Enrollment/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /Finalize Enrollment/i });

    // Rapid double click
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    // Service called exactly once
    expect(AdmissionsService.convertToEnrollment).toHaveBeenCalledTimes(1);
    expect(confirmBtn).toBeDisabled();

    resolveConversion({
      success: true,
      isExisting: false,
      applicationId: "app-1",
      student: {} as any,
      enrollment: {} as any,
      message: "Student successfully enrolled!",
    });

    await waitFor(() => {
      expect(screen.queryByText(/Confirm Student Enrollment/i)).not.toBeInTheDocument();
    });
  });
});
