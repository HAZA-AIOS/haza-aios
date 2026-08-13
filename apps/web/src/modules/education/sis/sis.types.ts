export interface School {
  id: string;
  organizationId: string;
  name: string;
  shortName?: string;
  code: string;
  logo?: string;
  description?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  timezone: string;
  academicYear?: string;
  status: "active" | "inactive" | "setup";
  createdAt: string;
  updatedAt: string;
}

export interface AcademicYear {
  id: string;
  organizationId: string;
  schoolId: string;
  name: string; // e.g. "2026-2027"
  startDate: string;
  endDate: string;
  status: "active" | "planned" | "completed";
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EducationLevel {
  id: string;
  schoolId: string;
  name: string; // e.g. "Primary"
  code: string; // e.g. "PRI"
  description?: string;
  displayOrder: number;
  status: "active" | "inactive";
}

export interface Grade {
  id: string;
  educationLevelId: string;
  name: string; // e.g. "Grade 1"
  code: string; // e.g. "G1"
  displayOrder: number;
  status: "active" | "inactive";
}

export interface Section {
  id: string;
  gradeId: string;
  academicYearId: string;
  name: string; // e.g. "Section A"
  code: string; // e.g. "A"
  capacity: number;
  status: "active" | "inactive";
  classTeacherId?: string;
}

export interface Student {
  id: string;
  organizationId: string;
  schoolId: string;
  admissionNumber: string;
  studentCode?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName: string;
  dateOfBirth?: string;
  gender?: string;
  profilePhoto?: string;
  admissionDate: string;
  status: "active" | "inactive" | "graduated" | "transferred";
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentEnrollment {
  id: string;
  studentId: string;
  academicYearId: string;
  gradeId: string;
  sectionId?: string;
  enrollmentDate: string;
  status: "active" | "withdrawn" | "completed";
  rollNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  organizationId: string;
  schoolId: string;
  employeeNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName: string;
  email: string;
  phone?: string;
  profilePhoto?: string;
  joiningDate: string;
  employmentStatus: "active" | "on_leave" | "terminated" | "resigned";
  designation: string; // e.g. "Teacher", "Principal"
  createdAt: string;
  updatedAt: string;
}
