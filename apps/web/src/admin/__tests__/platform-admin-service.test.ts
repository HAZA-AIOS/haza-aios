import { describe, it, expect } from "vitest";
import { platformAdminService } from "../platform-admin-service";

describe("platformAdminService", () => {
  describe("getOverviewStats", () => {
    it("returns platform overview stats with expected shape", async () => {
      const stats = await platformAdminService.getOverviewStats();
      expect(stats.totalOrganizations).toBeGreaterThan(0);
      expect(stats.totalUsers).toBeGreaterThan(0);
      expect(stats.activeSessions).toBeGreaterThan(0);
      expect(stats.systemHealthPercent).toBeGreaterThan(0);
      expect(stats.orgChange).toBeDefined();
      expect(stats.userChange).toBeDefined();
    });
  });

  describe("getAllOrganizations", () => {
    it("returns at least 6 organizations", async () => {
      const orgs = await platformAdminService.getAllOrganizations();
      expect(orgs.length).toBeGreaterThanOrEqual(6);
    });

    it("returns organizations with expected fields", async () => {
      const orgs = await platformAdminService.getAllOrganizations();
      const org = orgs[0];
      expect(org.id).toBeDefined();
      expect(org.name).toBeDefined();
      expect(org.organizationType).toBeDefined();
      expect(org.ownerName).toBeDefined();
      expect(org.ownerEmail).toBeDefined();
      expect(org.memberCount).toBeGreaterThanOrEqual(0);
      expect(["active", "suspended"]).toContain(org.status);
    });
  });

  describe("getAllUsers", () => {
    it("returns at least 10 users", async () => {
      const users = await platformAdminService.getAllUsers();
      expect(users.length).toBeGreaterThanOrEqual(10);
    });

    it("returns users with expected fields", async () => {
      const users = await platformAdminService.getAllUsers();
      const user = users[0];
      expect(user.id).toBeDefined();
      expect(user.displayName).toBeDefined();
      expect(user.email).toBeDefined();
      expect(["super_admin", "support_agent", "viewer"]).toContain(user.platformRole);
    });
  });

  describe("getAuditLog", () => {
    it("returns sorted audit log entries", async () => {
      const log = await platformAdminService.getAuditLog();
      expect(log.length).toBeGreaterThan(0);
      // Verify sorted descending by timestamp
      for (let i = 1; i < log.length; i++) {
        expect(new Date(log[i - 1].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(log[i].timestamp).getTime(),
        );
      }
    });
  });

  describe("getSystemHealth", () => {
    it("returns system health metrics", async () => {
      const health = await platformAdminService.getSystemHealth();
      expect(health.length).toBeGreaterThan(0);
      const svc = health[0];
      expect(svc.name).toBeDefined();
      expect(["healthy", "degraded", "down"]).toContain(svc.status);
      expect(svc.latencyMs).toBeGreaterThanOrEqual(0);
      expect(svc.uptimePercent).toBeGreaterThan(0);
    });
  });

  describe("suspendOrganization / activateOrganization", () => {
    it("toggles organization status", async () => {
      const orgs = await platformAdminService.getAllOrganizations();
      const activeOrg = orgs.find((o) => o.status === "active");
      expect(activeOrg).toBeDefined();
      if (!activeOrg) return;

      const suspended = await platformAdminService.suspendOrganization(activeOrg.id);
      expect(suspended.status).toBe("suspended");

      const activated = await platformAdminService.activateOrganization(activeOrg.id);
      expect(activated.status).toBe("active");
    });
  });

  describe("deactivateUser / activateUser", () => {
    it("toggles user status", async () => {
      const users = await platformAdminService.getAllUsers();
      const activeUser = users.find(
        (u) => u.status === "active" && u.platformRole !== "super_admin",
      );
      expect(activeUser).toBeDefined();
      if (!activeUser) return;

      const deactivated = await platformAdminService.deactivateUser(activeUser.id);
      expect(deactivated.status).toBe("suspended");

      const activated = await platformAdminService.activateUser(activeUser.id);
      expect(activated.status).toBe("active");
    });
  });
});
