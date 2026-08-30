/**
 * Platform Administration types.
 *
 * These types model the platform-level administrative concepts
 * (as opposed to organization-level types in org.types.ts).
 */

/** Platform-wide roles for super-admin access control. */
export type PlatformRole = "super_admin" | "support_agent" | "viewer";

/** Extended user type with platform-level metadata. */
export interface PlatformUser {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  status: "active" | "suspended" | "invited";
  platformRole: PlatformRole;
  organizationCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Platform-level organization summary for admin views. */
export interface PlatformOrganization {
  id: string;
  name: string;
  organizationType: string;
  industry: string;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
  status: "active" | "suspended";
  country: string;
  createdAt: string;
}

/** System-wide audit log entry. */
export interface AuditLogEntry {
  id: string;
  action: string;
  actionType: "create" | "update" | "delete" | "login" | "system";
  actor: string;
  actorEmail: string;
  target: string;
  targetType: "organization" | "user" | "system" | "session";
  details: string;
  timestamp: string;
}

/** Individual service health metric. */
export interface SystemHealthMetric {
  id: string;
  name: string;
  status: "healthy" | "degraded" | "down";
  latencyMs: number;
  uptimePercent: number;
  lastChecked: string;
  description: string;
}

/** Platform overview KPIs. */
export interface PlatformOverviewStats {
  totalOrganizations: number;
  totalUsers: number;
  activeSessions: number;
  systemHealthPercent: number;
  orgChange: string;
  userChange: string;
  sessionChange: string;
  healthChange: string;
}
