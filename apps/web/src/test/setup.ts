/**
 * Global test setup file.
 *
 * Imported by vitest before every test suite via the `setupFiles` config.
 * Augments Vitest's `expect` with @testing-library/jest-dom's custom DOM
 * matchers (toBeInTheDocument, toHaveValue, toBeDisabled, etc.).
 */
import "@testing-library/jest-dom";
import { vi } from "vitest";

const originalFetch = globalThis.fetch?.bind(globalThis);

type Row = Record<string, unknown> & { id: string; organizationId: string; createdAt: string; updatedAt: string };
type StudentRow = Row & { admissionNumber: string; firstName: string; lastName: string; status: string; guardians?: unknown[] };
type EnrollmentRow = Row & { studentId: string; academicYear: string; gradeId: string; sectionId: string; enrollmentDate: string; status: string };
type StaffRow = Row & { employeeNumber: string; staffType: string; status: string };
type TeachingAssignmentRow = Row & { staffId: string; academicYear: string; gradeId: string; sectionId?: string; subjectId: string; isActive: boolean };
type AttendanceSessionRow = Row & { academicYearId: string; date: string; gradeId: string; sectionId: string; sessionType: string; status: string };
type AttendanceRecordRow = Row & { sessionId: string; studentId: string; status: string; note?: string; markedAt: string; markedBy: string };
type SchoolScheduleRow = Row & { academicYearId: string; workingDays: number[]; scheduleStartTime: string; scheduleEndTime: string };
type TimePeriodRow = Row & { name: string; startTime: string; endTime: string; type: string; displayOrder: number };
type TimetableEntryRow = Row & { academicYearId: string; termId?: string; gradeId: string; sectionId: string; subjectId: string; teacherId: string; roomId?: string; dayOfWeek: number; periodId: string };
type ExaminationRow = Row & { name: string; academicYearId: string; termId?: string; type: string; startDate: string; endDate: string; status: string; publishedAt?: string; publishedBy?: string };
type ExaminationSubjectRow = Row & { examinationId: string; gradeId: string; sectionId?: string; subjectId: string; maximumMarks: number; passingMarks: number; status: string; examDate?: string };
type AssessmentRow = Row & { title: string; academicYearId: string; termId?: string; gradeId: string; sectionId: string; subjectId: string; teacherId: string; type: string; maximumMarks: number; passingMarks: number; assessmentDate: string; status: string };
type MarkRow = Row & { sourceType: string; sourceId: string; examinationSubjectId?: string; academicYearId: string; termId?: string; gradeId: string; sectionId: string; subjectId: string; studentId: string; maximumMarks: number; obtainedMarks: number; percentage: number; grade?: string; gradePoint?: number; remarks?: string; enteredBy: string };
type ResultPublicationRow = Row & { examinationId: string; academicYearId: string; termId?: string; gradeId: string; sectionId: string; status: string; results: StudentResultRow[]; publishedAt?: string; publishedBy?: string };
type StudentResultRow = { studentId: string; maximumMarks: number; obtainedMarks: number; percentage: number; grade?: string; gradePoint?: number; passed: boolean; subjects: Array<{ subjectId: string; maximumMarks: number; obtainedMarks: number; percentage: number; grade?: string; gradePoint?: number; passed: boolean; remarks?: string }> };

vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, "http://test.local");
  if (!url.pathname.includes("/sis/")) {
    if (originalFetch) return originalFetch(input, init);
    return json({ error: { code: "NOT_FOUND" } }, 404);
  }

  try {
    return await handleSis(url, init);
  } catch (error) {
    return json({ error: { message: error instanceof Error ? error.message : "Request failed" } }, error instanceof DomainError ? error.status : 400);
  }
});

class DomainError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function handleSis(url: URL, init?: RequestInit): Promise<Response> {
  const segments = url.pathname.split("/").filter(Boolean);
  const orgId = segments[3];
  const sisIndex = segments.indexOf("sis");
  const parts = segments.slice(sisIndex + 1);
  const method = (init?.method ?? "GET").toUpperCase();
  const input = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};

  if (parts[0] === "academic-years") return academicYears(method, orgId, parts[1], input);
  if (parts[0] === "terms") return terms(method, orgId, parts[1], input, url);
  if (parts[0] === "grades" && parts[2] === "subjects") return classSubjects(method, orgId, parts[1], parts[3]);
  if (parts[0] === "grades") return grades(method, orgId, parts[1], input);
  if (parts[0] === "sections") return sections(method, orgId, parts[1], input, url);
  if (parts[0] === "subjects") return subjects(method, orgId, parts[1], input);
  if (parts[0] === "departments") return departments(method, orgId, input);
  if (parts[0] === "staff") return staff(method, orgId, parts[1], input);
  if (parts[0] === "teaching-assignments") return teachingAssignments(method, orgId, parts[1], input, url);
  if (parts[0] === "students" && parts[2] === "transfer") return transferStudent(orgId, parts[1], String(input.sectionId ?? ""));
  if (parts[0] === "students") return students(method, orgId, parts[1], input, url);
  if (parts[0] === "enrollments") return enrollments(method, orgId, parts[1], input, url);
  if (parts[0] === "examinations") return examinations(method, orgId, parts[1], input);
  if (parts[0] === "examination-subjects") return examinationSubjects(method, orgId, input, url);
  if (parts[0] === "assessments") return assessments(method, orgId, input);
  if (parts[0] === "grading-rules") return gradingRules(method, orgId, input);
  if (parts[0] === "marks" && parts[1] === "bulk") return bulkMarks(orgId, input);
  if (parts[0] === "marks") return marks(method, orgId, input, url);
  if (parts[0] === "results") return results(method, orgId, parts, input, url);
  if (parts[0] === "attendance") return attendance(method, orgId, parts, input, url);
  if (parts[0] === "timetable") return timetable(method, orgId, parts, input, url);

  return json({ error: { code: "NOT_FOUND" } }, 404);
}

function academicYears(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>) {
  const rows = read<Row>("haza-aios.sis.academic-years");
  if (method === "GET") return json({ academicYears: rows.filter((row) => row.organizationId === orgId).sort((a, b) => String(b.startDate).localeCompare(String(a.startDate))) });
  if (method === "POST") {
    validateDateOrder(input);
    if (input.status === "active" && rows.some((row) => row.organizationId === orgId && row.status === "active")) throw new DomainError("An active academic year already exists. Please deactivate it first.");
    const row = makeRow(orgId, input, `ay-${Date.now()}`);
    rows.push(row); write("haza-aios.sis.academic-years", rows); return json({ academicYear: row }, 201);
  }
  const row = update(rows, orgId, id, input, "Academic Year");
  validateDateOrder({ startDate: row.startDate, endDate: row.endDate });
  if (input.status === "active" && rows.some((item) => item.organizationId === orgId && item.status === "active" && item.id !== id)) throw new DomainError("An active academic year already exists. Please deactivate it first.");
  write("haza-aios.sis.academic-years", rows); return json({ academicYear: row });
}

function terms(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>, url: URL) {
  const rows = read<Row>("haza-aios.sis.terms");
  if (method === "GET") return json({ terms: rows.filter((row) => row.organizationId === orgId && (!url.searchParams.get("academicYearId") || row.academicYearId === url.searchParams.get("academicYearId"))) });
  if (method === "POST") {
    validateDateOrder(input);
    const overlap = rows.find((row) => row.academicYearId === input.academicYearId && new Date(String(input.startDate)) <= new Date(String(row.endDate)) && new Date(String(input.endDate)) >= new Date(String(row.startDate)));
    if (overlap) throw new DomainError(`Term dates overlap with existing term: ${String(overlap.name)}`);
    const row = makeRow(orgId, input, `term-${Date.now()}`); rows.push(row); write("haza-aios.sis.terms", rows); return json({ term: row }, 201);
  }
  const row = update(rows, orgId, id, input, "Term"); write("haza-aios.sis.terms", rows); return json({ term: row });
}

function grades(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>) {
  const rows = read<Row>("haza-aios.sis.grades");
  if (method === "GET" && id) return json({ grade: rows.find((row) => row.id === id && row.organizationId === orgId) ?? null });
  if (method === "GET") return json({ grades: rows.filter((row) => row.organizationId === orgId).sort((a, b) => Number(a.order) - Number(b.order)) });
  if (method === "POST") { const row = makeRow(orgId, input, `grade-${Date.now()}`); rows.push(row); write("haza-aios.sis.grades", rows); return json({ grade: row }, 201); }
  const row = update(rows, orgId, id, input, "Grade"); write("haza-aios.sis.grades", rows); return json({ grade: row });
}

function sections(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>, url: URL) {
  const rows = read<Row>("haza-aios.sis.sections");
  if (method === "GET" && id) return json({ section: rows.find((row) => row.id === id && row.organizationId === orgId) ?? null });
  if (method === "GET") return json({ sections: rows.filter((row) => row.organizationId === orgId && (!url.searchParams.get("gradeId") || row.gradeId === url.searchParams.get("gradeId"))) });
  if (method === "POST") {
    if (rows.some((row) => row.gradeId === input.gradeId && row.name === input.name)) throw new DomainError("Section name already exists in this grade");
    const row = makeRow(orgId, input, `sec-${Date.now()}`); rows.push(row); write("haza-aios.sis.sections", rows); return json({ section: row }, 201);
  }
  const row = update(rows, orgId, id, input, "Section"); write("haza-aios.sis.sections", rows); return json({ section: row });
}

function subjects(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>) {
  const rows = read<Row>("haza-aios.sis.subjects");
  if (method === "GET") return json({ subjects: rows.filter((row) => row.organizationId === orgId).sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder)) });
  if (method === "POST") {
    if (input.code && rows.some((row) => row.organizationId === orgId && row.code === input.code)) throw new DomainError("Subject code must be unique within organization.");
    const row = makeRow(orgId, input, `sub-${Date.now()}`); rows.push(row); write("haza-aios.sis.subjects", rows); return json({ subject: row }, 201);
  }
  if (input.code && rows.some((row) => row.organizationId === orgId && row.code === input.code && row.id !== id)) throw new DomainError("Subject code must be unique within organization.");
  const row = update(rows, orgId, id, input, "Subject"); write("haza-aios.sis.subjects", rows); return json({ subject: row });
}

function classSubjects(method: string, _orgId: string, gradeId: string, subjectId?: string) {
  let rows = read<{ gradeId: string; subjectId: string }>("haza-aios.sis.class-subjects");
  if (method === "GET") return json({ subjectIds: rows.filter((row) => row.gradeId === gradeId).map((row) => row.subjectId) });
  if (method === "POST" && subjectId && !rows.some((row) => row.gradeId === gradeId && row.subjectId === subjectId)) rows.push({ gradeId, subjectId });
  if (method === "DELETE") rows = rows.filter((row) => !(row.gradeId === gradeId && row.subjectId === subjectId));
  write("haza-aios.sis.class-subjects", rows); return json({ ok: true });
}

function departments(method: string, orgId: string, input: Record<string, unknown>) {
  const rows = read<Row>("haza-aios.sis.departments");
  if (method === "GET") return json({ departments: rows.filter((row) => row.organizationId === orgId) });
  const row = makeRow(orgId, input); rows.push(row); write("haza-aios.sis.departments", rows); return json({ department: row }, 201);
}

function staff(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>) {
  const rows = read<StaffRow>("haza-aios.sis.staff");
  if (method === "GET" && id) return json({ staffMember: rows.find((row) => row.id === id && row.organizationId === orgId) ?? null });
  if (method === "GET") return json({ staff: rows.filter((row) => row.organizationId === orgId) });
  if (method === "POST") {
    const employeeNumber = String(input.employeeNumber ?? nextEmployeeNumber(rows, orgId));
    if (rows.some((row) => row.organizationId === orgId && row.employeeNumber === employeeNumber)) throw new DomainError(`Employee number ${employeeNumber} is already in use.`);
    const row = makeRow(orgId, { ...input, employeeNumber }) as StaffRow; rows.push(row); write("haza-aios.sis.staff", rows); return json({ staffMember: row }, 201);
  }
  if (input.employeeNumber && rows.some((row) => row.organizationId === orgId && row.employeeNumber === input.employeeNumber && row.id !== id)) throw new DomainError(`Employee number ${String(input.employeeNumber)} is already in use.`);
  const row = update(rows, orgId, id, input, "Staff member"); write("haza-aios.sis.staff", rows); return json({ staffMember: row });
}

function teachingAssignments(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>, url: URL) {
  const rows = read<TeachingAssignmentRow>("haza-aios.sis.teaching_assignments");
  if (method === "GET") return json({ assignments: rows.filter((row) => row.organizationId === orgId && matches(row, url)) });
  if (method === "POST") {
    const staffMember = read<StaffRow>("haza-aios.sis.staff").find((row) => row.id === input.staffId && row.organizationId === orgId);
    if (!staffMember) throw new DomainError("Staff member not found or unauthorized.");
    if (staffMember.staffType !== "teacher") throw new DomainError(`Staff member must be a teacher to have teaching assignments (found: ${staffMember.staffType}).`);
    if (staffMember.status !== "active") throw new DomainError("Cannot assign subjects to an inactive staff member.");
    if (rows.some((row) => row.organizationId === orgId && row.staffId === input.staffId && row.academicYear === input.academicYear && row.gradeId === input.gradeId && row.sectionId === input.sectionId && row.subjectId === input.subjectId && row.isActive)) throw new DomainError("This teacher is already assigned to this subject and class for the given academic year.");
    const row = makeRow(orgId, input) as TeachingAssignmentRow; rows.push(row); write("haza-aios.sis.teaching_assignments", rows); return json({ assignment: row }, 201);
  }
  const row = update(rows, orgId, id, input, "Teaching assignment"); write("haza-aios.sis.teaching_assignments", rows); return json({ assignment: row });
}

function students(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>, url: URL) {
  const rows = read<StudentRow>("haza-aios.sis.students");
  if (method === "GET" && id) return json({ student: rows.find((row) => row.id === id && row.organizationId === orgId) ?? null });
  if (method === "GET") {
    const admissionNumber = url.searchParams.get("admissionNumber");
    return json({ students: rows.filter((row) => row.organizationId === orgId && (!admissionNumber || row.admissionNumber === admissionNumber)) });
  }
  if (method === "POST") {
    const admissionNumber = String(input.admissionNumber ?? nextAdmissionNumber(rows));
    if (rows.some((row) => row.organizationId === orgId && row.admissionNumber === admissionNumber)) throw new DomainError("Validation Error: Admission Number must be unique within the organization.");
    const row = makeRow(orgId, { ...input, admissionNumber, status: input.status ?? "applicant" }) as StudentRow; rows.push(row); write("haza-aios.sis.students", rows); return json({ student: row }, 201);
  }
  if (method === "DELETE") { write("haza-aios.sis.students", rows.filter((row) => !(row.id === id && row.organizationId === orgId))); return json({ ok: true }); }
  const row = update(rows, orgId, id, input, "Student"); write("haza-aios.sis.students", rows); return json({ student: row });
}

function enrollments(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>, url: URL) {
  const rows = read<EnrollmentRow>("haza-aios.sis.enrollments");
  if (method === "GET") return json({ enrollments: rows.filter((row) => row.organizationId === orgId && matches(row, url)) });
  if (method === "POST") {
    if (rows.some((row) => row.organizationId === orgId && row.studentId === input.studentId && row.academicYear === input.academicYear && row.status === "active")) throw new DomainError(`Student is already actively enrolled for academic year ${String(input.academicYear)}. Use transfer workflow instead.`);
    const row = makeRow(orgId, input) as EnrollmentRow; rows.push(row); write("haza-aios.sis.enrollments", rows); return json({ enrollment: row }, 201);
  }
  const row = update(rows, orgId, id, input, "Enrollment"); write("haza-aios.sis.enrollments", rows); return json({ enrollment: row });
}

function transferStudent(orgId: string, studentId: string, newSectionId: string) {
  const rows = read<EnrollmentRow>("haza-aios.sis.enrollments");
  const current = rows.find((row) => row.organizationId === orgId && row.studentId === studentId && row.status === "active");
  if (!current) throw new DomainError("Student does not have an active enrollment to transfer from.");
  if (current.sectionId === newSectionId) throw new DomainError("Student is already in this section.");
  current.status = "transferred";
  const next = makeRow(orgId, { studentId, academicYear: current.academicYear, gradeId: current.gradeId, sectionId: newSectionId, enrollmentDate: new Date().toISOString(), status: "active" }) as EnrollmentRow;
  rows.push(next); write("haza-aios.sis.enrollments", rows); return json({ enrollment: next }, 201);
}


function examinations(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>) {
  const rows = read<ExaminationRow>("haza-aios.sis.examinations");
  if (method === "GET") return json({ examinations: rows.filter((row) => row.organizationId === orgId) });
  if (method === "POST") {
    const row = makeRow(orgId, { ...input, name: String(input.name ?? "").trim() }, `exam-${Date.now()}`) as ExaminationRow;
    rows.push(row); write("haza-aios.sis.examinations", rows); return json({ examination: row }, 201);
  }
  const row = update(rows, orgId, id, input, "Examination"); write("haza-aios.sis.examinations", rows); return json({ examination: row });
}

function examinationSubjects(method: string, orgId: string, input: Record<string, unknown>, url: URL) {
  const rows = read<ExaminationSubjectRow>("haza-aios.sis.examination-subjects");
  if (method === "GET") return json({ subjects: rows.filter((row) => row.organizationId === orgId && (!url.searchParams.get("examinationId") || row.examinationId === url.searchParams.get("examinationId"))) });
  const row = makeRow(orgId, input, `exam-subject-${Date.now()}`) as ExaminationSubjectRow;
  rows.push(row); write("haza-aios.sis.examination-subjects", rows); return json({ subject: row }, 201);
}

function assessments(method: string, orgId: string, input: Record<string, unknown>) {
  const rows = read<AssessmentRow>("haza-aios.sis.assessments");
  if (method === "GET") return json({ assessments: rows.filter((row) => row.organizationId === orgId) });
  const row = makeRow(orgId, input, `assessment-${Date.now()}`) as AssessmentRow;
  rows.push(row); write("haza-aios.sis.assessments", rows); return json({ assessment: row }, 201);
}

function gradingRules(method: string, orgId: string, input: Record<string, unknown>) {
  const rows = read<Row & { grade: string; minPercentage: number; maxPercentage: number; gradePoint?: number }>("haza-aios.sis.grading-rules");
  if (method === "GET") {
    if (!rows.some((row) => row.organizationId === orgId)) {
      const defaults = [
        { grade: "A", minPercentage: 80, maxPercentage: 100, gradePoint: 4 },
        { grade: "B", minPercentage: 70, maxPercentage: 79.99, gradePoint: 3 },
        { grade: "C", minPercentage: 60, maxPercentage: 69.99, gradePoint: 2 },
        { grade: "D", minPercentage: 50, maxPercentage: 59.99, gradePoint: 1 },
        { grade: "F", minPercentage: 0, maxPercentage: 49.99, gradePoint: 0 },
      ].map((rule) => makeRow(orgId, rule) as Row & { grade: string; minPercentage: number; maxPercentage: number; gradePoint?: number });
      rows.push(...defaults); write("haza-aios.sis.grading-rules", rows);
    }
    return json({ rules: rows.filter((row) => row.organizationId === orgId).sort((a, b) => b.minPercentage - a.minPercentage) });
  }
  const index = input.id ? rows.findIndex((row) => row.id === input.id && row.organizationId === orgId) : -1;
  const row = makeRow(orgId, input, index >= 0 ? rows[index].id : undefined);
  if (index >= 0) rows[index] = row as typeof rows[number]; else rows.push(row as typeof rows[number]);
  write("haza-aios.sis.grading-rules", rows); return json({ rule: row });
}

function marks(method: string, orgId: string, input: Record<string, unknown>, url: URL) {
  const rows = read<MarkRow>("haza-aios.sis.marks");
  if (method === "GET") return json({ marks: rows.filter((row) => row.organizationId === orgId && matches(row, url)) });
  return json({ mark: saveMark(orgId, input) });
}

function bulkMarks(orgId: string, input: Record<string, unknown>) {
  const saved = (Array.isArray(input.marks) ? input.marks as Record<string, unknown>[] : []).map((mark) => saveMark(orgId, mark));
  return json({ marks: saved });
}

function saveMark(orgId: string, input: Record<string, unknown>): MarkRow {
  const rows = read<MarkRow>("haza-aios.sis.marks");
  const source = resolveMarkSource(orgId, input);
  const percent = Math.round((Number(input.obtainedMarks) / source.maximumMarks) * 10000) / 100;
  const grade = gradeFor(orgId, percent);
  const index = rows.findIndex((row) => row.organizationId === orgId && row.sourceType === input.sourceType && row.sourceId === input.sourceId && row.studentId === input.studentId && row.subjectId === source.subjectId);
  const row = makeRow(orgId, { ...input, ...source, percentage: percent, grade: grade.grade, gradePoint: grade.gradePoint }, index >= 0 ? rows[index].id : `mark-${Date.now()}`) as MarkRow;
  if (index >= 0) rows[index] = row; else rows.push(row);
  write("haza-aios.sis.marks", rows);
  return row;
}

function results(method: string, orgId: string, parts: string[], input: Record<string, unknown>, url: URL) {
  if (parts[1] === "calculate") return json({ results: calculateResults(orgId, String(url.searchParams.get("examinationId")), String(url.searchParams.get("gradeId")), String(url.searchParams.get("sectionId"))) });
  if (parts[1] === "publish") {
    const rows = read<ResultPublicationRow>("haza-aios.sis.results");
    const results = calculateResults(orgId, String(input.examinationId), String(input.gradeId), String(input.sectionId));
    const exams = read<ExaminationRow>("haza-aios.sis.examinations");
    const exam = exams.find((row) => row.organizationId === orgId && row.id === input.examinationId);
    const publishedAt = new Date().toISOString();
    const publication = makeRow(orgId, { examinationId: input.examinationId, academicYearId: exam?.academicYearId, termId: exam?.termId, gradeId: input.gradeId, sectionId: input.sectionId, status: "published", results, publishedAt, publishedBy: input.publishedBy }, `result-${Date.now()}`) as ResultPublicationRow;
    rows.push(publication); write("haza-aios.sis.results", rows);
    if (exam) { exam.status = "published"; exam.publishedAt = publishedAt; exam.publishedBy = String(input.publishedBy ?? "system"); write("haza-aios.sis.examinations", exams); }
    return json({ publication });
  }
  if (parts[1] === "publications") return json({ publications: read<ResultPublicationRow>("haza-aios.sis.results").filter((row) => row.organizationId === orgId && (!url.searchParams.get("examinationId") || row.examinationId === url.searchParams.get("examinationId"))) });
  if (parts[1] === "students") {
    const publication = read<ResultPublicationRow>("haza-aios.sis.results").find((row) => row.organizationId === orgId && row.examinationId === url.searchParams.get("examinationId") && row.results.some((result) => result.studentId === parts[2]));
    return json({ result: publication?.results.find((result) => result.studentId === parts[2]) ?? null });
  }
  if (parts[1] === "performance") {
    const calculated = calculateResults(orgId, String(url.searchParams.get("examinationId")), String(url.searchParams.get("gradeId")), String(url.searchParams.get("sectionId")));
    const subjectId = url.searchParams.get("subjectId");
    const subjectRows = calculated.map((result) => result.subjects.find((subject) => subject.subjectId === subjectId)).filter((subject): subject is StudentResultRow["subjects"][number] => Boolean(subject));
    if (!subjectRows.length) return json({ performance: null });
    const scores = subjectRows.map((row) => row.obtainedMarks);
    return json({ performance: { subjectId, maximumMarks: subjectRows[0].maximumMarks, average: Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100) / 100, highest: Math.max(...scores), lowest: Math.min(...scores), passRate: Math.round((subjectRows.filter((row) => row.passed).length / subjectRows.length) * 10000) / 100, gradeDistribution: {} } });
  }
  return json({ error: { code: "NOT_FOUND" } }, 404);
}

function calculateResults(orgId: string, examinationId: string, gradeId: string, sectionId: string): StudentResultRow[] {
  const exam = read<ExaminationRow>("haza-aios.sis.examinations").find((row) => row.organizationId === orgId && row.id === examinationId);
  const year = read<Row & { name: string }>("haza-aios.sis.academic-years").find((row) => row.id === exam?.academicYearId && row.organizationId === orgId);
  const examSubjects = read<ExaminationSubjectRow>("haza-aios.sis.examination-subjects").filter((row) => row.organizationId === orgId && row.examinationId === examinationId && row.gradeId === gradeId && (!row.sectionId || row.sectionId === sectionId));
  const enrollments = read<EnrollmentRow>("haza-aios.sis.enrollments").filter((row) => row.organizationId === orgId && row.academicYear === year?.name && row.gradeId === gradeId && row.sectionId === sectionId && row.status === "active");
  const allMarks = read<MarkRow>("haza-aios.sis.marks").filter((row) => row.organizationId === orgId && row.sourceType === "examination" && row.sourceId === examinationId);
  return enrollments.map((enrollment) => {
    const subjects = examSubjects.map((subject) => {
      const mark = allMarks.find((row) => row.studentId === enrollment.studentId && row.subjectId === subject.subjectId);
      const obtainedMarks = mark?.obtainedMarks ?? 0;
      const pct = Math.round((obtainedMarks / subject.maximumMarks) * 10000) / 100;
      const grade = gradeFor(orgId, pct);
      return { subjectId: subject.subjectId, maximumMarks: subject.maximumMarks, obtainedMarks, percentage: pct, grade: grade.grade, gradePoint: grade.gradePoint, passed: obtainedMarks >= subject.passingMarks, remarks: mark?.remarks };
    });
    const maximumMarks = subjects.reduce((sum, item) => sum + item.maximumMarks, 0);
    const obtainedMarks = subjects.reduce((sum, item) => sum + item.obtainedMarks, 0);
    const pct = maximumMarks ? Math.round((obtainedMarks / maximumMarks) * 10000) / 100 : 0;
    const grade = gradeFor(orgId, pct);
    return { studentId: enrollment.studentId, maximumMarks, obtainedMarks, percentage: pct, grade: grade.grade, gradePoint: grade.gradePoint, passed: subjects.every((item) => item.passed), subjects };
  });
}

function resolveMarkSource(orgId: string, input: Record<string, unknown>) {
  if (input.sourceType === "assessment") {
    const assessment = read<AssessmentRow>("haza-aios.sis.assessments").find((row) => row.organizationId === orgId && row.id === input.sourceId);
    return { academicYearId: assessment?.academicYearId ?? "", termId: assessment?.termId, gradeId: assessment?.gradeId ?? "", sectionId: assessment?.sectionId ?? "", subjectId: assessment?.subjectId ?? "", maximumMarks: assessment?.maximumMarks ?? 0 };
  }
  const examSubject = read<ExaminationSubjectRow>("haza-aios.sis.examination-subjects").find((row) => row.organizationId === orgId && row.id === input.examinationSubjectId);
  const exam = read<ExaminationRow>("haza-aios.sis.examinations").find((row) => row.organizationId === orgId && row.id === input.sourceId);
  return { examinationSubjectId: examSubject?.id, academicYearId: exam?.academicYearId ?? "", termId: exam?.termId, gradeId: examSubject?.gradeId ?? "", sectionId: examSubject?.sectionId ?? "", subjectId: examSubject?.subjectId ?? "", maximumMarks: examSubject?.maximumMarks ?? 0 };
}

function gradeFor(orgId: string, percent: number): { grade?: string; gradePoint?: number } {
  const rows = read<Row & { grade: string; minPercentage: number; maxPercentage: number; gradePoint?: number }>("haza-aios.sis.grading-rules").filter((row) => row.organizationId === orgId);
  const rule = (rows.length ? rows : [
    { grade: "A", minPercentage: 80, maxPercentage: 100, gradePoint: 4 },
    { grade: "B", minPercentage: 70, maxPercentage: 79.99, gradePoint: 3 },
    { grade: "C", minPercentage: 60, maxPercentage: 69.99, gradePoint: 2 },
    { grade: "D", minPercentage: 50, maxPercentage: 59.99, gradePoint: 1 },
    { grade: "F", minPercentage: 0, maxPercentage: 49.99, gradePoint: 0 },
  ]).find((item) => percent >= item.minPercentage && percent <= item.maxPercentage);
  return rule ? { grade: rule.grade, gradePoint: rule.gradePoint } : {};
}

function attendance(method: string, orgId: string, parts: string[], input: Record<string, unknown>, url: URL) {
  if (parts[1] === "sessions" && parts[3] === "records") return attendanceRecords(method, orgId, parts[2], input);
  if (parts[1] === "sessions") return attendanceSessions(method, orgId, parts[2], input, url);
  if (parts[1] === "students" && parts[3] === "history") {
    const sessions = read<AttendanceSessionRow>("haza-aios.sis.attendance-sessions");
    const records = read<AttendanceRecordRow>("haza-aios.sis.attendance-records").filter((record) => record.organizationId === orgId && record.studentId === parts[2]);
    return json({ history: records.map((record) => ({ record, session: sessions.find((session) => session.id === record.sessionId) })).filter((item) => item.session) });
  }
  if (parts[1] === "students" && parts[3] === "summary") {
    const records = read<AttendanceRecordRow>("haza-aios.sis.attendance-records").filter((record) => record.organizationId === orgId && record.studentId === parts[2]);
    const summary = { totalSessions: records.length, present: 0, absent: 0, late: 0, excused: 0, attendancePercentage: 100 };
    for (const record of records) {
      if (record.status === "present") summary.present += 1;
      if (record.status === "absent") summary.absent += 1;
      if (record.status === "late") summary.late += 1;
      if (record.status === "excused") summary.excused += 1;
    }
    const counted = summary.present + summary.late + summary.absent;
    summary.attendancePercentage = counted > 0 ? Math.round(((summary.present + summary.late) / counted) * 100) : 100;
    return json({ summary });
  }
  return json({ error: { code: "NOT_FOUND" } }, 404);
}

function attendanceSessions(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>, url: URL) {
  const rows = read<AttendanceSessionRow>("haza-aios.sis.attendance-sessions");
  if (method === "GET" && id) return json({ session: rows.find((row) => row.id === id && row.organizationId === orgId) ?? null });
  if (method === "GET") return json({ sessions: rows.filter((row) => row.organizationId === orgId && matches(row, url)) });
  if (method === "POST") {
    const existing = rows.find((row) => row.organizationId === orgId && row.academicYearId === input.academicYearId && row.date === input.date && row.gradeId === input.gradeId && row.sectionId === input.sectionId && row.sessionType === input.sessionType);
    if (existing) return json({ session: existing }, 201);
    const row = makeRow(orgId, { ...input, sessionType: input.sessionType ?? "daily", status: input.status ?? "draft" }, `sess-${Date.now()}`) as AttendanceSessionRow;
    rows.push(row); write("haza-aios.sis.attendance-sessions", rows); return json({ session: row }, 201);
  }
  const row = update(rows, orgId, id, input, "Attendance session"); write("haza-aios.sis.attendance-sessions", rows); return json({ session: row });
}

function attendanceRecords(method: string, orgId: string, sessionId: string, input: Record<string, unknown>) {
  const rows = read<AttendanceRecordRow>("haza-aios.sis.attendance-records");
  if (method === "GET") return json({ records: rows.filter((row) => row.organizationId === orgId && row.sessionId === sessionId) });
  const saved: AttendanceRecordRow[] = [];
  for (const item of Array.isArray(input.records) ? input.records as Array<Record<string, unknown>> : []) {
    const index = rows.findIndex((row) => row.organizationId === orgId && row.sessionId === sessionId && row.studentId === item.studentId);
    if (index >= 0) {
      rows[index] = { ...rows[index], status: String(item.status), note: item.note as string | undefined, markedBy: String(input.markedBy ?? ""), updatedAt: new Date().toISOString() };
      saved.push(rows[index]);
    } else {
      const row = makeRow(orgId, { sessionId, studentId: item.studentId, status: item.status, note: item.note, markedAt: new Date().toISOString(), markedBy: input.markedBy ?? "" }, `rec-${Date.now()}-${saved.length}`) as AttendanceRecordRow;
      rows.push(row); saved.push(row);
    }
  }
  write("haza-aios.sis.attendance-records", rows); return json({ records: saved });
}

function timetable(method: string, orgId: string, parts: string[], input: Record<string, unknown>, url: URL) {
  if (parts[1] === "schedules" && method === "GET") {
    const schedule = read<SchoolScheduleRow>("haza-aios.sis.school-schedules").find((row) => row.organizationId === orgId && row.academicYearId === parts[2]) ?? null;
    return json({ schedule });
  }
  if (parts[1] === "schedules") return saveSchedule(orgId, input);
  if (parts[1] === "periods" && method === "DELETE") return deletePeriod(orgId, parts[2]);
  if (parts[1] === "periods") return periods(method, orgId, input);
  if (parts[1] === "entries" && method === "DELETE") return deleteTimetableEntry(orgId, parts[2]);
  if (parts[1] === "entries") return entries(method, orgId, input, url);
  return json({ error: { code: "NOT_FOUND" } }, 404);
}

function saveSchedule(orgId: string, input: Record<string, unknown>) {
  const rows = read<SchoolScheduleRow>("haza-aios.sis.school-schedules");
  const index = rows.findIndex((row) => row.organizationId === orgId && row.academicYearId === input.academicYearId);
  const row = makeRow(orgId, input, index >= 0 ? rows[index].id : `schedule-${Date.now()}`) as SchoolScheduleRow;
  if (index >= 0) rows[index] = row; else rows.push(row);
  write("haza-aios.sis.school-schedules", rows); return json({ schedule: row });
}

function periods(method: string, orgId: string, input: Record<string, unknown>) {
  const rows = read<TimePeriodRow>("haza-aios.sis.time-periods");
  if (method === "GET") return json({ periods: rows.filter((row) => row.organizationId === orgId).sort((a, b) => a.displayOrder - b.displayOrder) });
  const index = input.id ? rows.findIndex((row) => row.id === input.id && row.organizationId === orgId) : -1;
  const row = makeRow(orgId, input, index >= 0 ? rows[index].id : `period-${Date.now()}`) as TimePeriodRow;
  if (index >= 0) rows[index] = row; else rows.push(row);
  write("haza-aios.sis.time-periods", rows); return json({ period: row });
}

function deletePeriod(orgId: string, id: string) {
  write("haza-aios.sis.time-periods", read<TimePeriodRow>("haza-aios.sis.time-periods").filter((row) => !(row.organizationId === orgId && row.id === id)));
  write("haza-aios.sis.timetable-entries", read<TimetableEntryRow>("haza-aios.sis.timetable-entries").filter((row) => !(row.organizationId === orgId && row.periodId === id)));
  return json({ ok: true });
}

function entries(method: string, orgId: string, input: Record<string, unknown>, url: URL) {
  const rows = read<TimetableEntryRow>("haza-aios.sis.timetable-entries");
  if (method === "GET") return json({ entries: rows.filter((row) => row.organizationId === orgId && matches(row, url)) });
  const sameSlot = rows.filter((row) => row.organizationId === orgId && row.academicYearId === input.academicYearId && row.dayOfWeek === input.dayOfWeek && row.periodId === input.periodId && row.id !== input.id);
  if (sameSlot.some((row) => row.teacherId === input.teacherId)) throw new DomainError("Teacher already has a class in this period.", 409);
  if (sameSlot.some((row) => row.gradeId === input.gradeId && row.sectionId === input.sectionId)) throw new DomainError("Class section already has a timetable entry in this period.", 409);
  const index = input.id ? rows.findIndex((row) => row.id === input.id && row.organizationId === orgId) : -1;
  const row = makeRow(orgId, input, index >= 0 ? rows[index].id : `timetable-${Date.now()}`) as TimetableEntryRow;
  if (index >= 0) rows[index] = row; else rows.push(row);
  write("haza-aios.sis.timetable-entries", rows); return json({ entry: row });
}

function deleteTimetableEntry(orgId: string, id: string) {
  write("haza-aios.sis.timetable-entries", read<TimetableEntryRow>("haza-aios.sis.timetable-entries").filter((row) => !(row.organizationId === orgId && row.id === id)));
  return json({ ok: true });
}

function makeRow(orgId: string, input: Record<string, unknown>, id: string = crypto.randomUUID()): Row {
  const now = new Date().toISOString();
  return { ...input, id, organizationId: orgId, createdAt: now, updatedAt: now } as Row;
}

function update<T extends Row>(rows: T[], orgId: string, id: string | undefined, input: Record<string, unknown>, label: string): T {
  const index = rows.findIndex((row) => row.id === id && row.organizationId === orgId);
  if (index === -1) throw new DomainError(`${label} not found`, 404);
  rows[index] = { ...rows[index], ...input, id: rows[index].id, organizationId: orgId, updatedAt: new Date().toISOString() };
  return rows[index];
}

function matches(row: Record<string, unknown>, url: URL): boolean {
  for (const [key, value] of url.searchParams.entries()) {
    if (String(row[key]) !== value) return false;
  }
  return true;
}

function validateDateOrder(input: Record<string, unknown>) {
  if (new Date(String(input.startDate)) >= new Date(String(input.endDate))) throw new DomainError("Start date must be before end date.");
}

function nextEmployeeNumber(rows: StaffRow[], orgId: string): string {
  const max = rows.filter((row) => row.organizationId === orgId).reduce((value, row) => Math.max(value, Number(row.employeeNumber.replace("EMP-", "")) || 0), 0);
  return `EMP-${String(max + 1).padStart(3, "0")}`;
}

function nextAdmissionNumber(rows: StudentRow[]): string {
  const year = new Date().getFullYear();
  return `TMS-${year}-${String(rows.filter((row) => row.admissionNumber.includes(`-${year}-`)).length + 1).padStart(5, "0")}`;
}

function read<T>(key: string): T[] {
  return JSON.parse(localStorage.getItem(key) || "[]") as T[];
}

function write<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
