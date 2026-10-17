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
  totalEnquiries: 12,
  pendingApplications: 5,
  applicationsUnderAssessment: 3,
  approvedApplications: 4,
  rejectedApplications: 1,
  waitlistedApplications: 2,
  enrolledStudents: 8,
  conversionRatePercentage: 66.7,
  recentActivity: [
    {
      id: "act-1",
      type: "enquiry" as const,
      title: "New Enquiry Received",
      description: "Enquiry ENQ-2026-0001 created for Tariq Ali",
      timestamp: new Date().toISOString(),
      reference: "ENQ-2026-0001",
    },
  ],
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

const mockAssessments = [
  {
    id: "ass-1",
    organizationId: "org-edu-1",
    applicationId: "app-1",
    subject: "Mathematics & English",
    assessmentType: "written_test" as const,
    assessmentDate: "2026-10-10",
    assessorStaffId: "staff-1",
    assessorName: "Prof. Farooq",
    maximumMarks: 100,
    obtainedMarks: 92,
    passingMarks: 50,
    outcome: "passed" as const,
    remarks: "Outstanding problem solving.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockPrintDocument = {
  organizationId: "org-edu-1",
  applicationNumber: "APP-2026-0001",
  status: "approved",
  academicYear: "2026-2027",
  campus: "Main Campus",
  gradeName: "Grade 5",
  submissionDate: "2026-10-05",
  student: {
    fullName: "Zainab Khan",
    firstName: "Zainab",
    lastName: "Khan",
    dateOfBirth: "2015-08-20",
    gender: "female",
  },
  guardians: [
    {
      fullName: "Kamran Khan",
      relationship: "father",
      email: "kamran.khan@example.com",
      phone: "+92 321 9876543",
    },
  ],
  assessments: [
    {
      subject: "Mathematics & English",
      type: "written_test",
      marks: "92 / 100",
      outcome: "passed",
      date: "2026-10-10",
    },
  ],
  decision: {
    status: "approved",
    decisionDate: "2026-10-15",
    reviewerName: "Committee Head",
    remarks: "Excellent credentials",
  },
  feePackage: null,
  generatedAt: new Date().toISOString(),
};

const renderComponent = () => {
  return render(
    <AuthContext.Provider value={mockAuthContextValue as any}>
      <OrgContext.Provider value={mockOrgContextValue as any}>
        <AdmissionsPage />
      </OrgContext.Provider>
    </AuthContext.Provider>
  );
};

describe("AdmissionsPage (Epic 10K)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(AdmissionsService.getDashboard).mockResolvedValue(mockDashboardData as any);
    vi.mocked(AdmissionsService.listEnquiries).mockResolvedValue(mockEnquiries as any);
    vi.mocked(AdmissionsService.listApplications).mockResolvedValue(mockApplications as any);
    vi.mocked(AdmissionsService.listAssessments).mockResolvedValue(mockAssessments as any);
    vi.mocked(AdmissionsService.createEnquiry).mockResolvedValue(mockEnquiries[0] as any);
    vi.mocked(AdmissionsService.createAssessment).mockResolvedValue(mockAssessments[0] as any);
    vi.mocked(AdmissionsService.recordDecision).mockResolvedValue(mockApplications[0] as any);
    vi.mocked(AdmissionsService.convertToEnrollment).mockResolvedValue({
      success: true,
      isExisting: false,
      applicationId: "app-1",
      student: {} as any,
      enrollment: {} as any,
      message: "Student successfully enrolled!",
    });
    vi.mocked(AdmissionsService.getPrintDocument).mockResolvedValue(mockPrintDocument as any);
    vi.mocked(AdmissionsService.getReport).mockResolvedValue({
      type: "conversion_summary",
      rows: [],
      generatedAt: new Date().toISOString(),
    } as any);

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

  it("renders admissions suite header and dashboard KPI cards", async () => {
    renderComponent();

    expect(screen.getByText(/Admissions & Enrollment Suite/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("12")).toBeInTheDocument(); // total enquiries
      expect(screen.getByText("5")).toBeInTheDocument(); // pending apps
      expect(screen.getByText("66.7%")).toBeInTheDocument(); // conversion rate
    });
  });

  it("switches to Enquiries tab and displays enquiry records", async () => {
    renderComponent();

    const enquiriesTab = screen.getByRole("button", { name: /Enquiries/i });
    fireEvent.click(enquiriesTab);

    await waitFor(() => {
      expect(screen.getByText("Tariq Ali")).toBeInTheDocument();
      expect(screen.getByText("ENQ-2026-0001")).toBeInTheDocument();
      expect(screen.getByText("Muhammad Ali")).toBeInTheDocument();
    });
  });

  it("opens new enquiry modal and creates an enquiry", async () => {
    renderComponent();

    const enquiriesTab = screen.getByRole("button", { name: /Enquiries/i });
    fireEvent.click(enquiriesTab);

    const logEnquiryBtn = screen.getByRole("button", { name: /Log Enquiry/i });
    fireEvent.click(logEnquiryBtn);

    expect(screen.getByText(/Log Prospect Candidate Enquiry/i)).toBeInTheDocument();

    const studentNameInput = screen.getByPlaceholderText(/Candidate full name/i);
    fireEvent.change(studentNameInput, { target: { value: "Hamza Bilal" } });

    const guardianNameInput = screen.getByPlaceholderText(/Parent\/Guardian/i);
    fireEvent.change(guardianNameInput, { target: { value: "Bilal Ahmad" } });

    const phoneInput = screen.getByPlaceholderText(/Contact number/i);
    fireEvent.change(phoneInput, { target: { value: "+92 333 4445555" } });

    const submitBtn = screen.getByRole("button", { name: /Save Enquiry/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(AdmissionsService.createEnquiry).toHaveBeenCalledWith("org-edu-1", expect.objectContaining({
        studentName: "Hamza Bilal",
        guardianName: "Bilal Ahmad",
        phone: "+92 333 4445555",
      }));
    });
  });

  it("switches to Applications tab and shows applications", async () => {
    renderComponent();

    const appsTab = screen.getByRole("button", { name: /Applications/i });
    fireEvent.click(appsTab);

    await waitFor(() => {
      expect(screen.getByText("Zainab Khan")).toBeInTheDocument();
      expect(screen.getByText("APP-2026-0001")).toBeInTheDocument();
    });
  });

  it("switches to Assessments tab and displays diagnostic test records", async () => {
    renderComponent();

    const assessmentsTab = screen.getByRole("button", { name: /Assessments/i });
    fireEvent.click(assessmentsTab);

    await waitFor(() => {
      expect(screen.getByText("Mathematics & English")).toBeInTheDocument();
      expect(screen.getByText(/92 \/ 100/i)).toBeInTheDocument();
    });
  });

  it("switches to Enrollment conversion tab and converts an approved candidate", async () => {
    renderComponent();

    const conversionTab = screen.getByRole("button", { name: /^Enrollment$/i });
    fireEvent.click(conversionTab);

    await waitFor(() => {
      expect(screen.getByText("Zainab Khan")).toBeInTheDocument();
    });

    const convertBtn = screen.getByRole("button", { name: /Convert & Admit Student/i });
    fireEvent.click(convertBtn);

    expect(screen.getByText(/Confirm Student Enrollment/i)).toBeInTheDocument();

    const submitEnrollBtn = screen.getByRole("button", { name: /Finalize Enrollment/i });
    fireEvent.click(submitEnrollBtn);

    await waitFor(() => {
      expect(AdmissionsService.convertToEnrollment).toHaveBeenCalledWith("org-edu-1", "app-1", expect.any(Object));
    });
  });

  it("switches to Print Documents tab and loads printable letter", async () => {
    renderComponent();

    const printTab = screen.getByRole("button", { name: /^Print Documents$/i });
    fireEvent.click(printTab);

    await waitFor(() => {
      expect(screen.getByText(/Printable Admission Forms & Letters/i)).toBeInTheDocument();
    });

    const appButton = screen.getByRole("button", { name: /APP-2026-0001/i });
    fireEvent.click(appButton);

    await waitFor(() => {
      expect(AdmissionsService.getPrintDocument).toHaveBeenCalledWith("org-edu-1", "app-1");
      expect(screen.getByText(/Official Admission Offer Letter/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Print Document$/i })).toBeInTheDocument();
    });
  });

  it("switches to Reports & Exports tab", async () => {
    renderComponent();

    const reportsTab = screen.getByRole("button", { name: /Reports & Exports/i });
    fireEvent.click(reportsTab);

    await waitFor(() => {
      expect(screen.getByText(/Admissions & Enrollment Reports/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Export CSV/i })).toBeInTheDocument();
    });
  });
});
