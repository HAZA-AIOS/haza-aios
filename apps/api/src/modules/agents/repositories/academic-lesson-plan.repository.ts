import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { academicLessonPlans } from "../../../database/schema.js";
import type { RepositoryContext } from "../../../database/repositories/repository-context.js";
import type {
  AcademicLessonPlanRecord,
  AcademicObjective,
  CreateLessonPlanDraftInput,
  LessonPlanOutput,
  LessonPlanStatus,
  UpdateLessonPlanDraftInput,
} from "../academic-planning.types.js";

export class AcademicLessonPlanRepository {
  constructor(private readonly context: RepositoryContext) {}

  async createDraft(input: CreateLessonPlanDraftInput): Promise<AcademicLessonPlanRecord> {
    const id = randomUUID();
    const now = new Date();

    await this.context.db.insert(academicLessonPlans).values({
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      agentRunId: input.agentRunId ?? null,
      title: input.title,
      grade: input.grade,
      subject: input.subject,
      topic: input.topic,
      durationMinutes: input.durationMinutes,
      learningObjectives: input.learningObjectives,
      content: input.content as unknown as Record<string, unknown>,
      status: input.status ?? "draft",
      curriculumReference: input.curriculumReference ?? null,
      curriculumVerified: input.curriculumVerified ?? false,
      createdBy: input.createdBy,
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const created = await this.getById(input.organizationId, id);
    if (!created) {
      throw new Error("Failed to retrieve created lesson plan draft.");
    }
    return created;
  }

  async getById(organizationId: string, id: string): Promise<AcademicLessonPlanRecord | null> {
    const rows = await this.context.db
      .select()
      .from(academicLessonPlans)
      .where(and(eq(academicLessonPlans.organizationId, organizationId), eq(academicLessonPlans.id, id)))
      .limit(1);

    return rows[0] ? normalizeLessonPlan(rows[0]) : null;
  }

  async getByRunId(organizationId: string, agentRunId: string): Promise<AcademicLessonPlanRecord | null> {
    const rows = await this.context.db
      .select()
      .from(academicLessonPlans)
      .where(
        and(
          eq(academicLessonPlans.organizationId, organizationId),
          eq(academicLessonPlans.agentRunId, agentRunId),
        ),
      )
      .limit(1);

    return rows[0] ? normalizeLessonPlan(rows[0]) : null;
  }

  async listByWorkspace(
    organizationId: string,
    workspaceId: string,
    filter?: {
      status?: LessonPlanStatus;
      createdBy?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ): Promise<{
    items: AcademicLessonPlanRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, filter?.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, filter?.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [
      eq(academicLessonPlans.organizationId, organizationId),
      eq(academicLessonPlans.workspaceId, workspaceId),
    ];

    if (filter?.status) {
      conditions.push(eq(academicLessonPlans.status, filter.status));
    }
    if (filter?.createdBy) {
      conditions.push(eq(academicLessonPlans.createdBy, filter.createdBy));
    }
    if (filter?.search) {
      const pattern = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          like(academicLessonPlans.title, pattern),
          like(academicLessonPlans.topic, pattern),
          like(academicLessonPlans.subject, pattern),
          like(academicLessonPlans.grade, pattern),
        )!,
      );
    }

    const [rows, totalRes] = await Promise.all([
      this.context.db
        .select()
        .from(academicLessonPlans)
        .where(and(...conditions))
        .orderBy(desc(academicLessonPlans.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.context.db
        .select({ count: sql<number>`count(*)` })
        .from(academicLessonPlans)
        .where(and(...conditions)),
    ]);

    const total = Number(totalRes[0]?.count ?? 0);
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      items: rows.map(normalizeLessonPlan),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async updateDraft(
    organizationId: string,
    id: string,
    input: UpdateLessonPlanDraftInput,
  ): Promise<AcademicLessonPlanRecord | null> {
    const existing = await this.getById(organizationId, id);
    if (!existing) return null;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updates.title = input.title;
    if (input.grade !== undefined) updates.grade = input.grade;
    if (input.subject !== undefined) updates.subject = input.subject;
    if (input.topic !== undefined) updates.topic = input.topic;
    if (input.durationMinutes !== undefined) updates.durationMinutes = input.durationMinutes;
    const currentContent = { ...(existing.content || {}) } as any;
    let contentChanged = false;

    if (input.content !== undefined) {
      Object.assign(currentContent, input.content);
      contentChanged = true;
    }

    const anyInput = input as Record<string, unknown>;
    if (anyInput.teacherNotes !== undefined) {
      currentContent.teacherNotes = Array.isArray(anyInput.teacherNotes)
        ? anyInput.teacherNotes.map(String)
        : [String(anyInput.teacherNotes)];
      contentChanged = true;
    }

    if (input.title !== undefined) {
      currentContent.lessonTitle = input.title;
      contentChanged = true;
    }

    if (contentChanged) {
      updates.content = currentContent;
    }

    if (input.learningObjectives !== undefined) updates.learningObjectives = input.learningObjectives;
    if (input.status !== undefined) updates.status = input.status;
    if (input.curriculumReference !== undefined) updates.curriculumReference = input.curriculumReference;
    if (input.curriculumVerified !== undefined) updates.curriculumVerified = input.curriculumVerified;

    await this.context.db
      .update(academicLessonPlans)
      .set(updates)
      .where(and(eq(academicLessonPlans.organizationId, organizationId), eq(academicLessonPlans.id, id)));

    return this.getById(organizationId, id);
  }

  async approvePlan(
    organizationId: string,
    id: string,
    approvedBy: string,
    notes?: string,
  ): Promise<AcademicLessonPlanRecord | null> {
    const existing = await this.getById(organizationId, id);
    if (!existing) return null;

    const now = new Date();
    const currentContent = { ...(existing.content || {}) } as any;
    if (notes) currentContent.approvalNotes = notes;

    await this.context.db
      .update(academicLessonPlans)
      .set({
        status: "approved",
        approvedBy,
        approvedAt: now,
        content: currentContent,
        updatedAt: now,
      })
      .where(and(eq(academicLessonPlans.organizationId, organizationId), eq(academicLessonPlans.id, id)));

    return this.getById(organizationId, id);
  }

  async publishPlan(
    organizationId: string,
    id: string,
    publishedBy: string,
    target?: { courseId?: string; termId?: string; publishTarget?: string },
  ): Promise<AcademicLessonPlanRecord | null> {
    const existing = await this.getById(organizationId, id);
    if (!existing) return null;

    const now = new Date();
    const currentContent = { ...(existing.content || {}) } as any;
    currentContent.publishedToLmsAt = now.toISOString();
    if (target?.courseId) currentContent.lmsCourseId = target.courseId;
    if (target?.termId) currentContent.lmsTermId = target.termId;

    await this.context.db
      .update(academicLessonPlans)
      .set({
        status: "published",
        approvedBy: existing.approvedBy ?? publishedBy,
        approvedAt: existing.approvedAt ?? now,
        content: currentContent,
        updatedAt: now,
      })
      .where(and(eq(academicLessonPlans.organizationId, organizationId), eq(academicLessonPlans.id, id)));

    return this.getById(organizationId, id);
  }

  async deletePlan(organizationId: string, id: string): Promise<boolean> {
    await this.context.db
      .delete(academicLessonPlans)
      .where(and(eq(academicLessonPlans.organizationId, organizationId), eq(academicLessonPlans.id, id)));

    return true;
  }
}

function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  if (val && typeof val === "object") {
    return val as T;
  }
  return fallback;
}

function normalizeLessonPlan(row: any): AcademicLessonPlanRecord {
  const content = safeJsonParse<LessonPlanOutput>(row.content, {} as LessonPlanOutput);
  const learningObjectives = safeJsonParse<AcademicObjective[]>(
    row.learningObjectives,
    content.learningObjectives ?? [],
  );

  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: row.workspaceId,
    agentRunId: row.agentRunId ?? null,
    title: row.title,
    grade: row.grade,
    subject: row.subject,
    topic: row.topic,
    durationMinutes: Number(row.durationMinutes),
    learningObjectives: Array.isArray(learningObjectives) ? learningObjectives : (content.learningObjectives ?? []),
    content,
    status: row.status as LessonPlanStatus,
    curriculumReference: row.curriculumReference ?? null,
    curriculumVerified: Boolean(row.curriculumVerified),
    createdBy: row.createdBy,
    approvedBy: row.approvedBy ?? null,
    approvedAt: row.approvedAt ? new Date(row.approvedAt) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
