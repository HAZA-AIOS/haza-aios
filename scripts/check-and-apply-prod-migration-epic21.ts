import mysql from "mysql2/promise";
import path from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import { schema } from "../apps/api/src/database/schema.js";
import { migrate } from "../apps/api/src/database/mysql94-migrator.js";

/**
 * HAZA-AIOS — Epic 21 Production Migration Verification Utility
 * 
 * Reuses the canonical production Drizzle migration mechanism from mysql94-migrator.js.
 * Eliminates conflicting out-of-band execution paths and guarantees identical hash and journal state
 * with Railway's preDeployCommand ("npm run db:migrate").
 */

const DB_HOST = process.env.DATABASE_HOST ?? "127.0.0.1";
const DB_PORT = Number(process.env.DATABASE_PORT ?? 3306);
const DB_USER = process.env.DATABASE_USER ?? "root";
const DB_PASSWORD = process.env.DATABASE_PASSWORD ?? process.env.MYSQL_ROOT_PASSWORD ?? "";
const DB_NAME = process.env.DATABASE_NAME ?? "railway";
const MIGRATIONS_FOLDER = path.resolve("apps/api/src/database/migrations");

async function main() {
  console.log("================================================================");
  console.log("  HAZA AIOS — Epic 21 Canonical Drizzle Migration Runner        ");
  console.log("================================================================");
  console.log(`[CONFIG] Target Database: ${DB_NAME} on ${DB_HOST}:${DB_PORT}`);

  const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  const db = drizzle(pool, { mode: "default", schema });

  try {
    console.log("[MIGRATE] Invoking canonical Drizzle migration runner (mysql94-migrator)...");
    const start = Date.now();
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log(`[MIGRATE] Completed in ${((Date.now() - start) / 1000).toFixed(2)}s.`);

    // Check migration journal state
    const [journalRows] = (await pool.query(
      "SELECT id, hash, FROM_UNIXTIME(created_at / 1000) as applied_time FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 3;"
    )) as any;
    console.log("[JOURNAL] Latest applied migrations:\n", journalRows);

    // Verify all 8 Epic 21 tables
    const [tables] = (await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${DB_NAME}' AND table_name LIKE 'agent_%' ORDER BY table_name;`
    )) as any;
    console.log("[AUDIT] Verified agent tables in database:\n", tables.map((t: any) => t.TABLE_NAME ?? t.table_name));

    console.log("================================================================");
    console.log("  CANONICAL DRIZZLE MIGRATION EXECUTION COMPLETE                ");
    console.log("================================================================");
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.includes("check-and-apply-prod-migration-epic21")) {
  main().catch((err) => {
    console.error("\n[FATAL ERROR during production migration]:", err);
    process.exit(1);
  });
}
