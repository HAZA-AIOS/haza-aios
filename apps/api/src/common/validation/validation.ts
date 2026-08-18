import { ApiError } from "../errors/api-error.js";

type ValidationIssue = {
  field: string;
  message: string;
};

export function requireQueryParam(searchParams: URLSearchParams, name: string): string {
  const value = searchParams.get(name)?.trim();

  if (!value) {
    throw new ApiError(400, "VALIDATION_FAILED", "Request validation failed", [
      { field: name, message: `${name} is required` },
    ] satisfies ValidationIssue[]);
  }

  return value;
}
