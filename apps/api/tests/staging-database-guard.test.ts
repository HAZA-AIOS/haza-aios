import { describe, it, expect } from "vitest";
import {
  assertSafeStagingDatabaseConfig,
  StagingDatabaseGuardError,
} from "../src/config/staging-database-guard.js";
import type { DatabaseConfig } from "../src/config/env.js";

describe("StagingDatabaseGuard", () => {
  const validStagingConfig: DatabaseConfig = {
    host: "roundhouse.proxy.rlwy.net",
    port: 3306,
    name: "haza_aios_staging",
    user: "staging_user",
    password: "staging_password",
    connectionLimit: 10,
  };

  it("passes for valid staging database configuration", () => {
    expect(() => assertSafeStagingDatabaseConfig(validStagingConfig)).not.toThrow();
  });

  it("passes for local test or staging database", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        host: "127.0.0.1",
        name: "haza_aios_integration_test",
      })
    ).not.toThrow();
  });

  it("fails closed if database name matches production exactly", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "haza_aios",
      })
    ).toThrow(StagingDatabaseGuardError);

    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "production",
      })
    ).toThrow(StagingDatabaseGuardError);
  });

  it("fails closed if database name does not contain 'staging' or 'test'", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "customer_db",
      })
    ).toThrow(StagingDatabaseGuardError);

    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "my_custom_db",
      })
    ).toThrow(StagingDatabaseGuardError);
  });

  it("fails closed if host contains 'production' and does not contain 'staging'", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        host: "mysql-production.railway.internal",
      })
    ).toThrow(StagingDatabaseGuardError);
  });
});
