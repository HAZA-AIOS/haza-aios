import { sisRequest } from "./sis-api";
import type {
  SisAnalyticsActor,
  SisAnalyticsFilters,
  SisAnalyticsOverview,
  SisAnalyticsPermission,
  SisDataQualityIssue,
  SisHealthOverview,
  SisReportKind,
  SisReportResult,
} from "./sis.types";

const reportPermissions: Record<SisReportKind, SisAnalyticsPermission> = {
  student_directory: "student_reports.view",
  staff_directory: "staff_reports.view",
  attendance_summary: "attendance_reports.view",
  timetable_summary: "timetable_reports.view",
  results_summary: "results_reports.view",
  finance_collection: "finance_reports.view",
  communication_delivery: "communication_reports.view",
};
const managerRoles = new Set<SisAnalyticsActor["role"]>(["Owner", "Admin"]);
const accountantPermissions = new Set<SisAnalyticsPermission>([
  "analytics.view",
  "reports.view",
  "reports.export",
  "finance_reports.view",
  "data_quality.view",
  "sis_health.view",
]);
const teacherPermissions = new Set<SisAnalyticsPermission>([
  "analytics.view",
  "reports.view",
  "attendance_reports.view",
  "timetable_reports.view",
  "results_reports.view",
]);

function assertPermission(actor: SisAnalyticsActor | undefined, permission: SisAnalyticsPermission): void {
  if (!actor) return;
  if (managerRoles.has(actor.role)) return;
  if (actor.permissions?.includes(permission)) return;
  if (actor.role === "Accountant" && accountantPermissions.has(permission)) return;
  if (actor.role === "Teacher" && teacherPermissions.has(permission)) return;
  throw new Error(`Unauthorized: missing permission ${permission}`);
}

function query(filters: SisAnalyticsFilters = {}): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export class SisAnalyticsServiceClass {
  async getOverview(
    organizationId: string,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<SisAnalyticsOverview> {
    assertPermission(actor, "analytics.view");
    return (await sisRequest<{ overview: SisAnalyticsOverview }>(organizationId, `/analytics/overview${query(filters)}`)).overview;
  }

  async getReport(
    organizationId: string,
    kind: SisReportKind,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<SisReportResult> {
    assertPermission(actor, "reports.view");
    assertPermission(actor, reportPermissions[kind]);
    return (await sisRequest<{ report: SisReportResult }>(organizationId, `/reports/${kind}${query(filters)}`)).report;
  }

  async exportCsv(
    organizationId: string,
    kind: SisReportKind,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<string> {
    assertPermission(actor, "reports.export");
    return (await sisRequest<{ csv: string }>(organizationId, `/reports/${kind}/export${query(filters)}`)).csv;
  }

  async getDataQuality(
    organizationId: string,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<SisDataQualityIssue[]> {
    assertPermission(actor, "data_quality.view");
    return (await sisRequest<{ issues: SisDataQualityIssue[] }>(organizationId, `/analytics/data-quality${query(filters)}`)).issues;
  }

  async getHealth(
    organizationId: string,
    filters: SisAnalyticsFilters = {},
    actor?: SisAnalyticsActor,
  ): Promise<SisHealthOverview> {
    assertPermission(actor, "sis_health.view");
    return (await sisRequest<{ health: SisHealthOverview }>(organizationId, `/analytics/health${query(filters)}`)).health;
  }
}

export const SisAnalyticsService = new SisAnalyticsServiceClass();
