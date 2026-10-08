import { loadConfig } from "C:/HAZA-APPS/HAZA-AIOS/apps/api/src/config/env.js";
import { createDatabaseClient } from "C:/HAZA-APPS/HAZA-AIOS/apps/api/src/database/client.js";
import { users } from "C:/HAZA-APPS/HAZA-AIOS/apps/api/src/database/schema.js";
import { sql } from "drizzle-orm";

async function run() {
  const config = loadConfig(process.env);
  // Override host/port to point to tunnel
  config.database.host = "127.0.0.1";
  config.database.port = 33063;

  const dbClient = createDatabaseClient(config.database, console as any);

  try {
    const allUsers = await dbClient.db.select({
        id: users.id, 
        email: users.email, 
        normalized: users.normalizedEmail, 
        status: users.status, 
        hashPrefix: sql`SUBSTRING(${users.passwordHash}, 1, 10)`,
        hashLength: sql`CHAR_LENGTH(${users.passwordHash})`
    }).from(users);
    
    console.log(JSON.stringify(allUsers, null, 2));
  } finally {
    await dbClient.close();
  }
}
run().catch(console.error);
