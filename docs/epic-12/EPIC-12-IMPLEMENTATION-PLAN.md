# HAZA-AIOS — EPIC 12: AI AGENT REGISTRY & MARKETPLACE
## Comprehensive Implementation Plan & Architecture Specification

**Project:** HAZA-AIOS  
**Workspace:** `C:\HAZA-APPS\HAZA-AIOS`  
**Repository:** `HAZA-AIOS/haza-aios`  
**Branch:** `feature/epic-12-agent-registry-marketplace`  
**Target Branch:** `main`  
**Baseline Release:** `v0.11.0-epic11` (`e613374`)  
**Proposed Release Tag:** `v0.12.0-epic12`  
**Status:** Completed & Fully Verified — Release Candidate Ready (Awaiting Production Authorization)  
**Date:** October 28, 2026

---

## 1. Executive Summary & Objective

Epic 12 extends the HAZA-AIOS AI Agent Platform Foundation established in Epic 11 into a secure, production-grade, multi-tenant **AI Agent Registry and Marketplace**. 

This system enables:
1. **Central Agent Registry:** Comprehensive discovery, versioning, capability declarations, and governance for reusable AI agents across enterprise, education, healthcare, and government sectors.
2. **Immutable Semantic Versioning:** Strict tracking of agent releases (`1.0.0`, `1.1.0`), preventing silent configuration overwrites and providing upgrade eligibility checks.
3. **Marketplace Publishing & Governance:** Multi-stage publishing workflow (`draft` &rarr; `submitted` &rarr; `under_review` &rarr; `approved`/`rejected` &rarr; `published` &rarr; `deprecated`/`withdrawn`) with platform administrator oversight and rejection rationale.
4. **Safe, Multi-Tenant Agent Installation:** Idempotent, tenant-isolated agent installation into organization workspaces with capability consent, configuration validation, non-destructive lifecycle controls, and complete audit logging.
5. **Modern Enterprise Marketplace UI:** Unified catalog with search, category/industry filters, rich agent profiles, interactive installation dialogs, installed agent management, publisher workspace, and platform administration dashboards.
6. **Marketplace Analytics:** Verifiable aggregate adoption metrics (installations, active instances, category distributions, version adoption) based entirely on persisted data without fabricated statistics.

---

## 2. Non-Negotiable Constraints & Architectural Principles

1. **Preserve Visual Language:** Retain the approved dense, dark enterprise dashboard aesthetic, color palette, design tokens, and typography.
2. **Component Centralization in `@haza-aios/ui`:** All new UI primitives (e.g., `MarketplaceBadge`, `PublishingStatusBadge`, `VersionBadge`, `MarketplaceAnalyticsCard`, `AgentInstallDialogPrimitives`) must be implemented in `@haza-aios/ui` before consuming them in application views.
3. **No Entity Duplication:** Extend and reuse existing Epic 11 entities (`ai_agent_templates`, `ai_agent_definitions`, `ai_agent_tool_assignments`, `audit_logs`). Do not fork or duplicate agent runtime models.
4. **Multi-Tenant Isolation:** Enforce organization-level tenant boundaries on every relevant API endpoint and database query via `createTenantContext(organizationId)`.
5. **Server-Side Authorization:** Never trust client-provided IDs. Enforce RBAC permissions (`agent.read`, `agent.manage`, `platform.admin`). Ordinary tenant admins cannot approve their own submissions.
6. **Additive, Versioned Database Migrations:** Migration `0022_agent_registry_marketplace.sql` must be strictly additive, zero-downtime, and backward-compatible.
7. **Confidentiality & Credential Redaction:** Never expose provider API keys, private system prompts, or private tenant configurations through marketplace endpoints.
8. **No Silent Upgrades:** Organizations retain their installed agent version; upgrades must be explicitly requested and applied by authorized organization admins.
9. **No Docker / No Premature Execution:** No Docker dependencies; avoid autonomous execution or payments in this epic.

---

## 3. Domain Model Architecture & Schema Extensions (Migration 0022)

### 3.1 Registry Templates (`ai_agent_templates`) Extensions
Extend `ai_agent_templates` to support publisher identity, visibility, publishing lifecycle, and marketplace metadata:
- `publisher_type`: Enum/varchar (`platform`, `organization`) NOT NULL DEFAULT `'platform'`.
- `publisher_organization_id`: Foreign key to `organizations.id` (NULL for platform agents) ON DELETE SET NULL.
- `publisher_user_id`: Foreign key to `users.id` (NULL for platform agents) ON DELETE SET NULL.
- `visibility`: Enum/varchar (`platform`, `private_organization`, `approved_shared`) NOT NULL DEFAULT `'platform'`.
- `publishing_status`: Enum/varchar (`draft`, `submitted`, `under_review`, `approved`, `published`, `rejected`, `deprecated`, `withdrawn`) NOT NULL DEFAULT `'published'`.
- `summary`: Varchar(300) NULL.
- `latest_version`: Varchar(80) NOT NULL DEFAULT `'1.0.0'`.
- `min_platform_version`: Varchar(40) NULL.
- `review_notes`: Text NULL.
- `reviewed_by`: Foreign key to `users.id` NULL.
- `reviewed_at`: Timestamp NULL.
- `published_at`: Timestamp NULL.

### 3.2 Immutable Template Versions (`ai_agent_template_versions`)
New table for immutable semantic releases:
- `id`: char(36) PRIMARY KEY.
- `template_id`: char(36) NOT NULL references `ai_agent_templates.id` ON DELETE CASCADE.
- `version`: varchar(80) NOT NULL (e.g. `1.0.0`).
- `name`: varchar(180) NOT NULL.
- `description`: varchar(1000) NOT NULL.
- `instructions`: text NULL.
- `configuration_schema`: json NOT NULL.
- `input_schema`: json NOT NULL.
- `output_schema`: json NOT NULL.
- `capabilities`: json NOT NULL.
- `required_permissions`: json NOT NULL.
- `default_approval_policy`: json NULL.
- `changelog`: text NULL.
- `status`: varchar(40) NOT NULL DEFAULT `'published'` (`draft`, `submitted`, `under_review`, `approved`, `published`, `rejected`, `deprecated`, `withdrawn`).
- `review_notes`: text NULL.
- `reviewed_by`: char(36) NULL references `users.id`.
- `reviewed_at`: timestamp NULL.
- `published_at`: timestamp NULL.
- `created_at`: timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP.
- `updated_at`: timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP.
- Constraints: `UNIQUE KEY (template_id, version)`.

### 3.3 Tenant Installed Definitions (`ai_agent_definitions`) Extensions
Extend `ai_agent_definitions` to track installed version provenance:
- `installed_version`: varchar(80) NOT NULL DEFAULT `'1.0.0'`.
- `template_version_id`: char(36) NULL references `ai_agent_template_versions.id` ON DELETE SET NULL.
- `installed_from_marketplace`: boolean NOT NULL DEFAULT true.

### 3.4 Installation Provenance & Audit (`ai_agent_installations`)
Durable tracking of installations and upgrades:
- `id`: char(36) PRIMARY KEY.
- `organization_id`: char(36) NOT NULL references `organizations.id` ON DELETE CASCADE.
- `workspace_id`: char(36) NOT NULL references `workspaces.id` ON DELETE CASCADE.
- `template_id`: char(36) NOT NULL references `ai_agent_templates.id` ON DELETE RESTRICT.
- `template_version_id`: char(36) NULL references `ai_agent_template_versions.id` ON DELETE SET NULL.
- `installed_version`: varchar(80) NOT NULL.
- `agent_definition_id`: char(36) NOT NULL references `ai_agent_definitions.id` ON DELETE CASCADE.
- `installed_by`: char(36) NOT NULL references `users.id` ON DELETE RESTRICT.
- `status`: varchar(40) NOT NULL DEFAULT `'active'` (`active`, `uninstalled`, `upgraded`).
- `installed_at`: timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP.
- `uninstalled_at`: timestamp NULL.
- `uninstalled_by`: char(36) NULL references `users.id`.
- `metadata`: json NULL.

---

## 4. Publishing Governance & Lifecycle State Machine

```
      ┌───────────┐
      │   draft   │ (Publisher drafts agent or version)
      └─────┬─────┘
            │ (submit for review)
            ▼
      ┌───────────┐
      │ submitted │
      └─────┬─────┘
            │ (reviewer picks up)
            ▼
      ┌──────────────┐
      │ under_review │
      └─────┬────────┴─────┐
            │              │ (reject with review notes)
            │ (approve)    ▼
            ▼        ┌───────────┐
      ┌───────────┐  │ rejected  │
      │ approved  │  └─────┬─────┘
      └─────┬─────┘        │ (re-draft & resubmit)
            │ (publish)    ▼
            ▼        ┌───────────┐
      ┌───────────┐  │   draft   │
      │ published │  └───────────┘
      └─────┬─────┘
            │
      ┌─────┴──────────────┐
      │                    │
(deprecate)           (withdraw)
      ▼                    ▼
┌────────────┐       ┌───────────┐
│ deprecated │       │ withdrawn │
└────────────┘       └───────────┘
```

**Governance Rules:**
- Only users with `agent.manage` in the publishing organization can create draft templates and submit them.
- Only users with `platform.admin` permission can perform transitions: `submitted` &rarr; `under_review` &rarr; `approved` / `rejected` &rarr; `published`.
- Tenant administrators cannot approve their own submissions unless they hold global `platform.admin` authorization.
- Rejection requires explicit `reviewNotes`.
- Only `published` templates and versions appear in public marketplace listings.
- `private_organization` agents only appear to members of the publishing organization.

---

## 5. Safe Agent Installation & Upgrade Protocol

1. **Visibility & Compatibility Check:**
   - Confirm agent is in `published` status and visible to the requesting tenant (`platform` visibility or tenant is the publishing organization).
   - Validate version compatibility against platform baseline.
2. **Capability Consent Gate:**
   - Client is presented with requested capabilities (`tools`, `memory`, `humanApprovalPolicy`, `requiredPermissions`).
   - Requires explicit confirmation from an authorized organization admin (`agent.manage`).
3. **Idempotent Installation Execution:**
   - Check if agent definition already exists for the workspace + template.
   - If already installed and active: return conflict or existing instance.
   - If archived/uninstalled: re-activate with updated version reference.
   - If new: create `ai_agent_definitions` with `status: 'configured'` or `'active'`, recording `installed_version` and `template_version_id`.
   - Record entry in `ai_agent_installations`.
4. **Upgrade Protocol:**
   - Compare `installed_version` with template's `latest_version` and available published versions.
   - If a newer version exists: provide upgrade preview diff (changelog, schema changes).
   - Require admin confirmation. Upgrade updates `ai_agent_definitions.installed_version`, marks previous installation record as `upgraded`, and creates a new installation record. Never overwrite custom runtime prompts or credentials silently.
5. **Uninstall Protocol:**
   - Sets instance status to `archived` or `disabled`.
   - Records `uninstalled_at` and `uninstalled_by` in `ai_agent_installations`.
   - Retains immutable audit history and runs for compliance.

---

## 6. Marketplace API Specification

All endpoints are rooted under `/api/v1/organizations/:organizationId/marketplace` or `/api/v1/platform/marketplace`.

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/api/v1/organizations/:orgId/marketplace/catalog` | `GET` | `agent.read` | Browse marketplace catalog with search, category, industry, capability, and availability filters. |
| `/api/v1/organizations/:orgId/marketplace/agents/:templateId` | `GET` | `agent.read` | Read full agent profile, publisher provenance, capabilities, and version list. |
| `/api/v1/organizations/:orgId/marketplace/agents/:templateId/versions` | `GET` | `agent.read` | List published versions for an agent template. |
| `/api/v1/organizations/:orgId/marketplace/agents/:templateId/versions/:version` | `GET` | `agent.read` | Read detailed version schema, changelog, and compatibility. |
| `/api/v1/organizations/:orgId/marketplace/install` | `POST` | `agent.manage` | Install an approved agent version into a workspace (idempotent, audited). |
| `/api/v1/organizations/:orgId/marketplace/installed` | `GET` | `agent.read` | List installed agent instances with installed version and update availability. |
| `/api/v1/organizations/:orgId/marketplace/installed/:agentId/upgrade` | `POST` | `agent.manage` | Request and execute explicit version upgrade for an installed instance. |
| `/api/v1/organizations/:orgId/marketplace/installed/:agentId/uninstall` | `POST` | `agent.manage` | Safely retire/uninstall an installed agent instance. |
| `/api/v1/organizations/:orgId/marketplace/publisher/templates` | `GET` | `agent.manage` | List organization's authored agent templates and versions. |
| `/api/v1/organizations/:orgId/marketplace/publisher/templates` | `POST` | `agent.manage` | Create new agent template listing (draft). |
| `/api/v1/organizations/:orgId/marketplace/publisher/templates/:id` | `PATCH` | `agent.manage` | Update draft agent template listing. |
| `/api/v1/organizations/:orgId/marketplace/publisher/templates/:id/versions` | `POST` | `agent.manage` | Author new version draft for an agent template. |
| `/api/v1/organizations/:orgId/marketplace/publisher/templates/:id/submit` | `POST` | `agent.manage` | Submit template/version for platform review. |
| `/api/v1/platform/marketplace/reviews` | `GET` | `platform.admin` | List pending submissions for platform administrators. |
| `/api/v1/platform/marketplace/reviews/:id/decision` | `POST` | `platform.admin` | Approve, reject, or request changes with review notes. |
| `/api/v1/platform/marketplace/templates/:id/publication` | `PATCH` | `platform.admin` | Publish, deprecate, or withdraw an approved agent template. |
| `/api/v1/organizations/:orgId/marketplace/analytics` | `GET` | `agent.read` | Aggregate installation metrics and category distributions. |

---

## 7. Frontend Architecture & UI Primitives

### 7.1 New UI Primitives in `@haza-aios/ui`
Add to `packages/ui/src/components/agent-marketplace-primitives.tsx` and export via `packages/ui/src/index.ts`:
- `PublishingStatusBadge`: Visual pill for `draft`, `submitted`, `under_review`, `approved`, `published`, `rejected`, `deprecated`, `withdrawn`.
- `VersionBadge`: Semantic version badge (`v1.0.0`, `v1.2.0-latest`).
- `PublisherBadge`: Identity badge indicating Platform Verified or Organization Author.
- `AgentInstallDialog`: Modal displaying requested capabilities, approval policy, version selection, workspace target, and confirmation button.
- `UpgradeNoticeBadge`: Banner/pill highlighting when a newer version is available.
- `MarketplaceMetricCard`: Clean enterprise analytics metric display (total agents, active installs, etc.).

### 7.2 Web Application Routes (`apps/web`)
1. `/workspace/marketplace`: Full catalog browser with search, category tabs, industry filters, and rich agent cards.
2. `/workspace/marketplace/:templateId`: Agent profile with overview, capabilities, changelog, version dropdown, and install CTA.
3. `/workspace/marketplace/installed`: Dedicated view of all installed marketplace agents in the current tenant with version status, upgrade buttons, and uninstall actions.
4. `/workspace/marketplace/publisher`: Authoring view for organization-created agents (drafting, version management, submission).
5. `/admin/marketplace`: Platform admin review queue with pending submissions, diff inspection, approve/reject modal, and publication management.

---

## 8. Release Boundaries & Phased Execution

- **Phase 1:** Baseline audit, verification, and architecture plan (`docs/epic-12/EPIC-12-IMPLEMENTATION-PLAN.md`).
- **Phase 2 & 3:** Database schema migration `0022_agent_registry_marketplace.sql`, schema updates in `schema.ts`, template versioning models, and local rehearsal.
- **Phase 4:** Governance and lifecycle state machine services with RBAC rules.
- **Phase 5 & 6:** Complete Marketplace API module (`apps/api/src/modules/marketplace`), installation/upgrade protocols, and DTO validators.
- **Phase 7:** UI primitives in `@haza-aios/ui` and comprehensive React frontend pages in `apps/web`.
- **Phase 8:** Marketplace analytics service and metrics dashboard.
- **Phase 9:** Automated unit and integration testing across API, DB, and UI; typecheck and build validation.
- **Phase 10:** Documentation (`CHANGELOG.md`), logical git commits, push to `feature/epic-12-agent-registry-marketplace`, and GitHub PR.
