import type { ApiConfig } from "../../config/env.js";

type LogLevel = ApiConfig["logLevel"];
type LogContext = Record<string, string | number | boolean | null | undefined>;

const priority: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export type Logger = {
  error: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  debug: (message: string, context?: LogContext) => void;
};

export function createLogger(config: Pick<ApiConfig, "logLevel" | "serviceName">): Logger {
  function write(level: LogLevel, message: string, context: LogContext = {}) {
    if (priority[level] > priority[config.logLevel]) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: config.serviceName,
      message,
      ...context,
    };

    console[level === "debug" ? "log" : level](JSON.stringify(entry));
  }

  return {
    error: (message, context) => write("error", message, context),
    warn: (message, context) => write("warn", message, context),
    info: (message, context) => write("info", message, context),
    debug: (message, context) => write("debug", message, context),
  };
}
