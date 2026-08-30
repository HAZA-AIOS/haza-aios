# Authentication Architecture

**Epic:** 3 — Authentication & Identity  
**Status:** Complete (mock adapter, pending real backend connection)  
**Branch:** `feature/authentication-identity`

---

## Overview

HAZA AIOS authentication is built as a strict vertical slice:

```
UI (pages + components)
        ↓
  AuthProvider  (React context, useAuth, useCurrentUser)
        ↓
  Auth Service  (auth-service.ts — currently a mock adapter)
        ↓
  API Client    (api-client.ts — fetch wrapper with 401 handling)
        ↓
  Backend Authentication API  (not yet connected)
```

Each layer has a single responsibility. The UI never calls the API client directly, and authentication logic is never scattered across individual pages.

---

## Layer Descriptions

### UI Layer

| File                                             | Purpose                                                        |
| ------------------------------------------------ | -------------------------------------------------------------- |
| `apps/web/src/pages/auth/LoginPage.tsx`          | Login form                                                     |
| `apps/web/src/pages/auth/RegisterPage.tsx`       | User registration form                                         |
| `apps/web/src/pages/auth/ForgotPasswordPage.tsx` | Request password reset                                         |
| `apps/web/src/pages/auth/ResetPasswordPage.tsx`  | Set new password via token                                     |
| `apps/web/src/pages/auth/VerifyEmailPage.tsx`    | Email verification status                                      |
| `apps/web/src/pages/auth/AuthShell.tsx`          | App-specific layout wrapper (wires `AuthLayout` to the router) |
| `apps/web/src/pages/app/ProtectedAppPage.tsx`    | Protected route placeholder                                    |

All reusable auth UI primitives live in `packages/ui` (see [Shared Components](#shared-components)).

### Authentication State (AuthProvider)

**File:** `apps/web/src/auth/AuthProvider.tsx`

The `AuthProvider` wraps the application root and manages the single source of truth for authentication state.

```tsx
<AuthProvider>
  <App />
</AuthProvider>
```

Exported hooks:

| Hook               | Returns                                                                        |
| ------------------ | ------------------------------------------------------------------------------ |
| `useAuth()`        | Full auth context (`status`, `user`, `session`, `error`, `login`, `logout`, …) |
| `useCurrentUser()` | `User                                                                          | null` — convenience shorthand |

Auth status values:

| Status              | Meaning                                           |
| ------------------- | ------------------------------------------------- |
| `"loading"`         | Session is being checked (initial mount)          |
| `"authenticated"`   | Valid session; `user` and `session` are populated |
| `"unauthenticated"` | No valid session                                  |
| `"error"`           | An auth operation failed                          |

### Auth Service Layer

**File:** `apps/web/src/auth/auth-service.ts`

The service layer implements the `AuthService` interface:

```ts
type AuthService = {
  getCurrentUser: () => Promise<AuthResult | null>;
  login: (input: LoginInput) => Promise<AuthResult>;
  register: (input: RegisterInput) => Promise<AuthResult>;
  logout: () => Promise<void>;
  forgotPassword: (input: ForgotPasswordInput) => Promise<void>;
  resetPassword: (input: ResetPasswordInput) => Promise<void>;
  verifyEmail: (token: string) => Promise<AuthResult | null>;
};
```

The current implementation is `mockAuthService` — a local adapter that validates inputs and stores sessions in `localStorage`/`sessionStorage`. When the backend API is ready, a real `apiAuthService` can be swapped in without changing any layer above it.

### API Client Layer

**File:** `apps/web/src/api/api-client.ts`

A thin `fetch` wrapper (`ApiClient`) that:

- Prepends the configured `VITE_API_BASE_URL`
- Injects `Authorization: Bearer <token>` when `authToken` is provided
- Throws `ApiError` on non-2xx responses
- Calls the `onUnauthorized` callback on HTTP 401 (enabling global session expiry handling)
- Handles `204 No Content` responses

---

## Identity Model

**Files:** `apps/web/src/auth/identity.types.ts`, `apps/web/src/auth/auth.types.ts`

### User

```ts
type User = {
  id: string; // UUID
  firstName: string;
  lastName: string;
  displayName: string; // derived: firstName + lastName
  email: string;
  avatar?: string; // URL, optional
  emailVerified: boolean;
  status: "active" | "invited" | "suspended";
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};
```

### AuthSession

Session information is deliberately kept separate from profile information:

```ts
type AuthSession = {
  id: string; // session UUID
  userId: string; // references User.id
  accessToken: string; // bearer token for API requests
  expiresAt: string; // ISO 8601 expiry
  rememberMe: boolean; // controls localStorage vs sessionStorage
};
```

### Future Stubs (not yet implemented)

```ts
type Organization = {
  id: string;
  name: string;
};

type OrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
  permissions: Permission[];
};
```

> **Note:** Organization registration is **not** part of Epic 3. It belongs to the next relevant epic. The types above are stubs to ensure the identity model is extensible.

---

## Session Model

Sessions are stored in the browser using `auth-storage.ts`:

| Condition                      | Storage          |
| ------------------------------ | ---------------- |
| `session.rememberMe === true`  | `localStorage`   |
| `session.rememberMe === false` | `sessionStorage` |

On page load, `AuthProvider` calls `getCurrentUser()` which reads from storage, validates the `expiresAt` timestamp, and clears the session if it has expired.

The session key is `haza-aios.auth.session`.

---

## Route Protection

**File:** `apps/web/src/routes/router.tsx`

```
Public routes:     /   /login  /register  /forgot-password  /reset-password  /verify-email
Protected routes:  /app  (and all future application routes)
```

Two route guard components:

| Component           | Behavior                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `<ProtectedRoute>`  | Shows `AuthLoading` while loading. Redirects to `/login` when unauthenticated. Renders children when authenticated. |
| `<PublicOnlyRoute>` | Redirects to `/app` when already authenticated. Prevents logged-in users from seeing the login page.                |

**Usage:**

```tsx
// Protected
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>

// Public-only (redirect if already logged in)
<PublicOnlyRoute>
  <LoginPage />
</PublicOnlyRoute>
```

---

## Shared Components

All reusable auth UI lives in `packages/ui`:

| Component          | Path                               | Purpose                                                                                              |
| ------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `AuthLayout`       | `components/auth-layout.tsx`       | Router-agnostic two-column layout (hero + form card). Accepts `logoSlot` and `navSlot` render props. |
| `AuthCard`         | `components/auth-card.tsx`         | Glass card that wraps the auth form with eyebrow, title, and description.                            |
| `AuthAlert`        | `components/auth-alert.tsx`        | `error` / `success` / `info` inline alert. Accessible (`role="alert"` / `role="status"`).            |
| `AuthLoading`      | `components/auth-loading.tsx`      | Spinning indicator for session checks and async operations.                                          |
| `FormField`        | `components/form-field.tsx`        | Label + field + description + error message wrapper. Manages `aria-describedby` and `aria-invalid`.  |
| `PasswordField`    | `components/password-field.tsx`    | Input with accessible show/hide toggle.                                                              |
| `PasswordStrength` | `components/password-strength.tsx` | 5-bar visual strength indicator with `aria-live`.                                                    |

Client-side validation utilities (not a UI component, but shared within `apps/web`):

- **`auth-validation.ts`** — `validateEmail`, `validatePassword`, `validateName`, `validatePasswordMatch`, `validateResetToken`

---

## Security Boundaries

| Rule                           | Implementation                                                              |
| ------------------------------ | --------------------------------------------------------------------------- |
| No passwords in frontend code  | Passwords are sent to the auth service and never stored.                    |
| No secrets in `VITE_` env vars | Only `VITE_API_BASE_URL` is exposed; no tokens or secrets.                  |
| No hard-coded credentials      | Mock service generates random UUIDs for IDs and tokens.                     |
| Centralized API auth handling  | `ApiClient` injects tokens; never done in page components.                  |
| 401 handling                   | `ApiClient.onUnauthorized` callback enables global session expiry response. |
| Session expiry                 | `auth-storage.ts` validates `expiresAt` on every read.                      |
| Logout cleanup                 | `clearStoredAuth` removes from both `localStorage` and `sessionStorage`.    |

---

## Form Validation

Two layers of validation:

1. **Client-side** (`auth-validation.ts`) — immediate inline feedback, pure functions returning `string | null`.
2. **Service-side** (`auth-service.ts`) — enforced at the service boundary, mirrors backend constraints.

When the real backend is connected, the service layer will translate API error responses into `AuthError` objects that surface through the same `auth.error` state consumed by the UI.

---

## Environment Configuration

**File:** `apps/web/src/app/config.ts`

```ts
export const appConfig = {
  name: import.meta.env.VITE_APP_NAME,
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  environment: import.meta.env.VITE_APP_ENV,
};
```

See `apps/web/.env.example` for required environment variables.

---

## Connecting the Real Backend

When the backend authentication API is ready:

1. Create `api-auth-service.ts` implementing the `AuthService` interface.
2. Replace `mockAuthService` with `apiAuthService` in `AuthProvider.tsx`.
3. Pass the stored `accessToken` via `authToken` to `ApiClient.request()`.
4. Wire `onUnauthorized` in `ApiClient` to call `auth.logout()` from `AuthProvider`.

No changes to the UI layer are required.

---

## What Is NOT Implemented (Out of Scope for Epic 3)

- Organization registration
- Organization dashboard
- Multi-organization membership UI
- Role/permission enforcement (types are defined; enforcement is future work)
- Platform administration
- Education / SIS modules
- AI Agent Framework

These belong to later Epics.
