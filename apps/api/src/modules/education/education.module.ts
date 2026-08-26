import { sendJson } from "../../common/http/json.js";
import type { BackendModule } from "../module-registry.js";
import { AuthService } from "../auth/services/auth.service.js";
import { assertUuid, createTenantContext } from "../platform/tenant-context.js";
import { SisService } from "./sis.service.js";

async function readTenant(request: Parameters<AuthService["requireOrganizationPermission"]>[0], database: ConstructorParameters<typeof SisService>[0], organizationId: string, permission: "workspace.read" | "workspace.manage") {
  const tenantContext = createTenantContext(organizationId);
  await new AuthService(database).requireOrganizationPermission(request, tenantContext.organizationId, permission);
  return new SisService(database).getTenant(tenantContext.organizationId);
}

function body(request: { body?: unknown }) {
  return request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
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
  },
};
