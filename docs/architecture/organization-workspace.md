# HAZA AIOS Organization Workspace Architecture

This document outlines the architecture, routing, isolation strategies, role structures, and module concepts of the **Organization Workspace** (Epic 7) in HAZA AIOS.

---

## 1. Scope & Purpose

The Organization Workspace acts as the primary cockpit for an organization to manage its users, operations, localization settings, and functional modules. 

It sits between the global authentication layer and downstream industry-specific operational capabilities.

```
       [ User Session ]
              │
              ▼
   [ Authentication Guard ]
              │
              ▼
  [ Organization Switcher ] ── (Selects Active Tenant)
              │
              ▼
 [ Workspace Route Protection ] ── (Verifies Member Status)
              │
              ▼
 [ Active Modules Workspace ] ── (HR, Financials, Education/SIS)
```

---

## 2. Workspace Routing & Session Guarding

All workspace routes are nested under `/workspace/*`:
- `/workspace` — Overview dashboard
- `/workspace/members` — Member directory & role configuration
- `/workspace/modules` — Active module installation and activation toggling
- `/workspace/settings` — Profile, billing references, localization, and currency

### Workspace Session Gating (`WorkspaceGuard.tsx`)
A custom wrapper components protects `/workspace/*` routes:
1. **Authentication Check**: Verifies that `useAuth()` has resolved to `"authenticated"`. Otherwise, redirects the user to `/login`.
2. **Organization Membership Verification**: Verifies the list of user organizations:
   - If the user belongs to **no organizations**, they are automatically redirected to the organization creation form (`/organization/create`).
   - If they have organizations, the guard waits for `OrgProvider` to resolve the active `currentOrganization`.
   - Renders child pages only when active organization context is successfully loaded.

---

## 3. Adaptable Shell & Navigation (`AppShell.tsx`)

The shared shell detects workspace paths via pathname check (`pathname.startsWith("/workspace")`) and adjusts sidebar layout:
- **Workspace Navigation**: Presents Overview, Members, Active Modules, and Settings.
- **Top Utility Header**:
  - Displays the active organization name, type, and industry.
  - Displays a status badge representing tenant health (`active` or `suspended`).
  - Provides a select dropdown for switching between multiple tenant workspaces, which updates context instantly.

---

## 4. Tenant Isolation Strategy

Tenant isolation is strictly maintained across the workspace layers:
1. **Frontend Isolation**: The UI reads `currentOrganization.id` from `useOrganization()` and queries `workspaceService` with that ID.
2. **Service Storage Isolation**: The mock data store scopes all entries inside `localStorage` using keys prefixed with `organizationId`:
   - Active Modules list: `haza-aios.workspace-modules.<orgId>`
   - Activity Logs: `haza-aios.workspace-logs.<orgId>`
3. **Membership Isolation**: Member directory queries match memberships where `organizationId === activeOrgId`, ensuring a user cannot query members of other organizations they do not belong to.

---

## 5. Role-Based Access Control (RBAC)

Organization actions are bound to three membership role types:

| Capability | Owner | Admin | Member |
|------------|:---:|:---:|:---:|
| Read Workspace Details | Yes | Yes | Yes |
| Edit Organization Profile | Yes | Yes | No |
| Change Localization & Currency | Yes | Yes | No |
| Invite New Members | Yes | Yes | No |
| Modify Member Roles | Yes | Yes (Admin/Member only) | No |
| Remove Members | Yes | Yes (Member only) | No |
| Toggle Active Modules | Yes | Yes | No |

---

## 6. Module Activation Lifecycle

The active modules page demonstrates the module activation lifecycle:
1. **Available Module**: A capability defined in the global module manifest (e.g. SIS, Cognitive AI, Patient EHR).
2. **Tenant Activation**: An organization Owner/Admin flips the activation switch. This fires an activity log, persists the active status in the database, and loads module assets.
3. **Active Module**: Once activated, navigation entry points are created.
4. **Module Workspace**: Scoped operational area inside the workspace (not implemented in Epic 7).

*Note: The actual logic for future SIS and industry capabilities will be dynamically loaded based on these flags without hard-coding rules directly into the core workspace layout.*
