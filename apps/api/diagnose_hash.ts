import { loadConfig } from "./src/config/env.js";
import { createDatabaseClient } from "./src/database/client.js";
import { users } from "./src/database/schema.js";
import { eq, sql } from "drizzle-orm";

async function run() {
  const config = loadConfig(process.env);
  config.database.host = "127.0.0.1";
  config.database.port = 33063;
  config.database.password = "zaSbOexpzvdPmKCrKRvZwLsHVrKJmXGf";
  config.database.name = "railway";

  const dbClient = createDatabaseClient(config.database, console as any);

  try {
    const userRows = await dbClient.db.select({
        hash: users.passwordHash
    }).from(users).where(eq(users.email, "mussawarhussain@gmail.com")).limit(1);
    
    console.log("HASH PREFIX:");
    console.log(userRows[0].hash.substring(0, 20));
  } finally {
    await dbClient.close();
  }
}
run().catch(console.error);
