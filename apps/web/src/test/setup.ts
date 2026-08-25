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
