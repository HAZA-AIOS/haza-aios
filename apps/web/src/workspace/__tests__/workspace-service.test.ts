import { describe, it, expect, beforeEach } from "vitest";
import { workspaceService } from "../workspace-service";

describe("WorkspaceService", () => {
  const orgId = "org-mentor-school";

  beforeEach(() => {
    // Reset workspace mock database state before each test
    localStorage.clear();
    workspaceService.constructor.prototype.constructor.resetToDefaults();
  });

  it("should retrieve default seeded members for org-mentor-school", async () => {
    const members = await workspaceService.getMembers(orgId);
    expect(members.length).toBe(4);
    
    // Verify Owner
    const owner = members.find((m) => m.role === "Owner");
    expect(owner).toBeDefined();
    expect(owner?.name).toBe("Hassan Ali");
    expect(owner?.email).toBe("hassan@mentorschool.edu");
    expect(owner?.status).toBe("active");
  });

  it("should filter members by role and search text", async () => {
    // Filter by role
    const admins = await workspaceService.getMembers(orgId, { role: "Admin" });
    expect(admins.length).toBe(1);
    expect(admins[0].name).toBe("Sarah Connor");

    // Filter by search string
    const searchDoe = await workspaceService.getMembers(orgId, { search: "Doe" });
    expect(searchDoe.length).toBe(2); // John Doe and Jane Doe
  });

  it("should invite a new member with pending status", async () => {
    const newMember = await workspaceService.inviteMember(orgId, {
      name: "Bruce Wayne",
      email: "bruce@wayne.com",
      role: "Member",
    });

    expect(newMember.name).toBe("Bruce Wayne");
    expect(newMember.email).toBe("bruce@wayne.com");
    expect(newMember.role).toBe("Member");
    expect(newMember.status).toBe("pending");

    const updatedList = await workspaceService.getMembers(orgId);
    expect(updatedList.length).toBe(5);
  });

  it("should fail to invite if email already exists in organization", async () => {
    await expect(
      workspaceService.inviteMember(orgId, {
        name: "Hassan Duplicate",
        email: "hassan@mentorschool.edu",
        role: "Member",
      })
    ).rejects.toThrow("is already a member of this organization.");
  });

  it("should change role of a member", async () => {
    const members = await workspaceService.getMembers(orgId);
    const member = members.find((m) => m.role === "Member" && m.status === "active")!;

    const updated = await workspaceService.changeMemberRole(orgId, member.id, "Admin");
    expect(updated.role).toBe("Admin");

    const list = await workspaceService.getMembers(orgId);
    const check = list.find((m) => m.id === member.id)!;
    expect(check.role).toBe("Admin");
  });

  it("should remove a member from organization", async () => {
    const members = await workspaceService.getMembers(orgId);
    const member = members.find((m) => m.role === "Member" && m.status === "active")!;

    await workspaceService.removeMember(orgId, member.id);

    const list = await workspaceService.getMembers(orgId);
    expect(list.length).toBe(3);
    expect(list.some((m) => m.id === member.id)).toBe(false);
  });

  it("should block removing the last Owner of organization", async () => {
    const members = await workspaceService.getMembers(orgId);
    const owner = members.find((m) => m.role === "Owner")!;

    await expect(workspaceService.removeMember(orgId, owner.id)).rejects.toThrow(
      "Cannot remove the last owner of the organization."
    );
  });

  it("should retrieve modules and load defaults according to organization type", async () => {
    // School type should default-activate SIS
    const schoolModules = await workspaceService.getModules(orgId, "School");
    const sis = schoolModules.find((m) => m.id === "mod-sis")!;
    expect(sis.activationState).toBe("active");
    expect(sis.status).toBe("Active");

    // Company type should have SIS available but inactive
    const companyModules = await workspaceService.getModules("org-company-1", "Company");
    const companySis = companyModules.find((m) => m.id === "mod-sis")!;
    expect(companySis.activationState).toBe("inactive");
    expect(companySis.status).toBe("Available");
  });

  it("should toggle module activation state", async () => {
    const list = await workspaceService.getModules(orgId, "Company");
    const target = list.find((m) => m.id === "mod-finance")!;
    expect(target.activationState).toBe("inactive");

    const updated = await workspaceService.toggleModuleActivation(orgId, "mod-finance", true);
    const updatedTarget = updated.find((m) => m.id === "mod-finance")!;
    expect(updatedTarget.activationState).toBe("active");
    expect(updatedTarget.status).toBe("Active");
  });
});
