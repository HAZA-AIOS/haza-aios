import { loadConfig } from "./src/config/env.js";
import { createDatabaseClient } from "./src/database/client.js";
import { AuthService } from "./src/modules/auth/services/auth.service.js";
import { securityEvents } from "./src/database/schema.js";
import { sql } from "drizzle-orm";

async function run() {
  const config = loadConfig(process.env);
  config.database.host = "127.0.0.1";
  config.database.port = 33063;
  config.database.password = "zaSbOexpzvdPmKCrKRvZwLsHVrKJmXGf";
  config.database.name = "railway";

  const dbClient = createDatabaseClient(config.database, console as any);
  const authService = new AuthService(dbClient);

  try {
    const eventsBefore = await dbClient.db.select().from(securityEvents).where(sql`JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.email')) = 'mussawarhussain@gmail.com'`);
    console.log("EVENTS BEFORE:", eventsBefore.length);

    const mockRequest = {
      headers: { "user-agent": "test-agent" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    
    try {
      await authService.login({
        email: "mussawarhussain@gmail.com",
        password: "wrongpassword123",
        rememberMe: false
      }, mockRequest);
    } catch (e) {
      console.log("CAUGHT API ERROR:", (e as any).message);
    }

    const eventsAfter = await dbClient.db.select().from(securityEvents).where(sql`JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.email')) = 'mussawarhussain@gmail.com'`);
    console.log("EVENTS AFTER:", eventsAfter.length);
  } finally {
    await dbClient.close();
  }
}
run().catch(console.error);
