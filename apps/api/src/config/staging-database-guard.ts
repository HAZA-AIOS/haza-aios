import type { DatabaseConfig } from "./env.js";

const FORBIDDEN_PRODUCTION_DATABASES = new Set(["haza_aios", "production", "mysql"]);
const APPROVED_STAGING_DATABASE_PATTERNS = [/staging/i, /test/i];

export class StagingDatabaseGuardError extends Error {
  constructor(message: string) {
    super(`[StagingDatabaseGuard] FAILS CLOSED: ${message}`);
    this.name = "StagingDatabaseGuardError";
  }
}

/**
 * Validates that database configuration points strictly to a staging or test database,
 * explicitly prohibiting connections to the production database.
 */
export function assertSafeStagingDatabaseConfig(config: DatabaseConfig): void {
  const dbName = config.name.trim().toLowerCase();

  // 1. Prohibit exact production database names
  if (FORBIDDEN_PRODUCTION_DATABASES.has(dbName)) {
    throw new StagingDatabaseGuardError(
      `Database name '${config.name}' is a forbidden production database name. Staging commands must NEVER target production.`
    );
  }

  // 2. Require explicit staging or test naming convention
  const matchesApprovedStaging = APPROVED_STAGING_DATABASE_PATTERNS.some((pattern) =>
    pattern.test(dbName)
  );

  if (!matchesApprovedStaging) {
    throw new StagingDatabaseGuardError(
      `Database name '${config.name}' does not match approved staging naming pattern (*staging*). Staging database must be explicitly designated.`
    );
  }

  // 3. Prohibit production host endpoints if explicitly targeting staging
  const host = config.host.trim().toLowerCase();
  if (host.includes("production") && !host.includes("staging")) {
    throw new StagingDatabaseGuardError(
      `Database host '${config.host}' appears to be a production endpoint. Staging commands must target dedicated staging infrastructure.`
    );
  }
}
