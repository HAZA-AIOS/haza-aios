import type { Enrollment } from "./sis.types";

const SIS_ENROLLMENTS_KEY = "haza-aios.sis.enrollments";

export class EnrollmentServiceClass {
  
  private getDb(): Enrollment[] {
    const data = localStorage.getItem(SIS_ENROLLMENTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private saveDb(enrollments: Enrollment[]): void {
    localStorage.setItem(SIS_ENROLLMENTS_KEY, JSON.stringify(enrollments));
  }

  async getEnrollmentsByStudent(studentId: string, organizationId: string): Promise<Enrollment[]> {
    return this.getDb().filter(e => e.studentId === studentId && e.organizationId === organizationId);
  }

  async getCurrentEnrollment(studentId: string, organizationId: string): Promise<Enrollment | null> {
    const enrollments = await this.getEnrollmentsByStudent(studentId, organizationId);
    // Prefer "active" status, sort by enrollmentDate descending
    const active = enrollments.filter(e => e.status === "active");
    if (active.length > 0) {
      return active.sort((a, b) => new Date(b.enrollmentDate).getTime() - new Date(a.enrollmentDate).getTime())[0];
    }
    return null;
  }

  async getEnrollments(
    organizationId: string,
    filters?: Partial<Pick<Enrollment, "studentId" | "academicYear" | "gradeId" | "sectionId" | "status">>
  ): Promise<Enrollment[]> {
    return this.getDb().filter((enrollment) => {
      if (enrollment.organizationId !== organizationId) return false;
      if (filters?.studentId && enrollment.studentId !== filters.studentId) return false;
      if (filters?.academicYear && enrollment.academicYear !== filters.academicYear) return false;
      if (filters?.gradeId && enrollment.gradeId !== filters.gradeId) return false;
      if (filters?.sectionId && enrollment.sectionId !== filters.sectionId) return false;
      if (filters?.status && enrollment.status !== filters.status) return false;
      return true;
    });
  }

  async enrollStudent(enrollment: Omit<Enrollment, "id" | "createdAt" | "updatedAt">): Promise<Enrollment> {
    const db = this.getDb();
    
    // Validate that student isn't already actively enrolled in the exact same year/grade/section
    const existingActive = db.find(e => 
      e.studentId === enrollment.studentId && 
      e.organizationId === enrollment.organizationId &&
      e.academicYear === enrollment.academicYear &&
      e.status === "active"
    );

    if (existingActive) {
      // Logic could either transition the old one to "transferred" or throw error.
      // We will throw error to force explicit transfer workflows.
      throw new Error(`Student is already actively enrolled for academic year ${enrollment.academicYear}. Use transfer workflow instead.`);
    }

    const newEnrollment: Enrollment = {
      ...enrollment,
      id: `enr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    db.push(newEnrollment);
    this.saveDb(db);
    
    return newEnrollment;
  }

  async updateEnrollment(id: string, organizationId: string, updates: Partial<Enrollment>): Promise<Enrollment> {
    const db = this.getDb();
    const index = db.findIndex(e => e.id === id && e.organizationId === organizationId);
    
    if (index === -1) {
      throw new Error(`Enrollment ${id} not found in organization ${organizationId}`);
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

  async transferStudent(studentId: string, organizationId: string, newSectionId: string): Promise<Enrollment> {
    const current = await this.getCurrentEnrollment(studentId, organizationId);
    if (!current) {
      throw new Error("Student does not have an active enrollment to transfer from.");
    }
    if (current.sectionId === newSectionId) {
      throw new Error("Student is already in this section.");
    }

    // Mark current as transferred
    await this.updateEnrollment(current.id, organizationId, { status: "transferred" });

    // Create new active enrollment
    return this.enrollStudent({
      studentId,
      organizationId,
      academicYear: current.academicYear,
      gradeId: current.gradeId,
      sectionId: newSectionId,
      enrollmentDate: new Date().toISOString(),
      status: "active"
    });
  }
}

export const EnrollmentService = new EnrollmentServiceClass();
