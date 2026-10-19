import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

describe("Epic 10L: Examination & Result Management Enhancement", () => {
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
      { id: "subject-2", organizationId: "org-1", name: "English Language", code: "ENG", status: "active", displayOrder: 2, createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(StudentService.getStudents).mockResolvedValue([
      { id: "student-1", organizationId: "org-1", admissionNumber: "ADM-101", firstName: "Brian", lastName: "May", dateOfBirth: "2010-02-15", gender: "male", admissionDate: "2026-01-15", status: "active", guardians: [], createdAt: "now", updatedAt: "now" },
      { id: "student-2", organizationId: "org-1", admissionNumber: "ADM-102", firstName: "Freddie", lastName: "Mercury", dateOfBirth: "2010-04-10", gender: "male", admissionDate: "2026-01-15", status: "active", guardians: [], createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(StaffService.getStaffList).mockResolvedValue([]);
    vi.mocked(ExaminationService.getExaminations).mockResolvedValue([
      { id: "exam-1", organizationId: "org-1", name: "Final Term Examinations 2026", academicYearId: "year-1", type: "final", startDate: "2026-06-01", endDate: "2026-06-15", status: "scheduled", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getExaminationSubjects).mockResolvedValue([
      { id: "exam-subj-1", organizationId: "org-1", examinationId: "exam-1", gradeId: "grade-1", sectionId: "section-1", subjectId: "subject-1", maximumMarks: 100, passingMarks: 40, weightage: 100, status: "scheduled", createdAt: "now", updatedAt: "now" },
      { id: "exam-subj-2", organizationId: "org-1", examinationId: "exam-1", gradeId: "grade-1", sectionId: "section-1", subjectId: "subject-2", maximumMarks: 100, passingMarks: 40, weightage: 100, status: "scheduled", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getAssessments).mockResolvedValue([]);
    vi.mocked(ExaminationService.getGradingRules).mockResolvedValue([
      { id: "rule-1", organizationId: "org-1", grade: "A*", minPercentage: 90, maxPercentage: 100, gradePoint: 4.0, createdAt: "now", updatedAt: "now" },
      { id: "rule-2", organizationId: "org-1", grade: "A", minPercentage: 80, maxPercentage: 89.99, gradePoint: 3.7, createdAt: "now", updatedAt: "now" },
      { id: "rule-3", organizationId: "org-1", grade: "B", minPercentage: 70, maxPercentage: 79.99, gradePoint: 3.0, createdAt: "now", updatedAt: "now" },
      { id: "rule-4", organizationId: "org-1", grade: "F", minPercentage: 0, maxPercentage: 39.99, gradePoint: 0.0, createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getMarks).mockResolvedValue([]);
    vi.mocked(EnrollmentService.getEnrollments).mockResolvedValue([
      { id: "enr-1", organizationId: "org-1", studentId: "student-1", academicYear: "2026-2027", gradeId: "grade-1", sectionId: "section-1", enrollmentDate: "2026-01-15", status: "active", createdAt: "now", updatedAt: "now" },
      { id: "enr-2", organizationId: "org-1", studentId: "student-2", academicYear: "2026-2027", gradeId: "grade-1", sectionId: "section-1", enrollmentDate: "2026-01-15", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getResultPublications).mockResolvedValue([
      {
        id: "pub-1",
        organizationId: "org-1",
        examinationId: "exam-1",
        gradeId: "grade-1",
        sectionId: "section-1",
        status: "in_progress",
        publishedAt: "2026-06-20T10:00:00Z",
        results: [
          {
            studentId: "student-2",
            studentName: "Freddie Mercury",
            admissionNumber: "ADM-102",
            maximumMarks: 200,
            obtainedMarks: 190,
            percentage: 95,
            grade: "A*",
            passed: true,
            position: 1,
            rankLabel: "1st",
            totalStudents: 2,
            subjects: [
              { subjectId: "subject-1", subjectName: "Mathematics", maximumMarks: 100, obtainedMarks: 95, percentage: 95, grade: "A*", passed: true },
              { subjectId: "subject-2", subjectName: "English Language", maximumMarks: 100, obtainedMarks: 95, percentage: 95, grade: "A*", passed: true },
            ],
          },
          {
            studentId: "student-1",
            studentName: "Brian May",
            admissionNumber: "ADM-101",
            maximumMarks: 200,
            obtainedMarks: 165,
            percentage: 82.5,
            grade: "A",
            passed: true,
            position: 2,
            rankLabel: "2nd",
            totalStudents: 2,
            subjects: [
              { subjectId: "subject-1", subjectName: "Mathematics", maximumMarks: 100, obtainedMarks: 85, percentage: 85, grade: "A", passed: true },
              { subjectId: "subject-2", subjectName: "English Language", maximumMarks: 100, obtainedMarks: 80, percentage: 80, grade: "A", passed: true },
            ],
          },
        ],
        createdAt: "now",
        updatedAt: "now",
      },
    ]);
    vi.mocked(ExaminationService.getResultCorrections).mockResolvedValue([
      {
        id: "corr-1",
        examinationId: "exam-1",
        gradeId: "grade-1",
        sectionId: "section-1",
        studentId: "student-1",
        subjectId: "subject-1",
        oldMarks: 85,
        newMarks: 92,
        reason: "Score recount verified on exam paper Q3",
        status: "pending",
        requestedBy: "teacher-1",
        requestedAt: "2026-06-21T09:00:00Z",
        createdAt: "2026-06-21T09:00:00Z",
        updatedAt: "2026-06-21T09:00:00Z",
      },
    ]);
  });

  it("renders all 7 tabs including result cards, corrections, and reports", async () => {
    renderPage("examinations");
    expect(await screen.findByText("Examinations & Schedule")).toBeDefined();
    expect(await screen.findByText("Assessments")).toBeDefined();
    expect(await screen.findByText("Gradebook & Marks")).toBeDefined();
    expect(await screen.findByText("Calculation & Approval")).toBeDefined();
    expect(await screen.findByText("Result Corrections")).toBeDefined();
    expect(await screen.findByText("Printable Result Cards")).toBeDefined();
    expect(await screen.findByText("Reports & Registers")).toBeDefined();
  });

  it("displays Results tab with class positions and approval actions", async () => {
    vi.mocked(ExaminationService.calculateClassResults).mockResolvedValue([
      {
        studentId: "student-2",
        studentName: "Freddie Mercury",
        admissionNumber: "ADM-102",
        maximumMarks: 200,
        obtainedMarks: 190,
        percentage: 95,
        grade: "A*",
        passed: true,
        position: 1,
        rankLabel: "1st",
        totalStudents: 2,
        subjects: [],
      },
      {
        studentId: "student-1",
        studentName: "Brian May",
        admissionNumber: "ADM-101",
        maximumMarks: 200,
        obtainedMarks: 165,
        percentage: 82.5,
        grade: "A",
        passed: true,
        position: 2,
        rankLabel: "2nd",
        totalStudents: 2,
        subjects: [],
      },
    ]);

    renderPage("results");
    expect(await screen.findByText("Result Calculation & Controlled Approval")).toBeDefined();
    expect(await screen.findByText("Calculate Results")).toBeDefined();
    expect(await screen.findByText("Approve Results")).toBeDefined();
    expect(await screen.findByText("Reject / Request Corrections")).toBeDefined();
  });

  it("renders Published Result Corrections tab and lists pending requests", async () => {
    renderPage("corrections");
    expect(await screen.findByText("Controlled Result Corrections")).toBeDefined();
    expect(await screen.findByText("Score recount verified on exam paper Q3")).toBeDefined();
    expect(await screen.findByText("Approve")).toBeDefined();
    expect(await screen.findByText("Reject")).toBeDefined();
    expect(await screen.findByText("Request Result Correction")).toBeDefined();
  });

  it("renders Result Cards tab with Single and Batch printing controls", async () => {
    renderPage("cards");
    expect(await screen.findByText("Printable Student Result Cards (A4)")).toBeDefined();
    expect(await screen.findByText("Print Result Card(s)")).toBeDefined();
    expect(await screen.findByText("Generate Result Card Preview")).toBeDefined();
  });

  it("renders Reports tab with Result Register, Missing Marks, and Report generation", async () => {
    renderPage("reports");
    expect(await screen.findByText("Examination Performance Reports")).toBeDefined();
    expect(await screen.findByText("Full Result Register")).toBeDefined();
    expect(await screen.findByText("Missing Marks Report")).toBeDefined();
    expect(await screen.findByText("Generate Report")).toBeDefined();
  });

  it("saves marks for All Sections examination subject, confirms persistence, and displays success", async () => {
    vi.mocked(ExaminationService.getExaminationSubjects).mockResolvedValue([
      {
        id: "exam-subj-all",
        organizationId: "org-1",
        examinationId: "exam-1",
        gradeId: "grade-1",
        sectionId: undefined, // All Sections
        subjectId: "subject-1",
        maximumMarks: 100,
        passingMarks: 40,
        weightage: 100,
        status: "scheduled",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);

    vi.mocked(ExaminationService.bulkEnterMarks).mockResolvedValue([
      {
        id: "mark-rec-1",
        organizationId: "org-1",
        sourceType: "examination",
        sourceId: "exam-1",
        examinationSubjectId: "exam-subj-all",
        academicYearId: "year-1",
        gradeId: "grade-1",
        sectionId: "section-1",
        subjectId: "subject-1",
        studentId: "student-1",
        maximumMarks: 100,
        obtainedMarks: 78,
        percentage: 78,
        grade: "B",
        enteredBy: "staff-user",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);

    renderPage("marks");

    // Wait for student roster to load
    expect(await screen.findByText("Student Marks Entry Roster")).toBeDefined();
    expect(await screen.findByText("Brian May")).toBeDefined();

    // Find the mark input for Brian May and enter 78
    const markInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(markInputs[0], { target: { value: "78" } });

    // Expect unsaved changes indicator
    expect(screen.getByText("Unsaved changes")).toBeDefined();

    // Click Save Gradebook Marks
    const saveButton = screen.getByRole("button", { name: /Save Gradebook Marks/i });
    fireEvent.click(saveButton);

    // Verify bulkEnterMarks was called with expected payload
    expect(ExaminationService.bulkEnterMarks).toHaveBeenCalledWith(
      "org-1",
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "examination",
          sourceId: "exam-1",
          examinationSubjectId: "exam-subj-all",
          studentId: "student-1",
          obtainedMarks: 78,
          isAbsent: false,
          isExempt: false,
        }),
      ])
    );

    // Verify confirmation message
    expect(await screen.findByText("Gradebook marks saved successfully.")).toBeDefined();
  });

  it("preserves unsaved marks in state when save fails and displays actionable error", async () => {
    vi.mocked(ExaminationService.getExaminationSubjects).mockResolvedValue([
      {
        id: "exam-subj-all",
        organizationId: "org-1",
        examinationId: "exam-1",
        gradeId: "grade-1",
        sectionId: undefined,
        subjectId: "subject-1",
        maximumMarks: 100,
        passingMarks: 40,
        weightage: 100,
        status: "scheduled",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);

    vi.mocked(ExaminationService.bulkEnterMarks).mockRejectedValueOnce(
      new Error("Internal server error")
    );

    renderPage("marks");

    expect(await screen.findByText("Brian May")).toBeDefined();
    const markInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(markInputs[0], { target: { value: "78" } });

    const saveButton = screen.getByRole("button", { name: /Save Gradebook Marks/i });
    fireEvent.click(saveButton);

    // Verify actionable message displayed without exposing raw 500 details
    expect(
      await screen.findByText("An unexpected error occurred while saving marks. Please check your entries and try again.")
    ).toBeDefined();

    // Verify input value was preserved
    expect((markInputs[0] as HTMLInputElement).value).toBe("78");
    // Verify unsaved changes indicator is still visible
    expect(screen.getByText("Unsaved changes")).toBeDefined();
  });

  it("distinguishes save success from post-save refresh failure", async () => {
    vi.mocked(ExaminationService.getExaminationSubjects).mockResolvedValue([
      {
        id: "exam-subj-all",
        organizationId: "org-1",
        examinationId: "exam-1",
        gradeId: "grade-1",
        sectionId: undefined,
        subjectId: "subject-1",
        maximumMarks: 100,
        passingMarks: 40,
        weightage: 100,
        status: "scheduled",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);

    vi.mocked(ExaminationService.bulkEnterMarks).mockResolvedValueOnce([
      {
        id: "mark-rec-1",
        organizationId: "org-1",
        sourceType: "examination",
        sourceId: "exam-1",
        examinationSubjectId: "exam-subj-all",
        academicYearId: "year-1",
        gradeId: "grade-1",
        sectionId: "section-1",
        subjectId: "subject-1",
        studentId: "student-1",
        maximumMarks: 100,
        obtainedMarks: 78,
        percentage: 78,
        enteredBy: "staff-user",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);

    renderPage("marks");

    expect(await screen.findByText("Brian May")).toBeDefined();
    const markInputs = screen.getAllByRole("spinbutton");
    fireEvent.change(markInputs[0], { target: { value: "78" } });

    // Force post-save loadData refresh to fail
    vi.mocked(StudentService.getStudents).mockRejectedValueOnce(new Error("Network timeout during reload"));

    const saveButton = screen.getByRole("button", { name: /Save Gradebook Marks/i });
    fireEvent.click(saveButton);

    // Verify specific refresh error is shown
    expect(
      await screen.findByText("Marks were saved successfully, but refreshing the roster failed. Please reload the page.")
    ).toBeDefined();
  });

  it("handles Absent and Exempt student statuses properly in gradebook save", async () => {
    vi.mocked(ExaminationService.bulkEnterMarks).mockResolvedValueOnce([
      {
        id: "mark-rec-abs",
        organizationId: "org-1",
        sourceType: "examination",
        sourceId: "exam-1",
        examinationSubjectId: "exam-subj-1",
        academicYearId: "year-1",
        gradeId: "grade-1",
        sectionId: "section-1",
        subjectId: "subject-1",
        studentId: "student-1",
        maximumMarks: 100,
        obtainedMarks: 0,
        percentage: 0,
        grade: "ABS",
        isAbsent: true,
        enteredBy: "staff-user",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);

    renderPage("marks");

    expect(await screen.findByText("Brian May")).toBeDefined();

    // Select the attendance/status dropdown for student 1
    const statusSelects = screen.getAllByRole("combobox");
    // Find the one with value "present"
    const studentStatusSelect = statusSelects.find((s) => (s as HTMLSelectElement).value === "present");
    expect(studentStatusSelect).toBeDefined();

    fireEvent.change(studentStatusSelect!, { target: { value: "absent" } });

    const saveButton = screen.getByRole("button", { name: /Save Gradebook Marks/i });
    fireEvent.click(saveButton);

    expect(ExaminationService.bulkEnterMarks).toHaveBeenCalledWith(
      "org-1",
      expect.arrayContaining([
        expect.objectContaining({
          studentId: "student-1",
          isAbsent: true,
          isExempt: false,
          obtainedMarks: 0,
        }),
      ])
    );
  });

  it("supports Class Assessment marks entry for Reception 1 / Starters, loads active student roster, and saves marks", async () => {
    vi.mocked(AcademicService.getGrades).mockResolvedValue([
      { id: "grade-rec-1", organizationId: "org-1", name: "Reception 1", level: 0, order: 0, status: "active", createdAt: "now", updatedAt: "now" },
      { id: "grade-1", organizationId: "org-1", name: "Grade 10", level: 10, order: 10, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getSections).mockResolvedValue([
      { id: "sec-starters", organizationId: "org-1", gradeId: "grade-rec-1", name: "Starters", capacity: 25, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(StudentService.getStudents).mockResolvedValue([
      { id: "student-starter-1", organizationId: "org-1", admissionNumber: "REC-001", firstName: "Alice", lastName: "Wonder", dateOfBirth: "2021-05-10", gender: "female", admissionDate: "2026-01-10", status: "active", guardians: [], createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(EnrollmentService.getEnrollments).mockResolvedValue([
      { id: "enr-rec-1", organizationId: "org-1", studentId: "student-starter-1", academicYear: "2026-2027", gradeId: "grade-rec-1", sectionId: "sec-starters", enrollmentDate: "2026-01-10", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getAssessments).mockResolvedValue([
      {
        id: "assess-1",
        organizationId: "org-1",
        title: "Starters Phonics Quiz",
        academicYearId: "year-1",
        gradeId: "grade-rec-1",
        sectionId: "sec-starters",
        subjectId: "subject-2",
        teacherId: "teacher-1",
        type: "class_test",
        maximumMarks: 20,
        passingMarks: 8,
        weightage: 10,
        assessmentDate: "2026-03-01",
        status: "draft",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);
    vi.mocked(ExaminationService.bulkEnterMarks).mockResolvedValue([]);

    renderPage("marks");

    // Switch to Class Assessment
    const classAssessmentBtn = await screen.findByRole("button", { name: "Class Assessment" });
    fireEvent.click(classAssessmentBtn);

    // Select Reception 1
    const classSelect = screen.getByDisplayValue("Grade 10");
    fireEvent.change(classSelect, { target: { value: "grade-rec-1" } });

    // Select Starters section
    const sectionSelect = await screen.findByDisplayValue("Select Section");
    fireEvent.change(sectionSelect, { target: { value: "sec-starters" } });

    // Verify student roster loaded Alice Wonder for Reception 1 / Starters
    expect(await screen.findByText("Alice Wonder")).toBeDefined();
    expect(await screen.findByText("REC-001")).toBeDefined();

    // Verify Starters Phonics Quiz is auto-selected
    const assessmentMatches = await screen.findAllByText(/Starters Phonics Quiz/);
    expect(assessmentMatches.length).toBeGreaterThan(0);

    // Verify max marks & passing marks bound from assessment
    const maxMarksMatches = await screen.findAllByText(/Max Marks:/);
    expect(maxMarksMatches.length).toBeGreaterThan(0);

    // Enter marks: 18 / 20
    const marksInput = screen.getByLabelText("Obtained marks for Alice Wonder");
    fireEvent.change(marksInput, { target: { value: "18" } });

    // Save marks
    const saveButton = screen.getByRole("button", { name: /Save Gradebook Marks/i });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(saveButton);

    expect(ExaminationService.bulkEnterMarks).toHaveBeenCalledWith(
      "org-1",
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "assessment",
          sourceId: "assess-1",
          studentId: "student-starter-1",
          obtainedMarks: 18,
          isAbsent: false,
          isExempt: false,
        }),
      ])
    );
  });

  it("displays actionable empty state when no assessments exist for selected class/section and allows creating assessment", async () => {
    vi.mocked(AcademicService.getGrades).mockResolvedValue([
      { id: "grade-rec-1", organizationId: "org-1", name: "Reception 1", level: 0, order: 0, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(AcademicService.getSections).mockResolvedValue([
      { id: "sec-starters", organizationId: "org-1", gradeId: "grade-rec-1", name: "Starters", capacity: 25, status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(StudentService.getStudents).mockResolvedValue([
      { id: "student-starter-1", organizationId: "org-1", admissionNumber: "REC-001", firstName: "Alice", lastName: "Wonder", dateOfBirth: "2021-05-10", gender: "female", admissionDate: "2026-01-10", status: "active", guardians: [], createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(EnrollmentService.getEnrollments).mockResolvedValue([
      { id: "enr-rec-1", organizationId: "org-1", studentId: "student-starter-1", academicYear: "2026-2027", gradeId: "grade-rec-1", sectionId: "sec-starters", enrollmentDate: "2026-01-10", status: "active", createdAt: "now", updatedAt: "now" },
    ]);
    vi.mocked(ExaminationService.getAssessments).mockResolvedValue([]);

    renderPage("marks");

    // Switch to Class Assessment
    const classAssessmentBtn = await screen.findByRole("button", { name: "Class Assessment" });
    fireEvent.click(classAssessmentBtn);

    // Select Reception 1
    const classSelect = screen.getByDisplayValue("Select Class");
    fireEvent.change(classSelect, { target: { value: "grade-rec-1" } });

    // Select Starters
    const sectionSelect = await screen.findByDisplayValue("Select Section");
    fireEvent.change(sectionSelect, { target: { value: "sec-starters" } });

    // Active roster should still be loaded immediately
    expect(await screen.findByText("Alice Wonder")).toBeDefined();

    // Verify actionable alert and button to create assessment
    expect(await screen.findByText(/No assessments found for Reception 1/)).toBeDefined();
    const createBtn = screen.getByRole("button", { name: /Create Assessment/i });
    expect(createBtn).toBeDefined();

    // Click Create Assessment to open modal
    fireEvent.click(createBtn);
    expect(await screen.findByText("Create Class Assessment")).toBeDefined();
  });

  it("renders Tab 2 Assessment Register table, filters assessments, and enables direct navigation to Gradebook", async () => {
    vi.mocked(ExaminationService.getAssessments).mockResolvedValue([
      {
        id: "assess-monthly-1",
        organizationId: "org-1",
        title: "Monthly",
        academicYearId: "year-1",
        gradeId: "grade-1",
        sectionId: "section-1",
        subjectId: "subject-1",
        teacherId: "teacher-1",
        type: "class_test",
        maximumMarks: 20,
        passingMarks: 12,
        weightage: 15,
        assessmentDate: "2026-10-18",
        status: "draft",
        createdAt: "now",
        updatedAt: "now",
      },
    ]);

    renderPage("assessments");

    // Verify Tab 2 title and Assessment Register table rendered
    expect(await screen.findByText("Class Assessments & Continuous Evaluation")).toBeDefined();
    expect(await screen.findByText("Assessment Register (1)")).toBeDefined();

    // Verify Monthly assessment row data rendered
    const titleElements = await screen.findAllByText("Monthly");
    expect(titleElements.length).toBeGreaterThan(0);
    expect(await screen.findByText(/Grade 10 — Section A/)).toBeDefined();
    const mathMatches = await screen.findAllByText("Mathematics");
    expect(mathMatches.length).toBeGreaterThan(0);
    const maxMarksMatches = await screen.findAllByText("20");
    expect(maxMarksMatches.length).toBeGreaterThan(0);
    const passingMarksMatches = await screen.findAllByText("12");
    expect(passingMarksMatches.length).toBeGreaterThan(0);

    // Click "Enter Marks" action button to jump directly into Gradebook for this assessment
    const enterMarksButtons = await screen.findAllByRole("button", { name: /Enter Marks/i });
    expect(enterMarksButtons.length).toBeGreaterThan(0);
    fireEvent.click(enterMarksButtons[0]);

    // Verify Gradebook header is visible and active
    expect(await screen.findByText("Student Gradebook")).toBeDefined();
  });

  it("creates class assessment from modal, updates local state, and synchronizes Gradebook filters", async () => {
    const createdAssessment = {
      id: "assess-created-1",
      organizationId: "org-1",
      title: "Monthly",
      academicYearId: "year-1",
      gradeId: "grade-1",
      sectionId: "section-1",
      subjectId: "subject-1",
      teacherId: "teacher-1",
      type: "class_test" as const,
      maximumMarks: 20,
      passingMarks: 12,
      weightage: 10,
      assessmentDate: "2026-10-18",
      status: "draft" as const,
      createdAt: "now",
      updatedAt: "now",
    };
    vi.mocked(ExaminationService.createAssessment).mockResolvedValue(createdAssessment);
    vi.mocked(StaffService.getStaffList).mockResolvedValue([
      { id: "teacher-1", organizationId: "org-1", firstName: "Sarah", lastName: "Teacher", staffType: "teacher", email: "teacher@test.edu", status: "active", hireDate: "2026-01-01", employmentStatus: "full_time", createdAt: "now", updatedAt: "now" },
    ]);

    renderPage("marks");

    // Switch to Class Assessment
    const classAssessmentBtn = await screen.findByRole("button", { name: "Class Assessment" });
    fireEvent.click(classAssessmentBtn);

    // Open Create Assessment modal
    const openModalBtn = screen.getByRole("button", { name: /Create Assessment/i });
    fireEvent.click(openModalBtn);

    // Verify modal open
    expect(await screen.findByText("Create Class Assessment")).toBeDefined();

    // Fill title
    const titleInput = screen.getByPlaceholderText("e.g. Starters Phonics Quiz");
    fireEvent.change(titleInput, { target: { value: "Monthly" } });

    // Submit modal form
    const submitBtn = screen.getByRole("button", { name: /Create & Select Assessment/i });
    fireEvent.click(submitBtn);

    // Verify createAssessment API called with required parameters
    expect(ExaminationService.createAssessment).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({
        title: "Monthly",
      })
    );
  });
});
