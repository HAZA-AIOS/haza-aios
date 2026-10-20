import type { IncomingMessage, ServerResponse } from "node:http";

export type SecurityHeaderOptions = {
  isHttps?: boolean;
  trustProxy?: boolean;
  appEnv?: string;
  nodeEnv?: string;
};

export function applySecurityHeaders(
  response: ServerResponse,
  request?: IncomingMessage,
  options?: SecurityHeaderOptions,
) {
  // MIME type sniffing protection
  response.setHeader("x-content-type-options", "nosniff");

  // Clickjacking protection: disallow framing
  response.setHeader("x-frame-options", "DENY");

  // Referrer information policy
  response.setHeader("referrer-policy", "no-referrer");

  // Restrict browser features and APIs
  response.setHeader(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()",
  );

  // Content Security Policy for API: strictly disallow script execution and framing
  response.setHeader(
    "content-security-policy",
    "default-src 'none'; frame-ancestors 'none'",
  );

  // HTTP Strict Transport Security (HSTS):
  // Enable Strict-Transport-Security only for verified HTTPS responses.
  // Avoid applying production HSTS behavior to local HTTP development.
  const isDirectHttps = Boolean(
    request?.socket && (request.socket as { encrypted?: boolean }).encrypted,
  );
  const isForwardedHttps = request?.headers["x-forwarded-proto"] === "https";
  const isProdOrStaging =
    options?.appEnv === "production" ||
    options?.appEnv === "staging" ||
    options?.nodeEnv === "production";

  const isHttps =
    options?.isHttps ??
    (isDirectHttps || (isForwardedHttps && (options?.trustProxy || isProdOrStaging)));

  if (isHttps) {
    // max-age: 1 year (31,536,000 seconds).
    // Note: includeSubDomains and preload intentionally omitted until all subdomains are verified.
    response.setHeader("strict-transport-security", "max-age=31536000");
  }
}
