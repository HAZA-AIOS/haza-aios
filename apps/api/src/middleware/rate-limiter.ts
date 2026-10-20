import type { IncomingMessage } from "node:http";
import { createHash } from "node:crypto";
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
 * Resolves the client IP safely according to the trustProxy configuration.
 * When trustProxy is disabled, any client-supplied X-Forwarded-For or X-Real-IP
 * headers are strictly ignored, binding exclusively to socket.remoteAddress.
 */
export function resolveClientIp(
  request: IncomingMessage,
  trustProxy: boolean = false,
): string {
  if (trustProxy) {
    const cfIp = request.headers["cf-connecting-ip"];
    if (typeof cfIp === "string" && cfIp.trim()) {
      return cfIp.trim();
    }

    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        // In a single-hop reverse proxy environment (e.g., Railway / Nginx),
        // the client IP is the rightmost IP appended by the reverse proxy.
        return parts[parts.length - 1];
      }
    }

    const realIp = request.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) {
      return realIp.trim();
    }
  }

  return request.socket.remoteAddress || "127.0.0.1";
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
    perAccountFailures: { windowMs: 60_000, max: 5 },  // 5 failed attempts per min per account/IP
    perIpAbuse: { windowMs: 60_000, max: 30 },         // 30 total login attempts per min per IP
  },
  forgotPassword: {
    perAccount: { windowMs: 15 * 60_000, max: 3 },      // 3 requests per 15m per account/IP
    perIp: { windowMs: 15 * 60_000, max: 15 },          // 15 requests per 15m per IP
  },
  resetPassword: {
    perAccount: { windowMs: 15 * 60_000, max: 5 },      // 5 attempts per 15m per account/IP
    perIp: { windowMs: 15 * 60_000, max: 15 },          // 15 attempts per 15m per IP
  },
  registration: {
    perIp: { windowMs: 60 * 60_000, max: 5 },           // 5 attempts per hour per IP
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
