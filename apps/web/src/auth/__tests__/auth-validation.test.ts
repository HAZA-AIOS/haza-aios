import { describe, expect, it } from "vitest";

import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordMatch,
  validateResetToken,
} from "../auth-validation";

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------
describe("validateEmail", () => {
  it("returns null for a valid email address", () => {
    expect(validateEmail("user@example.com")).toBeNull();
  });

  it("returns null for a valid email with subdomain", () => {
    expect(validateEmail("user@mail.example.org")).toBeNull();
  });

  it("returns an error for an empty string", () => {
    expect(validateEmail("")).not.toBeNull();
  });

  it("returns an error for a whitespace-only value", () => {
    expect(validateEmail("   ")).not.toBeNull();
  });

  it("returns an error when the @ symbol is missing", () => {
    expect(validateEmail("notanemail")).not.toBeNull();
  });

  it("returns an error when the domain is missing", () => {
    expect(validateEmail("user@")).not.toBeNull();
  });

  it("returns an error when the TLD is missing", () => {
    expect(validateEmail("user@domain")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------
describe("validatePassword", () => {
  it("returns null for a password with 8 or more characters", () => {
    expect(validatePassword("password")).toBeNull();
    expect(validatePassword("strongP@ss1!")).toBeNull();
  });

  it("returns an error for an empty password", () => {
    expect(validatePassword("")).not.toBeNull();
  });

  it("returns an error for a password shorter than 8 characters", () => {
    expect(validatePassword("abc")).not.toBeNull();
    expect(validatePassword("1234567")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateName
// ---------------------------------------------------------------------------
describe("validateName", () => {
  it("returns null for a non-empty name", () => {
    expect(validateName("Alice")).toBeNull();
    expect(validateName("van der Berg")).toBeNull();
  });

  it("returns an error for an empty string", () => {
    expect(validateName("")).not.toBeNull();
  });

  it("returns an error for a whitespace-only string", () => {
    expect(validateName("   ")).not.toBeNull();
  });

  it("includes the fieldLabel in the error message when provided", () => {
    const error = validateName("", "First name");
    expect(error).toContain("First name");
  });
});

// ---------------------------------------------------------------------------
// validatePasswordMatch
// ---------------------------------------------------------------------------
describe("validatePasswordMatch", () => {
  it("returns null when both passwords match", () => {
    expect(validatePasswordMatch("secret123", "secret123")).toBeNull();
  });

  it("returns null when the confirmation is empty (not yet typed)", () => {
    expect(validatePasswordMatch("secret123", "")).toBeNull();
  });

  it("returns an error when passwords do not match", () => {
    expect(validatePasswordMatch("secret123", "different")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateResetToken
// ---------------------------------------------------------------------------
describe("validateResetToken", () => {
  it("returns null for a non-empty token", () => {
    expect(validateResetToken("abc123-token")).toBeNull();
  });

  it("returns an error for an empty token", () => {
    expect(validateResetToken("")).not.toBeNull();
  });

  it("returns an error for a whitespace-only token", () => {
    expect(validateResetToken("   ")).not.toBeNull();
  });
});
