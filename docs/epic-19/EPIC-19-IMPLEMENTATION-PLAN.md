# HAZA-AIOS — EPIC 19 IMPLEMENTATION PLAN
## Multi-Agent Collaboration & Orchestration

**Document ID:** `HAZA-EPIC-19-PLAN-001`  
**Target Release:** `v0.19.0-epic19`  
**Baseline Release:** `v0.18.0-epic18`  
**Git Branch:** `feature/epic-19-multi-agent-orchestration`  
**Status:** `IN PROGRESS`  
**Author:** Antigravity AI Systems Architect  
**Date:** 2026-11-03  

---

## 1. Executive Summary & Mission Mandate

Epic 19 introduces **Multi-Agent Collaboration & Orchestration** to HAZA-AIOS, enabling coordinated teams of specialized AI agents to solve complex organizational tasks through directed acyclic graph (DAG) workflows.

Building directly upon Epics 11–18 (Agent Runtime, Configuration Builder, Tool Gateway, Knowledge Engine, and Live Provider Gateway), Epic 19 delivers:
1. **Agent Team Roster & Role Specialization:** Organization-scoped agent teams where agents are assigned dedicated roles (`planner`, `specialist`, `reviewer`, `supervisor`) with capability profiles and priority orderings.
2. **DAG Workflow Definition Engine:** Versioned workflow definitions supporting sequential, parallel (split-merge), and supervisor-worker patterns with Kahn's topological sort validation and cycle detection.
3. **Durable Orchestration Coordinator:** Step-by-step DAG traversal, dependency resolution, parallel dispatch, and state tracking backed by relational tables.
4. **Shared Context & Artifact Transfer:** Structured knowledge and output propagation across steps with source attribution, provenance records, and prompt injection boundaries.
5. **Human-in-the-Loop Approval Gates:** Consequential actions and review steps pause workflow runs until explicit human review and sign-off is granted or rejected.
6. **Zero Second Runtime:** Reuses existing `AgentRuntimeService`, `UnifiedAiProviderGateway`, `AgentToolGatewayService`, and `KnowledgeService` without introducing redundant runtimes or bypassing security controls.

---

## 2. Baseline Architecture Audit & Current State

- **Monorepo Baseline:** Commit `39ef9e28fa039bf82cefe788bc57f2010db9f1b9` (`main`), tagged `v0.18.0-epic18`.
- **Production Endpoints:**
  - API: `https://api.haza-aios.com` (Online, Node.js + Express/Drizzle)
  - Web: `https://web-production-76faf.up.railway.app` (Online, React + Vite + Tailwind + @haza-aios/ui)
  - Worker: `worker` service (Online, durable background job execution)
  - Database: Railway MySQL with 28 applied migrations through `0028_live_ai_provider_integration.sql`.
- **Existing Capabilities:**
  - Multi-tenant RBAC with organization and workspace scoping.
  - Education SIS and LMS domain models.
  - Agent marketplace, instance deployment, and life-cycle management.
  - Provider gateway supporting live OpenAI and deterministic mock modes with per-tenant cost controls.

---

## 3. Sequential Implementation Phases

```
+-------------------------------------------------------------------------------------------------------+
|                                    EPIC 19 EXECUTION ROADMAP                                          |
+-------------------------------------------------------------------------------------------------------+
|                                                                                                       |
|  [Phase 19A: Foundation & Data Model]                                                                 |
|  - Schema DDL: 8 Tables (Teams, Members, Workflows, Steps, Runs, Step Runs, Artifacts, Events)         |
|  - Migration 0029, Domain Types, DAG Validation & Cycle Detection Engine (Topological Sort)           |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 19B: Agent Team Management & Capabilities]                                                    |
|  - AgentTeamRepository & AgentTeamService, Role Assignment, Tenant Isolation, RBAC Controls           |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 19C: Workflow Definition & DAG Execution Engine]                                              |
|  - AgentWorkflowRepository & AgentOrchestrationService, Sequential/Parallel Patterns, Root Dispatch    |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 19D: Shared Context, Artifacts & Human Approvals]                                             |
|  - Upstream Context Propagation, Structured Lesson Artifacts, Human Approval Gates, Events Log         |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 19E: Web UI Client & Orchestration Console]                                                   |
|  - Orchestration Service Client, 5 Console Screens: Teams, Builder, Monitor, Approvals, Artifacts     |
|                                       │                                                               |
|                                       ▼                                                               |
|  [Phase 19F: Verification, Backup, Migration Rehearsal & Release]                                     |
|  - Unit & Integration Test Suite, Remote MySQL Backup, Isolated Rehearsal, PR, Tag v0.19.0-epic19      |
+-------------------------------------------------------------------------------------------------------+
```

---

## 4. Demonstrator Scenario: Grade 6 Science Unit Plan

The end-to-end multi-agent orchestration is validated against a real-world educational workflow:
- **Topic:** "Cells and Living Systems" (Grade 6 Science).
- **Step 1 (Planner):** Curriculum Planning Agent creates overall unit outline and 5-lesson progression aligned with learning standards.
- **Step 2 (Specialist):** Lesson Activity Specialist generates lab activities, inquiry questions, and daily teaching materials using upstream unit plan outputs.
- **Step 3 (Specialist):** Formative Assessment Specialist creates quizzes, rubrics, and exit tickets in parallel.
- **Step 4 (Supervisor / Reviewer):** Academic Reviewer evaluates content alignment and compiles complete unit pack.
- **Step 5 (Human Approval Gate):** Curriculum Coordinator inspects final unit pack artifact and grants human sign-off before publishing to LMS.

---

## 5. Quality & Release Standards
- **Zero Mock CI Bypass:** Automated test suites run in deterministic mock mode without paid API token consumption.
- **Fail-Closed Security:** Unauthorized cross-tenant queries, cyclic DAGs, and rejected approvals fail immediately and securely.
- **Production Guardrails:** Mandatory isolated database migration rehearsal before production schema updates.

