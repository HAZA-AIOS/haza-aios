import { loadConfig } from "./src/config/env.js";
import { createDatabaseClient } from "./src/database/client.js";
import { securityEvents } from "./src/database/schema.js";
import { sql } from "drizzle-orm";

async function run() {
  const config = loadConfig(process.env);
  config.database.host = "127.0.0.1";
  config.database.port = 33063;

  const dbClient = createDatabaseClient(config.database, console as any);

  try {
    const events = await dbClient.db
      .select()
      .from(securityEvents)
      .where(sql`JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.email')) = 'mussawarhussain@gmail.com'`)
      .orderBy(securityEvents.createdAt);

    console.log("Events count for mussawarhussain@gmail.com:", events.length);
    console.log(JSON.stringify(events, null, 2));
  } catch (error) {
    console.error("Failed to fetch events:", error);
  } finally {
    await dbClient.close();
  }
}

run().catch(console.error);
