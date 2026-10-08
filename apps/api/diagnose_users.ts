import { loadConfig } from "./src/config/env.js";
import { createDatabaseClient } from "./src/database/client.js";
import { users } from "./src/database/schema.js";

async function run() {
  const config = loadConfig(process.env);
  config.database.host = '127.0.0.1';
  config.database.port = 33063;
  config.database.password = 'zaSbOexpzvdPmKCrKRvZwLsHVrKJmXGf';
  config.database.name = 'railway';
  const db = createDatabaseClient(config.database, console as any);
  
  const row = await db.db.select().from(users);
  console.log('USERS:', row.map(r => r.email));
  
  await db.close();
}
run();
