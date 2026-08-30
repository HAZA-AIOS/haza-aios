import type { Enrollment } from "./sis.types";
import { jsonBody, sisRequest } from "./sis-api";

export class EnrollmentServiceClass {
  async getEnrollmentsByStudent(studentId: string, organizationId: string): Promise<Enrollment[]> {
    return this.getEnrollments(organizationId, { studentId });
  }

  async getCurrentEnrollment(studentId: string, organizationId: string): Promise<Enrollment | null> {
    const enrollments = await this.getEnrollmentsByStudent(studentId, organizationId);
    return enrollments.filter((enrollment) => enrollment.status === "active").sort((a, b) => new Date(b.enrollmentDate).getTime() - new Date(a.enrollmentDate).getTime())[0] ?? null;
  }

  async getEnrollments(organizationId: string, filters?: Partial<Pick<Enrollment, "studentId" | "academicYear" | "gradeId" | "sectionId" | "status">>): Promise<Enrollment[]> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters ?? {})) {
      if (value) params.set(key, value);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const body = await sisRequest<{ enrollments: Enrollment[] }>(organizationId, `/enrollments${query}`);
    return body.enrollments;
  }

  async enrollStudent(enrollment: Omit<Enrollment, "id" | "createdAt" | "updatedAt">): Promise<Enrollment> {
    const body = await sisRequest<{ enrollment: Enrollment }>(enrollment.organizationId, "/enrollments", { method: "POST", ...jsonBody(enrollment) });
    return body.enrollment;
  }

  async updateEnrollment(id: string, organizationId: string, updates: Partial<Enrollment>): Promise<Enrollment> {
    const body = await sisRequest<{ enrollment: Enrollment }>(organizationId, `/enrollments/${id}`, { method: "PATCH", ...jsonBody(updates) });
    return body.enrollment;
  }

  async transferStudent(studentId: string, organizationId: string, newSectionId: string): Promise<Enrollment> {
    const body = await sisRequest<{ enrollment: Enrollment }>(organizationId, `/students/${studentId}/transfer`, { method: "POST", ...jsonBody({ sectionId: newSectionId }) });
    return body.enrollment;
  }
}

export const EnrollmentService = new EnrollmentServiceClass();
