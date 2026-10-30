import { apiClient } from "@/api/api-client";
import { readStoredAuth } from "@/auth/auth-storage";
import type {
  LessonPlanContent,
  LessonPlanStatus,
  AcademicPlanningFormData,
} from "@haza-aios/ui";

export interface AcademicAssistantStatus {
  available: boolean;
  template: Record<string, unknown>;
  installed: boolean;
  agent: Record<string, unknown> | null;
  inferenceMode: "live" | "mock_fallback";
  liveProviderConfigured: boolean;
}

export interface AcademicLessonPlanItem {
  id: string;
  organizationId: string;
  workspaceId: string;
  agentRunId?: string | null;
  conversationId?: string | null;
  title: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  curriculumStandard?: string | null;
  verificationStatus: "institutional_verified" | "general_guidance";
  content: LessonPlanContent;
  status: LessonPlanStatus;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  approvalNotes?: string | null;
  publishedToLmsAt?: string | null;
  lmsCourseId?: string | null;
  lmsTermId?: string | null;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonPlanListResponse {
  plans: AcademicLessonPlanItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AgentRunResponse {
  run: {
    id: string;
    organizationId: string;
    workspaceId: string;
    agentId: string;
    status: string;
    output?: Record<string, unknown> | null;
    errorMessage?: string | null;
    safeErrorMessage?: string | null;
  };
  status?: string;
  message?: string;
}

class AcademicPlanningServiceClass {
  private getAuthToken(): string | undefined {
    return readStoredAuth()?.session.accessToken;
  }

  async getDefaultWorkspaceId(organizationId: string): Promise<string> {
    const auth = readStoredAuth();
    const response = await apiClient.request<{ workspaces: Array<{ id: string }> }>(
      `/api/v1/organizations/${organizationId}/workspaces`,
      {
        authToken: auth?.session.accessToken,
      },
    );
    const workspaceId = response.workspaces[0]?.id;
    if (!workspaceId) throw new Error("No active workspace found for this organization.");
    return workspaceId;
  }

  async getStatus(organizationId: string, workspaceId?: string): Promise<AcademicAssistantStatus> {
    const q = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return apiClient.request<AcademicAssistantStatus>(
      `/api/v1/organizations/${organizationId}/agents/academic-planning/status${q}`,
      { authToken: this.getAuthToken() },
    );
  }

  async generateLessonPlan(
    organizationId: string,
    workspaceId: string,
    data: AcademicPlanningFormData,
    sync: boolean = false,
  ): Promise<AgentRunResponse> {
    const q = sync ? "?sync=true" : "";
    return apiClient.request<AgentRunResponse>(
      `/api/v1/organizations/${organizationId}/agents/academic-planning/generate${q}`,
      {
        method: "POST",
        body: JSON.stringify({
          workspaceId,
          ...data,
        }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async pollRun(organizationId: string, runId: string): Promise<AgentRunResponse> {
    return apiClient.request<AgentRunResponse>(
      `/api/v1/organizations/${organizationId}/agents/runs/${runId}`,
      { authToken: this.getAuthToken() },
    );
  }

  async listLessonPlans(
    organizationId: string,
    workspaceId: string,
    params: {
      status?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      createdBy?: string;
    } = {},
  ): Promise<LessonPlanListResponse> {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.search) q.set("search", params.search);
    if (params.page) q.set("page", String(params.page));
    if (params.pageSize) q.set("pageSize", String(params.pageSize));
    if (params.createdBy) q.set("createdBy", params.createdBy);

    const queryStr = q.toString() ? `?${q.toString()}` : "";
    return apiClient.request<LessonPlanListResponse>(
      `/api/v1/organizations/${organizationId}/workspaces/${workspaceId}/academic-lesson-plans${queryStr}`,
      { authToken: this.getAuthToken() },
    );
  }

  async getLessonPlan(organizationId: string, planId: string): Promise<{ plan: AcademicLessonPlanItem }> {
    return apiClient.request<{ plan: AcademicLessonPlanItem }>(
      `/api/v1/organizations/${organizationId}/academic-lesson-plans/${planId}`,
      { authToken: this.getAuthToken() },
    );
  }

  async updateLessonPlanDraft(
    organizationId: string,
    planId: string,
    updates: Partial<LessonPlanContent>,
  ): Promise<{ plan: AcademicLessonPlanItem }> {
    return apiClient.request<{ plan: AcademicLessonPlanItem }>(
      `/api/v1/organizations/${organizationId}/academic-lesson-plans/${planId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
        authToken: this.getAuthToken(),
      },
    );
  }

  async approveLessonPlan(
    organizationId: string,
    planId: string,
    notes?: string,
  ): Promise<{ plan: AcademicLessonPlanItem }> {
    return apiClient.request<{ plan: AcademicLessonPlanItem }>(
      `/api/v1/organizations/${organizationId}/academic-lesson-plans/${planId}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ notes }),
        authToken: this.getAuthToken(),
      },
    );
  }

  async publishLessonPlan(
    organizationId: string,
    planId: string,
    target?: { courseId?: string; termId?: string; publishTarget?: string },
  ): Promise<{ plan: AcademicLessonPlanItem }> {
    return apiClient.request<{ plan: AcademicLessonPlanItem }>(
      `/api/v1/organizations/${organizationId}/academic-lesson-plans/${planId}/publish`,
      {
        method: "POST",
        body: JSON.stringify(target || {}),
        authToken: this.getAuthToken(),
      },
    );
  }

  async exportLessonPlan(
    organizationId: string,
    planId: string,
    format: "markdown" | "json",
  ): Promise<{ format: string; content: string; mimeType: string; filename: string }> {
    const auth = this.getAuthToken();
    const res = await fetch(
      `/api/v1/organizations/${organizationId}/academic-lesson-plans/${planId}/export?format=${format}`,
      {
        headers: auth ? { Authorization: `Bearer ${auth}` } : {},
      },
    );
    const content = await res.text();
    const mimeType = res.headers.get("content-type") || (format === "json" ? "application/json" : "text/markdown");
    const disposition = res.headers.get("content-disposition") || "";
    const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch ? filenameMatch[1] : `lesson_plan_${planId}.${format === "json" ? "json" : "md"}`;

    return {
      format,
      content,
      mimeType,
      filename,
    };
  }

  async deleteLessonPlan(organizationId: string, planId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.request<{ success: boolean; message: string }>(
      `/api/v1/organizations/${organizationId}/academic-lesson-plans/${planId}`,
      {
        method: "DELETE",
        authToken: this.getAuthToken(),
      },
    );
  }
}

export const AcademicPlanningService = new AcademicPlanningServiceClass();
