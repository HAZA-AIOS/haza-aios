import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  readMigrationFiles,
  type MigrationConfig,
  type MigrationMeta,
} from "drizzle-orm/migrator";

type DrizzleMigrationInternals = {
  dialect: {
    migrate(
      migrations: MigrationMeta[],
      session: unknown,
      config: MigrationConfig,
    ): Promise<void>;
  };
  session: unknown;
};

const unqualifiedTimestampUpdate =
  /(timestamp\((\d+)\)[^,\n]*\bON UPDATE CURRENT_TIMESTAMP)(?!\s*\()/giu;

export function reconcileMySql94TimestampPrecision(statement: string): string {
  return statement.replace(
    unqualifiedTimestampUpdate,
    (_match, expression: string, precision: string) => `${expression}(${precision})`,
  );
}

export async function migrate<TSchema extends Record<string, unknown>>(
  db: MySql2Database<TSchema>,
  config: MigrationConfig,
): Promise<void> {
  const migrations = readMigrationFiles(config).map((migration) => ({
    ...migration,
    sql: migration.sql.map(reconcileMySql94TimestampPrecision),
  }));
  const internals = db as unknown as DrizzleMigrationInternals;

  await internals.dialect.migrate(migrations, internals.session, config);
}
