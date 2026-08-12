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
      headers,
    });

    if (response.status === 401) {
      this.onUnauthorized?.();
    }

    if (!response.ok) {
      throw new ApiError(
        response.statusText || "Request failed",
        response.status,
        await readBody(response),
      );
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
