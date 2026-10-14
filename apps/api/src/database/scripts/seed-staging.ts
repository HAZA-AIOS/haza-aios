import { createLogger } from "../../common/logging/logger.js";
import { loadConfig } from "../../config/env.js";
import { assertSafeStagingDatabaseConfig } from "../../config/staging-database-guard.js";
import { hashPassword } from "../../modules/auth/services/password.service.js";
import { createDatabaseClient } from "../client.js";
import {
  STAGING_SYNTHETIC_ORGANIZATIONS,
  STAGING_SYNTHETIC_USERS,
  type SyntheticStagingUser,
} from "../fixtures/staging-fixtures.js";
import { organizations, users } from "../schema.js";

/**
 * HAZA AIOS — Dedicated Schema-Compatible Staging Fixture Seeder
 * 
 * Safety Rules:
 * 1. Must run with APP_ENV=staging (or in dry-run mode).
 * 2. Requires STAGING_DATABASE_ALLOWED=true when connecting live.
 * 3. Never writes to production database.
 * 4. Supports --dry-run for offline verification and testing.
 */

export interface PreparedStagingUser {
  id: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  displayName: string;
  emailVerified: boolean;
  status: "active";
}

export async function prepareStagingUsers(
  syntheticUsers: Record<string, SyntheticStagingUser>,
  fixturePassword = "StagingSecret2026!",
): Promise<PreparedStagingUser[]> {
  const prepared: PreparedStagingUser[] = [];

  for (const user of Object.values(syntheticUsers)) {
    const passwordHash = await hashPassword(fixturePassword);
    prepared.push({
      id: user.id,
      email: user.email,
      normalizedEmail: user.email.trim().toLowerCase(),
      passwordHash,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      emailVerified: true,
      status: "active",
    });
  }

  return prepared;
}

export async function runStagingSeeder(options?: {
  dryRun?: boolean;
  fixturePassword?: string;
}): Promise<{
  success: boolean;
  dryRun: boolean;
  totalUsers: number;
  totalOrganizations: number;
  users: PreparedStagingUser[];
}> {
  const isDryRun =
    options?.dryRun ??
    (process.argv.includes("--dry-run") || process.env.DRY_RUN === "true");

  const preparedUsers = await prepareStagingUsers(
    STAGING_SYNTHETIC_USERS,
    options?.fixturePassword,
  );

  const orgList = Object.values(STAGING_SYNTHETIC_ORGANIZATIONS);

  if (isDryRun) {
    return {
      success: true,
      dryRun: true,
      totalUsers: preparedUsers.length,
      totalOrganizations: orgList.length,
      users: preparedUsers,
    };
  }

  // Live Mode: Enforce pre-connection guard
  const config = loadConfig(process.env);
  const logger = createLogger(config);

  if (config.appEnv !== "staging") {
    throw new Error(
      `Staging seeder requires APP_ENV=staging. Current: ${config.appEnv}`,
    );
  }

  assertSafeStagingDatabaseConfig(config.database, {
    appEnv: "staging",
    requireStagingAuth: true,
  });

  const database = createDatabaseClient(config.database, logger, { appEnv: "staging" });

  try {
    logger.info("staging_seeder_started", {
      database: config.database.name,
      usersCount: preparedUsers.length,
      orgsCount: orgList.length,
    });

    // 1. Seed Organizations
    for (const org of orgList) {
      await database.db
        .insert(organizations)
        .values({
          id: org.id,
          name: org.name,
          slug: org.slug,
          legalName: org.legalName,
          industry: org.industry,
          organizationType: org.organizationType,
          email: `${org.slug}@staging.haza-aios.com`,
          country: "US",
          ownerId: STAGING_SYNTHETIC_USERS.orgOwner.id,
          status: "active",
        })
        .onDuplicateKeyUpdate({
          set: { name: org.name, slug: org.slug },
        });
    }

    // 2. Seed Users
    for (const user of preparedUsers) {
      await database.db
        .insert(users)
        .values(user)
        .onDuplicateKeyUpdate({
          set: {
            displayName: user.displayName,
            passwordHash: user.passwordHash,
          },
        });
    }

    logger.info("staging_seeder_completed_successfully", {
      seededUsers: preparedUsers.length,
      seededOrganizations: orgList.length,
    });

    return {
      success: true,
      dryRun: false,
      totalUsers: preparedUsers.length,
      totalOrganizations: orgList.length,
      users: preparedUsers,
    };
  } finally {
    await database.close();
  }
}

// Direct execution CLI runner
if (process.argv[1]?.endsWith("seed-staging.ts")) {
  runStagingSeeder()
    .then((result) => {
      console.log("Staging Seeder Finished:", JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error("Staging Seeder Aborted:", error);
      process.exit(1);
    });
}
