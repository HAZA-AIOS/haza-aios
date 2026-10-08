import { loadConfig } from "./src/config/env.js";
import { createDatabaseClient } from "./src/database/client.js";
import { sql } from "drizzle-orm";

async function run() {
  const config = loadConfig(process.env);
  config.database.host = '127.0.0.1';
  config.database.port = 33063;
  config.database.password = 'zaSbOexpzvdPmKCrKRvZwLsHVrKJmXGf';
  config.database.name = 'railway';
  const db = createDatabaseClient(config.database, console as any);
  
  const res = await db.db.execute(sql`SELECT * FROM security_events WHERE event_type = 'login.failed' AND user_id IS NULL ORDER BY created_at DESC LIMIT 10`);
  console.log('NULL USER SECURITY EVENTS:');
  console.log(res[0]);
  
  await db.close();
}
run();
