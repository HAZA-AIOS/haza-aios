import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";
import { users, authSessions } from "../src/database/schema.js";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.js";
import request from "supertest";
import { EmailService } from "../src/modules/auth/services/email.service.js";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/common/logging/logger.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;

describeDatabase("Auth password recovery", () => {
  let db: DatabaseClient;
  let app: any;
  const testEmail = `test-recovery-${Date.now()}@example.com`;
  let capturedToken = "";

  beforeAll(async () => {
    const config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    });
    const logger = createLogger(config);
    db = createDatabaseClient(config.database, logger);
    
    app = createApp(config, logger, db);

    // Mock email service to capture token
    vi.spyOn(EmailService.prototype, 'sendPasswordReset').mockImplementation(async (input) => {
      const url = new URL(input.resetUrl);
      capturedToken = url.searchParams.get("token") || "";
      return true;
    });

    // Create test user
    await db.db.insert(users).values({
      id: `usr_${Date.now()}`,
      email: testEmail,
      normalizedEmail: testEmail.toUpperCase(),
      passwordHash: "dummyhash",
      firstName: "Test",
      lastName: "User",
      displayName: "Test User",
      isActive: true,
      tenantId: "t_core",
    });
  });

  afterAll(async () => {
    if (db) {
      const user = await db.db.query.users.findFirst({
        where: eq(users.email, testEmail)
      });
      if (user) {
        await db.db.delete(authSessions).where(eq(authSessions.userId, user.id));
        await db.db.delete(users).where(eq(users.id, user.id));
      }
      await db.close();
    }
    vi.restoreAllMocks();
  });

  test("Password Recovery Flow", async () => {
    // 1. Forgot Password
    const forgotRes = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: testEmail });
    
    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.message).toMatch(/reset link has been sent/);
    expect(capturedToken).toBeTruthy();

    // 2. Reset Password
    const newPassword = "NewStrongPassword123!";
    const resetRes = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: capturedToken, password: newPassword });
    
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toMatch(/Password updated/);

    // 3. Login with new password
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: testEmail, password: newPassword });
    
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user).toBeTruthy();

    // 4. Try to reset again with same token (should fail)
    const reuseRes = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: capturedToken, password: "AnotherPassword123!" });
    
    expect(reuseRes.status).toBe(400);
    expect(reuseRes.body.error.code).toBe("INVALID_RESET_TOKEN");
  }, 30000);
});
