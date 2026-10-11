import type { DatabaseConfig } from "../../src/config/env.js";
import type { DatabaseClient } from "../../src/database/client.js";

const APPROVED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const APPROVED_DATABASES = new Set(["haza_aios_integration_test", "haza_aios_test"]);
const FORBIDDEN_HOST_PATTERNS = [/railway/i, /up\.railway/i, /proxy\.rlwy\.net/i];
const FORBIDDEN_DATABASE_PATTERNS = [/^haza_aios$/, /prod/i, /rehearsal/i, /stage19/i, /railway/i];
const FORBIDDEN_PORTS = new Set([33061]); // Known SSH tunnel port

export class TestDatabaseGuardError extends Error {
  constructor(message: string) {
    super(`[TestDatabaseGuard] FAILS CLOSED: ${message}`);
    this.name = "TestDatabaseGuardError";
  }
}

/**
 * Validates the configured environment and parameters before connecting.
 */
export function assertSafeDatabaseConfig(config: DatabaseConfig, nodeEnv: string | undefined): void {
  if (nodeEnv !== "test") {
    throw new TestDatabaseGuardError(`NODE_ENV must be explicitly set to 'test', but received '${nodeEnv}'.`);
  }

  if (!APPROVED_HOSTS.has(config.host)) {
    throw new TestDatabaseGuardError(
      `Database host '${config.host}' is not an approved loopback host (${Array.from(APPROVED_HOSTS).join(", ")}).`
    );
  }

  for (const pattern of FORBIDDEN_HOST_PATTERNS) {
    if (pattern.test(config.host)) {
      throw new TestDatabaseGuardError(`Database host '${config.host}' matches forbidden Railway/remote pattern.`);
    }
  }

  if (FORBIDDEN_PORTS.has(config.port)) {
    throw new TestDatabaseGuardError(
      `Port ${config.port} is a forbidden external SSH tunnel port. Local MySQL test runner must use direct local port (e.g. 3306).`
    );
  }

  if (!APPROVED_DATABASES.has(config.name)) {
    throw new TestDatabaseGuardError(
      `Database name '${config.name}' is not in approved test database list (${Array.from(APPROVED_DATABASES).join(", ")}).`
    );
  }

  for (const pattern of FORBIDDEN_DATABASE_PATTERNS) {
    if (pattern.test(config.name)) {
      throw new TestDatabaseGuardError(
        `Database name '${config.name}' matches forbidden production or rehearsal database pattern.`
      );
    }
  }
}

/**
 * Validates the actual connected database and server identity at runtime via live query.
 */
export async function assertSafeConnectedDatabase(database: DatabaseClient): Promise<{
  currentDatabase: string;
  serverHostname: string;
  currentUser: string;
}> {
  // Query actual MySQL identity
  const [rows] = await (database.db as any).session.client.query(
    "SELECT DATABASE() AS currentDatabase, @@hostname AS serverHostname, USER() AS currentUser"
  );

  const identity = (rows as Array<{ currentDatabase: string; serverHostname: string; currentUser: string }>)[0];

  if (!identity || !identity.currentDatabase) {
    throw new TestDatabaseGuardError("Could not determine currently selected database from active connection.");
  }

  if (!APPROVED_DATABASES.has(identity.currentDatabase)) {
    throw new TestDatabaseGuardError(
      `Connected MySQL database '${identity.currentDatabase}' is not an approved test database (${Array.from(APPROVED_DATABASES).join(", ")}). Aborting to prevent data corruption.`
    );
  }

  for (const pattern of FORBIDDEN_DATABASE_PATTERNS) {
    if (pattern.test(identity.currentDatabase)) {
      throw new TestDatabaseGuardError(
        `Connected MySQL database '${identity.currentDatabase}' matches forbidden production or rehearsal pattern!`
      );
    }
  }

  return identity;
}
