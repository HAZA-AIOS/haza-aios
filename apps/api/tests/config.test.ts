import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/env.js";

describe("loadConfig", () => {
  it("loads development-safe defaults", () => {
    const config = loadConfig({});

    expect(config).toMatchObject({
      nodeEnv: "development",
      host: "127.0.0.1",
      port: 8000,
      webOrigin: "http://localhost:3000",
      logLevel: "debug",
      bodyLimitBytes: 1_048_576,
      apiBasePath: "/api/v1",
      database: {
        host: "127.0.0.1",
        port: 3306,
        name: "haza_aios",
        user: "root",
        password: "",
        connectionLimit: 10,
      },
    });
  });

  it("uses a separate database name for tests", () => {
    const config = loadConfig({ NODE_ENV: "test" });

    expect(config.database.name).toBe("haza_aios_test");
  });

  it("supports an explicit test database name", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      TEST_DATABASE_NAME: "haza_aios_ci",
    });

    expect(config.database.name).toBe("haza_aios_ci");
  });

  it("rejects invalid ports", () => {
    expect(() => loadConfig({ API_PORT: "not-a-port" })).toThrow("API_PORT must be an integer between 1 and 65535");
  });

  it("requires production host and origin", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow("API_HOST is required");
    expect(() => loadConfig({ NODE_ENV: "production", API_HOST: "0.0.0.0" })).toThrow("WEB_ORIGIN is required");
  });

  it("uses the hosting platform port when API_PORT is unset", () => {
    expect(loadConfig({ PORT: "43210" }).port).toBe(43210);
  });

  it("preserves explicit API_PORT precedence", () => {
    expect(loadConfig({ API_PORT: "8000", PORT: "43210" }).port).toBe(8000);
  });

  it.each(["invalid", "0", "65536", "1.5"])("rejects invalid platform port %s", (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow("PORT must be an integer between 1 and 65535");
  });

  it("requires production database settings", () => {
    expect(() => loadConfig({
      NODE_ENV: "production",
      API_HOST: "0.0.0.0",
      WEB_ORIGIN: "https://app.example.com",
    })).toThrow("DATABASE_NAME is required");
  });
});
