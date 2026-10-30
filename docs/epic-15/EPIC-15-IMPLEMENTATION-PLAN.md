# HAZA-AIOS — EPIC 15: FIRST PRODUCTION AI AGENT
## ARCHITECTURE SPECIFICATION & IMPLEMENTATION PLAN

---

### 1. Executive Summary & Baseline

- **Workspace:** `C:\HAZA-APPS\HAZA-AIOS`
- **Repository:** `HAZA-AIOS/haza-aios`
- **Source Baseline:** `v0.14.0-epic14` (commit `4c02b85`)
- **Target Release:** `v0.15.0-epic15`
- **Feature Branch:** `feature/epic-15-first-production-ai-agent`
- **Objective:** Implement and release the first fully operational, human-supervised AI agent in HAZA-AIOS: the **HAZA Academic Planning Assistant**. The agent empowers authorized education users (teachers, department heads, curriculum leads) to generate structured lesson plans, rigorous learning objectives, classroom activities, differentiation strategies, and formative assessment suggestions.
- **Core Platform Principle:** Reuse the existing AI Agent Platform from Epics 11–14 (Registry, Marketplace, Builder, Runtime, Provider Registry, Approval Engine, Auditing) without creating a disjointed separate AI system.

---

### 2. Architecture Audit & Reuse Points

#### A. Existing AI Agent Platform (Epics 11–14)
- **Agent Registry & Definitions:** `ai_agent_templates`, `ai_agent_definitions`, `ai_agent_installations`, `ai_agent_configuration_revisions`.
- **Execution & Queue Engine:** `ai_agent_runs`, `ai_agent_run_attempts`, `ai_agent_run_events`, `ai_agent_runtime_usage`.
- **Governance & Human Approval:** `ai_agent_approval_requests`, `ai_agent_approval_decisions`.
- **Provider Architecture:** `AiProvider`, `AiProviderRegistry`, `MockAiProvider`, model invocation interfaces.
- **State Machine:** Durable states: `queued` → `running` → (`awaiting_approval` ↔ `running`) → `completed` | `failed` | `cancelled`.

#### B. Identified Gaps & Target Implementations for Epic 15
1. **First Production Agent Definition:** Platform-managed `academic-planning-assistant` template and definition with education classification, academic planning category, robust schemas, system prompt instructions, and approval policy.
2. **Production AI Provider Adapter:** Implement a robust, production-capable provider adapter (`OpenAiProvider` / generic LLM adapter) supporting server-side credentials, streaming/JSON mode, cancellation, rate limiting, and explicit distinction between live inference, mock inference, and unconfigured providers.
3. **Dedicated Unattended Worker Service:** Epic 14 implemented transactional leasing and a `/worker/tick` endpoint, but relied on manual triggers. Epic 15 implements an autonomous worker daemon (`apps/api/src/worker.ts`) and provisions a dedicated Railway worker service for continuous queue processing.
4. **Structured Lesson Plan Domain & Persistence (Migration 0025):** Add `academic_lesson_plans` table to store editable lesson drafts, generated structured payloads, teacher revisions, curriculum alignment status, and human approval timestamps.
5. **Education & Academics Workspace Navigation:** Add entry points under `Education → Academic Structure / LMS → AI Academic Planning Assistant`.
6. **Teacher-Facing UI Primitives:** Implement `@haza-aios/ui` primitives for the Academic Planning Assistant workspace (Request Panel, Progress/Live Status, Structured Plan Editor, History, Governance Badge) before application page integration.

---

### 3. Agent Definition: HAZA Academic Planning Assistant

- **Stable Agent Identifier:** `00000000-0000-4100-8000-000000000104`
- **Slug / Key:** `academic-planning-assistant`
- **Name:** HAZA Academic Planning Assistant
- **Industry Classification:** `Education`
- **Category:** `Academic Planning`
- **Description:** Enterprise AI assistant that helps educators generate curriculum-guided, pedagogically sound, and differentiated lesson plans with classroom activities and formative assessments.
- **Supported Tasks:**
  - `generate_lesson_plan`: Complete structured lesson plan generation.
  - `refine_lesson_plan`: Section-by-section regeneration and pedagogy enhancement.
  - `suggest_activities`: Differentiated classroom and assessment activity generation.
- **Required Permissions:** `agent.read`, `workspace.read` (to execute), `workspace.manage` (to approve/publish).
- **Default Approval Policy:** Content remains in `draft` status until explicitly reviewed and approved by a teacher or academic admin.
- **Runtime Limits:** Max token output: 4,000; timeout: 60,000ms; max retries: 3.

---

### 4. Input & Structured Output Specification

#### Input Schema
```typescript
export interface AcademicPlanningInput {
  gradeLevel: string; // e.g. "Grade 7", "Year 10", "Kindergarten"
  subject: string; // e.g. "Mathematics", "Biology", "English Literature"
  topic: string; // e.g. "Photosynthesis", "Quadratic Equations"
  durationMinutes: number; // 15 to 240 minutes
  learningGoals: string; // specific learning outcomes
  teachingLanguage?: string; // default "English"
  curriculumReference?: string; // optional curriculum/standard reference
  priorKnowledge?: string; // optional prior student knowledge
  availableResources?: string; // optional classroom materials/tech
  activityPreference?: string; // e.g. "group work", "inquiry-based", "hands-on"
  assessmentPreference?: string; // e.g. "formative", "quiz", "exit ticket"
  additionalInstructions?: string; // optional teacher directives
}
```

#### Structured Output Schema
```typescript
export interface LessonPlanOutput {
  lessonTitle: string;
  grade: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  curriculumAlignment: {
    reference: string | null;
    verified: boolean;
    statement: string; // If not verified, clearly labeled as general pedagogical guidance
  };
  learningObjectives: Array<{
    type: "cognitive" | "skill" | "affective";
    description: string;
    bloomTaxonomyLevel?: string;
  }>;
  requiredMaterials: string[];
  priorKnowledge: string;
  lessonIntroduction: {
    hook: string;
    durationMinutes: number;
    instructions: string;
  };
  teachingSequence: Array<{
    stepNumber: number;
    title: string;
    durationMinutes: number;
    teacherActions: string;
    studentActions: string;
    keyPoints: string[];
  }>;
  guidedPractice: {
    activity: string;
    durationMinutes: number;
    checkpoints: string[];
  };
  independentActivities: {
    activity: string;
    durationMinutes: number;
    extensionTask?: string;
  };
  differentiationSuggestions: {
    forStrugglingStudents: string[];
    forAdvancedStudents: string[];
    forEalOrSpecialNeeds: string[];
  };
  formativeAssessment: {
    strategies: string[];
    guidingQuestions: string[];
  };
  exitTicket: {
    prompt: string;
    successCriteria: string;
  };
  teacherNotes: string[];
  homeworkSuggestions?: string[];
}
```

---

### 5. Prompt Engineering & Educational Safety Guardrails

- **System Instruction Directives:**
  - Strict adherence to educational pedagogy (Bloom's Taxonomy, Universal Design for Learning).
  - Explicit instruction: NEVER fabricate or invent specific state/national curriculum standards or codes. If no verified curriculum standard is attached, explicitly state "General Pedagogical Guidance".
  - Prompt Injection Defense: Teacher instructions are parsed as untrusted user input within bounded tags; system directives cannot be overridden.
  - Zero Student Profiling: No access to private student records or PII.
  - No Auto-Grading or Unauthorized Publishing: Agent outputs are drafts requiring human teacher review.

---

### 6. AI Provider Layer & Live/Mock Separation

- **Live Provider Adapter (`OpenAiProvider`):**
  - Reads `OPENAI_API_KEY` (and optional `OPENAI_BASE_URL`, `OPENAI_MODEL`).
  - Supports structured JSON mode (`response_format: { type: "json_object" }`).
  - Includes timeout, abort signals, rate-limit classification (`429` retryable), error redaction.
- **Provider Status Transparency:**
  - If `OPENAI_API_KEY` is not present, provider reports as unconfigured (`liveInferenceConfigured: false`).
  - Runtime gracefully falls back to deterministic `MockAiProvider` with transparent audit flags.
  - Metadata in run outputs explicitly indicates `isMockFallback: true/false`, `provider: "mock" | "openai"`.

---

### 7. Continuous Unattended Worker Engine

- **Dedicated Worker Service (`apps/api/src/worker.ts`):**
  - Loop with configurable poll interval (default 2000ms).
  - Atomic claim with lease tokens and heartbeat renewal.
  - Automatic stale lease recovery (`lease_expires_at < NOW(3)`).
  - Concurrency control (max concurrent runs per worker).
  - Graceful shutdown on `SIGINT`/`SIGTERM`.
  - Health check endpoint or ping log for Railway uptime monitoring.

---

### 8. Database Schema: Migration 0025

- **Table:** `academic_lesson_plans`
  - `id`: char(36) PK
  - `organization_id`: char(36) FK `organizations.id`
  - `workspace_id`: char(36) FK `workspaces.id`
  - `agent_run_id`: char(36) NULL FK `ai_agent_runs.id`
  - `title`: varchar(255) NOT NULL
  - `grade`: varchar(50) NOT NULL
  - `subject`: varchar(100) NOT NULL
  - `topic`: varchar(255) NOT NULL
  - `duration_minutes`: int NOT NULL
  - `learning_objectives`: json NOT NULL
  - `content`: json NOT NULL (full structured LessonPlanOutput)
  - `status`: enum('draft', 'reviewed', 'approved', 'published', 'archived') NOT NULL DEFAULT 'draft'
  - `curriculum_reference`: varchar(255) NULL
  - `curriculum_verified`: boolean NOT NULL DEFAULT false
  - `created_by`: char(36) FK `users.id`
  - `approved_by`: char(36) NULL FK `users.id`
  - `approved_at`: timestamp(3) NULL
  - `created_at`: timestamp(3) NOT NULL
  - `updated_at`: timestamp(3) NOT NULL
- Indexes on `(organization_id, workspace_id)`, `(organization_id, status)`, `(organization_id, created_by)`.

---

### 9. Frontend & Teacher Experience

1. **`@haza-aios/ui` Components:**
   - `AcademicPlanningRequestCard`
   - `LessonPlanViewer`
   - `LessonPlanEditor`
   - `PlanStatusBadge`
   - `CurriculumVerificationIndicator`
2. **Page Views:**
   - `/workspace/education/academic/assistant`: Full workspace for generating, streaming/polling run progress, viewing and editing generated plans, approving drafts, exporting to PDF/Markdown/JSON.
   - History tab listing past plans with statuses (`draft`, `approved`, etc.).

---

### 10. Execution Plan & Quality Gates

1. **Phase 1:** Baseline & Architecture Audit (Completed)
2. **Phase 2:** Agent Definition in Registry & Templates
3. **Phase 3 & 4:** Input & Structured Output Schemas with Validation
4. **Phase 5:** System Instructions & Educational Guardrails
5. **Phase 6:** Live Provider Integration (`OpenAiProvider` + Provider Registry)
6. **Phase 7:** Worker Service Daemon (`worker.ts`) & Unattended Processing
7. **Phase 8 & 9:** Education Module Service & UI Primitives in `@haza-aios/ui`
8. **Phase 10 & 11:** Human Approval & API Endpoints
9. **Phase 12:** Safety, Security & Redaction
10. **Phase 13 & 14:** Comprehensive Automated Tests & Quality Evaluation
11. **Phase 15:** GitHub PR & CI Verification
12. **Phase 16:** Controlled Production Release (Backup, Rehearsal, Railway Deploy, Smoke Test, Release Tag)
13. **Phase 17:** Final Release Report
