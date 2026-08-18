import { describe, expect, it, vi } from "vitest";
import { mapDatabaseError, toApiError } from "../src/database/errors.js";
import { withTransaction } from "../src/database/transactions.js";
import type { DatabaseClient } from "../src/database/client.js";
import { seedPolicy } from "../src/database/seed/seed-policy.js";

describe("database foundation", () => {
  it("maps unavailable database errors safely", () => {
    const mapped = mapDatabaseError({ code: "ECONNREFUSED" });
    const apiError = toApiError(mapped);

    expect(mapped.code).toBe("DATABASE_UNAVAILABLE");
    expect(apiError.statusCode).toBe(503);
    expect(apiError.message).not.toContain("ECONNREFUSED");
  });

  it("maps unique and foreign key failures without raw SQL details", () => {
    expect(mapDatabaseError({ errno: 1062 }).code).toBe("DATABASE_UNIQUE_CONSTRAINT");
    expect(mapDatabaseError({ errno: 1452 }).code).toBe("DATABASE_FOREIGN_KEY_CONSTRAINT");
  });

  it("commits work through the transaction boundary", async () => {
    const tx = { marker: "tx" };
    const database = createFakeDatabase(async (work) => work(tx));

    const result = await withTransaction(database, async ({ tx: currentTx }) => currentTx);

    expect(result).toBe(tx);
    expect(database.transaction).toHaveBeenCalledTimes(1);
  });

  it("maps transaction rollback failures", async () => {
    const database = createFakeDatabase(async () => {
      throw { code: "ER_LOCK_DEADLOCK" };
    });

    await expect(withTransaction(database, async () => "ok")).rejects.toMatchObject({
      code: "DATABASE_TRANSACTION_FAILED",
    });
  });

  it("keeps production demo seeding disabled", () => {
    expect(seedPolicy.productionAutoSeedAllowed).toBe(false);
    expect(seedPolicy.testFixturesUseSeparateDatabase).toBe(true);
  });
});

function createFakeDatabase(transaction: DatabaseClient["transaction"]): DatabaseClient {
  return {
    db: {} as DatabaseClient["db"],
    ping: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    transaction: vi.fn(transaction),
  };
}
