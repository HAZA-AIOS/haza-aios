import { ApiError } from "../../../common/errors/api-error.js";

export interface ValidationDetail {
  field: string;
  message: string;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function throwValidation(field: string, message: string): never {
  throw new ApiError(400, "VALIDATION_FAILED", "Request validation failed.", [
    { field, message },
  ]);
}

export function throwValidationMultiple(details: ValidationDetail[]): never {
  throw new ApiError(
    400,
    "VALIDATION_FAILED",
    "Request validation failed.",
    details
  );
}

export function assertRecord(input: unknown, entityName = "Request body"): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwValidation("body", `${entityName} must be a valid JSON object.`);
  }

  // Prevent prototype pollution attacks
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throwValidation(key, `Invalid or unsafe property key "${key}".`);
    }
  }

  return input as Record<string, unknown>;
}

export function requireText(value: unknown, field: string, min = 1, max = 255): string {
  if (value === undefined || value === null || typeof value !== "string") {
    throwValidation(field, `${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    throwValidation(field, `${field} must contain at least ${min} character(s).`);
  }
  if (trimmed.length > max) {
    throwValidation(field, `${field} must not exceed ${max} characters.`);
  }
  return trimmed;
}

export function optionalText(value: unknown, field: string, min = 1, max = 1000): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throwValidation(field, `${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length < min) {
    throwValidation(field, `${field} must contain at least ${min} character(s).`);
  }
  if (trimmed.length > max) {
    throwValidation(field, `${field} must not exceed ${max} characters.`);
  }
  return trimmed;
}

export function requireNumber(value: unknown, field: string, min?: number, max?: number): number {
  if (value === undefined || value === null || typeof value !== "number" || isNaN(value) || !Number.isFinite(value)) {
    throwValidation(field, `${field} must be a valid number.`);
  }
  if (min !== undefined && value < min) {
    throwValidation(field, `${field} must be at least ${min}.`);
  }
  if (max !== undefined && value > max) {
    throwValidation(field, `${field} must not exceed ${max}.`);
  }
  return value;
}

export function optionalNumber(value: unknown, field: string, min?: number, max?: number): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return requireNumber(value, field, min, max);
}

export function requirePositiveCents(value: unknown, field: string): number {
  const num = requireNumber(value, field, 1);
  return Math.round(num);
}

export function optionalPositiveCents(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return requirePositiveCents(value, field);
}

export function requireDateString(value: unknown, field: string): string {
  const text = requireText(value, field, 10, 20);
  if (!DATE_REGEX.test(text.slice(0, 10))) {
    throwValidation(field, `${field} must be a valid date in YYYY-MM-DD format.`);
  }
  return text;
}

export function optionalDateString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requireDateString(value, field);
}

export function requireEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  const text = requireText(value, field);
  if (!allowed.includes(text as T)) {
    throwValidation(field, `${field} must be one of: ${allowed.join(", ")}.`);
  }
  return text as T;
}

export function optionalEnum<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (value === undefined || value === null) return undefined;
  return requireEnum(value, field, allowed);
}

export function optionalEmail(value: unknown, field: string): string | undefined {
  const text = optionalText(value, field, 3, 255);
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (!EMAIL_REGEX.test(lower)) {
    throwValidation(field, `${field} must be a valid email address.`);
  }
  return lower;
}

export function requireArray<T>(value: unknown, field: string, minLength = 0): T[] {
  if (!Array.isArray(value)) {
    throwValidation(field, `${field} must be an array.`);
  }
  if (value.length < minLength) {
    throwValidation(field, `${field} must contain at least ${minLength} item(s).`);
  }
  return value as T[];
}

// ==========================================
// Specific Education Validators
// ==========================================

export function validateCreateAcademicYear(input: unknown) {
  const rec = assertRecord(input, "Academic year");
  const name = requireText(rec.name, "name", 1, 120);
  const startDate = requireDateString(rec.startDate, "startDate");
  const endDate = requireDateString(rec.endDate, "endDate");
  if (new Date(startDate) > new Date(endDate)) {
    throwValidation("endDate", "End date must be on or after start date.");
  }
  const status = optionalEnum(rec.status, "status", ["planned", "active", "completed", "archived"] as const) ?? "planned";
  return { ...rec, name, startDate, endDate, status };
}

export function validateUpdateAcademicYear(input: unknown) {
  const rec = assertRecord(input, "Academic year update");
  const name = optionalText(rec.name, "name", 1, 120);
  const startDate = optionalDateString(rec.startDate, "startDate");
  const endDate = optionalDateString(rec.endDate, "endDate");
  const status = optionalEnum(rec.status, "status", ["planned", "active", "completed", "archived"] as const);
  return { ...rec, ...(name ? { name } : {}), ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}), ...(status ? { status } : {}) };
}

export function validateCreateGrade(input: unknown) {
  const rec = assertRecord(input, "Grade level");
  const name = requireText(rec.name, "name", 1, 120);
  const level = requireNumber(rec.level, "level", 0, 50);
  const order = optionalNumber(rec.order, "order", 0);
  const status = optionalEnum(rec.status, "status", ["active", "archived"] as const) ?? "active";
  return { ...rec, name, level, ...(order !== undefined ? { order } : {}), status };
}

export function validateCreateSection(input: unknown) {
  const rec = assertRecord(input, "Section");
  const gradeId = requireText(rec.gradeId, "gradeId", 1, 64);
  const name = requireText(rec.name, "name", 1, 80);
  const capacity = optionalNumber(rec.capacity, "capacity", 1, 1000) ?? 30;
  const status = optionalEnum(rec.status, "status", ["active", "archived"] as const) ?? "active";
  return { ...rec, gradeId, name, capacity, status };
}

export function validateCreateStudent(input: unknown) {
  const rec = assertRecord(input, "Student");
  const firstName = requireText(rec.firstName, "firstName", 1, 120);
  const lastName = requireText(rec.lastName, "lastName", 1, 120);
  const admissionDate = requireDateString(rec.admissionDate, "admissionDate");
  const dateOfBirth = optionalDateString(rec.dateOfBirth, "dateOfBirth");
  const gender = optionalEnum(rec.gender, "gender", ["male", "female", "other"] as const);
  const email = optionalEmail(rec.email, "email");
  const phone = optionalText(rec.phone, "phone", 1, 80);
  const address = optionalText(rec.address, "address", 1, 1000);
  const admissionNumber = optionalText(rec.admissionNumber, "admissionNumber", 1, 80);
  const status = optionalEnum(rec.status, "status", ["applicant", "active", "suspended", "graduated", "withdrawn", "archived"] as const) ?? "applicant";

  if (rec.guardians !== undefined && !Array.isArray(rec.guardians)) {
    throwValidation("guardians", "guardians must be an array.");
  }

  return {
    ...rec,
    firstName,
    lastName,
    admissionDate,
    ...(dateOfBirth ? { dateOfBirth } : {}),
    ...(gender ? { gender } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    ...(admissionNumber ? { admissionNumber } : {}),
    status,
  };
}

export function validateUpdateStudent(input: unknown) {
  const rec = assertRecord(input, "Student update");
  const firstName = optionalText(rec.firstName, "firstName", 1, 120);
  const lastName = optionalText(rec.lastName, "lastName", 1, 120);
  const dateOfBirth = optionalDateString(rec.dateOfBirth, "dateOfBirth");
  const gender = optionalEnum(rec.gender, "gender", ["male", "female", "other"] as const);
  const email = optionalEmail(rec.email, "email");
  const phone = optionalText(rec.phone, "phone", 1, 80);
  const address = optionalText(rec.address, "address", 1, 1000);
  const status = optionalEnum(rec.status, "status", ["applicant", "active", "suspended", "graduated", "withdrawn", "archived"] as const);

  return {
    ...rec,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(dateOfBirth ? { dateOfBirth } : {}),
    ...(gender ? { gender } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    ...(status ? { status } : {}),
  };
}

export function validateCreateEnrollment(input: unknown) {
  const rec = assertRecord(input, "Enrollment");
  const studentId = requireText(rec.studentId, "studentId", 1, 64);
  const academicYear = requireText(rec.academicYear, "academicYear", 1, 120);
  const gradeId = requireText(rec.gradeId, "gradeId", 1, 64);
  const sectionId = requireText(rec.sectionId, "sectionId", 1, 64);
  const enrollmentDate = requireDateString(rec.enrollmentDate, "enrollmentDate");
  const status = optionalEnum(rec.status, "status", ["active", "transferred", "dropped", "graduated", "suspended"] as const) ?? "active";

  return { ...rec, studentId, academicYear, gradeId, sectionId, enrollmentDate, status };
}

export function validateTransferStudent(input: unknown) {
  const rec = assertRecord(input, "Student transfer");
  const sectionId = requireText(rec.sectionId, "sectionId", 1, 64);
  const gradeId = optionalText(rec.gradeId, "gradeId", 1, 64);
  const academicYear = optionalText(rec.academicYear, "academicYear", 1, 120);

  return { ...rec, sectionId, ...(gradeId ? { gradeId } : {}), ...(academicYear ? { academicYear } : {}) };
}

export function validateCreateAttendanceSession(input: unknown) {
  const rec = assertRecord(input, "Attendance session");
  const academicYearId = requireText(rec.academicYearId, "academicYearId", 1, 64);
  const attendanceDate = requireDateString(rec.attendanceDate ?? rec.date, "attendanceDate");
  const gradeId = requireText(rec.gradeId, "gradeId", 1, 64);
  const sectionId = requireText(rec.sectionId, "sectionId", 1, 64);
  const sessionType = optionalEnum(rec.sessionType, "sessionType", ["daily", "subject"] as const) ?? "daily";
  const subjectId = optionalText(rec.subjectId, "subjectId", 1, 64);
  const teacherId = optionalText(rec.teacherId, "teacherId", 1, 64);

  return {
    ...rec,
    academicYearId,
    attendanceDate,
    gradeId,
    sectionId,
    sessionType,
    ...(subjectId ? { subjectId } : {}),
    ...(teacherId ? { teacherId } : {}),
  };
}

export function validateRecordAttendance(input: unknown) {
  const rec = assertRecord(input, "Attendance records");
  const records = requireArray(rec.records, "records", 0);
  for (const item of records) {
    if (!item || typeof item !== "object") {
      throwValidation("records", "Each attendance record must be an object.");
    }
    const r = item as Record<string, unknown>;
    requireText(r.studentId, "studentId", 1, 64);
    requireEnum(r.status, "status", ["present", "absent", "late", "excused", "half_day"] as const);
  }
  const markedBy = optionalText(rec.markedBy, "markedBy", 1, 120);
  return { ...rec, records, markedBy };
}

export function validateCreateStaff(input: unknown) {
  const rec = assertRecord(input, "Staff member");
  const firstName = requireText(rec.firstName, "firstName", 1, 120);
  const lastName = requireText(rec.lastName, "lastName", 1, 120);
  const hireDate = requireDateString(rec.hireDate, "hireDate");
  const staffType = requireText(rec.staffType, "staffType", 1, 80);
  const employmentStatus = optionalText(rec.employmentStatus, "employmentStatus", 1, 80) ?? "full_time";
  const status = optionalEnum(rec.status, "status", ["active", "on_leave", "terminated", "archived"] as const) ?? "active";
  const departmentId = optionalText(rec.departmentId, "departmentId", 1, 64);
  const email = optionalEmail(rec.email, "email");
  const phone = optionalText(rec.phone, "phone", 1, 80);

  return {
    ...rec,
    firstName,
    lastName,
    hireDate,
    staffType,
    employmentStatus,
    status,
    ...(departmentId ? { departmentId } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };
}

export function validateCreateTeachingAssignment(input: unknown) {
  const rec = assertRecord(input, "Teaching assignment");
  const staffId = requireText(rec.staffId, "staffId", 1, 64);
  const academicYear = requireText(rec.academicYear, "academicYear", 1, 120);
  const gradeId = requireText(rec.gradeId, "gradeId", 1, 64);
  const subjectId = requireText(rec.subjectId, "subjectId", 1, 64);
  const sectionId = optionalText(rec.sectionId, "sectionId", 1, 64);
  const isActive = rec.isActive === undefined ? true : Boolean(rec.isActive);

  return { ...rec, staffId, academicYear, gradeId, subjectId, ...(sectionId ? { sectionId } : {}), isActive };
}

export function validateCreateEnquiry(input: unknown) {
  const rec = assertRecord(input, "Admissions enquiry");
  const studentName = requireText(rec.studentName, "studentName", 1, 180);
  const guardianName = requireText(rec.guardianName, "guardianName", 1, 180);
  const phone = requireText(rec.phone, "phone", 1, 80);
  const desiredGradeId = requireText(rec.desiredGradeId, "desiredGradeId", 1, 64);
  const email = optionalEmail(rec.email, "email");
  const enquiryDate = optionalDateString(rec.enquiryDate, "enquiryDate");
  const followUpDate = optionalDateString(rec.followUpDate, "followUpDate");
  const preferredCampus = optionalText(rec.preferredCampus, "preferredCampus", 1, 180);
  const previousSchool = optionalText(rec.previousSchool, "previousSchool", 1, 180);
  const notes = optionalText(rec.notes, "notes", 0, 2000);

  return {
    ...rec,
    studentName,
    guardianName,
    phone,
    desiredGradeId,
    ...(email ? { email } : {}),
    ...(enquiryDate ? { enquiryDate } : {}),
    ...(followUpDate ? { followUpDate } : {}),
    ...(preferredCampus ? { preferredCampus } : {}),
    ...(previousSchool ? { previousSchool } : {}),
    ...(notes !== undefined ? { notes } : {}),
  };
}

export function validateCreateApplication(input: unknown) {
  const rec = assertRecord(input, "Admissions application");
  const academicYearId = requireText(rec.academicYearId, "academicYearId", 1, 64);
  const gradeId = requireText(rec.gradeId, "gradeId", 1, 64);

  return { ...rec, academicYearId, gradeId };
}

export function validateCreateInvoice(input: unknown) {
  const rec = assertRecord(input, "Finance invoice");
  const studentId = requireText(rec.studentId, "studentId", 1, 64);
  const academicYearId = requireText(rec.academicYearId, "academicYearId", 1, 64);
  const amountCents = optionalPositiveCents(rec.amountCents, "amountCents");
  const issueDate = rec.issueDate ? requireDateString(rec.issueDate, "issueDate") : new Date().toISOString().slice(0, 10);
  const dueDate = requireDateString(rec.dueDate, "dueDate");
  if (new Date(issueDate) > new Date(dueDate)) {
    throwValidation("dueDate", "Due date must be on or after issue date.");
  }
  return { ...rec, studentId, academicYearId, ...(amountCents !== undefined ? { amountCents } : {}), issueDate, dueDate };
}

export function validateRecordPayment(input: unknown) {
  const rec = assertRecord(input, "Payment record");
  const invoiceId = requireText(rec.invoiceId, "invoiceId", 1, 64);
  const amountCents = requirePositiveCents(rec.amountCents, "amountCents");
  const paymentDate = requireDateString(rec.paymentDate, "paymentDate");
  const paymentMethod = requireText(rec.paymentMethod, "paymentMethod", 1, 40);
  const referenceNumber = optionalText(rec.referenceNumber, "referenceNumber", 1, 120);

  return { ...rec, invoiceId, amountCents, paymentDate, paymentMethod, ...(referenceNumber ? { referenceNumber } : {}) };
}

export function validateGenerateRecurringInvoices(input: unknown) {
  const rec = assertRecord(input, "Recurring invoice generation");
  const academicYearId = requireText(rec.academicYearId, "academicYearId", 1, 64);
  const billingPeriod = requireText(rec.billingPeriod, "billingPeriod", 1, 40);
  const rawIds = Array.isArray(rec.feeStructureIds)
    ? rec.feeStructureIds
    : rec.feeStructureId
    ? [rec.feeStructureId]
    : [];
  const feeStructureIds = requireArray<string>(rawIds, "feeStructureIds", 1);
  const issueDate = rec.issueDate ? requireDateString(rec.issueDate, "issueDate") : new Date().toISOString().slice(0, 10);
  const dueDate = requireDateString(rec.dueDate, "dueDate");
  if (new Date(issueDate) > new Date(dueDate)) {
    throwValidation("dueDate", "Issue date must be before due date.");
  }
  const gradeId = optionalText(rec.gradeId, "gradeId", 1, 64);
  const sectionId = optionalText(rec.sectionId, "sectionId", 1, 64);
  const issueNow = Boolean(rec.issueNow);

  return {
    ...rec,
    academicYearId,
    billingPeriod,
    feeStructureIds,
    issueDate,
    dueDate,
    ...(gradeId ? { gradeId } : {}),
    ...(sectionId ? { sectionId } : {}),
    issueNow,
  };
}

export function validateCreateExpense(input: unknown) {
  const rec = assertRecord(input, "Expense");
  const categoryId = requireText(rec.categoryId, "categoryId", 1, 64);
  const title = requireText(rec.title, "title", 1, 255);
  const amountCents = requirePositiveCents(rec.amountCents, "amountCents");
  const expenseDate = requireDateString(rec.expenseDate, "expenseDate");
  const payee = requireText(rec.payee, "payee", 1, 180);
  const paymentMethod = optionalText(rec.paymentMethod, "paymentMethod", 1, 40) ?? "bank_transfer";

  return { ...rec, categoryId, title, amountCents, expenseDate, payee, paymentMethod };
}

export function validateCreateIncome(input: unknown) {
  const rec = assertRecord(input, "Income");
  const source = requireText(rec.source, "source", 1, 160);
  const category = requireText(rec.category, "category", 1, 80);
  const amountCents = requirePositiveCents(rec.amountCents, "amountCents");
  const receivedDate = requireDateString(rec.receivedDate, "receivedDate");
  const paymentMethod = optionalText(rec.paymentMethod, "paymentMethod", 1, 40) ?? "cash";

  return { ...rec, source, category, amountCents, receivedDate, paymentMethod };
}
