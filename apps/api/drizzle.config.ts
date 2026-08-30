import { defineConfig } from "drizzle-kit";
import { loadConfig } from "./src/config/env.js";

const config = loadConfig(process.env);

export default defineConfig({
  dialect: "mysql",
  schema: "./src/database/schema.ts",
  out: "./src/database/migrations",
  dbCredentials: {
    host: config.database.host,
    port: config.database.port,
    database: config.database.name,
    user: config.database.user,
    password: config.database.password,
  },
  strict: true,
  verbose: true,
});
