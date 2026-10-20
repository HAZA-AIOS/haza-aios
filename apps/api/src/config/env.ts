export type AppEnv = "development" | "test" | "staging" | "production";
export type NodeEnv = "development" | "test" | "production" | "staging";
type LogLevel = "error" | "warn" | "info" | "debug";

export type ApiConfig = {
  appEnv: AppEnv;
  nodeEnv: NodeEnv;
  sessionCookieName: string;
  host: string;
  port: number;
  webOrigin: string;
  webOrigins: string[];
  registrationAllowedEmails: string[] | null;
  logLevel: LogLevel;
  bodyLimitBytes: number;
  database: DatabaseConfig;
  email: EmailConfig;
  apiBasePath: "/api/v1";
  serviceName: "haza-aios-api";
  version: string;
  trustProxy: boolean;
};

export type EmailConfig = {
  /** Resend API key. Empty string means email delivery is disabled (dev/test/staging). */
  resendApiKey: string;
  /** From address shown on outgoing emails. */
  from: string;
  /** Public base URL of the web app, used to construct password-reset links. */
  appUrl: string;
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

const allowedNodeEnvs = new Set<NodeEnv>(["development", "test", "production", "staging"]);
const allowedAppEnvs = new Set<AppEnv>(["development", "test", "staging", "production"]);
const allowedLogLevels = new Set<LogLevel>(["error", "warn", "info", "debug"]);

export function loadConfig(env: EnvInput = process.env): ApiConfig {
  const nodeEnv = readEnum(env.NODE_ENV, "NODE_ENV", allowedNodeEnvs, "development");

  // Determine AppEnv: explicit APP_ENV takes precedence; otherwise infer from NODE_ENV
  const rawAppEnv = env.APP_ENV?.trim();
  const appEnv: AppEnv = rawAppEnv
    ? readEnum(rawAppEnv, "APP_ENV", allowedAppEnvs, "development")
    : (nodeEnv === "staging" ? "staging" : (nodeEnv === "production" ? "production" : (nodeEnv === "test" ? "test" : "development")));

  // Reject conflicting or dangerous environment configurations
  if (appEnv === "production" && nodeEnv === "staging") {
    throw new Error("Conflicting configuration: APP_ENV=production cannot run with NODE_ENV=staging");
  }

  if (appEnv === "staging" && env.DATABASE_NAME === "haza_aios") {
    throw new Error("Conflicting configuration: Staging environment cannot use production database 'haza_aios'");
  }

  const sessionCookieName =
    env.SESSION_COOKIE_NAME?.trim() ||
    (appEnv === "staging" ? "haza_session_staging" : "haza_session");

  const host = readString(
    env.API_HOST,
    "API_HOST",
    appEnv === "production" ? undefined : "127.0.0.1",
  );

  const port = readPort(
    env.API_PORT ?? env.PORT,
    env.API_PORT === undefined ? "PORT" : "API_PORT",
    8000,
  );

  const defaultWebOrigin =
    appEnv === "staging" ? "https://staging.haza-aios.com" : "http://localhost:3000";

  const webOrigin = readOrigin(
    env.WEB_ORIGIN,
    "WEB_ORIGIN",
    appEnv === "production" ? undefined : defaultWebOrigin,
  );

  const webOrigins = readOriginList(env.WEB_ORIGINS, "WEB_ORIGINS", webOrigin);

  const registrationAllowedEmails = readEmailList(
    env.REGISTRATION_ALLOWED_EMAILS,
    "REGISTRATION_ALLOWED_EMAILS",
  );

  const logLevel = readEnum(
    env.LOG_LEVEL,
    "LOG_LEVEL",
    allowedLogLevels,
    appEnv === "production" ? "info" : "debug",
  );

  const bodyLimitBytes = readPositiveInteger(
    env.API_BODY_LIMIT_BYTES,
    "API_BODY_LIMIT_BYTES",
    1_048_576,
  );

  const database = readDatabaseConfig(env, nodeEnv, appEnv);
  const email = readEmailConfig(env, appEnv);

  const trustProxy =
    env.TRUST_PROXY !== undefined
      ? env.TRUST_PROXY === "true" || env.TRUST_PROXY === "1"
      : (appEnv === "production" || appEnv === "staging");

  return {
    appEnv,
    nodeEnv,
    sessionCookieName,
    host,
    port,
    webOrigin,
    webOrigins,
    registrationAllowedEmails,
    logLevel,
    bodyLimitBytes,
    database,
    email,
    apiBasePath: "/api/v1",
    serviceName: "haza-aios-api",
    version: env.npm_package_version || "0.0.0",
    trustProxy,
  };
}

function readEmailConfig(env: EnvInput, appEnv: AppEnv): EmailConfig {
  const resendApiKey = env.RESEND_API_KEY?.trim() ?? "";

  const defaultFrom =
    appEnv === "staging"
      ? "no-reply@staging.haza-aios.com"
      : "no-reply@haza-aios.com";

  const from =
    env.EMAIL_FROM?.trim() ||
    (appEnv === "production" ? undefined : defaultFrom);

  // In production, real Resend delivery is required.
  // In development, test, and staging, email delivery is mocked when key is empty.
  if (appEnv === "production" && !resendApiKey) {
    throw new Error("RESEND_API_KEY is required in production");
  }

  if (appEnv === "production" && !from) {
    throw new Error("EMAIL_FROM is required in production");
  }

  const defaultAppUrl =
    appEnv === "staging"
      ? "https://staging.haza-aios.com"
      : "http://localhost:3000";

  const appUrl = readString(
    env.APP_URL,
    "APP_URL",
    appEnv === "production" ? undefined : defaultAppUrl,
  );

  return {
    resendApiKey,
    from: from ?? defaultFrom,
    appUrl,
  };
}

function readDatabaseConfig(env: EnvInput, nodeEnv: NodeEnv, appEnv: AppEnv): DatabaseConfig {
  let defaultDatabaseName: string;
  if (nodeEnv === "test" || appEnv === "test") {
    defaultDatabaseName = "haza_aios_test";
  } else if (appEnv === "staging" || nodeEnv === "staging") {
    defaultDatabaseName = "haza_aios_staging";
  } else {
    defaultDatabaseName = "haza_aios";
  }

  const name = readString(
    nodeEnv === "test" ? (env.TEST_DATABASE_NAME ?? env.DATABASE_NAME) : env.DATABASE_NAME,
    nodeEnv === "test" && env.TEST_DATABASE_NAME ? "TEST_DATABASE_NAME" : "DATABASE_NAME",
    appEnv === "production" ? undefined : defaultDatabaseName,
  );

  return {
    host: readString(
      env.DATABASE_HOST,
      "DATABASE_HOST",
      appEnv === "production" ? undefined : "127.0.0.1",
    ),
    port: readPort(env.DATABASE_PORT, "DATABASE_PORT", 3306),
    name,
    user: readString(
      env.DATABASE_USER,
      "DATABASE_USER",
      appEnv === "production" ? undefined : "root",
    ),
    password: readDatabasePassword(env.DATABASE_PASSWORD, appEnv),
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

function readDatabasePassword(value: string | undefined, appEnv: AppEnv): string {
  if (appEnv === "production" && value === undefined) {
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

function readOriginList(value: string | undefined, name: string, primaryOrigin: string): string[] {
  if (value === undefined) {
    return [primaryOrigin];
  }

  const origins = Array.from(
    new Set([
      primaryOrigin,
      ...value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => readOrigin(origin, name)),
    ]),
  );

  return origins;
}

function readEmailList(value: string | undefined, name: string): string[] | null {
  if (value === undefined) {
    return null;
  }

  const emails = Array.from(
    new Set(
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  if (emails.length === 0 || emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new Error(`${name} must be a comma-separated list of valid email addresses`);
  }

  return emails;
}

function readEnum<T extends string>(
  value: string | undefined,
  name: string,
  allowed: Set<T>,
  fallback: T,
): T {
  const resolved = (value?.trim() || fallback) as T;

  if (!allowed.has(resolved)) {
    throw new Error(`${name} must be one of: ${Array.from(allowed).join(", ")}`);
  }

  return resolved;
}
