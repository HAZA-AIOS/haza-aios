import type { TeachingAssignment } from "./sis.types";
import { jsonBody, sisRequest } from "./sis-api";

export class TeachingAssignmentService {
  static async getAssignments(organizationId: string): Promise<TeachingAssignment[]> {
    const body = await sisRequest<{ assignments: TeachingAssignment[] }>(organizationId, "/teaching-assignments");
    return body.assignments;
  }

  static async getAssignmentsByStaff(staffId: string, organizationId: string): Promise<TeachingAssignment[]> {
    const body = await sisRequest<{ assignments: TeachingAssignment[] }>(organizationId, `/teaching-assignments?staffId=${encodeURIComponent(staffId)}`);
    return body.assignments;
  }

  static async getAssignmentsByClass(academicYear: string, gradeId: string, sectionId: string, organizationId: string): Promise<TeachingAssignment[]> {
    const params = new URLSearchParams({ academicYear, gradeId });
    if (sectionId) params.set("sectionId", sectionId);
    const body = await sisRequest<{ assignments: TeachingAssignment[] }>(organizationId, `/teaching-assignments?${params.toString()}`);
    return body.assignments;
  }

  static async assignTeacher(assignmentData: Omit<TeachingAssignment, "id" | "createdAt" | "updatedAt">): Promise<TeachingAssignment> {
    const body = await sisRequest<{ assignment: TeachingAssignment }>(assignmentData.organizationId, "/teaching-assignments", { method: "POST", ...jsonBody(assignmentData) });
    return body.assignment;
  }

  static async deactivateAssignment(id: string, organizationId: string): Promise<void> {
    await this.updateAssignment(id, organizationId, { isActive: false });
  }

  static async updateAssignment(id: string, organizationId: string, updates: Partial<TeachingAssignment>): Promise<TeachingAssignment> {
    const body = await sisRequest<{ assignment: TeachingAssignment }>(organizationId, `/teaching-assignments/${id}`, { method: "PATCH", ...jsonBody(updates) });
    return body.assignment;
  }
}
