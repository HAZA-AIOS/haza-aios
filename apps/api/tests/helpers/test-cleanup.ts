import { inArray, eq } from "drizzle-orm";
import type { DatabaseClient } from "../../src/database/client.js";
import {
  organizations,
  organizationSettings,
  workspaces,
  workspaceMemberships,
  organizationMemberships,
  membershipRoles,
  roles,
  rolePermissions,
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
  schoolSchedules,
  timePeriods,
  financeFeeCategories,
  financeFeeStructures,
  financeStudentFeeAssignments,
  financeInvoices,
  financePayments,
  financeReceipts,
  communicationTemplates,
  announcements,
  sisNotifications,
  communicationMessages,
  communicationDeliveries,
  portalPolicies,
  portalUpdateRequests,
  examinations,
  examinationSubjects,
  gradingRules,
  markRecords,
  resultPublications,
  organizationModules,
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
    // Find workspaces belonging to these organizations
    const workspaceRows = await db.select({ id: workspaces.id }).from(workspaces).where(inArray(workspaces.organizationId, orgIds));
    const workspaceIds = workspaceRows.map((r) => r.id);

    if (workspaceIds.length > 0) {
      // Reverse dependency cleanup for workspace-scoped tables
      await db.delete(markRecords).where(inArray(markRecords.workspaceId, workspaceIds));
      await db.delete(resultPublications).where(inArray(resultPublications.workspaceId, workspaceIds));
      await db.delete(examinationSubjects).where(inArray(examinationSubjects.workspaceId, workspaceIds));
      await db.delete(examinations).where(inArray(examinations.workspaceId, workspaceIds));
      await db.delete(gradingRules).where(inArray(gradingRules.workspaceId, workspaceIds));

      await db.delete(financeReceipts).where(inArray(financeReceipts.workspaceId, workspaceIds));
      await db.delete(financePayments).where(inArray(financePayments.workspaceId, workspaceIds));
      await db.delete(financeInvoices).where(inArray(financeInvoices.workspaceId, workspaceIds));
      await db.delete(financeStudentFeeAssignments).where(inArray(financeStudentFeeAssignments.workspaceId, workspaceIds));
      await db.delete(financeFeeStructures).where(inArray(financeFeeStructures.workspaceId, workspaceIds));
      await db.delete(financeFeeCategories).where(inArray(financeFeeCategories.workspaceId, workspaceIds));

      await db.delete(communicationDeliveries).where(inArray(communicationDeliveries.workspaceId, workspaceIds));
      await db.delete(communicationMessages).where(inArray(communicationMessages.workspaceId, workspaceIds));
      await db.delete(communicationTemplates).where(inArray(communicationTemplates.workspaceId, workspaceIds));
      await db.delete(announcements).where(inArray(announcements.workspaceId, workspaceIds));
      await db.delete(sisNotifications).where(inArray(sisNotifications.workspaceId, workspaceIds));
      await db.delete(portalUpdateRequests).where(inArray(portalUpdateRequests.workspaceId, workspaceIds));
      await db.delete(portalPolicies).where(inArray(portalPolicies.workspaceId, workspaceIds));

      await db.delete(attendanceRecords).where(inArray(attendanceRecords.workspaceId, workspaceIds));
      await db.delete(attendanceSessions).where(inArray(attendanceSessions.workspaceId, workspaceIds));
      await db.delete(timetableEntries).where(inArray(timetableEntries.workspaceId, workspaceIds));
      await db.delete(timePeriods).where(inArray(timePeriods.workspaceId, workspaceIds));
      await db.delete(schoolSchedules).where(inArray(schoolSchedules.workspaceId, workspaceIds));

      await db.delete(teachingAssignments).where(inArray(teachingAssignments.workspaceId, workspaceIds));
      await db.delete(classSubjects).where(inArray(classSubjects.workspaceId, workspaceIds));
      await db.delete(enrollments).where(inArray(enrollments.workspaceId, workspaceIds));
      await db.delete(studentGuardians).where(inArray(studentGuardians.studentId, db.select({ id: students.id }).from(students).where(inArray(students.workspaceId, workspaceIds))));
      await db.delete(guardians).where(inArray(guardians.workspaceId, workspaceIds));
      await db.delete(students).where(inArray(students.workspaceId, workspaceIds));

      await db.delete(sections).where(inArray(sections.workspaceId, workspaceIds));
      await db.delete(gradeLevels).where(inArray(gradeLevels.workspaceId, workspaceIds));
      await db.delete(academicTerms).where(inArray(academicTerms.workspaceId, workspaceIds));
      await db.delete(academicYears).where(inArray(academicYears.workspaceId, workspaceIds));

      await db.delete(staffMembers).where(inArray(staffMembers.workspaceId, workspaceIds));
      await db.delete(staffDepartments).where(inArray(staffDepartments.workspaceId, workspaceIds));
      await db.delete(subjects).where(inArray(subjects.workspaceId, workspaceIds));
      await db.delete(workspaceMemberships).where(inArray(workspaceMemberships.workspaceId, workspaceIds));
    }

    await db.delete(tenantDomains).where(inArray(tenantDomains.organizationId, orgIds));

    await db.delete(workspaces).where(inArray(workspaces.organizationId, orgIds));
    await db.delete(organizationModules).where(inArray(organizationModules.organizationId, orgIds));
    await db.delete(membershipRoles).where(inArray(membershipRoles.membershipId, db.select({ id: organizationMemberships.id }).from(organizationMemberships).where(inArray(organizationMemberships.organizationId, orgIds))));
    await db.delete(organizationMemberships).where(inArray(organizationMemberships.organizationId, orgIds));
    await db.delete(rolePermissions).where(inArray(rolePermissions.roleId, db.select({ id: roles.id }).from(roles).where(inArray(roles.organizationId, orgIds))));
    await db.delete(roles).where(inArray(roles.organizationId, orgIds));
    await db.delete(organizationSettings).where(inArray(organizationSettings.organizationId, orgIds));
    await db.delete(organizations).where(inArray(organizations.id, orgIds));
  }

  if (userIds.length > 0) {
    await db.delete(authSessions).where(inArray(authSessions.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }

  tracker.organizationIds.clear();
  tracker.userIds.clear();
}
