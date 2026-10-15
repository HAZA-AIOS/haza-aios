import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AuthContext } from "@/auth/AuthProvider";
import { OrgContext } from "@/org/OrgContext";
import { MarkAttendancePage } from "../MarkAttendancePage";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { AttendanceService } from "@/modules/education/sis/attendance.service";
import { EnrollmentService } from "@/modules/education/sis/enrollment.service";
import { StudentService } from "@/modules/education/sis/student.service";

vi.mock("@/modules/education/sis/academic.service");
vi.mock("@/modules/education/sis/attendance.service");
vi.mock("@/modules/education/sis/enrollment.service");
vi.mock("@/modules/education/sis/student.service");

const mockUser = {
  id: "user-1",
  firstName: "Teacher",
  lastName: "One",
  displayName: "Teacher One",
  email: "teacher@test.com",
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
  id: "org-1",
  name: "Test Academy",
  legalName: "Test Academy Inc.",
  slug: "test-academy",
  industry: "Education",
  organizationType: "School",
  email: "contact@test.edu",
  country: "United States",
  timezone: "America/New_York",
  currency: "USD",
  status: "active" as const,
  ownerId: "user-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMembership = {
  id: "membership-1",
  organizationId: "org-1",
  userId: "user-1",
  role: "Admin" as const,
  status: "active" as const,
  joinedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderPage() {
  const orgContextValue = {
    currentOrganization: mockOrg,
    currentMembership: mockMembership,
    organizations: [mockOrg],
    isLoading: false,
    error: null,
    createOrg: async () => ({ organization: {} as never, membership: {} as never }),
    switchOrg: async () => {},
    refresh: async () => {},
  };

  return render(
    React.createElement(
      AuthContext.Provider,
      { value: mockAuthContextValue },
      React.createElement(OrgContext.Provider, { value: orgContextValue }, React.createElement(MarkAttendancePage))
    )
  );
}

describe("MarkAttendancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(AcademicService.getAcademicYears).mockResolvedValue([
      { id: "year-1", organizationId: "org-1", name: "2026-2027", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getGrades).mockResolvedValue([
      { id: "grade-1", organizationId: "org-1", name: "Grade 5", level: 5, order: 5, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getSections).mockResolvedValue([
      { id: "section-1", organizationId: "org-1", gradeId: "grade-1", name: "Section A", capacity: 30, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AttendanceService.getSessions).mockResolvedValue([]);
    vi.mocked(EnrollmentService.getEnrollments).mockResolvedValue([
      { id: "enr-1", organizationId: "org-1", studentId: "student-1", academicYear: "2026-2027", gradeId: "grade-1", sectionId: "section-1", enrollmentDate: "2026-01-15", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(StudentService.getStudents).mockResolvedValue([
      { id: "student-1", organizationId: "org-1", admissionNumber: "ADM-001", firstName: "Alice", lastName: "Walker", dateOfBirth: "2015-05-10", gender: "female", admissionDate: "2026-01-15", status: "active", guardians: [], createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AttendanceService.getSessionRecords).mockResolvedValue([]);
  });

  it("renders page title and selection inputs", async () => {
    renderPage();
    expect(await screen.findByText("Mark Attendance")).toBeDefined();
    expect(await screen.findByLabelText("Academic Year")).toBeDefined();
    expect(await screen.findByLabelText("Class or Grade")).toBeDefined();
    expect(await screen.findByLabelText("Section")).toBeDefined();
  });

  it("loads enrolled student roster and handles attendance save", async () => {
    const mockCreatedSession = {
      id: "session-new",
      organizationId: "org-1",
      academicYearId: "year-1",
      date: new Date().toISOString().split("T")[0],
      gradeId: "grade-1",
      sectionId: "section-1",
      sessionType: "daily" as const,
      status: "draft" as const,
      createdAt: "now",
      updatedAt: "now",
    };

    vi.mocked(AttendanceService.createSession).mockResolvedValue(mockCreatedSession);
    vi.mocked(AttendanceService.saveAttendanceRecords).mockResolvedValue([
      {
        id: "rec-1",
        organizationId: "org-1",
        sessionId: "session-new",
        studentId: "student-1",
        status: "present",
        markedAt: "now",
        markedBy: "teacher@test.com",
        updatedAt: "now",
      },
    ]);

    renderPage();

    // Select class and section
    await waitFor(() => {
      expect(screen.getByLabelText("Class or Grade")).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText("Class or Grade"), { target: { value: "grade-1" } });
    fireEvent.change(screen.getByLabelText("Section"), { target: { value: "section-1" } });

    // Start session
    const startButton = screen.getByText("Start Session");
    fireEvent.click(startButton);

    // Verify student roster displays Alice Walker
    expect(await screen.findByText("Alice Walker")).toBeDefined();
    expect(await screen.findByText("ADM-001")).toBeDefined();

    // Check bulk mark buttons are present
    expect(screen.getByText("Mark All Present")).toBeDefined();
    expect(screen.getByText("Mark All Absent")).toBeDefined();
    expect(screen.getByText("Mark All Late")).toBeDefined();
    expect(screen.getByText("Mark All Excused")).toBeDefined();

    // Save attendance
    const saveButton = screen.getByText("Save Attendance");
    fireEvent.click(saveButton);

    expect(await screen.findByText("Attendance records saved successfully.")).toBeDefined();
    expect(AttendanceService.saveAttendanceRecords).toHaveBeenCalledWith(
      "org-1",
      "session-new",
      expect.arrayContaining([expect.objectContaining({ studentId: "student-1", status: "present" })]),
      expect.any(String)
    );
  });
});
