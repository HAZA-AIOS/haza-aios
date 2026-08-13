import {
  School,
  AcademicYear,
  EducationLevel,
  Grade,
  Section,
  Student,
  StudentEnrollment,
  Staff
} from "./sis.types";

const SIS_DATA_KEY = "haza-aios.education.sis";

interface SisDatabase {
  schools: School[];
  academicYears: AcademicYear[];
  educationLevels: EducationLevel[];
  grades: Grade[];
  sections: Section[];
  students: Student[];
  studentEnrollments: StudentEnrollment[];
  staff: Staff[];
}

const defaultDatabase: SisDatabase = {
  schools: [],
  academicYears: [],
  educationLevels: [],
  grades: [],
  sections: [],
  students: [],
  studentEnrollments: [],
  staff: []
};

// Seed a default school for organization "org-mentor-school"
const seedSchoolId = "school-1";
const seedOrgId = "org-mentor-school";

defaultDatabase.schools.push({
  id: seedSchoolId,
  organizationId: seedOrgId,
  name: "The Mentor School",
  code: "TMS",
  timezone: "America/New_York",
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

defaultDatabase.academicYears.push({
  id: "ay-26-27",
  organizationId: seedOrgId,
  schoolId: seedSchoolId,
  name: "2026-2027",
  startDate: "2026-09-01",
  endDate: "2027-06-30",
  status: "active",
  isCurrent: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

class SisServiceClass {
  private getDb(): SisDatabase {
    const data = localStorage.getItem(SIS_DATA_KEY);
    if (!data) {
      localStorage.setItem(SIS_DATA_KEY, JSON.stringify(defaultDatabase));
      return defaultDatabase;
    }
    return JSON.parse(data);
  }

  private saveDb(db: SisDatabase): void {
    localStorage.setItem(SIS_DATA_KEY, JSON.stringify(db));
  }

  resetToDefaults() {
    localStorage.setItem(SIS_DATA_KEY, JSON.stringify(defaultDatabase));
  }

  // Generic delay to simulate network
  private async wait(ms = 300) {
    if (process.env.NODE_ENV === "test") return;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // --- SCHOOLS ---
  async getSchoolByOrg(orgId: string): Promise<School | undefined> {
    await this.wait();
    return this.getDb().schools.find((s) => s.organizationId === orgId);
  }

  async createSchool(school: Omit<School, "id" | "createdAt" | "updatedAt">): Promise<School> {
    await this.wait();
    const db = this.getDb();
    const newSchool: School = {
      ...school,
      id: `school-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.schools.push(newSchool);
    this.saveDb(db);
    return newSchool;
  }

  // --- ACADEMIC YEARS ---
  async getAcademicYears(schoolId: string): Promise<AcademicYear[]> {
    await this.wait();
    return this.getDb().academicYears.filter((ay) => ay.schoolId === schoolId);
  }

  async createAcademicYear(ay: Omit<AcademicYear, "id" | "createdAt" | "updatedAt">): Promise<AcademicYear> {
    await this.wait();
    const db = this.getDb();
    
    if (ay.isCurrent) {
      db.academicYears.forEach(y => {
        if (y.schoolId === ay.schoolId) y.isCurrent = false;
      });
    }

    const newAy: AcademicYear = {
      ...ay,
      id: `ay-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.academicYears.push(newAy);
    this.saveDb(db);
    return newAy;
  }

  // --- ACADEMIC STRUCTURE (LEVELS, GRADES, SECTIONS) ---
  async getEducationLevels(schoolId: string): Promise<EducationLevel[]> {
    await this.wait();
    return this.getDb().educationLevels.filter(l => l.schoolId === schoolId).sort((a,b) => a.displayOrder - b.displayOrder);
  }

  async getGrades(levelId: string): Promise<Grade[]> {
    await this.wait();
    return this.getDb().grades.filter(g => g.educationLevelId === levelId).sort((a,b) => a.displayOrder - b.displayOrder);
  }

  async getSections(gradeId: string, ayId: string): Promise<Section[]> {
    await this.wait();
    return this.getDb().sections.filter(s => s.gradeId === gradeId && s.academicYearId === ayId);
  }

  // --- STUDENTS & ENROLLMENT ---
  async getStudents(orgId: string): Promise<Student[]> {
    await this.wait();
    return this.getDb().students.filter(s => s.organizationId === orgId);
  }
  
  async createStudent(student: Omit<Student, "id" | "createdAt" | "updatedAt">): Promise<Student> {
    await this.wait();
    const db = this.getDb();
    const newStudent: Student = {
      ...student,
      id: `stu-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.students.push(newStudent);
    this.saveDb(db);
    return newStudent;
  }

  async getEnrollments(studentId: string): Promise<StudentEnrollment[]> {
    await this.wait();
    return this.getDb().studentEnrollments.filter(e => e.studentId === studentId);
  }

  // --- STAFF ---
  async getStaff(orgId: string): Promise<Staff[]> {
    await this.wait();
    return this.getDb().staff.filter(s => s.organizationId === orgId);
  }
  
  async createStaff(staff: Omit<Staff, "id" | "createdAt" | "updatedAt">): Promise<Staff> {
    await this.wait();
    const db = this.getDb();
    const newStaff: Staff = {
      ...staff,
      id: `staff-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.staff.push(newStaff);
    this.saveDb(db);
    return newStaff;
  }

  // Helper for dashboard metrics
  async getDashboardMetrics(orgId: string) {
    await this.wait();
    const db = this.getDb();
    const school = db.schools.find(s => s.organizationId === orgId);
    if (!school) return null;

    const currentAy = db.academicYears.find(ay => ay.schoolId === school.id && ay.isCurrent);
    
    const studentCount = db.students.filter(s => s.organizationId === orgId).length;
    const staffCount = db.staff.filter(s => s.organizationId === orgId).length;
    
    let classCount = 0;
    if (currentAy) {
      classCount = db.sections.filter(s => s.academicYearId === currentAy.id).length;
    }

    return {
      studentCount,
      staffCount,
      classCount,
      currentAcademicYear: currentAy?.name || "Not Set"
    };
  }
}

export const SisService = new SisServiceClass();
