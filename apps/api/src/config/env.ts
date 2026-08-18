type NodeEnv = "development" | "test" | "production";
type LogLevel = "error" | "warn" | "info" | "debug";

export type ApiConfig = {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  webOrigin: string;
  logLevel: LogLevel;
  bodyLimitBytes: number;
  apiBasePath: "/api/v1";
  serviceName: "haza-aios-api";
  version: string;
};

type EnvInput = NodeJS.ProcessEnv;

const allowedNodeEnvs = new Set<NodeEnv>(["development", "test", "production"]);
const allowedLogLevels = new Set<LogLevel>(["error", "warn", "info", "debug"]);

export function loadConfig(env: EnvInput = process.env): ApiConfig {
  const nodeEnv = readEnum(env.NODE_ENV, "NODE_ENV", allowedNodeEnvs, "development");
  const host = readString(env.API_HOST, "API_HOST", nodeEnv === "production" ? undefined : "127.0.0.1");
  const port = readPort(env.API_PORT, "API_PORT", 8000);
  const webOrigin = readOrigin(env.WEB_ORIGIN, "WEB_ORIGIN", nodeEnv === "production" ? undefined : "http://localhost:3000");
  const logLevel = readEnum(env.LOG_LEVEL, "LOG_LEVEL", allowedLogLevels, nodeEnv === "production" ? "info" : "debug");
  const bodyLimitBytes = readPositiveInteger(env.API_BODY_LIMIT_BYTES, "API_BODY_LIMIT_BYTES", 1_048_576);

  return {
    nodeEnv,
    host,
    port,
    webOrigin,
    logLevel,
    bodyLimitBytes,
    apiBasePath: "/api/v1",
    serviceName: "haza-aios-api",
    version: env.npm_package_version || "0.0.0",
  };
}

function readString(value: string | undefined, name: string, fallback?: string): string {
  const resolved = value?.trim() || fallback;

  if (!resolved) {
    throw new Error(`${name} is required`);
  }

  return resolved;
}

function readPort(value: string | undefined, name: string, fallback: number): number {
  const resolved = value?.trim() ? Number(value) : fallback;

  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return resolved;
}

function readPositiveInteger(value: string | undefined, name: string, fallback: number): number {
  const resolved = value?.trim() ? Number(value) : fallback;

  if (!Number.isInteger(resolved) || resolved < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return resolved;
}

function readOrigin(value: string | undefined, name: string, fallback?: string): string {
  const resolved = readString(value, name, fallback);

  try {
    return new URL(resolved).origin;
  } catch {
    throw new Error(`${name} must be a valid URL origin`);
  }
}

function readEnum<T extends string>(value: string | undefined, name: string, allowed: Set<T>, fallback: T): T {
  const resolved = (value?.trim() || fallback) as T;

  if (!allowed.has(resolved)) {
    throw new Error(`${name} must be one of: ${Array.from(allowed).join(", ")}`);
  }

  return resolved;
}
