# HAZA AIOS — Epic 10N: RB-002A Trusted Proxy Source-Code Correction & Hardening

**Document ID:** `HAZA-AIOS-EPIC10N-RB002A-001`  
**Repository:** `HAZA-AIOS/haza-aios`  
**Branch:** `feature/epic-10n-system-hardening`  
**Target Checkpoint:** RB-002A Controlled Security Correction  
**Baseline Release Candidate:** `6a6ff9c5b44310aadbba196fe488d1373967792d`  
**Production Baseline:** `eb6c5d9df71c12a975b462418ae0d6fdf5a89113`  
**Status:** **SOURCE CODE REMEDIATED & VERIFIED (PENDING RB-002B PRODUCTION ACTIVATION)**

> [!CRITICAL]
> **GOVERNANCE & SAFETY NOTICE**  
> **RB-002A source correction passing does NOT mean RB-002 production security has passed.**  
> RB-002A rectifies the application-level type-coercion defect, preserves explicit proxy trust modes, and hardens client-IP resolution with fail-closed security properties. RB-002 remains **BLOCKED** until the operator performs live verification of direct-origin isolation in the Railway console and activates `TRUST_PROXY=cloudflare` (RB-002B).

---

## 1. Original Type-Coercion Defect & Root Cause

During the RB-002 read-only security investigation, a type-coercion defect was identified in [`apps/api/src/config/env.ts`](file:///c:/HAZA-APPS/HAZA-AIOS/apps/api/src/config/env.ts):

```typescript
// DEFECTIVE IMPLEMENTATION:
export type ApiConfig = {
  ...
  trustProxy: boolean; // <-- Typed strictly as boolean
};

const trustProxy =
  env.TRUST_PROXY !== undefined
    ? env.TRUST_PROXY === "true" ||
      env.TRUST_PROXY === "1" ||
      env.TRUST_PROXY === "cloudflare" // <-- Collapsed "cloudflare" into boolean true
    : false;
```

### Consequences of the Defect:
1. Setting `TRUST_PROXY="cloudflare"` coerced `config.trustProxy` into boolean `true`.
2. Inside [`apps/api/src/middleware/rate-limiter.ts`](file:///c:/HAZA-APPS/HAZA-AIOS/apps/api/src/middleware/rate-limiter.ts), the check:
   ```typescript
   const trustExplicitCloudflare =
     typeof trustProxy === "string" && trustProxy.toLowerCase() === "cloudflare";
   ```
   evaluated to `false` at runtime because `typeof trustProxy` was `"boolean"`.
3. Conversely, if `trustProxy` had been passed as `"cloudflare"` without chain verification, an earlier branch in `rate-limiter.ts` (`if (upstreamProxyIsCloudflare || trustExplicitCloudflare)`) would have accepted `CF-Connecting-IP` even when `upstreamProxyIsCloudflare` was `false` (i.e. on direct Railway traffic), allowing header spoofing on direct ingress.

---

## 2. Corrected Configuration Semantics & Contract

The configuration contract in [`apps/api/src/config/env.ts`](file:///c:/HAZA-APPS/HAZA-AIOS/apps/api/src/config/env.ts) was updated with strict typing:

```typescript
export type TrustProxySetting = boolean | "cloudflare";

export type ApiConfig = {
  ...
  trustProxy: TrustProxySetting;
};
```

### Supported Environment Variable Values:
| `TRUST_PROXY` Value | Normalized Value | Mode Description |
| :--- | :--- | :--- |
| *Unset / Missing / Empty* | `false` | Proxy trust disabled. All headers ignored; binds to immediate socket IP. **Default in all environments**. |
| `"false"` | `false` | Explicitly disabled. |
| `"0"` | `false` | Explicitly disabled (standard Unix / shell convention). |
| `"true"` | `true` | Generic trusted reverse proxy mode (RFC 1918 / loopback / CGNAT). |
| `"1"` | `true` | Generic trusted reverse proxy mode (standard Unix convention). |
| `"cloudflare"` | `"cloudflare"` | **Explicit Cloudflare edge mode**. `CF-Connecting-IP` accepted only if upstream proxy chain legitimately traversed Cloudflare Anycast edge. |
| *Any other value* | **REJECTED** | Startup error thrown: `Invalid TRUST_PROXY configuration: "<val>". Supported values: "true", "false", "1", "0", "cloudflare"`. Never silently defaults to true. |

---

## 3. Client-IP Trust Boundary Hardening

The client-IP resolution engine in [`apps/api/src/middleware/rate-limiter.ts`](file:///c:/HAZA-APPS/HAZA-AIOS/apps/api/src/middleware/rate-limiter.ts) enforces six core security properties:

### Property A — Untrusted Socket (Fail-Closed)
If `request.socket?.remoteAddress` does not belong to an approved trusted proxy range (`DEFAULT_TRUSTED_PROXY_RANGES` or `CLOUDFLARE_PROXY_RANGES`), all forwarding headers (`X-Forwarded-For`, `CF-Connecting-IP`, `X-Real-IP`) are strictly ignored, and the raw socket IP is returned.

### Property B — Missing Socket Fallback
If `request.socket?.remoteAddress` is missing, undefined, or malformed, the resolver immediately returns `"127.0.0.1"` without inspecting any forwarding headers.

### Property C — Right-to-Left Traversal & Chain Verification
`X-Forwarded-For` is parsed from right to left. The rightmost IP represents the client that connected to the immediate trusted proxy:
- If an untrusted IP is encountered from the right, traversal terminates immediately.
- A forged Cloudflare IP placed by an attacker to the left of their real IP is never reached and cannot authenticate the proxy chain.

### Property D — Direct Railway Ingress Protection
On direct ingress via Railway's generated domain (`api-production-367e.up.railway.app`):
- Railway Edge appends the attacker's public IP to `X-Forwarded-For`.
- The rightmost hop is the attacker's untrusted IP (not Cloudflare).
- `upstreamProxyIsCloudflare` remains `false`.
- `CF-Connecting-IP` is **strictly rejected**.
- The resolver returns the attacker's real public IP, preventing rate-limit spoofing.

### Property E — Cloudflare Ingress Resolution
For legitimate Cloudflare requests entering via `api.haza-aios.com`:
- The rightmost hop in `X-Forwarded-For` is a verified Cloudflare Anycast IP (`173.245.48.0/20`, etc.).
- `upstreamProxyIsCloudflare` evaluates to `true`.
- `CF-Connecting-IP` is verified, normalized, and returned as the authoritative client IP.

### Property F — Rate-Limiter Consistency
Both authentication and registration rate limiters utilize `resolveClientIp(request, config.trustProxy)`. Individual users receive isolated rate-limiting buckets without grouping unrelated users into the shared Railway proxy bucket.

---

## 4. Security Regression Test Evidence (TP-001 to TP-018)

All 18 scenarios mandated by the specification were implemented in [`apps/api/tests/epic10n-security-hardening.integration.test.ts`](file:///c:/HAZA-APPS/HAZA-AIOS/apps/api/tests/epic10n-security-hardening.integration.test.ts) and passed 100%:

| ID | Test Scenario | Verified Expected Result | Status |
| :--- | :--- | :--- | :---: |
| **TP-001** | `TRUST_PROXY` unset | `config.trustProxy === false` (disabled) | **PASS** |
| **TP-002** | `TRUST_PROXY=false` | `config.trustProxy === false` (disabled) | **PASS** |
| **TP-003** | `TRUST_PROXY=true` | `config.trustProxy === true` (explicit boolean mode) | **PASS** |
| **TP-004** | `TRUST_PROXY=cloudflare` | `config.trustProxy === "cloudflare"` (Cloudflare mode preserved) | **PASS** |
| **TP-005** | Invalid `TRUST_PROXY` value | Throws descriptive startup configuration error | **PASS** |
| **TP-006** | Untrusted socket with forged headers | All forwarding headers ignored; returns socket IP | **PASS** |
| **TP-007** | Trusted proxy with valid, verified chain | Extracts authentic client IP from verified Cloudflare chain | **PASS** |
| **TP-008** | Direct Railway request with forged CF header | Forged `CF-Connecting-IP` ignored; returns attacker real IP | **PASS** |
| **TP-009** | Forged Cloudflare CIDR inside XFF | Traversal stops at untrusted IP; no false authentication of chain | **PASS** |
| **TP-010** | Malformed `CF-Connecting-IP` | Safe fallback to valid candidate client IP | **PASS** |
| **TP-011** | Malformed `X-Forwarded-For` | Safe fallback to socket IP | **PASS** |
| **TP-012** | IPv4 address | Correct normalization and port stripping | **PASS** |
| **TP-013** | IPv6 address | Correct normalization and bracket stripping | **PASS** |
| **TP-014** | IPv4-mapped IPv6 | Stripped of `::ffff:` and normalized to IPv4 | **PASS** |
| **TP-015** | Missing socket information | Safe fallback to `127.0.0.1` without trusting headers | **PASS** |
| **TP-016** | Distinct clients through verified proxy | Distinct clients receive independent rate-limit keys | **PASS** |
| **TP-017** | One client exceeds rate limit | Other clients remain completely unaffected | **PASS** |
| **TP-018** | Security headers with explicit proxy mode | HSTS emitted only on verified HTTPS across trusted proxy | **PASS** |

---

## 5. Remaining Infrastructure Assumptions & Unverified Behaviors

While the source-code remediation is complete, the following infrastructure facts remain unverified without production console access:
1. **Direct Railway Domain Existence:** `api-production-367e.up.railway.app` is confirmed publicly reachable. It must be manually deleted in the Railway dashboard.
2. **Railway Edge Header Handling:** Assumed Railway's edge router appends the remote connecting IP to `X-Forwarded-For`. If Railway were configured to overwrite or omit XFF, client IP extraction would fail closed to socket IP.
3. **Cloudflare Orange Cloud Active:** Assumed Cloudflare proxy status remains active (Orange Cloud) for `api.haza-aios.com`.

---

## 6. Required RB-002B Operational Verification Checklist

Before activating `TRUST_PROXY=cloudflare` in production:
- [ ] **Step 1:** Operator logs in to Railway Dashboard -> Project `haza-aios` -> Service `api` -> **Settings** -> **Public Networking**.
- [ ] **Step 2:** Locate public domain `api-production-367e.up.railway.app` and **delete it**. Confirm custom domain `api.haza-aios.com` remains active.
- [ ] **Step 3:** In browser, confirm `https://api-production-367e.up.railway.app` is no longer reachable.
- [ ] **Step 4:** Navigate to Railway **Variables** tab and set `TRUST_PROXY=cloudflare`.
- [ ] **Step 5:** Verify live container startup logs for zero configuration errors and normal readiness healthcheck responses.
