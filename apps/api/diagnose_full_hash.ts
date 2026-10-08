import { loadConfig } from "./src/config/env.js";
import { createDatabaseClient } from "./src/database/client.js";
import { users } from "./src/database/schema.js";
import { eq } from "drizzle-orm";

async function run() {
  const config = loadConfig(process.env);
  config.database.host = '127.0.0.1';
  config.database.port = 33063;
  config.database.password = 'zaSbOexpzvdPmKCrKRvZwLsHVrKJmXGf';
  config.database.name = 'railway';
  const db = createDatabaseClient(config.database, console as any);
  
  const row = await db.db.select().from(users).where(eq(users.email, 'mussawarhussain@gmail.com'));
  console.log('FULL HASH:', row[0].passwordHash);
  
  await db.close();
}
run();
