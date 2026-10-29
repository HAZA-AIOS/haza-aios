# HAZA-AIOS — EPIC 13: AI AGENT CONFIGURATION & BUILDER
## Comprehensive Implementation Plan & Architecture Specification

**Project:** HAZA-AIOS  
**Workspace:** `C:\HAZA-APPS\HAZA-AIOS`  
**Repository:** `HAZA-AIOS/haza-aios`  
**Branch:** `feature/epic-13-agent-configuration-builder`  
**Target Branch:** `main`  
**Baseline Release:** `v0.12.0-epic12` (`9548ccd`)  
**Target Release:** `v0.13.0-epic13`  
**Status:** In Implementation  
**Date:** October 29, 2026

---

## 1. Executive Summary & Objective

Epic 13 delivers a complete, secure, enterprise-grade, multi-tenant **AI Agent Configuration & Builder** module for HAZA-AIOS. 

The builder empowers authorized organization administrators to design, customize, validate, test, version, and activate AI agents through an intuitive no-code interface while strictly preserving multi-tenant isolation, human oversight, revision history, and full auditability.

### Key Capabilities Delivered:
1. **Visual No-Code Builder (10 Sections):**
   - Identity & Presentation (Name, key, description, category, tags, avatar/icon)
   - Model & Provider Configuration (Provider discovery, model selection, temperature, token limits, timeouts)
   - Structured Instructions Builder (Role, objectives, boundary constraints, behavioral rules, output formats, prohibited actions, escalation protocols)
   - Declared Capabilities (Default-deny, risk tiering, approval requirements)
   - Declared Tools (Tool assignment, permission boundaries, read/write scoping)
   - Knowledge Sources (Organization-owned source references, access policy; tenant isolation enforcement)
   - Human Approval Policies (Never, Always, Risk-Threshold; approver roles, escalation timeouts)
   - Real-Time Validation Engine (Server-side field-level checks, activation prerequisite gating)
   - Safe Mock Preview Environment (Zero external AI charges, zero external execution, deterministic test harness)
   - Version & Revision Management (Drafts, immutable published releases, diff comparison, rollback/restore)
2. **Configuration Versioning & Revisions (`ai_agent_configuration_revisions`):**
   - Non-destructive draft saving without affecting live runtime agents.
   - Immutable snapshot creation on publish with actor attribution and changelog.
   - Revision comparison (structured visual diff between any two revisions).
   - Safe restore of previous revisions into a new working draft.
   - Optimistic concurrency protection preventing accidental overwrite collisions.
3. **Safe Simulation Preview:**
   - Isolated sandbox powered by `MockAiProvider`.
   - Strict bounded token limits, timeout enforcement, rate limiting, and explicit mock watermarking.
   - Zero access to unconsented organizational private records or external networks.
4. **End-to-End Enterprise Integration:**
   - Unified entry points in AI Agents workspace, Installed Marketplace Agents, and Agent Details.
   - Creation of custom agents from scratch or customizing existing template installations.
   - Additive database migration `0023_agent_configuration_builder.sql`.

---

## 2. Non-Negotiable Constraints & Architectural Principles

1. **Enterprise Dark Mode Aesthetics:** Match the dense, dark enterprise dashboard aesthetic, color palette, design tokens, and micro-interactions of HAZA-AIOS.
2. **Component Centralization in `@haza-aios/ui`:** All reusable UI builder primitives must be implemented and exported from `@haza-aios/ui` before consuming them in application views.
3. **Multi-Tenant Isolation:** Enforce organization-level tenant boundaries on every builder endpoint and database query via `createRepositoryContext(tx)` and tenant validation. Prevent cross-tenant knowledge source referencing.
4. **Default-Deny Security Model:** No tool or capability is accessible unless explicitly declared. High-risk actions always require human approval regardless of administrator permissiveness.
5. **No Credential Leakage:** AI provider API keys and platform secrets must NEVER be sent to or accepted from the frontend.
6. **Untrusted Instructions:** Agent system instructions are treated as untrusted configuration; they cannot grant permissions or bypass platform security boundaries.
7. **Strict Additive Migrations:** Database migration `0023_agent_configuration_builder.sql` must be 100% additive, backward-compatible, and idempotent with automated backfill of baseline revisions for existing agent definitions.
8. **Simulated Preview Only:** Mock preview must use `MockAiProvider`. No paid external AI API calls or external tool invocations are permitted during builder preview.
9. **No Premature Execution:** Agent workflow orchestration and multi-agent autonomous runtime execution belong to later epics (Epic 14).

---

## 3. Database Schema Extensions (Migration 0023)

### 3.1 Migration File: `0023_agent_configuration_builder.sql`

```sql
-- 1. Extend ai_agent_definitions with active revision tracking
ALTER TABLE `ai_agent_definitions` ADD `active_revision_number` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD `active_revision_id` char(36) NULL;--> statement-breakpoint

-- 2. Create ai_agent_configuration_revisions table
CREATE TABLE `ai_agent_configuration_revisions` (
	`id` char(36) NOT NULL,
	`organization_id` char(36) NOT NULL,
	`workspace_id` char(36) NOT NULL,
	`agent_id` char(36) NOT NULL,
	`revision_number` int NOT NULL,
	`version` varchar(80) NOT NULL DEFAULT '1.0.0',
	`status` varchar(40) NOT NULL DEFAULT 'draft',
	`configuration` json NOT NULL,
	`validation_status` varchar(40) NOT NULL DEFAULT 'valid',
	`validation_errors` json NULL,
	`changelog` text NULL,
	`created_by` char(36) NOT NULL,
	`published_by` char(36) NULL,
	`published_at` timestamp(3) NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now(3)),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now(3)) ON UPDATE CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_agent_configuration_revisions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agent_config_revisions_agent_revision_unique` UNIQUE(`agent_id`,`revision_number`)
);--> statement-breakpoint

-- 3. Foreign key constraints
ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_workspace_fk` FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_agent_fk` FOREIGN KEY (`agent_id`) REFERENCES `ai_agent_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_creator_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_configuration_revisions` ADD CONSTRAINT `ai_agent_config_revisions_publisher_fk` FOREIGN KEY (`published_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `ai_agent_definitions` ADD CONSTRAINT `ai_agent_definitions_active_revision_fk` FOREIGN KEY (`active_revision_id`) REFERENCES `ai_agent_configuration_revisions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint

-- 4. Performance indices
CREATE INDEX `ai_agent_config_revisions_org_agent_status_idx` ON `ai_agent_configuration_revisions` (`organization_id`, `agent_id`, `status`);--> statement-breakpoint
CREATE INDEX `ai_agent_config_revisions_agent_idx` ON `ai_agent_configuration_revisions` (`agent_id`);--> statement-breakpoint

-- 5. Backfill baseline revisions for existing agent definitions
INSERT INTO `ai_agent_configuration_revisions` (
  `id`,
  `organization_id`,
  `workspace_id`,
  `agent_id`,
  `revision_number`,
  `version`,
  `status`,
  `configuration`,
  `validation_status`,
  `validation_errors`,
  `changelog`,
  `created_by`,
  `published_by`,
  `published_at`,
  `created_at`,
  `updated_at`
)
SELECT 
  UUID(),
  d.organization_id,
  d.workspace_id,
  d.id,
  1,
  COALESCE(d.installed_version, '1.0.0'),
  'published',
  JSON_OBJECT(
    'identity', JSON_OBJECT('name', d.name, 'description', d.description, 'agentKey', d.agentKey),
    'model', JSON_OBJECT('provider', d.model_provider, 'modelSelection', d.model_selection, 'temperature', 0.7, 'maxTokens', 2048, 'timeoutSeconds', 60),
    'instructions', JSON_OBJECT('systemInstructions', COALESCE(d.instructions, ''), 'objectives', '', 'constraints', '', 'tone', 'Professional'),
    'capabilities', JSON_ARRAY(),
    'tools', JSON_ARRAY(),
    'knowledge', COALESCE(JSON_EXTRACT(d.configuration, '$.knowledge'), JSON_ARRAY()),
    'humanApproval', COALESCE(d.human_approval_policy, JSON_OBJECT('required', false, 'approverRoles', JSON_ARRAY('admin', 'owner')))
  ),
  'valid',
  NULL,
  'Initial baseline configuration snapshot',
  d.created_by,
  d.created_by,
  d.created_at,
  d.created_at,
  d.updated_at
FROM `ai_agent_definitions` d
WHERE NOT EXISTS (
  SELECT 1 FROM `ai_agent_configuration_revisions` r WHERE r.agent_id = d.id
);--> statement-breakpoint

-- 6. Link active_revision_id to the created baseline revision
UPDATE `ai_agent_definitions` d
JOIN `ai_agent_configuration_revisions` r ON r.agent_id = d.id AND r.revision_number = 1
SET d.active_revision_id = r.id
WHERE d.active_revision_id IS NULL;
```

---

## 4. Configuration Domain Specifications

The unified agent configuration document contains typed schemas for each builder section:

```typescript
export interface AgentBuilderConfiguration {
  identity: {
    name: string;
    agentKey: string;
    description: string;
    category?: string;
    industry?: string;
    icon?: string;
    tags?: string[];
  };
  model: {
    provider: string;               // e.g. "mock", "anthropic", "openai", "google"
    modelSelection: string;         // e.g. "mock-gpt-4o", "mock-claude-3-5-sonnet"
    temperature: number;            // 0.0 - 2.0 (default: 0.7)
    maxTokens: number;              // 256 - 32768 (default: 2048)
    timeoutSeconds: number;         // 5 - 300 (default: 60)
    contextWindow?: number;
    responseQuality?: "fast" | "balanced" | "high";
  };
  instructions: {
    role: string;                   // Persona / Role definition
    objectives: string;             // Primary goals and deliverables
    boundaryConstraints: string;    // Boundaries and rules
    behavioralRules: string;        // Specific behavioral expectations
    outputFormat: string;           // Markdown, JSON, structured schema
    prohibitedActions: string;      // Explicit actions forbidden
    escalationRequirements: string; // Conditions requiring human intervention
    systemInstructions: string;     // Compiled composite prompt
  };
  capabilities: Array<{
    key: string;
    name: string;
    description: string;
    riskLevel: "low" | "medium" | "high";
    requiresApproval: boolean;
  }>;
  tools: Array<{
    toolKey: string;
    name: string;
    description: string;
    category: string;
    riskLevel: "low" | "medium" | "high";
    requiresApproval: boolean;
    permissions: string[];
    configuration?: Record<string, unknown>;
  }>;
  knowledge: Array<{
    sourceId: string;
    name?: string;
    sourceType?: string;
    accessPolicy?: "read_only" | "search_only";
    enabled: boolean;
  }>;
  humanApproval: {
    policy: "never" | "always" | "risk_threshold";
    riskThreshold?: "low" | "medium" | "high";
    approverRoles: string[];
    escalationTimeoutHours: number;
    fallbackAction: "deny" | "escalate";
    sensitiveCapabilities: string[];
  };
}
```

---

## 5. API Endpoints Specification

All endpoints require active organization context (`X-Organization-Id` or route param `:organizationId`) and appropriate RBAC permissions (`agent.read`, `agent.manage`, `agent.publish`, `platform.admin`).

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/api/v1/organizations/:orgId/agents/:agentId/builder` | Load active configuration, draft (if any), and metadata | `agent.read` |
| `POST` | `/api/v1/organizations/:orgId/agents/builder/new` | Initialize a new custom agent builder session | `agent.manage` |
| `PUT` | `/api/v1/organizations/:orgId/agents/:agentId/builder/draft` | Save/update draft revision without modifying published config | `agent.manage` |
| `POST` | `/api/v1/organizations/:orgId/agents/:agentId/builder/publish` | Validate and publish draft as immutable revision | `agent.manage` |
| `POST` | `/api/v1/organizations/:orgId/agents/:agentId/builder/duplicate` | Clone agent configuration into a new custom agent | `agent.manage` |
| `POST` | `/api/v1/organizations/:orgId/agents/:agentId/builder/validate` | Server-side validation of full configuration draft | `agent.read` |
| `GET` | `/api/v1/organizations/:orgId/agents/:agentId/builder/revisions` | List all historical revisions with changelogs and authors | `agent.read` |
| `GET` | `/api/v1/organizations/:orgId/agents/:agentId/builder/revisions/:revId` | Get specific revision details | `agent.read` |
| `POST` | `/api/v1/organizations/:orgId/agents/:agentId/builder/revisions/:revId/restore` | Restore previous revision into a new draft | `agent.manage` |
| `POST` | `/api/v1/organizations/:orgId/agents/:agentId/builder/preview` | Execute safe simulated mock preview with validation trace | `agent.read` |
| `GET` | `/api/v1/organizations/:orgId/agents/builder/catalog-options` | Available providers, models, capabilities, tools, and org knowledge sources | `agent.read` |

---

## 6. Real-Time Validation Engine

The server-side validation engine (`AgentBuilderValidationService`) executes comprehensive multi-layer checks:

1. **Identity & Core Rules:**
   - Name: 2-180 characters, trimmed, no control characters.
   - Key: 2-100 characters, alphanumeric with hyphens/underscores (`^[a-z0-9_-]+$`), unique per workspace.
   - Description: 5-1000 characters.
2. **Provider & Model Rules:**
   - Provider must be registered in `AiProviderRegistry`.
   - Model must exist in provider's model catalog.
   - Temperature: 0.0 &le; `temp` &le; 2.0.
   - MaxTokens: 64 &le; `maxTokens` &le; `modelMetadata.maxOutputTokens`.
   - Timeout: 5s &le; `timeoutSeconds` &le; 300s.
   - No secret keys (api_key, token, password) in configuration.
3. **Structured Instructions Rules:**
   - Character boundary: Individual fields &le; 10,000 chars; combined prompt &le; 30,000 chars.
   - Required sections: Role definition and Objectives must be non-empty.
4. **Capabilities & Tools Rules:**
   - All declared capabilities must match registered platform capability registry.
   - All tools must exist in tool registry.
   - If any high-risk tool is selected, human approval policy must NOT be "never".
5. **Knowledge Source Isolation Rules:**
   - Every referenced `sourceId` must exist in `knowledge_sources` table and belong to the requesting `organizationId`.
   - Cross-tenant references immediately reject with `404 NOT_FOUND` or `403 FORBIDDEN`.
6. **Human Approval Rules:**
   - At least one valid approver role (`admin`, `owner`, etc.) when policy is "always" or "risk_threshold".
   - Escalation timeout must be between 1 and 168 hours (1 week).
7. **Activation Gating:**
   - Agent cannot transition to `active` status unless validation status is `valid` with 0 blocking errors.

---

## 7. Safe Mock Preview Sandbox

The preview engine provides interactive verification before publishing:
1. **Mock Engine:** Invocations pass through `MockAiProvider` with configured system instructions and mock model settings.
2. **Execution Safeguards:**
   - Input bounded to maximum 4,000 characters.
   - Timeout bounded to maximum 15 seconds.
   - Strict rate limiting per user/org (e.g. 10 preview invocations/minute).
   - Clear simulated badge and visual watermark: `SIMULATED EXECUTION — NO REAL AI OR DATA MODIFICATIONS`.
3. **Capability Preview Output:** Shows which declared tools would be invoked for the user's test prompt without actually executing side effects.

---

## 8. Frontend Architecture & Reusable UI Primitives

### 8.1 `@haza-aios/ui` Primitives:
- `BuilderContainer`, `BuilderSidebar`, `BuilderContent`, `BuilderSection`, `ConfigField`
- `BuilderStepNav` (Horizontal or vertical step indicator with completion status)
- `ModelParameterSliders` (Interactive sliders for temperature, token limits, timeouts)
- `InstructionTextarea` (With character limit indicator and variable helpers)
- `RiskBadge` (`low` [emerald], `medium` [amber], `high` [rose])
- `CapabilityCard` (Card with toggle, risk badge, and approval requirement chip)
- `ToolDeclarationGrid` (Grid of tools with permission checkboxes)
- `KnowledgeSourcePicker` (List of org knowledge sources with status pills)
- `ApprovalPolicySelector` (Visual selection cards for Never, Always, Risk-Threshold)
- `RevisionHistoryList` (Timeline of revisions with diff button, restore button, author, date)
- `RevisionDiffModal` (Two-pane side-by-side or unified diff comparison)
- `MockPreviewConsole` (Interactive chat console with simulated badge, latency, token usage)
- `ValidationSummaryAlert` (Collapsible error/warning panel with jump-to-section action links)

### 8.2 Application Page: `apps/web/src/pages/workspace/agents/builder/AgentBuilderPage.tsx`
- Complete 10-tab navigation:
  1. Identity
  2. Model
  3. Instructions
  4. Capabilities
  5. Tools
  6. Knowledge
  7. Approval
  8. Validation
  9. Preview
  10. History
- Actions bar: Save Draft, Discard Changes, Validate, Publish Revision, Duplicate, Exit.
- Autosave dirty detection and beforeunload prompt.

---

## 9. Verification & Quality Gates

### 9.1 Local Automated Verification
1. Integration test suite: `apps/api/tests/epic13-agent-builder.integration.test.ts`
   - Builder CRUD & Draft persistence
   - Server-side validation engine (valid configs, invalid configs, boundary tests)
   - Configuration versioning (revisions, immutable publish, rollback to draft)
   - Cross-tenant knowledge isolation
   - Secret key rejection
   - High-risk capability approval requirement enforcement
   - Mock preview safety & timeout bounds
   - Existing marketplace and agent lifecycle regression tests
2. TypeScript typechecks:
   - `npm run typecheck:api`
   - `npm run typecheck:web`
3. Test suites:
   - `npm run test:api`
   - `npm test -w apps/web`
4. Production bundle builds:
   - `npm run build:api`
   - `npm run build:web`

### 9.2 Isolated Database Rehearsal
1. Fresh production backup via `scripts/backup-production.ps1` under `epic13`.
2. Compute SHA-256 checksum and verify file integrity.
3. Restore into rehearsal database (`haza_epic13_rehearsal`).
4. Apply migration `0023_agent_configuration_builder.sql`.
5. Verify schema structure, indices, foreign keys, and baseline revision backfill.
6. Verify idempotency.

### 9.3 Production Release & Live Verification
1. Push branch `feature/epic-13-agent-configuration-builder`.
2. Open GitHub Pull Request targeting `main`.
3. Verify GitHub Actions CI.
4. Merge PR into `main`.
5. Deploy `api` and `web` on Railway.
6. Verify pre-deploy migration journal.
7. Execute automated live smoke test suite: `scripts/live-production-smoke-test-epic13.ts`.
8. Tag release `v0.13.0-epic13`.
9. Generate 14-point Final Execution Report.

---

## 10. Acceptance Criteria Checklist

- [x] Epic 12 production baseline verified on main (`v0.12.0-epic12`).
- [ ] Feature branch created and checked out (`feature/epic-13-agent-configuration-builder`).
- [ ] Migration `0023_agent_configuration_builder.sql` created and registered in `_journal.json`.
- [ ] Drizzle schema updated in `apps/api/src/database/schema.ts`.
- [ ] Domain types updated in `apps/api/src/modules/agents/agent.types.ts`.
- [ ] `AgentBuilderService` implemented with CRUD, validation, versioning, and mock preview.
- [ ] Builder API endpoints registered and secured with tenant isolation and RBAC.
- [ ] `@haza-aios/ui` extended with all builder UI primitives.
- [ ] `AgentBuilderPage` and 10 section components implemented with modern dark enterprise aesthetic.
- [ ] Frontend routes wired in `apps/web/src/App.tsx` and linked from Agents workspace.
- [ ] Automated integration tests authored and passing.
- [ ] All workspace typechecks, unit tests, and production builds pass cleanly.
- [ ] GitHub PR opened and CI verified.
- [ ] Fresh production backup taken and verified.
- [ ] Isolated rehearsal database created, migrated, and verified.
- [ ] Production deployment executed cleanly on Railway.
- [ ] Live production smoke tests pass 100%.
- [ ] Release tagged `v0.13.0-epic13`.
