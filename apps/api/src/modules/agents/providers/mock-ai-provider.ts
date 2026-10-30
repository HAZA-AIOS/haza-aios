import { randomUUID } from "node:crypto";
import {
  AiProvider,
  AiProviderError,
  ModelInvocationRequest,
  ModelInvocationResponse,
  ModelMetadata,
  ToolCall,
} from "./ai-provider.types.js";

const DEFAULT_MOCK_MODELS: ModelMetadata[] = [
  {
    id: "mock-gpt-4o",
    name: "Mock GPT-4o",
    provider: "mock",
    contextWindow: 128_000,
    maxOutputTokens: 4096,
    capabilities: ["chat", "completion", "tools", "json_mode"],
    pricing: {
      promptPerThousandTokensUsd: 0.005,
      completionPerThousandTokensUsd: 0.015,
    },
  },
  {
    id: "mock-claude-3-5-sonnet",
    name: "Mock Claude 3.5 Sonnet",
    provider: "mock",
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    capabilities: ["chat", "completion", "tools", "vision"],
    pricing: {
      promptPerThousandTokensUsd: 0.003,
      completionPerThousandTokensUsd: 0.015,
    },
  },
  {
    id: "mock-gemini-1-5-pro",
    name: "Mock Gemini 1.5 Pro",
    provider: "mock",
    contextWindow: 1_000_000,
    maxOutputTokens: 8192,
    capabilities: ["chat", "completion", "tools", "vision", "json_mode"],
    pricing: {
      promptPerThousandTokensUsd: 0.00125,
      completionPerThousandTokensUsd: 0.005,
    },
  },
];

export class MockAiProvider implements AiProvider {
  readonly id = "mock";
  readonly name = "HAZA Mock AI Provider";
  readonly version = "1.0.0";

  private models: Map<string, ModelMetadata>;
  private simulatedLatencyMs = 0;
  private simulatedError: AiProviderError | null = null;
  private cannedResponse: string | null = null;
  private cannedToolCalls: ToolCall[] | null = null;

  constructor(customModels?: ModelMetadata[]) {
    this.models = new Map();
    const source = customModels ?? DEFAULT_MOCK_MODELS;
    for (const m of source) {
      this.models.set(m.id, m);
    }
  }

  setSimulatedLatency(ms: number): void {
    this.simulatedLatencyMs = Math.max(0, ms);
  }

  setSimulatedError(error: AiProviderError | null): void {
    this.simulatedError = error;
  }

  setCannedResponse(response: string | null): void {
    this.cannedResponse = response;
  }

  setCannedToolCalls(calls: ToolCall[] | null): void {
    this.cannedToolCalls = calls;
  }

  reset(): void {
    this.simulatedLatencyMs = 0;
    this.simulatedError = null;
    this.cannedResponse = null;
    this.cannedToolCalls = null;
  }

  async listModels(): Promise<ModelMetadata[]> {
    return Array.from(this.models.values());
  }

  async getModel(modelId: string): Promise<ModelMetadata | null> {
    return this.models.get(modelId) ?? null;
  }

  validateConfig(config: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    if (config.apiKey !== undefined && typeof config.apiKey !== "string") {
      errors.push("apiKey must be a string");
    }
    if (config.timeoutMs !== undefined) {
      if (typeof config.timeoutMs !== "number" || config.timeoutMs < 0) {
        errors.push("timeoutMs must be a non-negative number");
      }
    }
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResponse> {
    const startTime = Date.now();

    // 1. Check signal cancellation prior to starting
    if (request.signal?.aborted) {
      throw new AiProviderError("Model invocation was aborted by client.", {
        code: "CANCELLED",
        provider: this.id,
        retryable: false,
      });
    }

    // 2. Validate model
    const model = await this.getModel(request.model);
    if (!model) {
      throw new AiProviderError(`Requested model '${request.model}' is not registered with ${this.name}.`, {
        code: "MODEL_NOT_FOUND",
        provider: this.id,
        retryable: false,
        statusCode: 404,
      });
    }

    // 3. Check for timeout or simulated error
    if (this.simulatedError) {
      throw this.simulatedError;
    }

    // 4. Handle simulated latency and timeout
    const latency = this.simulatedLatencyMs;
    const timeout = request.timeoutMs;

    if (timeout !== undefined && timeout > 0 && latency > timeout) {
      await this.sleep(timeout, request.signal);
      throw new AiProviderError(`Model invocation timed out after ${timeout}ms.`, {
        code: "TIMEOUT",
        provider: this.id,
        retryable: true,
        statusCode: 504,
      });
    }

    if (latency > 0) {
      await this.sleep(latency, request.signal);
    }

    if (request.signal?.aborted) {
      throw new AiProviderError("Model invocation was aborted by client.", {
        code: "CANCELLED",
        provider: this.id,
        retryable: false,
      });
    }

    // 5. Build response content
    const lastUserMessage = [...request.messages].reverse().find((m) => m.role === "user");
    const systemMessage = request.messages.find((m) => m.role === "system");
    const userPrompt = lastUserMessage?.content ?? "No prompt provided";
    const systemPrompt = systemMessage?.content ?? "";

    let content: string;
    let toolCalls: ToolCall[] | undefined = undefined;
    let finishReason: ModelInvocationResponse["finishReason"] = "stop";

    if (this.cannedToolCalls && this.cannedToolCalls.length > 0) {
      toolCalls = this.cannedToolCalls;
      content = this.cannedResponse ?? "";
      finishReason = "tool_calls";
    } else if (this.cannedResponse !== null) {
      content = this.cannedResponse;
    } else if (
      systemPrompt.includes("Academic Planning Assistant") ||
      systemPrompt.includes("LessonPlanOutput") ||
      userPrompt.includes("gradeLevel") ||
      userPrompt.includes("learningGoals")
    ) {
      content = buildMockLessonPlanJson(userPrompt);
    } else {
      content = `[Mock Response from ${model.name}] Processed request: "${userPrompt.slice(0, 100)}"`;
    }

    // 6. Calculate token usage deterministically (~4 characters per token)
    const promptChars = request.messages.reduce((sum, m) => sum + m.content.length, 0);
    const promptTokens = Math.max(1, Math.ceil(promptChars / 4));
    const completionTokens = Math.max(1, Math.ceil(content.length / 4));
    const totalTokens = promptTokens + completionTokens;

    const pricing = model.pricing;
    const estimatedCostUsd = pricing
      ? (promptTokens / 1000) * pricing.promptPerThousandTokensUsd +
        (completionTokens / 1000) * pricing.completionPerThousandTokensUsd
      : undefined;

    const duration = Date.now() - startTime;

    return {
      id: `mock-inv-${randomUUID()}`,
      model: model.id,
      provider: this.id,
      content,
      finishReason,
      toolCalls,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCostUsd,
      },
      latencyMs: duration,
      metadata: {
        simulated: true,
        latencyMs: duration,
      },
    };
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(
            new AiProviderError("Model invocation was aborted during wait.", {
              code: "CANCELLED",
              provider: this.id,
              retryable: false,
            }),
          );
        });
      }
    });
  }
}

function buildMockLessonPlanJson(userPrompt: string): string {
  let grade = "Grade 8";
  let subject = "General Science";
  let topic = "Ecosystems and Energy Flow";
  let durationMinutes = 45;

  try {
    const parsed = JSON.parse(userPrompt);
    if (parsed.gradeLevel) grade = parsed.gradeLevel;
    if (parsed.subject) subject = parsed.subject;
    if (parsed.topic) topic = parsed.topic;
    if (parsed.durationMinutes) durationMinutes = Number(parsed.durationMinutes) || 45;
  } catch {
    // If not raw JSON, extract simple terms if present
    const topicMatch = userPrompt.match(/topic['":\s]+([^,\n}"]+)/i);
    if (topicMatch) topic = topicMatch[1].trim();
    const gradeMatch = userPrompt.match(/grade['":\s]+([^,\n}"]+)/i);
    if (gradeMatch) grade = gradeMatch[1].trim();
    const subjectMatch = userPrompt.match(/subject['":\s]+([^,\n}"]+)/i);
    if (subjectMatch) subject = subjectMatch[1].trim();
  }

  const lessonPlan = {
    lessonTitle: `${topic}: Concepts, Analysis, and Mastery`,
    grade,
    subject,
    topic,
    durationMinutes,
    curriculumAlignment: {
      reference: null,
      verified: false,
      statement: "General Pedagogical Guidance (Unverified Curriculum Alignment)",
    },
    learningObjectives: [
      {
        type: "cognitive",
        description: `Students will analyze the fundamental mechanisms of ${topic}.`,
        bloomTaxonomyLevel: "analyze",
      },
      {
        type: "skill",
        description: `Students will apply ${topic} principles through structured inquiry problem-solving.`,
        bloomTaxonomyLevel: "apply",
      },
      {
        type: "affective",
        description: "Students will collaborate constructively and reflect on real-world scientific applications.",
        bloomTaxonomyLevel: "understand",
      },
    ],
    requiredMaterials: [
      "Digital student workbooks or physical science notebooks",
      "Interactive diagram handouts and whiteboard markers",
      "Teacher demonstration projector / visual aids",
    ],
    priorKnowledge: `Foundational terminology and introductory concepts relevant to ${subject} and introductory units.`,
    lessonIntroduction: {
      hook: `Engage students with a real-world dilemma demonstrating ${topic} in everyday contexts.`,
      durationMinutes: Math.max(5, Math.round(durationMinutes * 0.15)),
      instructions: "Facilitate a 3-minute Think-Pair-Share discussion to surface and address misconceptions.",
    },
    teachingSequence: [
      {
        stepNumber: 1,
        title: "Explicit Modeling & Conceptual Framing",
        durationMinutes: Math.max(10, Math.round(durationMinutes * 0.25)),
        teacherActions: `Present structured visual anchors and demonstrate key ${topic} formulas and principles.`,
        studentActions: "Annotate provided graphic organizers, answer targeted check questions.",
        keyPoints: [
          `Definition and relevance of ${topic}`,
          "Key components and interaction patterns",
          "Common analytical pitfalls",
        ],
      },
      {
        stepNumber: 2,
        title: "Guided Investigation",
        durationMinutes: Math.max(10, Math.round(durationMinutes * 0.25)),
        teacherActions: "Circulate among peer groups, posing scaffolded guiding questions and recording formative notes.",
        studentActions: "Work in pairs to solve progressive challenge problems and justify conclusions.",
        keyPoints: [
          "Peer debate and evidence verification",
          "Step-by-step reasoning documentation",
        ],
      },
    ],
    guidedPractice: {
      activity: "Small group collaborative case study with guided prompt cards and structured roles.",
      durationMinutes: Math.max(8, Math.round(durationMinutes * 0.2)),
      checkpoints: [
        "Can students accurately state the core principle?",
        "Are groups providing evidence-based justifications?",
      ],
    },
    independentActivities: {
      activity: "Individual synthesis worksheet requiring students to apply learning to a novel scenario.",
      durationMinutes: Math.max(7, Math.round(durationMinutes * 0.15)),
      extensionTask: `Formulate a hypothesis extending ${topic} to advanced real-world applications.`,
    },
    differentiationSuggestions: {
      forStrugglingStudents: [
        "Provide worked examples with color-coded steps",
        "Offer structured sentence stems and word banks for explanations",
        "Allow peer partner consultations for intermediate checkpoints",
      ],
      forAdvancedStudents: [
        "Challenge with multi-variable constraints and edge-case evaluations",
        "Ask students to critique an alternative or flawed scientific model",
      ],
      forEalOrSpecialNeeds: [
        "Bilingual visual glossaries with diagrammatic illustrations",
        "Extended thinking time and multimodal demonstration options",
      ],
    },
    formativeAssessment: {
      strategies: [
        "Cold-call conceptual check questions",
        "Thumbs up / sideways / down comprehension calibration",
        "Teacher circulation observational rubrics",
      ],
      guidingQuestions: [
        `How does ${topic} relate to our previous unit?`,
        "Why is this step essential in reaching a valid outcome?",
      ],
    },
    exitTicket: {
      prompt: `Write two sentences explaining the core rule of ${topic} and one question you want clarified next class.`,
      successCriteria: "Accurately references at least one key instructional term with logical supporting rationale.",
    },
    teacherNotes: [
      `Watch for common confusion between fundamental definitions in ${topic}.`,
      "Ensure transition between group work and independent tasks is crisp and time-bounded.",
    ],
    homeworkSuggestions: [
      `Review key terms and complete 3 practice analysis questions on ${topic}.`,
    ],
  };

  return JSON.stringify(lessonPlan, null, 2);
}
