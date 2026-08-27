# DB-8 Finance, Communication, and Portal Persistence

DB-8 migrates the Epic 10G finance, Epic 10H communication, and Epic 10I portal state from browser-local storage toward the shared HAZA API and MySQL persistence baseline.

## Scope

- Finance records now persist behind tenant-scoped API routes for fee categories, fee structures, student fee assignments, discounts, invoices, payments, receipts, ledgers, and reports.
- Communication records now persist behind tenant-scoped API routes for templates, announcements, messages, notifications, delivery history, preferences, summary metrics, and domain notifications.
- Portal mutable records now persist behind tenant-scoped API routes for portal policy and self-service update requests.
- Portal dashboards remain projection/aggregation behavior over existing SIS source records: students, enrollments, attendance, timetable, published results, finance, and communication.
- Existing frontend service method names are preserved so Epic 10G, 10H, and 10I screens keep their current contracts.

## Migration

Migration `0006_firm_bursar.sql` creates DB-8 tables:

- `finance_fee_categories`
- `finance_fee_structures`
- `finance_student_fee_assignments`
- `finance_discounts`
- `finance_invoices`
- `finance_payments`
- `finance_receipts`
- `communication_templates`
- `announcements`
- `communication_messages`
- `sis_notifications`
- `communication_deliveries`
- `notification_preferences`
- `portal_policies`
- `portal_update_requests`

All records are scoped by `workspace_id`; API tenant resolution maps the public `organizationId` to the active education workspace before data access. Finance records also index student, invoice, status, academic-year, class, and document-number fields required by operational reports.

## Integrity Rules

- Finance payments are recorded rather than destructive-deleted.
- Voiding a payment updates payment state and recalculates invoice paid/balance totals.
- Overpayments are rejected.
- Duplicate active payment references are rejected per tenant.
- Communication send requests support idempotency keys per workspace.
- Teacher communication audience resolution is constrained by active teaching assignments.
- Portal policies and requests persist without duplicating attendance, timetable, result, or finance data into portal tables.

## Verification

Implemented coverage includes:

- Frontend service tests for finance, communication, and portal API adapters through the shared SIS fetch harness.
- API integration coverage for persisted DB-8 finance, communication, and portal records, reload durability, tenant isolation, and financial mutation validation.
