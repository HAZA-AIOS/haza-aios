import { describe, expect, it } from "vitest";

import { assertRegistrationAllowed } from "../src/modules/auth/registration-policy.js";

describe("assertRegistrationAllowed", () => {
  it("keeps registration open when no allowlist is configured", () => {
    expect(() => assertRegistrationAllowed("anyone@example.com", null)).not.toThrow();
  });

  it("accepts an approved email case-insensitively", () => {
    expect(() =>
      assertRegistrationAllowed("OWNER@EXAMPLE.COM", ["owner@example.com"]),
    ).not.toThrow();
  });

  it("rejects unapproved emails without disclosing the allowlist", () => {
    expect(() => assertRegistrationAllowed("someone@example.com", ["owner@example.com"])).toThrow(
      "Registration is currently limited to approved email addresses.",
    );
  });
});
