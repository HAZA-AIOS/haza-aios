import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { AuthContext } from "@/auth/AuthProvider";
import { OrgContext } from "@/org/OrgContext";
import { MarksEntryPage } from "../MarksEntryPage";
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
      React.createElement(OrgContext.Provider, { value: orgContextValue }, React.createElement(MarksEntryPage))
    )
  );
}

describe("MarksEntryPage / Gradebook Integration", () => {
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
      { id: "exam-1", organizationId: "org-1", name: "Mid-Term Examination", academicYearId: "year-1", type: "mid_term", startDate: "2026-03-01", endDate: "2026-03-10", status: "scheduled", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getExaminationSubjects).mockResolvedValue([
      { id: "exam-subj-1", organizationId: "org-1", examinationId: "exam-1", gradeId: "grade-1", sectionId: "section-1", subjectId: "subject-1", maximumMarks: 100, passingMarks: 40, weightage: 100, status: "scheduled", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getAssessments).mockResolvedValue([]);
    vi.mocked(ExaminationService.getGradingRules).mockResolvedValue([
      { id: "rule-1", organizationId: "org-1", grade: "A", minPercentage: 80, maxPercentage: 100, gradePoint: 4.0, createdAt: "now", updatedAt: "now" },
      { id: "rule-2", organizationId: "org-1", grade: "B", minPercentage: 60, maxPercentage: 79.99, gradePoint: 3.0, createdAt: "now", updatedAt: "now" },
      { id: "rule-3", organizationId: "org-1", grade: "F", minPercentage: 0, maxPercentage: 59.99, gradePoint: 0.0, createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getMarks).mockResolvedValue([]);
    vi.mocked(ExaminationService.getResultPublications).mockResolvedValue([]);
    vi.mocked(ExaminationService.getResultCorrections).mockResolvedValue([]);
    vi.mocked(EnrollmentService.getEnrollments).mockResolvedValue([
      { id: "enr-1", organizationId: "org-1", studentId: "student-1", academicYear: "2026-2027", gradeId: "grade-1", sectionId: "section-1", enrollmentDate: "2026-01-15", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
  });

  it("renders Student Gradebook on the marks tab and loads roster", async () => {
    renderPage();
    expect(await screen.findByText("Student Gradebook")).toBeDefined();
    expect(await screen.findByText("Formal Examination")).toBeDefined();
    expect(await screen.findByText("Class Assessment")).toBeDefined();

    // Verify roster loads Brian May
    expect(await screen.findByText("Brian May")).toBeDefined();
    expect(await screen.findByText("ADM-101")).toBeDefined();
    expect(screen.getByText("Save Gradebook Marks")).toBeDefined();
  });

  it("validates obtained marks against maximum marks and computes grade", async () => {
    vi.mocked(ExaminationService.bulkEnterMarks).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("Brian May")).toBeDefined();
    const marksInput = screen.getByLabelText("Obtained marks for Brian May");

    // Enter valid mark (85/100) -> Grade A
    fireEvent.change(marksInput, { target: { value: "85" } });
    expect((await screen.findAllByText("85%")).length).toBeGreaterThan(0);
    expect(await screen.findByText("A")).toBeDefined();
    expect(await screen.findByText("Passed")).toBeDefined();

    // Enter mark exceeding maximum marks (105 > 100)
    fireEvent.change(marksInput, { target: { value: "105" } });
    expect(await screen.findByText("Cannot exceed maximum marks (100)")).toBeDefined();

    // Correct to 75 -> Grade B
    fireEvent.change(marksInput, { target: { value: "75" } });
    expect(screen.queryByText("Cannot exceed maximum marks (100)")).toBeNull();
    expect((await screen.findAllByText("75%")).length).toBeGreaterThan(0);
    expect(await screen.findByText("B")).toBeDefined();

    // Save marks
    const saveButton = screen.getByText("Save Gradebook Marks");
    fireEvent.click(saveButton);

    expect(await screen.findByText("Gradebook marks saved successfully.")).toBeDefined();
    expect(ExaminationService.bulkEnterMarks).toHaveBeenCalledWith(
      "org-1",
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "examination",
          studentId: "student-1",
          obtainedMarks: 75,
        }),
      ])
    );
  });
});
