import type { IncomingMessage, ServerResponse } from "node:http";
import { isTrustedProxy, type ProxyTrustOption } from "./rate-limiter.js";

export type SecurityHeaderOptions = {
  isHttps?: boolean;
  trustProxy?: ProxyTrustOption;
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
  // Strict-Transport-Security is enabled ONLY for verified HTTPS responses.
  // 1. Direct TLS connection: request.socket.encrypted === true.
  // 2. Forwarded HTTPS: x-forwarded-proto === "https", BUT ONLY IF the immediate
  //    socket connection originates from a verified trusted proxy.
  //    Untrusted clients sending x-forwarded-proto over plain HTTP are strictly ignored.
  // Note: max-age is 1 year (31,536,000 seconds).
  // includeSubDomains and preload are intentionally omitted until all subdomains are verified.
  const isDirectHttps = Boolean(
    request?.socket && (request.socket as { encrypted?: boolean }).encrypted,
  );

  const socketIp = request?.socket?.remoteAddress;
  const isProxyTrusted = isTrustedProxy(socketIp, options?.trustProxy ?? false);
  const isForwardedHttps =
    isProxyTrusted && request?.headers["x-forwarded-proto"] === "https";

  const isHttps = options?.isHttps ?? (isDirectHttps || isForwardedHttps);

  if (isHttps) {
    response.setHeader("strict-transport-security", "max-age=31536000");
  }
}
