# DB-17: Usage, Metering and SaaS Billing Persistence

Status: implemented on `feature/db17-usage-metering-billing-persistence`; pending review.
Production promotion and production migration remain separate Stage 19 work.

## Scope and existing boundaries

DB-9 SIS reporting and DB-8 student fee billing already persist independently.
DB-17 adds platform-level metering and SaaS commercial records; it does not
reinterpret school invoices as platform subscriptions. Agent and workflow run
tables remain the authoritative execution history.

## Persisted model

- `usage_meter_events`: immutable organization/workspace-scoped facts with
  metric, quantity, source, idempotency key, and timestamp. Terminal agent and
  workflow runs each produce one event in their existing transaction.
- `saas_plans`: an initially empty global catalog. No price or entitlement is
  invented or seeded by the migration.
- `billing_accounts`: one account per organization with billing contact,
  currency, and lifecycle status.
- `organization_subscriptions`: account/plan references and period/status
  history.
- `billing_statements`: period-scoped amount and usage snapshot records.
  Statements do not execute payment or send invoices.

Migration `0014_third_rawhide_kid.sql` is additive and seeds `usage.read`
and `billing.read` for existing Owner/Admin roles. The API grants these
permissions for newly created organizations too.

## API and security

`GET /api/v1/organizations/:organizationId/usage/events` is paginated.
`GET /api/v1/organizations/:organizationId/usage/summary` returns grouped
meter totals. `GET /api/v1/organizations/:organizationId/billing/overview`
returns only the active organization's account, latest subscriptions, and
statements. All require existing DB-4 organization permission checks.

No public usage-write, plan-write, subscription-write, payment, or statement
finalization endpoints are exposed. The overview reports
`chargingEnabled: false`. A separate approved commercial workflow must
define plan policy, entitlement enforcement, payment provider integration,
taxation, invoicing, and refund behavior before any financial charge is made.

Usage events are written only from validated terminal run references.
Organization/workspace/source ownership is checked; the unique
organization/idempotency key prevents duplicate metering facts. Only bounded
operational metadata is retained. These counters are observability and future
billing inputs, not independently verified provider token or monetary usage.

## Verification

The fresh migration chain, schema check, API quality gates, and disposable
MySQL integration suite verify run metering, idempotency, tenant isolation,
billing reads, and no charging side effect. Production MySQL, Railway,
Cloudflare, and `main` are untouched.
