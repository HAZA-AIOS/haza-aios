import { describe, it, expect } from "vitest";
import {
  prepareStagingUsers,
  runStagingSeeder,
} from "../src/database/scripts/seed-staging.js";
import { STAGING_SYNTHETIC_USERS } from "../src/database/fixtures/staging-fixtures.js";
import { verifyPassword } from "../src/modules/auth/services/password.service.js";

describe("Staging Fixture Seeder (Dry-Run & Schema Compatibility)", () => {
  it("prepares all 9 synthetic users with schema-compatible fields and password hashes", async () => {
    const testPassword = "StagingSecretPassword2026!";
    const prepared = await prepareStagingUsers(STAGING_SYNTHETIC_USERS, testPassword);

    expect(prepared).toHaveLength(9);

    for (const user of prepared) {
      // 1. Mandatory schema fields
      expect(user.id).toBeDefined();
      expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(user.normalizedEmail).toBe(user.email.toLowerCase().trim());
      expect(user.firstName).toBeTruthy();
      expect(user.lastName).toBeTruthy();
      expect(user.displayName).toBeTruthy();
      expect(user.status).toBe("active");
      expect(user.emailVerified).toBe(true);

      // 2. Scrypt password hash verification
      expect(user.passwordHash).toMatch(/^scrypt\$/);
      const isPasswordValid = await verifyPassword(testPassword, user.passwordHash);
      expect(isPasswordValid).toBe(true);
    }
  });

  it("executes runStagingSeeder in dry-run mode without requiring database connection", async () => {
    const result = await runStagingSeeder({ dryRun: true });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.totalUsers).toBe(9);
    expect(result.totalOrganizations).toBe(2);
    expect(result.users).toHaveLength(9);
  });
});
