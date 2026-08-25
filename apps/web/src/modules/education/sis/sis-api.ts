import { apiClient } from "@/api/api-client";
import { readStoredAuth } from "@/auth/auth-storage";

export async function sisRequest<T>(organizationId: string, path: string, options: RequestInit = {}): Promise<T> {
  const auth = readStoredAuth();
  return apiClient.request<T>(`/api/v1/organizations/${organizationId}/sis${path}`, {
    ...options,
    authToken: auth?.session.accessToken,
  });
}

export function jsonBody(value: unknown): RequestInit {
  return { body: JSON.stringify(value) };
}
