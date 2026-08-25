import { and, asc, desc, eq, ne } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../common/errors/api-error.js";
import type { DatabaseClient } from "../../database/client.js";
import { mapDatabaseError } from "../../database/errors.js";
import { createRepositoryContext } from "../../database/repositories/repository-context.js";
import { withTransaction } from "../../database/transactions.js";
import {
  academicTerms,
  academicYears,
  classSubjects,
  enrollments,
  gradeLevels,
  guardians,
  sections,
  staffDepartments,
  staffMembers,
  students,
  studentGuardians,
  subjects,
  teachingAssignments,
} from "../../database/schema.js";
import { OrganizationModuleRepository } from "../platform/repositories/organization-module.repository.js";
import { WorkspaceRepository } from "../platform/repositories/workspace.repository.js";

const educationModuleKey = "education-sis";
type JsonRecord = Record<string, unknown>;

type Tenant = { organizationId: string; workspaceId: string };

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function clean<T extends JsonRecord>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

function uuid() {
  return randomUUID();
}

function databaseError(error: unknown): never {
  const mapped = mapDatabaseError(error);
  if (mapped.code === "DATABASE_UNIQUE_CONSTRAINT") {
    throw new ApiError(409, "DATABASE_UNIQUE_CONSTRAINT", "A SIS record with the same unique value already exists.");
  }
  throw error;
}

export class SisService {
  constructor(private readonly database: DatabaseClient) {}

  async getTenant(organizationId: string): Promise<Tenant> {
    const context = createRepositoryContext(this.database.db);
    const workspace = (await new WorkspaceRepository(context).listByOrganization(organizationId)).find((item) => item.status === "active")
      ?? (await new WorkspaceRepository(context).listByOrganization(organizationId))[0];

    if (!workspace) throw new ApiError(404, "NOT_FOUND", "Workspace not found for organization.");

    const module = await new OrganizationModuleRepository(context).getByKeyForOrganization(organizationId, educationModuleKey);
    if (module && (!module.enabled || module.status !== "activated")) {
      throw new ApiError(403, "FORBIDDEN", "Education & SIS Suite is not enabled for this organization.");
    }

    return { organizationId, workspaceId: workspace.id };
  }

  async listAcademicYears(tenant: Tenant) {
    const rows = await this.database.db.select().from(academicYears).where(eq(academicYears.workspaceId, tenant.workspaceId)).orderBy(desc(academicYears.startDate));
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async createAcademicYear(tenant: Tenant, data: JsonRecord) {
    await this.assertDateOrder(data.startDate, data.endDate);
    if (data.status === "active") await this.assertNoActiveAcademicYear(tenant.workspaceId);
    return this.insertAndGet(() => this.database.db.insert(academicYears).values({ id: uuid(), workspaceId: tenant.workspaceId, ...clean(data) } as typeof academicYears.$inferInsert), () => this.listAcademicYears(tenant).then((rows) => rows.find((row) => row.name === data.name)!));
  }

  async updateAcademicYear(tenant: Tenant, id: string, data: JsonRecord) {
    const current = await this.getAcademicYearRow(tenant.workspaceId, id);
    await this.assertDateOrder(data.startDate ?? current.startDate, data.endDate ?? current.endDate);
    if (data.status === "active" && current.status !== "active") await this.assertNoActiveAcademicYear(tenant.workspaceId, id);
    await this.database.db.update(academicYears).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(academicYears.id, id), eq(academicYears.workspaceId, tenant.workspaceId))).catch(databaseError);
    const row = await this.getAcademicYearRow(tenant.workspaceId, id);
    return { ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  async listTerms(tenant: Tenant, academicYearId?: string) {
    const condition = academicYearId ? and(eq(academicTerms.workspaceId, tenant.workspaceId), eq(academicTerms.academicYearId, academicYearId)) : eq(academicTerms.workspaceId, tenant.workspaceId);
    const rows = await this.database.db.select().from(academicTerms).where(condition).orderBy(asc(academicTerms.startDate));
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async createTerm(tenant: Tenant, data: JsonRecord) {
    await this.assertAcademicYear(tenant.workspaceId, String(data.academicYearId));
    await this.assertDateOrder(data.startDate, data.endDate);
    const id = uuid();
    await this.database.db.insert(academicTerms).values({ id, workspaceId: tenant.workspaceId, ...clean(data) } as typeof academicTerms.$inferInsert).catch(databaseError);
    return (await this.listTerms(tenant)).find((row) => row.id === id)!;
  }

  async updateTerm(tenant: Tenant, id: string, data: JsonRecord) {
    await this.database.db.update(academicTerms).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(academicTerms.id, id), eq(academicTerms.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.listTerms(tenant)).find((row) => row.id === id) ?? this.notFound("Term");
  }

  async listGrades(tenant: Tenant) {
    const rows = await this.database.db.select().from(gradeLevels).where(eq(gradeLevels.workspaceId, tenant.workspaceId)).orderBy(asc(gradeLevels.order));
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async getGrade(tenant: Tenant, id: string) {
    return (await this.listGrades(tenant)).find((row) => row.id === id) ?? null;
  }

  async createGrade(tenant: Tenant, data: JsonRecord) {
    const id = uuid();
    await this.database.db.insert(gradeLevels).values({ id, workspaceId: tenant.workspaceId, ...clean(data) } as typeof gradeLevels.$inferInsert).catch(databaseError);
    return (await this.listGrades(tenant)).find((row) => row.id === id)!;
  }

  async updateGrade(tenant: Tenant, id: string, data: JsonRecord) {
    await this.database.db.update(gradeLevels).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(gradeLevels.id, id), eq(gradeLevels.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.listGrades(tenant)).find((row) => row.id === id) ?? this.notFound("Grade");
  }

  async listSections(tenant: Tenant, gradeId?: string) {
    const condition = gradeId ? and(eq(sections.workspaceId, tenant.workspaceId), eq(sections.gradeId, gradeId)) : eq(sections.workspaceId, tenant.workspaceId);
    const rows = await this.database.db.select().from(sections).where(condition).orderBy(asc(sections.name));
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async getSection(tenant: Tenant, id: string) {
    return (await this.listSections(tenant)).find((row) => row.id === id) ?? null;
  }

  async createSection(tenant: Tenant, data: JsonRecord) {
    await this.assertGrade(tenant.workspaceId, String(data.gradeId));
    const id = uuid();
    await this.database.db.insert(sections).values({ id, workspaceId: tenant.workspaceId, ...clean(data) } as typeof sections.$inferInsert).catch(databaseError);
    return (await this.listSections(tenant)).find((row) => row.id === id)!;
  }

  async updateSection(tenant: Tenant, id: string, data: JsonRecord) {
    await this.database.db.update(sections).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(sections.id, id), eq(sections.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.listSections(tenant)).find((row) => row.id === id) ?? this.notFound("Section");
  }

  async listSubjects(tenant: Tenant) {
    const rows = await this.database.db.select().from(subjects).where(eq(subjects.workspaceId, tenant.workspaceId)).orderBy(asc(subjects.displayOrder));
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async createSubject(tenant: Tenant, data: JsonRecord) {
    const id = uuid();
    await this.database.db.insert(subjects).values({ id, workspaceId: tenant.workspaceId, ...clean(data) } as typeof subjects.$inferInsert).catch(databaseError);
    return (await this.listSubjects(tenant)).find((row) => row.id === id)!;
  }

  async updateSubject(tenant: Tenant, id: string, data: JsonRecord) {
    await this.database.db.update(subjects).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(subjects.id, id), eq(subjects.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.listSubjects(tenant)).find((row) => row.id === id) ?? this.notFound("Subject");
  }

  async getClassSubjects(tenant: Tenant, gradeId: string) {
    await this.assertGrade(tenant.workspaceId, gradeId);
    const rows = await this.database.db.select().from(classSubjects).where(and(eq(classSubjects.workspaceId, tenant.workspaceId), eq(classSubjects.gradeId, gradeId)));
    return rows.map((row) => row.subjectId);
  }

  async assignSubjectToClass(tenant: Tenant, gradeId: string, subjectId: string) {
    await Promise.all([this.assertGrade(tenant.workspaceId, gradeId), this.assertSubject(tenant.workspaceId, subjectId)]);
    await this.database.db.insert(classSubjects).values({ id: uuid(), workspaceId: tenant.workspaceId, gradeId, subjectId }).catch((error) => {
      const mapped = mapDatabaseError(error);
      if (mapped.code !== "DATABASE_UNIQUE_CONSTRAINT") throw error;
    });
  }

  async removeSubjectFromClass(tenant: Tenant, gradeId: string, subjectId: string) {
    await this.database.db.delete(classSubjects).where(and(eq(classSubjects.workspaceId, tenant.workspaceId), eq(classSubjects.gradeId, gradeId), eq(classSubjects.subjectId, subjectId)));
  }

  async listDepartments(tenant: Tenant) {
    const rows = await this.database.db.select().from(staffDepartments).where(eq(staffDepartments.workspaceId, tenant.workspaceId)).orderBy(asc(staffDepartments.name));
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async createDepartment(tenant: Tenant, data: JsonRecord) {
    const id = uuid();
    await this.database.db.insert(staffDepartments).values({ id, workspaceId: tenant.workspaceId, ...clean(data) } as typeof staffDepartments.$inferInsert).catch(databaseError);
    return (await this.listDepartments(tenant)).find((row) => row.id === id)!;
  }

  async listStaff(tenant: Tenant) {
    const rows = await this.database.db.select().from(staffMembers).where(eq(staffMembers.workspaceId, tenant.workspaceId)).orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName));
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async getStaff(tenant: Tenant, id: string) {
    return (await this.listStaff(tenant)).find((row) => row.id === id) ?? null;
  }

  async createStaff(tenant: Tenant, data: JsonRecord) {
    const id = uuid();
    const employeeNumber = typeof data.employeeNumber === "string" && data.employeeNumber ? data.employeeNumber : await this.nextEmployeeNumber(tenant.workspaceId);
    await this.database.db.insert(staffMembers).values({ id, workspaceId: tenant.workspaceId, ...clean(data), employeeNumber } as typeof staffMembers.$inferInsert).catch(databaseError);
    return (await this.listStaff(tenant)).find((row) => row.id === id)!;
  }

  async updateStaff(tenant: Tenant, id: string, data: JsonRecord) {
    const updates = { ...data };
    delete updates.id;
    delete updates.organizationId;
    await this.database.db.update(staffMembers).set({ ...clean(updates), updatedAt: new Date() }).where(and(eq(staffMembers.id, id), eq(staffMembers.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.listStaff(tenant)).find((row) => row.id === id) ?? this.notFound("Staff member");
  }

  async listTeachingAssignments(tenant: Tenant, filters: { staffId?: string; academicYear?: string; gradeId?: string; sectionId?: string }) {
    const rows = await this.database.db.select().from(teachingAssignments).where(eq(teachingAssignments.workspaceId, tenant.workspaceId));
    return rows
      .filter((row) => (!filters.staffId || row.staffId === filters.staffId) && (!filters.academicYear || row.academicYear === filters.academicYear) && (!filters.gradeId || row.gradeId === filters.gradeId) && (!filters.sectionId || row.sectionId === filters.sectionId))
      .map((row) => ({ ...row, organizationId: tenant.organizationId, sectionId: row.sectionId ?? undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async createTeachingAssignment(tenant: Tenant, data: JsonRecord) {
    const staff = await this.getStaff(tenant, String(data.staffId));
    if (!staff) this.notFound("Staff member");
    if (staff.staffType !== "teacher") throw new ApiError(400, "VALIDATION_FAILED", "Staff member must be a teacher to have teaching assignments.");
    await Promise.all([this.assertGrade(tenant.workspaceId, String(data.gradeId)), this.assertSubject(tenant.workspaceId, String(data.subjectId))]);
    if (data.sectionId) await this.assertSection(tenant.workspaceId, String(data.sectionId));
    const id = uuid();
    await this.database.db.insert(teachingAssignments).values({ id, workspaceId: tenant.workspaceId, ...clean(data) } as typeof teachingAssignments.$inferInsert).catch(databaseError);
    return (await this.listTeachingAssignments(tenant, {})).find((row) => row.id === id)!;
  }

  async updateTeachingAssignment(tenant: Tenant, id: string, data: JsonRecord) {
    await this.database.db.update(teachingAssignments).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(teachingAssignments.id, id), eq(teachingAssignments.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.listTeachingAssignments(tenant, {})).find((row) => row.id === id) ?? this.notFound("Teaching assignment");
  }

  async listStudents(tenant: Tenant) {
    const rows = await this.database.db.select().from(students).where(eq(students.workspaceId, tenant.workspaceId)).orderBy(asc(students.lastName), asc(students.firstName));
    return Promise.all(rows.map((row) => this.studentDto(tenant, row)));
  }

  async getStudent(tenant: Tenant, id: string) {
    const rows = await this.database.db.select().from(students).where(and(eq(students.workspaceId, tenant.workspaceId), eq(students.id, id))).limit(1);
    return rows[0] ? this.studentDto(tenant, rows[0]) : null;
  }

  async createStudent(tenant: Tenant, data: JsonRecord) {
    return withTransaction(this.database, async ({ tx }) => {
      const service = new SisService({ ...this.database, db: tx });
      const id = uuid();
      const admissionNumber = typeof data.admissionNumber === "string" && data.admissionNumber ? data.admissionNumber : await this.nextAdmissionNumber(tenant.workspaceId);
      await tx.insert(students).values({ id, workspaceId: tenant.workspaceId, ...clean(data), admissionNumber, status: data.status ?? "applicant" } as typeof students.$inferInsert).catch(databaseError);
      for (const guardian of Array.isArray(data.guardians) ? data.guardians as JsonRecord[] : []) {
        const guardianId = uuid();
        await tx.insert(guardians).values({ id: guardianId, workspaceId: tenant.workspaceId, ...clean(guardian) } as typeof guardians.$inferInsert).catch(databaseError);
        await tx.insert(studentGuardians).values({
          id: uuid(),
          studentId: id,
          guardianId,
          isEmergencyContact: Boolean(guardian.isEmergencyContact),
          isPrimaryContact: Boolean(guardian.isPrimaryContact),
          portalAccessEnabled: Boolean(guardian.portalAccessEnabled),
          authorizedForPortal: Boolean(guardian.authorizedForPortal),
        });
      }
      return service.getStudent(tenant, id).then((row) => row!);
    });
  }

  async updateStudent(tenant: Tenant, id: string, data: JsonRecord) {
    const updates = { ...data };
    delete updates.id;
    delete updates.organizationId;
    delete updates.guardians;
    await this.database.db.update(students).set({ ...clean(updates), updatedAt: new Date() }).where(and(eq(students.id, id), eq(students.workspaceId, tenant.workspaceId))).catch(databaseError);
    return await this.getStudent(tenant, id) ?? this.notFound("Student");
  }

  async deleteStudent(tenant: Tenant, id: string) {
    const student = await this.getStudent(tenant, id);
    if (!student) this.notFound("Student");
    await this.database.db.update(students).set({ status: "archived", updatedAt: new Date() }).where(and(eq(students.id, id), eq(students.workspaceId, tenant.workspaceId)));
  }

  async listEnrollments(tenant: Tenant, filters: { studentId?: string; academicYear?: string; gradeId?: string; sectionId?: string; status?: string }) {
    const rows = await this.database.db.select().from(enrollments).where(eq(enrollments.workspaceId, tenant.workspaceId)).orderBy(desc(enrollments.enrollmentDate));
    return rows
      .filter((row) => (!filters.studentId || row.studentId === filters.studentId) && (!filters.academicYear || row.academicYear === filters.academicYear) && (!filters.gradeId || row.gradeId === filters.gradeId) && (!filters.sectionId || row.sectionId === filters.sectionId) && (!filters.status || row.status === filters.status))
      .map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async createEnrollment(tenant: Tenant, data: JsonRecord) {
    await Promise.all([this.assertStudent(tenant.workspaceId, String(data.studentId)), this.assertGrade(tenant.workspaceId, String(data.gradeId)), this.assertSection(tenant.workspaceId, String(data.sectionId))]);
    const id = uuid();
    await this.database.db.insert(enrollments).values({ id, workspaceId: tenant.workspaceId, ...clean(data) } as typeof enrollments.$inferInsert).catch(databaseError);
    return (await this.listEnrollments(tenant, {})).find((row) => row.id === id)!;
  }

  async updateEnrollment(tenant: Tenant, id: string, data: JsonRecord) {
    await this.database.db.update(enrollments).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(enrollments.id, id), eq(enrollments.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.listEnrollments(tenant, {})).find((row) => row.id === id) ?? this.notFound("Enrollment");
  }

  async transferStudent(tenant: Tenant, studentId: string, newSectionId: string) {
    const current = (await this.listEnrollments(tenant, { studentId, status: "active" }))[0];
    if (!current) throw new ApiError(400, "VALIDATION_FAILED", "Student does not have an active enrollment to transfer from.");
    if (current.sectionId === newSectionId) throw new ApiError(400, "VALIDATION_FAILED", "Student is already in this section.");
    await this.updateEnrollment(tenant, current.id, { status: "transferred" });
    return this.createEnrollment(tenant, { studentId, academicYear: current.academicYear, gradeId: current.gradeId, sectionId: newSectionId, enrollmentDate: new Date().toISOString(), status: "active" });
  }

  private async studentDto(tenant: Tenant, row: typeof students.$inferSelect) {
    const links = await this.database.db.select().from(studentGuardians).where(eq(studentGuardians.studentId, row.id));
    const allGuardians = await Promise.all(links.map(async (link) => {
      const guardian = (await this.database.db.select().from(guardians).where(eq(guardians.id, link.guardianId)).limit(1))[0];
      return guardian ? {
        id: guardian.id,
        userId: guardian.userId ?? undefined,
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        relationship: guardian.relationship,
        email: guardian.email,
        phone: guardian.phone,
        address: guardian.address ?? undefined,
        occupation: guardian.occupation ?? undefined,
        isEmergencyContact: link.isEmergencyContact,
        isPrimaryContact: link.isPrimaryContact,
        portalAccessEnabled: link.portalAccessEnabled,
        authorizedForPortal: link.authorizedForPortal,
      } : null;
    }));

    return {
      ...row,
      organizationId: tenant.organizationId,
      userId: row.userId ?? undefined,
      guardians: allGuardians.filter((item) => item !== null),
      portalAccessEnabled: row.portalAccessEnabled,
      metadata: row.metadata ?? undefined,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private async getAcademicYearRow(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(academicYears).where(and(eq(academicYears.workspaceId, workspaceId), eq(academicYears.id, id))).limit(1);
    return rows[0] ?? this.notFound("Academic year");
  }

  private async assertNoActiveAcademicYear(workspaceId: string, exceptId?: string) {
    const condition = exceptId ? and(eq(academicYears.workspaceId, workspaceId), eq(academicYears.status, "active"), ne(academicYears.id, exceptId)) : and(eq(academicYears.workspaceId, workspaceId), eq(academicYears.status, "active"));
    const rows = await this.database.db.select().from(academicYears).where(condition).limit(1);
    if (rows.length) throw new ApiError(400, "VALIDATION_FAILED", "An active academic year already exists. Please deactivate it first.");
  }

  private async assertDateOrder(start: unknown, end: unknown) {
    if (typeof start === "string" && typeof end === "string" && new Date(start) >= new Date(end)) {
      throw new ApiError(400, "VALIDATION_FAILED", "Start date must be before end date.");
    }
  }

  private async assertAcademicYear(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(academicYears).where(and(eq(academicYears.workspaceId, workspaceId), eq(academicYears.id, id))).limit(1);
    if (!rows.length) this.notFound("Academic year");
  }

  private async assertGrade(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(gradeLevels).where(and(eq(gradeLevels.workspaceId, workspaceId), eq(gradeLevels.id, id))).limit(1);
    if (!rows.length) this.notFound("Grade");
  }

  private async assertSection(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(sections).where(and(eq(sections.workspaceId, workspaceId), eq(sections.id, id))).limit(1);
    if (!rows.length) this.notFound("Section");
  }

  private async assertSubject(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(subjects).where(and(eq(subjects.workspaceId, workspaceId), eq(subjects.id, id))).limit(1);
    if (!rows.length) this.notFound("Subject");
  }

  private async assertStudent(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(students).where(and(eq(students.workspaceId, workspaceId), eq(students.id, id))).limit(1);
    if (!rows.length) this.notFound("Student");
  }

  private async nextEmployeeNumber(workspaceId: string) {
    const rows = await this.database.db.select().from(staffMembers).where(eq(staffMembers.workspaceId, workspaceId));
    const max = rows.reduce((current, row) => Math.max(current, Number(row.employeeNumber.replace(/^EMP-/, "")) || 0), 0);
    return `EMP-${String(max + 1).padStart(3, "0")}`;
  }

  private async nextAdmissionNumber(workspaceId: string) {
    const year = new Date().getFullYear();
    const rows = await this.database.db.select().from(students).where(eq(students.workspaceId, workspaceId));
    const next = rows.filter((row) => row.admissionNumber.includes(`-${year}-`)).length + 1;
    return `TMS-${year}-${String(next).padStart(5, "0")}`;
  }

  private async insertAndGet<T>(insert: () => Promise<unknown>, get: () => Promise<T>): Promise<T> {
    await insert().catch(databaseError);
    return get();
  }

  private notFound(label: string): never {
    throw new ApiError(404, "NOT_FOUND", `${label} not found.`);
  }
}
