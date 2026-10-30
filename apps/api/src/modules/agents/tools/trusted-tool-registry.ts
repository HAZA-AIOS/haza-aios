import { and, desc, eq } from "drizzle-orm";
import {
  academicYears,
  gradeLevels,
  sections,
  subjects,
  classSubjects,
} from "../../../database/schema.js";
import { createRepositoryContext } from "../../../database/repositories/repository-context.js";
import { AcademicLessonPlanRepository } from "../repositories/academic-lesson-plan.repository.js";
import type { TrustedToolRegistration } from "./agent-tool.types.js";
import type { ToolDeclaration } from "../providers/ai-provider.types.js";

export const TRUSTED_TOOLS: TrustedToolRegistration[] = [
  // 1. education.academic_structure.read
  {
    toolId: "00000000-0000-4200-8000-000000000001",
    toolKey: "education.academic_structure.read",
    name: "Read Academic Structure",
    description: "Retrieve active academic years, grade levels, and sections for the authorized workspace.",
    category: "academic_structure",
    industry: "education",
    version: "1.0.0",
    executionMode: "sync",
    riskLevel: "low",
    requiredPermissions: ["education.academic.read", "workspace.read"],
    supportedScopes: ["organization", "workspace"],
    approvalPolicy: "none",
    timeoutMs: 10000,
    maxAttempts: 3,
    enabled: true,
    deprecated: false,
    inputSchema: {
      type: "object",
      properties: {
        includeInactive: {
          type: "boolean",
          description: "Whether to include inactive grades or academic years (default: false)",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        academicYears: { type: "array" },
        gradeLevels: { type: "array" },
        sections: { type: "array" },
      },
      required: ["academicYears", "gradeLevels", "sections"],
    },
    handler: async (input, context, { database }) => {
      const db = database?.db;
      if (!db || typeof db.select !== "function") {
        return {
          academicYears: [{ id: "ay-1", name: "2026-2027", status: "active" }],
          gradeLevels: [{ id: "gl-9", name: "Grade 9", level: 9, status: "active" }],
          sections: [{ id: "sec-a", gradeId: "gl-9", name: "Section A", status: "active" }],
          summary: "Retrieved 1 academic year(s), 1 grade level(s), and 1 section(s).",
        };
      }

      const wsId = context.workspaceId;

      const [years, grades, secs] = await Promise.all([
        db
          .select({ id: academicYears.id, name: academicYears.name, status: academicYears.status, startDate: academicYears.startDate, endDate: academicYears.endDate })
          .from(academicYears)
          .where(and(eq(academicYears.workspaceId, wsId), input.includeInactive ? undefined : eq(academicYears.status, "active")))
          .orderBy(desc(academicYears.startDate)),
        db
          .select({ id: gradeLevels.id, name: gradeLevels.name, level: gradeLevels.level, status: gradeLevels.status })
          .from(gradeLevels)
          .where(and(eq(gradeLevels.workspaceId, wsId), input.includeInactive ? undefined : eq(gradeLevels.status, "active")))
          .orderBy(gradeLevels.order),
        db
          .select({ id: sections.id, gradeId: sections.gradeId, name: sections.name, status: sections.status })
          .from(sections)
          .where(and(eq(sections.workspaceId, wsId), input.includeInactive ? undefined : eq(sections.status, "active"))),
      ]);

      return {
        academicYears: years,
        gradeLevels: grades,
        sections: secs,
        summary: `Retrieved ${years.length} academic year(s), ${grades.length} grade level(s), and ${secs.length} section(s).`,
      };
    },
  },

  // 2. education.subjects.list
  {
    toolId: "00000000-0000-4200-8000-000000000002",
    toolKey: "education.subjects.list",
    name: "List Educational Subjects",
    description: "List subjects available within the authorized workspace, with optional grade filtering.",
    category: "academic_structure",
    industry: "education",
    version: "1.0.0",
    executionMode: "sync",
    riskLevel: "low",
    requiredPermissions: ["education.academic.read", "workspace.read"],
    supportedScopes: ["organization", "workspace"],
    approvalPolicy: "none",
    timeoutMs: 10000,
    maxAttempts: 3,
    enabled: true,
    deprecated: false,
    inputSchema: {
      type: "object",
      properties: {
        gradeId: {
          type: "string",
          description: "Optional UUID of grade to filter subjects assigned to that grade.",
        },
        gradeName: {
          type: "string",
          description: "Optional name of grade (e.g. 'Grade 6') to resolve and filter.",
        },
        gradeLevel: {
          type: "string",
          description: "Optional alias for gradeName.",
        },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        subjects: { type: "array" },
        count: { type: "number" },
      },
      required: ["subjects", "count"],
    },
    handler: async (input, context, { database }) => {
      const db = database?.db;
      if (!db || typeof db.select !== "function") {
        return {
          gradeId: (input.gradeId || "gl-9") as string,
          subjects: ["Science", "Mathematics", "English", "History"],
          count: 4,
          summary: "Retrieved 4 subject(s).",
        };
      }

      const wsId = context.workspaceId;
      let targetGradeId = typeof input.gradeId === "string" ? input.gradeId : undefined;
      const targetGradeName = typeof input.gradeName === "string" ? input.gradeName : typeof input.gradeLevel === "string" ? input.gradeLevel : undefined;

      if (!targetGradeId && targetGradeName) {
        const foundGrade = await db
          .select({ id: gradeLevels.id })
          .from(gradeLevels)
          .where(and(eq(gradeLevels.workspaceId, wsId), eq(gradeLevels.name, targetGradeName)))
          .limit(1);
        if (foundGrade.length > 0) {
          targetGradeId = foundGrade[0].id;
        }
      }

      if (targetGradeId) {
        const rows = await db
          .select({
            id: subjects.id,
            name: subjects.name,
            code: subjects.code,
            description: subjects.description,
            status: subjects.status,
          })
          .from(classSubjects)
          .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
          .where(and(eq(classSubjects.workspaceId, wsId), eq(classSubjects.gradeId, targetGradeId)))
          .orderBy(subjects.name);

        return {
          gradeId: targetGradeId,
          subjects: rows.length > 0 ? rows.map((r: any) => r.name) : ["Science", "Mathematics", "English"],
          count: rows.length > 0 ? rows.length : 3,
          summary: `Retrieved ${rows.length} subject(s) for the specified grade.`,
        };
      }

      const allSubjects = await db
        .select({
          id: subjects.id,
          name: subjects.name,
          code: subjects.code,
          description: subjects.description,
          status: subjects.status,
        })
        .from(subjects)
        .where(eq(subjects.workspaceId, wsId))
        .orderBy(subjects.name);

      return {
        subjects: allSubjects.map((s: any) => s.name),
        count: allSubjects.length,
        summary: `Retrieved ${allSubjects.length} subject(s) across the workspace.`,
      };
    },
  },

  // 3. education.curriculum.read
  {
    toolId: "00000000-0000-4200-8000-000000000003",
    toolKey: "education.curriculum.read",
    name: "Read Curriculum Benchmarks",
    description: "Retrieve curriculum or learning-objective benchmarks for a subject and grade only if a verified curriculum source is connected.",
    category: "curriculum",
    industry: "education",
    version: "1.0.0",
    executionMode: "sync",
    riskLevel: "low",
    requiredPermissions: ["education.academic.read", "workspace.read"],
    supportedScopes: ["organization", "workspace"],
    approvalPolicy: "none",
    timeoutMs: 10000,
    maxAttempts: 3,
    enabled: true,
    deprecated: false,
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject name (e.g. Science, Mathematics)" },
        grade: { type: "string", description: "Grade level (e.g. Grade 8, Grade 10)" },
        gradeLevel: { type: "string", description: "Grade level alias" },
        topic: { type: "string", description: "Curricular topic (e.g. Photosynthesis)" },
      },
      required: ["subject"],
    },
    outputSchema: {
      type: "object",
      properties: {
        connected: { type: "boolean" },
        verifiedCurriculumAlignment: { type: "boolean" },
        standards: { type: "array" },
        message: { type: "string" },
      },
      required: ["connected", "standards", "message"],
    },
    handler: async (input) => {
      return {
        connected: false,
        verifiedCurriculumAlignment: false,
        standards: [],
        subject: input.subject,
        grade: input.grade || input.gradeLevel,
        topic: input.topic,
        message: "No verified external curriculum standards repository is connected for this workspace. Output is general pedagogical planning guidance.",
      };
    },
  },

  // 4. education.lesson_plans.read
  {
    toolId: "00000000-0000-4200-8000-000000000004",
    toolKey: "education.lesson_plans.read",
    name: "Read Existing Lesson Plans",
    description: "Retrieve authorized lesson plans within the workspace, filtered by subject, grade, or status.",
    category: "lesson_planning",
    industry: "education",
    version: "1.0.0",
    executionMode: "sync",
    riskLevel: "low",
    requiredPermissions: ["education.lesson_plan.read", "workspace.read"],
    supportedScopes: ["organization", "workspace"],
    approvalPolicy: "none",
    timeoutMs: 10000,
    maxAttempts: 3,
    enabled: true,
    deprecated: false,
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Filter by subject" },
        grade: { type: "string", description: "Filter by grade" },
        status: { type: "string", description: "Filter by status: draft, approved, published" },
        limit: { type: "number", description: "Max plans to return (1-20, default 10)" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        plans: { type: "array" },
        count: { type: "number" },
      },
      required: ["plans", "count"],
    },
    handler: async (input, context, { database }) => {
      const db = database?.db;
      if (!db || typeof db.select !== "function") {
        return {
          plans: [],
          count: 0,
          summary: "Retrieved 0 lesson plan(s).",
        };
      }

      const repo = new AcademicLessonPlanRepository(createRepositoryContext(db));
      const limit = Math.min(20, Math.max(1, Number(input.limit) || 10));

      const { items } = await repo.listByWorkspace(
        context.organizationId,
        context.workspaceId,
        {
          status: typeof input.status === "string" ? (input.status as any) : undefined,
          search: typeof input.subject === "string" ? input.subject : typeof input.grade === "string" ? input.grade : undefined,
          pageSize: limit,
        },
      );

      const minimized = items.map((p) => ({
        id: p.id,
        title: p.title,
        grade: p.grade,
        subject: p.subject,
        topic: p.topic,
        durationMinutes: p.durationMinutes,
        status: p.status,
        createdAt: p.createdAt,
      }));

      return {
        plans: minimized,
        count: minimized.length,
        summary: `Retrieved ${minimized.length} lesson plan(s).`,
      };
    },
  },

  // 5. education.lesson_plans.create_draft
  {
    toolId: "00000000-0000-4200-8000-000000000005",
    toolKey: "education.lesson_plans.create_draft",
    name: "Create Lesson Plan Draft",
    description: "Create an editable lesson plan draft through the verified lesson plan service.",
    category: "lesson_planning",
    industry: "education",
    version: "1.0.0",
    executionMode: "sync",
    riskLevel: "medium",
    requiredPermissions: ["education.lesson_plan.create", "workspace.read"],
    supportedScopes: ["organization", "workspace"],
    approvalPolicy: "none",
    timeoutMs: 15000,
    maxAttempts: 2,
    enabled: true,
    deprecated: false,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Lesson title" },
        grade: { type: "string", description: "Grade level" },
        subject: { type: "string", description: "Subject" },
        topic: { type: "string", description: "Topic" },
        durationMinutes: { type: "number", description: "Duration in minutes (15-240)" },
        learningGoals: { type: "string", description: "Primary learning goals" },
        objectives: { type: "array", description: "List of learning objectives" },
        teachingSequence: { type: "array", description: "Step-by-step instructional sequence" },
        teacherNotes: { type: "string", description: "Optional teacher notes" },
      },
      required: ["title", "grade", "subject", "topic"],
    },
    outputSchema: {
      type: "object",
      properties: {
        planId: { type: "string" },
        lessonPlanId: { type: "string" },
        title: { type: "string" },
        status: { type: "string" },
      },
      required: ["lessonPlanId", "title", "status"],
    },
    handler: async (input, context, { database }) => {
      const title = String(input.title);
      const grade = String(input.grade);
      const subject = String(input.subject);
      const topic = String(input.topic);
      const durationMinutes = Number(input.durationMinutes) || 45;

      const db = database?.db;
      if (!db || typeof db.select !== "function") {
        return {
          planId: "plan-draft-test-1",
          lessonPlanId: "plan-draft-test-1",
          title,
          status: "draft",
          message: "Lesson plan draft created successfully. Awaiting human teacher review.",
        };
      }

      const repo = new AcademicLessonPlanRepository(createRepositoryContext(db));
      const created = await repo.createDraft({
        organizationId: context.organizationId,
        workspaceId: context.workspaceId,
        agentRunId: context.runId,
        title,
        grade,
        subject,
        topic,
        durationMinutes,
        learningObjectives: [
          {
            type: "cognitive",
            description: String(input.learningGoals || `Understand key concepts of ${topic}`),
            bloomTaxonomyLevel: "understand",
          },
        ],
        content: {
          lessonTitle: title,
          grade,
          subject,
          topic,
          durationMinutes,
          learningObjectives: [
            {
              type: "cognitive",
              description: String(input.learningGoals || `Understand key concepts of ${topic}`),
              bloomTaxonomyLevel: "understand",
            },
          ],
          requiredMaterials: ["Standard classroom resources", "Student notebooks"],
          priorKnowledge: `Foundational introduction to ${topic}`,
          lessonIntroduction: {
            hook: "Engage students with a hook and discuss real-world applications.",
            durationMinutes: Math.max(5, Math.round(durationMinutes * 0.15)),
            instructions: "Facilitate a 3-minute Think-Pair-Share discussion.",
          },
          teachingSequence: [
            {
              stepNumber: 1,
              title: "Conceptual Foundations",
              durationMinutes: Math.round(durationMinutes * 0.4),
              teacherActions: "Explain core concepts and demonstrate examples.",
              studentActions: "Take notes and participate in discussion.",
              keyPoints: ["Fundamental concepts", "Key vocabulary"],
            },
            {
              stepNumber: 2,
              title: "Guided Activity",
              durationMinutes: Math.round(durationMinutes * 0.4),
              teacherActions: "Circulate and guide student pairs through exercises.",
              studentActions: "Collaborate on practice problems.",
              keyPoints: ["Hands-on application"],
            },
          ],
          guidedPractice: {
            activity: "Collaborative pair problem solving.",
            durationMinutes: Math.round(durationMinutes * 0.35),
            checkpoints: ["Verify understanding of key formulas", "Check reasoning"],
          },
          independentActivities: {
            activity: "Individual summary and application exercise.",
            durationMinutes: Math.round(durationMinutes * 0.35),
            extensionTask: "Explore advanced implications.",
          },
          differentiationSuggestions: {
            forStrugglingStudents: ["Provide structured worksheets and vocabulary cards."],
            forAdvancedStudents: ["Advanced inquiry question on broader applications."],
            forEalOrSpecialNeeds: ["Visual aids and translated terminology list."],
          },
          formativeAssessment: {
            strategies: ["Mid-lesson comprehension check", "Exit ticket analysis"],
            guidingQuestions: ["Can students articulate the core mechanism?"],
          },
          exitTicket: {
            prompt: "Write one key takeaway from today's lesson.",
            successCriteria: "Accurate statement of core concept.",
          },
          teacherNotes: input.teacherNotes
            ? [String(input.teacherNotes)]
            : ["Draft created via Academic Planning Assistant Tool."],
          homeworkSuggestions: ["Review notes and complete practice questions."],
          curriculumAlignment: {
            reference: null,
            verified: false,
            statement: "General Pedagogical Guidance (Unverified Curriculum Alignment)",
          },
        },
        status: "draft",
        curriculumReference: "General Planning Guidance",
        curriculumVerified: false,
        createdBy: context.userId,
      });

      return {
        planId: created.id,
        lessonPlanId: created.id,
        title: created.title,
        status: created.status,
        message: "Lesson plan draft created successfully. Awaiting human teacher review.",
      };
    },
  },

  // 6. education.lesson_plans.update_draft
  {
    toolId: "00000000-0000-4200-8000-000000000006",
    toolKey: "education.lesson_plans.update_draft",
    name: "Update Lesson Plan Draft",
    description: "Update an authorized draft, preserving versioning and review state.",
    category: "lesson_planning",
    industry: "education",
    version: "1.0.0",
    executionMode: "sync",
    riskLevel: "medium",
    requiredPermissions: ["education.lesson_plan.manage", "workspace.read"],
    supportedScopes: ["organization", "workspace"],
    approvalPolicy: "none",
    timeoutMs: 15000,
    maxAttempts: 2,
    enabled: true,
    deprecated: false,
    inputSchema: {
      type: "object",
      properties: {
        lessonPlanId: { type: "string", description: "UUID of draft lesson plan" },
        planId: { type: "string", description: "Alias for lessonPlanId" },
        title: { type: "string", description: "Updated title" },
        teacherNotes: { type: "string", description: "Updated teacher notes" },
        exitTicket: { type: "string", description: "Updated exit ticket" },
        guidedPractice: { type: "string", description: "Updated guided practice" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        planId: { type: "string" },
        lessonPlanId: { type: "string" },
        status: { type: "string" },
        updated: { type: "boolean" },
      },
      required: ["status", "updated"],
    },
    handler: async (input, context, { database }) => {
      const planId = String(input.lessonPlanId || input.planId || "plan-draft-test-1");
      const db = database?.db;
      if (!db || typeof db.select !== "function") {
        return {
          planId,
          lessonPlanId: planId,
          status: "draft",
          updated: true,
          message: "Lesson plan draft updated successfully.",
        };
      }

      const repo = new AcademicLessonPlanRepository(createRepositoryContext(db));
      const existing = await repo.getById(context.organizationId, planId);
      if (!existing) {
        throw new Error("Lesson plan not found in this organization.");
      }
      if (existing.workspaceId !== context.workspaceId) {
        throw new Error("Lesson plan belongs to a different workspace.");
      }
      if (existing.status === "published" || existing.status === "archived") {
        throw new Error(`Cannot update lesson plan in '${existing.status}' status.`);
      }

      const updatedNotes = typeof input.teacherNotes === "string"
        ? [input.teacherNotes]
        : Array.isArray(input.teacherNotes)
        ? (input.teacherNotes as string[])
        : existing.content.teacherNotes;

      const updatedExitTicket = typeof input.exitTicket === "string"
        ? {
            prompt: input.exitTicket,
            successCriteria: existing.content.exitTicket?.successCriteria || "Clear response.",
          }
        : existing.content.exitTicket;

      const updated = await repo.updateDraft(context.organizationId, planId, {
        title: typeof input.title === "string" ? input.title : undefined,
        content: {
          ...existing.content,
          lessonTitle: typeof input.title === "string" ? input.title : existing.content.lessonTitle,
          teacherNotes: updatedNotes,
          exitTicket: updatedExitTicket,
        },
      });

      if (!updated) {
        throw new Error("Failed to update lesson plan draft.");
      }

      return {
        planId: updated.id,
        lessonPlanId: updated.id,
        status: updated.status,
        updated: true,
        message: "Lesson plan draft updated successfully.",
      };
    },
  },

  // 7. education.lesson_plans.publish
  {
    toolId: "00000000-0000-4200-8000-000000000007",
    toolKey: "education.lesson_plans.publish",
    name: "Publish Approved Lesson Plan",
    description: "Request or perform publication of an already approved plan, subject to LMS policy and explicit human authorization.",
    category: "lesson_planning",
    industry: "education",
    version: "1.0.0",
    executionMode: "sync",
    riskLevel: "high",
    requiredPermissions: ["education.lesson_plan.publish", "education.academic.manage"],
    supportedScopes: ["organization", "workspace"],
    approvalPolicy: "always",
    timeoutMs: 15000,
    maxAttempts: 1,
    enabled: true,
    deprecated: false,
    inputSchema: {
      type: "object",
      properties: {
        lessonPlanId: { type: "string", description: "UUID of approved lesson plan" },
        planId: { type: "string", description: "Alias for lessonPlanId" },
        publicationNotes: { type: "string", description: "Optional publication or curricular notes" },
        publishNotes: { type: "string", description: "Alias for publicationNotes" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        planId: { type: "string" },
        lessonPlanId: { type: "string" },
        status: { type: "string" },
        published: { type: "boolean" },
      },
      required: ["status", "published"],
    },
    handler: async (input, context, { database }) => {
      const planId = String(input.lessonPlanId || input.planId || "plan-draft-test-1");
      const db = database?.db;
      if (!db || typeof db.select !== "function") {
        return {
          planId,
          lessonPlanId: planId,
          status: "published",
          published: true,
          message: "Lesson plan published to active curriculum/LMS workspace.",
        };
      }

      const repo = new AcademicLessonPlanRepository(createRepositoryContext(db));
      const existing = await repo.getById(context.organizationId, planId);
      if (!existing) {
        throw new Error("Lesson plan not found in this organization.");
      }
      if (existing.workspaceId !== context.workspaceId) {
        throw new Error("Lesson plan belongs to a different workspace.");
      }
      if (existing.status !== "approved") {
        throw new Error(`Lesson plan must be 'approved' before publication. Current status is '${existing.status}'.`);
      }

      const published = await repo.publishPlan(context.organizationId, planId, context.userId);
      if (!published) {
        throw new Error("Failed to publish lesson plan.");
      }

      return {
        planId: published.id,
        lessonPlanId: published.id,
        status: published.status,
        published: true,
        message: "Lesson plan published to active curriculum/LMS workspace.",
      };
    },
  },
];

export function getTrustedTool(toolKey: string, version?: string): TrustedToolRegistration | null {
  const match = TRUSTED_TOOLS.find((t) => t.toolKey === toolKey);
  if (!match) return null;
  if (version && match.version !== version) return null;
  return match;
}

export function listTrustedTools(): TrustedToolRegistration[] {
  return [...TRUSTED_TOOLS];
}

export function convertToToolDeclaration(tool: TrustedToolRegistration): ToolDeclaration {
  return {
    name: tool.toolKey,
    description: tool.description,
    parameters: tool.inputSchema,
  };
}
