# HAZA AIOS Dynamic Industry & Platform Modules Architecture

This document details the architecture, module contracts, lifecycle states, tenant isolation, dynamic navigation, and registration runtime for **Industry & Platform Modules** (Epic 8) in HAZA AIOS.

---

## 1. Executive Summary & Design Vision

HAZA AIOS is designed as an agentic AI operating system capable of powering diverse vertical industries (Education, Healthcare, Corporate, Government). 

To prevent monolith bloat and avoid hardcoding vertical-specific rules directly into the core shell, HAZA AIOS implements a **Dynamic Plugin & Module Framework**:
- Industry features (e.g. Student Information Systems, Patient EHRs, HR Operations) are packaged into decoupled, self-contained module bundles.
- Core platform services export contracts, routing slots, and lifecycle events.
- Organizations selectively discover, activate, configure, and isolate active modules per tenant.

```
+-----------------------------------------------------------------------+
|                           HAZA AIOS Core                              |
|   [ Auth ]  [ Multi-Tenancy ]  [ AppShell ]  [ Module Registry ]     |
+-----------------------------------------------------------------------+
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
   [ Industry Modules ]                       [ Platform Modules ]
   ├── Student Info System (SIS)              ├── Cognitive AI Ops
   ├── HR & Talent Operations                 ├── Analytics Engine
   └── Patient EHR                            └── Security & Audit
```

---

## 2. Module Contract Schema (`ModuleContract`)

Every module defines a declarative contract schema:

```typescript
export interface ModuleContract {
  id: string;                      // Unique identifier e.g., "sis-core"
  name: string;                    // Human-readable title
  slug: string;                    // URL & storage identifier
  description: string;             // Purpose & summary
  version: string;                 // SemVer release string
  category: "industry" | "platform" | "organization" | "utility";
  industry: "Education" | "Healthcare" | "Corporate" | "Government" | "Cross-Industry" | "Platform";
  icon: string;                    // Visual emoji or icon tag
  status: ModuleLifecycleStatus;   // "registered" | "available" | "activated" | ...
  enabled: boolean;                // System-wide availability flag
  routes: ModuleRouteDefinition[]; // Dynamic client-side routes
  navigation: ModuleNavigationItem[]; // Navigation menu contributions
  permissions: ModulePermission[]; // Required role capability keys
  configuration?: ModuleConfigurationSchema; // Extensible settings schema
  metadata: {
    author?: string;
    documentationUrl?: string;
    releasedAt?: string;
  };
}
```

---

## 3. Module Lifecycle States

Modules transition through clearly defined lifecycle states:

| Lifecycle State | Description | Controlled By |
|-----------------|-------------|---------------|
| `registered` | Discovered by the system-wide `ModuleRegistry` | Developer / Plugin System |
| `available` | Ready for activation by organization workspace admins | Platform Admin |
| `activated` | Installed and active for a specific tenant organization | Org Owner / Admin |
| `deactivated` | Turned off for a tenant; hides navigation routes and UI widgets | Org Owner / Admin |
| `disabled` | Suspended system-wide by Super-Admins | Super-Admin |

---

## 4. Multi-Tenant Module Isolation (`ModuleRuntime`)

Tenant isolation is preserved across module settings and state:
1. **Scoped Storage**: Activation states and tenant settings are stored per tenant using key prefixing:
   `haza-aios.org-modules.<organizationId>`
2. **Dynamic Route Resolution**: `ModuleRuntime.getActiveModuleRoutesForOrg(orgId)` returns only the routes contributed by active modules for the current tenant.
3. **Dynamic Navigation Resolution**: `ModuleRuntime.getActiveModuleNavigationForOrg(orgId)` dynamically injects active module menu items into `AppShell`.

---

## 5. UI Primitives (`packages/ui`)

Shared module presentation primitives reside in `@haza-aios/ui`:
- `ModuleCard`: Renders module tile with status badge, version info, description, and write-access gated toggle switch.
- `ModuleDetailsDialog`: Interactive modal presenting route manifests, navigation permissions, configuration fields, and metadata.
- `ModuleFilterBar`: Search and filter controls for filtering modules by industry target or category.

---

## 6. Testing & Quality Assurance

- **Unit Tests**: Full coverage for `ModuleRegistry` registration/filtering, `ModuleRuntime` activation lifecycle, and multi-tenant isolation (`module-registry.test.ts`).
- **Gated Permissions**: Access control verified so read-only `Member` roles cannot toggle module activation.
