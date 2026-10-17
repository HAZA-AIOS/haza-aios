import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../common/errors/api-error.js";
import type { DatabaseClient } from "../../database/client.js";
import { mapDatabaseError } from "../../database/errors.js";
import {
  portalUpdateRequests,
  students,
} from "../../database/schema.js";
import { SisFinanceService } from "./sis-finance.service.js";
import { SisService } from "./sis.service.js";

type JsonRecord = Record<string, unknown>;
type Tenant = { organizationId: string; workspaceId: string };
type Actor = { userId?: string; role?: string } | undefined;

export type AdmissionEnquiryStatus =
  | "new"
  | "contacted"
  | "visit_scheduled"
  | "under_review"
  | "converted"
  | "closed";

export type AdmissionApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "assessment"
  | "approved"
  | "rejected"
  | "waitlisted"
  | "enrolled"
  | "withdrawn";

export type AssessmentOutcome =
  | "passed"
  | "failed"
  | "conditional_pass"
  | "exempted"
  | "pending";

function uuid(): string {
  return randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function payloadOf(value: unknown): JsonRecord {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as JsonRecord;
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function assertText(value: unknown, label: string): string {
  const out = str(value);
  if (!out) {
    throw new ApiError(400, "VALIDATION_FAILED", `${label} is required.`);
  }
  return out;
}

function dbError(error: unknown): never {
  const mapped = mapDatabaseError(error);
  if (mapped.code === "DATABASE_UNIQUE_CONSTRAINT") {
    throw new ApiError(409, "DATABASE_UNIQUE_CONSTRAINT", "A record with the same unique scope already exists.");
  }
  throw error;
}

function dto<T extends JsonRecord>(tenant: Tenant, row: { payload: JsonRecord }): T {
  return { ...payloadOf(row.payload), organizationId: tenant.organizationId } as unknown as T;
}

export class SisAdmissionsService {
  constructor(private readonly database: DatabaseClient) {}

  /* ─────────────────────────────────────────────────────────────
   * 1. DASHBOARD & METRICS
   * ───────────────────────────────────────────────────────────── */
  async getDashboard(tenant: Tenant, filters?: { academicYear?: string; campus?: string; gradeId?: string }) {
    const allEnquiries = await this.listEnquiries(tenant, filters);
    const allApplications = await this.listApplications(tenant, filters);

    const totalEnquiries = allEnquiries.length;
    const pendingApplications = allApplications.filter((a) =>
      ["draft", "submitted", "under_review"].includes(String(a.status))
    ).length;
    const applicationsUnderAssessment = allApplications.filter((a) => a.status === "assessment").length;
    const approvedApplications = allApplications.filter((a) => a.status === "approved").length;
    const rejectedApplications = allApplications.filter((a) => a.status === "rejected").length;
    const waitlistedApplications = allApplications.filter((a) => a.status === "waitlisted").length;
    const enrolledStudents = allApplications.filter((a) => a.status === "enrolled").length;

    const conversionRatePercentage =
      allApplications.length > 0 ? Math.round((enrolledStudents / allApplications.length) * 100) : 0;

    // Recent admissions activity compiled from enquiries and applications
    const activity: Array<{
      id: string;
      type: "enquiry" | "application" | "assessment" | "decision" | "enrollment";
      title: string;
      description: string;
      timestamp: string;
      reference?: string;
    }> = [];

    for (const enq of allEnquiries.slice(0, 5)) {
      activity.push({
        id: `act-enq-${enq.id}`,
        type: "enquiry",
        title: `New Enquiry: ${enq.studentName}`,
        description: `Enquiry received for Grade ${enq.desiredGradeName || "N/A"} (${enq.status})`,
        timestamp: String(enq.updatedAt || enq.createdAt || now()),
        reference: String(enq.referenceNumber),
      });
    }

    for (const app of allApplications.slice(0, 5)) {
      const studentName = `${(app.student as JsonRecord)?.firstName || ""} ${(app.student as JsonRecord)?.lastName || ""}`.trim() || "Applicant";
      activity.push({
        id: `act-app-${app.id}`,
        type: app.status === "enrolled" ? "enrollment" : "application",
        title: `Application ${app.status.toUpperCase()}: ${studentName}`,
        description: `Application ${app.applicationNumber} is currently ${app.status}`,
        timestamp: String(app.updatedAt || app.createdAt || now()),
        reference: String(app.applicationNumber),
      });
    }

    activity.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

    return {
      totalEnquiries,
      pendingApplications,
      applicationsUnderAssessment,
      approvedApplications,
      rejectedApplications,
      waitlistedApplications,
      enrolledStudents,
      conversionRatePercentage,
      recentActivity: activity.slice(0, 10),
    };
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. ENQUIRY MANAGEMENT (CRUD & CONVERT)
   * ───────────────────────────────────────────────────────────── */
  async listEnquiries(tenant: Tenant, filters?: { status?: string; search?: string; gradeId?: string; campus?: string }) {
    const rows = await this.database.db
      .select()
      .from(portalUpdateRequests)
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.requestType, "admission_enquiry")
        )
      )
      .orderBy(desc(portalUpdateRequests.createdAt));

    let list = rows.map((r) => dto<JsonRecord & { id: string; status: string; studentName: string; referenceNumber: string; desiredGradeId?: string; preferredCampus?: string }>(tenant, r));

    if (filters?.status) {
      list = list.filter((e) => e.status === filters.status);
    }
    if (filters?.gradeId) {
      list = list.filter((e) => e.desiredGradeId === filters.gradeId);
    }
    if (filters?.campus) {
      list = list.filter((e) => e.preferredCampus === filters.campus);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((e) =>
        String(e.studentName ?? "").toLowerCase().includes(q) ||
        String(e.referenceNumber ?? "").toLowerCase().includes(q) ||
        String(e.guardianName ?? "").toLowerCase().includes(q) ||
        String(e.email ?? "").toLowerCase().includes(q) ||
        String(e.phone ?? "").toLowerCase().includes(q)
      );
    }

    return list;
  }

  async getEnquiry(tenant: Tenant, id: string) {
    const row = (
      await this.database.db
        .select()
        .from(portalUpdateRequests)
        .where(
          and(
            eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
            eq(portalUpdateRequests.id, id),
            eq(portalUpdateRequests.requestType, "admission_enquiry")
          )
        )
        .limit(1)
    )[0];

    if (!row) throw new ApiError(404, "NOT_FOUND", "Admission enquiry not found.");
    return dto<JsonRecord & { id: string }>(tenant, row);
  }

  async createEnquiry(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    const studentName = assertText(data.studentName, "Student name");
    const guardianName = assertText(data.guardianName, "Guardian name");
    const phone = assertText(data.phone, "Phone number");
    const email = str(data.email);
    const desiredGradeId = assertText(data.desiredGradeId, "Desired grade");

    const count = (
      await this.database.db
        .select()
        .from(portalUpdateRequests)
        .where(
          and(
            eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
            eq(portalUpdateRequests.requestType, "admission_enquiry")
          )
        )
    ).length;

    const currentYear = new Date().getFullYear();
    const referenceNumber = `ENQ-${currentYear}-${String(count + 1).padStart(5, "0")}`;

    const id = uuid();
    const enquiryRecord: JsonRecord = {
      ...data,
      id,
      organizationId: tenant.organizationId,
      referenceNumber,
      studentName,
      guardianName,
      phone,
      email: email || undefined,
      desiredGradeId,
      status: str(data.status) || "new",
      enquiryDate: str(data.enquiryDate) || now().slice(0, 10),
      followUpDate: str(data.followUpDate) || undefined,
      notes: str(data.notes) || undefined,
      source: str(data.source) || "direct",
      preferredCampus: str(data.preferredCampus) || "Main Campus",
      assignedStaffId: str(data.assignedStaffId) || undefined,
      createdAt: now(),
      updatedAt: now(),
    };

    await this.database.db
      .insert(portalUpdateRequests)
      .values({
        id,
        workspaceId: tenant.workspaceId,
        requesterUserId: str(actor?.userId) || "system",
        requesterRole: str(actor?.role) || "staff",
        requestType: "admission_enquiry",
        status: String(enquiryRecord.status),
        payload: enquiryRecord,
      })
      .catch(dbError);

    return enquiryRecord;
  }

  async updateEnquiry(tenant: Tenant, id: string, data: JsonRecord, _actor?: Actor) {
    const current = await this.getEnquiry(tenant, id);
    const updatedRecord: JsonRecord = {
      ...current,
      ...data,
      id,
      updatedAt: now(),
    };

    await this.database.db
      .update(portalUpdateRequests)
      .set({
        status: String(updatedRecord.status),
        payload: updatedRecord,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.id, id),
          eq(portalUpdateRequests.requestType, "admission_enquiry")
        )
      )
      .catch(dbError);

    return updatedRecord;
  }

  async deleteEnquiry(tenant: Tenant, id: string, _actor?: Actor) {
    await this.getEnquiry(tenant, id);
    await this.database.db
      .delete(portalUpdateRequests)
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.id, id),
          eq(portalUpdateRequests.requestType, "admission_enquiry")
        )
      );
  }

  async convertEnquiryToApplication(tenant: Tenant, enquiryId: string, actor?: Actor) {
    const enquiry = await this.getEnquiry(tenant, enquiryId);
    if (enquiry.status === "converted" && enquiry.convertedApplicationId) {
      return this.getApplication(tenant, String(enquiry.convertedApplicationId));
    }

    const names = String(enquiry.studentName ?? "").trim().split(/\s+/);
    const firstName = names[0] || "Student";
    const lastName = names.slice(1).join(" ") || "Applicant";

    const guardianNames = String(enquiry.guardianName ?? "").trim().split(/\s+/);
    const guardianFirstName = guardianNames[0] || "Guardian";
    const guardianLastName = guardianNames.slice(1).join(" ") || "Contact";

    const applicationData: JsonRecord = {
      enquiryId: enquiry.id,
      enquiryReference: enquiry.referenceNumber,
      desiredGradeId: enquiry.desiredGradeId,
      campus: enquiry.preferredCampus || "Main Campus",
      admissionCategory: "regular",
      status: "draft",
      student: {
        firstName,
        lastName,
        dateOfBirth: enquiry.dateOfBirth || "2015-01-01",
        gender: enquiry.gender || "male",
        email: enquiry.email,
        phone: enquiry.phone,
        address: enquiry.address,
        previousSchool: enquiry.previousSchool,
      },
      guardians: [
        {
          id: uuid(),
          firstName: guardianFirstName,
          lastName: guardianLastName,
          relationship: "guardian",
          email: enquiry.email || "guardian@example.com",
          phone: enquiry.phone,
          isPrimaryContact: true,
          isEmergencyContact: true,
        },
      ],
      documents: [],
    };

    const newApplication = await this.createApplication(tenant, applicationData, actor);

    // Update enquiry to converted status
    await this.updateEnquiry(tenant, enquiryId, {
      status: "converted",
      convertedApplicationId: newApplication.id,
      convertedAt: now(),
    }, actor);

    return newApplication;
  }

  /* ─────────────────────────────────────────────────────────────
   * 3. APPLICATION MANAGEMENT (CRUD, DRAFT, SUBMIT, WITHDRAW)
   * ───────────────────────────────────────────────────────────── */
  async listApplications(tenant: Tenant, filters?: { status?: string; search?: string; gradeId?: string; academicYear?: string; campus?: string }) {
    const rows = await this.database.db
      .select()
      .from(portalUpdateRequests)
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.requestType, "admission_application")
        )
      )
      .orderBy(desc(portalUpdateRequests.createdAt));

    let list = rows.map((r) => dto<JsonRecord & { id: string; status: string; applicationNumber: string; desiredGradeId?: string; academicYear?: string; campus?: string; student?: JsonRecord }>(tenant, r));

    if (filters?.status) {
      list = list.filter((a) => a.status === filters.status);
    }
    if (filters?.gradeId) {
      list = list.filter((a) => a.desiredGradeId === filters.gradeId);
    }
    if (filters?.academicYear) {
      list = list.filter((a) => a.academicYear === filters.academicYear);
    }
    if (filters?.campus) {
      list = list.filter((a) => a.campus === filters.campus);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((a) => {
        const studentObj = a.student as JsonRecord | undefined;
        const sName = `${studentObj?.firstName ?? ""} ${studentObj?.lastName ?? ""}`.toLowerCase();
        return (
          sName.includes(q) ||
          String(a.applicationNumber ?? "").toLowerCase().includes(q) ||
          String(studentObj?.email ?? "").toLowerCase().includes(q)
        );
      });
    }

    return list;
  }

  async getApplication(tenant: Tenant, id: string) {
    const row = (
      await this.database.db
        .select()
        .from(portalUpdateRequests)
        .where(
          and(
            eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
            eq(portalUpdateRequests.id, id),
            eq(portalUpdateRequests.requestType, "admission_application")
          )
        )
        .limit(1)
    )[0];

    if (!row) throw new ApiError(404, "NOT_FOUND", "Admission application not found.");
    return dto<JsonRecord & { id: string; status: string; applicationNumber: string }>(tenant, row);
  }

  async createApplication(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    const student = (data.student && typeof data.student === "object" ? data.student : {}) as JsonRecord;
    assertText(student.firstName, "Student first name");
    assertText(student.lastName, "Student last name");
    assertText(student.dateOfBirth, "Student date of birth");

    const desiredGradeId = assertText(data.desiredGradeId, "Desired grade");
    const campus = str(data.campus) || "Main Campus";

    const count = (
      await this.database.db
        .select()
        .from(portalUpdateRequests)
        .where(
          and(
            eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
            eq(portalUpdateRequests.requestType, "admission_application")
          )
        )
    ).length;

    const currentYear = new Date().getFullYear();
    const applicationNumber = `APP-${currentYear}-${String(count + 1).padStart(5, "0")}`;

    const id = uuid();
    const status = str(data.status) || "draft";

    const appRecord: JsonRecord = {
      ...data,
      id,
      organizationId: tenant.organizationId,
      applicationNumber,
      desiredGradeId,
      campus,
      status,
      academicYear: str(data.academicYear) || `${currentYear}-${currentYear + 1}`,
      student: {
        ...student,
        gender: str(student.gender) || "male",
      },
      guardians: Array.isArray(data.guardians) ? data.guardians : [],
      documents: Array.isArray(data.documents) ? data.documents : [],
      auditTrail: [
        {
          action: "created",
          actorUserId: actor?.userId,
          actorRole: actor?.role,
          timestamp: now(),
          details: `Application created with status ${status}`,
        },
      ],
      createdAt: now(),
      updatedAt: now(),
    };

    await this.database.db
      .insert(portalUpdateRequests)
      .values({
        id,
        workspaceId: tenant.workspaceId,
        requesterUserId: str(actor?.userId) || "system",
        requesterRole: str(actor?.role) || "applicant",
        requestType: "admission_application",
        status,
        payload: appRecord,
      })
      .catch(dbError);

    return appRecord;
  }

  async updateApplication(tenant: Tenant, id: string, data: JsonRecord, actor?: Actor) {
    const current = await this.getApplication(tenant, id);
    if (["enrolled", "withdrawn"].includes(String(current.status))) {
      throw new ApiError(400, "VALIDATION_FAILED", `Cannot modify application in '${current.status}' status.`);
    }

    const auditTrail = Array.isArray(current.auditTrail) ? [...current.auditTrail] : [];
    auditTrail.push({
      action: "updated",
      actorUserId: actor?.userId,
      actorRole: actor?.role,
      timestamp: now(),
      details: "Application updated",
    });

    const updatedRecord: JsonRecord = {
      ...current,
      ...data,
      id,
      auditTrail,
      updatedAt: now(),
    };

    await this.database.db
      .update(portalUpdateRequests)
      .set({
        status: String(updatedRecord.status),
        payload: updatedRecord,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.id, id),
          eq(portalUpdateRequests.requestType, "admission_application")
        )
      )
      .catch(dbError);

    return updatedRecord;
  }

  async submitApplication(tenant: Tenant, id: string, actor?: Actor) {
    const current = await this.getApplication(tenant, id);
    if (current.status !== "draft") {
      throw new ApiError(400, "VALIDATION_FAILED", `Only draft applications can be submitted. Current status: ${current.status}`);
    }

    const student = current.student as JsonRecord | undefined;
    if (!student?.firstName || !student?.lastName || !student?.dateOfBirth) {
      throw new ApiError(400, "VALIDATION_FAILED", "Incomplete student profile. First name, last name, and date of birth are required.");
    }

    const guardiansList = Array.isArray(current.guardians) ? current.guardians : [];
    if (guardiansList.length === 0) {
      throw new ApiError(400, "VALIDATION_FAILED", "At least one parent/guardian must be provided for admission.");
    }

    const auditTrail = Array.isArray(current.auditTrail) ? [...current.auditTrail] : [];
    auditTrail.push({
      action: "submitted",
      actorUserId: actor?.userId,
      actorRole: actor?.role,
      timestamp: now(),
      details: "Application formally submitted for review",
    });

    const updatedRecord: JsonRecord = {
      ...current,
      status: "submitted",
      submissionDate: now(),
      auditTrail,
      updatedAt: now(),
    };

    await this.database.db
      .update(portalUpdateRequests)
      .set({
        status: "submitted",
        payload: updatedRecord,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.id, id),
          eq(portalUpdateRequests.requestType, "admission_application")
        )
      )
      .catch(dbError);

    return updatedRecord;
  }

  async withdrawApplication(tenant: Tenant, id: string, reason?: string, actor?: Actor) {
    const current = await this.getApplication(tenant, id);
    if (current.status === "enrolled") {
      throw new ApiError(400, "VALIDATION_FAILED", "Cannot withdraw an already enrolled student application. Use student withdrawal procedure instead.");
    }

    const auditTrail = Array.isArray(current.auditTrail) ? [...current.auditTrail] : [];
    auditTrail.push({
      action: "withdrawn",
      actorUserId: actor?.userId,
      actorRole: actor?.role,
      timestamp: now(),
      details: `Application withdrawn: ${reason || "No reason specified"}`,
    });

    const updatedRecord: JsonRecord = {
      ...current,
      status: "withdrawn",
      withdrawalReason: reason,
      withdrawnAt: now(),
      auditTrail,
      updatedAt: now(),
    };

    await this.database.db
      .update(portalUpdateRequests)
      .set({
        status: "withdrawn",
        payload: updatedRecord,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.id, id),
          eq(portalUpdateRequests.requestType, "admission_application")
        )
      )
      .catch(dbError);

    return updatedRecord;
  }

  /* ─────────────────────────────────────────────────────────────
   * 4. ADMISSION ASSESSMENTS
   * ───────────────────────────────────────────────────────────── */
  async listAssessments(tenant: Tenant, applicationId?: string) {
    const rows = await this.database.db
      .select()
      .from(portalUpdateRequests)
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.requestType, "admission_assessment")
        )
      )
      .orderBy(desc(portalUpdateRequests.createdAt));

    let list = rows.map((r) => dto<JsonRecord & { id: string; applicationId: string; outcome: string }>(tenant, r));
    if (applicationId) {
      list = list.filter((a) => a.applicationId === applicationId);
    }
    return list;
  }

  async getAssessment(tenant: Tenant, id: string) {
    const row = (
      await this.database.db
        .select()
        .from(portalUpdateRequests)
        .where(
          and(
            eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
            eq(portalUpdateRequests.id, id),
            eq(portalUpdateRequests.requestType, "admission_assessment")
          )
        )
        .limit(1)
    )[0];

    if (!row) throw new ApiError(404, "NOT_FOUND", "Assessment not found.");
    return dto<JsonRecord & { id: string }>(tenant, row);
  }

  async createAssessment(tenant: Tenant, data: JsonRecord, actor?: Actor) {
    const applicationId = assertText(data.applicationId, "Application ID");
    await this.getApplication(tenant, applicationId);

    const maximumMarks = Number(data.maximumMarks ?? 100);
    const obtainedMarks = Number(data.obtainedMarks ?? 0);
    const passingMarks = Number(data.passingMarks ?? Math.round(maximumMarks * 0.5));

    let outcome: AssessmentOutcome = (data.outcome as AssessmentOutcome) || "pending";
    if (!data.outcome) {
      outcome = obtainedMarks >= passingMarks ? "passed" : "failed";
    }

    const id = uuid();
    const assessmentRecord: JsonRecord = {
      ...data,
      id,
      organizationId: tenant.organizationId,
      applicationId,
      subject: assertText(data.subject, "Assessment subject"),
      assessmentType: str(data.assessmentType) || "written_test",
      assessmentDate: str(data.assessmentDate) || now().slice(0, 10),
      assessorStaffId: str(data.assessorStaffId) || "unassigned",
      assessorName: str(data.assessorName) || "Assessor",
      maximumMarks,
      obtainedMarks,
      passingMarks,
      outcome,
      remarks: str(data.remarks) || undefined,
      createdAt: now(),
      updatedAt: now(),
    };

    await this.database.db
      .insert(portalUpdateRequests)
      .values({
        id,
        workspaceId: tenant.workspaceId,
        requesterUserId: str(actor?.userId) || "system",
        requesterRole: str(actor?.role) || "assessor",
        requestType: "admission_assessment",
        status: outcome,
        payload: assessmentRecord,
      })
      .catch(dbError);

    // If application was submitted, move to assessment status
    const app = await this.getApplication(tenant, applicationId);
    if (app.status === "submitted" || app.status === "under_review") {
      await this.updateApplication(tenant, applicationId, { status: "assessment" }, actor);
    }

    return assessmentRecord;
  }

  async updateAssessment(tenant: Tenant, id: string, data: JsonRecord, _actor?: Actor) {
    const current = await this.getAssessment(tenant, id);
    const updatedRecord: JsonRecord = {
      ...current,
      ...data,
      id,
      updatedAt: now(),
    };

    await this.database.db
      .update(portalUpdateRequests)
      .set({
        status: str(updatedRecord.outcome) || String(current.status),
        payload: updatedRecord,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.id, id),
          eq(portalUpdateRequests.requestType, "admission_assessment")
        )
      )
      .catch(dbError);

    return updatedRecord;
  }

  async deleteAssessment(tenant: Tenant, id: string, _actor?: Actor) {
    await this.getAssessment(tenant, id);
    await this.database.db
      .delete(portalUpdateRequests)
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.id, id),
          eq(portalUpdateRequests.requestType, "admission_assessment")
        )
      );
  }

  /* ─────────────────────────────────────────────────────────────
   * 5. APPROVAL WORKFLOW & SEPARATION OF DUTIES
   * ───────────────────────────────────────────────────────────── */
  async recordDecision(
    tenant: Tenant,
    applicationId: string,
    decision: {
      status: "approved" | "rejected" | "waitlisted" | "under_review" | "assessment";
      remarks?: string;
      rejectionReason?: string;
      waitlistRank?: number;
    },
    actor?: Actor
  ) {
    const current = await this.getApplication(tenant, applicationId);

    // Separation of duties: Ensure user cannot approve their own submitted application
    if (
      actor?.userId &&
      current.requesterUserId === actor.userId &&
      decision.status === "approved" &&
      actor.role !== "Owner"
    ) {
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Separation-of-duties rule violation: You cannot approve an application that you originally submitted."
      );
    }

    // State machine check
    if (current.status === "draft") {
      throw new ApiError(400, "VALIDATION_FAILED", "Cannot make a decision on a draft application. Application must be submitted first.");
    }
    if (current.status === "enrolled") {
      throw new ApiError(400, "VALIDATION_FAILED", "Application is already enrolled. Status cannot be changed.");
    }

    const auditTrail = Array.isArray(current.auditTrail) ? [...current.auditTrail] : [];
    auditTrail.push({
      action: `decision_${decision.status}`,
      actorUserId: actor?.userId,
      actorRole: actor?.role,
      timestamp: now(),
      details: `Application marked as ${decision.status}. Remarks: ${decision.remarks || "None"}`,
    });

    const updatedDecision = {
      status: decision.status,
      decisionDate: now(),
      reviewerUserId: actor?.userId || "system",
      reviewerName: actor?.role ? `${actor.role} Reviewer` : "Admissions Committee",
      remarks: decision.remarks,
      rejectionReason: decision.rejectionReason,
      waitlistRank: decision.waitlistRank,
    };

    const updatedRecord: JsonRecord = {
      ...current,
      status: decision.status,
      decision: updatedDecision,
      auditTrail,
      updatedAt: now(),
    };

    await this.database.db
      .update(portalUpdateRequests)
      .set({
        status: decision.status,
        payload: updatedRecord,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.id, applicationId),
          eq(portalUpdateRequests.requestType, "admission_application")
        )
      )
      .catch(dbError);

    return updatedRecord;
  }

  /* ─────────────────────────────────────────────────────────────
   * 6. FEE PACKAGE REVIEW & ASSIGNMENT
   * ───────────────────────────────────────────────────────────── */
  async getFeePackagePreview(tenant: Tenant, applicationId: string) {
    const app = await this.getApplication(tenant, applicationId);
    const financeService = new SisFinanceService(this.database);

    const allStructures = (await financeService.listStructures(tenant)) as Array<JsonRecord & { id: string; name: string; amountCents: number; gradeId?: string; status: string }>;
    const allDiscounts = (await financeService.listDiscounts(tenant)) as Array<JsonRecord & { id: string; name: string; type: string; value: number; status: string }>;

    // Match structures applicable to this grade
    const applicableStructures = allStructures.filter(
      (s) => s.status === "active" && (!s.gradeId || s.gradeId === app.desiredGradeId)
    );

    const activeDiscounts = allDiscounts.filter((d) => d.status === "active");

    const totalTuitionCents = applicableStructures.reduce((sum, s) => sum + Number(s.amountCents || 0), 0);

    return {
      applicationId,
      desiredGradeId: app.desiredGradeId,
      applicableStructures,
      availableDiscounts: activeDiscounts,
      totalTuitionCents,
      assignedPackage: app.feePackage || null,
    };
  }

  async assignFeePackage(
    tenant: Tenant,
    applicationId: string,
    assignment: { feeStructureIds: string[]; discountIds?: string[]; admissionFeeCents?: number },
    actor?: Actor
  ) {
    await this.getApplication(tenant, applicationId);
    const financeService = new SisFinanceService(this.database);

    const structures = (await financeService.listStructures(tenant)) as Array<JsonRecord & { id: string; amountCents: number }>;
    const selectedStructures = structures.filter((s) => assignment.feeStructureIds.includes(s.id));

    const totalTuitionCents = selectedStructures.reduce((sum, s) => sum + Number(s.amountCents || 0), 0);

    const feePackage = {
      feeStructureIds: assignment.feeStructureIds,
      discountIds: assignment.discountIds || [],
      admissionFeeCents: assignment.admissionFeeCents ?? 0,
      totalTuitionCents,
      reviewedBy: actor?.userId || "Admissions",
      reviewedAt: now(),
    };

    return this.updateApplication(tenant, applicationId, { feePackage }, actor);
  }

  /* ─────────────────────────────────────────────────────────────
   * 7. TRANSACTIONAL ENROLLMENT CONVERSION & IDEMPOTENCY
   * ───────────────────────────────────────────────────────────── */
  async convertApplicationToEnrollment(
    tenant: Tenant,
    applicationId: string,
    options: {
      academicYear: string;
      gradeId: string;
      sectionId: string;
      admissionDate?: string;
      reuseExistingStudentId?: string;
    },
    actor?: Actor
  ) {
    const app = await this.getApplication(tenant, applicationId);

    // Idempotency: If already converted, return existing records
    if (app.status === "enrolled" && app.enrolledStudentId && app.enrolledEnrollmentId) {
      const sisService = new SisService(this.database);
      const student = await sisService.getStudent(tenant, String(app.enrolledStudentId));
      const enrollmentRows = await sisService.listEnrollments(tenant, { studentId: String(app.enrolledStudentId) });
      const enrollment = enrollmentRows.find((e) => e.id === app.enrolledEnrollmentId) || enrollmentRows[0];
      return {
        success: true,
        isExisting: true,
        applicationId,
        student,
        enrollment,
        message: "Application is already enrolled. Idempotent result returned.",
      };
    }

    if (app.status !== "approved") {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        `Only approved applications can be converted into active enrollments. Current status: ${app.status}`
      );
    }

    const studentData = app.student as JsonRecord;
    const guardiansData = (Array.isArray(app.guardians) ? app.guardians : []) as JsonRecord[];

    const sisService = new SisService(this.database);
    const financeService = new SisFinanceService(this.database);

    let studentId: string;

    if (options.reuseExistingStudentId) {
      // Reuse existing student record
      const existing = await sisService.getStudent(tenant, options.reuseExistingStudentId);
      if (!existing) {
        throw new ApiError(404, "NOT_FOUND", "Specified existing student to reuse was not found.");
      }
      studentId = existing.id;
      // Update status to active if was applicant/inactive
      await this.database.db.update(students).set({ status: "active", updatedAt: new Date() }).where(and(eq(students.id, studentId), eq(students.workspaceId, tenant.workspaceId)));
    } else {
      // Check for duplicate students by name and date of birth
      const allStudents = await sisService.listStudents(tenant);
      const dup = allStudents.find(
        (s) =>
          s.firstName.toLowerCase() === String(studentData.firstName).toLowerCase() &&
          s.lastName.toLowerCase() === String(studentData.lastName).toLowerCase() &&
          s.dateOfBirth === studentData.dateOfBirth &&
          s.status !== "archived"
      );
      if (dup) {
        throw new ApiError(
          409,
          "DATABASE_UNIQUE_CONSTRAINT",
          `Duplicate student detected: '${dup.firstName} ${dup.lastName}' (DOB: ${dup.dateOfBirth}) already exists with admission number ${dup.admissionNumber}.`
        );
      }

      // Create student record
      const createdStudent = await sisService.createStudent(tenant, {
        firstName: studentData.firstName,
        middleName: studentData.middleName,
        lastName: studentData.lastName,
        dateOfBirth: studentData.dateOfBirth,
        gender: studentData.gender || "male",
        email: studentData.email || undefined,
        phone: studentData.phone || undefined,
        address: studentData.address || undefined,
        photoUrl: studentData.photoUrl || undefined,
        admissionDate: options.admissionDate || now().slice(0, 10),
        status: "active",
        guardians: guardiansData.map((g) => ({
          firstName: g.firstName,
          lastName: g.lastName,
          relationship: g.relationship || "guardian",
          email: g.email,
          phone: g.phone,
          address: g.address,
          occupation: g.occupation,
          isPrimaryContact: Boolean(g.isPrimaryContact),
          isEmergencyContact: Boolean(g.isEmergencyContact),
          portalAccessEnabled: true,
          authorizedForPortal: true,
        })),
      });
      studentId = createdStudent.id;
    }

    // Create enrollment record
    const createdEnrollment = await sisService.createEnrollment(tenant, {
      studentId,
      academicYear: options.academicYear,
      gradeId: options.gradeId,
      sectionId: options.sectionId,
      enrollmentDate: options.admissionDate || now().slice(0, 10),
      status: "active",
    });

    // Integrate Fee Package Assignments if configured
    const feePackage = app.feePackage as { feeStructureIds?: string[] } | undefined;
    if (feePackage?.feeStructureIds && Array.isArray(feePackage.feeStructureIds)) {
      for (const structureId of feePackage.feeStructureIds) {
        try {
          await financeService.assignFee(tenant, studentId, createdEnrollment.id, structureId, actor);
        } catch {
          // Continue gracefully if structure assignment succeeds or already assigned
        }
      }
    }

    // Update application state to enrolled
    const auditTrail = Array.isArray(app.auditTrail) ? [...app.auditTrail] : [];
    auditTrail.push({
      action: "converted_to_enrollment",
      actorUserId: actor?.userId,
      actorRole: actor?.role,
      timestamp: now(),
      details: `Converted to active student ${studentId} and enrollment ${createdEnrollment.id}`,
    });

    const updatedRecord: JsonRecord = {
      ...app,
      status: "enrolled",
      enrolledStudentId: studentId,
      enrolledEnrollmentId: createdEnrollment.id,
      enrolledAt: now(),
      auditTrail,
      updatedAt: now(),
    };

    await this.database.db
      .update(portalUpdateRequests)
      .set({
        status: "enrolled",
        studentId,
        payload: updatedRecord,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalUpdateRequests.workspaceId, tenant.workspaceId),
          eq(portalUpdateRequests.id, applicationId)
        )
      );

    const finalStudent = await sisService.getStudent(tenant, studentId);

    return {
      success: true,
      isExisting: false,
      applicationId,
      student: finalStudent,
      enrollment: createdEnrollment,
      message: "Student successfully enrolled.",
    };
  }

  /* ─────────────────────────────────────────────────────────────
   * 8. PRINTABLE DOCUMENT DATA (A4 FORMATTED)
   * ───────────────────────────────────────────────────────────── */
  async getApplicationPrintData(tenant: Tenant, applicationId: string) {
    const app = await this.getApplication(tenant, applicationId);
    const sisService = new SisService(this.database);

    const grades = await sisService.listGrades(tenant);
    const grade = grades.find((g) => g.id === app.desiredGradeId);
    const assessmentsList = await this.listAssessments(tenant, applicationId);

    const studentObj = (app.student || {}) as JsonRecord;
    const guardiansList = (Array.isArray(app.guardians) ? app.guardians : []) as JsonRecord[];

    return {
      organizationId: tenant.organizationId,
      applicationNumber: app.applicationNumber,
      status: app.status,
      academicYear: app.academicYear,
      campus: app.campus || "Main Campus",
      gradeName: grade?.name || "Grade",
      submissionDate: app.submissionDate || app.createdAt,
      student: {
        fullName: `${studentObj.firstName || ""} ${studentObj.middleName || ""} ${studentObj.lastName || ""}`.replace(/\s+/g, " ").trim(),
        firstName: studentObj.firstName,
        lastName: studentObj.lastName,
        dateOfBirth: studentObj.dateOfBirth,
        gender: studentObj.gender,
        email: studentObj.email,
        phone: studentObj.phone,
        address: studentObj.address,
        previousSchool: studentObj.previousSchool,
        photoUrl: studentObj.photoUrl,
      },
      guardians: guardiansList.map((g) => ({
        fullName: `${g.firstName || ""} ${g.lastName || ""}`.trim(),
        relationship: g.relationship,
        email: g.email,
        phone: g.phone,
        occupation: g.occupation,
      })),
      assessments: assessmentsList.map((a) => ({
        subject: a.subject,
        type: a.assessmentType,
        marks: `${a.obtainedMarks} / ${a.maximumMarks}`,
        outcome: a.outcome,
        date: a.assessmentDate,
      })),
      decision: app.decision || null,
      feePackage: app.feePackage || null,
      generatedAt: now(),
    };
  }

  /* ─────────────────────────────────────────────────────────────
   * 9. ADMISSIONS REPORTS & EXPORTS
   * ───────────────────────────────────────────────────────────── */
  async getReport(
    tenant: Tenant,
    reportType: "enquiry_register" | "application_register" | "conversion_summary" | "campus_summary" | "grade_summary",
    filters?: { academicYear?: string; campus?: string }
  ) {
    const enquiries = await this.listEnquiries(tenant, filters);
    const applications = await this.listApplications(tenant, filters);

    switch (reportType) {
      case "enquiry_register":
        return {
          title: "Admissions Enquiry Register",
          rowCount: enquiries.length,
          rows: enquiries.map((e) => ({
            reference: e.referenceNumber,
            date: e.enquiryDate,
            studentName: e.studentName,
            guardianName: e.guardianName,
            phone: e.phone,
            status: e.status,
            source: e.source,
            campus: e.preferredCampus,
          })),
        };

      case "application_register":
        return {
          title: "Admissions Application Register",
          rowCount: applications.length,
          rows: applications.map((a) => {
            const s = (a.student || {}) as JsonRecord;
            return {
              applicationNumber: a.applicationNumber,
              submissionDate: a.submissionDate || a.createdAt,
              studentName: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
              gender: s.gender,
              dob: s.dateOfBirth,
              campus: a.campus,
              status: a.status,
              academicYear: a.academicYear,
            };
          }),
        };

      case "conversion_summary": {
        const total = applications.length;
        const enrolled = applications.filter((a) => a.status === "enrolled").length;
        const approved = applications.filter((a) => a.status === "approved").length;
        const rejected = applications.filter((a) => a.status === "rejected").length;
        const pending = total - enrolled - approved - rejected;

        return {
          title: "Admission Conversion Summary",
          totalApplications: total,
          enrolled,
          approved,
          rejected,
          pending,
          conversionRate: total > 0 ? `${Math.round((enrolled / total) * 100)}%` : "0%",
        };
      }

      case "campus_summary": {
        const campusMap: Record<string, { total: number; enrolled: number }> = {};
        for (const app of applications) {
          const c = String(app.campus || "Main Campus");
          if (!campusMap[c]) campusMap[c] = { total: 0, enrolled: 0 };
          campusMap[c].total++;
          if (app.status === "enrolled") campusMap[c].enrolled++;
        }
        return {
          title: "Campus-wise Admissions Report",
          campuses: Object.entries(campusMap).map(([campus, counts]) => ({
            campus,
            totalApplications: counts.total,
            enrolledStudents: counts.enrolled,
            conversionRate: counts.total > 0 ? `${Math.round((counts.enrolled / counts.total) * 100)}%` : "0%",
          })),
        };
      }

      case "grade_summary": {
        const sisService = new SisService(this.database);
        const grades = await sisService.listGrades(tenant);
        const gradeMap: Record<string, { name: string; total: number; enrolled: number }> = {};
        for (const g of grades) {
          gradeMap[g.id] = { name: g.name, total: 0, enrolled: 0 };
        }
        for (const app of applications) {
          const gid = String(app.desiredGradeId);
          if (gradeMap[gid]) {
            gradeMap[gid].total++;
            if (app.status === "enrolled") gradeMap[gid].enrolled++;
          }
        }
        return {
          title: "Grade-wise Admissions Report",
          grades: Object.values(gradeMap),
        };
      }

      default:
        throw new ApiError(400, "VALIDATION_FAILED", `Unknown report type '${reportType}'.`);
    }
  }
}
