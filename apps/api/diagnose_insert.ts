import { loadConfig } from "./src/config/env.js";
import { createDatabaseClient } from "./src/database/client.js";
import { securityEvents } from "./src/database/schema.js";
import { randomUUID } from "node:crypto";

async function run() {
  const config = loadConfig(process.env);
  config.database.host = "127.0.0.1";
  config.database.port = 33063;

  const dbClient = createDatabaseClient(config.database, console as any);

  try {
    await dbClient.db.insert(securityEvents).values({
      id: randomUUID(),
      userId: undefined,
      organizationId: undefined,
      eventType: "login.failed",
      severity: "warning",
      ipAddress: undefined,
      userAgent: undefined,
      metadata: { email: "test@example.com" },
      createdAt: new Date(),
    });
    console.log("Insert with undefined succeeded!");
  } catch (error) {
    console.error("Insert with undefined failed:", error);
  } finally {
    await dbClient.close();
  }
}
run().catch(console.error);
