import { describe, it, expect } from "vitest";
import { assertSafeDatabaseConfig, TestDatabaseGuardError } from "./helpers/test-database-guard.js";
import type { DatabaseConfig } from "../src/config/env.js";

describe("TestDatabaseGuard", () => {
  const validConfig: DatabaseConfig = {
    host: "127.0.0.1",
    port: 3306,
    name: "haza_aios_integration_test",
    user: "haza_test_runner",
    password: "secret",
    connectionLimit: 5,
  };

  it("passes for valid local test configuration", () => {
    expect(() => assertSafeDatabaseConfig(validConfig, "test")).not.toThrow();
  });

  it("fails if NODE_ENV is not 'test'", () => {
    expect(() => assertSafeDatabaseConfig(validConfig, "production")).toThrow(TestDatabaseGuardError);
    expect(() => assertSafeDatabaseConfig(validConfig, "development")).toThrow(TestDatabaseGuardError);
    expect(() => assertSafeDatabaseConfig(validConfig, undefined)).toThrow(TestDatabaseGuardError);
  });

  it("fails if host is remote or railway", () => {
    expect(() =>
      assertSafeDatabaseConfig({ ...validConfig, host: "roundhouse.proxy.rlwy.net" }, "test")
    ).toThrow(TestDatabaseGuardError);

    expect(() =>
      assertSafeDatabaseConfig({ ...validConfig, host: "192.168.1.100" }, "test")
    ).toThrow(TestDatabaseGuardError);
  });

  it("fails if port is 33061 (SSH tunnel)", () => {
    expect(() =>
      assertSafeDatabaseConfig({ ...validConfig, port: 33061 }, "test")
    ).toThrow(TestDatabaseGuardError);
  });

  it("fails if database name is production or rehearsal", () => {
    expect(() =>
      assertSafeDatabaseConfig({ ...validConfig, name: "haza_aios" }, "test")
    ).toThrow(TestDatabaseGuardError);

    expect(() =>
      assertSafeDatabaseConfig({ ...validConfig, name: "railway" }, "test")
    ).toThrow(TestDatabaseGuardError);

    expect(() =>
      assertSafeDatabaseConfig({ ...validConfig, name: "stage19-rehearsal" }, "test")
    ).toThrow(TestDatabaseGuardError);
  });
});
