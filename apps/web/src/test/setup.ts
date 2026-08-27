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
  if (parts[0] === "analytics") return analytics(orgId, parts, url);
  if (parts[0] === "reports") return reports(orgId, parts, url);
  if (parts[0] === "finance") return finance(method, orgId, parts, input, url);
  if (parts[0] === "communication") return communication(method, orgId, parts, input, url);
  if (parts[0] === "portal") return portal(method, orgId, parts, input, url);
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

function finance(method: string, orgId: string, parts: string[], input: Record<string, unknown>, url: URL) {
  if (parts[1] === "categories") {
    const rows = read<Row>("haza-aios.sis.finance.categories");
    if (method === "GET") return json({ categories: rows.filter((row) => row.organizationId === orgId) });
    if (method === "POST") { assertFinance(input.actor as Record<string, unknown> | undefined); const row = makeRow(orgId, input, "fee-category-" + Date.now()); rows.push(row); write("haza-aios.sis.finance.categories", rows); return json({ category: row }, 201); }
    const row = update(rows, orgId, parts[2], input, "Fee category"); write("haza-aios.sis.finance.categories", rows); return json({ category: row });
  }
  if (parts[1] === "structures") {
    const rows = read<Row>("haza-aios.sis.finance.structures");
    if (method === "GET") return json({ structures: rows.filter((row) => row.organizationId === orgId) });
    if (method === "POST") { assertFinance(input.actor as Record<string, unknown> | undefined); if (Number(input.amountCents) <= 0) throw new DomainError("Fee amount must be greater than zero."); const row = makeRow(orgId, input, "fee-structure-" + Date.now()); rows.push(row); write("haza-aios.sis.finance.structures", rows); return json({ structure: row }, 201); }
    const row = update(rows, orgId, parts[2], input, "Fee structure"); write("haza-aios.sis.finance.structures", rows); return json({ structure: row });
  }
  if (parts[1] === "assignments") return financeAssignments(method, orgId, input, url);
  if (parts[1] === "discounts") {
    const rows = read<Row>("haza-aios.sis.finance.discounts");
    if (method === "GET") return json({ discounts: rows.filter((row) => row.organizationId === orgId) });
    assertFinance(input.actor as Record<string, unknown> | undefined);
    if (input.type === "percentage" && (Number(input.value) <= 0 || Number(input.value) > 100)) throw new DomainError("Percentage discount must be between 0 and 100.");
    const row = makeRow(orgId, input, "fee-discount-" + Date.now()); rows.push(row); write("haza-aios.sis.finance.discounts", rows); return json({ discount: row }, 201);
  }
  if (parts[1] === "invoices" && parts[3] === "issue") return issueInvoice(orgId, parts[2]);
  if (parts[1] === "invoices") return financeInvoices(method, orgId, input, url);
  if (parts[1] === "payments" && parts[3] === "void") return voidPayment(orgId, parts[2], input);
  if (parts[1] === "payments") return financePayments(method, orgId, input, url);
  if (parts[1] === "receipts") return json({ receipts: read<Row>("haza-aios.sis.finance.receipts").filter((row) => row.organizationId === orgId && (!url.searchParams.get("studentId") || row.studentId === url.searchParams.get("studentId"))) });
  if (parts[1] === "ledger") return json({ ledger: financeLedger(orgId, parts[2]) });
  if (parts[1] === "reports" && parts[2] === "summary") return json({ summary: financeSummary(orgId) });
  if (parts[1] === "reports" && parts[2] === "collection") return json({ rows: financeCollection(orgId, url) });
  if (parts[1] === "reports" && parts[2] === "outstanding") return json({ rows: financeCollection(orgId, url).filter((row) => Number(row.balanceCents) > 0) });
  if (parts[1] === "reports" && parts[2] === "payments") return json({ rows: read<Row>("haza-aios.sis.finance.payments").filter((row) => row.organizationId === orgId).map((payment) => ({ paymentId: payment.id, invoiceId: payment.invoiceId, studentId: payment.studentId, amountCents: payment.amountCents, paymentDate: payment.paymentDate, method: payment.paymentMethod, status: payment.status })) });
  if (parts[1] === "reports" && parts[2] === "grades") return json({ rows: financeGradeSummary(orgId) });
  return json({ error: { code: "NOT_FOUND" } }, 404);
}

function assertFinance(actor?: Record<string, unknown>) {
  if (actor && !["Owner", "Admin", "Accountant"].includes(String(actor.role))) throw new DomainError("Unauthorized: missing permission finance.manage", 403);
}

function financeAssignments(method: string, orgId: string, input: Record<string, unknown>, url: URL) {
  const rows = read<Row>("haza-aios.sis.finance.assignments");
  if (method === "GET") return json({ assignments: rows.filter((row) => row.organizationId === orgId && (!url.searchParams.get("studentId") || row.studentId === url.searchParams.get("studentId"))) });
  assertFinance(input.actor as Record<string, unknown> | undefined);
  if (!read<StudentRow>("haza-aios.sis.students").some((row) => row.organizationId === orgId && row.id === input.studentId)) throw new DomainError("Student not found for this organization.", 404);
  const structure = read<Row>("haza-aios.sis.finance.structures").find((row) => row.organizationId === orgId && row.id === input.feeStructureId);
  if (!structure) throw new DomainError("Fee structure not found.", 404);
  const existing = rows.find((row) => row.organizationId === orgId && row.studentId === input.studentId && row.enrollmentId === input.enrollmentId && row.feeStructureId === input.feeStructureId);
  if (existing) return json({ assignment: existing }, 201);
  const row = makeRow(orgId, { studentId: input.studentId, enrollmentId: input.enrollmentId, feeStructureId: input.feeStructureId, amountCents: structure.amountCents, status: "active", assignedAt: new Date().toISOString() }, "fee-assignment-" + Date.now());
  rows.push(row); write("haza-aios.sis.finance.assignments", rows); return json({ assignment: row }, 201);
}

function financeInvoices(method: string, orgId: string, input: Record<string, unknown>, url: URL) {
  const rows = read<Row>("haza-aios.sis.finance.invoices");
  if (method === "GET") return json({ invoices: rows.filter((row) => row.organizationId === orgId && matches(row, url)).map((row) => ({ ...row, status: invoiceStatus(row) })) });
  assertFinance(input.actor as Record<string, unknown> | undefined);
  const assignments = read<Row>("haza-aios.sis.finance.assignments").filter((row) => row.organizationId === orgId && row.studentId === input.studentId && row.enrollmentId === input.enrollmentId && row.status === "active" && (!Array.isArray(input.feeStructureIds) || (input.feeStructureIds as unknown[]).includes(row.feeStructureId)));
  for (const structureId of Array.isArray(input.feeStructureIds) ? input.feeStructureIds as unknown[] : []) if (!assignments.some((row) => row.feeStructureId === structureId)) assignments.push((financeAssignments("POST", orgId, { studentId: input.studentId, enrollmentId: input.enrollmentId, feeStructureId: structureId, actor: input.actor }, url) as Response, read<Row>("haza-aios.sis.finance.assignments")[read<Row>("haza-aios.sis.finance.assignments").length - 1]) as Row);
  if (!assignments.length) throw new DomainError("At least one active fee assignment is required to create an invoice.");
  const structures = read<Row>("haza-aios.sis.finance.structures");
  const discounts = read<Row>("haza-aios.sis.finance.discounts").filter((row) => row.organizationId === orgId && row.status === "active" && Array.isArray(input.discountIds) && (input.discountIds as unknown[]).includes(row.id));
  const items = assignments.map((assignment) => { const structure = structures.find((row) => row.id === assignment.feeStructureId) as Row; const d = discounts.filter((row) => (!row.studentId || row.studentId === input.studentId) && (!row.feeCategoryId || row.feeCategoryId === structure.feeCategoryId)).reduce((sum, row) => sum + (row.type === "fixed" ? Number(row.value) : Math.round(Number(assignment.amountCents) * Number(row.value) / 100)), 0); const discountCents = Math.min(d, Number(assignment.amountCents)); return { id: crypto.randomUUID(), feeCategoryId: structure.feeCategoryId, feeStructureId: structure.id, description: structure.name, quantity: 1, amountCents: assignment.amountCents, discountCents, adjustmentCents: 0, finalAmountCents: Number(assignment.amountCents) - discountCents }; });
  const subtotalCents = items.reduce((sum, item) => sum + Number(item.amountCents), 0);
  const discountCents = items.reduce((sum, item) => sum + Number(item.discountCents), 0);
  const totalCents = subtotalCents - discountCents;
  const row = makeRow(orgId, { ...input, id: undefined, invoiceNumber: nextDoc("INV", orgId, rows, "invoiceNumber"), items, subtotalCents, discountCents, adjustmentCents: 0, totalCents, paidAmountCents: 0, balanceCents: totalCents, notificationEvents: input.status === "issued" ? ["invoice.issued"] : [], issuedAt: input.status === "issued" ? new Date().toISOString() : undefined, status: input.status ?? "draft" }, "invoice-" + Date.now());
  row.status = invoiceStatus(row); rows.push(row); write("haza-aios.sis.finance.invoices", rows); return json({ invoice: row }, 201);
}

function issueInvoice(orgId: string, id: string) { const rows = read<Row>("haza-aios.sis.finance.invoices"); const row = update(rows, orgId, id, { status: "issued", issuedAt: new Date().toISOString() }, "Invoice"); row.status = invoiceStatus(row); write("haza-aios.sis.finance.invoices", rows); return json({ invoice: row }); }

function financePayments(method: string, orgId: string, input: Record<string, unknown>, url: URL) {
  const rows = read<Row>("haza-aios.sis.finance.payments");
  if (method === "GET") return json({ payments: rows.filter((row) => row.organizationId === orgId && (!url.searchParams.get("studentId") || row.studentId === url.searchParams.get("studentId"))) });
  assertFinance(input.actor as Record<string, unknown> | undefined);
  const invoices = read<Row>("haza-aios.sis.finance.invoices"); const invoice = invoices.find((row) => row.organizationId === orgId && row.id === input.invoiceId); if (!invoice) throw new DomainError("Invoice not found.", 404);
  if (["draft", "cancelled", "voided"].includes(String(invoice.status))) throw new DomainError("Payments can only be recorded against issued invoices.");
  if (Number(input.amountCents) > Number(invoice.balanceCents)) throw new DomainError("Payment exceeds outstanding invoice balance.");
  if (input.referenceNumber && rows.some((row) => row.organizationId === orgId && row.referenceNumber === input.referenceNumber && row.status !== "voided")) throw new DomainError("Payment reference number already exists.", 409);
  const payment = makeRow(orgId, { ...input, studentId: invoice.studentId, status: "recorded" }, "payment-" + Date.now()); rows.push(payment);
  invoice.paidAmountCents = Number(invoice.paidAmountCents) + Number(input.amountCents); invoice.balanceCents = Math.max(0, Number(invoice.totalCents) - Number(invoice.paidAmountCents)); invoice.status = invoiceStatus(invoice);
  const receipts = read<Row>("haza-aios.sis.finance.receipts"); const receipt = makeRow(orgId, { invoiceId: invoice.id, paymentId: payment.id, studentId: invoice.studentId, receiptNumber: nextDoc("RCT", orgId, receipts, "receiptNumber"), amountCents: payment.amountCents, paymentMethod: payment.paymentMethod, referenceNumber: payment.referenceNumber, receiptDate: payment.paymentDate }, "receipt-" + Date.now()); receipts.push(receipt);
  write("haza-aios.sis.finance.payments", rows); write("haza-aios.sis.finance.receipts", receipts); write("haza-aios.sis.finance.invoices", invoices); return json({ payment, receipt, invoice }, 201);
}

function voidPayment(orgId: string, id: string, input: Record<string, unknown>) { const payments = read<Row>("haza-aios.sis.finance.payments"); const payment = update(payments, orgId, id, { status: "voided", voidReason: input.reason, voidedBy: input.authorizedBy, voidedAt: new Date().toISOString() }, "Payment"); const invoices = read<Row>("haza-aios.sis.finance.invoices"); const invoice = invoices.find((row) => row.organizationId === orgId && row.id === payment.invoiceId); if (invoice) { invoice.paidAmountCents = Math.max(0, Number(invoice.paidAmountCents) - Number(payment.amountCents)); invoice.balanceCents = Math.max(0, Number(invoice.totalCents) - Number(invoice.paidAmountCents)); invoice.status = invoiceStatus(invoice); } write("haza-aios.sis.finance.payments", payments); write("haza-aios.sis.finance.invoices", invoices); return json({ payment }); }
function invoiceStatus(row: Row): string { if (["draft", "cancelled", "voided"].includes(String(row.status))) return String(row.status); if (Number(row.balanceCents) <= 0) return "paid"; if (Number(row.paidAmountCents) > 0) return "partially_paid"; return "issued"; }
function nextDoc(prefix: string, orgId: string, rows: Row[], field: string): string { return prefix + "-2026-" + String(rows.filter((row) => row.organizationId === orgId && typeof row[field] === "string").length + 1).padStart(5, "0"); }
function financeCollection(orgId: string, url: URL) { return read<Row>("haza-aios.sis.finance.invoices").filter((row) => row.organizationId === orgId && matches(row, url) && !["cancelled", "voided"].includes(String(row.status))).map((invoice) => ({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, studentId: invoice.studentId, totalCents: invoice.totalCents, paidCents: invoice.paidAmountCents, balanceCents: invoice.balanceCents, status: invoice.status })); }
function financeSummary(orgId: string) { const rows = read<Row>("haza-aios.sis.finance.invoices").filter((row) => row.organizationId === orgId && !["cancelled", "voided"].includes(String(row.status))); const totalBilledCents = rows.reduce((s, r) => s + Number(r.totalCents), 0); const totalCollectedCents = rows.reduce((s, r) => s + Number(r.paidAmountCents), 0); return { totalBilledCents, totalCollectedCents, outstandingCents: rows.reduce((s, r) => s + Number(r.balanceCents), 0), overdueCents: 0, collectionRate: totalBilledCents ? Math.round(totalCollectedCents / totalBilledCents * 10000) / 100 : 0, paymentsTodayCents: 0, outstandingStudents: new Set(rows.filter((r) => Number(r.balanceCents) > 0).map((r) => r.studentId)).size }; }
function financeLedger(orgId: string, studentId: string) { const receipts = read<Row>("haza-aios.sis.finance.receipts"); const entries = [...read<Row>("haza-aios.sis.finance.invoices").filter((row) => row.organizationId === orgId && row.studentId === studentId).map((invoice) => ({ id: "ledger-" + invoice.id, organizationId: orgId, studentId, invoiceId: invoice.id, type: "invoice", description: "Invoice " + invoice.invoiceNumber, debitCents: invoice.totalCents, creditCents: 0, occurredAt: invoice.issueDate })), ...read<Row>("haza-aios.sis.finance.payments").filter((row) => row.organizationId === orgId && row.studentId === studentId).map((payment) => ({ id: "ledger-" + payment.id, organizationId: orgId, studentId, invoiceId: payment.invoiceId, paymentId: payment.id, receiptId: receipts.find((r) => r.paymentId === payment.id)?.id, type: payment.status === "voided" ? "payment_void" : "payment", description: String(payment.status === "voided" ? "Voided payment " : "Payment ") + String(payment.referenceNumber || payment.id), debitCents: payment.status === "voided" ? payment.amountCents : 0, creditCents: payment.status === "voided" ? 0 : payment.amountCents, occurredAt: payment.paymentDate }))].sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt))); let balanceCents = 0; return entries.map((entry) => { balanceCents += Number(entry.debitCents) - Number(entry.creditCents); return { ...entry, balanceCents }; }); }
function financeGradeSummary(orgId: string) { const enrolls = read<EnrollmentRow>("haza-aios.sis.enrollments"); const rows = new Map<string, { gradeId: string; billedCents: number; collectedCents: number; outstandingCents: number }>(); for (const invoice of read<Row>("haza-aios.sis.finance.invoices").filter((row) => row.organizationId === orgId)) { const e = enrolls.find((item) => item.id === invoice.enrollmentId); if (!e) continue; const row = rows.get(e.gradeId) ?? { gradeId: e.gradeId, billedCents: 0, collectedCents: 0, outstandingCents: 0 }; row.billedCents += Number(invoice.totalCents); row.collectedCents += Number(invoice.paidAmountCents); row.outstandingCents += Number(invoice.balanceCents); rows.set(e.gradeId, row); } return Array.from(rows.values()); }

function communication(method: string, orgId: string, parts: string[], input: Record<string, unknown>, url: URL) {
  if (parts[1] === "audience" && parts[2] === "resolve") return json({ recipients: resolveAudience(orgId, input.audience as Record<string, unknown>, input.actor as Record<string, unknown> | undefined) });
  if (parts[1] === "templates" && parts[2] === "render") return json(renderTemplate(input.template as Record<string, unknown>, input.variables as Record<string, string>));
  if (parts[1] === "templates") { validateTemplateVariables(input); return crudCommunication(method, orgId, parts[2], input, "haza-aios.sis.communication.templates", "template", "templates"); }
  if (parts[1] === "announcements" && parts[3] === "publish") return publishAnnouncement(orgId, parts[2]);
  if (parts[1] === "announcements" && parts[3] === "archive") return archiveAnnouncement(orgId, parts[2]);
  if (parts[1] === "announcements") return announcementsMock(method, orgId, input);
  if (parts[1] === "messages") return messagesMock(method, orgId, input);
  if (parts[1] === "notifications" && parts[2] === "read-all") { const r = input.recipient as Record<string, unknown>; const rows = read<Row>("haza-aios.sis.communication.notifications"); let count = 0; rows.forEach((row) => { if (row.organizationId === orgId && row.recipientKind === r.kind && row.recipientId === r.id && !row.isRead) { row.isRead = true; row.readAt = new Date().toISOString(); count += 1; } }); write("haza-aios.sis.communication.notifications", rows); return json({ count }); }
  if (parts[1] === "notifications" && parts[3] === "read") { const rows = read<Row>("haza-aios.sis.communication.notifications"); const row = update(rows, orgId, parts[2], { isRead: true, readAt: new Date().toISOString() }, "Notification"); write("haza-aios.sis.communication.notifications", rows); return json({ notification: row }); }
  if (parts[1] === "notifications") return notificationsMock(method, orgId, input, url);
  if (parts[1] === "deliveries") return json({ deliveries: read<Row>("haza-aios.sis.communication.deliveries").filter((row) => row.organizationId === orgId) });
  if (parts[1] === "preferences") return crudCommunication(method, orgId, undefined, input, "haza-aios.sis.communication.preferences", "preference", "preferences");
  if (parts[1] === "domain-notifications") return json({ notifications: resolveAudience(orgId, input.audience as Record<string, unknown>).map((recipient) => createNotificationRow(orgId, { recipientKind: recipient.kind, recipientId: recipient.id, recipientUserId: recipient.userId, type: input.eventType, ...(input.payload as Record<string, unknown>) })) }, 201);
  if (parts[1] === "summary") { const a = read<Row>("haza-aios.sis.communication.announcements"); const m = read<Row>("haza-aios.sis.communication.messages"); const d = read<Row>("haza-aios.sis.communication.deliveries"); const n = read<Row>("haza-aios.sis.communication.notifications"); return json({ summary: { publishedAnnouncements: a.filter((x) => x.organizationId === orgId && x.status === "published").length, communicationsSent: m.filter((x) => x.organizationId === orgId && x.status === "sent").length, pendingDeliveries: d.filter((x) => x.organizationId === orgId && ["pending", "queued"].includes(String(x.status))).length, failedDeliveries: d.filter((x) => x.organizationId === orgId && x.status === "failed").length, unreadNotifications: n.filter((x) => x.organizationId === orgId && !x.isRead).length } }); }
  return json({ error: { code: "NOT_FOUND" } }, 404);
}

function crudCommunication(method: string, orgId: string, id: string | undefined, input: Record<string, unknown>, key: string, one: string, many: string) { const rows = read<Row>(key); if (method === "GET") return json({ [many]: rows.filter((row) => row.organizationId === orgId) }); if (method === "PATCH") { const row = update(rows, orgId, id, input, one); write(key, rows); return json({ [one]: row }); } const row = makeRow(orgId, input, one + "-" + Date.now()); rows.push(row); write(key, rows); return json({ [one]: row }, 201); }
function announcementsMock(method: string, orgId: string, input: Record<string, unknown>) { const rows = read<Row>("haza-aios.sis.communication.announcements"); if (method === "GET") return json({ announcements: rows.filter((row) => row.organizationId === orgId) }); const recipients = resolveAudience(orgId, input.audience as Record<string, unknown>, input.actor as Record<string, unknown> | undefined); const row = makeRow(orgId, { ...input, recipientCount: recipients.length, publishedAt: input.status === "published" ? new Date().toISOString() : undefined }, "announcement-" + Date.now()); rows.push(row); write("haza-aios.sis.communication.announcements", rows); if (row.status === "published") recipients.forEach((r) => createNotificationRow(orgId, { recipientKind: r.kind, recipientId: r.id, recipientUserId: r.userId, type: "announcement.published", title: row.title, message: row.content, priority: row.priority })); return json({ announcement: row }, 201); }
function publishAnnouncement(orgId: string, id: string) { const rows = read<Row>("haza-aios.sis.communication.announcements"); const row = update(rows, orgId, id, { status: "published", publishedAt: new Date().toISOString() }, "Announcement"); const recipients = resolveAudience(orgId, row.audience as Record<string, unknown>); row.recipientCount = recipients.length; write("haza-aios.sis.communication.announcements", rows); recipients.forEach((r) => createNotificationRow(orgId, { recipientKind: r.kind, recipientId: r.id, recipientUserId: r.userId, type: "announcement.published", title: row.title, message: row.content, priority: row.priority })); return json({ announcement: row }); }
function archiveAnnouncement(orgId: string, id: string) { const rows = read<Row>("haza-aios.sis.communication.announcements"); const row = update(rows, orgId, id, { status: "archived" }, "Announcement"); write("haza-aios.sis.communication.announcements", rows); return json({ announcement: row }); }
function messagesMock(method: string, orgId: string, input: Record<string, unknown>) { const rows = read<Row>("haza-aios.sis.communication.messages"); if (method === "GET") return json({ messages: rows.filter((row) => row.organizationId === orgId) }); if (input.actor) assertComm(input.actor as Record<string, unknown>); const existing = input.idempotencyKey ? rows.find((row) => row.organizationId === orgId && row.idempotencyKey === input.idempotencyKey) : undefined; if (existing) return json({ message: existing }, 201); const recipients = resolveAudience(orgId, input.audience as Record<string, unknown>, input.actor as Record<string, unknown> | undefined); const row = makeRow(orgId, { ...input, status: input.scheduledAt ? "scheduled" : "sent", recipientCount: recipients.length, sentAt: input.scheduledAt ? undefined : new Date().toISOString() }, "communication-" + Date.now()); rows.push(row); write("haza-aios.sis.communication.messages", rows); if (row.status === "sent") recipients.forEach((r) => (input.channels as unknown[]).forEach((channel) => { if (channel === "in_app") createNotificationRow(orgId, { recipientKind: r.kind, recipientId: r.id, recipientUserId: r.userId, type: "communication.sent", title: row.subject, message: row.body, priority: row.priority }); recordDeliveryRow(orgId, { communicationId: row.id, recipientId: r.id, recipientKind: r.kind, channel, status: channel === "in_app" ? "sent" : "queued" }); })); return json({ message: row }, 201); }
function notificationsMock(method: string, orgId: string, input: Record<string, unknown>, url: URL) { if (method === "GET") return json({ notifications: read<Row>("haza-aios.sis.communication.notifications").filter((row) => row.organizationId === orgId && (!url.searchParams.get("kind") || (row.recipientKind === url.searchParams.get("kind") && row.recipientId === url.searchParams.get("id")))) }); return json({ notification: createNotificationRow(orgId, input) }, 201); }
function createNotificationRow(orgId: string, input: Record<string, unknown>): Row { const rows = read<Row>("haza-aios.sis.communication.notifications"); const row = makeRow(orgId, { ...input, isRead: false }, "notification-" + Date.now() + "-" + rows.length); rows.push(row); write("haza-aios.sis.communication.notifications", rows); return row; }
function recordDeliveryRow(orgId: string, input: Record<string, unknown>): Row { const rows = read<Row>("haza-aios.sis.communication.deliveries"); const row = makeRow(orgId, { ...input, queuedAt: new Date().toISOString() }, "delivery-" + Date.now() + "-" + rows.length); rows.push(row); write("haza-aios.sis.communication.deliveries", rows); return row; }
function assertComm(actor: Record<string, unknown>) { if (!["Owner", "Admin", "Teacher"].includes(String(actor.role))) throw new DomainError("Unauthorized: missing permission communication.send", 403); }
function resolveAudience(orgId: string, audience: Record<string, unknown>, actor?: Record<string, unknown>): Array<Record<string, unknown>> { const type = String(audience.type); const students = read<StudentRow>("haza-aios.sis.students").filter((s) => s.organizationId === orgId && s.status === "active"); const staff = read<StaffRow>("haza-aios.sis.staff").filter((s) => s.organizationId === orgId && s.status === "active"); let selectedStudents: StudentRow[] = []; let selectedStaff: StaffRow[] = []; if (type === "organization") { selectedStudents = students; selectedStaff = staff; } else if (["all_students", "all_guardians"].includes(type)) selectedStudents = students; else if (type === "all_staff") selectedStaff = staff; else if (type === "all_teachers") selectedStaff = staff.filter((s) => s.staffType === "teacher"); else if (["class", "section"].includes(type)) { const enrolls = read<EnrollmentRow>("haza-aios.sis.enrollments").filter((e) => e.organizationId === orgId && e.academicYear === audience.academicYear && e.gradeId === audience.gradeId && (!audience.sectionId || e.sectionId === audience.sectionId) && e.status === "active"); selectedStudents = students.filter((s) => enrolls.some((e) => e.studentId === s.id)); if (actor?.role === "Teacher" && actor.staffId && !read<TeachingAssignmentRow>("haza-aios.sis.teaching_assignments").some((a) => a.organizationId === orgId && a.staffId === actor.staffId && a.gradeId === audience.gradeId && (!audience.sectionId || a.sectionId === audience.sectionId) && a.isActive)) throw new DomainError("Teacher is not authorized for this academic communication scope.", 403); } else if (type === "selected_students") selectedStudents = students.filter((s) => (audience.studentIds as unknown[] | undefined)?.includes(s.id)); else if (type === "selected_staff") selectedStaff = staff.filter((s) => (audience.staffIds as unknown[] | undefined)?.includes(s.id)); else if (type === "selected_guardians") selectedStudents = students.filter((s) => (s.guardians ?? []).some((g) => (audience.guardianIds as unknown[] | undefined)?.includes((g as Record<string, unknown>).id))); const recipients = [...(["organization", "all_students", "class", "section", "selected_students"].includes(type) ? selectedStudents.map((s) => ({ id: s.id, organizationId: orgId, kind: "student", displayName: (s.firstName + " " + s.lastName).trim(), studentId: s.id, email: s.email })) : []), ...(["organization", "all_guardians", "class", "section", "selected_guardians"].includes(type) ? selectedStudents.flatMap((s) => (s.guardians ?? []).filter((g) => type !== "selected_guardians" || (audience.guardianIds as unknown[] | undefined)?.includes((g as Record<string, unknown>).id)).map((g) => ({ id: String((g as Record<string, unknown>).id), organizationId: orgId, kind: "guardian", displayName: String((g as Record<string, unknown>).firstName) + " " + String((g as Record<string, unknown>).lastName), studentId: s.id, guardianId: String((g as Record<string, unknown>).id), userId: (g as Record<string, unknown>).userId as string | undefined }))) : []), ...selectedStaff.map((s) => ({ id: s.id, organizationId: orgId, kind: s.staffType === "teacher" ? "teacher" : "staff", displayName: String(s.firstName ?? "") + " " + String(s.lastName ?? ""), staffId: s.id, userId: s.userId as string | undefined }))]; const seen = new Set<string>(); return recipients.filter((r) => { const k = r.kind + ":" + r.id; if (seen.has(k)) return false; seen.add(k); return true; }); }
function validateTemplateVariables(input: Record<string, unknown>) { const allowed = new Set(["student_name", "guardian_name", "class_name", "section_name", "exam_name", "due_date", "amount", "school_name", "staff_name"]); for (const variable of (input.supportedVariables as string[] | undefined) ?? []) if (!allowed.has(variable)) throw new DomainError("Unsupported template variable: " + variable); }
function renderTemplate(template: Record<string, unknown>, variables: Record<string, string>) { const supported = new Set(template.supportedVariables as string[]); const render = (value: unknown) => String(value ?? "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => { if (!supported.has(key)) throw new DomainError("Unsupported template variable: " + key); return variables[key] || ""; }); return { subject: render(template.subject), content: render(template.content) }; }

function portal(method: string, orgId: string, parts: string[], input: Record<string, unknown>, url: URL) { if (parts[1] === "policy") { const rows = read<Row>("haza-aios.sis.portal.policies"); const existing = rows.find((row) => row.organizationId === orgId); if (method === "GET") return json({ policy: existing ?? { organizationId: orgId, studentFinanceVisible: false, studentMessagingEnabled: false, parentMessagingEnabled: true } }); const row = makeRow(orgId, { ...(existing ?? {}), ...input }, existing?.id ?? "portal-policy-" + Date.now()); if (existing) rows[rows.indexOf(existing)] = row; else rows.push(row); write("haza-aios.sis.portal.policies", rows); return json({ policy: row }); } if (parts[1] === "requests") { const rows = read<Row>("haza-aios.sis.portal.update-requests"); if (method === "GET") return json({ requests: rows.filter((row) => row.organizationId === orgId && row.requesterUserId === url.searchParams.get("userId") && row.requesterRole === url.searchParams.get("role")) }); const actor = input.actor as Record<string, unknown>; const req = input.input as Record<string, unknown>; const row = makeRow(orgId, { requesterUserId: actor.userId, requesterRole: actor.role, studentId: req.studentId, type: req.type, subject: req.subject, details: req.details, status: "submitted" }, "portal-request-" + Date.now()); rows.push(row); write("haza-aios.sis.portal.update-requests", rows); return json({ request: row }, 201); } return json({ error: { code: "NOT_FOUND" } }, 404); }

function analytics(orgId: string, parts: string[], url: URL) {
  const context = analyticsContext(orgId, url);
  if (parts[1] === "overview") return json({ overview: analyticsOverview(context, url) });
  if (parts[1] === "data-quality") return json({ issues: dataQuality(context) });
  if (parts[1] === "health") {
    const issues = dataQuality(context);
    const readiness = readinessRows(context, issues);
    const status = readiness.some((item) => item.status === "critical") || issues.some((issue) => issue.severity === "critical") ? "critical" : readiness.some((item) => item.status === "warning") || issues.some((issue) => issue.severity === "warning") ? "warning" : "healthy";
    return json({ health: { status, readiness, dataQuality: issues, modules: moduleCompletion(context) } });
  }
  return json({ error: { code: "NOT_FOUND" } }, 404);
}

function reports(orgId: string, parts: string[], url: URL) {
  const context = analyticsContext(orgId, url);
  const report = reportResult(String(parts[1]), context);
  if (parts[2] === "export") {
    const lines = [report.columns.map((column) => csvEscape(column.label)).join(",")];
    report.rows.forEach((row) => lines.push(report.columns.map((column) => csvEscape(row[column.key])).join(",")));
    return json({ csv: lines.join("\r\n") });
  }
  return json({ report });
}

function analyticsContext(orgId: string, url: URL) {
  const years = read<Row>("haza-aios.sis.academic-years").filter((row) => row.organizationId === orgId);
  const activeYear = url.searchParams.get("academicYearId")
    ? years.find((row) => row.id === url.searchParams.get("academicYearId")) ?? null
    : years.find((row) => row.status === "active") ?? years[0] ?? null;
  const grades = read<Row>("haza-aios.sis.grades").filter((row) => row.organizationId === orgId);
  const sections = read<Row>("haza-aios.sis.sections").filter((row) => row.organizationId === orgId);
  const subjects = read<Row>("haza-aios.sis.subjects").filter((row) => row.organizationId === orgId);
  const students = read<StudentRow>("haza-aios.sis.students").filter((row) => row.organizationId === orgId);
  const staffRows = read<StaffRow>("haza-aios.sis.staff").filter((row) => row.organizationId === orgId);
  const enrollmentsRows = read<EnrollmentRow>("haza-aios.sis.enrollments").filter((row) => row.organizationId === orgId && (!activeYear || row.academicYear === activeYear.name) && (!url.searchParams.get("gradeId") || row.gradeId === url.searchParams.get("gradeId")) && (!url.searchParams.get("sectionId") || row.sectionId === url.searchParams.get("sectionId")));
  const sessions = read<AttendanceSessionRow>("haza-aios.sis.attendance-sessions").filter((row) => row.organizationId === orgId && (!activeYear || row.academicYearId === activeYear.id) && matches(row, url) && dateInRangeForTest(row.date, url));
  const records = read<AttendanceRecordRow>("haza-aios.sis.attendance-records").filter((row) => row.organizationId === orgId);
  const periodsRows = read<TimePeriodRow>("haza-aios.sis.time-periods").filter((row) => row.organizationId === orgId);
  const timetableRows = read<TimetableEntryRow>("haza-aios.sis.timetable-entries").filter((row) => row.organizationId === orgId && (!activeYear || row.academicYearId === activeYear.id) && matches(row, url));
  const assignments = read<TeachingAssignmentRow>("haza-aios.sis.teaching_assignments").filter((row) => row.organizationId === orgId && (!activeYear || row.academicYear === activeYear.name));
  const examinationsRows = read<ExaminationRow>("haza-aios.sis.examinations").filter((row) => row.organizationId === orgId && (!activeYear || row.academicYearId === activeYear.id));
  const resultsRows = read<ResultPublicationRow>("haza-aios.sis.results").filter((row) => row.organizationId === orgId && (!activeYear || row.academicYearId === activeYear.id));
  const invoiceRows = read<Row>("haza-aios.sis.finance.invoices").filter((row) => row.organizationId === orgId && (!activeYear || row.academicYearId === activeYear.id));
  const deliveryRows = read<Row>("haza-aios.sis.communication.deliveries").filter((row) => row.organizationId === orgId);
  return { years, activeYear, grades, sections, subjects, students, staffRows, enrollmentsRows, sessions, records, periodsRows, timetableRows, assignments, examinationsRows, resultsRows, invoiceRows, deliveryRows, communications: read<Row>("haza-aios.sis.communication.messages").filter((row) => row.organizationId === orgId) };
}

function analyticsOverview(context: ReturnType<typeof analyticsContext>, url: URL) {
  const scopedStudentIds = new Set(context.enrollmentsRows.map((row) => row.studentId));
  const students = url.searchParams.get("gradeId") || url.searchParams.get("sectionId") ? context.students.filter((student) => scopedStudentIds.has(student.id)) : context.students;
  const attendance = attendanceSummary(context);
  const publishedMarks = context.resultsRows.filter((row) => row.status === "published").flatMap((row) => row.results.flatMap((result) => result.subjects));
  const totalBilledCents = context.invoiceRows.reduce((sum, row) => sum + Number(row.totalCents), 0);
  const totalCollectedCents = context.invoiceRows.reduce((sum, row) => sum + Number(row.paidAmountCents), 0);
  return {
    students: { total: students.length, active: students.filter((row) => row.status === "active").length, admissions: students.filter((row) => dateInRangeForTest(row.admissionDate, url)).length, withdrawals: students.filter((row) => ["withdrawn", "transferred"].includes(row.status)).length, byStatus: dist(students.map((row) => row.status)), byClass: dist(context.enrollmentsRows.map((row) => String(context.grades.find((grade) => grade.id === row.gradeId)?.name ?? "Unassigned"))) },
    staff: { total: context.staffRows.length, activeTeachers: context.staffRows.filter((row) => row.status === "active" && row.staffType === "teacher").length, activeStaff: context.staffRows.filter((row) => row.status === "active").length, teachersWithoutAssignments: context.staffRows.filter((row) => row.status === "active" && row.staffType === "teacher" && !context.assignments.some((assignment) => assignment.staffId === row.id && assignment.isActive)).length },
    attendance,
    academics: { academicYears: context.years.length, activeAcademicYears: context.years.filter((row) => row.status === "active").length, grades: context.grades.length, sections: context.sections.length, subjects: context.subjects.length },
    timetable: { scheduledClasses: context.timetableRows.length, teacherLoad: dist(context.timetableRows.map((row) => String(context.staffRows.find((staff) => staff.id === row.teacherId)?.firstName ?? "Unassigned Teacher"))), periodUtilization: dist(context.timetableRows.map((row) => String(context.periodsRows.find((period) => period.id === row.periodId)?.name ?? "Unknown Period"))) },
    results: { examinations: context.examinationsRows.length, publishedResults: context.resultsRows.filter((row) => row.status === "published").length, passRate: pct(publishedMarks.filter((row) => row.passed).length, publishedMarks.length), averagePerformance: publishedMarks.length ? Math.round(publishedMarks.reduce((sum, row) => sum + row.percentage, 0) / publishedMarks.length * 100) / 100 : 0 },
    finance: { totalBilledCents, totalCollectedCents, outstandingCents: context.invoiceRows.reduce((sum, row) => sum + Number(row.balanceCents), 0), overdueCents: 0, collectionRate: pct(totalCollectedCents, totalBilledCents), paymentsTodayCents: 0, outstandingStudents: new Set(context.invoiceRows.filter((row) => Number(row.balanceCents) > 0).map((row) => row.studentId)).size },
    communication: { publishedAnnouncements: read<Row>("haza-aios.sis.communication.announcements").filter((row) => row.organizationId === context.students[0]?.organizationId && row.status === "published").length, communicationsSent: context.communications.filter((row) => row.status === "sent").length, pendingDeliveries: context.deliveryRows.filter((row) => ["pending", "queued"].includes(String(row.status))).length, failedDeliveries: context.deliveryRows.filter((row) => row.status === "failed").length, unreadNotifications: read<Row>("haza-aios.sis.communication.notifications").filter((row) => row.organizationId === context.students[0]?.organizationId && !row.isRead).length },
    portal: { linkedParentAccounts: linkedParents(context.students), linkedStudentAccounts: context.students.filter((row) => row.userId).length, portalReadyStudents: context.students.filter((row) => row.portalAccessEnabled !== false && (row.userId || row.guardians?.some((guardian) => (guardian as Record<string, unknown>).portalAccessEnabled))).length },
  };
}

function reportResult(kind: string, context: ReturnType<typeof analyticsContext>) {
  const generatedAt = new Date().toISOString();
  const reports: Record<string, { kind: string; title: string; columns: Array<{ key: string; label: string }>; rows: Array<Record<string, string | number | boolean | null>>; generatedAt: string }> = {
    student_directory: { kind, title: "Student Directory Report", generatedAt, columns: [{ key: "admissionNumber", label: "Admission Number" }, { key: "name", label: "Name" }, { key: "status", label: "Status" }, { key: "class", label: "Class" }, { key: "section", label: "Section" }, { key: "guardianCount", label: "Guardian Count" }], rows: context.students.map((student) => { const enrollment = context.enrollmentsRows.find((row) => row.studentId === student.id); return { admissionNumber: student.admissionNumber, name: `${student.firstName} ${student.lastName}`.trim(), status: student.status, class: String(context.grades.find((grade) => grade.id === enrollment?.gradeId)?.name ?? ""), section: String(context.sections.find((section) => section.id === enrollment?.sectionId)?.name ?? ""), guardianCount: student.guardians?.length ?? 0 }; }) },
    attendance_summary: { kind, title: "Attendance Summary Report", generatedAt, columns: [{ key: "date", label: "Date" }, { key: "class", label: "Class" }, { key: "section", label: "Section" }, { key: "status", label: "Session Status" }, { key: "present", label: "Present" }, { key: "absent", label: "Absent" }, { key: "late", label: "Late" }, { key: "excused", label: "Excused" }], rows: context.sessions.map((session) => { const records = context.records.filter((record) => record.sessionId === session.id); return { date: session.date, class: String(context.grades.find((grade) => grade.id === session.gradeId)?.name ?? ""), section: String(context.sections.find((section) => section.id === session.sectionId)?.name ?? ""), status: session.status, present: records.filter((record) => record.status === "present").length, absent: records.filter((record) => record.status === "absent").length, late: records.filter((record) => record.status === "late").length, excused: records.filter((record) => record.status === "excused").length }; }) },
    results_summary: { kind, title: "Published Results Report", generatedAt, columns: [{ key: "examination", label: "Examination" }, { key: "class", label: "Class" }, { key: "section", label: "Section" }, { key: "studentCount", label: "Students" }, { key: "passRate", label: "Pass Rate" }, { key: "average", label: "Average" }], rows: context.resultsRows.filter((row) => row.status === "published").map((row) => { const subjectRows = row.results.flatMap((student) => student.subjects); return { examination: String(context.examinationsRows.find((exam) => exam.id === row.examinationId)?.name ?? ""), class: String(context.grades.find((grade) => grade.id === row.gradeId)?.name ?? ""), section: String(context.sections.find((section) => section.id === row.sectionId)?.name ?? ""), studentCount: row.results.length, passRate: pct(subjectRows.filter((subject) => subject.passed).length, subjectRows.length), average: subjectRows.length ? Math.round(subjectRows.reduce((sum, subject) => sum + subject.percentage, 0) / subjectRows.length * 100) / 100 : 0 }; }) },
    finance_collection: { kind, title: "Finance Collection Report", generatedAt, columns: [{ key: "invoiceNumber", label: "Invoice Number" }, { key: "student", label: "Student" }, { key: "status", label: "Status" }, { key: "totalCents", label: "Total Cents" }, { key: "paidCents", label: "Paid Cents" }, { key: "balanceCents", label: "Balance Cents" }], rows: context.invoiceRows.filter((row) => row.status !== "draft" && row.status !== "voided").map((row) => { const student = context.students.find((item) => item.id === row.studentId); return { invoiceNumber: String(row.invoiceNumber), student: student ? `${student.firstName} ${student.lastName}`.trim() : "", status: String(row.status), totalCents: Number(row.totalCents), paidCents: Number(row.paidAmountCents), balanceCents: Number(row.balanceCents) }; }) },
    staff_directory: { kind, title: "Staff Directory Report", generatedAt, columns: [{ key: "employeeNumber", label: "Employee Number" }, { key: "name", label: "Name" }, { key: "staffType", label: "Staff Type" }, { key: "status", label: "Status" }, { key: "assignmentCount", label: "Active Assignments" }], rows: context.staffRows.map((row) => ({ employeeNumber: row.employeeNumber, name: `${String(row.firstName ?? "")} ${String(row.lastName ?? "")}`.trim(), staffType: row.staffType, status: row.status, assignmentCount: context.assignments.filter((assignment) => assignment.staffId === row.id && assignment.isActive).length })) },
    timetable_summary: { kind, title: "Timetable Summary Report", generatedAt, columns: [{ key: "day", label: "Day" }, { key: "period", label: "Period" }, { key: "class", label: "Class" }, { key: "section", label: "Section" }, { key: "subject", label: "Subject" }, { key: "teacher", label: "Teacher" }, { key: "room", label: "Room" }], rows: context.timetableRows.map((row) => ({ day: row.dayOfWeek, period: String(context.periodsRows.find((period) => period.id === row.periodId)?.name ?? ""), class: String(context.grades.find((grade) => grade.id === row.gradeId)?.name ?? ""), section: String(context.sections.find((section) => section.id === row.sectionId)?.name ?? ""), subject: String(context.subjects.find((subject) => subject.id === row.subjectId)?.name ?? ""), teacher: String(context.staffRows.find((staff) => staff.id === row.teacherId)?.firstName ?? ""), room: row.roomId ?? "" })) },
    communication_delivery: { kind, title: "Communication Delivery Report", generatedAt, columns: [{ key: "channel", label: "Channel" }, { key: "recipientKind", label: "Recipient Kind" }, { key: "status", label: "Status" }, { key: "queuedAt", label: "Queued At" }, { key: "retryCount", label: "Retry Count" }], rows: context.deliveryRows.map((row) => ({ channel: String(row.channel), recipientKind: String(row.recipientKind), status: String(row.status), queuedAt: String(row.queuedAt ?? ""), retryCount: Number(row.retryCount ?? 0) })) },
  };
  return reports[kind] ?? reports.student_directory;
}

function attendanceSummary(context: ReturnType<typeof analyticsContext>) { const records = context.records.filter((record) => context.sessions.some((session) => session.id === record.sessionId)); const present = records.filter((record) => record.status === "present").length; const absent = records.filter((record) => record.status === "absent").length; const late = records.filter((record) => record.status === "late").length; const excused = records.filter((record) => record.status === "excused").length; return { totalSessions: records.length, present, absent, late, excused, attendancePercentage: pct(present + late, present + absent + late), completedSessions: context.sessions.filter((row) => row.status === "completed").length, draftSessions: context.sessions.filter((row) => row.status === "draft").length }; }
function dataQuality(context: ReturnType<typeof analyticsContext>) { const issues: Array<Record<string, string>> = []; const activeEnrollments = new Set(context.enrollmentsRows.filter((row) => row.status === "active").map((row) => row.studentId)); context.students.forEach((student) => { if (student.status === "active" && !activeEnrollments.has(student.id)) issues.push({ id: `student-no-enrollment-${student.id}`, category: "Students", severity: "critical", title: "Active student without current enrollment", details: `${student.admissionNumber} is active but not enrolled.`, relatedResourceType: "student", relatedResourceId: student.id }); if (!student.guardians?.length) issues.push({ id: `student-no-guardian-${student.id}`, category: "Students", severity: "warning", title: "Student missing guardian", details: `${student.admissionNumber} has no guardian contacts.`, relatedResourceType: "student", relatedResourceId: student.id }); }); context.examinationsRows.filter((exam) => exam.status === "completed" && !context.resultsRows.some((result) => result.examinationId === exam.id && result.status === "published")).forEach((exam) => issues.push({ id: `exam-unpublished-${exam.id}`, category: "Results", severity: "warning", title: "Completed exam without published results", details: `${exam.name} is completed but no published result was found.`, relatedResourceType: "examination", relatedResourceId: exam.id })); return issues; }
function readinessRows(context: ReturnType<typeof analyticsContext>, issues: Array<Record<string, string>>) { const statusFor = (condition: boolean, warning: boolean) => condition ? "healthy" : warning ? "warning" : "critical"; return [{ key: "active-year", label: "Active Academic Year", status: statusFor(Boolean(context.activeYear), false), details: context.activeYear ? String(context.activeYear.name) : "No active academic year configured." }, { key: "academic-structure", label: "Academic Structure", status: statusFor(context.grades.length > 0 && context.sections.length > 0 && context.subjects.length > 0, false), details: `${context.grades.length} classes, ${context.sections.length} sections, ${context.subjects.length} subjects.` }, { key: "students", label: "Student Management", status: statusFor(context.students.length > 0, false), details: `${context.students.length} students available.` }, { key: "data-quality", label: "Data Quality", status: issues.some((issue) => issue.severity === "critical") ? "critical" : issues.length ? "warning" : "healthy", details: `${issues.length} operational issue(s) detected.` }]; }
function moduleCompletion(context: ReturnType<typeof analyticsContext>) { return [{ epic: "10A", module: "Students", status: context.students.length > 0 ? "complete" : "partial", details: `${context.students.length} student records.` }, { epic: "10B", module: "Staff & Teachers", status: context.staffRows.length > 0 ? "complete" : "partial", details: `${context.staffRows.length} staff records.` }, { epic: "10C", module: "Academic Structure", status: context.grades.length && context.sections.length && context.subjects.length ? "complete" : "partial", details: `${context.grades.length}/${context.sections.length}/${context.subjects.length} class-section-subject records.` }, { epic: "10D", module: "Attendance", status: context.sessions.length > 0 ? "complete" : "partial", details: `${context.sessions.length} attendance sessions.` }, { epic: "10E", module: "Timetable", status: context.timetableRows.length > 0 ? "complete" : "partial", details: `${context.timetableRows.length} timetable entries.` }, { epic: "10F", module: "Examination & Results", status: context.resultsRows.some((row) => row.status === "published") ? "complete" : "partial", details: `${context.resultsRows.length} result publications.` }, { epic: "10G", module: "Fees & Finance", status: context.invoiceRows.length > 0 ? "complete" : "partial", details: `${context.invoiceRows.length} invoices.` }, { epic: "10H", module: "Communication", status: context.communications.length || context.deliveryRows.length ? "complete" : "partial", details: `${context.deliveryRows.length} delivery attempts.` }, { epic: "10I", module: "Parent/Student Portal", status: linkedParents(context.students) > 0 ? "complete" : "partial", details: `${linkedParents(context.students)} linked parent accounts.` }]; }
function dateInRangeForTest(value: unknown, url: URL) { const date = String(value ?? "").split("T")[0]; return (!url.searchParams.get("dateFrom") || date >= String(url.searchParams.get("dateFrom"))) && (!url.searchParams.get("dateTo") || date <= String(url.searchParams.get("dateTo"))); }
function dist(values: string[]) { const map = new Map<string, number>(); values.forEach((value) => map.set(value, (map.get(value) ?? 0) + 1)); return Array.from(map.entries()).map(([label, value]) => ({ label, value })); }
function linkedParents(students: StudentRow[]) { const ids = new Set<string>(); students.forEach((student) => student.guardians?.forEach((guardian) => { const row = guardian as Record<string, unknown>; if (row.userId && row.portalAccessEnabled) ids.add(String(row.userId)); })); return ids.size; }
function pct(numerator: number, denominator: number) { return denominator > 0 ? Math.round(numerator / denominator * 10000) / 100 : 0; }
function csvEscape(value: unknown) { const raw = value === null || value === undefined ? "" : String(value); return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw; }
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
