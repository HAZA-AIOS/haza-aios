import { ApiError } from "../../common/errors/api-error.js";

export function assertRegistrationAllowed(email: string, allowedEmails: string[] | null): void {
  if (allowedEmails === null) {
    return;
  }

  if (!allowedEmails.includes(email.trim().toLowerCase())) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Registration is currently limited to approved email addresses.",
    );
  }
}
