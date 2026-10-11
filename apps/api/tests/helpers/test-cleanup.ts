import { inArray, eq } from "drizzle-orm";
import type { DatabaseClient } from "../../src/database/client.js";
import {
  organizations,
  workspaces,
  workspaceMemberships,
  organizationMemberships,
  membershipRoles,
  roles,
  users,
  authSessions,
  tenantDomains,
  academicYears,
  academicTerms,
  gradeLevels,
  sections,
  subjects,
  staffDepartments,
  staffMembers,
  students,
  guardians,
  studentGuardians,
  enrollments,
  classSubjects,
  teachingAssignments,
  attendanceSessions,
  attendanceRecords,
  timetableEntries,
  financeFeeCategories,
  financeFeeStructures,
  financeStudentFeeAssignments,
  financeInvoices,
  financePayments,
  financeReceipts,
  communicationMessages,
  communicationDeliveries,
  portalPolicies,
  portalUpdateRequests,
  examinations,
  examinationSubjects,
  markRecords,
  resultPublications,
} from "../../src/database/schema.js";
import { assertSafeConnectedDatabase } from "./test-database-guard.js";

export interface TrackedFixtureContext {
  organizationIds: Set<string>;
  userIds: Set<string>;
}

export function createFixtureTracker(): TrackedFixtureContext {
  return {
    organizationIds: new Set<string>(),
    userIds: new Set<string>(),
  };
}

/**
 * Safely cleans up test-generated data by tracked tenant (organizationId) and userId.
 * Validates connected database identity before executing any delete statements.
 * Never runs TRUNCATE, DROP, or un-scoped DELETE.
 */
export async function cleanupTrackedFixtures(
  database: DatabaseClient,
  tracker: TrackedFixtureContext
): Promise<void> {
  // Fail-closed guard: runtime database identity check
  await assertSafeConnectedDatabase(database);

  const orgIds = Array.from(tracker.organizationIds);
  const userIds = Array.from(tracker.userIds);

  if (orgIds.length === 0 && userIds.length === 0) {
    return;
  }

  const db = database.db;

  if (orgIds.length > 0) {
    // Reverse dependency cleanup for organization-scoped tables
    await db.delete(markRecords).where(inArray(markRecords.tenantId, orgIds));
    await db.delete(resultPublications).where(inArray(resultPublications.tenantId, orgIds));
    await db.delete(examinationSubjects).where(inArray(examinationSubjects.tenantId, orgIds));
    await db.delete(examinations).where(inArray(examinations.tenantId, orgIds));

    await db.delete(financeReceipts).where(inArray(financeReceipts.tenantId, orgIds));
    await db.delete(financePayments).where(inArray(financePayments.tenantId, orgIds));
    await db.delete(financeInvoices).where(inArray(financeInvoices.tenantId, orgIds));
    await db.delete(financeStudentFeeAssignments).where(inArray(financeStudentFeeAssignments.tenantId, orgIds));
    await db.delete(financeFeeStructures).where(inArray(financeFeeStructures.tenantId, orgIds));
    await db.delete(financeFeeCategories).where(inArray(financeFeeCategories.tenantId, orgIds));

    await db.delete(communicationDeliveries).where(inArray(communicationDeliveries.tenantId, orgIds));
    await db.delete(communicationMessages).where(inArray(communicationMessages.tenantId, orgIds));
    await db.delete(portalUpdateRequests).where(inArray(portalUpdateRequests.tenantId, orgIds));
    await db.delete(portalPolicies).where(inArray(portalPolicies.tenantId, orgIds));

    await db.delete(attendanceRecords).where(inArray(attendanceRecords.tenantId, orgIds));
    await db.delete(attendanceSessions).where(inArray(attendanceSessions.tenantId, orgIds));
    await db.delete(timetableEntries).where(inArray(timetableEntries.tenantId, orgIds));

    await db.delete(teachingAssignments).where(inArray(teachingAssignments.tenantId, orgIds));
    await db.delete(classSubjects).where(inArray(classSubjects.tenantId, orgIds));
    await db.delete(enrollments).where(inArray(enrollments.tenantId, orgIds));
    await db.delete(studentGuardians).where(inArray(studentGuardians.tenantId, orgIds));
    await db.delete(guardians).where(inArray(guardians.tenantId, orgIds));
    await db.delete(students).where(inArray(students.tenantId, orgIds));

    await db.delete(sections).where(inArray(sections.tenantId, orgIds));
    await db.delete(gradeLevels).where(inArray(gradeLevels.tenantId, orgIds));
    await db.delete(academicTerms).where(inArray(academicTerms.tenantId, orgIds));
    await db.delete(academicYears).where(inArray(academicYears.tenantId, orgIds));

    await db.delete(staffMembers).where(inArray(staffMembers.tenantId, orgIds));
    await db.delete(staffDepartments).where(inArray(staffDepartments.tenantId, orgIds));
    await db.delete(subjects).where(inArray(subjects.tenantId, orgIds));
    await db.delete(tenantDomains).where(inArray(tenantDomains.organizationId, orgIds));

    await db.delete(workspaceMemberships).where(inArray(workspaceMemberships.organizationId, orgIds));
    await db.delete(workspaces).where(inArray(workspaces.organizationId, orgIds));
    await db.delete(membershipRoles).where(inArray(membershipRoles.organizationId, orgIds));
    await db.delete(organizationMemberships).where(inArray(organizationMemberships.organizationId, orgIds));
    await db.delete(roles).where(inArray(roles.organizationId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
  }

  if (userIds.length > 0) {
    await db.delete(authSessions).where(inArray(authSessions.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }

  tracker.organizationIds.clear();
  tracker.userIds.clear();
}
