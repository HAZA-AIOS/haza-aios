import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STAGING_DATABASE_ALLOWED;
    delete process.env.ALLOW_STAGING_MIGRATIONS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("passes for valid staging database configuration object", () => {
    expect(() => assertSafeStagingDatabaseConfig(validStagingConfig)).not.toThrow();
  });

  it("passes for valid staging connection URL string", () => {
    const validUrl = "mysql://staging_user:secret@roundhouse.proxy.rlwy.net:3306/haza_aios_staging";
    expect(() => assertSafeStagingDatabaseConfig(validUrl)).not.toThrow();
  });

  it("passes for local test or integration database", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        host: "127.0.0.1",
        name: "haza_aios_integration_test",
      }),
    ).not.toThrow();
  });

  it("fails closed if database name matches production exactly", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "haza_aios",
      }),
    ).toThrow(StagingDatabaseGuardError);

    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "production",
      }),
    ).toThrow(StagingDatabaseGuardError);

    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "mysql",
      }),
    ).toThrow(StagingDatabaseGuardError);
  });

  it("fails closed for URL-encoded production database name", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "haza%5Faios",
      }),
    ).toThrow(StagingDatabaseGuardError);

    const encodedUrl = "mysql://root:secret@127.0.0.1:3306/haza%5Faios";
    expect(() => assertSafeStagingDatabaseConfig(encodedUrl)).toThrow(StagingDatabaseGuardError);
  });

  it("fails closed if database name does not contain 'staging' or 'test'", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "customer_db",
      }),
    ).toThrow(StagingDatabaseGuardError);

    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "my_custom_db",
      }),
    ).toThrow(StagingDatabaseGuardError);
  });

  it("fails closed if host contains 'production' and does not contain 'staging'", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        host: "mysql-production.railway.internal",
      }),
    ).toThrow(StagingDatabaseGuardError);

    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        host: "mysql.railway.internal",
      }),
    ).toThrow(StagingDatabaseGuardError);
  });

  it("fails closed if target is missing or empty", () => {
    expect(() => assertSafeStagingDatabaseConfig(undefined)).toThrow(StagingDatabaseGuardError);
    expect(() => assertSafeStagingDatabaseConfig("")).toThrow(StagingDatabaseGuardError);
    expect(() =>
      assertSafeStagingDatabaseConfig({
        ...validStagingConfig,
        name: "",
      }),
    ).toThrow(StagingDatabaseGuardError);
  });

  it("fails closed if APP_ENV is 'production'", () => {
    expect(() =>
      assertSafeStagingDatabaseConfig(validStagingConfig, { appEnv: "production" }),
    ).toThrow(StagingDatabaseGuardError);
  });

  it("enforces explicit STAGING_DATABASE_ALLOWED flag when requireStagingAuth is true", () => {
    // Missing flag -> should throw
    expect(() =>
      assertSafeStagingDatabaseConfig(validStagingConfig, {
        appEnv: "staging",
        requireStagingAuth: true,
      }),
    ).toThrow(StagingDatabaseGuardError);

    // With flag -> should pass
    process.env.STAGING_DATABASE_ALLOWED = "true";
    expect(() =>
      assertSafeStagingDatabaseConfig(validStagingConfig, {
        appEnv: "staging",
        requireStagingAuth: true,
      }),
    ).not.toThrow();
  });
});
