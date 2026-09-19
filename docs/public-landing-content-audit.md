# Public landing content and logo audit

## Release boundary

This change is frontend-only, based on production main after PR #28. It does not
merge develop, DB-14 backend code, DB-15, migrations or infrastructure changes.
The Cloudflare `api.haza-aios.com/*` no-Worker exclusion must remain unchanged.

## Logo diagnosis

The original-logo commit `8b73ba5a99422403ad666ec1ec21839e15b3dcec` exists on
develop but is not an ancestor of production main. Main still rendered the
letter-based LogoMark. The cause was a branch/release mismatch, not demonstrated
cache staleness. This change brings only the original image and shared mark into
main's frontend release. The previously unused `/branding/haza-logo.png` path
serves the real asset; no cache purge is required. Metadata uses it as favicon.
The shared mark also updates authentication and workspace branding without
changing workspace layout or behavior.

## Evidence map

| Public content                  | Repository evidence                                                                                                        | Wording boundary                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Platform layers and stack       | docs/architecture/Project_Architecture_Blueprint.md; workspace package files                                               | Modular monorepo, not microservices                                     |
| Identity and tenant access      | docs/database-migration/17-db4-auth-users-rbac.md; API auth/platform modules                                               | Implementation controls, no certifications                              |
| SIS core and academics          | docs/database-migration/18-db5-sis-core-persistence.md                                                                     | Existing student/staff/academic operations                              |
| Attendance and timetable        | docs/database-migration/19-db6-attendance-timetable-persistence.md                                                         | Operational records, not automatic workflow execution                   |
| Exams and results               | docs/database-migration/20-db7-examination-assessment-results-persistence.md                                               | Assessment, marks and publication                                       |
| Finance, communication, portals | docs/database-migration/21-db8-finance-communication-portal-persistence.md                                                 | Payment records, not payment processing; no provider delivery guarantee |
| Analytics                       | docs/database-migration/22-db9-sis-analytics-reporting-persistence.md                                                      | Server-side SIS aggregation and CSV, not cross-industry intelligence    |
| Agents, history and memory      | docs/database-migration/24-db11-ai-agent-registry-configuration-persistence.md through 26-db13-agent-memory-persistence.md | Persistent definitions/history/memory; executor still MockModelProvider |
| Knowledge                       | origin/develop:docs/database-migration/27-db14-agent-knowledge-persistence.md                                              | Development baseline, not included in this production release           |
| Workflows                       | Existing frontend prototype and DB-15 specification                                                                        | Durable persistence/orchestration deferred                              |

## Public composition

PublicLandingPage composes modular Section, FeatureGrid, Flow, header, hero,
architecture, education, status and footer components. Data lives separately in
platform-content.ts. Styles are scoped under the public page and its named
components; authenticated dashboard styles are not changed. Existing legacy
marketing components remain available but are not rendered where their sample
customer logos, metrics, prices or inert controls conflict with verified content.

The page has five responsive diagrams: platform architecture, organizational
operations, agent flow, school lifecycle and authorized data flow. Ordered lists
preserve reading order without reliance on color or animation. No new runtime
dependencies or backend endpoints are introduced. Demo delivery must not be
claimed without a confirmed contact destination.
