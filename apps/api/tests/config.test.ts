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
    });
  });

  it("rejects invalid ports", () => {
    expect(() => loadConfig({ API_PORT: "not-a-port" })).toThrow("API_PORT must be an integer between 1 and 65535");
  });

  it("requires production host and origin", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow("API_HOST is required");
    expect(() => loadConfig({ NODE_ENV: "production", API_HOST: "0.0.0.0" })).toThrow("WEB_ORIGIN is required");
  });
});
