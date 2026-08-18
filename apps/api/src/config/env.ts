type NodeEnv = "development" | "test" | "production";
type LogLevel = "error" | "warn" | "info" | "debug";

export type ApiConfig = {
  nodeEnv: NodeEnv;
  host: string;
  port: number;
  webOrigin: string;
  logLevel: LogLevel;
  bodyLimitBytes: number;
  database: DatabaseConfig;
  apiBasePath: "/api/v1";
  serviceName: "haza-aios-api";
  version: string;
};

export type DatabaseConfig = {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  connectionLimit: number;
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
  const database = readDatabaseConfig(env, nodeEnv);

  return {
    nodeEnv,
    host,
    port,
    webOrigin,
    logLevel,
    bodyLimitBytes,
    database,
    apiBasePath: "/api/v1",
    serviceName: "haza-aios-api",
    version: env.npm_package_version || "0.0.0",
  };
}

function readDatabaseConfig(env: EnvInput, nodeEnv: NodeEnv): DatabaseConfig {
  const defaultDatabaseName = nodeEnv === "test" ? "haza_aios_test" : "haza_aios";
  const name = readString(
    nodeEnv === "test" ? env.TEST_DATABASE_NAME ?? env.DATABASE_NAME : env.DATABASE_NAME,
    nodeEnv === "test" && env.TEST_DATABASE_NAME ? "TEST_DATABASE_NAME" : "DATABASE_NAME",
    nodeEnv === "production" ? undefined : defaultDatabaseName,
  );

  return {
    host: readString(env.DATABASE_HOST, "DATABASE_HOST", nodeEnv === "production" ? undefined : "127.0.0.1"),
    port: readPort(env.DATABASE_PORT, "DATABASE_PORT", 3306),
    name,
    user: readString(env.DATABASE_USER, "DATABASE_USER", nodeEnv === "production" ? undefined : "root"),
    password: readDatabasePassword(env.DATABASE_PASSWORD, nodeEnv),
    connectionLimit: readPositiveInteger(env.DATABASE_POOL_LIMIT, "DATABASE_POOL_LIMIT", 10),
  };
}

function readString(value: string | undefined, name: string, fallback?: string): string {
  const resolved = value?.trim() || fallback;

  if (!resolved) {
    throw new Error(`${name} is required`);
  }

  return resolved;
}

function readDatabasePassword(value: string | undefined, nodeEnv: NodeEnv): string {
  if (nodeEnv === "production" && value === undefined) {
    throw new Error("DATABASE_PASSWORD is required");
  }

  return value ?? "";
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
