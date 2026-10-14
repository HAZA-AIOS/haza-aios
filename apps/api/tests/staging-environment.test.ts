import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config/env.js";
import { createDatabaseClient } from "../src/database/client.js";
import { StagingDatabaseGuardError } from "../src/config/staging-database-guard.js";

describe("Staging Environment Configuration & Client Guard", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("loads valid staging configuration with APP_ENV=staging and NODE_ENV=production", () => {
    const config = loadConfig({
      APP_ENV: "staging",
      NODE_ENV: "production",
      DATABASE_HOST: "mysql-staging.railway.internal",
      DATABASE_NAME: "haza_aios_staging",
      DATABASE_USER: "haza_staging",
      DATABASE_PASSWORD: "secret_password",
      WEB_ORIGIN: "https://staging.haza-aios.com",
    });

    expect(config.appEnv).toBe("staging");
    expect(config.nodeEnv).toBe("production");
    expect(config.sessionCookieName).toBe("haza_session_staging");
    expect(config.database.name).toBe("haza_aios_staging");
    expect(config.email.resendApiKey).toBe("");
    expect(config.email.from).toBe("no-reply@staging.haza-aios.com");
  });

  it("loads valid staging configuration with NODE_ENV=staging", () => {
    const config = loadConfig({
      NODE_ENV: "staging",
      DATABASE_HOST: "127.0.0.1",
      DATABASE_NAME: "haza_aios_staging",
      DATABASE_USER: "root",
      WEB_ORIGIN: "https://staging.haza-aios.com",
    });

    expect(config.appEnv).toBe("staging");
    expect(config.nodeEnv).toBe("staging");
    expect(config.sessionCookieName).toBe("haza_session_staging");
  });

  it("permits custom SESSION_COOKIE_NAME override in staging", () => {
    const config = loadConfig({
      APP_ENV: "staging",
      SESSION_COOKIE_NAME: "custom_staging_cookie",
      DATABASE_NAME: "haza_aios_staging",
      WEB_ORIGIN: "https://staging.haza-aios.com",
    });

    expect(config.sessionCookieName).toBe("custom_staging_cookie");
  });

  it("rejects conflicting APP_ENV=production and NODE_ENV=staging", () => {
    expect(() =>
      loadConfig({
        APP_ENV: "production",
        NODE_ENV: "staging",
      }),
    ).toThrow(/Conflicting configuration/);
  });

  it("rejects staging environment configured with production database name haza_aios", () => {
    expect(() =>
      loadConfig({
        APP_ENV: "staging",
        DATABASE_NAME: "haza_aios",
      }),
    ).toThrow(/Staging environment cannot use production database/);
  });

  it("enforces fail-closed guard in createDatabaseClient when activeAppEnv is staging", () => {
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    // Staging client targeting production DB should throw StagingDatabaseGuardError before connecting
    expect(() =>
      createDatabaseClient(
        {
          host: "127.0.0.1",
          port: 3306,
          name: "haza_aios", // Forbidden production name!
          user: "root",
          password: "",
          connectionLimit: 5,
        },
        mockLogger as any,
        { appEnv: "staging" },
      ),
    ).toThrow(StagingDatabaseGuardError);
  });
});
