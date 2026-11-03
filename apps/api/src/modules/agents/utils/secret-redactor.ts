/**
 * Utility functions for preventing secret leakage in logs, responses, and audit trails.
 */

const SECRET_PATTERNS = [
  /sk-[a-zA-Z0-9_\-]{16,}/g,
  /Bearer\s+[a-zA-Z0-9_\-\.]+/gi,
  /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.]{8,})["']?/gi,
];

/**
 * Strips or redacts API keys and sensitive tokens from strings.
 */
export function redactSecrets(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  let sanitized = input
    .replace(/sk-[a-zA-Z0-9_\-]{16,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED]");

  // Additional generic token sanitization
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.toLowerCase().startsWith("bearer")) {
        return "Bearer [REDACTED]";
      }
      if (match.startsWith("sk-")) {
        return "[REDACTED_API_KEY]";
      }
      return match.replace(/([:=]\s*["']?)[^"'\s]+(["']?)/, "$1[REDACTED]$2");
    });
  }

  return sanitized;
}

/**
 * Returns a masked representation of an API key safe for UI display.
 * Example: 'sk-proj-1234567890abcdef' -> 'sk-...cdef'
 */
export function maskApiKey(apiKey?: string | null): string {
  if (!apiKey || typeof apiKey !== "string") {
    return "";
  }
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return "••••••••";
  }
  const prefix = trimmed.startsWith("sk-") ? "sk-..." : trimmed.slice(0, 3) + "...";
  const suffix = trimmed.slice(-4);
  return `${prefix}${suffix}`;
}

const SENSITIVE_KEY_NAMES = new Set([
  "apikey",
  "api_key",
  "secret",
  "password",
  "token",
  "authorization",
  "cookie",
  "access_token",
  "refresh_token",
  "client_secret",
]);

/**
 * Deeply traverses an object or array and redacts known sensitive fields.
 */
export function redactObject<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    return redactSecrets(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactObject(item)) as unknown as T;
  }

  if (typeof input === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEY_NAMES.has(lower)) {
        if (typeof val === "string" && (lower.includes("key") || lower.includes("token"))) {
          output[key] = maskApiKey(val);
        } else {
          output[key] = "[REDACTED]";
        }
      } else {
        output[key] = redactObject(val);
      }
    }
    return output as unknown as T;
  }

  return input;
}
