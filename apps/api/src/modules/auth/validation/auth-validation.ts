import { ApiError } from "../../../common/errors/api-error.js";
import type { CreateUserInput, LoginInput, RegisterInput } from "../auth.types.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateLogin(input: unknown): LoginInput {
  const value = assertRecord(input);
  const email = requireEmail(value.email);
  const password = requirePassword(value.password);

  return {
    email,
    password,
    rememberMe: value.rememberMe === true,
  };
}

export function validateCreateUser(input: unknown): CreateUserInput {
  const value = assertRecord(input);
  const firstName = requireText(value.firstName, "firstName", 1, 120);
  const lastName = requireText(value.lastName, "lastName", 1, 120);
  const email = requireEmail(value.email);
  const password = requirePassword(value.password);

  return {
    firstName,
    lastName,
    email,
    password,
    status: "active",
    emailVerified: false,
  };
}

export function validateRegister(input: unknown): RegisterInput {
  const user = validateCreateUser(input);
  const value = assertRecord(input);

  return {
    ...user,
    organizationName: requireText(value.organizationName ?? value.organization, "organizationName", 2, 180),
    organizationType: requireText(value.organizationType ?? "Company", "organizationType", 2, 80),
    industry: requireText(value.industry ?? "General", "industry", 2, 80),
    country: requireText(value.country ?? "United States", "country", 2, 120),
    organizationEmail: typeof value.organizationEmail === "string" ? requireEmail(value.organizationEmail) : user.email,
  };
}

function assertRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throwValidation("body", "Request body must be an object.");
  }

  return input as Record<string, unknown>;
}

function requireEmail(value: unknown): string {
  const email = requireText(value, "email", 3, 255).toLowerCase();

  if (!emailPattern.test(email)) {
    throwValidation("email", "Enter a valid email address.");
  }

  return email;
}

function requirePassword(value: unknown): string {
  const password = requireText(value, "password", 8, 128);

  if (password.length > 128) {
    throwValidation("password", "Password is too long.");
  }

  return password;
}

function requireText(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throwValidation(field, `${field} is required.`);
  }

  const trimmed = value.trim();

  if (trimmed.length < min) {
    throwValidation(field, `${field} must contain at least ${min} characters.`);
  }

  if (trimmed.length > max) {
    throwValidation(field, `${field} must contain at most ${max} characters.`);
  }

  return trimmed;
}

function throwValidation(field: string, message: string): never {
  throw new ApiError(400, "VALIDATION_FAILED", "Request validation failed", [{ field, message }]);
}
