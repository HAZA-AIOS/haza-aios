import { describe, expect, it } from "vitest";
import { reconcileMySql94TimestampPrecision } from "../src/database/mysql94-migrator.js";

describe("MySQL 9.4 migration compatibility", () => {
  it("qualifies legacy ON UPDATE expressions with the column precision", () => {
    expect(
      reconcileMySql94TimestampPrecision(
        "`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,",
      ),
    ).toBe(
      "`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(3),",
    );
  });

  it("leaves already-qualified expressions unchanged", () => {
    const statement =
      "`updated_at` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP(3),";

    expect(reconcileMySql94TimestampPrecision(statement)).toBe(statement);
  });
});
