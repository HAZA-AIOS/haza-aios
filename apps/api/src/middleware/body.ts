import type { IncomingMessage } from "node:http";
import { ApiError } from "../common/errors/api-error.js";

export async function readJsonBody<TBody>(request: IncomingMessage, limitBytes: number): Promise<TBody | undefined> {
  const method = request.method ?? "GET";

  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return undefined;
  }

  let size = 0;
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > limitBytes) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as TBody;
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Request body must be valid JSON");
  }
}
