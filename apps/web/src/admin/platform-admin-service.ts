/**
 * Mock Platform Administration Service.
 *
 * Provides hardcoded sample data for all platform admin views.
 * Follows the same async delay pattern as auth-service.ts.
 * Replace with real API calls when connecting to a backend.
 */
import type {
  AuditLogEntry,
  PlatformOrganization,
  PlatformOverviewStats,
  PlatformUser,
  SystemHealthMetric,
} from "./platform-admin.types";

const delayMs = 300;
function wait() {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

/* ─────────── Mock Data ─────────── */

const mockOrganizations: PlatformOrganization[] = [
  {
    id: "org-1",
    name: "The Mentor School",
    organizationType: "School",
    industry: "Education",
    ownerName: "Hassan Ali",
    ownerEmail: "hassan@mentorschool.edu",
    memberCount: 42,
    status: "active",
    country: "Pakistan",
    createdAt: "2026-06-15T10:30:00Z",
  },
  {
    id: "org-2",
    name: "Acme Academy",
    organizationType: "School",
    industry: "Education",
    ownerName: "Jane Smith",
    ownerEmail: "jane@acmeacademy.edu",
    memberCount: 128,
    status: "active",
    country: "United States",
    createdAt: "2026-07-02T14:00:00Z",
  },
  {
    id: "org-3",
    name: "Global University",
    organizationType: "University",
    industry: "Higher Education",
    ownerName: "Dr. Robert Chen",
    ownerEmail: "rchen@globaluni.ac.uk",
    memberCount: 312,
    status: "active",
    country: "United Kingdom",
    createdAt: "2026-07-10T09:15:00Z",
  },
  {
    id: "org-4",
    name: "MedCare Hospital",
    organizationType: "Healthcare Organization",
    industry: "Healthcare",
    ownerName: "Dr. Sarah Johnson",
    ownerEmail: "sarah@medcare.com",
    memberCount: 85,
    status: "active",
    country: "Canada",
    createdAt: "2026-07-20T11:45:00Z",
  },
  {
    id: "org-5",
    name: "TechVentures Inc.",
    organizationType: "Company",
    industry: "Technology",
    ownerName: "Michael Lee",
    ownerEmail: "michael@techventures.io",
    memberCount: 23,
    status: "suspended",
    country: "United States",
    createdAt: "2026-08-01T16:30:00Z",
  },
  {
    id: "org-6",
    name: "Green Earth Foundation",
    organizationType: "Non-Profit",
    industry: "Environmental",
    ownerName: "Aisha Patel",
    ownerEmail: "aisha@greenearth.org",
    memberCount: 15,
    status: "active",
    country: "India",
    createdAt: "2026-08-05T08:00:00Z",
  },
  {
    id: "org-7",
    name: "City Planning Bureau",
    organizationType: "Government Organization",
    industry: "Government",
    ownerName: "Omar Khalid",
    ownerEmail: "omar@cpb.gov.pk",
    memberCount: 67,
    status: "active",
    country: "Pakistan",
    createdAt: "2026-08-08T13:20:00Z",
  },
];

const mockUsers: PlatformUser[] = [
  {
    id: "user-1",
    firstName: "Hassan",
    lastName: "Ali",
    displayName: "Hassan Ali",
    email: "hassan@mentorschool.edu",
    emailVerified: true,
    status: "active",
    platformRole: "super_admin",
    organizationCount: 2,
    lastLoginAt: "2026-08-12T06:30:00Z",
    createdAt: "2026-06-15T10:00:00Z",
  },
  {
    id: "user-2",
    firstName: "Jane",
    lastName: "Smith",
    displayName: "Jane Smith",
    email: "jane@acmeacademy.edu",
    emailVerified: true,
    status: "active",
    platformRole: "viewer",
    organizationCount: 1,
    lastLoginAt: "2026-08-11T22:15:00Z",
    createdAt: "2026-07-02T14:00:00Z",
  },
  {
    id: "user-3",
    firstName: "Robert",
    lastName: "Chen",
    displayName: "Dr. Robert Chen",
    email: "rchen@globaluni.ac.uk",
    emailVerified: true,
    status: "active",
    platformRole: "viewer",
    organizationCount: 1,
    lastLoginAt: "2026-08-12T02:00:00Z",
    createdAt: "2026-07-10T09:00:00Z",
  },
  {
    id: "user-4",
    firstName: "Sarah",
    lastName: "Johnson",
    displayName: "Dr. Sarah Johnson",
    email: "sarah@medcare.com",
    emailVerified: true,
    status: "active",
    platformRole: "viewer",
    organizationCount: 1,
    lastLoginAt: "2026-08-10T18:45:00Z",
    createdAt: "2026-07-20T11:00:00Z",
  },
  {
    id: "user-5",
    firstName: "Michael",
    lastName: "Lee",
    displayName: "Michael Lee",
    email: "michael@techventures.io",
    emailVerified: true,
    status: "suspended",
    platformRole: "viewer",
    organizationCount: 1,
    lastLoginAt: "2026-08-01T20:00:00Z",
    createdAt: "2026-08-01T16:00:00Z",
  },
  {
    id: "user-6",
    firstName: "Aisha",
    lastName: "Patel",
    displayName: "Aisha Patel",
    email: "aisha@greenearth.org",
    emailVerified: true,
    status: "active",
    platformRole: "viewer",
    organizationCount: 1,
    lastLoginAt: "2026-08-11T10:30:00Z",
    createdAt: "2026-08-05T08:00:00Z",
  },
  {
    id: "user-7",
    firstName: "Omar",
    lastName: "Khalid",
    displayName: "Omar Khalid",
    email: "omar@cpb.gov.pk",
    emailVerified: true,
    status: "active",
    platformRole: "support_agent",
    organizationCount: 1,
    lastLoginAt: "2026-08-12T07:00:00Z",
    createdAt: "2026-08-08T13:00:00Z",
  },
  {
    id: "user-8",
    firstName: "Emily",
    lastName: "Wang",
    displayName: "Emily Wang",
    email: "emily.wang@globaluni.ac.uk",
    emailVerified: true,
    status: "active",
    platformRole: "viewer",
    organizationCount: 2,
    lastLoginAt: "2026-08-11T15:20:00Z",
    createdAt: "2026-07-15T09:00:00Z",
  },
  {
    id: "user-9",
    firstName: "Ahmed",
    lastName: "Khan",
    displayName: "Ahmed Khan",
    email: "ahmed.khan@mentorschool.edu",
    emailVerified: false,
    status: "invited",
    platformRole: "viewer",
    organizationCount: 1,
    lastLoginAt: null,
    createdAt: "2026-08-10T12:00:00Z",
  },
  {
    id: "user-10",
    firstName: "Lisa",
    lastName: "Martinez",
    displayName: "Lisa Martinez",
    email: "lisa@medcare.com",
    emailVerified: true,
    status: "active",
    platformRole: "viewer",
    organizationCount: 1,
    lastLoginAt: "2026-08-12T04:00:00Z",
    createdAt: "2026-07-25T14:00:00Z",
  },
  {
    id: "user-11",
    firstName: "David",
    lastName: "Thompson",
    displayName: "David Thompson",
    email: "david.t@acmeacademy.edu",
    emailVerified: true,
    status: "active",
    platformRole: "viewer",
    organizationCount: 1,
    lastLoginAt: "2026-08-11T19:00:00Z",
    createdAt: "2026-07-08T10:00:00Z",
  },
];

const mockAuditLog: AuditLogEntry[] = [
  {
    id: "audit-1",
    action: "Organization Created",
    actionType: "create",
    actor: "Hassan Ali",
    actorEmail: "hassan@mentorschool.edu",
    target: "The Mentor School",
    targetType: "organization",
    details: "New organization registered with School type.",
    timestamp: "2026-08-12T06:45:00Z",
  },
  {
    id: "audit-2",
    action: "User Login",
    actionType: "login",
    actor: "Jane Smith",
    actorEmail: "jane@acmeacademy.edu",
    target: "Session #3847",
    targetType: "session",
    details: "Successful login from 192.168.1.100.",
    timestamp: "2026-08-11T22:15:00Z",
  },
  {
    id: "audit-3",
    action: "Organization Suspended",
    actionType: "update",
    actor: "Hassan Ali",
    actorEmail: "hassan@mentorschool.edu",
    target: "TechVentures Inc.",
    targetType: "organization",
    details: "Organization suspended due to billing non-compliance.",
    timestamp: "2026-08-11T20:30:00Z",
  },
  {
    id: "audit-4",
    action: "User Invited",
    actionType: "create",
    actor: "Hassan Ali",
    actorEmail: "hassan@mentorschool.edu",
    target: "Ahmed Khan",
    targetType: "user",
    details: "Invitation sent to ahmed.khan@mentorschool.edu.",
    timestamp: "2026-08-10T12:00:00Z",
  },
  {
    id: "audit-5",
    action: "System Health Check",
    actionType: "system",
    actor: "System",
    actorEmail: "system@haza-aios.ai",
    target: "AI Engine",
    targetType: "system",
    details: "Automated health check completed. All services operational.",
    timestamp: "2026-08-12T07:00:00Z",
  },
  {
    id: "audit-6",
    action: "User Role Updated",
    actionType: "update",
    actor: "Hassan Ali",
    actorEmail: "hassan@mentorschool.edu",
    target: "Omar Khalid",
    targetType: "user",
    details: "Platform role changed from viewer to support_agent.",
    timestamp: "2026-08-09T14:30:00Z",
  },
  {
    id: "audit-7",
    action: "Organization Created",
    actionType: "create",
    actor: "Aisha Patel",
    actorEmail: "aisha@greenearth.org",
    target: "Green Earth Foundation",
    targetType: "organization",
    details: "New organization registered with Non-Profit type.",
    timestamp: "2026-08-05T08:00:00Z",
  },
  {
    id: "audit-8",
    action: "User Deactivated",
    actionType: "update",
    actor: "Hassan Ali",
    actorEmail: "hassan@mentorschool.edu",
    target: "Michael Lee",
    targetType: "user",
    details: "User suspended following organization suspension.",
    timestamp: "2026-08-02T10:00:00Z",
  },
  {
    id: "audit-9",
    action: "Configuration Updated",
    actionType: "update",
    actor: "System",
    actorEmail: "system@haza-aios.ai",
    target: "Platform Settings",
    targetType: "system",
    details: "AI Agent execution concurrency limit updated to 50.",
    timestamp: "2026-08-08T09:00:00Z",
  },
  {
    id: "audit-10",
    action: "User Login",
    actionType: "login",
    actor: "Dr. Robert Chen",
    actorEmail: "rchen@globaluni.ac.uk",
    target: "Session #4102",
    targetType: "session",
    details: "Successful login from 10.0.0.55.",
    timestamp: "2026-08-12T02:00:00Z",
  },
  {
    id: "audit-11",
    action: "Organization Updated",
    actionType: "update",
    actor: "Dr. Sarah Johnson",
    actorEmail: "sarah@medcare.com",
    target: "MedCare Hospital",
    targetType: "organization",
    details: "Organization timezone changed to America/Toronto.",
    timestamp: "2026-08-07T16:00:00Z",
  },
  {
    id: "audit-12",
    action: "User Login",
    actionType: "login",
    actor: "Hassan Ali",
    actorEmail: "hassan@mentorschool.edu",
    target: "Session #4201",
    targetType: "session",
    details: "Successful login from 103.244.1.22.",
    timestamp: "2026-08-12T06:30:00Z",
  },
];

const mockSystemHealth: SystemHealthMetric[] = [
  {
    id: "svc-1",
    name: "API Server",
    status: "healthy",
    latencyMs: 12,
    uptimePercent: 99.99,
    lastChecked: "2026-08-12T07:00:00Z",
    description: "Primary REST API gateway handling all client requests.",
  },
  {
    id: "svc-2",
    name: "PostgreSQL Database",
    status: "healthy",
    latencyMs: 3,
    uptimePercent: 99.99,
    lastChecked: "2026-08-12T07:00:00Z",
    description: "Primary relational data store for tenants, users, and config.",
  },
  {
    id: "svc-3",
    name: "Queue Worker",
    status: "healthy",
    latencyMs: 28,
    uptimePercent: 99.95,
    lastChecked: "2026-08-12T07:00:00Z",
    description: "Background job processing for async operations and notifications.",
  },
  {
    id: "svc-4",
    name: "Object Storage",
    status: "healthy",
    latencyMs: 45,
    uptimePercent: 99.98,
    lastChecked: "2026-08-12T07:00:00Z",
    description: "S3-compatible blob storage for documents, images, and assets.",
  },
  {
    id: "svc-5",
    name: "AI Execution Engine",
    status: "degraded",
    latencyMs: 350,
    uptimePercent: 98.50,
    lastChecked: "2026-08-12T07:00:00Z",
    description: "LLM orchestration and cognitive agent execution runtime.",
  },
  {
    id: "svc-6",
    name: "Email Service",
    status: "healthy",
    latencyMs: 120,
    uptimePercent: 99.90,
    lastChecked: "2026-08-12T07:00:00Z",
    description: "Transactional email delivery for notifications and verifications.",
  },
];

/* ─────────── Service Methods ─────────── */

export const platformAdminService = {
  async getOverviewStats(): Promise<PlatformOverviewStats> {
    await wait();
    const activeOrgs = mockOrganizations.filter((o) => o.status === "active").length;
    const activeUsers = mockUsers.filter((u) => u.status === "active").length;
    const healthyServices = mockSystemHealth.filter((s) => s.status === "healthy").length;
    const healthPercent = Math.round((healthyServices / mockSystemHealth.length) * 100 * 100) / 100;

    return {
      totalOrganizations: mockOrganizations.length,
      totalUsers: mockUsers.length,
      activeSessions: Math.min(activeUsers, 8),
      systemHealthPercent: healthPercent,
      orgChange: `+${activeOrgs} active`,
      userChange: `+${activeUsers} active`,
      sessionChange: "+3 today",
      healthChange: `${healthyServices}/${mockSystemHealth.length} healthy`,
    };
  },

  async getAllOrganizations(): Promise<PlatformOrganization[]> {
    await wait();
    return [...mockOrganizations];
  },

  async getAllUsers(): Promise<PlatformUser[]> {
    await wait();
    return [...mockUsers];
  },

  async getAuditLog(): Promise<AuditLogEntry[]> {
    await wait();
    return [...mockAuditLog].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  },

  async getSystemHealth(): Promise<SystemHealthMetric[]> {
    await wait();
    return [...mockSystemHealth];
  },

  async suspendOrganization(id: string): Promise<PlatformOrganization> {
    await wait();
    const org = mockOrganizations.find((o) => o.id === id);
    if (!org) throw new Error("Organization not found.");
    org.status = "suspended";
    return { ...org };
  },

  async activateOrganization(id: string): Promise<PlatformOrganization> {
    await wait();
    const org = mockOrganizations.find((o) => o.id === id);
    if (!org) throw new Error("Organization not found.");
    org.status = "active";
    return { ...org };
  },

  async deactivateUser(id: string): Promise<PlatformUser> {
    await wait();
    const user = mockUsers.find((u) => u.id === id);
    if (!user) throw new Error("User not found.");
    user.status = "suspended";
    return { ...user };
  },

  async activateUser(id: string): Promise<PlatformUser> {
    await wait();
    const user = mockUsers.find((u) => u.id === id);
    if (!user) throw new Error("User not found.");
    user.status = "active";
    return { ...user };
  },
};
