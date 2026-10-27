import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../common/errors/api-error.js";
import type { PaginationParams } from "../../common/pagination/pagination.js";
import type { DatabaseClient } from "../../database/client.js";
import { mapDatabaseError } from "../../database/errors.js";
import { createRepositoryContext } from "../../database/repositories/repository-context.js";
import { withTransaction } from "../../database/transactions.js";
import {
  academicTerms,
  academicYears,
  attendanceRecords,
  attendanceSessions,
  auditLogs,
  classSubjects,
  enrollments,
  gradeLevels,
  guardians,
  sections,
  schoolSchedules,
  staffDepartments,
  staffMembers,
  students,
  studentGuardians,
  subjects,
  teachingAssignments,
  timePeriods,
  timetableEntries,
  users,
} from "../../database/schema.js";
import { OrganizationModuleRepository } from "../platform/repositories/organization-module.repository.js";
import { WorkspaceRepository } from "../platform/repositories/workspace.repository.js";
import { SisFinanceService } from "./sis-finance.service.js";

const educationModuleKey = "education-sis";
type JsonRecord = Record<string, unknown>;

type Tenant = { organizationId: string; workspaceId: string };
type Actor = { userId?: string; role?: string } | undefined;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function clean<T extends JsonRecord>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

function uuid() {
  return randomUUID();
}

function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof ApiError && error.code === "DATABASE_UNIQUE_CONSTRAINT") return true;
  const candidate = error as { code?: string; errno?: number; cause?: unknown };
  if (
    candidate.code === "DATABASE_UNIQUE_CONSTRAINT" ||
    candidate.errno === 1062 ||
    candidate.code === "ER_DUP_ENTRY" ||
    candidate.errno === 1213 ||
    candidate.code === "ER_LOCK_DEADLOCK" ||
    candidate.errno === 1205 ||
    candidate.code === "ER_LOCK_WAIT_TIMEOUT"
  ) {
    return true;
  }
  if (candidate.cause) {
    return isUniqueConstraintError(candidate.cause);
  }
  return false;
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
    const [row] = await this.database.db
      .select()
      .from(gradeLevels)
      .where(and(eq(gradeLevels.workspaceId, tenant.workspaceId), eq(gradeLevels.id, id)))
      .limit(1);
    return row ? { ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) } : null;
  }

  async createGrade(tenant: Tenant, data: JsonRecord) {
    const id = uuid();
    await this.database.db.insert(gradeLevels).values({ id, workspaceId: tenant.workspaceId, ...clean(data) } as typeof gradeLevels.$inferInsert).catch(databaseError);
    return (await this.getGrade(tenant, id))!;
  }

  async updateGrade(tenant: Tenant, id: string, data: JsonRecord) {
    await this.database.db.update(gradeLevels).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(gradeLevels.id, id), eq(gradeLevels.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.getGrade(tenant, id)) ?? this.notFound("Grade");
  }

  async listSections(tenant: Tenant, gradeId?: string) {
    const condition = gradeId ? and(eq(sections.workspaceId, tenant.workspaceId), eq(sections.gradeId, gradeId)) : eq(sections.workspaceId, tenant.workspaceId);
    const rows = await this.database.db.select().from(sections).where(condition).orderBy(asc(sections.name));
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async getSection(tenant: Tenant, id: string) {
    const [row] = await this.database.db
      .select()
      .from(sections)
      .where(and(eq(sections.workspaceId, tenant.workspaceId), eq(sections.id, id)))
      .limit(1);
    return row ? { ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) } : null;
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

  async listStaff(tenant: Tenant, pagination?: PaginationParams) {
    let query = this.database.db
      .select()
      .from(staffMembers)
      .where(eq(staffMembers.workspaceId, tenant.workspaceId))
      .orderBy(asc(staffMembers.lastName), asc(staffMembers.firstName), asc(staffMembers.id));
    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset) as typeof query;
    }
    const rows = await query;
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async countStaff(tenant: Tenant): Promise<number> {
    const [result] = await this.database.db
      .select({ count: sql<number>`count(*)` })
      .from(staffMembers)
      .where(eq(staffMembers.workspaceId, tenant.workspaceId));
    return Number(result?.count ?? 0);
  }

  async getStaff(tenant: Tenant, id: string) {
    const [row] = await this.database.db
      .select()
      .from(staffMembers)
      .where(and(eq(staffMembers.workspaceId, tenant.workspaceId), eq(staffMembers.id, id)))
      .limit(1);
    return row ? { ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) } : null;
  }

  async createStaff(tenant: Tenant, data: JsonRecord) {
    const maxRetries = 12;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        return await withTransaction(this.database, async ({ tx }) => {
          const service = new SisService({
            ...this.database,
            db: tx,
            transaction: (work) => work(tx),
          });
          const id = uuid();
          const employeeNumber =
            typeof data.employeeNumber === "string" && data.employeeNumber.trim()
              ? data.employeeNumber.trim()
              : await this.nextEmployeeNumber(tenant.workspaceId, tx);

          if (!data.firstName || typeof data.firstName !== "string" || !data.firstName.trim()) {
            throw new ApiError(400, "VALIDATION_FAILED", "Staff first name is required.");
          }
          if (!data.lastName || typeof data.lastName !== "string" || !data.lastName.trim()) {
            throw new ApiError(400, "VALIDATION_FAILED", "Staff last name is required.");
          }
          if (!data.hireDate || typeof data.hireDate !== "string" || !data.hireDate.trim()) {
            throw new ApiError(400, "VALIDATION_FAILED", "Staff hire date is required.");
          }
          const hireDate = data.hireDate.trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(hireDate.slice(0, 10)) || isNaN(new Date(hireDate).getTime())) {
            throw new ApiError(400, "VALIDATION_FAILED", "Staff hire date must be a valid date in YYYY-MM-DD format.");
          }

          await tx
            .insert(staffMembers)
            .values({
              id,
              workspaceId: tenant.workspaceId,
              hireDate,
              ...clean(data),
              employeeNumber,
            } as typeof staffMembers.$inferInsert)
            .catch(databaseError);

          return (await service.getStaff(tenant, id))!;
        });
      } catch (error) {
        const isUniqueConstraint = isUniqueConstraintError(error);
        const isAutoGenerated = !data.employeeNumber;

        if (isUniqueConstraint && isAutoGenerated && attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.floor(Math.random() * 60) + attempt * 20)
          );
          continue;
        }
        if (isUniqueConstraint && isAutoGenerated && attempt >= maxRetries) {
          throw new ApiError(
            409,
            "DATABASE_UNIQUE_CONSTRAINT",
            "Unable to allocate a unique employee number after maximum retries due to concurrent staff creation."
          );
        }
        throw error;
      }
    }
  }

  async updateStaff(tenant: Tenant, id: string, data: JsonRecord) {
    const updates = { ...data };
    delete updates.id;
    delete updates.organizationId;
    await this.database.db.update(staffMembers).set({ ...clean(updates), updatedAt: new Date() }).where(and(eq(staffMembers.id, id), eq(staffMembers.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.getStaff(tenant, id)) ?? this.notFound("Staff member");
  }

  async listTeachingAssignments(
    tenant: Tenant,
    filters: { staffId?: string; academicYear?: string; gradeId?: string; sectionId?: string; isActive?: boolean },
    pagination?: PaginationParams
  ) {
    const conditions = [eq(teachingAssignments.workspaceId, tenant.workspaceId)];
    if (filters.staffId) conditions.push(eq(teachingAssignments.staffId, filters.staffId));
    if (filters.academicYear) conditions.push(eq(teachingAssignments.academicYear, filters.academicYear));
    if (filters.gradeId) conditions.push(eq(teachingAssignments.gradeId, filters.gradeId));
    if (filters.sectionId) conditions.push(eq(teachingAssignments.sectionId, filters.sectionId));
    if (filters.isActive !== undefined) conditions.push(eq(teachingAssignments.isActive, filters.isActive));

    let query = this.database.db
      .select()
      .from(teachingAssignments)
      .where(and(...conditions))
      .orderBy(asc(teachingAssignments.createdAt), asc(teachingAssignments.id));
    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset) as typeof query;
    }
    const rows = await query;
    return rows.map((row) => ({
      ...row,
      organizationId: tenant.organizationId,
      sectionId: row.sectionId ?? undefined,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    }));
  }

  async countTeachingAssignments(
    tenant: Tenant,
    filters: { staffId?: string; academicYear?: string; gradeId?: string; sectionId?: string; isActive?: boolean }
  ): Promise<number> {
    const conditions = [eq(teachingAssignments.workspaceId, tenant.workspaceId)];
    if (filters.staffId) conditions.push(eq(teachingAssignments.staffId, filters.staffId));
    if (filters.academicYear) conditions.push(eq(teachingAssignments.academicYear, filters.academicYear));
    if (filters.gradeId) conditions.push(eq(teachingAssignments.gradeId, filters.gradeId));
    if (filters.sectionId) conditions.push(eq(teachingAssignments.sectionId, filters.sectionId));
    if (filters.isActive !== undefined) conditions.push(eq(teachingAssignments.isActive, filters.isActive));

    const [result] = await this.database.db
      .select({ count: sql<number>`count(*)` })
      .from(teachingAssignments)
      .where(and(...conditions));
    return Number(result?.count ?? 0);
  }

  async getTeachingAssignment(tenant: Tenant, id: string) {
    const [row] = await this.database.db
      .select()
      .from(teachingAssignments)
      .where(and(eq(teachingAssignments.workspaceId, tenant.workspaceId), eq(teachingAssignments.id, id)))
      .limit(1);
    return row
      ? {
          ...row,
          organizationId: tenant.organizationId,
          sectionId: row.sectionId ?? undefined,
          createdAt: iso(row.createdAt),
          updatedAt: iso(row.updatedAt),
        }
      : null;
  }

  async createTeachingAssignment(tenant: Tenant, data: JsonRecord) {
    const staff = await this.getStaff(tenant, String(data.staffId));
    if (!staff) this.notFound("Staff member");
    if (staff.staffType !== "teacher") throw new ApiError(400, "VALIDATION_FAILED", "Staff member must be a teacher to have teaching assignments.");
    await Promise.all([this.assertGrade(tenant.workspaceId, String(data.gradeId)), this.assertSubject(tenant.workspaceId, String(data.subjectId))]);
    if (data.sectionId) await this.assertSection(tenant.workspaceId, String(data.sectionId));
    const id = uuid();
    await this.database.db.insert(teachingAssignments).values({ id, workspaceId: tenant.workspaceId, ...clean(data) } as typeof teachingAssignments.$inferInsert).catch(databaseError);
    return (await this.getTeachingAssignment(tenant, id))!;
  }

  async updateTeachingAssignment(tenant: Tenant, id: string, data: JsonRecord) {
    await this.database.db.update(teachingAssignments).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(teachingAssignments.id, id), eq(teachingAssignments.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.getTeachingAssignment(tenant, id)) ?? this.notFound("Teaching assignment");
  }

  async listStudents(
    tenant: Tenant,
    filters?: { status?: string; admissionNumber?: string },
    pagination?: PaginationParams
  ) {
    const conditions = [eq(students.workspaceId, tenant.workspaceId)];
    if (filters?.status) conditions.push(eq(students.status, filters.status as NonNullable<typeof students.$inferInsert.status>));
    if (filters?.admissionNumber) conditions.push(eq(students.admissionNumber, filters.admissionNumber));

    let query = this.database.db
      .select()
      .from(students)
      .where(and(...conditions))
      .orderBy(asc(students.lastName), asc(students.firstName), asc(students.id));
    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset) as typeof query;
    }
    const rows = await query;
    return Promise.all(rows.map((row) => this.studentDto(tenant, row)));
  }

  async countStudents(
    tenant: Tenant,
    filters?: { status?: string; admissionNumber?: string }
  ): Promise<number> {
    const conditions = [eq(students.workspaceId, tenant.workspaceId)];
    if (filters?.status) conditions.push(eq(students.status, filters.status as NonNullable<typeof students.$inferInsert.status>));
    if (filters?.admissionNumber) conditions.push(eq(students.admissionNumber, filters.admissionNumber));

    const [result] = await this.database.db
      .select({ count: sql<number>`count(*)` })
      .from(students)
      .where(and(...conditions));
    return Number(result?.count ?? 0);
  }

  async getStudent(tenant: Tenant, id: string) {
    const rows = await this.database.db.select().from(students).where(and(eq(students.workspaceId, tenant.workspaceId), eq(students.id, id))).limit(1);
    return rows[0] ? this.studentDto(tenant, rows[0]) : null;
  }

  async createStudent(tenant: Tenant, data: JsonRecord) {
    const maxRetries = 12;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        return await withTransaction(this.database, async ({ tx }) => {
          const service = new SisService({
            ...this.database,
            db: tx,
            transaction: (work) => work(tx),
          });
          const id = uuid();
          const admissionNumber =
            typeof data.admissionNumber === "string" && data.admissionNumber.trim()
              ? data.admissionNumber.trim()
              : await this.nextAdmissionNumber(tenant.workspaceId, tx);

          if (!data.firstName || typeof data.firstName !== "string" || !data.firstName.trim()) {
            throw new ApiError(400, "VALIDATION_FAILED", "Student first name is required.");
          }
          if (!data.lastName || typeof data.lastName !== "string" || !data.lastName.trim()) {
            throw new ApiError(400, "VALIDATION_FAILED", "Student last name is required.");
          }
          if (!data.dateOfBirth || typeof data.dateOfBirth !== "string" || !data.dateOfBirth.trim()) {
            throw new ApiError(400, "VALIDATION_FAILED", "Student date of birth is required.");
          }
          const dateOfBirth = data.dateOfBirth.trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.slice(0, 10)) || isNaN(new Date(dateOfBirth).getTime())) {
            throw new ApiError(400, "VALIDATION_FAILED", "Student date of birth must be a valid date in YYYY-MM-DD format.");
          }

          const rawAdmissionDate = (data.admissionDate as string) || (data.enrollmentDate as string) || (data.startDate as string);
          if (!rawAdmissionDate || typeof rawAdmissionDate !== "string" || !rawAdmissionDate.trim()) {
            throw new ApiError(400, "VALIDATION_FAILED", "Student admission date is required.");
          }
          const admissionDate = rawAdmissionDate.trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(admissionDate.slice(0, 10)) || isNaN(new Date(admissionDate).getTime())) {
            throw new ApiError(400, "VALIDATION_FAILED", "Student admission date must be a valid date in YYYY-MM-DD format.");
          }

          const allowedGenders = ["male", "female", "other", "prefer_not_to_say"];
          let gender: "male" | "female" | "other" | "prefer_not_to_say";
          if (data.gender !== undefined && data.gender !== null && String(data.gender).trim() !== "") {
            const rawGender = String(data.gender).trim().toLowerCase();
            if (!allowedGenders.includes(rawGender)) {
              throw new ApiError(400, "VALIDATION_FAILED", `Student gender must be one of: ${allowedGenders.join(", ")}.`);
            }
            gender = rawGender as "male" | "female" | "other" | "prefer_not_to_say";
          } else {
            gender = "prefer_not_to_say";
          }

          await tx
            .insert(students)
            .values({
              id,
              workspaceId: tenant.workspaceId,
              ...clean(data),
              dateOfBirth,
              gender,
              admissionDate,
              admissionNumber,
              status: data.status ?? "applicant",
            } as typeof students.$inferInsert)
            .catch(databaseError);

          for (const guardian of Array.isArray(data.guardians) ? (data.guardians as JsonRecord[]) : []) {
            if (!guardian.firstName || typeof guardian.firstName !== "string" || !guardian.firstName.trim()) {
              throw new ApiError(400, "VALIDATION_FAILED", "Guardian first name is required.");
            }
            if (!guardian.lastName || typeof guardian.lastName !== "string" || !guardian.lastName.trim()) {
              throw new ApiError(400, "VALIDATION_FAILED", "Guardian last name is required.");
            }
            if (!guardian.phone || typeof guardian.phone !== "string" || !guardian.phone.trim()) {
              throw new ApiError(400, "VALIDATION_FAILED", "Guardian phone is required.");
            }
            const guardianPhone = guardian.phone.trim();

            if (!guardian.email || typeof guardian.email !== "string" || !guardian.email.trim()) {
              throw new ApiError(400, "VALIDATION_FAILED", "Guardian email is required.");
            }
            const guardianEmail = guardian.email.trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail)) {
              throw new ApiError(400, "VALIDATION_FAILED", "Guardian email must be a valid email address.");
            }

            const allowedRel = ["father", "mother", "guardian", "other"];
            const rawRel = typeof guardian.relationship === "string" ? guardian.relationship.trim().toLowerCase() : "";
            let relationship: "father" | "mother" | "guardian" | "other";
            if (!rawRel) {
              relationship = "guardian";
            } else if (allowedRel.includes(rawRel)) {
              relationship = rawRel as "father" | "mother" | "guardian" | "other";
            } else {
              throw new ApiError(400, "VALIDATION_FAILED", `Invalid guardian relationship: "${guardian.relationship}". Allowed relationships: ${allowedRel.join(", ")}.`);
            }

            const guardianId = uuid();
            await tx
              .insert(guardians)
              .values({
                id: guardianId,
                workspaceId: tenant.workspaceId,
                ...clean(guardian),
                firstName: guardian.firstName.trim(),
                lastName: guardian.lastName.trim(),
                relationship,
                email: guardianEmail,
                phone: guardianPhone,
              } as typeof guardians.$inferInsert)
              .catch(databaseError);

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
      } catch (error) {
        const isUniqueConstraint = isUniqueConstraintError(error);
        const isAutoGenerated = !data.admissionNumber;

        if (isUniqueConstraint && isAutoGenerated && attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.floor(Math.random() * 60) + attempt * 20)
          );
          continue;
        }
        if (isUniqueConstraint && isAutoGenerated && attempt >= maxRetries) {
          throw new ApiError(
            409,
            "DATABASE_UNIQUE_CONSTRAINT",
            "Unable to allocate a unique admission number after maximum retries due to concurrent student creation."
          );
        }
        throw error;
      }
    }
  }

  async updateStudent(tenant: Tenant, id: string, data: JsonRecord) {
    const updates = { ...data };
    delete updates.id;
    delete updates.organizationId;
    delete updates.guardians;
    await this.database.db.update(students).set({ ...clean(updates), updatedAt: new Date() }).where(and(eq(students.id, id), eq(students.workspaceId, tenant.workspaceId))).catch(databaseError);
    return await this.getStudent(tenant, id) ?? this.notFound("Student");
  }

  async deleteStudent(
    tenant: Tenant,
    id: string,
    options?: { forceWithOutstandingDues?: boolean },
    actor?: Actor
  ) {
    return withTransaction(this.database, async ({ tx }) => {
      // 1. Lock the student row with FOR UPDATE to serialize concurrent operations
      const [studentRows] = (await tx.execute(
        sql`SELECT id, student_status as status FROM students WHERE workspace_id = ${tenant.workspaceId} AND id = ${id} FOR UPDATE`
      )) as unknown as [Array<{ id: string; status: string }>];

      const student = studentRows[0];
      if (!student) this.notFound("Student");

      // Idempotency: If already archived, return safely without modifying data
      if (student.status === "archived") {
        return { success: true, isExisting: true, id, status: "archived", message: "Student is already archived." };
      }

      // 2. Check for outstanding financial obligations before archival inside the lock
      const txDatabase: DatabaseClient = {
        ...this.database,
        db: tx,
        transaction: (work) => work(tx),
      };
      const financeService = new SisFinanceService(txDatabase);
      const invoices = (await financeService.listInvoices(tenant, { studentId: id })) as Array<{
        status: string;
        balanceCents?: number;
        id: string;
      }>;
      const unpaidInvoices = invoices.filter(
        (inv) => !["cancelled", "voided", "paid"].includes(inv.status) && Number(inv.balanceCents ?? 0) > 0
      );
      const outstandingBalanceCents = unpaidInvoices.reduce(
        (sum, inv) => sum + Number(inv.balanceCents ?? 0),
        0
      );

      if (outstandingBalanceCents > 0 && !options?.forceWithOutstandingDues) {
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          `Cannot archive student with outstanding balance of ${outstandingBalanceCents} cents across ${unpaidInvoices.length} unpaid invoice(s). Settle dues or explicitly authorize archival with outstanding balance.`
        );
      }

      // 3. Conditionally transition student status to archived and verify affectedRows
      const [updateResult] = (await tx.execute(sql`
        UPDATE students
        SET student_status = 'archived', updated_at = NOW()
        WHERE workspace_id = ${tenant.workspaceId}
          AND id = ${id}
          AND student_status != 'archived'
      `)) as unknown as [ { affectedRows?: number } ];

      if (!updateResult || updateResult.affectedRows !== 1) {
        return { success: true, isExisting: true, id, status: "archived", message: "Student is already archived." };
      }

      // 4. Transition active enrollments to dropped
      await tx
        .update(enrollments)
        .set({ status: "dropped", updatedAt: new Date() })
        .where(
          and(
            eq(enrollments.workspaceId, tenant.workspaceId),
            eq(enrollments.studentId, id),
            eq(enrollments.status, "active")
          )
        );

      // 5. Write structured audit log
      let validActorUserId: string | undefined = undefined;
      if (actor?.userId) {
        const [u] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, actor.userId))
          .limit(1);
        if (u) validActorUserId = u.id;
      }

      await tx.insert(auditLogs).values({
        id: uuid(),
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        actorType: actor?.role ?? "system",
        actorUserId: validActorUserId,
        action: "student.archive",
        resourceType: "student",
        resourceId: id,
        operation: "archive",
        result: "success",
        source: "sis_service",
        beforeSnapshot: { status: student.status },
        afterSnapshot: { status: "archived", activeEnrollmentsDropped: true },
        metadata: {
          hadOutstandingBalance: outstandingBalanceCents > 0,
          outstandingBalanceCents,
          unpaidInvoicesCount: unpaidInvoices.length,
          forcedWithDues: Boolean(options?.forceWithOutstandingDues),
        },
      });

      return {
        success: true,
        id,
        status: "archived",
        message: "Student archived and active enrollments transitioned successfully.",
      };
    });
  }

  async listEnrollments(
    tenant: Tenant,
    filters: { studentId?: string; academicYear?: string; gradeId?: string; sectionId?: string; status?: string },
    pagination?: PaginationParams
  ) {
    const conditions = [eq(enrollments.workspaceId, tenant.workspaceId)];
    if (filters.studentId) conditions.push(eq(enrollments.studentId, filters.studentId));
    if (filters.academicYear) conditions.push(eq(enrollments.academicYear, filters.academicYear));
    if (filters.gradeId) conditions.push(eq(enrollments.gradeId, filters.gradeId));
    if (filters.sectionId) conditions.push(eq(enrollments.sectionId, filters.sectionId));
    if (filters.status) conditions.push(eq(enrollments.status, filters.status as NonNullable<typeof enrollments.$inferInsert.status>));

    let query = this.database.db
      .select()
      .from(enrollments)
      .where(and(...conditions))
      .orderBy(desc(enrollments.enrollmentDate), asc(enrollments.id));
    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset) as typeof query;
    }
    const rows = await query;
    return rows.map((row) => ({ ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }));
  }

  async countEnrollments(
    tenant: Tenant,
    filters: { studentId?: string; academicYear?: string; gradeId?: string; sectionId?: string; status?: string }
  ): Promise<number> {
    const conditions = [eq(enrollments.workspaceId, tenant.workspaceId)];
    if (filters.studentId) conditions.push(eq(enrollments.studentId, filters.studentId));
    if (filters.academicYear) conditions.push(eq(enrollments.academicYear, filters.academicYear));
    if (filters.gradeId) conditions.push(eq(enrollments.gradeId, filters.gradeId));
    if (filters.sectionId) conditions.push(eq(enrollments.sectionId, filters.sectionId));
    if (filters.status) conditions.push(eq(enrollments.status, filters.status as NonNullable<typeof enrollments.$inferInsert.status>));

    const [result] = await this.database.db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(and(...conditions));
    return Number(result?.count ?? 0);
  }

  async getEnrollment(tenant: Tenant, id: string) {
    const [row] = await this.database.db
      .select()
      .from(enrollments)
      .where(and(eq(enrollments.workspaceId, tenant.workspaceId), eq(enrollments.id, id)))
      .limit(1);
    return row ? { ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) } : null;
  }

  async createEnrollment(tenant: Tenant, data: JsonRecord) {
    await Promise.all([this.assertStudent(tenant.workspaceId, String(data.studentId)), this.assertGrade(tenant.workspaceId, String(data.gradeId)), this.assertSection(tenant.workspaceId, String(data.sectionId))]);
    const id = uuid();
    const rawDate = (data.enrollmentDate as string) || (data.startDate as string);
    if (!rawDate || typeof rawDate !== "string" || !rawDate.trim()) {
      throw new ApiError(400, "VALIDATION_FAILED", "Enrollment date is required.");
    }
    const enrollmentDate = rawDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(enrollmentDate.slice(0, 10)) || isNaN(new Date(enrollmentDate).getTime())) {
      throw new ApiError(400, "VALIDATION_FAILED", "Enrollment date must be a valid date in YYYY-MM-DD format.");
    }

    const allowedStatuses = ["active", "completed", "dropped", "transferred"];
    let status: typeof enrollments.$inferInsert.status;
    if (typeof data.status === "string" && allowedStatuses.includes(data.status)) {
      status = data.status as typeof enrollments.$inferInsert.status;
    } else if (data.status === "withdrawn" || data.status === "archived") {
      status = "dropped";
    } else if (data.status === undefined || data.status === null || String(data.status).trim() === "") {
      status = "active";
    } else {
      throw new ApiError(400, "VALIDATION_FAILED", `Invalid enrollment status: "${data.status}". Allowed values: ${allowedStatuses.join(", ")}.`);
    }
    await this.database.db.insert(enrollments).values({ id, workspaceId: tenant.workspaceId, ...clean(data), enrollmentDate, status } as typeof enrollments.$inferInsert).catch(databaseError);
    return (await this.getEnrollment(tenant, id))!;
  }

  async updateEnrollment(tenant: Tenant, id: string, data: JsonRecord) {
    await this.database.db.update(enrollments).set({ ...clean(data), updatedAt: new Date() }).where(and(eq(enrollments.id, id), eq(enrollments.workspaceId, tenant.workspaceId))).catch(databaseError);
    return (await this.getEnrollment(tenant, id)) ?? this.notFound("Enrollment");
  }

  async transferStudent(
    tenant: Tenant,
    studentId: string,
    newSectionId: string,
    options?: { academicYear?: string; gradeId?: string },
    actor?: Actor
  ) {
    return withTransaction(this.database, async ({ tx }) => {
      // 1. Lock student row with FOR UPDATE
      const [studentRows] = (await tx.execute(
        sql`SELECT id, student_status as status FROM students WHERE workspace_id = ${tenant.workspaceId} AND id = ${studentId} FOR UPDATE`
      )) as unknown as [Array<{ id: string; status: string }>];

      const student = studentRows[0];
      if (!student) this.notFound("Student");
      if (student.status !== "active") {
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          `Cannot transfer student with status '${student.status}'. Student must be active.`
        );
      }

      // 2. Validate destination section exists in the tenant's workspace
      const targetSectionRows = await tx
        .select()
        .from(sections)
        .where(and(eq(sections.workspaceId, tenant.workspaceId), eq(sections.id, newSectionId)))
        .limit(1);
      const targetSection = targetSectionRows[0];
      if (!targetSection) {
        throw new ApiError(404, "NOT_FOUND", "Destination section not found in this organization.");
      }

      // 3. Lock active enrollment with FOR UPDATE to serialize concurrent section transfers
      const [activeRows] = (await tx.execute(
        sql`SELECT id, workspace_id as workspaceId, student_id as studentId, academic_year as academicYear, grade_id as gradeId, section_id as sectionId, enrollment_status as status FROM enrollments WHERE workspace_id = ${tenant.workspaceId} AND student_id = ${studentId} AND enrollment_status = 'active' FOR UPDATE`
      )) as unknown as [Array<{ id: string; workspaceId: string; studentId: string; academicYear: string; gradeId: string; sectionId: string; status: string }>];

      const current = activeRows[0];
      if (!current) {
        throw new ApiError(400, "VALIDATION_FAILED", "Student does not have an active enrollment to transfer from.");
      }
      if (current.sectionId === newSectionId) {
        throw new ApiError(400, "VALIDATION_FAILED", "Student is already in this section.");
      }

      const targetGradeId = options?.gradeId ?? targetSection.gradeId;
      if (targetSection.gradeId !== targetGradeId) {
        throw new ApiError(400, "VALIDATION_FAILED", "Destination section does not belong to the target grade level.");
      }
      const targetAcademicYear = options?.academicYear ?? current.academicYear;

      // 4. Transition previous active enrollment to transferred and verify affectedRows === 1
      const [updateResult] = (await tx.execute(sql`
        UPDATE enrollments
        SET enrollment_status = 'transferred', updated_at = NOW()
        WHERE workspace_id = ${tenant.workspaceId}
          AND id = ${current.id}
          AND enrollment_status = 'active'
      `)) as unknown as [ { affectedRows?: number } ];

      if (!updateResult || updateResult.affectedRows !== 1) {
        throw new ApiError(
          409,
          "DATABASE_TRANSACTION_FAILED",
          "Source active enrollment has been concurrently modified or already transferred. Transfer aborted."
        );
      }

      // 5. Create destination enrollment inside transaction
      const newEnrollmentId = uuid();
      const enrollmentDate = new Date().toISOString().slice(0, 10);
      await tx
        .insert(enrollments)
        .values({
          id: newEnrollmentId,
          workspaceId: tenant.workspaceId,
          studentId,
          academicYear: targetAcademicYear,
          gradeId: targetGradeId,
          sectionId: newSectionId,
          enrollmentDate,
          status: "active",
        } as typeof enrollments.$inferInsert)
        .catch(databaseError);

      // 6. Record transfer in audit log
      let validActorUserId: string | undefined = undefined;
      if (actor?.userId) {
        const [u] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, actor.userId))
          .limit(1);
        if (u) validActorUserId = u.id;
      }

      await tx.insert(auditLogs).values({
        id: uuid(),
        organizationId: tenant.organizationId,
        workspaceId: tenant.workspaceId,
        actorType: actor?.role ?? "system",
        actorUserId: validActorUserId,
        action: "student.section_transfer",
        resourceType: "student",
        resourceId: studentId,
        operation: "transfer",
        result: "success",
        source: "sis_service",
        beforeSnapshot: {
          previousEnrollmentId: current.id,
          previousSectionId: current.sectionId,
          previousGradeId: current.gradeId,
          previousAcademicYear: current.academicYear,
        },
        afterSnapshot: {
          newEnrollmentId,
          newSectionId,
          newGradeId: targetGradeId,
          newAcademicYear: targetAcademicYear,
        },
        metadata: {
          rawActorUserId: actor?.userId,
          sourceSectionId: current.sectionId,
          destinationSectionId: newSectionId,
          academicYear: targetAcademicYear,
        },
      });

      const rows = await tx.select().from(enrollments).where(eq(enrollments.id, newEnrollmentId)).limit(1);
      return {
        ...rows[0],
        organizationId: tenant.organizationId,
        createdAt: iso(rows[0].createdAt),
        updatedAt: iso(rows[0].updatedAt),
      };
    });
  }

  async listAttendanceSessions(
    tenant: Tenant,
    filters: { academicYearId?: string; date?: string; gradeId?: string; sectionId?: string; sessionType?: string; status?: string },
    pagination?: PaginationParams
  ) {
    const conditions = [eq(attendanceSessions.workspaceId, tenant.workspaceId)];
    if (filters.academicYearId) conditions.push(eq(attendanceSessions.academicYearId, filters.academicYearId));
    if (filters.date) conditions.push(eq(attendanceSessions.attendanceDate, filters.date));
    if (filters.gradeId) conditions.push(eq(attendanceSessions.gradeId, filters.gradeId));
    if (filters.sectionId) conditions.push(eq(attendanceSessions.sectionId, filters.sectionId));
    if (filters.sessionType) conditions.push(eq(attendanceSessions.sessionType, filters.sessionType as "daily" | "period" | "subject"));
    if (filters.status) conditions.push(eq(attendanceSessions.status, filters.status as "draft" | "completed"));

    let query = this.database.db
      .select()
      .from(attendanceSessions)
      .where(and(...conditions))
      .orderBy(desc(attendanceSessions.attendanceDate), asc(attendanceSessions.id));
    if (pagination) {
      query = query.limit(pagination.limit).offset(pagination.offset) as typeof query;
    }
    const rows = await query;
    return rows.map((row) => this.attendanceSessionDto(tenant, row));
  }

  async countAttendanceSessions(
    tenant: Tenant,
    filters: { academicYearId?: string; date?: string; gradeId?: string; sectionId?: string; sessionType?: string; status?: string }
  ): Promise<number> {
    const conditions = [eq(attendanceSessions.workspaceId, tenant.workspaceId)];
    if (filters.academicYearId) conditions.push(eq(attendanceSessions.academicYearId, filters.academicYearId));
    if (filters.date) conditions.push(eq(attendanceSessions.attendanceDate, filters.date));
    if (filters.gradeId) conditions.push(eq(attendanceSessions.gradeId, filters.gradeId));
    if (filters.sectionId) conditions.push(eq(attendanceSessions.sectionId, filters.sectionId));
    if (filters.sessionType) conditions.push(eq(attendanceSessions.sessionType, filters.sessionType as "daily" | "period" | "subject"));
    if (filters.status) conditions.push(eq(attendanceSessions.status, filters.status as "draft" | "completed"));

    const [result] = await this.database.db
      .select({ count: sql<number>`count(*)` })
      .from(attendanceSessions)
      .where(and(...conditions));
    return Number(result?.count ?? 0);
  }

  async getAttendanceSession(tenant: Tenant, id: string) {
    const rows = await this.database.db.select().from(attendanceSessions).where(and(eq(attendanceSessions.workspaceId, tenant.workspaceId), eq(attendanceSessions.id, id))).limit(1);
    return rows[0] ? this.attendanceSessionDto(tenant, rows[0]) : null;
  }

  async createAttendanceSession(tenant: Tenant, data: JsonRecord) {
    await Promise.all([
      this.assertAcademicYear(tenant.workspaceId, String(data.academicYearId)),
      this.assertGrade(tenant.workspaceId, String(data.gradeId)),
      this.assertSectionInGrade(tenant.workspaceId, String(data.sectionId), String(data.gradeId)),
    ]);
    if (data.subjectId) await this.assertSubject(tenant.workspaceId, String(data.subjectId));
    if (data.teacherId) await this.assertStaff(tenant.workspaceId, String(data.teacherId));

    const allowedTypes = ["daily", "period", "subject"];
    const allowedStatuses = ["draft", "completed"];
    const sessionType = typeof data.sessionType === "string" && allowedTypes.includes(data.sessionType) ? (data.sessionType as "daily" | "period" | "subject") : "daily";
    const status = typeof data.status === "string" && allowedStatuses.includes(data.status) ? (data.status as "draft" | "completed") : "draft";

    const targetSubjectId = typeof data.subjectId === "string" && data.subjectId.trim() ? data.subjectId.trim() : undefined;
    const existing = (await this.listAttendanceSessions(tenant, {
      academicYearId: String(data.academicYearId),
      date: String(data.date),
      gradeId: String(data.gradeId),
      sectionId: String(data.sectionId),
    })).find((row) => row.sessionType === sessionType && (row.subjectId || undefined) === targetSubjectId);
    if (existing) return existing;

    const id = uuid();
    await this.database.db.insert(attendanceSessions).values({
      id,
      workspaceId: tenant.workspaceId,
      academicYearId: String(data.academicYearId),
      attendanceDate: String(data.date),
      gradeId: String(data.gradeId),
      sectionId: String(data.sectionId),
      subjectId: typeof data.subjectId === "string" ? data.subjectId : undefined,
      teacherId: typeof data.teacherId === "string" ? data.teacherId : undefined,
      sessionType,
      status,
      markedBy: typeof data.markedBy === "string" ? data.markedBy : undefined,
    } as typeof attendanceSessions.$inferInsert).catch(databaseError);
    return (await this.getAttendanceSession(tenant, id))!;
  }

  async updateAttendanceSession(tenant: Tenant, id: string, data: JsonRecord) {
    const updates = { ...data };
    if (typeof updates.date === "string") {
      updates.attendanceDate = updates.date;
      delete updates.date;
    }
    delete updates.id;
    delete updates.organizationId;
    await this.database.db.update(attendanceSessions).set({ ...clean(updates), updatedAt: new Date() } as Partial<typeof attendanceSessions.$inferInsert>).where(and(eq(attendanceSessions.id, id), eq(attendanceSessions.workspaceId, tenant.workspaceId))).catch(databaseError);
    return await this.getAttendanceSession(tenant, id) ?? this.notFound("Attendance session");
  }

  async listAttendanceRecords(tenant: Tenant, sessionId: string) {
    await this.assertAttendanceSession(tenant.workspaceId, sessionId);
    const rows = await this.database.db.select().from(attendanceRecords).where(and(eq(attendanceRecords.workspaceId, tenant.workspaceId), eq(attendanceRecords.sessionId, sessionId)));
    return rows.map((row) => this.attendanceRecordDto(tenant, row));
  }

  async saveAttendanceRecords(tenant: Tenant, sessionId: string, records: Array<{ studentId: string; status: string; note?: string }>, markedBy: string) {
    const session = await this.getAttendanceSession(tenant, sessionId);
    if (!session) this.notFound("Attendance session");
    const academicYear = await this.getAcademicYearRow(tenant.workspaceId, session.academicYearId);
    const savedIds: string[] = [];

    await withTransaction(this.database, async ({ tx }) => {
      for (const record of records) {
        const allowedStatuses = ["present", "absent", "late", "excused"];
        const rawStatus = typeof record.status === "string" ? record.status.trim().toLowerCase() : "";
        if (!rawStatus || !allowedStatuses.includes(rawStatus)) {
          throw new ApiError(
            400,
            "VALIDATION_FAILED",
            `Attendance status is invalid or missing for student ${record.studentId}: "${record.status}". Allowed values: ${allowedStatuses.join(", ")}.`
          );
        }
        const recordStatus = rawStatus as typeof attendanceRecords.$inferInsert.status;
        const enrollment = await this.findEnrollmentForAttendance(tenant.workspaceId, String(record.studentId), academicYear.name, session.academicYearId, session.gradeId, session.sectionId);
        const existing = await tx.select().from(attendanceRecords).where(and(eq(attendanceRecords.workspaceId, tenant.workspaceId), eq(attendanceRecords.sessionId, sessionId), eq(attendanceRecords.enrollmentId, enrollment.id))).limit(1);
        if (existing[0]) {
          await tx.update(attendanceRecords).set({ status: recordStatus, note: record.note, markedBy, updatedAt: new Date() }).where(eq(attendanceRecords.id, existing[0].id));
          savedIds.push(existing[0].id);
        } else {
          const id = uuid();
          await tx.insert(attendanceRecords).values({
            id,
            workspaceId: tenant.workspaceId,
            sessionId,
            enrollmentId: enrollment.id,
            studentId: record.studentId,
            status: recordStatus,
            note: record.note,
            markedBy,
          });
          savedIds.push(id);
        }
      }
      await tx.update(attendanceSessions).set({ status: "completed", markedBy, updatedAt: new Date() }).where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.workspaceId, tenant.workspaceId)));
    });

    const rows = await this.database.db.select().from(attendanceRecords).where(and(eq(attendanceRecords.workspaceId, tenant.workspaceId), eq(attendanceRecords.sessionId, sessionId)));
    return rows.filter((row) => savedIds.includes(row.id)).map((row) => this.attendanceRecordDto(tenant, row));
  }

  async getStudentAttendanceHistory(tenant: Tenant, studentId: string, academicYearId?: string) {
    await this.assertStudent(tenant.workspaceId, studentId);
    const records = await this.database.db.select().from(attendanceRecords).where(and(eq(attendanceRecords.workspaceId, tenant.workspaceId), eq(attendanceRecords.studentId, studentId)));
    const history = [];
    for (const record of records) {
      const session = await this.getAttendanceSession(tenant, record.sessionId);
      if (session && (!academicYearId || session.academicYearId === academicYearId)) {
        history.push({ session, record: this.attendanceRecordDto(tenant, record) });
      }
    }
    return history.sort((a, b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime());
  }

  async getStudentAttendanceSummary(tenant: Tenant, studentId: string, academicYearId?: string) {
    const history = await this.getStudentAttendanceHistory(tenant, studentId, academicYearId);
    const summary = { totalSessions: history.length, present: 0, absent: 0, late: 0, excused: 0, attendancePercentage: 0 };
    for (const { record } of history) {
      if (record.status === "present") summary.present += 1;
      if (record.status === "absent") summary.absent += 1;
      if (record.status === "late") summary.late += 1;
      if (record.status === "excused") summary.excused += 1;
    }
    const counted = summary.present + summary.late + summary.absent;
    summary.attendancePercentage = counted > 0 ? Math.round(((summary.present + summary.late) / counted) * 100) : 100;
    return summary;
  }

  async getSchoolSchedule(tenant: Tenant, academicYearId: string) {
    const rows = await this.database.db.select().from(schoolSchedules).where(and(eq(schoolSchedules.workspaceId, tenant.workspaceId), eq(schoolSchedules.academicYearId, academicYearId))).limit(1);
    return rows[0] ? this.schoolScheduleDto(tenant, rows[0]) : null;
  }

  async saveSchoolSchedule(tenant: Tenant, data: JsonRecord) {
    await this.assertAcademicYear(tenant.workspaceId, String(data.academicYearId));
    const workingDays = Array.isArray(data.workingDays) ? [...new Set(data.workingDays.map(Number))].sort((a, b) => a - b) : [];
    if (!workingDays.length) throw new ApiError(400, "VALIDATION_FAILED", "At least one working day must be selected.");
    if (String(data.scheduleStartTime) >= String(data.scheduleEndTime)) throw new ApiError(400, "VALIDATION_FAILED", "Schedule start time must be before end time.");
    const current = await this.getSchoolSchedule(tenant, String(data.academicYearId));
    const id = typeof data.id === "string" ? data.id : current?.id ?? uuid();
    if (current || data.id) {
      await this.database.db.update(schoolSchedules).set({ workingDays, scheduleStartTime: String(data.scheduleStartTime), scheduleEndTime: String(data.scheduleEndTime), updatedAt: new Date() }).where(and(eq(schoolSchedules.id, id), eq(schoolSchedules.workspaceId, tenant.workspaceId))).catch(databaseError);
    } else {
      await this.database.db.insert(schoolSchedules).values({ id, workspaceId: tenant.workspaceId, academicYearId: String(data.academicYearId), workingDays, scheduleStartTime: String(data.scheduleStartTime), scheduleEndTime: String(data.scheduleEndTime) }).catch(databaseError);
    }
    return (await this.getSchoolSchedule(tenant, String(data.academicYearId)))!;
  }

  async listPeriods(tenant: Tenant) {
    const rows = await this.database.db.select().from(timePeriods).where(eq(timePeriods.workspaceId, tenant.workspaceId)).orderBy(asc(timePeriods.displayOrder), asc(timePeriods.startTime));
    return rows.map((row) => this.periodDto(tenant, row));
  }

  async savePeriod(tenant: Tenant, data: JsonRecord) {
    if (!String(data.name ?? "").trim()) throw new ApiError(400, "VALIDATION_FAILED", "Period name is required.");
    if (String(data.startTime) >= String(data.endTime)) throw new ApiError(400, "VALIDATION_FAILED", "Period start time must be before end time.");
    const id = typeof data.id === "string" ? data.id : uuid();
    if (data.id) {
      await this.database.db.update(timePeriods).set({ name: String(data.name).trim(), startTime: String(data.startTime), endTime: String(data.endTime), type: String(data.type ?? "teaching") as typeof timePeriods.$inferInsert.type, displayOrder: Number(data.displayOrder ?? 0), updatedAt: new Date() }).where(and(eq(timePeriods.id, id), eq(timePeriods.workspaceId, tenant.workspaceId))).catch(databaseError);
    } else {
      await this.database.db.insert(timePeriods).values({ id, workspaceId: tenant.workspaceId, name: String(data.name).trim(), startTime: String(data.startTime), endTime: String(data.endTime), type: String(data.type ?? "teaching") as typeof timePeriods.$inferInsert.type, displayOrder: Number(data.displayOrder ?? 0) }).catch(databaseError);
    }
    return (await this.listPeriods(tenant)).find((row) => row.id === id) ?? this.notFound("Period");
  }

  async deletePeriod(tenant: Tenant, id: string) {
    await this.database.db.delete(timetableEntries).where(and(eq(timetableEntries.workspaceId, tenant.workspaceId), eq(timetableEntries.periodId, id)));
    await this.database.db.delete(timePeriods).where(and(eq(timePeriods.workspaceId, tenant.workspaceId), eq(timePeriods.id, id)));
  }

  async listTimetableEntries(
    tenant: Tenant,
    filters: { academicYearId?: string; termId?: string; gradeId?: string; sectionId?: string; teacherId?: string; dayOfWeek?: string | number; periodId?: string }
  ) {
    const conditions = [eq(timetableEntries.workspaceId, tenant.workspaceId)];
    if (filters.academicYearId) conditions.push(eq(timetableEntries.academicYearId, filters.academicYearId));
    if (filters.termId) conditions.push(eq(timetableEntries.termId, filters.termId));
    if (filters.gradeId) conditions.push(eq(timetableEntries.gradeId, filters.gradeId));
    if (filters.sectionId) conditions.push(eq(timetableEntries.sectionId, filters.sectionId));
    if (filters.teacherId) conditions.push(eq(timetableEntries.teacherId, filters.teacherId));
    if (filters.dayOfWeek !== undefined && filters.dayOfWeek !== null && String(filters.dayOfWeek).trim() !== "") {
      conditions.push(eq(timetableEntries.dayOfWeek, Number(filters.dayOfWeek)));
    }
    if (filters.periodId) conditions.push(eq(timetableEntries.periodId, filters.periodId));

    const rows = await this.database.db
      .select()
      .from(timetableEntries)
      .where(and(...conditions))
      .orderBy(asc(timetableEntries.dayOfWeek), asc(timetableEntries.periodId), asc(timetableEntries.id));

    return rows.map((row) => this.timetableEntryDto(tenant, row));
  }

  async saveTimetableEntry(tenant: Tenant, data: JsonRecord) {
    await this.validateTimetableReferences(tenant.workspaceId, data);
    await this.assertNoTimetableConflict(tenant.workspaceId, data, typeof data.id === "string" ? data.id : undefined);
    const id = typeof data.id === "string" ? data.id : uuid();
    const values = {
      workspaceId: tenant.workspaceId,
      academicYearId: String(data.academicYearId),
      termId: typeof data.termId === "string" && data.termId ? data.termId : undefined,
      gradeId: String(data.gradeId),
      sectionId: String(data.sectionId),
      subjectId: String(data.subjectId),
      teacherId: String(data.teacherId),
      roomId: typeof data.roomId === "string" && data.roomId ? data.roomId : undefined,
      dayOfWeek: Number(data.dayOfWeek),
      periodId: String(data.periodId),
    };
    if (data.id) {
      await this.database.db.update(timetableEntries).set({ ...values, updatedAt: new Date() }).where(and(eq(timetableEntries.id, id), eq(timetableEntries.workspaceId, tenant.workspaceId))).catch(databaseError);
    } else {
      await this.database.db.insert(timetableEntries).values({ id, ...values }).catch(databaseError);
    }
    return (await this.listTimetableEntries(tenant, {})).find((row) => row.id === id) ?? this.notFound("Timetable entry");
  }

  async deleteTimetableEntry(tenant: Tenant, id: string) {
    await this.database.db.delete(timetableEntries).where(and(eq(timetableEntries.workspaceId, tenant.workspaceId), eq(timetableEntries.id, id)));
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

  private async assertStaff(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(staffMembers).where(and(eq(staffMembers.workspaceId, workspaceId), eq(staffMembers.id, id))).limit(1);
    if (!rows.length) this.notFound("Staff member");
  }

  private async assertPeriod(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(timePeriods).where(and(eq(timePeriods.workspaceId, workspaceId), eq(timePeriods.id, id))).limit(1);
    if (!rows.length) this.notFound("Period");
  }

  private async assertAttendanceSession(workspaceId: string, id: string) {
    const rows = await this.database.db.select().from(attendanceSessions).where(and(eq(attendanceSessions.workspaceId, workspaceId), eq(attendanceSessions.id, id))).limit(1);
    if (!rows.length) this.notFound("Attendance session");
  }

  private async assertSectionInGrade(workspaceId: string, sectionId: string, gradeId: string) {
    const rows = await this.database.db.select().from(sections).where(and(eq(sections.workspaceId, workspaceId), eq(sections.id, sectionId), eq(sections.gradeId, gradeId))).limit(1);
    if (!rows.length) throw new ApiError(400, "VALIDATION_FAILED", "Section does not belong to the selected grade.");
  }

  private async findEnrollmentForAttendance(workspaceId: string, studentId: string, academicYearName: string, academicYearId: string, gradeId: string, sectionId: string) {
    const rows = await this.database.db.select().from(enrollments).where(and(
      eq(enrollments.workspaceId, workspaceId),
      eq(enrollments.studentId, studentId),
      or(eq(enrollments.academicYear, academicYearName), eq(enrollments.academicYear, academicYearId)),
      eq(enrollments.gradeId, gradeId),
      eq(enrollments.sectionId, sectionId),
      eq(enrollments.status, "active")
    )).limit(1);
    if (!rows.length) throw new ApiError(400, "VALIDATION_FAILED", "Student does not have an active enrollment for this attendance session.");
    return rows[0];
  }

  private async validateTimetableReferences(workspaceId: string, data: JsonRecord) {
    const day = Number(data.dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) throw new ApiError(400, "VALIDATION_FAILED", "Day of week must be between 0 and 6.");
    await Promise.all([
      this.assertAcademicYear(workspaceId, String(data.academicYearId)),
      this.assertGrade(workspaceId, String(data.gradeId)),
      this.assertSectionInGrade(workspaceId, String(data.sectionId), String(data.gradeId)),
      this.assertSubject(workspaceId, String(data.subjectId)),
      this.assertStaff(workspaceId, String(data.teacherId)),
      this.assertPeriod(workspaceId, String(data.periodId)),
    ]);
    if (data.termId) {
      const rows = await this.database.db.select().from(academicTerms).where(and(eq(academicTerms.workspaceId, workspaceId), eq(academicTerms.id, String(data.termId)), eq(academicTerms.academicYearId, String(data.academicYearId)))).limit(1);
      if (!rows.length) throw new ApiError(400, "VALIDATION_FAILED", "Term does not belong to the selected academic year.");
    }
    const academicYear = await this.getAcademicYearRow(workspaceId, String(data.academicYearId));
    const assignments = await this.database.db.select().from(teachingAssignments).where(and(eq(teachingAssignments.workspaceId, workspaceId), eq(teachingAssignments.staffId, String(data.teacherId)), eq(teachingAssignments.academicYear, academicYear.name), eq(teachingAssignments.gradeId, String(data.gradeId)), eq(teachingAssignments.subjectId, String(data.subjectId)), eq(teachingAssignments.isActive, true)));
    const matchingAssignment = assignments.find((assignment) => !assignment.sectionId || assignment.sectionId === data.sectionId);
    if (!matchingAssignment) throw new ApiError(400, "VALIDATION_FAILED", "Teacher is not assigned to this subject and class for the selected academic year.");
  }

  private async assertNoTimetableConflict(workspaceId: string, data: JsonRecord, exceptId?: string) {
    const rows = await this.database.db.select().from(timetableEntries).where(and(eq(timetableEntries.workspaceId, workspaceId), eq(timetableEntries.academicYearId, String(data.academicYearId)), eq(timetableEntries.dayOfWeek, Number(data.dayOfWeek)), eq(timetableEntries.periodId, String(data.periodId))));
    for (const row of rows) {
      if (row.id === exceptId) continue;
      if (row.teacherId === data.teacherId) throw new ApiError(409, "VALIDATION_FAILED", "Teacher already has a class in this period.");
      if (row.gradeId === data.gradeId && row.sectionId === data.sectionId) throw new ApiError(409, "VALIDATION_FAILED", "Class section already has a timetable entry in this period.");
      if (data.roomId && row.roomId && row.roomId === data.roomId) throw new ApiError(409, "VALIDATION_FAILED", "Room already has a timetable entry in this period.");
    }
  }

  private attendanceSessionDto(tenant: Tenant, row: typeof attendanceSessions.$inferSelect) {
    return {
      id: row.id,
      organizationId: tenant.organizationId,
      academicYearId: row.academicYearId,
      date: row.attendanceDate,
      gradeId: row.gradeId,
      sectionId: row.sectionId,
      subjectId: row.subjectId ?? undefined,
      teacherId: row.teacherId ?? undefined,
      sessionType: row.sessionType,
      status: row.status,
      markedBy: row.markedBy ?? undefined,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private attendanceRecordDto(tenant: Tenant, row: typeof attendanceRecords.$inferSelect) {
    return {
      id: row.id,
      organizationId: tenant.organizationId,
      sessionId: row.sessionId,
      studentId: row.studentId,
      status: row.status,
      note: row.note ?? undefined,
      markedAt: iso(row.markedAt),
      markedBy: row.markedBy,
      updatedAt: iso(row.updatedAt),
    };
  }

  private schoolScheduleDto(tenant: Tenant, row: typeof schoolSchedules.$inferSelect) {
    return { ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private periodDto(tenant: Tenant, row: typeof timePeriods.$inferSelect) {
    return { ...row, organizationId: tenant.organizationId, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private timetableEntryDto(tenant: Tenant, row: typeof timetableEntries.$inferSelect) {
    return { ...row, organizationId: tenant.organizationId, termId: row.termId ?? undefined, roomId: row.roomId ?? undefined, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) };
  }

  private async nextEmployeeNumber(workspaceId: string, tx?: DatabaseClient["db"]): Promise<string> {
    const client = tx ?? this.database.db;
    const [rows] = (await client.execute(
      sql`SELECT employee_number as employeeNumber FROM staff_members WHERE workspace_id = ${workspaceId} FOR UPDATE`
    )) as unknown as [Array<{ employeeNumber: string }>];

    let max = 0;
    for (const row of rows) {
      const match = /^EMP-(\d+)$/.exec(row.employeeNumber);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return `EMP-${String(max + 1).padStart(3, "0")}`;
  }

  private async nextAdmissionNumber(workspaceId: string, tx?: DatabaseClient["db"]): Promise<string> {
    const year = new Date().getFullYear();
    const client = tx ?? this.database.db;
    const [rows] = (await client.execute(
      sql`SELECT admission_number as admissionNumber FROM students WHERE workspace_id = ${workspaceId} FOR UPDATE`
    )) as unknown as [Array<{ admissionNumber: string }>];

    const pattern = new RegExp(`^(?:TMS|ADM)-${year}-(\\d+)$`);
    let max = 0;
    for (const row of rows) {
      const match = pattern.exec(row.admissionNumber);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return `TMS-${year}-${String(max + 1).padStart(5, "0")}`;
  }

  private async insertAndGet<T>(insert: () => Promise<unknown>, get: () => Promise<T>): Promise<T> {
    await insert().catch(databaseError);
    return get();
  }

  private notFound(label: string): never {
    throw new ApiError(404, "NOT_FOUND", `${label} not found.`);
  }
}
