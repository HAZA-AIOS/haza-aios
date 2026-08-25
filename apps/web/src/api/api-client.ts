import { appConfig } from "@/app/config";

type ApiClientOptions = {
  baseUrl?: string;
  onUnauthorized?: () => void;
};

type RequestOptions = RequestInit & {
  authToken?: string | null;
};

class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

class ApiClient {
  private readonly baseUrl: string;
  private readonly onUnauthorized?: () => void;

  constructor({ baseUrl = appConfig.apiBaseUrl, onUnauthorized }: ApiClientOptions = {}) {
    this.baseUrl = baseUrl?.replace(/\/$/, "") ?? "";
    this.onUnauthorized = onUnauthorized;
  }

  async request<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (options.authToken) {
      headers.set("Authorization", `Bearer ${options.authToken}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: "include",
      headers,
    });

    if (response.status === 401) {
      this.onUnauthorized?.();
    }

    if (!response.ok) {
      const details = await readBody(response);
      throw new ApiError((readErrorMessage(details) ?? response.statusText) || "Request failed", response.status, details);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  }
}

async function readBody(response: Response) {
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

const apiClient = new ApiClient();

export { ApiClient, ApiError, apiClient };
export type { RequestOptions };

function readErrorMessage(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const error = (details as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : null;
}
