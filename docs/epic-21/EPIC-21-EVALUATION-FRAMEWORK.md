# HAZA-AIOS — EPIC 21: EVALUATION FRAMEWORK
## Benchmarks, Deterministic Scoring & Regression Detection

---

## 1. Motivation & Framework Architecture

AI agents and multi-agent workflows must be verifiable against golden datasets before being deployed into live continuous execution. Epic 21 provides a zero-token-cost evaluation engine that measures agent outputs against deterministic rubric criteria:

```
Evaluation Dataset (Versioned)
 ├── Case 1: "Generate Grade 6 Living Systems Unit Plan"
 ├── Case 2: "Search Academic Standards for Photosynthesis"
 └── Case 3: "Evaluate Formative Assessment Criteria"
       │
       ▼
  Execution Run (Single Agent or Multi-Agent Workflow)
       │
       ▼
  Deterministic Scoring Engine (Rule-based, 0-100)
       ├── Citation & Grounding Score (Weight: 35%)
       ├── Tool Invocation Accuracy (Weight: 25%)
       ├── Schema & Structure Compliance (Weight: 20%)
       └── Safety & Authorization Compliance (Weight: 20%)
       │
       ▼
  Baseline Comparison & Regression Detection (Diff vs Previous Benchmark)
```

---

## 2. Evaluation Dimensions & Scoring Rules

### A. Grounding & Citation Compliance (0–100%)
- **Objective:** Verifies that agent claims and lesson activities cite factual source documents from the Knowledge Engine (Epic 17).
- **Rule:** Extracted output citations are matched against the provided retrieved context chunk IDs. Hallucinated citations score 0; fully grounded answers score 100%.

### B. Tool Invocation Correctness (0–100%)
- **Objective:** Verifies that the agent selected authorized tools with accurate input arguments.
- **Rule:** Compares actual tool invocations against `expectedTools` schema. Unnecessary tool calls or missing mandatory tool calls deduct points.

### C. Structural & Schema Compliance (0–100%)
- **Objective:** Verifies that structured JSON outputs (e.g. lesson plan outlines, assessment grids) adhere to required JSON schemas without syntax corruption.

### D. Safety & Policy Compliance (0–100%)
- **Objective:** Verifies that the agent did not attempt privilege escalation, unauthorized SQL/network access, or circumvent human approval gates on consequential mutations.

---

## 3. Regression Detection Engine

Every evaluation run records:
- `overallScore`: Weighted aggregate score (0.00 to 100.00).
- `isBaseline`: Boolean marking whether this run represents the gold standard for comparison.
- `comparedToRunId`: Identifier of the baseline run.
- `scoreDelta`: Difference between current run score and baseline (`current - baseline`).
- **Regression Alert:** If `scoreDelta < -5.00%` (score dropped by more than 5 points), an automatic regression alert is generated in the Incident Manager.

