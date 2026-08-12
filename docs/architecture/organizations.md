# Architecture Reference: Organization & Multi-Tenancy

This document describes the organization registration, membership roles, tenant context model, and data isolation security guidelines for HAZA AIOS.

---

## 1. Data Models

### Organization Model

The `Organization` represents the top-level tenant container. All application data belongs to a specific organization.

```typescript
interface Organization {
  id: string;
  name: string;
  legalName: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  industry: string;
  organizationType: OrganizationType;
  website?: string;
  email: string;
  phone?: string;
  country: string;
  timezone: string;
  currency: string;
  status: "active" | "suspended";
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
```

### Organization Membership Model

The `OrganizationMembership` model represents a user's association with an organization. A user may have memberships in multiple organizations.

```typescript
interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: "Owner" | "Admin" | "Member";
  status: "active" | "pending" | "suspended";
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 2. Tenancy Security Foundation

### Architectural Rule: Tenant Isolation

To prevent cross-tenant data leaks:

1. Every database record representing workspace data (e.g. users, tasks, records) **must** contain an `organizationId` foreign key.
2. The backend APIs must enforce query filters using the authenticated user's active membership:
   ```sql
   SELECT * FROM documents WHERE organization_id = $1;
   ```
3. Frontend filtering alone is **not** sufficient for security. Tenant contexts should only present user-authorized datasets fetched directly from authenticated tenant API endpoints.

---

## 3. Context & Hooks

The `OrgProvider` manages the active tenant selection:

- `useOrganization()` hook returns:
  - `currentOrganization`: The active organization tenant metadata.
  - `currentMembership`: Active user's role and status inside the organization.
  - `organizations`: List of all organizations the user has access to.
  - `switchOrg(id)`: Asynchronously switch workspace contexts.
  - `createOrg(data)`: Registers a new organization and auto-selects it.

---

## 4. Slug Generation & Deduplication

- Slugs are auto-generated from the organization name using lowercase alphanumeric characters, stripping invalid symbols, and replacing spaces with hyphens.
- In case of collisions, the service checks existing tenant records and appends an incremental counter (e.g., `-1`, `-2`) to guarantee uniqueness.
