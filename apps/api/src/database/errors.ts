import { ApiError } from "../common/errors/api-error.js";

export type DatabaseErrorCode =
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_UNIQUE_CONSTRAINT"
  | "DATABASE_FOREIGN_KEY_CONSTRAINT"
  | "DATABASE_TRANSACTION_FAILED"
  | "DATABASE_QUERY_FAILED";

export class DatabaseError extends Error {
  readonly code: DatabaseErrorCode;
  readonly cause?: unknown;

  constructor(code: DatabaseErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
    this.cause = cause;
  }
}

export function mapDatabaseError(error: unknown, fallback: DatabaseErrorCode = "DATABASE_QUERY_FAILED"): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }

  const candidate = error as { code?: string; errno?: number };

  if (candidate.code === "ECONNREFUSED" || candidate.code === "ETIMEDOUT" || candidate.code === "PROTOCOL_CONNECTION_LOST") {
    return new DatabaseError("DATABASE_UNAVAILABLE", "Database is unavailable.", error);
  }

  if (candidate.errno === 1062 || candidate.code === "ER_DUP_ENTRY") {
    return new DatabaseError("DATABASE_UNIQUE_CONSTRAINT", "A unique database constraint was violated.", error);
  }

  if ([1451, 1452].includes(candidate.errno ?? 0) || candidate.code === "ER_ROW_IS_REFERENCED_2" || candidate.code === "ER_NO_REFERENCED_ROW_2") {
    return new DatabaseError("DATABASE_FOREIGN_KEY_CONSTRAINT", "A database relationship constraint was violated.", error);
  }

  return new DatabaseError(fallback, "Database operation failed.", error);
}

export function toApiError(error: unknown): ApiError {
  const databaseError = mapDatabaseError(error);

  if (databaseError.code === "DATABASE_UNAVAILABLE") {
    return new ApiError(503, "DATABASE_UNAVAILABLE", "Database is temporarily unavailable.");
  }

  if (databaseError.code === "DATABASE_UNIQUE_CONSTRAINT" || databaseError.code === "DATABASE_FOREIGN_KEY_CONSTRAINT") {
    return new ApiError(409, databaseError.code, databaseError.message);
  }

  return new ApiError(500, databaseError.code, "Database operation failed.");
}
