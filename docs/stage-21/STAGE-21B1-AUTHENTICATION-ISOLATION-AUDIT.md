# HAZA AIOS — STAGE 21B.1
## AUTHENTICATION, COOKIE & CORS ISOLATION AUDIT

**Document ID:** HAZA-AIOS-STG-21B1-AUD-003  
**Version:** 1.0  
**Date:** October 14, 2026  
**Status:** Complete  
**Classification:** Internal — Security & Architecture Audit  
**Auditor:** HAZA AIOS Core Agent (Antigravity)  

---

## 1. Executive Summary

This audit investigates the end-to-end authentication flow between the proposed staging frontend (`https://staging.haza-aios.com`) and staging API (`https://api-staging.haza-aios.com`).

**Key Architectural Finding:**
In Stage 21A's configuration template, `SESSION_COOKIE_DOMAIN=staging.haza-aios.com` was proposed. **Setting `Domain=staging.haza-aios.com` on an API hosted at `api-staging.haza-aios.com` will cause authentication failure**, because modern browsers strictly prohibit an origin (`api-staging.haza-aios.com`) from setting a cookie whose domain is a sibling subdomain (`staging.haza-aios.com`), and browsers will refuse to send a `staging.haza-aios.com` cookie to `api-staging.haza-aios.com`.

This audit establishes the correct cookie and CORS architecture that preserves full session isolation without causing silent authentication rejections.

---

## 2. Deep-Dive Code Inspection

### 2.1 Cookie Construction (`apps/api/src/modules/auth/services/token.service.ts`)
```typescript
export const sessionCookieName = "haza_session";

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
```
**Observations:**
1. **Host-Only by Default:** Notice that `buildSessionCookie` deliberately omits the `Domain` attribute. Under RFC 6265, omitting `Domain` makes the cookie **Host-Only** (bound exclusively to the exact hostname of the server responding with `Set-Cookie`).
2. **Hardcoded Name:** The cookie name `haza_session` is hardcoded as a module constant. It does not read from `config`.

### 2.2 Client-Side Request Flow (`apps/web/src/api/api-client.ts`)
```typescript
const response = await fetch(`${this.baseUrl}${path}`, {
  ...options,
  credentials: "include",
  headers,
});
```
**Observations:**
1. The web client explicitly specifies `credentials: "include"`.
2. The client supports dual auth: it sends `Authorization: Bearer <authToken>` if provided, and falls back to browser credential cookies.

### 2.3 CORS Enforcement (`apps/api/src/middleware/cors.ts`)
```typescript
export function applyCors(request: IncomingMessage, response: ServerResponse, config: ApiConfig) {
  const origin = request.headers.origin;

  if (origin && config.webOrigins.includes(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("access-control-allow-credentials", "true");
    response.setHeader("vary", "Origin");
  }
  // ...
}
```
**Observations:**
1. `access-control-allow-credentials: "true"` is properly returned for matched origins.
2. Wildcard `*` is not used, satisfying browser credentialed CORS constraints.

---

## 3. Cookie Domain & SameSite Mechanics

### 3.1 Why `Domain=staging.haza-aios.com` Fails
If `api-staging.haza-aios.com` emits:
`Set-Cookie: haza_session=...; Domain=staging.haza-aios.com; Path=/`
1. The browser rejects this cookie immediately (Domain attribute must match or be a parent domain of the responding origin). `staging.haza-aios.com` is a sibling, not a parent of `api-staging.haza-aios.com`.
2. Even if set on the parent `Domain=.haza-aios.com`, the cookie would leak to `www.haza-aios.com` and `api.haza-aios.com` (production!), violating the core staging isolation rule.

### 3.2 The Safe Architecture: Host-Only Cookie with Same-Site Lax
Because both `staging.haza-aios.com` and `api-staging.haza-aios.com` share the registrable domain (eTLD+1) `haza-aios.com`:
1. Under Schemeful Same-Site rules, requests between `https://staging.haza-aios.com` and `https://api-staging.haza-aios.com` are considered **Same-Site**.
2. When the API at `https://api-staging.haza-aios.com` issues a **host-only** cookie:
   `Set-Cookie: haza_session_staging=...; HttpOnly; Path=/; SameSite=Lax; Secure`
   - The browser stores it associated strictly with `api-staging.haza-aios.com`.
   - When `https://staging.haza-aios.com` fetches `https://api-staging.haza-aios.com` with `credentials: "include"`, the browser attaches the cookie because the destination URL matches the cookie host!
   - Production (`api.haza-aios.com`) never sees this cookie.
   - Production browser sessions cannot be overwritten or collided with.

---

## 4. Parameterizing Cookie Name (Recommended Remediation)

To prevent developer confusion and local test collisions:
1. Make `sessionCookieName` configurable via `config.sessionCookieName`.
2. Default in production: `haza_session`.
3. Default in staging: `haza_session_staging`.
4. In `buildExpiredSessionCookie()`, use the configured cookie name to ensure logouts clear the staging cookie cleanly.

---

## 5. Security & CSRF Evaluation

1. **HttpOnly:** Guaranteed in `buildSessionCookie` (prevents XSS exfiltration of session token).
2. **Secure:** Enabled whenever `secure: true` (which evaluates to true under HTTPS staging).
3. **SameSite=Lax:** Protects against cross-site CSRF attacks while allowing normal navigation.
4. **Signatures & Token Storage:** Sessions are stored as SHA-256 hashes in MySQL (`authSessions` table). Zero raw tokens reside in the database.
