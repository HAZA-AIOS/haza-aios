import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import { SisAnalyticsService } from "./sis-analytics.service.js";
import { SisCommunicationService } from "./sis-communication.service.js";
import { SisExaminationService } from "./sis-examination.service.js";
import { SisFinanceService } from "./sis-finance.service.js";
import { SisPortalService } from "./sis-portal.service.js";
import { SisService } from "./sis.service.js";

async function readTenant(request: Parameters<AuthService["requireOrganizationPermission"]>[0], database: ConstructorParameters<typeof SisService>[0], organizationId: string, permission: "workspace.read" | "workspace.manage") {
  const tenantContext = createTenantContext(organizationId);
  await new AuthService(database).requireOrganizationPermission(request, tenantContext.organizationId, permission);
  return new SisService(database).getTenant(tenantContext.organizationId);
}

function body(request: { body?: unknown }) {
  return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
}

function actor(request: { body?: unknown }, fallback?: Record<string, unknown>) {
  const payload = body(request);
  return (payload.actor && typeof payload.actor === "object" ? payload.actor : fallback) as Record<string, unknown> | undefined;
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
      sendJson(response, 201, { academicYear: await new SisService(database).createAcademicYear(tenant, body(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/academic-years/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { academicYear: await new SisService(database).updateAcademicYear(tenant, routeParams.id, body(request)) });
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
      sendJson(response, 201, { grade: await new SisService(database).createGrade(tenant, body(request)) });
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
      sendJson(response, 201, { section: await new SisService(database).createSection(tenant, body(request)) });
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

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/staff", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { staff: await new SisService(database).listStaff(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/staff", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { staffMember: await new SisService(database).createStaff(tenant, body(request)) });
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
      sendJson(response, 200, { assignments: await new SisService(database).listTeachingAssignments(tenant, { staffId: url.searchParams.get("staffId") ?? undefined, academicYear: url.searchParams.get("academicYear") ?? undefined, gradeId: url.searchParams.get("gradeId") ?? undefined, sectionId: url.searchParams.get("sectionId") ?? undefined }) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/teaching-assignments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { assignment: await new SisService(database).createTeachingAssignment(tenant, body(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/teaching-assignments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { assignment: await new SisService(database).updateTeachingAssignment(tenant, routeParams.id, body(request)) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/students", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const students = await new SisService(database).listStudents(tenant);
      const admissionNumber = url.searchParams.get("admissionNumber")?.toLowerCase();
      sendJson(response, 200, { students: admissionNumber ? students.filter((student) => student.admissionNumber.toLowerCase() === admissionNumber) : students });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/students", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { student: await new SisService(database).createStudent(tenant, body(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/students/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { student: await new SisService(database).getStudent(tenant, routeParams.id) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/students/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { student: await new SisService(database).updateStudent(tenant, routeParams.id, body(request)) });
    }});
    router.register({ method: "DELETE", path: "/api/v1/organizations/:organizationId/sis/students/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      await new SisService(database).deleteStudent(tenant, routeParams.id);
      sendJson(response, 200, { ok: true });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/enrollments", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { enrollments: await new SisService(database).listEnrollments(tenant, { studentId: url.searchParams.get("studentId") ?? undefined, academicYear: url.searchParams.get("academicYear") ?? undefined, gradeId: url.searchParams.get("gradeId") ?? undefined, sectionId: url.searchParams.get("sectionId") ?? undefined, status: url.searchParams.get("status") ?? undefined }) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/enrollments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { enrollment: await new SisService(database).createEnrollment(tenant, body(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/enrollments/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { enrollment: await new SisService(database).updateEnrollment(tenant, routeParams.id, body(request)) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/students/:studentId/transfer", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.studentId, "studentId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { enrollment: await new SisService(database).transferStudent(tenant, routeParams.studentId, String(body(request).sectionId ?? "")) });
    }});

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/attendance/sessions", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { sessions: await new SisService(database).listAttendanceSessions(tenant, { academicYearId: url.searchParams.get("academicYearId") ?? undefined, date: url.searchParams.get("date") ?? undefined, gradeId: url.searchParams.get("gradeId") ?? undefined, sectionId: url.searchParams.get("sectionId") ?? undefined }) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/attendance/sessions", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { session: await new SisService(database).createAttendanceSession(tenant, body(request)) });
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
      const payload = body(request);
      sendJson(response, 200, { records: await new SisService(database).saveAttendanceRecords(tenant, routeParams.id, Array.isArray(payload.records) ? payload.records as Array<{ studentId: string; status: string; note?: string }> : [], String(payload.markedBy ?? "")) });
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
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/examination-subjects", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { subjects: await new SisExaminationService(database).listExaminationSubjects(tenant, url.searchParams.get("examinationId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/examination-subjects", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { subject: await new SisExaminationService(database).addExaminationSubject(tenant, body(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/assessments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { assessments: await new SisExaminationService(database).listAssessments(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/assessments", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { assessment: await new SisExaminationService(database).createAssessment(tenant, body(request)) });
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

    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/categories", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { categories: await new SisFinanceService(database).listCategories(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/categories", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { category: await new SisFinanceService(database).createCategory(tenant, payload, actor(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/finance/categories/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { category: await new SisFinanceService(database).updateCategory(tenant, routeParams.id, payload, actor(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/structures", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { structures: await new SisFinanceService(database).listStructures(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/structures", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { structure: await new SisFinanceService(database).createStructure(tenant, payload, actor(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/finance/structures/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { structure: await new SisFinanceService(database).updateStructure(tenant, routeParams.id, payload, actor(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/assignments", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { assignments: await new SisFinanceService(database).listAssignments(tenant, url.searchParams.get("studentId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/assignments", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { assignment: await new SisFinanceService(database).assignFee(tenant, String(payload.studentId ?? ""), String(payload.enrollmentId ?? ""), String(payload.feeStructureId ?? ""), actor(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/discounts", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { discounts: await new SisFinanceService(database).listDiscounts(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/discounts", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { discount: await new SisFinanceService(database).createDiscount(tenant, payload, actor(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/invoices", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { invoices: await new SisFinanceService(database).listInvoices(tenant, url.searchParams) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/invoices", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { invoice: await new SisFinanceService(database).createInvoice(tenant, payload, actor(request)) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/invoices/:id/issue", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { invoice: await new SisFinanceService(database).issueInvoice(tenant, routeParams.id, actor(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/payments", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { payments: await new SisFinanceService(database).listPayments(tenant, url.searchParams.get("studentId") ?? undefined) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/payments", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, await new SisFinanceService(database).recordPayment(tenant, payload, actor(request)));
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/finance/payments/:id/void", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { payment: await new SisFinanceService(database).voidPayment(tenant, routeParams.id, body(request), actor(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/receipts", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { receipts: await new SisFinanceService(database).listReceipts(tenant, url.searchParams.get("studentId") ?? undefined) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/ledger/:studentId", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.studentId, "studentId");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { ledger: await new SisFinanceService(database).ledger(tenant, routeParams.studentId) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/summary", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { summary: await new SisFinanceService(database).collectionSummary(tenant) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/collection", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { rows: await new SisFinanceService(database).collectionReport(tenant, url.searchParams) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/outstanding", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { rows: await new SisFinanceService(database).outstandingReport(tenant, url.searchParams) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/payments", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { rows: await new SisFinanceService(database).paymentReport(tenant, url.searchParams) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/finance/reports/grades", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { rows: await new SisFinanceService(database).gradeSummary(tenant, url.searchParams) });
    }});

    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/audience/resolve", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { recipients: await new SisCommunicationService(database).resolveAudience(tenant, payload.audience as Record<string, unknown>, actor(request)) });
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
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/templates", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { template: await new SisCommunicationService(database).createTemplate(tenant, body(request), actor(request)) });
    }});
    router.register({ method: "PATCH", path: "/api/v1/organizations/:organizationId/sis/communication/templates/:id", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { template: await new SisCommunicationService(database).updateTemplate(tenant, routeParams.id, body(request), actor(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/announcements", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { announcements: await new SisCommunicationService(database).listAnnouncements(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/announcements", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { announcement: await new SisCommunicationService(database).createAnnouncement(tenant, body(request), actor(request)) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/announcements/:id/publish", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { announcement: await new SisCommunicationService(database).publishAnnouncement(tenant, routeParams.id, actor(request)) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/announcements/:id/archive", async handler(request, response, { database, routeParams }) {
      assertUuid(routeParams.id, "id");
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { announcement: await new SisCommunicationService(database).archiveAnnouncement(tenant, routeParams.id, actor(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/messages", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { messages: await new SisCommunicationService(database).listMessages(tenant) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/messages", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 201, { message: await new SisCommunicationService(database).sendCommunication(tenant, body(request), actor(request)) });
    }});
    router.register({ method: "GET", path: "/api/v1/organizations/:organizationId/sis/communication/notifications", async handler(request, response, { database, routeParams, url }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      const recipient = url.searchParams.get("kind") && url.searchParams.get("id") ? { kind: String(url.searchParams.get("kind")), id: String(url.searchParams.get("id")) } : undefined;
      sendJson(response, 200, { notifications: await new SisCommunicationService(database).listNotifications(tenant, recipient) });
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
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/communication/preferences", async handler(request, response, { database, routeParams }) {
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.manage");
      sendJson(response, 200, { preference: await new SisCommunicationService(database).savePreference(tenant, body(request), actor(request)) });
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
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 200, { requests: await new SisPortalService(database).listRequests(tenant, { userId: url.searchParams.get("userId") ?? "", role: url.searchParams.get("role") ?? "" }) });
    }});
    router.register({ method: "POST", path: "/api/v1/organizations/:organizationId/sis/portal/requests", async handler(request, response, { database, routeParams }) {
      const payload = body(request);
      const tenant = await readTenant(request, database, routeParams.organizationId, "workspace.read");
      sendJson(response, 201, { request: await new SisPortalService(database).submitRequest(tenant, payload.actor as Record<string, unknown> ?? {}, payload.input as Record<string, unknown> ?? {}) });
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
  },
};
