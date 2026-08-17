import type { Student, StudentStatus } from "./sis.types";

const SIS_STUDENTS_KEY = "haza-aios.sis.students";

export class StudentServiceClass {
  
  private getDb(): Student[] {
    const data = localStorage.getItem(SIS_STUDENTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveDb(students: Student[]): void {
    localStorage.setItem(SIS_STUDENTS_KEY, JSON.stringify(students));
  }

  async getStudents(organizationId: string): Promise<Student[]> {
    return this.getDb().filter(s => s.organizationId === organizationId);
  }

  async getStudent(id: string, organizationId: string): Promise<Student | null> {
    return this.getDb().find(s => s.id === id && s.organizationId === organizationId) || null;
  }

  async getStudentByAdmissionNumber(admissionNumber: string, organizationId: string): Promise<Student | null> {
    return this.getDb().find(s => s.admissionNumber === admissionNumber && s.organizationId === organizationId) || null;
  }

  private generateAdmissionNumber(organizationId: string, currentStudents: Student[]): string {
    const year = new Date().getFullYear();
    const existing = currentStudents.filter(s => s.admissionNumber.includes(`-${year}-`));
    const nextNum = (existing.length + 1).toString().padStart(5, '0');
    // Using a default prefix "TMS" - could be configured per org later
    return `TMS-${year}-${nextNum}`;
  }

  async createStudent(student: Omit<Student, "id" | "admissionNumber" | "createdAt" | "updatedAt"> & { admissionNumber?: string }): Promise<Student> {
    const db = this.getDb();
    
    let admissionNumber = student.admissionNumber;
    if (!admissionNumber) {
      admissionNumber = this.generateAdmissionNumber(student.organizationId, db);
    } else {
      // Validate uniqueness
      const existing = db.find(s => s.admissionNumber === admissionNumber && s.organizationId === student.organizationId);
      if (existing) {
        throw new Error("Validation Error: Admission Number must be unique within the organization.");
      }
    }

    const newStudent: Student = {
      ...student,
      id: `stu_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      admissionNumber,
      status: student.status || "applicant",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    db.push(newStudent);
    this.saveDb(db);
    
    return newStudent;
  }

  async updateStudent(id: string, organizationId: string, updates: Partial<Student>): Promise<Student> {
    const db = this.getDb();
    const index = db.findIndex(s => s.id === id && s.organizationId === organizationId);
    
    if (index === -1) {
      throw new Error(`Student ${id} not found in organization ${organizationId}`);
    }

    // Validate status transitions if necessary (applicant -> active, active -> withdrawn, etc)
    if (updates.status && db[index].status !== updates.status) {
      this.validateStatusTransition(db[index].status, updates.status);
    }

    const updated = {
      ...db[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    db[index] = updated;
    this.saveDb(db);
    
    return updated;
  }

  private validateStatusTransition(current: StudentStatus, next: StudentStatus) {
    // Example basic validation logic
    if (current === "archived") {
      throw new Error("Validation Error: Cannot change status of an archived student directly.");
    }
    if (current === "graduated" && next === "active") {
      throw new Error("Validation Error: Cannot set a graduated student back to active directly.");
    }
  }

  async deleteStudent(id: string, organizationId: string): Promise<void> {
    const db = this.getDb();
    const filtered = db.filter(s => !(s.id === id && s.organizationId === organizationId));
    
    if (filtered.length === db.length) {
      throw new Error(`Student ${id} not found in organization ${organizationId}`);
    }
    
    this.saveDb(filtered);
  }

  // --- Search / Filters ---
  
  async searchStudents(organizationId: string, query: string): Promise<Student[]> {
    const q = query.toLowerCase();
    return this.getDb().filter(s => 
      s.organizationId === organizationId &&
      (
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q) ||
        (s.studentNumber && s.studentNumber.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
      )
    );
  }
}

export const StudentService = new StudentServiceClass();
