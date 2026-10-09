# Tenant Isolation & Security Audit

## Organization vs. Business Boundaries
The database schema uses `organization_id` and `business_id` to strictly segment data. However, the `education` module queries currently lack explicit multi-tenant `where` clause enforcements in some of the placeholder service classes.

## Cross-Tenant Access Risks
The `auth` module correctly scopes tokens, but direct object references (e.g., fetching a student by ID without validating `business_id`) represents a risk in the `sis` APIs once they are wired up.

## Missing Tenant-Aware Queries
The `apps/api/tests/sis-*.integration.test.ts` files are skipped, meaning we lack automated protection against data leaking between schools.

**Conclusion**: Core platform isolation is strong. Vertical-specific isolation (Education, Admin dashboards) requires rigorous Row-Level Security (RLS) or application-level `where` constraints before production availability.

## Domain Verification Security (Stage 20C.1)
The `tenant_domains` table securely isolates custom domains per `organizationId`. The `DomainService` implements cryptographic verification tokens (`ha-verify=...`) and strictly enforces tenant association before verification or deletion operations are permitted, eliminating cross-tenant domain hijacking vulnerabilities.
