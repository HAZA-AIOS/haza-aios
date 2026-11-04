import { randomBytes } from "node:crypto";
import type { AgentObservabilityRepository } from "../repositories/agent-observability.repository.js";
import type {
  AgentTraceSpanEntity,
  CreateTraceSpanInput,
  TraceContext,
  SpanKind,
} from "../observability.types.js";

export class AgentObservabilityService {
  constructor(private readonly repository: AgentObservabilityRepository) {}

  // =========================================================================
  // 1. W3C TRACEPARENT PROTOCOL & CONTEXT UTILITIES
  // =========================================================================

  /**
   * Generates a 32-hex trace ID, 16-hex span ID and formatted W3C traceparent header:
   * 00-{traceId}-{spanId}-01
   */
  generateTraceparent(): { traceparent: string; context: TraceContext } {
    const traceId = randomBytes(16).toString("hex");
    const spanId = randomBytes(8).toString("hex");
    const traceFlags = "01";
    const traceparent = `00-${traceId}-${spanId}-${traceFlags}`;

    return {
      traceparent,
      context: {
        traceId,
        spanId,
        parentSpanId: null,
        traceFlags,
      },
    };
  }

  /**
   * Parses an incoming W3C traceparent header or correlation ID.
   */
  parseTraceparent(header?: string | null): TraceContext {
    if (!header) {
      return this.generateTraceparent().context;
    }

    const parts = header.trim().split("-");
    if (parts.length >= 4 && parts[0] === "00" && parts[1].length === 32 && parts[2].length === 16) {
      return {
        traceId: parts[1],
        spanId: parts[2],
        parentSpanId: null,
        traceFlags: parts[3],
      };
    }

    // Fallback: use hash or format as traceId
    const sanitized = header.replace(/[^a-f0-9]/gi, "").padEnd(32, "0").substring(0, 32);
    return {
      traceId: sanitized,
      spanId: randomBytes(8).toString("hex"),
      parentSpanId: null,
      traceFlags: "01",
    };
  }

  // =========================================================================
  // 2. DEEP SECRET REDACTION ENGINE
  // =========================================================================

  /**
   * Recursively scrubs credentials, API keys, and connection strings from metadata & payloads
   */
  redactSecrets(data: unknown): any {
    if (!data) return data;

    if (typeof data === "string") {
      let cleaned = data;
      // OpenAI / Anthropic / AI API keys (sk-...)
      cleaned = cleaned.replace(/sk-[a-zA-Z0-9_\-]{20,}/g, "sk-...REDACTED");
      // Bearer tokens
      cleaned = cleaned.replace(/Bearer\s+[a-zA-Z0-9._\-]{20,}/gi, "Bearer ...REDACTED");
      // Database connection URLs
      cleaned = cleaned.replace(/mysql:\/\/[^:]+:[^@]+@([^/]+)/gi, "mysql://[USER]:[REDACTED]@$1");
      cleaned = cleaned.replace(/postgres(?:ql)?:\/\/[^:]+:[^@]+@([^/]+)/gi, "postgres://[USER]:[REDACTED]@$1");
      return cleaned;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.redactSecrets(item));
    }

    if (typeof data === "object") {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("password") ||
          lowerKey.includes("secret")
        ) {
          sanitized[key] = "[REDACTED_CREDENTIAL]";
        } else {
          sanitized[key] = this.redactSecrets(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  // =========================================================================
  // 3. SPAN LIFECYCLE MANAGEMENT
  // =========================================================================

  /**
   * Starts a new span in a trace tree
   */
  async startSpan(input: {
    organizationId: string;
    workspaceId?: string | null;
    traceId: string;
    parentSpanId?: string | null;
    name: string;
    kind?: SpanKind;
    agentId?: string | null;
    agentRunId?: string | null;
    workflowRunId?: string | null;
    autonomousTaskRunId?: string | null;
    attributes?: Record<string, unknown>;
  }): Promise<AgentTraceSpanEntity> {
    const spanId = randomBytes(8).toString("hex");
    const sanitizedAttributes = this.redactSecrets(input.attributes || {});

    return await this.repository.createSpan({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      traceId: input.traceId,
      spanId,
      parentSpanId: input.parentSpanId,
      name: input.name,
      kind: input.kind || "internal",
      status: "unset",
      startTime: new Date(),
      agentId: input.agentId,
      agentRunId: input.agentRunId,
      workflowRunId: input.workflowRunId,
      autonomousTaskRunId: input.autonomousTaskRunId,
      attributes: sanitizedAttributes,
      events: [
        {
          name: "span_started",
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }

  /**
   * Records a complete span directly (e.g. at end of tool invocation or AI provider call)
   */
  async recordSpan(input: CreateTraceSpanInput): Promise<AgentTraceSpanEntity> {
    const sanitizedAttributes = this.redactSecrets(input.attributes || {});
    return await this.repository.createSpan({
      ...input,
      attributes: sanitizedAttributes,
    });
  }

  // =========================================================================
  // 4. TRACE TREE QUERY & HIERARCHY ASSEMBLY
  // =========================================================================

  /**
   * Builds an assembled parent-child execution span tree for the distributed trace explorer
   */
  async getTraceTree(organizationId: string, traceId: string): Promise<{
    traceId: string;
    rootSpans: Array<AgentTraceSpanEntity & { children: any[] }>;
    totalDurationMs: number;
    spanCount: number;
    errorCount: number;
  }> {
    const spans = await this.repository.listSpansByTraceId(organizationId, traceId);
    if (!spans.length) {
      return {
        traceId,
        rootSpans: [],
        totalDurationMs: 0,
        spanCount: 0,
        errorCount: 0,
      };
    }

    const spanMap = new Map<string, AgentTraceSpanEntity & { children: any[] }>();
    let errorCount = 0;
    let minStart = Infinity;
    let maxEnd = 0;

    for (const span of spans) {
      if (span.status === "error") errorCount += 1;
      const startMs = span.startTime.getTime();
      const endMs = span.endTime ? span.endTime.getTime() : startMs + (span.durationMs || 0);

      if (startMs < minStart) minStart = startMs;
      if (endMs > maxEnd) maxEnd = endMs;

      spanMap.set(span.spanId, {
        ...span,
        children: [],
      });
    }

    const rootSpans: Array<AgentTraceSpanEntity & { children: any[] }> = [];

    for (const span of spans) {
      const node = spanMap.get(span.spanId)!;
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        spanMap.get(span.parentSpanId)!.children.push(node);
      } else {
        rootSpans.push(node);
      }
    }

    const totalDurationMs = maxEnd > minStart ? maxEnd - minStart : 0;

    return {
      traceId,
      rootSpans,
      totalDurationMs,
      spanCount: spans.length,
      errorCount,
    };
  }

  async listSpans(organizationId: string, options: any) {
    return await this.repository.listSpans(organizationId, options);
  }
}

