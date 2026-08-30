import type { Database, DatabaseTransaction } from "../client.js";

export type RepositoryContext = {
  db: Database | DatabaseTransaction;
};

export function createRepositoryContext(db: Database | DatabaseTransaction): RepositoryContext {
  return { db };
}
