# HAZA-AIOS — EPIC 16
## Production Education Tools Specification

Epic 16 introduces 7 production-grade tools designed for Educational Academics and the **HAZA Academic Planning Assistant** (Epic 15).

---

### Tool Catalog Summary

| # | Tool Key | Mode | Risk Level | Required Permissions | Human Approval | Purpose |
|---|---|---|---|---|---|---|
| 1 | `education.academic_structure.read` | Sync | Low | `education.academic.read` | None | Retrieves academic years, grade levels, and sections for organizational planning context. |
| 2 | `education.subjects.list` | Sync | Low | `education.academic.read` | None | Lists authorized subjects and course codes available for a given grade level. |
| 3 | `education.curriculum.read` | Sync | Low | `education.academic.read` | None | Queries curriculum benchmarks and learning goals. Reports unverified status if not connected. |
| 4 | `education.lesson_plans.read` | Sync | Low | `education.academic.read` | None | Retrieves existing approved or draft lesson plans to avoid repetition and maintain progression. |
| 5 | `education.lesson_plans.create_draft` | Sync | Medium | `education.lesson_plan.create` | Tenant Configured | Creates a new structured lesson plan draft adhering to the 17-point schema. |
| 6 | `education.lesson_plans.update_draft` | Sync | Medium | `education.lesson_plan.manage` | Tenant Configured | Updates an existing draft lesson plan before teacher approval. |
| 7 | `education.lesson_plans.publish` | Sync | High | `education.lesson_plan.publish` | **Always** | Publishes an approved lesson plan directly to the active LMS class stream. |

---

### Detailed Tool Specifications

#### 1. `education.academic_structure.read`
- **Version:** `1.0.0`
- **Category:** `academic_structure`
- **Description:** Retrieve active academic years, grade levels, and sections for the tenant workspace.
- **Input Schema:**
  - `includeSections` (boolean, optional, default: false)
  - `status` (string enum: `all`, `active`, `upcoming`, optional, default: `active`)
- **Output Schema:**
  - `academicYears` (array of objects: `id`, `name`, `startDate`, `endDate`, `status`)
  - `gradeLevels` (array of objects: `id`, `name`, `code`, `sequence`)
  - `totalGrades` (integer)
  - `activeYear` (object, optional)

#### 2. `education.subjects.list`
- **Version:** `1.0.0`
- **Category:** `academic_structure`
- **Description:** List authorized academic subjects for a grade level or entire workspace.
- **Input Schema:**
  - `gradeId` (string UUID, optional)
- **Output Schema:**
  - `gradeId` (string, optional)
  - `subjects` (array of strings)
  - `count` (integer)
  - `summary` (string)

#### 3. `education.curriculum.read`
- **Version:** `1.0.0`
- **Category:** `curriculum`
- **Description:** Query official curriculum standards and benchmarks. Enforces pedagogical honesty: never fabricates standards when disconnected.
- **Input Schema:**
  - `gradeLevel` (string, required)
  - `subject` (string, required)
  - `topic` (string, required)
  - `curriculumStandard` (string, optional)
- **Output Schema:**
  - `standard` (string)
  - `status` (enum: `connected`, `general_guidance`)
  - `benchmarks` (array of strings)
  - `suggestedDurationMinutes` (integer)
  - `disclaimer` (string)

#### 4. `education.lesson_plans.read`
- **Version:** `1.0.0`
- **Category:** `lesson_planning`
- **Description:** Retrieve existing lesson plans for a subject and grade level to maintain instructional progression.
- **Input Schema:**
  - `subject` (string, required)
  - `grade` (string, required)
  - `status` (string enum: `draft`, `under_review`, `approved`, `published`, `all`, optional)
  - `limit` (integer, max: 20, default: 5)
- **Output Schema:**
  - `total` (integer)
  - `plans` (array of plan summaries: `id`, `title`, `topic`, `grade`, `subject`, `status`, `durationMinutes`, `learningObjectives`)

#### 5. `education.lesson_plans.create_draft`
- **Version:** `1.0.0`
- **Category:** `lesson_planning`
- **Description:** Create an editable lesson plan draft conforming to the HAZA 17-point educational schema.
- **Input Schema:** Full 17-point structured JSON payload (`lessonTitle`, `grade`, `subject`, `topic`, `durationMinutes`, `learningObjectives`, `materials`, `priorKnowledge`, `lessonIntroduction`, `teachingSequence`, `guidedPractice`, `independentActivities`, `differentiation`, `formativeAssessment`, `exitTicket`, `teacherNotes`, `homework`).
- **Output Schema:**
  - `planId` (string UUID)
  - `title` (string)
  - `status` (string: `draft`)
  - `revision` (integer: 1)
  - `message` (string)

#### 6. `education.lesson_plans.update_draft`
- **Version:** `1.0.0`
- **Category:** `lesson_planning`
- **Description:** Update an existing draft lesson plan. Rejects updates to already approved or published plans.
- **Input Schema:** `planId` (string UUID) + partial or complete 17-point lesson plan fields.
- **Output Schema:**
  - `planId` (string UUID)
  - `status` (string)
  - `revision` (integer)
  - `updatedAt` (string ISO timestamp)

#### 7. `education.lesson_plans.publish`
- **Version:** `1.0.0`
- **Category:** `lesson_planning`
- **Risk Level:** **High**
- **Approval Policy:** **Always (Requires Human Teacher Approval)**
- **Description:** Publish an approved lesson plan to the active LMS course stream and make it visible to students/teachers.
- **Input Schema:**
  - `planId` (string UUID, required)
  - `targetClassSectionId` (string UUID, required)
  - `scheduledDate` (string YYYY-MM-DD, required)
  - `publishMode` (string enum: `immediate`, `scheduled`, required)
- **Output Schema:**
  - `planId` (string UUID)
  - `status` (string: `published`)
  - `publishedAt` (string ISO timestamp)
  - `classSectionId` (string UUID)
  - `lmsStreamPostId` (string UUID)
  - `message` (string)
