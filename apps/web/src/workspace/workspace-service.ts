import type { WorkspaceMember, WorkspaceModule, WorkspaceActivityLog } from "./workspace.types";
import type { Organization, OrganizationMembership } from "../org/org.types";
import { readStoredAuth } from "../auth/auth-storage";

const membershipsKey = "haza-aios.memberships";
const workspaceUsersKey = "haza-aios.workspace-users";
const modulesKeyPrefix = "haza-aios.workspace-modules.";
const logsKeyPrefix = "haza-aios.workspace-logs.";

// Seed default users for name/email resolution
const defaultUsers: Record<string, { name: string; email: string }> = {
  "mock-user-1": { name: "Hassan Ali", email: "hassan@mentorschool.edu" },
  "mock-user-2": { name: "Sarah Connor", email: "sarah@mentorschool.edu" },
  "mock-user-3": { name: "John Doe", email: "john@mentorschool.edu" },
  "mock-user-4": { name: "Jane Doe", email: "jane@mentorschool.edu" },
};

// Seed default memberships for the default organization "org-mentor-school"
const defaultMemberships: OrganizationMembership[] = [
  {
    id: "membership-1",
    organizationId: "org-mentor-school",
    userId: "mock-user-1",
    role: "Owner",
    status: "active",
    joinedAt: new Date("2026-06-15").toISOString(),
    createdAt: new Date("2026-06-15").toISOString(),
    updatedAt: new Date("2026-06-15").toISOString(),
  },
  {
    id: "membership-2",
    organizationId: "org-mentor-school",
    userId: "mock-user-2",
    role: "Admin",
    status: "active",
    joinedAt: new Date("2026-06-20").toISOString(),
    createdAt: new Date("2026-06-20").toISOString(),
    updatedAt: new Date("2026-06-20").toISOString(),
  },
  {
    id: "membership-3",
    organizationId: "org-mentor-school",
    userId: "mock-user-3",
    role: "Member",
    status: "active",
    joinedAt: new Date("2026-07-01").toISOString(),
    createdAt: new Date("2026-07-01").toISOString(),
    updatedAt: new Date("2026-07-01").toISOString(),
  },
  {
    id: "membership-4",
    organizationId: "org-mentor-school",
    userId: "mock-user-4",
    role: "Member",
    status: "pending",
    joinedAt: new Date("2026-08-05").toISOString(),
    createdAt: new Date("2026-08-05").toISOString(),
    updatedAt: new Date("2026-08-05").toISOString(),
  },
];

// Helper to access localStorage memberships safely
function getStoredMemberships(): OrganizationMembership[] {
  const data = localStorage.getItem(membershipsKey);
  if (!data) {
    const copy = JSON.parse(JSON.stringify(defaultMemberships));
    localStorage.setItem(membershipsKey, JSON.stringify(copy));
    return copy;
  }
  try {
    return JSON.parse(data);
  } catch {
    return defaultMemberships;
  }
}

function saveStoredMemberships(memberships: OrganizationMembership[]) {
  localStorage.setItem(membershipsKey, JSON.stringify(memberships));
}

// Helper to access workspace user profiles safely
function getStoredWorkspaceUsers(): Record<string, { name: string; email: string }> {
  const data = localStorage.getItem(workspaceUsersKey);
  if (!data) {
    return {};
  }
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function saveStoredWorkspaceUsers(users: Record<string, { name: string; email: string }>) {
  localStorage.setItem(workspaceUsersKey, JSON.stringify(users));
}

export class WorkspaceService {
  /**
   * Resets the localStorage state to seed data (useful for test suites)
   */
  static resetToDefaults() {
    localStorage.removeItem(membershipsKey);
    localStorage.removeItem(workspaceUsersKey);
    // Clear log and module keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith(modulesKeyPrefix) || key.startsWith(logsKeyPrefix))) {
        localStorage.removeItem(key);
        i--;
      }
    }
  }

  /**
   * Get all workspace members of a specific organization with user details mapped
   */
  async getMembers(orgId: string, filters?: { search?: string; role?: string }): Promise<WorkspaceMember[]> {
    const memberships = getStoredMemberships().filter((m) => m.organizationId === orgId);
    const storedUsers = getStoredWorkspaceUsers();
    const activeAuth = readStoredAuth();
    const currentUser = activeAuth?.user;

    const mappedMembers: WorkspaceMember[] = memberships.map((m) => {
      let details = defaultUsers[m.userId] || storedUsers[m.userId];
      
      // If user is currently logged in, use their dynamic session credentials
      if (currentUser && m.userId === currentUser.id) {
        details = {
          name: currentUser.displayName,
          email: currentUser.email,
        };
      }

      return {
        id: m.id,
        userId: m.userId,
        organizationId: m.organizationId,
        name: details?.name || "Invited User",
        email: details?.email || "pending-invite@haza-aios.com",
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
      };
    });

    // Apply filters
    return mappedMembers.filter((m) => {
      if (filters?.role && m.role !== filters.role) {
        return false;
      }
      if (filters?.search) {
        const query = filters.search.toLowerCase();
        return (
          m.name.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }

  /**
   * Invite a new member to the organization
   */
  async inviteMember(
    orgId: string,
    input: { name: string; email: string; role: "Owner" | "Admin" | "Member" }
  ): Promise<WorkspaceMember> {
    const memberships = getStoredMemberships();
    const storedUsers = getStoredWorkspaceUsers();

    // Check if user email is already in the organization
    const existingMembers = await this.getMembers(orgId);
    if (existingMembers.some((m) => m.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error(`User with email "${input.email}" is already a member of this organization.`);
    }

    const newUserId = `user-${Math.random().toString(36).substr(2, 9)}`;
    const newMembershipId = `mem-${Math.random().toString(36).substr(2, 9)}`;

    const newMembership: OrganizationMembership = {
      id: newMembershipId,
      organizationId: orgId,
      userId: newUserId,
      role: input.role,
      status: "pending",
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save membership
    memberships.push(newMembership);
    saveStoredMemberships(memberships);

    // Save user details
    storedUsers[newUserId] = {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
    };
    saveStoredWorkspaceUsers(storedUsers);

    // Add activity log
    await this.addActivityLog(orgId, {
      action: "Member Invited",
      actor: this.getCurrentActorName(),
      details: `Invited ${input.name} (${input.email}) as ${input.role}.`,
    });

    return {
      id: newMembershipId,
      userId: newUserId,
      organizationId: orgId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      status: "pending",
      joinedAt: newMembership.joinedAt,
    };
  }

  /**
   * Edit a member's role
   */
  async changeMemberRole(
    orgId: string,
    membershipId: string,
    newRole: "Owner" | "Admin" | "Member"
  ): Promise<WorkspaceMember> {
    const memberships = getStoredMemberships();
    const membershipIndex = memberships.findIndex(
      (m) => m.id === membershipId && m.organizationId === orgId
    );

    if (membershipIndex === -1) {
      throw new Error("Membership record not found.");
    }

    const oldRole = memberships[membershipIndex].role;
    memberships[membershipIndex].role = newRole;
    memberships[membershipIndex].updatedAt = new Date().toISOString();
    saveStoredMemberships(memberships);

    const members = await this.getMembers(orgId);
    const updatedMember = members.find((m) => m.id === membershipId);

    if (!updatedMember) {
      throw new Error("Failed to retrieve updated member record.");
    }

    // Add activity log
    await this.addActivityLog(orgId, {
      action: "Member Role Changed",
      actor: this.getCurrentActorName(),
      details: `Changed role of ${updatedMember.name} from ${oldRole} to ${newRole}.`,
    });

    return updatedMember;
  }

  /**
   * Remove a member from the organization
   */
  async removeMember(orgId: string, membershipId: string): Promise<void> {
    const memberships = getStoredMemberships();
    const membership = memberships.find(
      (m) => m.id === membershipId && m.organizationId === orgId
    );

    if (!membership) {
      throw new Error("Membership record not found.");
    }

    // Enforce safety: Do not delete the last Owner
    if (membership.role === "Owner") {
      const owners = memberships.filter(
        (m) => m.organizationId === orgId && m.role === "Owner"
      );
      if (owners.length <= 1) {
        throw new Error("Cannot remove the last owner of the organization.");
      }
    }

    const members = await this.getMembers(orgId);
    const targetMember = members.find((m) => m.id === membershipId);

    const updatedMemberships = memberships.filter((m) => m.id !== membershipId);
    saveStoredMemberships(updatedMemberships);

    if (targetMember) {
      // Add activity log
      await this.addActivityLog(orgId, {
        action: "Member Removed",
        actor: this.getCurrentActorName(),
        details: `Removed ${targetMember.name} from the organization.`,
      });
    }
  }

  /**
   * Get all modules for an organization
   */
  async getModules(orgId: string, orgType?: string): Promise<WorkspaceModule[]> {
    const key = `${modulesKeyPrefix}${orgId}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fall through to defaults
      }
    }

    // Seed defaults based on org type
    const defaultedModules: WorkspaceModule[] = [
      {
        id: "mod-sis",
        name: "School Information System",
        description: "Manage student admissions, academic records, scheduling, and grading pipelines.",
        industry: "Education",
        version: "1.0.2-alpha",
        status: (orgType === "School" || orgType === "University" || orgType === "College") ? "Active" : "Available",
        activationState: (orgType === "School" || orgType === "University" || orgType === "College") ? "active" : "inactive",
      },
      {
        id: "mod-hr",
        name: "HR & Talent Operations",
        description: "Employee directory, payroll configuration, attendance tracking, and performance checkins.",
        industry: "General",
        version: "2.4.0",
        status: "Active",
        activationState: "active",
      },
      {
        id: "mod-finance",
        name: "Financials & Invoicing",
        description: "Multi-currency invoicing, expense logging, vendor management, and general ledger reports.",
        industry: "General",
        version: "1.8.5",
        status: "Available",
        activationState: "inactive",
      },
      {
        id: "mod-ai",
        name: "Cognitive AI Workspace",
        description: "Autonomous multi-agent execution orchestrator, model selection router, and semantic analytics.",
        industry: "General",
        version: "0.9.1-beta",
        status: "Available",
        activationState: "inactive",
      },
      {
        id: "mod-patient",
        name: "Healthcare Patient Management",
        description: "HIPAA-compliant EHR ledger, appointment scheduling, and practitioner rosters.",
        industry: "Healthcare",
        version: "1.2.0",
        status: orgType === "Healthcare Organization" ? "Active" : "Available",
        activationState: orgType === "Healthcare Organization" ? "active" : "inactive",
      },
    ];

    localStorage.setItem(key, JSON.stringify(defaultedModules));
    return defaultedModules;
  }

  /**
   * Toggle organization activation of a module
   */
  async toggleModuleActivation(
    orgId: string,
    moduleId: string,
    activate: boolean
  ): Promise<WorkspaceModule[]> {
    const key = `${modulesKeyPrefix}${orgId}`;
    const modules = await this.getModules(orgId);
    
    const index = modules.findIndex((m) => m.id === moduleId);
    if (index === -1) {
      throw new Error("Module not found.");
    }

    modules[index].activationState = activate ? "active" : "inactive";
    modules[index].status = activate ? "Active" : "Available";
    
    localStorage.setItem(key, JSON.stringify(modules));

    // Add activity log
    await this.addActivityLog(orgId, {
      action: activate ? "Module Activated" : "Module Deactivated",
      actor: this.getCurrentActorName(),
      details: `${activate ? "Activated" : "Deactivated"} the ${modules[index].name} module.`,
    });

    return modules;
  }

  /**
   * Update active organization settings
   */
  async updateOrganizationSettings(orgId: string, updates: Partial<Organization>): Promise<Organization> {
    const orgsKey = "haza-aios.orgs";
    const data = localStorage.getItem(orgsKey);
    if (!data) throw new Error("Organizations store is empty.");
    
    const orgs: Organization[] = JSON.parse(data);
    const index = orgs.findIndex((o) => o.id === orgId);
    
    if (index === -1) {
      throw new Error("Organization not found.");
    }

    const updatedOrg: Organization = {
      ...orgs[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    orgs[index] = updatedOrg;
    localStorage.setItem(orgsKey, JSON.stringify(orgs));

    // Add activity log
    await this.addActivityLog(orgId, {
      action: "Settings Updated",
      actor: this.getCurrentActorName(),
      details: "Updated organization settings and localization preferences.",
    });

    return updatedOrg;
  }

  /**
   * Fetch recent activity logs for this organization
   */
  async getActivityLogs(orgId: string): Promise<WorkspaceActivityLog[]> {
    const key = `${logsKeyPrefix}${orgId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fall through
      }
    }

    // Default seeded activity logs
    const defaults: WorkspaceActivityLog[] = [
      {
        id: "log-1",
        organizationId: orgId,
        action: "Organization Settings Updated",
        actor: "Hassan Ali",
        details: "Updated localization preferences and default currency to USD.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
      },
      {
        id: "log-2",
        organizationId: orgId,
        action: "Module Activated",
        actor: "Hassan Ali",
        details: "Activated the HR & Talent Operations module.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
      },
      {
        id: "log-3",
        organizationId: orgId,
        action: "Member Invited",
        actor: "Hassan Ali",
        details: "Invited Sarah Connor (sarah@mentorschool.edu) as Admin.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
      },
    ];

    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }

  /**
   * Push a new activity log
   */
  async addActivityLog(
    orgId: string,
    log: { action: string; actor: string; details: string }
  ): Promise<void> {
    const key = `${logsKeyPrefix}${orgId}`;
    const logs = await this.getActivityLogs(orgId);
    
    const newEntry: WorkspaceActivityLog = {
      id: `log-${Math.random().toString(36).substr(2, 9)}`,
      organizationId: orgId,
      action: log.action,
      actor: log.actor,
      details: log.details,
      timestamp: new Date().toISOString(),
    };

    logs.unshift(newEntry); // Prepend new log
    localStorage.setItem(key, JSON.stringify(logs.slice(0, 50))); // Cap at 50 logs
  }

  // Helper to resolve the display name of the current user session
  private getCurrentActorName(): string {
    const activeAuth = readStoredAuth();
    return activeAuth?.user?.displayName || "System Operator";
  }
}

export const workspaceService = new WorkspaceService();
