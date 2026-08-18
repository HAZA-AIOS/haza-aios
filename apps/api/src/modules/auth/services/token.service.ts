import { createHash, randomBytes } from "node:crypto";

export const sessionCookieName = "haza_session";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildSessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  return [
    `${sessionCookieName}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function buildExpiredSessionCookie(): string {
  return `${sessionCookieName}=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
