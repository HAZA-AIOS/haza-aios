import { ApiError } from "../../common/errors/api-error.js";

export function validateKnowledge(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail();
  const data = body as Record<string, unknown>;
  const name = readText(data.name, 200);
  const content = readText(data.content, 12_000);
  const description = data.description === undefined ? "" : readText(data.description, 2000, true);
  const type = data.type ?? "text";
  const visibility = data.visibility ?? "internal";
  if (type !== "text" && type !== "document" && type !== "structured") fail();
  if (visibility !== "internal" && visibility !== "private") fail();
  return { name, content, description, type, visibility } as {
    name: string;
    content: string;
    description: string;
    type: "text" | "document" | "structured";
    visibility: "internal" | "private";
  };
}

export function readText(value: unknown, max: number, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    (!allowEmpty && !value.trim()) ||
    value.length > max ||
    value.includes("\0")
  )
    fail();
  return (value as string).trim();
}

export function chunkKnowledge(content: string): string[] {
  const chars = Array.from(content);
  const chunks: string[] = [];
  for (let offset = 0; offset < chars.length; offset += 1800) {
    chunks.push(chars.slice(offset, offset + 2000).join(""));
  }
  return chunks;
}

export function scoreKnowledge(query: string, title: string, content: string): number {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])];
  if (!terms.length) return 0;
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  return (
    terms.reduce(
      (score, term) =>
        score + (lowerTitle.includes(term) ? 2 : 0) + (lowerContent.includes(term) ? 1 : 0),
      0,
    ) /
    (terms.length * 3)
  );
}

function fail(): never {
  throw new ApiError(400, "VALIDATION_FAILED", "Invalid knowledge input.");
}
