import type { IncomingMessage } from "node:http";
import { createHash } from "node:crypto";
import { isIP, isIPv4, isIPv6 } from "node:net";
import { ApiError } from "../common/errors/api-error.js";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

export interface RateLimiterStore {
  consume(key: string, limit: number, windowMs: number): RateLimitResult;
  check(key: string, limit: number, windowMs: number): RateLimitResult;
  recordFailure(key: string, windowMs: number): RateLimitResult;
  reset(key: string): void;
  clear(): void;
}

/**
 * High-performance, in-memory sliding window rate limiter store.
 * Tracks timestamps within the sliding window and prunes expired entries.
 */
export class InMemoryRateLimiterStore implements RateLimiterStore {
  private hits = new Map<string, number[]>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(cleanupIntervalMs = 60_000) {
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const active = timestamps.filter((t) => now - t < 3600_000); // retain max 1 hour
      if (active.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, active);
      }
    }
  }

  consume(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const timestamps = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= limit) {
      const earliest = timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((earliest + windowMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        resetAt: earliest + windowMs,
      };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    return {
      allowed: true,
      remaining: Math.max(0, limit - timestamps.length),
      retryAfterSeconds: 0,
      resetAt: timestamps[0] + windowMs,
    };
  }

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const timestamps = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (timestamps.length >= limit) {
      const earliest = timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((earliest + windowMs - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        resetAt: earliest + windowMs,
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - timestamps.length),
      retryAfterSeconds: 0,
      resetAt: timestamps.length > 0 ? timestamps[0] + windowMs : now + windowMs,
    };
  }

  recordFailure(key: string, windowMs: number): RateLimitResult {
    const now = Date.now();
    const timestamps = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    timestamps.push(now);
    this.hits.set(key, timestamps);
    return {
      allowed: true,
      remaining: 0,
      retryAfterSeconds: 0,
      resetAt: timestamps[0] + windowMs,
    };
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  clear(): void {
    this.hits.clear();
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global default store instance
export const defaultRateLimiterStore = new InMemoryRateLimiterStore();

/**
 * Standard loopback and private subnets typically used by reverse proxies,
 * container platforms (e.g. Railway, Docker), and internal load balancers.
 */
export const DEFAULT_TRUSTED_PROXY_RANGES: readonly string[] = [
  // Loopback (IPv4 & IPv6)
  "127.0.0.0/8",
  "::1/128",
  // Private subnets (RFC 1918)
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  // Carrier-Grade NAT (RFC 6598 - used extensively by Railway/Envoy internal routing)
  "100.64.0.0/10",
  // Link-Local (RFC 3927 & RFC 4291)
  "169.254.0.0/16",
  "fe80::/10",
  // Unique Local (RFC 4193)
  "fc00::/7",
] as const;

/**
 * Official Cloudflare Anycast edge IP ranges (IPv4 and IPv6).
 */
export const CLOUDFLARE_PROXY_RANGES: readonly string[] = [
  // IPv4
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
  // IPv6
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
] as const;

/**
 * Normalizes an IP string:
 * - Trims whitespace
 * - Strips enclosing brackets and port if present (e.g. "[2001:db8::1]:8080" -> "2001:db8::1")
 * - Strips port on IPv4 (e.g. "192.168.1.1:8080" -> "192.168.1.1")
 * - Strips IPv4-mapped IPv6 prefix ("::ffff:192.168.1.1" -> "192.168.1.1")
 * - Validates using net.isIP()
 * - Returns normalized lowercase IP, or null if malformed or invalid
 */
export function normalizeIp(rawIp: unknown): string | null {
  if (typeof rawIp !== "string") return null;
  let ip = rawIp.trim();
  if (!ip) return null;

  // Bracket notation for IPv6 with optional port: [2001:db8::1]:8080 -> 2001:db8::1
  if (ip.startsWith("[") && ip.includes("]")) {
    const bracketEnd = ip.indexOf("]");
    ip = ip.slice(1, bracketEnd);
  } else if (ip.includes(":") && !ip.includes("::")) {
    // Check if it's IPv4 with a trailing port: 192.168.1.1:8080
    const parts = ip.split(":");
    if (parts.length === 2 && isIPv4(parts[0])) {
      ip = parts[0];
    }
  }

  // Strip IPv4-mapped IPv6 prefix: ::ffff:192.168.1.1 -> 192.168.1.1
  const lower = ip.toLowerCase();
  if (lower.startsWith("::ffff:")) {
    const mapped = ip.slice(7);
    if (isIPv4(mapped)) {
      return mapped;
    }
  }

  if (isIP(ip) === 0) {
    return null;
  }

  return lower;
}

/**
 * Convert IPv4 string to 32-bit unsigned integer.
 */
function ipv4ToInt(ip: string): number | null {
  if (!isIPv4(ip)) return null;
  const octets = ip.split(".").map((o) => parseInt(o, 10));
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
    return null;
  }
  return (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
}

/**
 * Convert IPv6 string to 128-bit BigInt.
 */
function ipv6ToBigInt(ip: string): bigint | null {
  if (!isIPv6(ip)) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;

  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];

  const missing = 8 - (left.length + right.length);
  if (missing < 0) return null;

  const middle = new Array(missing).fill("0");
  const groups = [...left, ...middle, ...right];
  if (groups.length !== 8) return null;

  let result = 0n;
  for (const g of groups) {
    const val = parseInt(g, 16);
    if (Number.isNaN(val) || val < 0 || val > 0xffff) return null;
    result = (result << 16n) | BigInt(val);
  }
  return result;
}

/**
 * Tests whether a normalized IP address falls within a given CIDR block or matches an IP.
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const normIp = normalizeIp(ip);
  if (!normIp) return false;

  const trimmedCidr = cidr.trim();
  if (!trimmedCidr.includes("/")) {
    const normCidrIp = normalizeIp(trimmedCidr);
    return normCidrIp !== null && normIp === normCidrIp;
  }

  const [rangeStr, prefixStr] = trimmedCidr.split("/");
  const normRange = normalizeIp(rangeStr);
  if (!normRange) return false;

  const prefix = parseInt(prefixStr, 10);
  if (Number.isNaN(prefix) || prefix < 0) return false;

  const isV4 = isIPv4(normIp);
  const isRangeV4 = isIPv4(normRange);

  if (isV4 && isRangeV4) {
    if (prefix > 32) return false;
    const ipInt = ipv4ToInt(normIp);
    const rangeInt = ipv4ToInt(normRange);
    if (ipInt === null || rangeInt === null) return false;
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
  }

  const isV6 = isIPv6(normIp);
  const isRangeV6 = isIPv6(normRange);

  if (isV6 && isRangeV6) {
    if (prefix > 128) return false;
    const ipBig = ipv6ToBigInt(normIp);
    const rangeBig = ipv6ToBigInt(normRange);
    if (ipBig === null || rangeBig === null) return false;
    const mask =
      prefix === 0
        ? 0n
        : ((1n << 128n) - 1n) ^ ((1n << (128n - BigInt(prefix))) - 1n);
    return (ipBig & mask) === (rangeBig & mask);
  }

  return false;
}

/**
 * Check whether an IP belongs to Cloudflare's published edge ranges.
 */
export function isCloudflareIp(ip: string | undefined): boolean {
  if (!ip) return false;
  const norm = normalizeIp(ip);
  if (!norm) return false;
  return CLOUDFLARE_PROXY_RANGES.some((cidr) => isIpInCidr(norm, cidr));
}

export type ProxyTrustConfig = {
  enabled: boolean;
  trustedRanges?: string[];
  trustCloudflare?: boolean;
};

export type ProxyTrustOption =
  | boolean
  | string
  | string[]
  | ProxyTrustConfig;

/**
 * Determines whether a remote IP address belongs to a verified trusted proxy.
 */
export function isTrustedProxy(
  remoteAddress: string | undefined,
  option: ProxyTrustOption = false,
): boolean {
  const normIp = normalizeIp(remoteAddress);
  if (!normIp) return false;

  if (option === false) {
    return false;
  }

  if (option === true) {
    // When enabled as true, trust standard internal/loopback reverse proxies
    return DEFAULT_TRUSTED_PROXY_RANGES.some((cidr) => isIpInCidr(normIp, cidr));
  }

  if (typeof option === "string") {
    const trimmed = option.trim().toLowerCase();
    if (trimmed === "false" || trimmed === "0" || trimmed === "none") {
      return false;
    }
    if (trimmed === "true" || trimmed === "1") {
      return DEFAULT_TRUSTED_PROXY_RANGES.some((cidr) => isIpInCidr(normIp, cidr));
    }
    if (trimmed === "cloudflare") {
      return (
        DEFAULT_TRUSTED_PROXY_RANGES.some((cidr) => isIpInCidr(normIp, cidr)) ||
        isCloudflareIp(normIp)
      );
    }
    const ranges = trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    return ranges.some((cidr) => isIpInCidr(normIp, cidr));
  }

  if (Array.isArray(option)) {
    return option.some((cidr) => isIpInCidr(normIp, cidr));
  }

  if (typeof option === "object" && option !== null) {
    if (!option.enabled) return false;
    const ranges = option.trustedRanges ?? DEFAULT_TRUSTED_PROXY_RANGES;
    if (ranges.some((cidr) => isIpInCidr(normIp, cidr))) {
      return true;
    }
    if (option.trustCloudflare && isCloudflareIp(normIp)) {
      return true;
    }
    return false;
  }

  return false;
}

/**
 * Resolves the client IP safely according to the trustProxy configuration.
 *
 * Security Boundaries:
 * 1. If trustProxy is disabled (false), all forwarding headers are ignored, binding to socket.remoteAddress.
 * 2. If trustProxy is enabled, the immediate peer (socket.remoteAddress) MUST be a verified trusted proxy.
 *    If the socket address is NOT in the trusted proxy set, all forwarding headers are ignored (direct untrusted request).
 * 3. Forwarded headers (X-Forwarded-For, CF-Connecting-IP) are validated and normalized.
 *    Any malformed or ambiguous IP entry in forwarded headers causes that header to be rejected.
 *    Unauthenticated X-Real-IP headers are strictly ignored and never accepted as client identity.
 * 4. In X-Forwarded-For, traversal is right-to-left: the first non-trusted IP encountered from the right
 *    is the client IP that connected to the trusted proxy chain.
 * 5. CF-Connecting-IP is only trusted if the request arrived from or traversed a verified Cloudflare proxy.
 */
export function resolveClientIp(
  request: IncomingMessage,
  trustProxy: ProxyTrustOption = false,
): string {
  const rawSocketIp = request.socket?.remoteAddress;
  const socketIp = normalizeIp(rawSocketIp);

  if (!socketIp) {
    // Missing or invalid socket IP: return safe fallback without trusting forwarded headers
    return "127.0.0.1";
  }

  // Check if proxy trust is enabled AND the immediate connection is from a verified trusted proxy
  const socketIsTrusted = isTrustedProxy(socketIp, trustProxy);
  if (!socketIsTrusted) {
    // Immediate connection is NOT a trusted proxy; untrusted client connected directly.
    // Strictly ignore all forwarding headers to prevent header-based spoofing.
    return socketIp;
  }

  // Socket is trusted; inspect forwarded headers
  let candidateClientIp: string | null = null;
  const socketIsCloudflare = isCloudflareIp(socketIp);
  let upstreamProxyIsCloudflare = socketIsCloudflare;

  // Check X-Forwarded-For
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    const rawParts = forwarded.split(",");
    const parsedIps: string[] = [];
    let malformed = false;

    for (const raw of rawParts) {
      const norm = normalizeIp(raw);
      if (!norm) {
        malformed = true;
        break;
      }
      parsedIps.push(norm);
    }

    if (!malformed && parsedIps.length > 0) {
      // Right-to-left traversal: the rightmost non-trusted entry is the authentic client
      for (let i = parsedIps.length - 1; i >= 0; i--) {
        const ip = parsedIps[i];
        const isCf = isCloudflareIp(ip);
        if (isCf) {
          upstreamProxyIsCloudflare = true;
        }

        const isTrusted = isTrustedProxy(ip, trustProxy) || isCf;
        if (!isTrusted) {
          candidateClientIp = ip;
          break;
        }
      }

      // If all were trusted proxies, take the leftmost as the initiating client
      if (!candidateClientIp && parsedIps.length > 0) {
        candidateClientIp = parsedIps[0];
      }
    }
  }

  // Check CF-Connecting-IP:
  // Only accept if:
  // 1. Header exists and is a valid normalized IP
  // 2. Cloudflare trust mode is enabled (trustProxy === "cloudflare" or trustProxy === true)
  // 3. The connection legitimately traversed Cloudflare:
  //    - socket is directly from Cloudflare, OR
  //    - socket is a trusted proxy AND a verified Cloudflare proxy is in the chain AND candidateClientIp is a non-Cloudflare client.
  //    CRITICAL: Never accept CF-Connecting-IP on a direct Railway request where upstreamProxyIsCloudflare === false.
  const cfIp = request.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) {
    const isCloudflareTrustMode =
      trustProxy === "cloudflare" ||
      (typeof trustProxy === "string" && trustProxy.toLowerCase() === "cloudflare") ||
      (typeof trustProxy === "object" && trustProxy !== null && "trustCloudflare" in trustProxy && Boolean(trustProxy.trustCloudflare));

    const legitimateCloudflare =
      socketIsCloudflare ||
      (upstreamProxyIsCloudflare && candidateClientIp !== null && !isCloudflareIp(candidateClientIp));

    if (legitimateCloudflare && (isCloudflareTrustMode || trustProxy === true)) {
      const normCf = normalizeIp(cfIp);
      if (normCf) {
        return normCf;
      }
    }
  }

  if (candidateClientIp) {
    return candidateClientIp;
  }

  return socketIp;
}

/**
 * Cryptographically hashes identifiers (emails, reset tokens) so sensitive
 * user data is never stored in plaintext within in-memory rate-limiter keys or debug logs.
 */
export function hashIdentifier(identifier: string): string {
  return createHash("sha256")
    .update(identifier.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

/**
 * Baseline rate-limiting policies for authentication endpoints.
 */
export const AUTH_RATE_LIMITS = {
  login: {
    perAccountFailures: { windowMs: 60_000, max: 5 }, // 5 failed attempts per min per account/IP
    perIpAbuse: { windowMs: 60_000, max: 30 },        // 30 total login attempts per min per IP
  },
  forgotPassword: {
    perAccount: { windowMs: 15 * 60_000, max: 3 },     // 3 requests per 15m per account/IP
    perIp: { windowMs: 15 * 60_000, max: 15 },         // 15 requests per 15m per IP
  },
  resetPassword: {
    perAccount: { windowMs: 15 * 60_000, max: 5 },     // 5 attempts per 15m per account/IP
    perIp: { windowMs: 15 * 60_000, max: 15 },         // 15 attempts per 15m per IP
  },
  registration: {
    perIp: { windowMs: 60 * 60_000, max: 5 },          // 5 attempts per hour per IP
  },
} as const;

/**
 * Helper to assert rate limits and throw ApiError(429) if exceeded.
 */
export function assertRateLimit(
  result: RateLimitResult,
  customMessage = "Too many requests. Please try again later.",
): void {
  if (!result.allowed) {
    throw new ApiError(429, "TOO_MANY_REQUESTS", customMessage, {
      retryAfter: result.retryAfterSeconds,
    });
  }
}
