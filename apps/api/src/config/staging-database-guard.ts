import type { DatabaseConfig } from "./env.js";

const FORBIDDEN_PRODUCTION_DATABASES = new Set([
  "haza_aios",
  "production",
  "mysql",
  "haza-aios",
  "railway",
]);

const APPROVED_STAGING_DATABASE_PATTERNS = [/staging/i, /test/i];

export class StagingDatabaseGuardError extends Error {
  constructor(message: string) {
    super(`[StagingDatabaseGuard] FAILS CLOSED: ${message}`);
    this.name = "StagingDatabaseGuardError";
  }
}

export interface StagingGuardContext {
  appEnv?: string;
  requireStagingAuth?: boolean;
}

/**
 * Validates that database configuration points strictly to a dedicated staging or test database,
 * explicitly prohibiting connections to any production database or host.
 */
export function assertSafeStagingDatabaseConfig(
  target: DatabaseConfig | string | undefined,
  context?: StagingGuardContext,
): void {
  if (!target) {
    throw new StagingDatabaseGuardError("Database configuration is missing or undefined.");
  }

  let host: string;
  let port: number;
  let dbName: string;

  if (typeof target === "string") {
    const rawTarget = target.trim();
    if (!rawTarget) {
      throw new StagingDatabaseGuardError("Database connection URL is empty.");
    }
    try {
      const parsedUrl = new URL(rawTarget);
      host = parsedUrl.hostname;
      port = parsedUrl.port ? Number(parsedUrl.port) : 3306;
      dbName = parsedUrl.pathname.replace(/^\//, "");
    } catch {
      throw new StagingDatabaseGuardError("Invalid database connection URL format.");
    }
  } else {
    host = target.host;
    port = target.port;
    dbName = target.name;
  }

  if (port < 1 || port > 65535) {
    throw new StagingDatabaseGuardError("Invalid database port.");
  }

  if (!dbName || !dbName.trim()) {
    throw new StagingDatabaseGuardError("Database name is missing or empty.");
  }

  // 1. Decode URL encoding if present (prevent haza%5Faios bypass)
  let decodedDbName: string;
  try {
    decodedDbName = decodeURIComponent(dbName).trim().toLowerCase();
  } catch {
    decodedDbName = dbName.trim().toLowerCase();
  }

  // 2. Prohibit exact or substring production database names
  if (
    FORBIDDEN_PRODUCTION_DATABASES.has(decodedDbName) ||
    (decodedDbName.includes("haza_aios") &&
      !decodedDbName.includes("staging") &&
      !decodedDbName.includes("test"))
  ) {
    throw new StagingDatabaseGuardError(
      `Database name '${dbName}' is a forbidden production database name. Staging commands must NEVER target production.`,
    );
  }

  // 3. Require explicit staging or test naming convention
  const matchesApprovedStaging = APPROVED_STAGING_DATABASE_PATTERNS.some((pattern) =>
    pattern.test(decodedDbName),
  );

  if (!matchesApprovedStaging) {
    throw new StagingDatabaseGuardError(
      `Database name '${dbName}' does not match approved staging naming pattern (*staging* or *test*). Staging database must be explicitly designated.`,
    );
  }

  // 4. Prohibit known production host endpoints
  const normalizedHost = host.trim().toLowerCase();
  if (
    (normalizedHost.includes("production") && !normalizedHost.includes("staging")) ||
    normalizedHost === "mysql.railway.internal" ||
    normalizedHost === "mysql-production.railway.internal"
  ) {
    throw new StagingDatabaseGuardError(
      `Database host '${host}' appears to be a production endpoint. Staging commands must target dedicated staging infrastructure.`,
    );
  }

  // 5. Environment check
  const activeAppEnv = context?.appEnv ?? process.env.APP_ENV;
  if (activeAppEnv === "production") {
    throw new StagingDatabaseGuardError(
      "Conflicting environment: APP_ENV is 'production' while staging database guard was invoked.",
    );
  }

  // 6. Explicit staging script authorization check when required
  if (context?.requireStagingAuth) {
    const authFlag =
      process.env.STAGING_DATABASE_ALLOWED === "true" ||
      process.env.ALLOW_STAGING_MIGRATIONS === "true" ||
      process.env.ALLOW_STAGING_SEED === "true";
    if (!authFlag) {
      throw new StagingDatabaseGuardError(
        "Execution refused: STAGING_DATABASE_ALLOWED=true environment flag is required for staging operational scripts.",
      );
    }
  }
}
