import type { ServerResponse } from "node:http";

export function sendJson(response: ServerResponse, statusCode: number, body: unknown, headers: Record<string, string> = {}) {
  const payload = JSON.stringify(body);

  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload).toString(),
    ...headers,
  });
  response.end(payload);
}
