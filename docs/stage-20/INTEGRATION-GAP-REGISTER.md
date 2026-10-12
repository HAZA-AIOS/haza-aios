# Integration Gap Register

| Gap ID | Module | Status | Missing Integration | Recommended Fix | Priority | Stage 20 Sprint | Release Classification |
|---|---|---|---|---|---|---|---|
| GAP-001 | Education / SIS | Resolved | Backend CRUD tested and wired to UI. Tests un-skipped. | - | Resolved | Stage 20B | Completed |
| GAP-002 | Registration | Partially Resolved | DNS TXT verification implemented | DNS verification done via `node:dns`. Cloudflare provisioning pending auth setup. | P1 | Stage 20C.1 | Conditional Release Requirement |
| GAP-003 | Education / Finance | Resolved | Finance reports and invoice pages have no API client backing | Create `finance` module routes and API client | P2 | Stage 20D | Completed |
| GAP-004 | Platform | Resolved | Operational logging is robust but lacks frontend filtering capabilities | Added pagination and filtering to `AdminAuditLogPage.tsx` | P3 | Stage 20E | Accepted Limitation |
| GAP-005 | Shared | Open | Search function relies on local state | Implement full-text search backend endpoint | P2 | Stage 20C | Accepted Limitation (Post-v0.9 Backlog) |
| GAP-006 | Platform/Testing | Resolved | Database integration tests are blocked by high-concurrency SSH tunnel connection resets | Implemented isolated local MySQL/MariaDB database test runner with fail-closed guard; validated via 22-test security suite and full 26-suite integration pass | P1 | Stage 20F.1 / 20F.2 | Completed |


