# Stage 20G.2D: Outstanding Issues & Technical Debt Register

**Document ID:** `HAZA-AIOS-REL-20G2D-ISS-001`  
**Product:** HAZA AIOS  
**Target Release:** `v0.9.0-alpha.2`  
**Evaluation Date:** 14 October 2026  
**Status:** **ACTIVE TRACKING FOR STAGE 21**

---

## 1. Overview

This register documents all accepted residual risks, functional limitations, technical debt, and unverified production workflows deferred from Stage 20G to Stage 21.

None of these items are release-blocking for the alpha milestone (`v0.9.0-alpha.2`), but each requires formal prioritization in upcoming platform cycles.

---

## 2. Outstanding Issues & Technical Debt Register

| Issue ID | Domain | Summary & Impact | Current Operational Mitigation | Target Milestone | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-001** | Testing & QA | **Missing Browser-Driven E2E Automation:** Current regression suites (315 tests) execute in JSDOM / Supertest. Live browser workflows (cross-browser, visual rendering, complex form states) lack automated Playwright/Cypress coverage. | High unit and integration fidelity (100% pass rate); manual and headless browser smoke tests on public landing and login pages. | Stage 21 | **High** |
| **GAP-002** | Infrastructure | **Cloudflare Custom Hostname Edge SSL Automation:** Tenant domain verification generates 64-char cryptographic TXT tokens and validates DNS propagation, but automated SSL certificate provisioning via Cloudflare Custom Hostname API is deferred. | DNS TXT verification is fully operational; tenants configure standard CNAME routing; automated edge SSL pending Cloudflare API token. | Stage 21 | **Medium** |
| **GAP-003** | Frontend / UX | **Global Search UI Shell Limitation:** The top-bar search component functions as an interactive UI shell rather than executing multi-tenant cross-entity search indexing across SIS and agent entities. | UI behaves safely without crashing; scoped entity tables provide local filtering and search within directories. | Stage 21 | **Medium** |
| **GAP-004** | Disaster Recovery | **Lack of Automated Point-in-Time Recovery (PITR):** Production MySQL recovery relies on transaction-consistent manual logical dumps (`mysqldump`). In a restore scenario, transactions committed after the backup are not recoverable. | Verified backup captured immediately prior to deployment (`20261014_093605.sql`); restore rehearsal proven in 10.53s. Railway volume snapshots recommended. | Stage 21 | **High** |
| **GAP-005** | Database Architecture | **MySQL DDL Nontransactional Rollback:** MySQL automatically commits DDL statements (`CREATE TABLE`, `ALTER TABLE`), preventing transactional rollback via SQL `ROLLBACK` during failed migrations. | All migrations (0016 & 0017) are strictly additive; full isolated restore and migration rehearsals conducted prior to release. | Ongoing Architectural Policy | **Medium** |
| **GAP-006** | Observability | **Monitoring Window Successfully Completed (Closed):** The full 60-minute observation window (09:37:50–10:37:50 PKT / 04:37:50–05:37:50 UTC) has elapsed with 0 container restarts, 0 application crashes, and 0 HTTP 5xx errors. Telemetry coverage reflects continuous process supervisor uptime alongside periodic HTTP samples. | Continuous container health, zero restarts, and active sub-50ms HTTP 200 telemetry confirm operational stability. | Closed at 20G.2D-F | **Low** |
| **GAP-007** | Quality Assurance | **Authenticated Production Smoke Testing Gap:** Because production release governance strictly prohibits creating synthetic test users or printing credentials in logs, authenticated inner tenant workflows (SIS attendance, grades, finances, domain UI) were not smoke-tested in live production. | Complete integration test suite (131 API tests, 184 Web tests) covers all authenticated flows in local/staging environments with 100% pass rate. Dedicated staging environment with pre-seeded test tenants recommended for Stage 21. | Stage 21 | **Medium** |
| **GAP-008** | Environment Telemetry | **Host-to-Container Timestamp Discrepancy & Snapshot Time Limitation:** A ~150s offset exists between the local Windows host clock and the SQL dump footer. While suggesting clock drift, it cannot be conclusively proven without concurrent independent clock measurements. Exact snapshot second is not derivable from footer comment alone, though physical SHA-256 integrity is verified. | Cryptographic SHA-256 manifest match confirms file integrity; InnoDB snapshot consistency assured by transaction isolation. | Maintenance / Stage 21 | **Low** |

---

## 3. Prioritized Recommendations for Stage 21

1. **Establish Dedicated Staging Environment for Full-Stack E2E:**
   - Configure a staging Railway/Cloudflare deployment with isolated synthetic tenant data to enable automated authenticated browser testing without risking production data pollution.
2. **Implement Playwright Test Suite:**
   - Automate browser E2E tests for the core SIS workflows: Student Admission, Attendance Marking, Fee Generation, and Examination Grading.
3. **Configure Cloudflare API Token for SSL Automation:**
   - Complete `DomainService` integration with Cloudflare's Custom Hostnames API for zero-touch SSL certificate provisioning.
4. **Evaluate Railway Automated Volume Snapshots:**
   - Complement logical mysqldump snapshots with point-in-time storage volume backups.
