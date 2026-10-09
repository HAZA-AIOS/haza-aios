# Integration Gap Register

| Gap ID | Module | Status | Missing Integration | Recommended Fix | Priority | Stage 20 Sprint |
|---|---|---|---|---|---|---|
| GAP-001 | Education / SIS | Fully Integrated | Backend CRUD tested and wired to UI. Tests un-skipped. | - | Resolved | Stage 20B |
| GAP-002 | Registration | Partial | Domain verification mechanism is mocked | Implement Cloudflare API hook for domain verification | P1 | Stage 20C |
| GAP-003 | Education / Finance | UI-Only | Finance reports and invoice pages have no API client backing | Create `finance` module routes and API client | P2 | Stage 20D |
| GAP-004 | Platform | Backend-Only | Operational logging is robust but lacks frontend filtering capabilities | Add pagination and filtering to `AdminAuditLogPage.tsx` | P3 | Stage 20E |
| GAP-005 | Shared | UI-Only | Search function relies on local state | Implement full-text search backend endpoint | P2 | Stage 20C |
