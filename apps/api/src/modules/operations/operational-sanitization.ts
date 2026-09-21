const sensitiveKey =
  /(?:password|passphrase|secret|token|authorization|cookie|api[_-]?key|credential|database[_-]?(?:url|password)|private[_-]?key)/i;
const redacted = "[REDACTED]";

export function sanitizeOperationalValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[MAX_DEPTH]";
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value))
    return value.slice(0, 100).map((item) => sanitizeOperationalValue(item, depth + 1));
  if (typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 200)) {
    output[key] = sensitiveKey.test(key) ? redacted : sanitizeOperationalValue(child, depth + 1);
  }
  return output;
}

export function sanitizeOperationalRecord(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeOperationalValue(value);
  return sanitized && typeof sanitized === "object" && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}

export function sanitizeOperationalText(value: unknown, maximum = 1000): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value)
    .replace(/[\r\n\t]+/g, " ")
    .trim();
  return text ? text.slice(0, maximum) : null;
}
