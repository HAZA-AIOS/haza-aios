import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const requestIdHeader = "x-request-id";

export type RequestContext = {
  requestId: string;
  startedAt: number;
};

export function createRequestContext(request: IncomingMessage, response: ServerResponse): RequestContext {
  const incoming = request.headers[requestIdHeader];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const requestId = isSafeRequestId(candidate) ? candidate : randomUUID();

  response.setHeader(requestIdHeader, requestId);

  return {
    requestId,
    startedAt: Date.now(),
  };
}

function isSafeRequestId(value: string | undefined): value is string {
  return Boolean(value && /^[a-zA-Z0-9._:-]{8,128}$/.test(value));
}
