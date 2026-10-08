import { test, expect, beforeAll, afterAll, vi } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client";
import { users } from "../src/database/schema";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app";
import request from "supertest";
import { EmailService } from "../src/modules/auth/services/email.service";
import { loadConfig } from "../src/config/env.js";
import { createLogger } from "../src/common/logging/logger.js";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

let db: DatabaseClient;
let app: any;
const testEmail = `test-recovery-${Date.now()}@example.com`;
let capturedToken = "";

beforeAll(async () => {
  const config = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    DATABASE_HOST: process.env.DATABASE_HOST || "127.0.0.1",
    DATABASE_PORT: process.env.DATABASE_PORT || "33061",
    DATABASE_USER: process.env.DATABASE_USER || "root",
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD || "KnJeTiCGKCcntWLWZXQfBudlGTXvpZze",
    DATABASE_NAME: process.env.DATABASE_NAME || "railway",
    TEST_DATABASE_NAME: process.env.DATABASE_NAME || "railway"
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
    tenantId: "t_core", // Assuming 't_core' exists
  });
});

import { authSessions } from "../src/database/schema";

afterAll(async () => {
  const user = await db.db.query.users.findFirst({
    where: eq(users.email, testEmail)
  });
  if (user) {
    await db.db.delete(authSessions).where(eq(authSessions.userId, user.id));
    await db.db.delete(users).where(eq(users.id, user.id));
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
  
  expect(reuseRes.status).toBe(400); // or whatever error code is used for INVALID_RESET_TOKEN
  expect(reuseRes.body.error.code).toBe("INVALID_RESET_TOKEN");
}, 30000); // 30 seconds timeout
