import type { TeachingAssignment } from "./sis.types";
import { StaffService } from "./staff.service";

const DB_KEYS = {
  TEACHING_ASSIGNMENTS: "haza-aios.sis.teaching_assignments",
};

export class TeachingAssignmentService {
  static async getAssignments(organizationId: string): Promise<TeachingAssignment[]> {
    const data = localStorage.getItem(DB_KEYS.TEACHING_ASSIGNMENTS);
    const assignments: TeachingAssignment[] = data ? JSON.parse(data) : [];
    return assignments.filter((assignment) => assignment.organizationId === organizationId);
  }

  static async getAssignmentsByStaff(staffId: string, organizationId: string): Promise<TeachingAssignment[]> {
    const data = localStorage.getItem(DB_KEYS.TEACHING_ASSIGNMENTS);
    const assignments: TeachingAssignment[] = data ? JSON.parse(data) : [];
    return assignments.filter((a) => a.organizationId === organizationId && a.staffId === staffId);
  }

  static async getAssignmentsByClass(
    academicYear: string,
    gradeId: string,
    sectionId: string,
    organizationId: string
  ): Promise<TeachingAssignment[]> {
    const data = localStorage.getItem(DB_KEYS.TEACHING_ASSIGNMENTS);
    const assignments: TeachingAssignment[] = data ? JSON.parse(data) : [];
    return assignments.filter(
      (a) =>
        a.organizationId === organizationId &&
        a.academicYear === academicYear &&
        a.gradeId === gradeId &&
        a.sectionId === sectionId
    );
  }

  static async assignTeacher(
    assignmentData: Omit<TeachingAssignment, "id" | "createdAt" | "updatedAt">
  ): Promise<TeachingAssignment> {
    const { staffId, organizationId, academicYear, gradeId, sectionId, subjectId } = assignmentData;
    
    // Validate Teacher
    const staff = await StaffService.getStaffById(staffId, organizationId);
    if (!staff) {
      throw new Error("Staff member not found or unauthorized.");
    }
    if (staff.staffType !== "teacher") {
      throw new Error(`Staff member must be a teacher to have teaching assignments (found: ${staff.staffType}).`);
    }
    if (staff.status !== "active") {
      throw new Error("Cannot assign subjects to an inactive staff member.");
    }

    // Check for duplicates
    const existingStaffAssignments = await this.getAssignmentsByStaff(staffId, organizationId);
    const duplicate = existingStaffAssignments.find(
      (a) =>
        a.academicYear === academicYear &&
        a.gradeId === gradeId &&
        a.sectionId === sectionId &&
        a.subjectId === subjectId &&
        a.isActive
    );

    if (duplicate) {
      throw new Error("This teacher is already assigned to this subject and class for the given academic year.");
    }

    const data = localStorage.getItem(DB_KEYS.TEACHING_ASSIGNMENTS);
    const allAssignments: TeachingAssignment[] = data ? JSON.parse(data) : [];

    const newAssignment: TeachingAssignment = {
      ...assignmentData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    allAssignments.push(newAssignment);
    localStorage.setItem(DB_KEYS.TEACHING_ASSIGNMENTS, JSON.stringify(allAssignments));
    
    return newAssignment;
  }

  static async deactivateAssignment(id: string, organizationId: string): Promise<void> {
    const data = localStorage.getItem(DB_KEYS.TEACHING_ASSIGNMENTS);
    const allAssignments: TeachingAssignment[] = data ? JSON.parse(data) : [];

    const index = allAssignments.findIndex((a) => a.id === id && a.organizationId === organizationId);
    if (index === -1) {
      throw new Error("Teaching assignment not found.");
    }

    allAssignments[index].isActive = false;
    allAssignments[index].updatedAt = new Date().toISOString();
    
    localStorage.setItem(DB_KEYS.TEACHING_ASSIGNMENTS, JSON.stringify(allAssignments));
  }
}
