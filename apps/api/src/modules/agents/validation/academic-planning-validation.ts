import { ApiError } from "../../../common/errors/api-error.js";
import type {
  AcademicObjective,
  AcademicPlanningInput,
  LessonPlanOutput,
  TeachingSequenceStep,
} from "../academic-planning.types.js";

export function validateAcademicPlanningInput(body: unknown): AcademicPlanningInput {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "VALIDATION_FAILED", "Request body must be a JSON object.");
  }

  const data = body as Record<string, unknown>;

  // 1. Grade level
  if (typeof data.gradeLevel !== "string" || !data.gradeLevel.trim()) {
    throw new ApiError(400, "VALIDATION_FAILED", "gradeLevel is required and must be a non-empty string.");
  }
  if (data.gradeLevel.trim().length > 50) {
    throw new ApiError(400, "VALIDATION_FAILED", "gradeLevel must not exceed 50 characters.");
  }

  // 2. Subject
  if (typeof data.subject !== "string" || !data.subject.trim()) {
    throw new ApiError(400, "VALIDATION_FAILED", "subject is required and must be a non-empty string.");
  }
  if (data.subject.trim().length > 100) {
    throw new ApiError(400, "VALIDATION_FAILED", "subject must not exceed 100 characters.");
  }

  // 3. Topic
  if (typeof data.topic !== "string" || !data.topic.trim()) {
    throw new ApiError(400, "VALIDATION_FAILED", "topic is required and must be a non-empty string.");
  }
  if (data.topic.trim().length > 255) {
    throw new ApiError(400, "VALIDATION_FAILED", "topic must not exceed 255 characters.");
  }

  // 4. Duration
  const rawDuration = Number(data.durationMinutes);
  if (!Number.isInteger(rawDuration) || rawDuration < 15 || rawDuration > 240) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "durationMinutes must be an integer between 15 and 240 minutes.",
    );
  }

  // 5. Learning goals
  if (typeof data.learningGoals !== "string" || data.learningGoals.trim().length < 5) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      "learningGoals is required and must be at least 5 characters.",
    );
  }
  if (data.learningGoals.trim().length > 2000) {
    throw new ApiError(400, "VALIDATION_FAILED", "learningGoals must not exceed 2000 characters.");
  }

  // 6. Optional fields
  const teachingLanguage =
    typeof data.teachingLanguage === "string" ? data.teachingLanguage.trim().slice(0, 50) : "English";

  const curriculumReference =
    typeof data.curriculumReference === "string" && data.curriculumReference.trim()
      ? data.curriculumReference.trim().slice(0, 255)
      : undefined;

  const sanitizeOptional = (val: unknown): string | undefined => {
    if (typeof val !== "string") return undefined;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 2000) : undefined;
  };

  return {
    gradeLevel: data.gradeLevel.trim(),
    subject: data.subject.trim(),
    topic: data.topic.trim(),
    durationMinutes: rawDuration,
    learningGoals: data.learningGoals.trim(),
    teachingLanguage: teachingLanguage || "English",
    curriculumReference,
    priorKnowledge: sanitizeOptional(data.priorKnowledge),
    availableResources: sanitizeOptional(data.availableResources),
    activityPreference: sanitizeOptional(data.activityPreference),
    assessmentPreference: sanitizeOptional(data.assessmentPreference),
    additionalInstructions: sanitizeOptional(data.additionalInstructions ?? data.teacherInstructions),
  };
}

/**
 * Safely parses and repairs raw AI model output into a valid LessonPlanOutput object.
 * Strips markdown code blocks, normalizes keys, and bounds fields.
 */
export function parseAndValidateLessonPlanOutput(raw: string | unknown): LessonPlanOutput {
  let parsed: any;

  if (typeof raw === "string") {
    let clean = raw.trim();

    // Strip markdown JSON fences if present
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    try {
      parsed = JSON.parse(clean);
    } catch (err: any) {
      // Attempt common repair: trim leading or trailing non-JSON characters
      const firstBrace = clean.indexOf("{");
      const lastBrace = clean.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          parsed = JSON.parse(clean.substring(firstBrace, lastBrace + 1));
        } catch {
          throw new ApiError(
            422,
            "VALIDATION_FAILED",
            `AI model produced invalid JSON that could not be repaired: ${err.message}`,
          );
        }
      } else {
        throw new ApiError(
          422,
          "VALIDATION_FAILED",
          `AI model produced non-JSON output: ${clean.slice(0, 100)}`,
        );
      }
    }
  } else if (raw && typeof raw === "object") {
    parsed = raw;
  } else {
    throw new ApiError(422, "VALIDATION_FAILED", "Expected object or JSON string from AI model.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(422, "VALIDATION_FAILED", "Lesson plan output root must be an object.");
  }

  // Validate core fields
  const lessonTitle =
    typeof parsed.lessonTitle === "string" && parsed.lessonTitle.trim()
      ? parsed.lessonTitle.trim()
      : "Untitled Lesson Plan";

  const grade = typeof parsed.grade === "string" ? parsed.grade.trim() : "Unspecified Grade";
  const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : "General";
  const topic = typeof parsed.topic === "string" ? parsed.topic.trim() : "General Topic";
  const durationMinutes = Number(parsed.durationMinutes) || 45;

  // Curriculum alignment
  const rawCurriculum = parsed.curriculumAlignment ?? {};
  const curriculumAlignment = {
    reference: typeof rawCurriculum.reference === "string" ? rawCurriculum.reference.trim() : null,
    verified: Boolean(rawCurriculum.verified),
    statement:
      typeof rawCurriculum.statement === "string" && rawCurriculum.statement.trim()
        ? rawCurriculum.statement.trim()
        : "General Pedagogical Guidance (Unverified Curriculum Alignment)",
  };

  // Learning objectives
  const learningObjectives: AcademicObjective[] = Array.isArray(parsed.learningObjectives)
    ? parsed.learningObjectives.map((obj: any, idx: number) => {
        const type = ["cognitive", "skill", "affective"].includes(obj?.type) ? obj.type : "cognitive";
        const desc = typeof obj?.description === "string" ? obj.description : `Objective ${idx + 1}`;
        const bloom = [
          "remember",
          "understand",
          "apply",
          "analyze",
          "evaluate",
          "create",
        ].includes(obj?.bloomTaxonomyLevel)
          ? obj.bloomTaxonomyLevel
          : "understand";
        return { type, description: desc, bloomTaxonomyLevel: bloom };
      })
    : [
        {
          type: "cognitive",
          description: "Understand the core concepts of the lesson.",
          bloomTaxonomyLevel: "understand",
        },
      ];

  // Required materials
  const requiredMaterials = Array.isArray(parsed.requiredMaterials)
    ? parsed.requiredMaterials.map(String)
    : ["Whiteboard and markers", "Notebooks / Student devices"];

  // Prior knowledge
  const priorKnowledge =
    typeof parsed.priorKnowledge === "string" ? parsed.priorKnowledge : "Basic foundational concepts.";

  // Introduction
  const rawIntro = parsed.lessonIntroduction ?? {};
  const lessonIntroduction = {
    hook: typeof rawIntro.hook === "string" ? rawIntro.hook : "Engaging opening question or demonstration.",
    durationMinutes: Number(rawIntro.durationMinutes) || 10,
    instructions:
      typeof rawIntro.instructions === "string" ? rawIntro.instructions : "Set lesson stage and activate prior knowledge.",
  };

  // Teaching sequence
  const teachingSequence: TeachingSequenceStep[] = Array.isArray(parsed.teachingSequence)
    ? parsed.teachingSequence.map((step: any, idx: number) => ({
        stepNumber: Number(step?.stepNumber) || idx + 1,
        title: typeof step?.title === "string" ? step.title : `Instructional Step ${idx + 1}`,
        durationMinutes: Number(step?.durationMinutes) || 10,
        teacherActions: typeof step?.teacherActions === "string" ? step.teacherActions : "Direct instruction.",
        studentActions: typeof step?.studentActions === "string" ? step.studentActions : "Active note taking and engagement.",
        keyPoints: Array.isArray(step?.keyPoints) ? step.keyPoints.map(String) : [],
      }))
    : [
        {
          stepNumber: 1,
          title: "Concept Introduction",
          durationMinutes: 15,
          teacherActions: "Model key principles.",
          studentActions: "Observe and take notes.",
          keyPoints: ["Core concept overview"],
        },
      ];

  // Guided practice
  const rawGuided = parsed.guidedPractice ?? {};
  const guidedPractice = {
    activity:
      typeof rawGuided.activity === "string"
        ? rawGuided.activity
        : "Collaborative problem-solving with teacher facilitation.",
    durationMinutes: Number(rawGuided.durationMinutes) || 15,
    checkpoints: Array.isArray(rawGuided.checkpoints)
      ? rawGuided.checkpoints.map(String)
      : ["Check student understanding at midpoint"],
  };

  // Independent activities
  const rawInd = parsed.independentActivities ?? {};
  const independentActivities = {
    activity:
      typeof rawInd.activity === "string" ? rawInd.activity : "Individual practice exercises.",
    durationMinutes: Number(rawInd.durationMinutes) || 15,
    extensionTask: typeof rawInd.extensionTask === "string" ? rawInd.extensionTask : undefined,
  };

  // Differentiation
  const rawDiff = parsed.differentiationSuggestions ?? {};
  const differentiationSuggestions = {
    forStrugglingStudents: Array.isArray(rawDiff.forStrugglingStudents)
      ? rawDiff.forStrugglingStudents.map(String)
      : ["Provide scaffolding worksheets with worked examples"],
    forAdvancedStudents: Array.isArray(rawDiff.forAdvancedStudents)
      ? rawDiff.forAdvancedStudents.map(String)
      : ["Assign open-ended inquiry and extension challenges"],
    forEalOrSpecialNeeds: Array.isArray(rawDiff.forEalOrSpecialNeeds)
      ? rawDiff.forEalOrSpecialNeeds.map(String)
      : ["Use visual vocabulary glossaries and multimodal prompts"],
  };

  // Formative assessment
  const rawAssessment = parsed.formativeAssessment ?? {};
  const formativeAssessment = {
    strategies: Array.isArray(rawAssessment.strategies)
      ? rawAssessment.strategies.map(String)
      : ["Observational checklist", "Targeted questioning"],
    guidingQuestions: Array.isArray(rawAssessment.guidingQuestions)
      ? rawAssessment.guidingQuestions.map(String)
      : ["Can students explain the primary concept in their own words?"],
  };

  // Exit ticket
  const rawExit = parsed.exitTicket ?? {};
  const exitTicket = {
    prompt:
      typeof rawExit.prompt === "string"
        ? rawExit.prompt
        : "Summarize one key takeaway and one question you still have.",
    successCriteria:
      typeof rawExit.successCriteria === "string"
        ? rawExit.successCriteria
        : "Demonstrates understanding of primary objective.",
  };

  // Teacher notes
  const teacherNotes = Array.isArray(parsed.teacherNotes)
    ? parsed.teacherNotes.map(String)
    : ["Anticipate common student misconceptions."];

  // Homework suggestions
  const homeworkSuggestions = Array.isArray(parsed.homeworkSuggestions)
    ? parsed.homeworkSuggestions.map(String)
    : [];

  return {
    lessonTitle,
    grade,
    subject,
    topic,
    durationMinutes,
    curriculumAlignment,
    learningObjectives,
    requiredMaterials,
    priorKnowledge,
    lessonIntroduction,
    teachingSequence,
    guidedPractice,
    independentActivities,
    differentiationSuggestions,
    formativeAssessment,
    exitTicket,
    teacherNotes,
    homeworkSuggestions: homeworkSuggestions.length > 0 ? homeworkSuggestions : undefined,
  };
}
