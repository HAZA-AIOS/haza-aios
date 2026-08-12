/**
 * Client-side authentication form validation utilities.
 *
 * These are pure functions that return an error string when validation fails,
 * or null when the field is valid.  They intentionally mirror the server-side
 * constraints in auth-service.ts so the UI can give inline feedback before
 * the network round-trip.
 *
 * UI
 *  └─ auth-validation (this file — pure client validation)
 *  └─ AuthProvider  →  auth-service  →  API client  →  Backend
 */

/** Validates an email address format. */
function validateEmail(value: string): string | null {
  if (!value.trim()) {
    return "Email is required.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}

/** Validates a password meets minimum strength requirements. */
function validatePassword(value: string): string | null {
  if (!value) {
    return "Password is required.";
  }
  if (value.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}

/** Validates a non-empty name field (first name or last name). */
function validateName(value: string, fieldLabel = "Name"): string | null {
  if (!value.trim()) {
    return `${fieldLabel} is required.`;
  }
  return null;
}

/**
 * Validates that the confirmation password matches the original password.
 * Only returns an error once the confirmation field has content.
 */
function validatePasswordMatch(password: string, confirmation: string): string | null {
  if (!confirmation) {
    return null; // Suppress until the user starts typing in confirmation
  }
  if (password !== confirmation) {
    return "Passwords do not match.";
  }
  return null;
}

/** Validates a reset token is present (prevents accidental direct navigation). */
function validateResetToken(token: string): string | null {
  if (!token.trim()) {
    return "No reset token found in the URL. Use a backend-issued reset link.";
  }
  return null;
}

export { validateEmail, validateName, validatePassword, validatePasswordMatch, validateResetToken };
