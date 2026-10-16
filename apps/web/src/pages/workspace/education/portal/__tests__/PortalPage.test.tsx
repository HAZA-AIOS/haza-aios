import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AuthContext } from "@/auth/AuthProvider";
import { OrgContext } from "@/org/OrgContext";
import { ParentPortalPage, StudentSelfServicePortalPage } from "../PortalPage";
import { PortalService } from "@/modules/education/sis/portal.service";
import { CommunicationService } from "@/modules/education/sis/communication.service";

vi.mock("@/modules/education/sis/portal.service");
vi.mock("@/modules/education/sis/communication.service");
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

const mockParentUser = {
  id: "parent-user-1",
  firstName: "Sara",
  lastName: "Khan",
  displayName: "Sara Khan",
  email: "sara@test.com",
  emailVerified: true,
  status: "active" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockStudentUser = {
  id: "student-user-1",
  firstName: "Aisha",
  lastName: "Khan",
  displayName: "Aisha Khan",
  email: "aisha@test.com",
  emailVerified: true,
  status: "active" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAuthValue = (user: typeof mockParentUser) => ({
  status: "authenticated" as const,
  user,
  session: null,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  forgotPassword: async () => {},
  resetPassword: async () => {},
  verifyEmail: async () => {},
  clearError: () => {},
});

const mockOrg = {
  id: "org-test-portal",
  name: "Al-Haza International School",
  legalName: "Al-Haza School LLC",
  slug: "al-haza",
  industry: "Education",
  organizationType: "School",
  email: "info@alhaza.edu",
  country: "United States",
  timezone: "UTC",
  currency: "USD",
  status: "active" as const,
  ownerId: "owner-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockOrgValue = {
  currentOrganization: mockOrg,
  organizations: [mockOrg],
  currentMembership: {
    id: "mem-1",
    organizationId: mockOrg.id,
    userId: mockParentUser.id,
    role: "Member" as const,
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

const sampleStudentSummary = {
  id: "student-1",
  displayName: "Aisha Khan",
  admissionNumber: "ADM-1001",
  status: "active" as const,
  gradeName: "Grade 6",
  sectionName: "A",
  academicYear: "2026-2027",
};

const sampleStudent2Summary = {
  id: "student-2",
  displayName: "Bilal Khan",
  admissionNumber: "ADM-1002",
  status: "active" as const,
  gradeName: "Grade 4",
  sectionName: "B",
  academicYear: "2026-2027",
};

const sampleStudentDashboard = {
  student: sampleStudentSummary,
  attendance: {
    totalSessions: 10,
    present: 9,
    absent: 1,
    late: 0,
    excused: 0,
    attendancePercentage: 90,
  },
  attendanceHistory: [
    {
      session: {
        id: "sess-1",
        organizationId: mockOrg.id,
        academicYearId: "ay-1",
        date: "2026-09-01",
        gradeId: "g-1",
        sectionId: "s-1",
        sessionType: "daily",
        status: "completed",
        markedBy: "teacher",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      record: {
        id: "rec-1",
        organizationId: mockOrg.id,
        sessionId: "sess-1",
        studentId: "student-1",
        status: "present" as const,
        note: "On time",
        markedAt: new Date().toISOString(),
        markedBy: "teacher",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  ],
  timetable: [
    {
      id: "tt-1",
      dayOfWeek: 1,
      periodName: "Period 1",
      startTime: "08:00",
      endTime: "08:45",
      subjectName: "Mathematics",
      teacherName: "Nadia Rahman",
      roomId: "Room 101",
    },
  ],
  results: [
    {
      id: "res-1",
      sourceType: "examination" as const,
      sourceName: "Mid Term Exam",
      subjectName: "Mathematics",
      maximumMarks: 100,
      obtainedMarks: 92,
      percentage: 92,
      grade: "A",
      passed: true,
      remarks: "Excellent",
    },
  ],
  assessments: [],
  finance: {
    visible: true,
    providerConfigured: false,
    outstandingCents: 15000,
    overdueCents: 0,
    invoices: [
      {
        id: "inv-1",
        organizationId: mockOrg.id,
        studentId: "student-1",
        enrollmentId: "enr-1",
        academicYearId: "ay-1",
        invoiceNumber: "INV-2026-001",
        issueDate: "2026-08-01",
        dueDate: "2026-08-31",
        currency: "USD",
        status: "issued" as const,
        totalCents: 15000,
        paidAmountCents: 0,
        balanceCents: 15000,
        feeStructureIds: ["fs-1"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    payments: [],
    receipts: [],
  },
  communication: {
    announcements: [
      {
        id: "ann-1",
        organizationId: mockOrg.id,
        title: "Welcome Assembly",
        content: "School reopens Monday.",
        priority: "normal" as const,
        status: "published" as const,
        authorId: "admin-1",
        audience: { type: "organization" as const },
        recipientCount: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    notifications: [
      {
        id: "notif-1",
        organizationId: mockOrg.id,
        recipientKind: "guardian" as const,
        recipientId: "guardian-1",
        type: "announcement.published",
        title: "Term Calendar Available",
        message: "Please check term calendar.",
        priority: "normal" as const,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ],
    unreadNotifications: 1,
    messages: [],
  },
};

describe("ParentPortalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PortalService.getParentDashboard).mockResolvedValue({
      userId: mockParentUser.id,
      linkedStudents: [sampleStudentSummary, sampleStudent2Summary],
      selectedStudent: sampleStudentDashboard,
      totalUnreadNotifications: 1,
    });
    vi.mocked(PortalService.getUpdateRequests).mockResolvedValue([]);
  });

  it("renders parent portal with child selector and overview cards", async () => {
    render(
      <AuthContext.Provider value={mockAuthValue(mockParentUser)}>
        <OrgContext.Provider value={mockOrgValue}>
          <ParentPortalPage />
        </OrgContext.Provider>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Parent Portal" })).toBeInTheDocument();
      expect(screen.getAllByText("Aisha Khan").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Bilal Khan")).toBeInTheDocument();
      expect(screen.getByText("Attendance Rate")).toBeInTheDocument();
    });
  });

  it("switches tabs to Attendance and renders date filters", async () => {
    render(
      <AuthContext.Provider value={mockAuthValue(mockParentUser)}>
        <OrgContext.Provider value={mockOrgValue}>
          <ParentPortalPage />
        </OrgContext.Provider>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Attendance")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Attendance"));

    await waitFor(() => {
      expect(screen.getByText("Attendance History")).toBeInTheDocument();
      expect(screen.getByText("All Statuses")).toBeInTheDocument();
    });
  });

  it("switches tabs to Results and displays published examinations", async () => {
    render(
      <AuthContext.Provider value={mockAuthValue(mockParentUser)}>
        <OrgContext.Provider value={mockOrgValue}>
          <ParentPortalPage />
        </OrgContext.Provider>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText("Results")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Results"));

    await waitFor(() => {
      expect(screen.getByText("Published Examination Results")).toBeInTheDocument();
      expect(screen.getByText("Mathematics")).toBeInTheDocument();
      expect(screen.getByText(/Mid Term Exam/)).toBeInTheDocument();
      expect(screen.getByText(/92 \/ 100/)).toBeInTheDocument();
    });
  });

  it("switches to Notifications and marks an unread notification read", async () => {
    vi.mocked(CommunicationService.markNotificationRead).mockResolvedValue({
      id: "notif-1",
      organizationId: mockOrg.id,
      recipientKind: "guardian",
      recipientId: "guardian-1",
      type: "announcement.published",
      title: "Term Calendar Available",
      message: "Please check term calendar.",
      priority: "normal",
      isRead: true,
      createdAt: new Date().toISOString(),
    });

    render(
      <AuthContext.Provider value={mockAuthValue(mockParentUser)}>
        <OrgContext.Provider value={mockOrgValue}>
          <ParentPortalPage />
        </OrgContext.Provider>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Notifications/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));

    await waitFor(() => {
      expect(screen.getByText("Term Calendar Available")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Mark Read" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark Read" }));

    await waitFor(() => {
      expect(CommunicationService.markNotificationRead).toHaveBeenCalledWith(
        mockOrg.id,
        "notif-1",
        expect.anything()
      );
    });
  });
});

describe("StudentPortalPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides fees tab when finance visibility is disabled for student", async () => {
    vi.mocked(PortalService.getStudentDashboard).mockResolvedValue({
      userId: mockStudentUser.id,
      ...sampleStudentDashboard,
      finance: {
        visible: false,
        providerConfigured: false,
        outstandingCents: 0,
        overdueCents: 0,
        invoices: [],
        payments: [],
        receipts: [],
      },
    });
    vi.mocked(PortalService.getUpdateRequests).mockResolvedValue([]);

    render(
      <AuthContext.Provider value={mockAuthValue(mockStudentUser)}>
        <OrgContext.Provider value={mockOrgValue}>
          <StudentSelfServicePortalPage />
        </OrgContext.Provider>
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Student Portal" })).toBeInTheDocument();
      expect(screen.getByText("Aisha Khan")).toBeInTheDocument();
    });

    // Fees tab should not exist in buttons
    expect(screen.queryByRole("button", { name: "Fees" })).toBeNull();
  });
});
