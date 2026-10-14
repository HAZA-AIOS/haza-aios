import { assertSafeStagingDatabaseConfig } from "../../config/staging-database-guard.js";
import { getStagingFixtureSummary } from "../fixtures/staging-fixtures.js";

/**
 * Validates staging environment configuration and fixture definitions locally.
 */
export function validateStagingArchitecture(): {
  success: boolean;
  fixtureSummary: ReturnType<typeof getStagingFixtureSummary>;
  guardRules: string[];
} {
  const fixtureSummary = getStagingFixtureSummary();

  const mockValidStagingConfig = {
    host: "mysql-staging.railway.internal",
    port: 3306,
    name: "haza_aios_staging",
    user: "haza_staging_user",
    password: "dummy_staging_password",
    connectionLimit: 5,
  };

  // Run guard validation on valid staging configuration
  assertSafeStagingDatabaseConfig(mockValidStagingConfig);

  // Validate that guard properly blocks forbidden production names
  let blockedProduction = false;
  try {
    assertSafeStagingDatabaseConfig({
      ...mockValidStagingConfig,
      name: "haza_aios",
    });
  } catch {
    blockedProduction = true;
  }

  if (!blockedProduction) {
    throw new Error("StagingDatabaseGuard failed to block production database name 'haza_aios'");
  }

  return {
    success: true,
    fixtureSummary,
    guardRules: [
      "Exact production database names blocked (haza_aios, production, mysql)",
      "Database name must match approved staging/test pattern (*staging*)",
      "Production host endpoints blocked from staging execution",
    ],
  };
}

if (process.argv[1]?.endsWith("staging-validate.ts") || process.argv[1]?.endsWith("staging-validate.js")) {
  const result = validateStagingArchitecture();
  console.log("Staging Architecture Validation Passed:", JSON.stringify(result, null, 2));
}
