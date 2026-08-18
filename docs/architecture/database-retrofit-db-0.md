# DB-0 Architecture & Migration Baseline

**Program:** HAZA AIOS Database Retrofit  
**Status:** Architecture baseline only  
**Base branch:** `develop` after PR #4 merge commit `ded7e76c744a1149fc39b12889d927c0bc56d8a7`  
**Implementation scope:** No backend, database, ORM, migration, API endpoint, UI, routing, auth, or localStorage changes in DB-0.

---

## 1. Purpose

DB-0 defines the migration path from the current frontend prototype persistence model to a durable backend and MySQL architecture without rebuilding the product.

Current shape:

```text
React frontend
  -> React providers, route guards, page components
  -> frontend domain services
  -> localStorage / sessionStorage / static arrays / in-memory registries
```

Target shape:

```text
React frontend
  -> HTTP API
  -> backend application
  -> domain services
  -> repositories / data access
  -> MySQL
```

The key migration principle is to preserve the current UI and service contracts while replacing each persistence adapter behind those contracts in controlled stages.

---

## 2. Non-Goals

DB-0 must not:

- Redesign UI, navigation, shell, landing page, workspace dashboard, sidebar, header, footer, or global styles.
- Delete mock services or remove browser storage.
- Install MySQL, ORM, backend, Docker, or migration tooling.
- Create backend application code, real API endpoints, migrations, or database tables.
- Change authentication, authorization, routing, module activation, or tenant switching behavior.
- Attempt broad lint cleanup. The known full-repository lint debt remains separate technical debt.

---

## 3. Current Persistence Inventory

The recovered repository is a React/Vite/TypeScript monorepo with the primary app in `apps/web`. Existing persistence is concentrated in frontend domain services, which is useful for the retrofit because pages already depend on service-level operations rather than direct storage calls.

| Area | Current files | Current persistence shape | DB retrofit boundary |
| --- | --- | --- | --- |
| Authentication | `apps/web/src/auth/auth-service.ts`, `apps/web/src/auth/auth-storage.ts`, `apps/web/src/auth/AuthProvider.tsx` | Mock auth service, browser session persisted in `localStorage` or `sessionStorage` using `haza-aios.auth.session` | Replace mock service with API-backed auth service after backend auth exists |
| Organizations | `apps/web/src/org/org-service.ts`, `apps/web/src/org/OrgProvider.tsx` | Organizations and memberships in `localStorage`; active organization in `sessionStorage` | API-backed organization and membership service |
| Workspace | `apps/web/src/workspace/workspace-service.ts` | Members, module states, workspace users, and activity logs in `localStorage`, scoped by organization keys where applicable | API-backed workspace service preserving tenant-aware methods |
| Module runtime | `apps/web/src/modules/module-runtime.ts`, `apps/web/src/modules/module-registry.ts` | Module registry in memory; active module states in `localStorage` | API-backed module install/state repository plus local registry for static definitions |
| Education worksheets | `apps/web/src/modules/education/worksheet-service.ts` | Worksheet records in `localStorage` | Education API service or agent artifact repository |
| SIS academic | `apps/web/src/modules/education/sis/academic.service.ts` | Academic years, terms, grades, sections, subjects, class-subject links in `localStorage` | SIS academic API and repositories |
| SIS people | `apps/web/src/modules/education/sis/student.service.ts`, `staff.service.ts`, `enrollment.service.ts` | Students, guardians, staff, departments, subjects, enrollments in `localStorage` | SIS people, enrollment, and staff repositories |
| SIS attendance and timetable | `attendance.service.ts`, `timetable.service.ts`, `teaching-assignment.service.ts` | Attendance sessions/records, schedules, periods, timetable entries, teaching assignments in `localStorage` | SIS operations repositories with server-side conflict checks |
| SIS exams/results | `examination.service.ts` | Examinations, exam subjects, assessments, marks, grading rules, results in `localStorage` | SIS assessment repositories and result publication services |
| SIS finance | `finance.service.ts` | Fee categories, structures, assignments, discounts, invoices, payments, receipts in `localStorage` | SIS finance repositories and ledger-safe domain services |
| SIS communication | `communication.service.ts` | Announcements, messages, notifications, templates, deliveries, preferences in `localStorage` | Communication API, notification queue/outbox, delivery provider integrations |
| SIS portal | `portal.service.ts` | Portal dashboards and update requests composed from frontend services plus portal policy storage | Portal API enforcing server-side student/guardian access |
| SIS analytics | `analytics.service.ts` | Derived analytics and reports computed from frontend-local SIS services | API-backed reporting service, initially computed from transactional tables |
| AI agents | `agents/agent-service.ts`, `runtime/conversation/ConversationService.ts`, `runtime/memory/MemoryService.ts`, `runtime/workflow/WorkflowService.ts` | Agent instances, runs, conversations, messages, memories, workflows, steps, tasks in `localStorage`; template registry in memory | Agent repositories, execution logs, conversation store, memory store, workflow store |
| Platform admin | `apps/web/src/admin/platform-admin-service.ts` | Static mock organizations, users, audit log, and system health | Platform admin APIs backed by real tenant, user, audit, and health data |

---

## 4. Target Architecture

The target architecture should be layered and modular:

```text
apps/web
  pages / components
  React providers and route guards
  frontend domain service interfaces
  API-backed frontend adapters

backend application
  HTTP controllers / route handlers
  request validation and response DTOs
  authentication and authorization middleware
  domain services
  repository interfaces
  MySQL repository implementations
  audit, telemetry, and integration adapters

MySQL
  platform core schema
  education SIS schema
  AI agent schema
  operational audit and reporting schema
```

Frontend pages should continue calling domain services. The implementation behind each service can move from browser storage to HTTP calls one module at a time.

---

## 5. Backend Boundary

The backend should expose resource-oriented HTTP APIs grouped by bounded context:

| API group | Responsibility |
| --- | --- |
| `/api/auth/*` | Login, registration, refresh/session, logout, password reset, email verification |
| `/api/organizations/*` | Tenant lifecycle, membership, active organization selection support |
| `/api/workspaces/*` | Workspace members, settings, module activation, activity log |
| `/api/modules/*` | Module catalog, tenant module state, module readiness |
| `/api/sis/academic/*` | Academic years, terms, grades, sections, subjects, class-subject mapping |
| `/api/sis/students/*` | Students, guardians, admissions, enrollment-linked profile data |
| `/api/sis/staff/*` | Staff, departments, teachers, teaching assignments |
| `/api/sis/attendance/*` | Attendance sessions, attendance records, summaries |
| `/api/sis/timetable/*` | School schedules, periods, timetable entries |
| `/api/sis/examinations/*` | Exams, exam subjects, assessments, marks, grading, result publication |
| `/api/sis/finance/*` | Fee setup, assignments, invoices, discounts, payments, receipts, ledgers |
| `/api/sis/communication/*` | Announcements, messages, templates, notifications, deliveries, preferences |
| `/api/sis/portal/*` | Parent/student dashboards, portal policies, update requests |
| `/api/sis/analytics/*` | Reports, operational health, data quality, exports |
| `/api/agents/*` | Templates, instances, runs, conversations, messages, memories, workflows, tasks |
| `/api/admin/*` | Platform admin, tenant health, audit logs, user governance |

API design rules:

- Every tenant-owned request must derive `organizationId` from authenticated membership, route parameters, or explicit scoped resource ownership checks.
- Client-provided `organizationId` is never trusted by itself.
- API responses should mirror current frontend TypeScript models where reasonable, allowing minimal UI change.
- Server-side validation must become the authority even where client validation remains for ergonomics.
- Mutation endpoints should be idempotent where user double-submit or retry can create duplicate operational records, especially finance, communications, and agent execution.

---

## 6. MySQL Domain Baseline

This is a conceptual table map, not a migration file.

### Platform Core

| Table group | Candidate tables |
| --- | --- |
| Identity | `users`, `user_profiles`, `auth_sessions`, `password_reset_tokens`, `email_verification_tokens` |
| Tenancy | `organizations`, `organization_memberships`, `organization_invitations`, `organization_settings` |
| Authorization | `roles`, `permissions`, `role_permissions`, `membership_role_assignments` |
| Modules | `module_definitions`, `organization_modules`, `module_activity_logs` |
| Admin and audit | `audit_logs`, `system_health_snapshots`, `admin_actions` |

### Education SIS

| Table group | Candidate tables |
| --- | --- |
| Academic structure | `sis_academic_years`, `sis_terms`, `sis_grades`, `sis_sections`, `sis_subjects`, `sis_class_subjects` |
| Students and guardians | `sis_students`, `sis_student_guardians`, `sis_student_guardian_links`, `sis_student_documents` |
| Enrollment | `sis_enrollments`, `sis_admissions`, `sis_transfer_history` |
| Staff | `sis_departments`, `sis_staff`, `sis_teaching_assignments` |
| Attendance | `sis_attendance_sessions`, `sis_attendance_records` |
| Timetable | `sis_school_schedules`, `sis_time_periods`, `sis_timetable_entries`, `sis_rooms` |
| Examinations | `sis_examinations`, `sis_examination_subjects`, `sis_assessments`, `sis_mark_records`, `sis_grading_rules`, `sis_result_publications`, `sis_result_subjects` |
| Finance | `sis_fee_categories`, `sis_fee_structures`, `sis_student_fee_assignments`, `sis_fee_discounts`, `sis_invoices`, `sis_invoice_line_items`, `sis_invoice_adjustments`, `sis_fee_payments`, `sis_fee_receipts`, `sis_student_ledger_entries` |
| Communication | `sis_announcements`, `sis_communication_messages`, `sis_communication_audiences`, `sis_notifications`, `sis_communication_templates`, `sis_delivery_attempts`, `sis_notification_preferences` |
| Portal | `sis_portal_policies`, `sis_portal_accounts`, `sis_portal_student_links`, `sis_portal_update_requests` |
| Analytics | `sis_report_exports`, `sis_data_quality_findings`, `sis_health_snapshots` |

### AI Agents

| Table group | Candidate tables |
| --- | --- |
| Catalog and instances | `agent_templates`, `agent_instances`, `agent_instance_configuration` |
| Execution | `agent_runs`, `agent_run_events`, `agent_run_artifacts` |
| Conversations | `agent_conversations`, `agent_messages` |
| Memory and knowledge | `agent_memories`, `knowledge_sources`, `knowledge_documents`, `knowledge_chunks` |
| Workflows | `workflows`, `workflow_steps`, `workflow_tasks`, `workflow_task_events` |
| Tools | `tool_definitions`, `tool_execution_logs` |

Common column rules:

- Tenant-owned tables include `organization_id`.
- Most mutable tables include `created_at`, `updated_at`, and optionally `deleted_at` for soft deletion where historical records must be preserved.
- Financial, attendance, marks, delivery, and audit records should favor append-only or auditable mutation patterns.
- External IDs and school-visible numbers, such as admission numbers, invoice numbers, receipt numbers, and employee numbers, need tenant-scoped unique constraints.

---

## 7. Tenancy and Authorization Baseline

The current frontend protects tenant scope through `OrgProvider`, `WorkspaceGuard`, and local service filtering. The backend migration must move enforcement to the server.

Required backend controls:

- Authenticate every protected request.
- Resolve the requesting user from a server-issued session or token.
- Verify active membership for the target organization.
- Enforce role and permission checks on every mutation and sensitive read.
- Apply row-level tenant filters in repositories for all tenant-owned resources.
- Record audit logs for security-sensitive and operationally sensitive actions.

SIS-specific controls:

- Teachers can access assigned classes, sections, subjects, attendance, and marks according to teaching assignments.
- Accountants can access finance workflows without broad academic write access.
- Parents can access only linked student portal records.
- Students can access only their own portal records.
- Admin/Owner roles can access broad SIS administration with audit logging.

---

## 8. Migration Strategy

Use a strangler pattern. Keep the frontend service contracts stable while replacing storage adapters with API adapters behind each contract.

1. Define backend service interfaces that match existing frontend domain operations.
2. Introduce API-backed frontend adapters one bounded context at a time.
3. Keep localStorage/mock adapters available for tests, demos, and fallback until backend parity is verified.
4. Migrate seed/demo data to backend seed fixtures separately from runtime data.
5. Add contract tests around adapters before switching pages to API-backed services.
6. Remove browser-local runtime persistence only after DB-backed behavior is complete and validated.

Suggested DB sequence:

| Phase | Scope | Outcome |
| --- | --- | --- |
| DB-0 | Architecture baseline | This document; no runtime implementation |
| DB-1 | Backend application foundation | Backend app scaffold, health route, configuration, validation, error envelope |
| DB-2 | MySQL and migration foundation | Database connection, migration tooling, schema convention, first baseline migration |
| DB-3 | Auth, sessions, tenancy, RBAC | Server-side identity, tenant membership, role checks |
| DB-4 | Platform core persistence | Organizations, workspace members, module activation, audit logs |
| DB-5 | SIS academic and people core | Academic structure, students, guardians, staff, enrollments |
| DB-6 | SIS operations | Attendance, timetable, teaching assignments |
| DB-7 | SIS business workflows | Examinations, results, finance, communications, portal |
| DB-8 | AI agent persistence | Agent instances, runs, conversations, memory, workflows |
| DB-9 | Analytics and reporting | Reports, operational health, data quality, export records |
| DB-10 | Cleanup and hardening | Retire browser-local runtime persistence, performance, backup/restore, production readiness |

---

## 9. Data Classification

| Classification | Examples | Migration treatment |
| --- | --- | --- |
| Runtime transactional | Students, attendance records, invoices, marks, messages, agent runs | Durable MySQL tables with audit and tenant constraints |
| Configuration | Organization settings, module activation, portal policies, grading rules | Durable MySQL tables with history where business critical |
| Reference/catalog | Module definitions, agent templates, static provider definitions | Code registry or seeded tables depending on tenant customizability |
| Derived analytics | SIS overview metrics, report rows, health summaries | Recompute from transactional records first; snapshot later if needed |
| Browser session | Current auth session, active organization preference | Server session/token plus minimal browser preference storage |
| Demo/test seed | Current mock arrays and default localStorage seed data | Preserve as dev/test fixtures until backend seed system replaces them |

---

## 10. Service Adapter Plan

Each frontend service should eventually support this shape:

```text
Page/component
  -> hook/provider
  -> domain service interface
  -> local adapter OR API adapter
  -> apiClient
  -> backend route
```

Adapter priorities:

- Preserve method names and return types where they already match business workflows.
- Convert frontend-only calculations into backend domain services only when server authority is needed.
- Keep UI error handling stable by normalizing backend errors into the same service-level error shape.
- Add contract tests for API adapters before switching default exports.

Initial adapter candidates:

| Existing service | First API-backed replacement |
| --- | --- |
| `auth-service.ts` | `api-auth-service.ts` after DB-3 |
| `org-service.ts` | `api-org-service.ts` after DB-4 |
| `workspace-service.ts` | `api-workspace-service.ts` after DB-4 |
| `academic.service.ts` | `api-academic-service.ts` after DB-5 |
| `student.service.ts`, `staff.service.ts`, `enrollment.service.ts` | API-backed SIS people services after DB-5 |
| `attendance.service.ts`, `timetable.service.ts` | API-backed operations services after DB-6 |
| `examination.service.ts`, `finance.service.ts`, `communication.service.ts`, `portal.service.ts` | API-backed business services after DB-7 |
| Agent runtime services | API-backed agent persistence services after DB-8 |

---

## 11. Operational Requirements

Before production database use, the retrofit needs:

- Environment-specific configuration with no secrets exposed through `VITE_` variables.
- Centralized request IDs and structured logs.
- Audit logging for auth, tenant administration, SIS finance, marks publication, portal access changes, communication sends, and agent execution.
- Database backup and restore process.
- Migration rollback policy.
- Seed fixture strategy for demos and tests.
- Data export strategy for school records and finance reports.
- Rate limiting and abuse controls on auth, portal, communication, and agent execution endpoints.

---

## 12. DB-0 Acceptance Criteria

DB-0 is complete when:

- The recovered repository is used as the only active repository.
- Work starts from `develop` after the Epic 10J merge commit.
- A DB-0 feature branch exists.
- Architecture documentation explains current persistence, target architecture, migration phases, tenancy, authorization, and MySQL domain baseline.
- No app source code, UI, routing, auth implementation, localStorage service, backend code, ORM package, migration, Docker config, or database table is introduced.
- Build and test status is rechecked after documentation changes.
- Known full lint debt remains untouched and documented as out of scope.

