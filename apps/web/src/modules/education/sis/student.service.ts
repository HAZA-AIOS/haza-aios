import type { Student } from "./sis.types";
import { jsonBody, sisRequest } from "./sis-api";

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class StudentServiceClass {
  async getStudents(
    organizationId: string,
    options?: { page?: number; pageSize?: number; all?: boolean; status?: string; admissionNumber?: string }
  ): Promise<Student[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.admissionNumber) params.set("admissionNumber", options.admissionNumber);
    if (options?.page) params.set("page", String(options.page));
    if (options?.pageSize) params.set("pageSize", String(options.pageSize));
    if (!options?.page && !options?.pageSize && options?.all !== false) {
      params.set("all", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const body = await sisRequest<{ students: Student[] }>(organizationId, `/students${query}`);
    return body.students;
  }

  async getPaginatedStudents(
    organizationId: string,
    options?: { page?: number; pageSize?: number; status?: string }
  ): Promise<{ students: Student[]; pagination: PaginationMetadata }> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    params.set("page", String(options?.page ?? 1));
    params.set("pageSize", String(options?.pageSize ?? 25));
    const query = params.toString() ? `?${params.toString()}` : "";
    const body = await sisRequest<{ students: Student[]; pagination: PaginationMetadata }>(organizationId, `/students${query}`);
    return { students: body.students, pagination: body.pagination };
  }

  async getStudent(id: string, organizationId: string): Promise<Student | null> {
    const body = await sisRequest<{ student: Student | null }>(organizationId, `/students/${id}`);
    return body.student;
  }

  async getStudentByAdmissionNumber(admissionNumber: string, organizationId: string): Promise<Student | null> {
    const body = await sisRequest<{ students: Student[] }>(organizationId, `/students?admissionNumber=${encodeURIComponent(admissionNumber)}`);
    return body.students[0] ?? null;
  }

  async createStudent(student: Omit<Student, "id" | "admissionNumber" | "createdAt" | "updatedAt"> & { admissionNumber?: string }): Promise<Student> {
    const body = await sisRequest<{ student: Student }>(student.organizationId, "/students", { method: "POST", ...jsonBody(student) });
    return body.student;
  }

  async updateStudent(id: string, organizationId: string, updates: Partial<Student>): Promise<Student> {
    const body = await sisRequest<{ student: Student }>(organizationId, `/students/${id}`, { method: "PATCH", ...jsonBody(updates) });
    return body.student;
  }

  async deleteStudent(id: string, organizationId: string): Promise<void> {
    await sisRequest<{ ok: boolean }>(organizationId, `/students/${id}`, { method: "DELETE" });
  }

  async searchStudents(organizationId: string, query: string): Promise<Student[]> {
    const students = await this.getStudents(organizationId);
    const q = query.toLowerCase();
    return students.filter((student) =>
      student.firstName.toLowerCase().includes(q) ||
      student.lastName.toLowerCase().includes(q) ||
      student.admissionNumber.toLowerCase().includes(q) ||
      Boolean(student.studentNumber?.toLowerCase().includes(q)) ||
      Boolean(student.email?.toLowerCase().includes(q))
    );
  }
}

export const StudentService = new StudentServiceClass();
