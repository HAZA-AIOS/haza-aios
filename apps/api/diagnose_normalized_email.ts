import { loadConfig } from "./src/config/env.js";
import { createDatabaseClient } from "./src/database/client.js";
import { users } from "./src/database/schema.js";
import { eq, sql } from "drizzle-orm";

async function run() {
  const config = loadConfig(process.env);
  config.database.host = "127.0.0.1";
  config.database.port = 33063;
  config.database.password = "zaSbOexpzvdPmKCrKRvZwLsHVrKJmXGf";

  const dbClient = createDatabaseClient(config.database, console as any);

  try {
    const userRows = await dbClient.db.select({
        id: users.id, 
        email: users.email, 
        normalizedEmail: users.normalizedEmail, 
    }).from(users).where(eq(users.email, "mussawarhussain@gmail.com")).limit(1);
    
    console.log(JSON.stringify(userRows, null, 2));
  } finally {
    await dbClient.close();
  }
}
run().catch(console.error);
