import type { Staff, Department, Subject } from "./sis.types";
import { AcademicService } from "./academic.service";
import { jsonBody, sisRequest } from "./sis-api";

export class StaffService {
  static async getDepartments(organizationId: string): Promise<Department[]> {
    const body = await sisRequest<{ departments: Department[] }>(organizationId, "/departments");
    return body.departments;
  }

  static async createDepartment(department: Omit<Department, "id" | "createdAt" | "updatedAt">): Promise<Department> {
    const body = await sisRequest<{ department: Department }>(department.organizationId, "/departments", { method: "POST", ...jsonBody(department) });
    return body.department;
  }

  static async getSubjects(organizationId: string): Promise<Subject[]> {
    return AcademicService.getSubjects(organizationId);
  }

  static async createSubject(subject: Omit<Subject, "id" | "createdAt" | "updatedAt">): Promise<Subject> {
    return AcademicService.createSubject(subject.organizationId, subject);
  }

  static async getStaffList(
    organizationId: string,
    options?: { page?: number; pageSize?: number; all?: boolean; status?: string; staffType?: string }
  ): Promise<Staff[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.staffType) params.set("staffType", options.staffType);
    if (options?.page) params.set("page", String(options.page));
    if (options?.pageSize) params.set("pageSize", String(options.pageSize));
    if (!options?.page && !options?.pageSize && options?.all !== false) {
      params.set("all", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const body = await sisRequest<{ staff: Staff[] }>(organizationId, `/staff${query}`);
    return body.staff;
  }

  static async getStaffById(id: string, organizationId: string): Promise<Staff | null> {
    const body = await sisRequest<{ staffMember: Staff | null }>(organizationId, `/staff/${id}`);
    return body.staffMember;
  }

  static async createStaff(staffData: Omit<Staff, "id" | "createdAt" | "updatedAt" | "employeeNumber"> & { employeeNumber?: string }): Promise<Staff> {
    const body = await sisRequest<{ staffMember: Staff }>(staffData.organizationId, "/staff", { method: "POST", ...jsonBody(staffData) });
    return body.staffMember;
  }

  static async updateStaff(id: string, organizationId: string, updates: Partial<Staff>): Promise<Staff> {
    const body = await sisRequest<{ staffMember: Staff }>(organizationId, `/staff/${id}`, { method: "PATCH", ...jsonBody(updates) });
    return body.staffMember;
  }
}
