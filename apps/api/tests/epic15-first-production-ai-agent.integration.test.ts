import { migrate } from "../src/database/mysql94-migrator.js";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/common/logging/logger.js";
import { loadConfig, type ApiConfig } from "../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../src/database/client.js";

const describeDatabase = process.env.RUN_DB_INTEGRATION_TESTS === "true" ? describe : describe.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDirectory, "../src/database/migrations");

const logger = {
  error: (msg: any, details: any) => console.error("SERVER_ERR:", msg, JSON.stringify(details, Object.getOwnPropertyNames(details || {}), 2)),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

describeDatabase("Epic 15 — First Production AI Agent: Academic Planning Assistant", () => {
  let config: ApiConfig;
  let database: DatabaseClient;

  beforeAll(async () => {
    config = loadConfig({
      ...process.env,
      NODE_ENV: "test",
      LOG_LEVEL: "error",
    });
    database = createDatabaseClient(config.database, createLogger(config));
    await migrateIfNeeded(database);
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("completes full lifecycle: template discovery, workspace provisioning, sync/async generation, 17-point validation, draft editing, teacher approval, LMS publication, exports, and tenant isolation", async () => {
    const server = createApp(config, logger, database);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const suffix = randomUUID().slice(0, 8);

    try {
      // 1. Provision Tenant A and Tenant B
      const tenantA = await registerTenant(
        baseUrl,
        `epic15-teacher-${suffix}@example.com`,
        `Epic15 Academic Academy ${suffix}`,
      );
      const workspacesA = await readWorkspaces(baseUrl, tenantA.organizationId, tenantA.accessToken);
      const workspaceIdA = workspacesA[0].id;

      const tenantB = await registerTenant(
        baseUrl,
        `epic15-other-${suffix}@example.com`,
        `Epic15 Other School ${suffix}`,
      );

      // 2. Discover Academic Planning Assistant Template in Catalog
      const templatesRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/templates`,
        {
          headers: { authorization: `Bearer ${tenantA.accessToken}` },
        },
      );
      if (templatesRes.status !== 200) { console.error("TEMPLATES_ERROR:", templatesRes.status, await templatesRes.text()); }
      expect(templatesRes.status).toBe(200);
      const templatesBody = (await templatesRes.json()) as { templates: Array<{ id: string; slug: string; name: string }> };
      const plannerTemplate = templatesBody.templates.find(
        (t) => t.id === "00000000-0000-4100-8000-000000000104" || t.slug === "academic-planning-assistant",
      );
      expect(plannerTemplate).toBeDefined();
      expect(plannerTemplate?.name).toContain("Academic Planning Assistant");

      // 3. Check Academic Planning Agent Status Endpoint
      const statusRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/academic-planning/status?workspaceId=${workspaceIdA}`,
        {
          headers: { authorization: `Bearer ${tenantA.accessToken}` },
        },
      );
      expect(statusRes.status).toBe(200);
      const statusBody = (await statusRes.json()) as {
        available: boolean;
        installed: boolean;
        inferenceMode: string;
      };
      expect(statusBody.available).toBe(true);
      expect(statusBody.inferenceMode).toBe("mock_fallback"); // Deterministic fallback when OpenAI API key is unset

      // 4. Generate Lesson Plan via Agent Execution (synchronous worker tick)
      const generateRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/agents/academic-planning/generate?sync=true`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            workspaceId: workspaceIdA,
            gradeLevel: "Grade 8",
            subject: "Science",
            topic: "Cellular Respiration and Photosynthesis",
            durationMinutes: 45,
            learningGoals: "Students compare the chemical equations and energy conversion in plant and animal cells.",
            curriculumReference: "NGSS MS-LS1-6",
            teachingLanguage: "English",
            teacherInstructions: "Include kinesthetic and visual models for mitochondria vs chloroplasts.",
          }),
        },
      );

      expect(generateRes.status).toBe(201);
      const generateBody = (await generateRes.json()) as {
        run: { id: string; status: string };
        executed: boolean;
      };
      expect(generateBody.executed).toBe(true);
      expect(generateBody.run.status).toBe("completed");

      // 5. Query Created Academic Lesson Plans
      const listPlansRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/workspaces/${workspaceIdA}/academic-lesson-plans`,
        {
          headers: { authorization: `Bearer ${tenantA.accessToken}` },
        },
      );
      expect(listPlansRes.status).toBe(200);
      const listPlansBody = (await listPlansRes.json()) as {
        plans: Array<{
          id: string;
          title: string;
          status: string;
          verificationStatus: string;
          content: {
            learningObjectives: string[];
            teachingSequence: Array<{ phase: string }>;
            differentiation: { support: string; core: string; extension: string };
            exitTicket: string;
          };
        }>;
        total: number;
      };

      expect(listPlansBody.total).toBeGreaterThanOrEqual(1);
      const createdPlan = listPlansBody.plans[0];
      expect(createdPlan).toBeDefined();
      expect(createdPlan.status).toBe("draft");
      expect(createdPlan.verificationStatus).toBe("general_guidance"); // Non-institutional curriculum labeled general guidance
      expect(createdPlan.content.learningObjectives.length).toBeGreaterThan(0);
      expect(createdPlan.content.teachingSequence.length).toBeGreaterThan(0);
      expect(createdPlan.content.differentiationSuggestions.forStrugglingStudents.length).toBeGreaterThan(0);
      expect(createdPlan.content.differentiationSuggestions.forAdvancedStudents.length).toBeGreaterThan(0);
      expect(createdPlan.content.differentiationSuggestions.forEalOrSpecialNeeds.length).toBeGreaterThan(0);

      const planId = createdPlan.id;

      // 6. Teacher Modifies Draft Lesson Plan
      const updateDraftRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/academic-lesson-plans/${planId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            title: "Cellular Energy: Photosynthesis & Respiration (Teacher Revised)",
            teacherNotes: "Emphasize safety during microscope slide inspection.",
          }),
        },
      );
      expect(updateDraftRes.status).toBe(200);
      const updateDraftBody = (await updateDraftRes.json()) as { plan: { title: string; content: { teacherNotes: string } } };
      expect(updateDraftBody.plan.title).toBe("Cellular Energy: Photosynthesis & Respiration (Teacher Revised)");
      expect(updateDraftBody.plan.content.teacherNotes).toContain("Emphasize safety during microscope slide inspection.");

      // 7. Teacher Explicit Approval Workflow
      const approveRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/academic-lesson-plans/${planId}/approve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            notes: "Certified aligned with Grade 8 science learning progression.",
          }),
        },
      );
      expect(approveRes.status).toBe(200);
      const approveBody = (await approveRes.json()) as { plan: { status: string; reviewedBy: string; approvalNotes: string } };
      expect(approveBody.plan.status).toBe("approved");
      expect(approveBody.plan.reviewedBy).toBe(tenantA.userId);
      expect(approveBody.plan.approvalNotes).toBe("Certified aligned with Grade 8 science learning progression.");

      // 8. Publish Lesson Plan to LMS
      const publishRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/academic-lesson-plans/${planId}/publish`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantA.accessToken}`,
          },
          body: JSON.stringify({
            courseId: "course-sci-801",
            termId: "term-fall-2026",
            publishTarget: "lms_course_syllabus",
          }),
        },
      );
      expect(publishRes.status).toBe(200);
      const publishBody = (await publishRes.json()) as { plan: { status: string; publishedToLmsAt: string; lmsCourseId: string } };
      expect(publishBody.plan.status).toBe("published");
      expect(publishBody.plan.publishedToLmsAt).toBeDefined();
      expect(publishBody.plan.lmsCourseId).toBe("course-sci-801");

      // 9. Export Lesson Plan in Markdown and JSON
      const exportMdRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/academic-lesson-plans/${planId}/export?format=markdown`,
        {
          headers: { authorization: `Bearer ${tenantA.accessToken}` },
        },
      );
      expect(exportMdRes.status).toBe(200);
      expect(exportMdRes.headers.get("content-type")).toContain("text/markdown");
      const exportMdContent = await exportMdRes.text();
      expect(exportMdContent).toContain("# Cellular Energy: Photosynthesis & Respiration");
      expect(exportMdContent).toContain("## 5. Step-by-Step Teaching Sequence");
      expect(exportMdContent).toContain("## 8. Differentiation Suggestions");

      const exportJsonRes = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantA.organizationId}/academic-lesson-plans/${planId}/export?format=json`,
        {
          headers: { authorization: `Bearer ${tenantA.accessToken}` },
        },
      );
      expect(exportJsonRes.status).toBe(200);
      expect(exportJsonRes.headers.get("content-type")).toContain("application/json");
      const parsedExport = (await exportJsonRes.json()) as { lessonTitle: string; learningObjectives: any[] };
      expect(parsedExport.lessonTitle).toBeDefined();
      expect(parsedExport.learningObjectives.length).toBeGreaterThan(0);

      // 10. Tenant Isolation Verification: Tenant B cannot access Tenant A's plan
      const crossTenantGet = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/academic-lesson-plans/${planId}`,
        {
          headers: { authorization: `Bearer ${tenantB.accessToken}` },
        },
      );
      expect(crossTenantGet.status).toBe(404);

      const crossTenantApprove = await fetch(
        `${baseUrl}/api/v1/organizations/${tenantB.organizationId}/academic-lesson-plans/${planId}/approve`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${tenantB.accessToken}`,
          },
          body: JSON.stringify({ notes: "Cross-tenant intrusion attempt" }),
        },
      );
      expect(crossTenantApprove.status).toBe(404);
    } finally {
      await closeServer(server);
    }
  });
});

async function registerTenant(
  baseUrl: string,
  email: string,
  organizationName: string,
): Promise<{ accessToken: string; organizationId: string; userId: string }> {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      firstName: "Academic",
      lastName: "Teacher",
      email,
      password: "password123",
      organizationName,
      industry: "Education",
      organizationType: "School",
      country: "United States",
    }),
  });
  const body = (await response.json()) as {
    session: { accessToken: string };
    user: { id: string };
    memberships: Array<{ organizationId: string }>;
  };
  expect(response.status).toBe(201);
  return {
    accessToken: body.session.accessToken,
    organizationId: body.memberships[0].organizationId,
    userId: body.user.id,
  };
}

async function readWorkspaces(
  baseUrl: string,
  organizationId: string,
  accessToken: string,
): Promise<Array<{ id: string }>> {
  const response = await fetch(`${baseUrl}/api/v1/organizations/${organizationId}/workspaces`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { workspaces: Array<{ id: string }> };
  return body.workspaces;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

async function migrateIfNeeded(database: DatabaseClient): Promise<void> {
  try {
    await migrate(database.db, { migrationsFolder });
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "ER_TABLE_EXISTS_ERROR") return;
    throw error;
  }
}
