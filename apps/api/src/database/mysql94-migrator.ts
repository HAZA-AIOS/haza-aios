import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  readMigrationFiles,
  type MigrationConfig,
} from "drizzle-orm/migrator";
import { sql } from "drizzle-orm";

const unqualifiedTimestampUpdate =
  /(timestamp\((\d+)\)[^,\n]*\bON UPDATE CURRENT_TIMESTAMP)(?!\s*\()/giu;

export function reconcileMySql94TimestampPrecision(statement: string): string {
  return statement.replace(
    unqualifiedTimestampUpdate,
    (_match, expression: string, precision: string) => `${expression}(${precision})`,
  );
}

export function isIdempotentDdlError(error: any): boolean {
  const code = error?.code || error?.cause?.code;
  const errno = error?.errno || error?.cause?.errno;
  const message = `${error?.message ?? ""} ${error?.cause?.message ?? ""}`.toLowerCase();

  const isDuplicateKey =
    code === "ER_DUP_KEYNAME" ||
    errno === 1061 ||
    message.includes("duplicate key name");

  const isTableExists =
    code === "ER_TABLE_EXISTS_ERROR" ||
    errno === 1050 ||
    message.includes("table") && message.includes("already exists");

  const isDuplicateConstraint =
    code === "ER_FK_FAIL_ADD_SYSTEM" ||
    errno === 1826 ||
    message.includes("duplicate foreign key constraint name");

  return Boolean(isDuplicateKey || isTableExists || isDuplicateConstraint);
}

export async function migrate<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema>,
  config: MigrationConfig,
): Promise<void> {
  const migrations = readMigrationFiles(config).map((migration) => ({
    ...migration,
    sql: migration.sql.map(reconcileMySql94TimestampPrecision),
  }));

  const migrationsTable = config.migrationsTable ?? "__drizzle_migrations";

  // 1. Ensure migrations tracking table exists
  await db.execute(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS \`${migrationsTable}\` (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      );
    `)
  );

  // 2. Fetch the latest applied migration timestamp
  const [rows] = (await db.execute(
    sql.raw(`SELECT id, hash, created_at FROM \`${migrationsTable}\` ORDER BY created_at DESC LIMIT 1;`)
  )) as unknown as [Array<{ id: number; hash: string; created_at: number | string }>];

  const lastDbMigration = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  const lastRunMillis = lastDbMigration ? Number(lastDbMigration.created_at) : 0;

  // 3. Process unapplied migrations sequentially
  for (const migration of migrations) {
    if (migration.folderMillis > lastRunMillis) {
      // Execute statements with non-transactional DDL idempotency & partial-recovery guard
      for (const statement of migration.sql) {
        const trimmed = statement.trim();
        if (!trimmed) continue;

        try {
          await db.execute(sql.raw(statement));
        } catch (error: any) {
          if (isIdempotentDdlError(error)) {
            // Object (table, index, or constraint) was already committed by an earlier interrupted migration run.
            // Safely skip statement to ensure non-destructive partial-migration recovery.
            continue;
          }
          // Any other error is fatal and stops the migration immediately
          throw error;
        }
      }

      // 4. Record migration completion with Drizzle's real computed hash and folderMillis
      await db.execute(
        sql.raw(
          `INSERT INTO \`${migrationsTable}\` (\`hash\`, \`created_at\`) VALUES ('${migration.hash}', ${migration.folderMillis});`
        )
      );
    }
  }
}
