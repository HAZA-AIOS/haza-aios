import { ApiError } from "../common/errors/api-error.js";
import type { DatabaseClient, DatabaseTransaction } from "./client.js";
import { mapDatabaseError } from "./errors.js";

export type TransactionContext = {
  tx: DatabaseTransaction;
};

export function withTransaction<T>(database: DatabaseClient, work: (context: TransactionContext) => Promise<T>): Promise<T> {
  return database.transaction((tx) => work({ tx })).catch((error: unknown) => {
    if (error instanceof ApiError) {
      throw error;
    }
    throw mapDatabaseError(error, "DATABASE_TRANSACTION_FAILED");
  });
}
