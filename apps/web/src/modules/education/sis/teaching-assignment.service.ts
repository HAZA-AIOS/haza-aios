import type { TeachingAssignment } from "./sis.types";
import { fetchCompleteSisDataset, jsonBody, sisRequest } from "./sis-api";

export class TeachingAssignmentService {
  static async getAssignments(organizationId: string, options?: { signal?: AbortSignal }): Promise<TeachingAssignment[]> {
    return fetchCompleteSisDataset<TeachingAssignment>(organizationId, "/teaching-assignments", { signal: options?.signal });
  }

  static async getAssignmentsByStaff(staffId: string, organizationId: string, options?: { signal?: AbortSignal }): Promise<TeachingAssignment[]> {
    return fetchCompleteSisDataset<TeachingAssignment>(organizationId, `/teaching-assignments?staffId=${encodeURIComponent(staffId)}`, { signal: options?.signal });
  }

  static async getAssignmentsByClass(academicYear: string, gradeId: string, sectionId: string, organizationId: string, options?: { signal?: AbortSignal }): Promise<TeachingAssignment[]> {
    const params = new URLSearchParams({ academicYear, gradeId });
    if (sectionId) params.set("sectionId", sectionId);
    return fetchCompleteSisDataset<TeachingAssignment>(organizationId, `/teaching-assignments?${params.toString()}`, { signal: options?.signal });
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
