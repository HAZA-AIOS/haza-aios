import { describe, expect, it } from "vitest";
import {
  sanitizeOperationalRecord,
  sanitizeOperationalText,
} from "../src/modules/operations/operational-sanitization.js";
import {
  readAuditQuery,
  readEventQuery,
} from "../src/modules/operations/operational-validation.js";

describe("DB-16 operational validation and redaction", () => {
  it("redacts sensitive keys recursively without mutating safe metadata", () => {
    const sanitized = sanitizeOperationalRecord({
      action: "student.updated",
      password: "not-safe",
      nested: {
        accessToken: "secret-token",
        profile: { displayName: "Safe Name", api_key: "secret-key" },
      },
      values: [{ cookie: "session=value", status: "ok" }],
    });

    expect(sanitized).toEqual({
      action: "student.updated",
      password: "[REDACTED]",
      nested: {
        accessToken: "[REDACTED]",
        profile: { displayName: "Safe Name", api_key: "[REDACTED]" },
      },
      values: [{ cookie: "[REDACTED]", status: "ok" }],
    });
  });

  it("bounds safe operational text and validates paginated filters", () => {
    expect(sanitizeOperationalText("line one\nline two", 12)).toBe("line one lin");
    const audit = readAuditQuery(
      new URLSearchParams("limit=25&offset=10&result=success&action=workflow.completed"),
    );
    expect(audit).toMatchObject({ limit: 25, offset: 10, result: "success" });
    expect(() => readEventQuery(new URLSearchParams("limit=1000"))).toThrow(
      "Request validation failed",
    );
    expect(() => readAuditQuery(new URLSearchParams("from=2026-09-02&to=2026-09-01"))).toThrow(
      "Request validation failed",
    );
  });
});
