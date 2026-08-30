import type { Student } from "./sis.types";
import { jsonBody, sisRequest } from "./sis-api";

export class StudentServiceClass {
  async getStudents(organizationId: string): Promise<Student[]> {
    const body = await sisRequest<{ students: Student[] }>(organizationId, "/students");
    return body.students;
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
