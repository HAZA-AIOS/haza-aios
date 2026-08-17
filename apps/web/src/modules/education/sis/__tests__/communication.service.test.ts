import { beforeEach, describe, expect, it } from "vitest";
import { AcademicService } from "../academic.service";
import { CommunicationService } from "../communication.service";
import { EnrollmentService } from "../enrollment.service";
import { StaffService } from "../staff.service";
import { StudentService } from "../student.service";
import { TeachingAssignmentService } from "../teaching-assignment.service";

const owner = { userId: "owner-1", role: "Owner" as const };
const admin = { userId: "admin-1", role: "Admin" as const };
const teacher = { userId: "teacher-user", role: "Teacher" as const, staffId: "" };
const member = { userId: "member-1", role: "Member" as const };

async function seedCommunicationContext(organizationId: string) {
  const year = await AcademicService.createAcademicYear(organizationId, {
    name: `2026-2027-${organizationId}`,
    startDate: "2026-08-01",
    endDate: "2027-07-31",
    status: "active",
  });
  const grade = await AcademicService.createGrade(organizationId, {
    name: "Grade 5",
    level: 5,
    order: 5,
    status: "active",
  });
  const section = await AcademicService.createSection(organizationId, {
    gradeId: grade.id,
    name: "A",
    capacity: 35,
    status: "active",
  });
  const student = await StudentService.createStudent({
    organizationId,
    firstName: "Amina",
    lastName: "Khan",
    dateOfBirth: "2014-01-01",
    gender: "female",
    admissionDate: "2026-08-01",
    status: "active",
    email: "amina@example.com",
    guardians: [{
      id: "guardian-1",
      firstName: "Sara",
      lastName: "Khan",
      relationship: "mother",
      email: "sara@example.com",
      phone: "555-1000",
      isEmergencyContact: true,
      isPrimaryContact: true,
    }],
  });
  await EnrollmentService.enrollStudent({
    organizationId,
    studentId: student.id,
    academicYear: year.name,
    gradeId: grade.id,
    sectionId: section.id,
    enrollmentDate: "2026-08-01",
    status: "active",
  });
  const staff = await StaffService.createStaff({
    organizationId,
    firstName: "Tariq",
    lastName: "Ali",
    email: "tariq@example.com",
    hireDate: "2026-08-01",
    staffType: "teacher",
    employmentStatus: "full_time",
    status: "active",
    userId: "teacher-user",
  });
  await TeachingAssignmentService.assignTeacher({
    organizationId,
    staffId: staff.id,
    academicYear: year.name,
    gradeId: grade.id,
    sectionId: section.id,
    subjectId: "subject-1",
    isActive: true,
  });
  return { year, grade, section, student, staff };
}

describe("Epic 10H: Communication & Notifications", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resolves organization, class, section, guardian, and staff audiences without duplicates", async () => {
    const { year, grade, section, student, staff } = await seedCommunicationContext("org-comm");

    const organization = await CommunicationService.resolveAudience("org-comm", { type: "organization" });
    const sectionRecipients = await CommunicationService.resolveAudience("org-comm", {
      type: "section",
      academicYear: year.name,
      gradeId: grade.id,
      sectionId: section.id,
    });
    const guardians = await CommunicationService.resolveAudience("org-comm", { type: "selected_guardians", guardianIds: ["guardian-1"] });
    const selectedStaff = await CommunicationService.resolveAudience("org-comm", { type: "selected_staff", staffIds: [staff.id] });

    expect(organization.map((recipient) => recipient.kind).sort()).toEqual(["guardian", "student", "teacher"]);
    expect(sectionRecipients.some((recipient) => recipient.studentId === student.id)).toBe(true);
    expect(guardians).toHaveLength(1);
    expect(selectedStaff[0].staffId).toBe(staff.id);
  });

  it("creates draft announcements, publishes them, and creates in-app notifications", async () => {
    const { year, grade, section } = await seedCommunicationContext("org-announcement");
    const announcement = await CommunicationService.createAnnouncement("org-announcement", {
      title: "Holiday Notice",
      content: "School will be closed tomorrow.",
      authorId: "admin-1",
      audience: { type: "section", academicYear: year.name, gradeId: grade.id, sectionId: section.id },
      priority: "important",
      status: "draft",
    }, admin);

    expect(announcement.status).toBe("draft");
    const published = await CommunicationService.publishAnnouncement("org-announcement", announcement.id, admin);
    const notifications = await CommunicationService.getNotifications("org-announcement");

    expect(published.status).toBe("published");
    expect(published.recipientCount).toBe(2);
    expect(notifications).toHaveLength(2);
  });

  it("supports notification read state, unread count, and mark-all-read", async () => {
    const { student } = await seedCommunicationContext("org-notify");
    const notification = await CommunicationService.createNotification("org-notify", {
      recipientKind: "student",
      recipientId: student.id,
      type: "result.published",
      title: "Result Published",
      message: "Your result is available.",
      priority: "normal",
      relatedResourceType: "result",
      relatedResourceId: "result-1",
      actionPath: "/workspace/education/examinations/results",
    });

    expect(await CommunicationService.getUnreadCount("org-notify", { kind: "student", id: student.id })).toBe(1);
    await CommunicationService.markNotificationRead("org-notify", notification.id, { kind: "student", id: student.id });
    expect(await CommunicationService.getUnreadCount("org-notify", { kind: "student", id: student.id })).toBe(0);
    await CommunicationService.createNotification("org-notify", {
      recipientKind: "student",
      recipientId: student.id,
      type: "fee.due",
      title: "Fee Due",
      message: "Fees are due.",
      priority: "important",
    });
    expect(await CommunicationService.markAllNotificationsRead("org-notify", { kind: "student", id: student.id })).toBe(1);
  });

  it("creates templates and safely resolves supported variables", async () => {
    const template = await CommunicationService.createTemplate("org-template", {
      name: "Payment Confirmation",
      category: "finance",
      subject: "Payment received from {{school_name}}",
      content: "Dear {{guardian_name}}, payment for {{student_name}} was received.",
      supportedVariables: ["school_name", "guardian_name", "student_name"],
      status: "active",
    }, owner);

    const rendered = CommunicationService.renderTemplate(template, {
      school_name: "The Mentor School",
      guardian_name: "Sara",
      student_name: "Amina",
    });
    expect(rendered.content).toContain("Amina");

    await expect(CommunicationService.createTemplate("org-template", {
      ...template,
      name: "Unsafe",
      supportedVariables: ["eval"],
    }, owner)).rejects.toThrow("Unsupported template variable");
  });

  it("sends communication with duplicate recipient removal, delivery records, and idempotency", async () => {
    const { student } = await seedCommunicationContext("org-send");
    const message = await CommunicationService.sendCommunication("org-send", {
      subject: "Individual Update",
      body: "Please contact the school office.",
      senderId: "admin-1",
      audience: { type: "selected_students", studentIds: [student.id, student.id] },
      channels: ["in_app", "email", "sms", "whatsapp"],
      priority: "urgent",
      idempotencyKey: "send-1",
    }, admin);
    const duplicate = await CommunicationService.sendCommunication("org-send", {
      subject: "Individual Update",
      body: "Please contact the school office.",
      senderId: "admin-1",
      audience: { type: "selected_students", studentIds: [student.id] },
      channels: ["in_app"],
      priority: "urgent",
      idempotencyKey: "send-1",
    }, admin);
    const deliveries = await CommunicationService.getDeliveryHistory("org-send");

    expect(duplicate.id).toBe(message.id);
    expect(message.recipientCount).toBe(1);
    expect(deliveries.find((delivery) => delivery.channel === "in_app")?.status).toBe("sent");
    expect(deliveries.filter((delivery) => delivery.channel !== "in_app").every((delivery) => delivery.status === "queued")).toBe(true);
  });

  it("enforces sender permissions and teacher academic scope", async () => {
    const { year, grade, section, staff } = await seedCommunicationContext("org-scope");
    await expect(CommunicationService.sendCommunication("org-scope", {
      subject: "Blocked",
      body: "No permission",
      senderId: "member-1",
      audience: { type: "all_students" },
      channels: ["in_app"],
      priority: "normal",
    }, member)).rejects.toThrow("Unauthorized");

    await expect(CommunicationService.resolveAudience("org-scope", {
      type: "section",
      academicYear: year.name,
      gradeId: grade.id,
      sectionId: section.id,
    }, { ...teacher, staffId: staff.id })).resolves.toHaveLength(2);

    await expect(CommunicationService.resolveAudience("org-scope", {
      type: "section",
      academicYear: year.name,
      gradeId: "other-grade",
      sectionId: "other-section",
    }, { ...teacher, staffId: staff.id })).rejects.toThrow("not authorized");
  });

  it("keeps communication records isolated by organization", async () => {
    await seedCommunicationContext("org-a");
    await CommunicationService.createAnnouncement("org-a", {
      title: "Org A",
      content: "Only Org A",
      authorId: "admin-1",
      audience: { type: "all_students" },
      priority: "normal",
      status: "published",
    }, admin);

    expect(await CommunicationService.getAnnouncements("org-a")).toHaveLength(1);
    expect(await CommunicationService.getAnnouncements("org-b")).toHaveLength(0);
    expect(await CommunicationService.getNotifications("org-b")).toHaveLength(0);
  });

  it("emits reusable SIS domain notifications for integrations", async () => {
    const { student } = await seedCommunicationContext("org-events");
    const notifications = await CommunicationService.emitDomainNotification("org-events", "invoice.issued", {
      type: "selected_students",
      studentIds: [student.id],
    }, {
      title: "Invoice Issued",
      message: "A new fee invoice is available.",
      priority: "important",
      relatedResourceType: "invoice",
      relatedResourceId: "invoice-1",
      actionPath: "/workspace/education/finance/invoices",
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("invoice.issued");
    expect(notifications[0].actionPath).toContain("finance");
  });
});
