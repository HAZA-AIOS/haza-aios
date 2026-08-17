import { beforeEach, describe, expect, it } from "vitest";
import { AcademicService } from "../academic.service";
import { EnrollmentService } from "../enrollment.service";
import { ExaminationService } from "../examination.service";
import { StaffService } from "../staff.service";
import { StudentService } from "../student.service";
import type { AcademicYear, Examination, ExaminationSubject, Section, Staff, Student, Subject } from "../sis.types";

const owner = { userId: "owner-1", role: "Owner" as const };
const teacherActor = { userId: "teacher-1", role: "Teacher" as const };
const member = { userId: "member-1", role: "Member" as const };

async function seedExamContext(organizationId: string) {
  const year = await AcademicService.createAcademicYear(organizationId, {
    name: `2026-2027-${organizationId}`,
    startDate: "2026-08-01",
    endDate: "2027-07-31",
    status: "active",
  });

  const grade = await AcademicService.createGrade(organizationId, {
    name: "Grade 8",
    level: 8,
    order: 8,
    status: "active",
  });

  const section = await AcademicService.createSection(organizationId, {
    gradeId: grade.id,
    name: "A",
    capacity: 40,
    status: "active",
  });

  const subject = await AcademicService.createSubject(organizationId, {
    name: "Mathematics",
    code: `MATH-${organizationId}`,
    displayOrder: 1,
    status: "active",
  });

  const teacher = await StaffService.createStaff({
    organizationId,
    firstName: "Ada",
    lastName: "Lovelace",
    hireDate: "2026-08-01",
    staffType: "teacher",
    employmentStatus: "full_time",
    status: "active",
  });

  const students = await Promise.all([
    StudentService.createStudent({
      organizationId,
      firstName: "Sara",
      lastName: "Khan",
      dateOfBirth: "2012-04-01",
      gender: "female",
      admissionDate: "2026-08-01",
      status: "active",
      guardians: [],
    }),
    StudentService.createStudent({
      organizationId,
      firstName: "Ali",
      lastName: "Raza",
      dateOfBirth: "2012-06-10",
      gender: "male",
      admissionDate: "2026-08-01",
      status: "active",
      guardians: [],
    }),
  ]);

  await Promise.all(
    students.map((student) =>
      EnrollmentService.enrollStudent({
        organizationId,
        studentId: student.id,
        academicYear: year.name,
        gradeId: grade.id,
        sectionId: section.id,
        enrollmentDate: "2026-08-01",
        status: "active",
      }),
    ),
  );

  return { year, gradeId: grade.id, section, subject, teacher, students };
}

async function createExamWithSubject(
  organizationId: string,
  context?: Awaited<ReturnType<typeof seedExamContext>>,
): Promise<{
  year: AcademicYear;
  gradeId: string;
  section: Section;
  subject: Subject;
  teacher: Staff;
  students: Student[];
  exam: Examination;
  examSubject: ExaminationSubject;
}> {
  const seeded = context || await seedExamContext(organizationId);
  const exam = await ExaminationService.createExamination(organizationId, {
    name: "Mid Term 2026",
    academicYearId: seeded.year.id,
    type: "mid_term",
    startDate: "2026-10-01",
    endDate: "2026-10-10",
    status: "scheduled",
  }, owner);

  const examSubject = await ExaminationService.addExaminationSubject(organizationId, {
    examinationId: exam.id,
    gradeId: seeded.gradeId,
    sectionId: seeded.section.id,
    subjectId: seeded.subject.id,
    maximumMarks: 100,
    passingMarks: 40,
    status: "scheduled",
    examDate: "2026-10-02",
  }, owner);

  return { ...seeded, exam, examSubject };
}

describe("Epic 10F: Examination, Assessment & Results Management", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates examinations and keeps records isolated by organization", async () => {
    const context = await seedExamContext("org-exam-a");
    const exam = await ExaminationService.createExamination("org-exam-a", {
      name: "Annual Examination",
      academicYearId: context.year.id,
      type: "annual",
      startDate: "2027-03-01",
      endDate: "2027-03-20",
      status: "draft",
    }, owner);

    expect(exam.organizationId).toBe("org-exam-a");
    expect(await ExaminationService.getExaminations("org-exam-a")).toHaveLength(1);
    expect(await ExaminationService.getExaminations("org-exam-b")).toHaveLength(0);
  });

  it("rejects unauthorized exam management and validates exam subjects", async () => {
    const { exam, gradeId, section, subject } = await createExamWithSubject("org-permission");

    await expect(ExaminationService.createExamination("org-permission", {
      name: "Member Exam",
      academicYearId: exam.academicYearId,
      type: "monthly_test",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      status: "draft",
    }, member)).rejects.toThrow("Unauthorized");

    await expect(ExaminationService.addExaminationSubject("org-permission", {
      examinationId: exam.id,
      gradeId,
      sectionId: section.id,
      subjectId: subject.id,
      maximumMarks: 25,
      passingMarks: 30,
      status: "scheduled",
    }, owner)).rejects.toThrow("Passing marks");
  });

  it("creates assessments only for valid academic context and teachers", async () => {
    const { year, gradeId, section, subject, teacher } = await seedExamContext("org-assessment");

    const assessment = await ExaminationService.createAssessment("org-assessment", {
      title: "Chapter Quiz",
      academicYearId: year.id,
      gradeId,
      sectionId: section.id,
      subjectId: subject.id,
      teacherId: teacher.id,
      type: "quiz",
      maximumMarks: 20,
      passingMarks: 8,
      assessmentDate: "2026-09-15",
      status: "assigned",
    }, teacherActor);

    expect(assessment.title).toBe("Chapter Quiz");
    await expect(ExaminationService.createAssessment("org-assessment", {
      ...assessment,
      teacherId: "missing-teacher",
      title: "Invalid Quiz",
    }, owner)).rejects.toThrow("Teacher not found");
  });

  it("calculates grading rules at boundaries", async () => {
    await ExaminationService.getGradingRules("org-grades");

    expect(await ExaminationService.calculateGrade("org-grades", 80)).toMatchObject({ grade: "A" });
    expect(await ExaminationService.calculateGrade("org-grades", 79.99)).toMatchObject({ grade: "B" });
    expect(await ExaminationService.calculateGrade("org-grades", 49.99)).toMatchObject({ grade: "F" });
  });

  it("validates marks, enrollment, and duplicate updates without duplicate records", async () => {
    const { exam, examSubject, students } = await createExamWithSubject("org-marks");

    await expect(ExaminationService.enterMark("org-marks", {
      sourceType: "examination",
      sourceId: exam.id,
      examinationSubjectId: examSubject.id,
      studentId: students[0].id,
      obtainedMarks: 120,
      enteredBy: "teacher-1",
    }, teacherActor)).rejects.toThrow("exceed maximum");

    const mark = await ExaminationService.enterMark("org-marks", {
      sourceType: "examination",
      sourceId: exam.id,
      examinationSubjectId: examSubject.id,
      studentId: students[0].id,
      obtainedMarks: 76,
      enteredBy: "teacher-1",
    }, teacherActor);

    const updated = await ExaminationService.enterMark("org-marks", {
      sourceType: "examination",
      sourceId: exam.id,
      examinationSubjectId: examSubject.id,
      studentId: students[0].id,
      obtainedMarks: 82,
      enteredBy: "teacher-1",
    }, teacherActor);

    const marks = await ExaminationService.getMarks("org-marks", { sourceId: exam.id });
    expect(updated.id).toBe(mark.id);
    expect(updated.grade).toBe("A");
    expect(marks).toHaveLength(1);
  });

  it("blocks marks for students outside the selected class enrollment", async () => {
    const { exam, examSubject } = await createExamWithSubject("org-enrollment");
    const outsider = await StudentService.createStudent({
      organizationId: "org-enrollment",
      firstName: "Noor",
      lastName: "Ahmed",
      dateOfBirth: "2012-03-02",
      gender: "female",
      admissionDate: "2026-08-01",
      status: "active",
      guardians: [],
    });

    await expect(ExaminationService.enterMark("org-enrollment", {
      sourceType: "examination",
      sourceId: exam.id,
      examinationSubjectId: examSubject.id,
      studentId: outsider.id,
      obtainedMarks: 70,
      enteredBy: "teacher-1",
    }, teacherActor)).rejects.toThrow("not actively enrolled");
  });

  it("calculates, publishes, and retrieves student results", async () => {
    const { exam, examSubject, gradeId, section, students } = await createExamWithSubject("org-results");
    await ExaminationService.bulkEnterMarks("org-results", students.map((student, index) => ({
      sourceType: "examination",
      sourceId: exam.id,
      examinationSubjectId: examSubject.id,
      studentId: student.id,
      obtainedMarks: index === 0 ? 90 : 45,
      enteredBy: "teacher-1",
    })), teacherActor);

    const results = await ExaminationService.calculateClassResults("org-results", exam.id, gradeId, section.id);
    const performance = await ExaminationService.getSubjectPerformance("org-results", exam.id, gradeId, section.id, examSubject.subjectId);
    const publication = await ExaminationService.publishResults("org-results", exam.id, gradeId, section.id, owner);
    const studentResult = await ExaminationService.getStudentResult("org-results", exam.id, students[0].id);

    expect(results).toHaveLength(2);
    expect(performance?.average).toBe(67.5);
    expect(publication.status).toBe("published");
    expect(studentResult?.grade).toBe("A");
  });

  it("prevents publication while marks are incomplete and protects published results", async () => {
    const { exam, examSubject, gradeId, section, students } = await createExamWithSubject("org-incomplete");
    await ExaminationService.enterMark("org-incomplete", {
      sourceType: "examination",
      sourceId: exam.id,
      examinationSubjectId: examSubject.id,
      studentId: students[0].id,
      obtainedMarks: 88,
      enteredBy: "teacher-1",
    }, teacherActor);

    await expect(ExaminationService.publishResults("org-incomplete", exam.id, gradeId, section.id, owner))
      .rejects.toThrow("Incomplete marks");

    await ExaminationService.enterMark("org-incomplete", {
      sourceType: "examination",
      sourceId: exam.id,
      examinationSubjectId: examSubject.id,
      studentId: students[1].id,
      obtainedMarks: 72,
      enteredBy: "teacher-1",
    }, teacherActor);
    await ExaminationService.publishResults("org-incomplete", exam.id, gradeId, section.id, owner);

    await expect(ExaminationService.enterMark("org-incomplete", {
      sourceType: "examination",
      sourceId: exam.id,
      examinationSubjectId: examSubject.id,
      studentId: students[0].id,
      obtainedMarks: 89,
      enteredBy: "teacher-1",
    }, teacherActor)).rejects.toThrow("Published results");
  });
});
