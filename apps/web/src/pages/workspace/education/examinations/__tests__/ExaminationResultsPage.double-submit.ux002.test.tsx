import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AuthContext } from "@/auth/AuthProvider";
import { OrgContext } from "@/org/OrgContext";
import { ExaminationResultsPage } from "../ExaminationResultsPage";
import { AcademicService } from "@/modules/education/sis/academic.service";
import { ExaminationService } from "@/modules/education/sis/examination.service";
import { EnrollmentService } from "@/modules/education/sis/enrollment.service";
import { StudentService } from "@/modules/education/sis/student.service";
import { StaffService } from "@/modules/education/sis/staff.service";

vi.mock("@/modules/education/sis/academic.service");
vi.mock("@/modules/education/sis/examination.service");
vi.mock("@/modules/education/sis/enrollment.service");
vi.mock("@/modules/education/sis/student.service");
vi.mock("@/modules/education/sis/staff.service");

const mockUser = {
  id: "user-admin-1",
  firstName: "Headmaster",
  lastName: "Admin",
  displayName: "Headmaster Admin",
  email: "admin@test.edu",
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
  name: "Oakridge International",
  legalName: "Oakridge International Ltd",
  slug: "oakridge",
  industry: "Education",
  organizationType: "School",
  email: "office@oakridge.edu",
  country: "United States",
  timezone: "America/New_York",
  currency: "USD",
  status: "active" as const,
  ownerId: "user-admin-1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockMembership = {
  id: "membership-admin-1",
  organizationId: "org-1",
  userId: "user-admin-1",
  role: "Admin" as const,
  status: "active" as const,
  joinedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function renderPage(initialTab?: "examinations" | "assessments" | "marks" | "results" | "corrections" | "cards" | "reports") {
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
      React.createElement(
        OrgContext.Provider,
        { value: orgContextValue },
        React.createElement(ExaminationResultsPage, { initialTab })
      )
    )
  );
}

describe("ExaminationResultsPage UX-002: Double-Submission Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(AcademicService.getAcademicYears).mockResolvedValue([
      { id: "year-1", organizationId: "org-1", name: "2026-2027", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getGrades).mockResolvedValue([
      { id: "grade-1", organizationId: "org-1", name: "Grade 10", level: 10, order: 10, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getSections).mockResolvedValue([
      { id: "section-1", organizationId: "org-1", gradeId: "grade-1", name: "Section A", capacity: 30, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getSubjects).mockResolvedValue([
      { id: "subject-1", organizationId: "org-1", name: "Mathematics", code: "MATH", status: "active", displayOrder: 1, createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(StudentService.getStudents).mockResolvedValue([
      { id: "student-1", organizationId: "org-1", admissionNumber: "ADM-101", firstName: "Brian", lastName: "May", dateOfBirth: "2010-02-15", gender: "male", admissionDate: "2026-01-15", status: "active", guardians: [], createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(StaffService.getStaffList).mockResolvedValue([]);
    vi.mocked(ExaminationService.getExaminations).mockResolvedValue([
      { id: "exam-1", organizationId: "org-1", name: "Final Term Examinations 2026", academicYearId: "year-1", type: "final", startDate: "2026-06-01", endDate: "2026-06-15", status: "scheduled", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getExaminationSubjects).mockResolvedValue([
      { id: "exam-subj-1", organizationId: "org-1", examinationId: "exam-1", gradeId: "grade-1", sectionId: undefined, subjectId: "subject-1", maximumMarks: 100, passingMarks: 40, weightage: 100, status: "scheduled", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getAssessments).mockResolvedValue([]);
    vi.mocked(ExaminationService.getGradingRules).mockResolvedValue([]);
    vi.mocked(ExaminationService.getMarks).mockResolvedValue([]);
    vi.mocked(EnrollmentService.getEnrollments).mockResolvedValue([
      { id: "enr-1", organizationId: "org-1", studentId: "student-1", academicYear: "2026-2027", gradeId: "grade-1", sectionId: "section-1", enrollmentDate: "2026-01-15", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getResultPublications).mockResolvedValue([]);
    vi.mocked(ExaminationService.getResultCorrections).mockResolvedValue([]);
  });

  it("prevents duplicate marks save requests on rapid double-clicks and disables button", async () => {
    let resolveMarks: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveMarks = resolve;
    });

    vi.mocked(ExaminationService.bulkEnterMarks).mockImplementation(() => pendingPromise as any);

    renderPage("marks");

    // Wait for student roster
    expect(await screen.findByText("Student Marks Entry Roster")).toBeDefined();
    expect(await screen.findByText("Brian May")).toBeDefined();

    // Enter marks
    const markInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(markInputs[0], { target: { value: "88" } });

    // Find Save Gradebook Marks button
    const saveButton = screen.getByRole("button", { name: /Save Gradebook Marks/i });

    // Rapid double-click
    fireEvent.click(saveButton);
    fireEvent.click(saveButton);

    // bulkEnterMarks must be called exactly once
    expect(ExaminationService.bulkEnterMarks).toHaveBeenCalledTimes(1);

    // Button is disabled and indicates saving
    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/Saving\.\.\./i)).toBeDefined();

    // Resolve
    resolveMarks([
      {
        id: "mark-1",
        organizationId: "org-1",
        studentId: "student-1",
        obtainedMarks: 88,
        createdAt: "now",
        updatedAt: "now",
      },
    ]);

    await waitFor(() => {
      expect(screen.getByText(/Gradebook marks saved successfully\./i)).toBeDefined();
    });
  });

  it("restores controls and preserves entered marks when save fails", async () => {
    let rejectMarks: (err: any) => void = () => {};
    const pendingPromise = new Promise((_, reject) => {
      rejectMarks = reject;
    });

    vi.mocked(ExaminationService.bulkEnterMarks).mockImplementation(() => pendingPromise as any);

    renderPage("marks");

    expect(await screen.findByText("Student Marks Entry Roster")).toBeDefined();
    expect(await screen.findByText("Brian May")).toBeDefined();

    const markInputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    fireEvent.change(markInputs[0], { target: { value: "92" } });

    const saveButton = screen.getByRole("button", { name: /Save Gradebook Marks/i });
    fireEvent.click(saveButton);

    expect(saveButton).toBeDisabled();

    // Reject the operation
    rejectMarks(new Error("Server mark conflict error"));

    await waitFor(() => {
      // Button restored
      expect(saveButton).not.toBeDisabled();
      expect(screen.getByText(/Save Gradebook Marks/i)).toBeDefined();
    });

    // Mark value must be preserved in input
    expect(markInputs[0].value).toBe("92");
    expect(screen.getByText("Unsaved changes")).toBeDefined();
  });

  it("prevents duplicate examination creation on rapid double-clicks", async () => {
    let resolveCreateExam: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolveCreateExam = resolve;
    });

    vi.mocked(ExaminationService.createExamination).mockImplementation(() => pendingPromise as any);

    renderPage("examinations");

    expect(await screen.findByRole("heading", { name: "Create Examination" })).toBeDefined();

    // Fill form
    const nameInput = screen.getByPlaceholderText("Examination name");
    fireEvent.change(nameInput, { target: { value: "Mid-Term Examination 2026" } });

    const saveBtn = screen.getByRole("button", { name: "Create Examination" });

    // Rapid double click
    fireEvent.click(saveBtn);
    fireEvent.click(saveBtn);

    // Service called exactly once
    expect(ExaminationService.createExamination).toHaveBeenCalledTimes(1);
    expect(saveBtn).toBeDisabled();

    resolveCreateExam({
      id: "exam-new",
      organizationId: "org-1",
      name: "Mid-Term Examination 2026",
      academicYearId: "year-1",
      type: "midterm",
      startDate: "2026-07-01",
      endDate: "2026-07-10",
      status: "scheduled",
    });

    await waitFor(() => {
      expect(ExaminationService.getExaminations).toHaveBeenCalled();
    });
  });
});
