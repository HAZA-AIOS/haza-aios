import { once } from "node:events";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import type { DatabaseClient } from "../src/database/client.js";

const logger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

let server: Server;
let baseUrl: string;
let config: ApiConfig;
let database: DatabaseClient;

beforeEach(async () => {
  vi.clearAllMocks();
  config = loadConfig({
    NODE_ENV: "test",
    API_HOST: "127.0.0.1",
    API_PORT: "8000",
    WEB_ORIGIN: "http://localhost:3000",
    LOG_LEVEL: "error",
    API_BODY_LIMIT_BYTES: "256",
  });
  database = createFakeDatabase();
  server = createApp(config, logger, database);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  if (server.listening) {
    server.close();
    await once(server, "close");
  }
});

describe("api foundation", () => {
  it("boots and returns health", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(body).toMatchObject({
      status: "ok",
      service: "haza-aios-api",
    });
  });

  it("returns readiness with database dependency", async () => {
    const response = await fetch(`${baseUrl}/api/v1/readiness`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.checks).toEqual({
      config: "ok",
      database: "up",
    });
    expect(body.dependencies.database).toBe("up");
  });

  it("returns not ready when database is unavailable", async () => {
    database.ping = vi.fn().mockRejectedValue(new Error("offline"));
    const response = await fetch(`${baseUrl}/api/v1/readiness`);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "not_ready",
      checks: {
        config: "ok",
        database: "down",
      },
      dependencies: {
        database: "down",
      },
    });
  });

  it("returns liveness", async () => {
    const response = await fetch(`${baseUrl}/api/v1/liveness`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("alive");
  });

  it("uses a safe incoming request id", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: {
        "x-request-id": "db1-test-request",
      },
    });

    expect(response.headers.get("x-request-id")).toBe("db1-test-request");
  });

  it("returns structured 404 responses", async () => {
    const response = await fetch(`${baseUrl}/api/v1/missing`);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatchObject({
      code: "NOT_FOUND",
      message: "API route not found",
    });
    expect(body.error.requestId).toBeTruthy();
  });

  it("returns structured validation failures", async () => {
    const response = await fetch(`${baseUrl}/api/v1/foundation/validate`);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Request validation failed",
    });
  });

  it("applies configured CORS for the web origin", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: {
        origin: config.webOrigin,
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(config.webOrigin);
  });

  it("enforces request body limits", async () => {
    const response = await fetch(`${baseUrl}/api/v1/foundation/validate?value=ok`, {
      method: "POST",
      body: JSON.stringify({ text: "x".repeat(300) }),
      headers: {
        "content-type": "application/json",
      },
    });
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

function createFakeDatabase(): DatabaseClient {
  return {
    db: {} as DatabaseClient["db"],
    ping: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(async (work) => work({} as Parameters<Parameters<DatabaseClient["transaction"]>[0]>[0])),
  };
}
