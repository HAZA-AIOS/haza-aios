import { jsonBody, sisRequest } from "./sis-api";
import type {
  AdmissionApplication,
  AdmissionAssessment,
  AdmissionEnquiry,
  AdmissionPrintDocument,
  AdmissionsDashboardSummary,
  AdmissionsReport,
  Student,
  Enrollment,
} from "./sis.types";

export class AdmissionsServiceClass {
  // 1. Dashboard
  async getDashboard(
    organizationId: string,
    filters?: { academicYear?: string; campus?: string; gradeId?: string }
  ): Promise<AdmissionsDashboardSummary> {
    const params = new URLSearchParams();
    if (filters?.academicYear) params.set("academicYear", filters.academicYear);
    if (filters?.campus) params.set("campus", filters.campus);
    if (filters?.gradeId) params.set("gradeId", filters.gradeId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return (await sisRequest<{ dashboard: AdmissionsDashboardSummary }>(organizationId, `/admissions/dashboard${query}`)).dashboard;
  }

  // 2. Enquiries
  async listEnquiries(
    organizationId: string,
    filters?: { status?: string; search?: string; gradeId?: string; campus?: string; page?: number; pageSize?: number; all?: boolean }
  ): Promise<AdmissionEnquiry[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.gradeId) params.set("gradeId", filters.gradeId);
    if (filters?.campus) params.set("campus", filters.campus);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
    if (!filters?.page && !filters?.pageSize && filters?.all !== false) {
      params.set("all", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return (await sisRequest<{ enquiries: AdmissionEnquiry[] }>(organizationId, `/admissions/enquiries${query}`)).enquiries;
  }

  async getEnquiry(organizationId: string, id: string): Promise<AdmissionEnquiry> {
    return (await sisRequest<{ enquiry: AdmissionEnquiry }>(organizationId, `/admissions/enquiries/${id}`)).enquiry;
  }

  async createEnquiry(
    organizationId: string,
    data: Partial<AdmissionEnquiry>
  ): Promise<AdmissionEnquiry> {
    return (await sisRequest<{ enquiry: AdmissionEnquiry }>(organizationId, "/admissions/enquiries", {
      method: "POST",
      ...jsonBody(data),
    })).enquiry;
  }

  async updateEnquiry(
    organizationId: string,
    id: string,
    data: Partial<AdmissionEnquiry>
  ): Promise<AdmissionEnquiry> {
    return (await sisRequest<{ enquiry: AdmissionEnquiry }>(organizationId, `/admissions/enquiries/${id}`, {
      method: "PATCH",
      ...jsonBody(data),
    })).enquiry;
  }

  async deleteEnquiry(organizationId: string, id: string): Promise<{ success: boolean }> {
    return sisRequest<{ success: boolean }>(organizationId, `/admissions/enquiries/${id}`, {
      method: "DELETE",
    });
  }

  async convertEnquiryToApplication(
    organizationId: string,
    enquiryId: string
  ): Promise<AdmissionApplication> {
    return (await sisRequest<{ application: AdmissionApplication }>(organizationId, `/admissions/enquiries/${enquiryId}/convert`, {
      method: "POST",
    })).application;
  }

  // 3. Applications
  async listApplications(
    organizationId: string,
    filters?: { status?: string; search?: string; gradeId?: string; academicYear?: string; campus?: string; page?: number; pageSize?: number; all?: boolean }
  ): Promise<AdmissionApplication[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.gradeId) params.set("gradeId", filters.gradeId);
    if (filters?.academicYear) params.set("academicYear", filters.academicYear);
    if (filters?.campus) params.set("campus", filters.campus);
    if (filters?.page) params.set("page", String(filters.page));
    if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
    if (!filters?.page && !filters?.pageSize && filters?.all !== false) {
      params.set("all", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return (await sisRequest<{ applications: AdmissionApplication[] }>(organizationId, `/admissions/applications${query}`)).applications;
  }

  async getApplication(organizationId: string, id: string): Promise<AdmissionApplication> {
    return (await sisRequest<{ application: AdmissionApplication }>(organizationId, `/admissions/applications/${id}`)).application;
  }

  async createApplication(
    organizationId: string,
    data: Partial<AdmissionApplication>
  ): Promise<AdmissionApplication> {
    return (await sisRequest<{ application: AdmissionApplication }>(organizationId, "/admissions/applications", {
      method: "POST",
      ...jsonBody(data),
    })).application;
  }

  async updateApplication(
    organizationId: string,
    id: string,
    data: Partial<AdmissionApplication>
  ): Promise<AdmissionApplication> {
    return (await sisRequest<{ application: AdmissionApplication }>(organizationId, `/admissions/applications/${id}`, {
      method: "PATCH",
      ...jsonBody(data),
    })).application;
  }

  async submitApplication(organizationId: string, id: string): Promise<AdmissionApplication> {
    return (await sisRequest<{ application: AdmissionApplication }>(organizationId, `/admissions/applications/${id}/submit`, {
      method: "POST",
    })).application;
  }

  async withdrawApplication(
    organizationId: string,
    id: string,
    reason?: string
  ): Promise<AdmissionApplication> {
    return (await sisRequest<{ application: AdmissionApplication }>(organizationId, `/admissions/applications/${id}/withdraw`, {
      method: "POST",
      ...jsonBody({ reason }),
    })).application;
  }

  async recordDecision(
    organizationId: string,
    applicationId: string,
    decision: {
      status: "approved" | "rejected" | "waitlisted" | "under_review" | "assessment";
      remarks?: string;
      rejectionReason?: string;
      waitlistRank?: number;
    }
  ): Promise<AdmissionApplication> {
    return (await sisRequest<{ application: AdmissionApplication }>(organizationId, `/admissions/applications/${applicationId}/decision`, {
      method: "POST",
      ...jsonBody(decision),
    })).application;
  }

  // 4. Assessments
  async listAssessments(
    organizationId: string,
    applicationId?: string
  ): Promise<AdmissionAssessment[]> {
    const query = applicationId ? `?applicationId=${applicationId}` : "";
    return (await sisRequest<{ assessments: AdmissionAssessment[] }>(organizationId, `/admissions/assessments${query}`)).assessments;
  }

  async createAssessment(
    organizationId: string,
    data: Partial<AdmissionAssessment>
  ): Promise<AdmissionAssessment> {
    return (await sisRequest<{ assessment: AdmissionAssessment }>(organizationId, "/admissions/assessments", {
      method: "POST",
      ...jsonBody(data),
    })).assessment;
  }

  async updateAssessment(
    organizationId: string,
    id: string,
    data: Partial<AdmissionAssessment>
  ): Promise<AdmissionAssessment> {
    return (await sisRequest<{ assessment: AdmissionAssessment }>(organizationId, `/admissions/assessments/${id}`, {
      method: "PATCH",
      ...jsonBody(data),
    })).assessment;
  }

  async deleteAssessment(organizationId: string, id: string): Promise<{ success: boolean }> {
    return sisRequest<{ success: boolean }>(organizationId, `/admissions/assessments/${id}`, {
      method: "DELETE",
    });
  }

  // 5. Fee Package Review & Assignment
  async getFeePreview(
    organizationId: string,
    applicationId: string
  ): Promise<{
    applicationId: string;
    desiredGradeId: string;
    applicableStructures: Array<{ id: string; name: string; amountCents: number; frequency?: string }>;
    availableDiscounts: Array<{ id: string; name: string; type: string; value: number }>;
    totalTuitionCents: number;
    assignedPackage?: {
      feeStructureIds: string[];
      discountIds?: string[];
      admissionFeeCents?: number;
      totalTuitionCents?: number;
    };
  }> {
    return sisRequest(organizationId, `/admissions/applications/${applicationId}/fee-preview`);
  }

  async assignFeePackage(
    organizationId: string,
    applicationId: string,
    assignment: { feeStructureIds: string[]; discountIds?: string[]; admissionFeeCents?: number }
  ): Promise<AdmissionApplication> {
    return (await sisRequest<{ application: AdmissionApplication }>(organizationId, `/admissions/applications/${applicationId}/assign-fees`, {
      method: "POST",
      ...jsonBody(assignment),
    })).application;
  }

  // 6. Enrollment Conversion
  async convertToEnrollment(
    organizationId: string,
    applicationId: string,
    options: {
      academicYear: string;
      gradeId: string;
      sectionId: string;
      admissionDate?: string;
      reuseExistingStudentId?: string;
    }
  ): Promise<{
    success: boolean;
    isExisting: boolean;
    applicationId: string;
    student: Student;
    enrollment: Enrollment;
    message: string;
  }> {
    return sisRequest(organizationId, `/admissions/applications/${applicationId}/convert-enrollment`, {
      method: "POST",
      ...jsonBody(options),
    });
  }

  // 7. Printable Documents
  async getPrintDocument(
    organizationId: string,
    applicationId: string
  ): Promise<AdmissionPrintDocument> {
    return (await sisRequest<{ document: AdmissionPrintDocument }>(organizationId, `/admissions/applications/${applicationId}/print`)).document;
  }

  // 8. Reports
  async getReport(
    organizationId: string,
    reportType: "enquiry_register" | "application_register" | "conversion_summary" | "campus_summary" | "grade_summary",
    filters?: { academicYear?: string; campus?: string }
  ): Promise<AdmissionsReport> {
    const params = new URLSearchParams();
    params.set("type", reportType);
    if (filters?.academicYear) params.set("academicYear", filters.academicYear);
    if (filters?.campus) params.set("campus", filters.campus);
    return (await sisRequest<{ report: AdmissionsReport }>(organizationId, `/admissions/reports?${params.toString()}`)).report;
  }
}

export const AdmissionsService = new AdmissionsServiceClass();
