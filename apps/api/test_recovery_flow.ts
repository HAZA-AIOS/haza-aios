import { DatabaseClient } from "./src/database/client";
import { users } from "./src/database/schema";
import { AuthService } from "./src/modules/auth/services/auth.service";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { scryptAsync } from "./src/modules/auth/services/auth.service";

async function run() {
  const db = new DatabaseClient({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "33061", 10),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "railway",
  });

  const authService = new AuthService(db, {
    resendApiKey: "",
    from: "test@haza-aios.com",
    appUrl: "http://localhost:3000"
  });

  const testEmail = `test-recovery-${Date.now()}@example.com`;
  
  try {
    console.log("1. Creating test user...");
    const salt = randomBytes(16).toString("hex");
    const hash = await scryptAsync("oldPassword123!", salt, 64);
    const passwordHash = `${salt}:${hash.toString("hex")}`;
    
    await db.db.insert(users).values({
      id: `usr_${Date.now()}`,
      email: testEmail,
      normalizedEmail: testEmail.toUpperCase(),
      passwordHash,
      firstName: "Test",
      lastName: "User",
      isActive: true,
      tenantId: "t_core", // Assuming a valid tenant, or we might need to bypass FK
    });
    console.log("User created: " + testEmail);

    console.log("2. Requesting forgot password...");
    // Mock the request to get rawToken or intercept stdout
    // Actually we can just call the service method
    const mockRequest = { headers: {} } as any;
    await authService.forgotPassword({ email: testEmail }, mockRequest);
    console.log("Forgot password requested.");

    console.log("3. Fetching token from DB...");
    const tokens = await db.db.query.passwordResetTokens.findMany({
      where: (t, { eq }) => eq(t.userId, (db.db.select({id: users.id}).from(users).where(eq(users.email, testEmail)))),
    });
    
    console.log("Tokens found:", tokens);
    // Wait, the raw token is not in DB. It's only the hash.
    // To test the E2E properly, I need to intercept the console.log from emailService or use the API.
    // Let's just create an API server instance and use supertest.

  } catch (e) {
    console.error(e);
  } finally {
    // cleanup
    await db.db.delete(users).where(eq(users.email, testEmail));
    process.exit(0);
  }
}

run();
