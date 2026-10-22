import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import { parsePagination, buildPaginationMetadata } from "../../common/pagination/pagination.js";
import {
  validateCreateAcademicYear,
  validateUpdateAcademicYear,
  validateCreateGrade,
  validateCreateSection,
  validateCreateStudent,
  validateUpdateStudent,
  validateCreateEnrollment,
  validateTransferStudent,
  validateCreateAttendanceSession,
  validateRecordAttendance,
  validateCreateStaff,
  validateCreateTeachingAssignment,
  validateCreateEnquiry,
  validateCreateApplication,
  validateCreateInvoice,
  validateRecordPayment,
  validateGenerateRecurringInvoices,
  validateCreateExpense,
  validateCreateIncome,
} from "./validation/sis-validation.js";
import { SisAnalyticsService } from "./sis-analytics.service.js";
import { SisCommunicationService } from "./sis-communication.service.js";
import { SisExaminationService } from "./sis-examination.service.js";
import { SisFinanceService } from "./sis-finance.service.js";
import { SisPortalService } from "./sis-portal.service.js";
import { SisService } from "./sis.service.js";
import { SisAdmissionsService } from "./sis-admissions.service.js";

async function readTenant(request: Parameters<AuthService["requireOrganizationPermission"]>[0], database: ConstructorParameters<typeof SisService>[0], organizationId: string, permission: "workspace.read" | "workspace.manage") {
  const tenantContext = createTenantContext(organizationId);
  await new AuthService(database).requireOrganizationPermission(request, tenantContext.organizationId, permission);
  return new SisService(database).getTenant(tenantContext.organizationId);
}

function body(request: { body?: unknown }) {
  return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
}

async function readTenantAuth(
  request: Parameters<AuthService["requireOrganizationPermission"]>[0] & { body?: unknown },
  database: ConstructorParameters<typeof SisService>[0],
  organizationId: string,
  permission: "workspace.read" | "workspace.manage",
) {
  const tenantContext = createTenantContext(organizationId);
  const auth = await new AuthService(database).requireOrganizationPermission(request, tenantContext.organizationId, permission);
  const tenant = await new SisService(database).getTenant(tenantContext.organizationId);
  const membership = auth.memberships.find((item) => item.organizationId === tenantContext.organizationId && item.status === "active");
  // SEC-001: Derive actor strictly from verified server-side authentication and active membership.
  // Any client-supplied body.actor is completely ignored to prevent actor spoofing and privilege escalation.
  const authoritativeActor = {
    userId: auth.user.id,
    role: membership?.role ?? "Member",
    email: auth.user.email,
  };
  return { tenant, auth, actor: authoritativeActor };
}

export const educationModule: BackendModule = {
  name: "education",
  register(router) {
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/academic-years", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { academicYears: await new SisService(database).listAcademicYears(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/academic-years", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { academicYear: await new SisService(database).createAcademicYear(tenant, validateCreateAcademicYear(body(request))) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/academic-years/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { academicYear: await new SisService(database).updateAcademicYear(tenant, routeParams.id, validateUpdateAcademicYear(body(request))) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/terms", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { terms: await new SisService(database).listTerms(tenant, url.searchParams.get("academicYearId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/terms", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { term: await new SisService(database).createTerm(tenant, body(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/terms/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { term: await new SisService(database).updateTerm(tenant, routeParams.id, body(request)) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/grades", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { grades: await new SisService(database).listGrades(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/grades", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { grade: await new SisService(database).createGrade(tenant, validateCreateGrade(body(request))) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/grades/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { grade: await new SisService(database).getGrade(tenant, routeParams.id) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/grades/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { grade: await new SisService(database).updateGrade(tenant, routeParams.id, body(request)) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/sections", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { sections: await new SisService(database).listSections(tenant, url.searchParams.get("gradeId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/sections", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { section: await new SisService(database).createSection(tenant, validateCreateSection(body(request))) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/sections/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { section: await new SisService(database).getSection(tenant, routeParams.id) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/sections/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { section: await new SisService(database).updateSection(tenant, routeParams.id, body(request)) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/subjects", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { subjects: await new SisService(database).listSubjects(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/subjects", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { subject: await new SisService(database).createSubject(tenant, body(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/subjects/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { subject: await new SisService(database).updateSubject(tenant, routeParams.id, body(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/grades/:gradeId/subjects", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.gradeId, "gradeId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { subjectIds: await new SisService(database).getClassSubjects(tenant, routeParams.gradeId) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/grades/:gradeId/subjects/:subjectId", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.gradeId, "gradeId");
      assertUuid(routeParams.subjectId, "subjectId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      await new SisService(database).assignSubjectToClass(tenant, routeParams.gradeId, routeParams.subjectId);
      sendJson(response, 200, { ok: true });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/grades/:gradeId/subjects/:subjectId", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.gradeId, "gradeId");
      assertUuid(routeParams.subjectId, "subjectId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      await new SisService(database).removeSubjectFromClass(tenant, routeParams.gradeId, routeParams.subjectId);
      sendJson(response, 200, { ok: true });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/departments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { departments: await new SisService(database).listDepartments(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/departments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { department: await new SisService(database).createDepartment(tenant, body(request)) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/staff", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const pagination = parsePagination(url);
      const service = new SisService(database);
      const [staff, total] = await Promise.all([
        service.listStaff(tenant, pagination),
        service.countStaff(tenant),
      ]);
      sendJson(response, 200, {
        staff,
        data: staff,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/staff", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { staffMember: await new SisService(database).createStaff(tenant, validateCreateStaff(body(request))) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/staff/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { staffMember: await new SisService(database).getStaff(tenant, routeParams.id) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/staff/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { staffMember: await new SisService(database).updateStaff(tenant, routeParams.id, body(request)) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/teaching-assignments", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const pagination = parsePagination(url);
      const filters = {
        staffId: url.searchParams.get("staffId") ?? undefined,
        academicYear: url.searchParams.get("academicYear") ?? undefined,
        gradeId: url.searchParams.get("gradeId") ?? undefined,
        sectionId: url.searchParams.get("sectionId") ?? undefined,
      };
      const service = new SisService(database);
      const [assignments, total] = await Promise.all([
        service.listTeachingAssignments(tenant, filters, pagination),
        service.countTeachingAssignments(tenant, filters),
      ]);
      sendJson(response, 200, {
        assignments,
        data: assignments,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/teaching-assignments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { assignment: await new SisService(database).createTeachingAssignment(tenant, validateCreateTeachingAssignment(body(request))) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/teaching-assignments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { assignment: await new SisService(database).updateTeachingAssignment(tenant, routeParams.id, body(request)) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/students", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const pagination = parsePagination(url);
      const admissionNumber = url.searchParams.get("admissionNumber")?.toLowerCase();
      const status = url.searchParams.get("status") ?? undefined;
      const service = new SisService(database);
      const [students, total] = await Promise.all([
        service.listStudents(tenant, { admissionNumber, status }, pagination),
        service.countStudents(tenant, { admissionNumber, status }),
      ]);
      sendJson(response, 200, {
        students,
        data: students,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/students", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { student: await new SisService(database).createStudent(tenant, validateCreateStudent(body(request))) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/students/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { student: await new SisService(database).getStudent(tenant, routeParams.id) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/students/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { student: await new SisService(database).updateStudent(tenant, routeParams.id, validateUpdateStudent(body(request))) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/students/:id", async handler(request, response, { database, routeParams, url }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      const actor = (request as unknown as { actor?: { userId?: string; role?: string } }).actor;
      const forceWithOutstandingDues = url.searchParams.get("forceWithOutstandingDues") === "true";
      await new SisService(database).deleteStudent(tenant, routeParams.id, { forceWithOutstandingDues }, actor);
      sendJson(response, 200, { ok: true });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/enrollments", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const pagination = parsePagination(url);
      const filters = {
        studentId: url.searchParams.get("studentId") ?? undefined,
        academicYear: url.searchParams.get("academicYear") ?? undefined,
        gradeId: url.searchParams.get("gradeId") ?? undefined,
        sectionId: url.searchParams.get("sectionId") ?? undefined,
        status: url.searchParams.get("status") ?? undefined,
      };
      const service = new SisService(database);
      const [enrollments, total] = await Promise.all([
        service.listEnrollments(tenant, filters, pagination),
        service.countEnrollments(tenant, filters),
      ]);
      sendJson(response, 200, {
        enrollments,
        data: enrollments,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/enrollments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { enrollment: await new SisService(database).createEnrollment(tenant, validateCreateEnrollment(body(request))) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/enrollments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { enrollment: await new SisService(database).updateEnrollment(tenant, routeParams.id, body(request)) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/students/:studentId/transfer", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.studentId, "studentId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      const actor = (request as unknown as { actor?: { userId?: string; role?: string } }).actor;
      const validatedTransfer = validateTransferStudent(body(request));
      sendJson(response, 201, {
        enrollment: await new SisService(database).transferStudent(
          tenant,
          routeParams.studentId,
          validatedTransfer.sectionId,
          {
            gradeId: validatedTransfer.gradeId,
            academicYear: validatedTransfer.academicYear,
          },
          actor
        ),
      });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/attendance/sessions", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const pagination = parsePagination(url);
      const filters = {
        academicYearId: url.searchParams.get("academicYearId") ?? undefined,
        date: url.searchParams.get("date") ?? undefined,
        gradeId: url.searchParams.get("gradeId") ?? undefined,
        sectionId: url.searchParams.get("sectionId") ?? undefined,
      };
      const service = new SisService(database);
      const [sessions, total] = await Promise.all([
        service.listAttendanceSessions(tenant, filters, pagination),
        service.countAttendanceSessions(tenant, filters),
      ]);
      sendJson(response, 200, {
        sessions,
        data: sessions,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/attendance/sessions", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { session: await new SisService(database).createAttendanceSession(tenant, validateCreateAttendanceSession(body(request))) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/attendance/sessions/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { session: await new SisService(database).getAttendanceSession(tenant, routeParams.id) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/attendance/sessions/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { session: await new SisService(database).updateAttendanceSession(tenant, routeParams.id, body(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/attendance/sessions/:id/records", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { records: await new SisService(database).listAttendanceRecords(tenant, routeParams.id) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/attendance/sessions/:id/records", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      const validated = validateRecordAttendance(body(request));
      sendJson(response, 200, {
        records: await new SisService(database).saveAttendanceRecords(
          tenant,
          routeParams.id,
          validated.records as Array<{ studentId: string; status: string; note?: string }>,
          String(validated.markedBy ?? "")
        ),
      });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/attendance/students/:studentId/history", async handler(request, response, { database, routeParams, url }) {
      assertUuid(routeParams.studentId, "studentId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { history: await new SisService(database).getStudentAttendanceHistory(tenant, routeParams.studentId, url.searchParams.get("academicYearId") ?? undefined) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/attendance/students/:studentId/summary", async handler(request, response, { database, routeParams, url }) {
      assertUuid(routeParams.studentId, "studentId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { summary: await new SisService(database).getStudentAttendanceSummary(tenant, routeParams.studentId, url.searchParams.get("academicYearId") ?? undefined) });
    }});


    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/examinations", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { examinations: await new SisExaminationService(database).listExaminations(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/examinations", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { examination: await new SisExaminationService(database).createExamination(tenant, body(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/examinations/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { examination: await new SisExaminationService(database).updateExamination(tenant, routeParams.id, body(request)) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/examinations/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, await new SisExaminationService(database).deleteExamination(tenant, routeParams.id));
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/examinations/:id/archive", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { examination: await new SisExaminationService(database).archiveExamination(tenant, routeParams.id) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/examination-subjects", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { subjects: await new SisExaminationService(database).listExaminationSubjects(tenant, url.searchParams.get("examinationId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/examination-subjects", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { subject: await new SisExaminationService(database).addExaminationSubject(tenant, body(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/examination-subjects/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { subject: await new SisExaminationService(database).updateExaminationSubject(tenant, routeParams.id, body(request)) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/examination-subjects/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, await new SisExaminationService(database).deleteExaminationSubject(tenant, routeParams.id));
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/assessments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { assessments: await new SisExaminationService(database).listAssessments(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/assessments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { assessment: await new SisExaminationService(database).createAssessment(tenant, body(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/assessments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { assessment: await new SisExaminationService(database).getAssessment(tenant, routeParams.id) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/assessments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { assessment: await new SisExaminationService(database).updateAssessment(tenant, routeParams.id, body(request)) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/assessments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, await new SisExaminationService(database).deleteAssessment(tenant, routeParams.id));
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/grading-rules", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { rules: await new SisExaminationService(database).listGradingRules(tenant) });
    }});
    router.register({ method: "PUT", path: "/api/v1/organizations/:organizationId/sis/grading-rules", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { rule: await new SisExaminationService(database).saveGradingRule(tenant, body(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/marks", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { marks: await new SisExaminationService(database).listMarks(tenant, { sourceType: url.searchParams.get("sourceType") ?? undefined, sourceId: url.searchParams.get("sourceId") ?? undefined, studentId: url.searchParams.get("studentId") ?? undefined, gradeId: url.searchParams.get("gradeId") ?? undefined, sectionId: url.searchParams.get("sectionId") ?? undefined, subjectId: url.searchParams.get("subjectId") ?? undefined }) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/marks", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { mark: await new SisExaminationService(database).enterMark(tenant, body(request)) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/marks/bulk", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      const payload = body(request);
      sendJson(response, 200, { marks: await new SisExaminationService(database).bulkEnterMarks(tenant, Array.isArray(payload.marks) ? payload.marks as Record<string, unknown>[] : []) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/results/calculate", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { results: await new SisExaminationService(database).calculateClassResults(tenant, String(url.searchParams.get("examinationId") ?? ""), String(url.searchParams.get("gradeId") ?? ""), String(url.searchParams.get("sectionId") ?? "")) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/results/submit-review", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      const payload = body(request);
      sendJson(response, 200, { publication: await new SisExaminationService(database).submitForReview(tenant, String(payload.examinationId), String(payload.gradeId), String(payload.sectionId), { userId: String(payload.userId ?? "teacher"), role: typeof payload.role === "string" ? payload.role : undefined }) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/results/review", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      const payload = body(request);
      sendJson(response, 200, { publication: await new SisExaminationService(database).reviewResults(tenant, String(payload.examinationId), String(payload.gradeId), String(payload.sectionId), { userId: String(payload.userId ?? "reviewer"), role: typeof payload.role === "string" ? payload.role : "Admin" }, payload.decision === "rejected" ? "rejected" : "approved", typeof payload.comments === "string" ? payload.comments : undefined) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/results/publications", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { publications: await new SisExaminationService(database).listResultPublications(tenant, url.searchParams.get("examinationId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/results/publish", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      const payload = body(request);
      sendJson(response, 200, { publication: await new SisExaminationService(database).publishResults(tenant, String(payload.examinationId), String(payload.gradeId), String(payload.sectionId), typeof payload.publishedBy === "string" ? payload.publishedBy : undefined) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/results/students/:studentId", async handler(request, response, { database, routeParams, url }) {
      assertUuid(routeParams.studentId, "studentId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { result: await new SisExaminationService(database).getStudentResult(tenant, String(url.searchParams.get("examinationId") ?? ""), routeParams.studentId) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/results/performance", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { performance: await new SisExaminationService(database).getSubjectPerformance(tenant, String(url.searchParams.get("examinationId") ?? ""), String(url.searchParams.get("gradeId") ?? ""), String(url.searchParams.get("sectionId") ?? ""), String(url.searchParams.get("subjectId") ?? "")) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/results/corrections", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { corrections: await new SisExaminationService(database).listResultCorrections(tenant, url.searchParams.get("examinationId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/results/corrections", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      const payload = body(request);
      sendJson(response, 201, { correction: await new SisExaminationService(database).requestResultCorrection(tenant, { examinationId: String(payload.examinationId), gradeId: String(payload.gradeId), sectionId: String(payload.sectionId), studentId: String(payload.studentId), subjectId: String(payload.subjectId), newMarks: Number(payload.newMarks), reason: String(payload.reason ?? ""), requestedBy: String(payload.requestedBy ?? "teacher") }) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/results/corrections/:id/review", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      const payload = body(request);
      sendJson(response, 200, { correction: await new SisExaminationService(database).reviewResultCorrection(tenant, routeParams.id, { userId: String(payload.userId ?? "reviewer"), role: typeof payload.role === "string" ? payload.role : "Admin" }, payload.decision === "rejected" ? "rejected" : "approved", typeof payload.comments === "string" ? payload.comments : undefined) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/results/cards/:studentId", async handler(request, response, { database, routeParams, url }) {
      assertUuid(routeParams.studentId, "studentId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { card: await new SisExaminationService(database).getResultCard(tenant, String(url.searchParams.get("examinationId") ?? ""), routeParams.studentId) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/results/cards-batch", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { cards: await new SisExaminationService(database).getBatchResultCards(tenant, String(url.searchParams.get("examinationId") ?? ""), String(url.searchParams.get("gradeId") ?? ""), String(url.searchParams.get("sectionId") ?? "")) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/results/reports/register", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { register: await new SisExaminationService(database).getExamResultRegister(tenant, String(url.searchParams.get("examinationId") ?? ""), String(url.searchParams.get("gradeId") ?? ""), String(url.searchParams.get("sectionId") ?? "")) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/results/reports/missing-marks", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { missingMarks: await new SisExaminationService(database).getMissingMarksReport(tenant, String(url.searchParams.get("examinationId") ?? ""), url.searchParams.get("gradeId") ?? undefined, url.searchParams.get("sectionId") ?? undefined) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/timetable/schedules/:academicYearId", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.academicYearId, "academicYearId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { schedule: await new SisService(database).getSchoolSchedule(tenant, routeParams.academicYearId) });
    }});
    router.register({ method: "PUT", path: "/api/v1/organizations/:organizationId/sis/timetable/schedules", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { schedule: await new SisService(database).saveSchoolSchedule(tenant, body(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/timetable/periods", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { periods: await new SisService(database).listPeriods(tenant) });
    }});
    router.register({ method: "PUT", path: "/api/v1/organizations/:organizationId/sis/timetable/periods", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { period: await new SisService(database).savePeriod(tenant, body(request)) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/timetable/periods/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      await new SisService(database).deletePeriod(tenant, routeParams.id);
      sendJson(response, 200, { ok: true });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/timetable/entries", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { entries: await new SisService(database).listTimetableEntries(tenant, { academicYearId: url.searchParams.get("academicYearId") ?? undefined, termId: url.searchParams.get("termId") ?? undefined, gradeId: url.searchParams.get("gradeId") ?? undefined, sectionId: url.searchParams.get("sectionId") ?? undefined, teacherId: url.searchParams.get("teacherId") ?? undefined, dayOfWeek: url.searchParams.get("dayOfWeek") ?? undefined, periodId: url.searchParams.get("periodId") ?? undefined }) });
    }});
    router.register({ method: "PUT", path: "/api/v1/organizations/:organizationId/sis/timetable/entries", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { entry: await new SisService(database).saveTimetableEntry(tenant, body(request)) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/timetable/entries/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      await new SisService(database).deleteTimetableEntry(tenant, routeParams.id);
      sendJson(response, 200, { ok: true });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/audience/resolve", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { recipients: await new SisCommunicationService(database).resolveAudience(tenant, payload.audience as Record<string, unknown>, actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/templates/render", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, new SisCommunicationService(database).renderTemplate(payload.template as Record<string, unknown>, payload.variables as Record<string, string> ?? {}));
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/templates", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { templates: await new SisCommunicationService(database).listTemplates(tenant) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/templates/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { template: await new SisCommunicationService(database).getTemplate(tenant, routeParams.id) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/templates", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { template: await new SisCommunicationService(database).createTemplate(tenant, body(request), actor) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/communication/templates/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { template: await new SisCommunicationService(database).updateTemplate(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/communication/templates/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, await new SisCommunicationService(database).deleteTemplate(tenant, routeParams.id, actor));
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/announcements", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const recipientKind = url.searchParams.get("recipientKind") ?? undefined;
      const recipientId = url.searchParams.get("recipientId") ?? undefined;
      const announcements = await new SisCommunicationService(database).listAnnouncements(tenant, {
        status: url.searchParams.get("status") ?? undefined,
        category: url.searchParams.get("category") ?? undefined,
        priority: url.searchParams.get("priority") ?? undefined,
        campusId: url.searchParams.get("campusId") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        recipient: recipientKind && recipientId ? {
          kind: recipientKind,
          id: recipientId,
          gradeId: url.searchParams.get("gradeId") ?? undefined,
          sectionId: url.searchParams.get("sectionId") ?? undefined,
        } : undefined,
      });
      sendJson(response, 200, { announcements });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/announcements/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { announcement: await new SisCommunicationService(database).getAnnouncement(tenant, routeParams.id) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/announcements", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { announcement: await new SisCommunicationService(database).createAnnouncement(tenant, body(request), actor) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/communication/announcements/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { announcement: await new SisCommunicationService(database).updateAnnouncement(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/communication/announcements/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, await new SisCommunicationService(database).deleteAnnouncement(tenant, routeParams.id, actor));
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/announcements/:id/publish", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { announcement: await new SisCommunicationService(database).publishAnnouncement(tenant, routeParams.id, actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/announcements/:id/archive", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { announcement: await new SisCommunicationService(database).archiveAnnouncement(tenant, routeParams.id, actor) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/messages", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { messages: await new SisCommunicationService(database).listMessages(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/messages", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { message: await new SisCommunicationService(database).sendCommunication(tenant, body(request), actor) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/notifications", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const recipient = url.searchParams.get("kind") && url.searchParams.get("id") ? { kind: String(url.searchParams.get("kind")), id: String(url.searchParams.get("id")) } : undefined;
      sendJson(response, 200, { notifications: await new SisCommunicationService(database).listNotifications(tenant, recipient) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/notifications/:id", async handler(request, response, { database, routeParams, url }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const recipient = url.searchParams.get("kind") && url.searchParams.get("id") ? { kind: String(url.searchParams.get("kind")), id: String(url.searchParams.get("id")) } : undefined;
      sendJson(response, 200, { notification: await new SisCommunicationService(database).getNotification(tenant, routeParams.id, recipient) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/notifications", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { notification: await new SisCommunicationService(database).createNotification(tenant, body(request)) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/notifications/:id/read", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { notification: await new SisCommunicationService(database).markRead(tenant, routeParams.id, payload.recipient as { kind?: string; id?: string } | undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/notifications/read-all", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { count: await new SisCommunicationService(database).markAllRead(tenant, payload.recipient as { kind: string; id: string }) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/deliveries", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { deliveries: await new SisCommunicationService(database).deliveryHistory(tenant) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/contacts", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { contacts: await new SisCommunicationService(database).getDirectMessageContacts(tenant, actor) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/conversations", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { conversations: await new SisCommunicationService(database).listConversations(tenant, actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/conversations", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 201, { message: await new SisCommunicationService(database).sendDirectMessage(tenant, body(request) as unknown as Parameters<SisCommunicationService["sendDirectMessage"]>[1], actor) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/conversations/:id/messages", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { messages: await new SisCommunicationService(database).getConversationMessages(tenant, routeParams.id, actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/conversations/:id/reply", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      const payload = body(request);
      sendJson(response, 201, { message: await new SisCommunicationService(database).sendDirectMessage(tenant, { ...payload, conversationId: routeParams.id } as unknown as Parameters<SisCommunicationService["sendDirectMessage"]>[1], actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/conversations/:id/archive", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, await new SisCommunicationService(database).archiveConversation(tenant, routeParams.id, actor));
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/deliveries/:id/retry", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { delivery: await new SisCommunicationService(database).retryDelivery(tenant, routeParams.id, actor) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/preferences", async handler(request, response, { database, routeParams, url }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      const kind = url.searchParams.get("kind") || "user";
      const id = url.searchParams.get("id") || String(actor.userId || "");
      sendJson(response, 200, { preference: await new SisCommunicationService(database).getPreferences(tenant, { kind, id }) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/preferences", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { preference: await new SisCommunicationService(database).savePreference(tenant, body(request), actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/domain-notifications", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { notifications: await new SisCommunicationService(database).emitDomainNotification(tenant, String(payload.eventType ?? ""), payload.audience as Record<string, unknown>, payload.payload as Record<string, unknown>) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/summary", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { summary: await new SisCommunicationService(database).summary(tenant) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/portal/policy", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { policy: await new SisPortalService(database).getPolicy(tenant) });
    }});
    router.register({ method: "PUT", path: "/api/v1/organizations/:organizationId/sis/portal/policy", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { policy: await new SisPortalService(database).savePolicy(tenant, body(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/portal/requests", async handler(request, response, { database, routeParams, url }) {
      const { tenant, auth, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      const membership = auth.memberships.find((item) => item.organizationId === tenant.organizationId && item.status === "active");
      const isPrivileged = membership?.role === "Owner" || membership?.role === "Admin";
      const filterActor = isPrivileged && url.searchParams.get("userId")
        ? { userId: url.searchParams.get("userId") ?? "", role: url.searchParams.get("role") ?? "" }
        : actor;
      sendJson(response, 200, { requests: await new SisPortalService(database).listRequests(tenant, filterActor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/portal/requests", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 201, { request: await new SisPortalService(database).submitRequest(tenant, actor, payload.input as Record<string, unknown> ?? {}) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/portal/parent-dashboard", async handler(request, response, { database, routeParams, url }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      sendJson(response, 200, { dashboard: await new SisPortalService(database).getParentDashboard(tenant, auth.user.id, url.searchParams.get("studentId") ?? undefined) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/portal/student-dashboard", async handler(request, response, { database, routeParams, url }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      sendJson(response, 200, { dashboard: await new SisPortalService(database).getStudentDashboard(tenant, auth.user.id, url.searchParams.get("studentId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/portal/students/:studentId/link-user", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.studentId, "studentId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { student: await new SisPortalService(database).linkStudentUser(tenant, routeParams.studentId, body(request)) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/portal/students/:studentId/guardians/:guardianId/link-user", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.studentId, "studentId");
      assertUuid(routeParams.guardianId, "guardianId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { student: await new SisPortalService(database).linkGuardianUser(tenant, routeParams.studentId, routeParams.guardianId, body(request)) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/analytics/overview", async handler(request, response, { database, routeParams, url }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 200, { overview: await new SisAnalyticsService(database).getOverview(tenant, url.searchParams, { userId: auth.user.id, role: membership?.role ?? "Member" }) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/analytics/data-quality", async handler(request, response, { database, routeParams, url }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 200, { issues: await new SisAnalyticsService(database).getDataQuality(tenant, url.searchParams, { userId: auth.user.id, role: membership?.role ?? "Member" }) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/analytics/health", async handler(request, response, { database, routeParams, url }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 200, { health: await new SisAnalyticsService(database).getHealth(tenant, url.searchParams, { userId: auth.user.id, role: membership?.role ?? "Member" }) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/reports/:kind", async handler(request, response, { database, routeParams, url }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 200, { report: await new SisAnalyticsService(database).getReport(tenant, routeParams.kind as never, url.searchParams, { userId: auth.user.id, role: membership?.role ?? "Member" }) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/reports/:kind/export", async handler(request, response, { database, routeParams, url }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 200, { csv: await new SisAnalyticsService(database).exportCsv(tenant, routeParams.kind as never, url.searchParams, { userId: auth.user.id, role: membership?.role ?? "Member" }) });
    }});
    /* ─────────────────────────────────────────────────────────────
     * FINANCIAL MANAGEMENT (EPIC 10M)
     * ───────────────────────────────────────────────────────────── */
    // Categories
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/categories", async handler(request, response, { database, routeParams }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { categories: await new SisFinanceService(database).listCategories(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/categories", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { category: await new SisFinanceService(database).createCategory(tenant, body(request), actor) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/finance/categories/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { category: await new SisFinanceService(database).updateCategory(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/finance/categories/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { category: await new SisFinanceService(database).deleteCategory(tenant, routeParams.id, actor) });
    }});

    // Fee Structures
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/structures", async handler(request, response, { database, routeParams }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { structures: await new SisFinanceService(database).listStructures(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/structures", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { structure: await new SisFinanceService(database).createStructure(tenant, body(request), actor) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/finance/structures/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { structure: await new SisFinanceService(database).updateStructure(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/finance/structures/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { structure: await new SisFinanceService(database).deleteStructure(tenant, routeParams.id, actor) });
    }});

    // Assignments
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/assignments", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { assignments: await new SisFinanceService(database).listAssignments(tenant, url.searchParams.get("studentId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/assignments", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      const reqBody = body(request);
      sendJson(response, 201, { assignment: await new SisFinanceService(database).assignFee(tenant, String(reqBody.studentId), String(reqBody.enrollmentId), String(reqBody.feeStructureId), actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/assignments/bulk", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, await new SisFinanceService(database).bulkAssignFee(tenant, body(request) as unknown as Parameters<SisFinanceService["bulkAssignFee"]>[1], actor));
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/finance/assignments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, await new SisFinanceService(database).unassignFee(tenant, routeParams.id, actor));
    }});

    // Discounts
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/discounts", async handler(request, response, { database, routeParams }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { discounts: await new SisFinanceService(database).listDiscounts(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/discounts", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { discount: await new SisFinanceService(database).createDiscount(tenant, body(request), actor) });
    }});

    // Invoices & Billing
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/invoices", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      const pagination = parsePagination(url);
      const service = new SisFinanceService(database);
      const [invoices, total] = await Promise.all([
        service.listInvoices(tenant, url.searchParams, pagination),
        service.countInvoices(tenant, url.searchParams),
      ]);
      sendJson(response, 200, {
        invoices,
        data: invoices,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/invoices", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { invoice: await new SisFinanceService(database).createInvoice(tenant, validateCreateInvoice(body(request)), actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/invoices/:id/issue", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { invoice: await new SisFinanceService(database).issueInvoice(tenant, routeParams.id, actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/invoices/:id/void", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { invoice: await new SisFinanceService(database).voidInvoice(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/invoices/generate-recurring", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, await new SisFinanceService(database).generateRecurringInvoices(tenant, validateGenerateRecurringInvoices(body(request)) as unknown as Parameters<SisFinanceService["generateRecurringInvoices"]>[1], actor));
    }});

    // Payments & Receipts & Reconciliation
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/payments", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      const pagination = parsePagination(url);
      const service = new SisFinanceService(database);
      const [payments, total] = await Promise.all([
        service.listPayments(tenant, url.searchParams, pagination),
        service.countPayments(tenant, url.searchParams),
      ]);
      sendJson(response, 200, {
        payments,
        data: payments,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/payments", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, await new SisFinanceService(database).recordPayment(tenant, validateRecordPayment(body(request)), actor));
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/payments/:id/void", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { payment: await new SisFinanceService(database).voidPayment(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/payments/:id/reconcile", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { payment: await new SisFinanceService(database).reconcilePayment(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/payments/:id/unreconcile", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { payment: await new SisFinanceService(database).unreconcilePayment(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/receipts", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { receipts: await new SisFinanceService(database).listReceipts(tenant, url.searchParams.get("studentId") ?? undefined) });
    }});

    // Ledger & Integrity
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/ledger/:studentId", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.studentId, "studentId");
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { ledger: await new SisFinanceService(database).ledger(tenant, routeParams.studentId) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/ledger/:studentId/reconciliation", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.studentId, "studentId");
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { audit: await new SisFinanceService(database).reconcileStudentLedger(tenant, routeParams.studentId) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/ledger-audit", async handler(request, response, { database, routeParams }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, await new SisFinanceService(database).auditLedgerIntegrity(tenant));
    }});

    // Late Fee Policies
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/late-fee-policies", async handler(request, response, { database, routeParams }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { policies: await new SisFinanceService(database).listLateFeePolicies(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/late-fee-policies", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { policy: await new SisFinanceService(database).createLateFeePolicy(tenant, body(request), actor) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/finance/late-fee-policies/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { policy: await new SisFinanceService(database).updateLateFeePolicy(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/finance/late-fee-policies/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { policy: await new SisFinanceService(database).deleteLateFeePolicy(tenant, routeParams.id, actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/late-fee-policies/apply", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, await new SisFinanceService(database).applyLateFees(tenant, body(request), actor));
    }});

    // Expense Categories & Expenses
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/expense-categories", async handler(request, response, { database, routeParams }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { categories: await new SisFinanceService(database).listExpenseCategories(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/expense-categories", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { category: await new SisFinanceService(database).createExpenseCategory(tenant, body(request), actor) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/finance/expense-categories/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { category: await new SisFinanceService(database).updateExpenseCategory(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/finance/expense-categories/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { category: await new SisFinanceService(database).deleteExpenseCategory(tenant, routeParams.id, actor) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/expenses", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      const pagination = parsePagination(url);
      const service = new SisFinanceService(database);
      const [expenses, total] = await Promise.all([
        service.listExpenses(tenant, url.searchParams, pagination),
        service.countExpenses(tenant, url.searchParams),
      ]);
      sendJson(response, 200, {
        expenses,
        data: expenses,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/expenses", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { expense: await new SisFinanceService(database).createExpense(tenant, validateCreateExpense(body(request)), actor) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/finance/expenses/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { expense: await new SisFinanceService(database).updateExpense(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/finance/expenses/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { expense: await new SisFinanceService(database).deleteExpense(tenant, routeParams.id, actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/expenses/:id/submit", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { expense: await new SisFinanceService(database).submitExpense(tenant, routeParams.id, actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/expenses/:id/approve", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { expense: await new SisFinanceService(database).approveExpense(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/expenses/:id/reject", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { expense: await new SisFinanceService(database).rejectExpense(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/expenses/:id/disburse", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { expense: await new SisFinanceService(database).disburseExpense(tenant, routeParams.id, body(request), actor) });
    }});

    // Non-Tuition Incomes
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/incomes", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      const pagination = parsePagination(url);
      const service = new SisFinanceService(database);
      const [incomes, total] = await Promise.all([
        service.listIncomes(tenant, url.searchParams, pagination),
        service.countIncomes(tenant, url.searchParams),
      ]);
      sendJson(response, 200, {
        incomes,
        data: incomes,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/incomes", async handler(request, response, { database, routeParams }) {
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { income: await new SisFinanceService(database).createIncome(tenant, validateCreateIncome(body(request)), actor) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/finance/incomes/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { income: await new SisFinanceService(database).updateIncome(tenant, routeParams.id, body(request), actor) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/finance/incomes/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const { tenant, actor } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { income: await new SisFinanceService(database).deleteIncome(tenant, routeParams.id, actor) });
    }});

    // Reports
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/summary", async handler(request, response, { database, routeParams }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { summary: await new SisFinanceService(database).collectionSummary(tenant) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/collection", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { rows: await new SisFinanceService(database).collectionReport(tenant, url.searchParams) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/outstanding", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { rows: await new SisFinanceService(database).outstandingReport(tenant, url.searchParams) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/payments", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { rows: await new SisFinanceService(database).paymentReport(tenant, url.searchParams) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/grades", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { rows: await new SisFinanceService(database).gradeSummary(tenant, url.searchParams) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/income-expense", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { report: await new SisFinanceService(database).incomeExpenseReport(tenant, url.searchParams) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/cash-flow", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { report: await new SisFinanceService(database).cashFlowReport(tenant, url.searchParams) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/late-fees", async handler(request, response, { database, routeParams, url }) {
      const { tenant } = await readTenantAuth(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { report: await new SisFinanceService(database).lateFeesReport(tenant, url.searchParams) });
    }});

    /* ─────────────────────────────────────────────────────────────
     * ADMISSIONS & ENROLLMENT (EPIC 10K)
     * ───────────────────────────────────────────────────────────── */
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/admissions/dashboard", async handler(request, response, { database, routeParams, url }) {
      await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const filters = {
        academicYear: url.searchParams.get("academicYear") ?? undefined,
        campus: url.searchParams.get("campus") ?? undefined,
        gradeId: url.searchParams.get("gradeId") ?? undefined,
      };
      sendJson(response, 200, { dashboard: await new SisAdmissionsService(database).getDashboard(tenant, filters) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/admissions/enquiries", async handler(request, response, { database, routeParams, url }) {
      await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const pagination = parsePagination(url);
      const filters = {
        status: url.searchParams.get("status") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        gradeId: url.searchParams.get("gradeId") ?? undefined,
        campus: url.searchParams.get("campus") ?? undefined,
      };
      const service = new SisAdmissionsService(database);
      const [enquiries, total] = await Promise.all([
        service.listEnquiries(tenant, filters, pagination),
        service.countEnquiries(tenant, filters),
      ]);
      sendJson(response, 200, {
        enquiries,
        data: enquiries,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/admissions/enquiries", async handler(request, response, { database, routeParams }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 201, {
        enquiry: await new SisAdmissionsService(database).createEnquiry(tenant, validateCreateEnquiry(body(request)), {
          userId: auth.user.id,
          role: membership?.role ?? "Staff",
        }),
      });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/admissions/enquiries/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      sendJson(response, 200, { enquiry: await new SisAdmissionsService(database).getEnquiry(tenant, routeParams.id) });
    }});

    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/admissions/enquiries/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 200, {
        enquiry: await new SisAdmissionsService(database).updateEnquiry(tenant, routeParams.id, body(request), {
          userId: auth.user.id,
          role: membership?.role ?? "Staff",
        }),
      });
    }});

    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/admissions/enquiries/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      await new SisAdmissionsService(database).deleteEnquiry(tenant, routeParams.id, {
        userId: auth.user.id,
        role: membership?.role ?? "Staff",
      });
      sendJson(response, 200, { success: true });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/admissions/enquiries/:id/convert", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 201, {
        application: await new SisAdmissionsService(database).convertEnquiryToApplication(tenant, routeParams.id, {
          userId: auth.user.id,
          role: membership?.role ?? "Staff",
        }),
      });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/admissions/applications", async handler(request, response, { database, routeParams, url }) {
      await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const pagination = parsePagination(url);
      const filters = {
        status: url.searchParams.get("status") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
        gradeId: url.searchParams.get("gradeId") ?? undefined,
        academicYear: url.searchParams.get("academicYear") ?? undefined,
        campus: url.searchParams.get("campus") ?? undefined,
      };
      const service = new SisAdmissionsService(database);
      const [applications, total] = await Promise.all([
        service.listApplications(tenant, filters, pagination),
        service.countApplications(tenant, filters),
      ]);
      sendJson(response, 200, {
        applications,
        data: applications,
        pagination: buildPaginationMetadata(total, pagination),
      });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/admissions/applications", async handler(request, response, { database, routeParams }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 201, {
        application: await new SisAdmissionsService(database).createApplication(tenant, validateCreateApplication(body(request)), {
          userId: auth.user.id,
          role: membership?.role ?? "Staff",
        }),
      });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/admissions/applications/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      sendJson(response, 200, { application: await new SisAdmissionsService(database).getApplication(tenant, routeParams.id) });
    }});

    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/admissions/applications/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 200, {
        application: await new SisAdmissionsService(database).updateApplication(tenant, routeParams.id, body(request), {
          userId: auth.user.id,
          role: membership?.role ?? "Staff",
        }),
      });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/admissions/applications/:id/submit", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 200, {
        application: await new SisAdmissionsService(database).submitApplication(tenant, routeParams.id, {
          userId: auth.user.id,
          role: membership?.role ?? "Staff",
        }),
      });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/admissions/applications/:id/withdraw", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      const reqBody = body(request);
      sendJson(response, 200, {
        application: await new SisAdmissionsService(database).withdrawApplication(tenant, routeParams.id, reqBody.reason as string | undefined, {
          userId: auth.user.id,
          role: membership?.role ?? "Staff",
        }),
      });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/admissions/applications/:id/decision", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      const reqBody = body(request);
      sendJson(response, 200, {
        application: await new SisAdmissionsService(database).recordDecision(
          tenant,
          routeParams.id,
          reqBody as {
            status: "approved" | "rejected" | "waitlisted" | "under_review" | "assessment";
            remarks?: string;
            rejectionReason?: string;
            waitlistRank?: number;
          },
          {
            userId: auth.user.id,
            role: membership?.role ?? "Admin",
          }
        ),
      });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/admissions/assessments", async handler(request, response, { database, routeParams, url }) {
      await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      sendJson(response, 200, {
        assessments: await new SisAdmissionsService(database).listAssessments(tenant, url.searchParams.get("applicationId") ?? undefined),
      });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/admissions/assessments", async handler(request, response, { database, routeParams }) {
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 201, {
        assessment: await new SisAdmissionsService(database).createAssessment(tenant, body(request), {
          userId: auth.user.id,
          role: membership?.role ?? "Staff",
        }),
      });
    }});

    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/admissions/assessments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      sendJson(response, 200, {
        assessment: await new SisAdmissionsService(database).updateAssessment(tenant, routeParams.id, body(request), {
          userId: auth.user.id,
          role: membership?.role ?? "Staff",
        }),
      });
    }});

    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/admissions/assessments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      await new SisAdmissionsService(database).deleteAssessment(tenant, routeParams.id, {
        userId: auth.user.id,
        role: membership?.role ?? "Staff",
      });
      sendJson(response, 200, { success: true });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/admissions/applications/:id/fee-preview", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      sendJson(response, 200, await new SisAdmissionsService(database).getFeePackagePreview(tenant, routeParams.id));
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/admissions/applications/:id/assign-fees", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      const reqBody = body(request);
      sendJson(response, 200, {
        application: await new SisAdmissionsService(database).assignFeePackage(
          tenant,
          routeParams.id,
          reqBody as { feeStructureIds: string[]; discountIds?: string[]; admissionFeeCents?: number },
          {
            userId: auth.user.id,
            role: membership?.role ?? "Admin",
          }
        ),
      });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/admissions/applications/:id/convert-enrollment", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const auth = await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.manage");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const membership = auth.memberships.find((item) => item.organizationId === routeParams.organizationId);
      const reqBody = body(request);
      const result = await new SisAdmissionsService(database).convertApplicationToEnrollment(
        tenant,
        routeParams.id,
        reqBody as {
          academicYear: string;
          gradeId: string;
          sectionId: string;
          admissionDate?: string;
          reuseExistingStudentId?: string;
        },
        {
          userId: auth.user.id,
          role: membership?.role ?? "Admin",
        }
      );
      sendJson(response, 201, result);
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/admissions/applications/:id/print", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      sendJson(response, 200, { document: await new SisAdmissionsService(database).getApplicationPrintData(tenant, routeParams.id) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/admissions/reports", async handler(request, response, { database, routeParams, url }) {
      await new AuthService(database).requireOrganizationPermission(request, routeParams.organizationId, "workspace.read");
      const tenant = await new SisService(database).getTenant(routeParams.organizationId);
      const reportType = (url.searchParams.get("type") || "conversion_summary") as "enquiry_register" | "application_register" | "conversion_summary" | "campus_summary" | "grade_summary";
      const filters = {
        academicYear: url.searchParams.get("academicYear") ?? undefined,
        campus: url.searchParams.get("campus") ?? undefined,
      };
      sendJson(response, 200, { report: await new SisAdmissionsService(database).getReport(tenant, reportType, filters) });
    }});
  },
};


