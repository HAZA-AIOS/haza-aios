import type { Staff, Department, Subject } from "./sis.types";

const DB_KEYS = {
  STAFF: "haza-aios.sis.staff",
  DEPARTMENTS: "haza-aios.sis.departments",
  SUBJECTS: "haza-aios.sis.subjects",
};

export class StaffService {
  // ---------------------------------------------------------
  // DEPARTMENTS
  // ---------------------------------------------------------
  static async getDepartments(organizationId: string): Promise<Department[]> {
    const data = localStorage.getItem(DB_KEYS.DEPARTMENTS);
    const deps: Department[] = data ? JSON.parse(data) : [];
    return deps.filter((d) => d.organizationId === organizationId);
  }

  static async createDepartment(department: Omit<Department, "id" | "createdAt" | "updatedAt">): Promise<Department> {
    const data = localStorage.getItem(DB_KEYS.DEPARTMENTS);
    const deps: Department[] = data ? JSON.parse(data) : [];
    
    const newDep: Department = {
      ...department,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    deps.push(newDep);
    localStorage.setItem(DB_KEYS.DEPARTMENTS, JSON.stringify(deps));
    return newDep;
  }

  // ---------------------------------------------------------
  // SUBJECTS
  // ---------------------------------------------------------
  static async getSubjects(organizationId: string): Promise<Subject[]> {
    const data = localStorage.getItem(DB_KEYS.SUBJECTS);
    const subjects: Subject[] = data ? JSON.parse(data) : [];
    return subjects.filter((s) => s.organizationId === organizationId);
  }

  static async createSubject(subject: Omit<Subject, "id" | "createdAt" | "updatedAt">): Promise<Subject> {
    const data = localStorage.getItem(DB_KEYS.SUBJECTS);
    const subjects: Subject[] = data ? JSON.parse(data) : [];
    
    const newSubject: Subject = {
      ...subject,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    subjects.push(newSubject);
    localStorage.setItem(DB_KEYS.SUBJECTS, JSON.stringify(subjects));
    return newSubject;
  }

  // ---------------------------------------------------------
  // STAFF
  // ---------------------------------------------------------
  private static async getNextEmployeeNumber(organizationId: string): Promise<string> {
    const staffList = await this.getStaffList(organizationId);
    if (staffList.length === 0) {
      return "EMP-001";
    }
    
    // Find the highest number
    let maxNum = 0;
    for (const staff of staffList) {
      if (staff.employeeNumber?.startsWith("EMP-")) {
        const numPart = parseInt(staff.employeeNumber.replace("EMP-", ""), 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
    
    const nextNum = maxNum + 1;
    return `EMP-${nextNum.toString().padStart(3, "0")}`;
  }

  static async getStaffList(organizationId: string): Promise<Staff[]> {
    const data = localStorage.getItem(DB_KEYS.STAFF);
    const staff: Staff[] = data ? JSON.parse(data) : [];
    return staff.filter((s) => s.organizationId === organizationId);
  }

  static async getStaffById(id: string, organizationId: string): Promise<Staff | null> {
    const staff = await this.getStaffList(organizationId);
    return staff.find((s) => s.id === id) || null;
  }

  static async createStaff(staffData: Omit<Staff, "id" | "createdAt" | "updatedAt" | "employeeNumber"> & { employeeNumber?: string }): Promise<Staff> {
    const data = localStorage.getItem(DB_KEYS.STAFF);
    const allStaff: Staff[] = data ? JSON.parse(data) : [];

    const employeeNumber = staffData.employeeNumber || (await this.getNextEmployeeNumber(staffData.organizationId));

    // Validate uniqueness of employeeNumber within organization
    const exists = allStaff.find(
      (s) => s.organizationId === staffData.organizationId && s.employeeNumber === employeeNumber
    );
    if (exists) {
      throw new Error(`Employee number ${employeeNumber} is already in use.`);
    }

    const newStaff: Staff = {
      ...staffData,
      id: crypto.randomUUID(),
      employeeNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    allStaff.push(newStaff);
    localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(allStaff));
    return newStaff;
  }

  static async updateStaff(id: string, organizationId: string, updates: Partial<Staff>): Promise<Staff> {
    const data = localStorage.getItem(DB_KEYS.STAFF);
    const allStaff: Staff[] = data ? JSON.parse(data) : [];

    const index = allStaff.findIndex((s) => s.id === id && s.organizationId === organizationId);
    if (index === -1) {
      throw new Error("Staff member not found or unauthorized.");
    }

    const currentStaff = allStaff[index];

    // Prevent changing org
    delete updates.organizationId;
    delete updates.id;

    // Validate unique employee number if updated
    if (updates.employeeNumber && updates.employeeNumber !== currentStaff.employeeNumber) {
      const exists = allStaff.find(
        (s) => s.organizationId === organizationId && s.employeeNumber === updates.employeeNumber
      );
      if (exists) {
        throw new Error(`Employee number ${updates.employeeNumber} is already in use.`);
      }
    }

    const updatedStaff: Staff = {
      ...currentStaff,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    allStaff[index] = updatedStaff;
    localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(allStaff));
    return updatedStaff;
  }
}
