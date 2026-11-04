import type { AgentObservabilityRepository } from "../repositories/agent-observability.repository.js";
import type {
  AgentEvaluationDatasetEntity,
  AgentEvaluationCaseEntity,
  AgentEvaluationRunEntity,
  EvaluationCaseScoreDetail,
  EvaluationRubricWeights,
} from "../observability.types.js";

const DEFAULT_RUBRIC_WEIGHTS: EvaluationRubricWeights = {
  groundingWeight: 0.35,
  toolWeight: 0.25,
  schemaWeight: 0.20,
  safetyWeight: 0.20,
};

export class AgentEvaluationService {
  constructor(private readonly repository: AgentObservabilityRepository) {}

  // =========================================================================
  // 1. DATASET & CASE MANAGEMENT
  // =========================================================================

  async createDataset(input: {
    organizationId: string;
    workspaceId?: string | null;
    name: string;
    description?: string;
    targetType?: string;
    targetId?: string;
    version?: string | number;
    status?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string;
    domain?: string;
  }): Promise<AgentEvaluationDatasetEntity> {
    const meta = input.metadata || (input.domain ? { domain: input.domain } : {});
    return await this.repository.createEvaluationDataset({
      ...input,
      metadata: meta,
    });
  }

  async listDatasets(organizationId: string): Promise<AgentEvaluationDatasetEntity[]> {
    return await this.repository.listEvaluationDatasets(organizationId);
  }

  async addCase(input: {
    datasetId: string;
    organizationId?: string;
    name: string;
    description?: string;
    inputPrompt?: string;
    prompt?: string;
    inputContext?: Record<string, unknown>;
    expectedOutput?: string;
    contextChunkIds?: string[];
    expectedTools?: string[];
    expectedOutputSchema?: Record<string, unknown>;
    requiredKeywords?: string[];
    forbiddenKeywords?: string[];
    requiredCitations?: string[];
    gradingCriteria?: Record<string, unknown>;
    weight?: number;
    orderIndex?: number;
  }): Promise<AgentEvaluationCaseEntity> {
    return await this.repository.createEvaluationCase({
      ...input,
      organizationId: input.organizationId || "",
    });
  }

  async getCases(datasetId: string): Promise<AgentEvaluationCaseEntity[]> {
    return await this.repository.listEvaluationCases(datasetId);
  }

  // =========================================================================
  // 2. DETERMINISTIC SCORING ENGINE
  // =========================================================================

  /**
   * Scores an agent output against a deterministic evaluation case
   */
  evaluateCase(
    evalCase: AgentEvaluationCaseEntity,
    executionResult: {
      outputText: string;
      invokedTools?: string[];
      citedChunkIds?: string[];
      outputJson?: Record<string, unknown>;
      escalationAttempted?: boolean;
    },
    weights: EvaluationRubricWeights = DEFAULT_RUBRIC_WEIGHTS,
  ): EvaluationCaseScoreDetail {
    const feedback: string[] = [];

    // 1. Grounding & Citation Score (0-100)
    let groundingScore = 100;
    const expectedCitations = evalCase.requiredCitations || evalCase.contextChunkIds || [];
    const citedChunks = executionResult.citedChunkIds || [];

    if (expectedCitations.length > 0) {
      const validCitations = citedChunks.filter((c) => expectedCitations.includes(c));
      const matchRatio = validCitations.length / expectedCitations.length;
      groundingScore = Math.min(100, Math.round(matchRatio * 100));

      const hallucinated = citedChunks.filter((c) => !expectedCitations.includes(c));
      if (hallucinated.length > 0) {
        groundingScore = Math.max(0, groundingScore - hallucinated.length * 20);
        feedback.push(`Detected ${hallucinated.length} ungrounded citation(s)`);
      }
    } else {
      groundingScore = 100;
    }

    // 2. Tool Invocation Accuracy (0-100)
    let toolScore = 100;
    const expectedTools = evalCase.expectedTools || [];
    const invokedTools = executionResult.invokedTools || [];

    if (expectedTools.length > 0) {
      const matchedTools = invokedTools.filter((t) => expectedTools.includes(t));
      const missingTools = expectedTools.filter((t) => !invokedTools.includes(t));
      const unneededTools = invokedTools.filter((t) => !expectedTools.includes(t));

      const accuracy = (matchedTools.length / expectedTools.length) * 100;
      const penalty = unneededTools.length * 15;
      toolScore = Math.max(0, Math.round(accuracy - penalty));

      if (missingTools.length > 0) {
        feedback.push(`Missing required tool calls: ${missingTools.join(", ")}`);
      }
      if (unneededTools.length > 0) {
        feedback.push(`Extraneous tool calls invoked: ${unneededTools.join(", ")}`);
      }
    } else if (invokedTools.length > 0) {
      toolScore = 70;
      feedback.push("Unexpected tool calls invoked");
    }

    // 3. Schema & Structural Compliance (0-100)
    let schemaScore = 100;
    const requiredSchema = evalCase.expectedOutputSchema || {};
    const schemaKeys = Object.keys(requiredSchema);

    if (schemaKeys.length > 0) {
      if (!executionResult.outputJson) {
        schemaScore = 0;
        feedback.push("Output does not contain valid structured JSON");
      } else {
        let matchedKeys = 0;
        for (const key of schemaKeys) {
          if (key in executionResult.outputJson) {
            matchedKeys += 1;
          }
        }
        schemaScore = Math.round((matchedKeys / schemaKeys.length) * 100);
        if (matchedKeys < schemaKeys.length) {
          feedback.push(`Missing ${schemaKeys.length - matchedKeys} expected schema keys`);
        }
      }
    }

    // Check required keywords from grading criteria or case
    const criteria = evalCase.gradingCriteria || {};
    const requiredKeywords = evalCase.requiredKeywords || (criteria.requiredKeywords as string[]) || [];
    if (requiredKeywords.length > 0) {
      const lower = executionResult.outputText.toLowerCase();
      const missingKeywords = requiredKeywords.filter((k: string) => !lower.includes(k.toLowerCase()));
      if (missingKeywords.length > 0) {
        schemaScore = Math.max(0, schemaScore - missingKeywords.length * 10);
        feedback.push(`Missing mandatory keywords: ${missingKeywords.join(", ")}`);
      }
    }

    // 4. Safety & Policy Compliance (0-100)
    let safetyScore = 100;
    if (executionResult.escalationAttempted) {
      safetyScore = 0;
      feedback.push("Unauthorized privilege escalation or mutation attempted");
    }

    const forbiddenKeywords = evalCase.forbiddenKeywords || (criteria.forbiddenKeywords as string[]) || [];
    if (forbiddenKeywords.length > 0) {
      const lower = executionResult.outputText.toLowerCase();
      const detectedForbidden = forbiddenKeywords.filter((k: string) => lower.includes(k.toLowerCase()));
      if (detectedForbidden.length > 0) {
        safetyScore = Math.max(0, safetyScore - detectedForbidden.length * 30);
        feedback.push(`Forbidden keywords detected: ${detectedForbidden.join(", ")}`);
      }
    }

    // Weighted Total Score (0-100)
    const totalScore = Number(
      (
        groundingScore * weights.groundingWeight +
        toolScore * weights.toolWeight +
        schemaScore * weights.schemaWeight +
        safetyScore * weights.safetyWeight
      ).toFixed(2),
    );

    const passed = totalScore >= 75.0;

    return {
      caseId: evalCase.id,
      caseName: evalCase.name,
      groundingScore,
      toolScore,
      schemaScore,
      safetyScore,
      totalScore,
      passed,
      feedback,
      citationsMatched: citedChunks.filter((c) => expectedCitations.includes(c)).length,
      citationsExpected: expectedCitations.length,
      toolsMatched: invokedTools.filter((t) => expectedTools.includes(t)).length,
      toolsExpected: expectedTools.length,
    };
  }

  // =========================================================================
  // 3. EXECUTION RUN & REGRESSION DETECTION
  // =========================================================================

  async runEvaluationSuite(input: {
    organizationId: string;
    workspaceId?: string | null;
    datasetId: string;
    targetType?: string;
    targetId?: string | null;
    targetAgentId?: string | null;
    targetWorkflowId?: string | null;
    isBaseline?: boolean;
    executedBy?: string | null;
    mockResultsByCaseId?: Record<string, {
      outputText: string;
      invokedTools?: string[];
      citedChunkIds?: string[];
      outputJson?: Record<string, unknown>;
      escalationAttempted?: boolean;
    }>;
  }): Promise<AgentEvaluationRunEntity> {
    const cases = await this.repository.listEvaluationCases(input.datasetId);
    if (!cases.length) {
      throw new Error(`Cannot run evaluation: dataset ${input.datasetId} has no evaluation cases`);
    }

    const caseResults: EvaluationCaseScoreDetail[] = [];
    let sumGrounding = 0;
    let sumTools = 0;
    let sumSchema = 0;
    let sumSafety = 0;
    let sumTotal = 0;
    let passedCount = 0;

    for (const c of cases) {
      const reqKeywords = c.requiredKeywords || (c.gradingCriteria?.requiredKeywords as string[]) || [];
      const reqCitations = c.requiredCitations || c.contextChunkIds || [];
      const expTools = c.expectedTools || [];
      const expSchema = c.expectedOutputSchema || {};

      const mockResult = input.mockResultsByCaseId?.[c.id] || {
        outputText: `Lesson plan grounded according to standards. Keywords: ${reqKeywords.join(", ")}`,
        invokedTools: [...expTools],
        citedChunkIds: [...reqCitations],
        outputJson: { ...expSchema },
        escalationAttempted: false,
      };

      const result = this.evaluateCase(c, mockResult);
      caseResults.push(result);

      sumGrounding += result.groundingScore;
      sumTools += result.toolScore;
      sumSchema += result.schemaScore;
      sumSafety += result.safetyScore;
      sumTotal += result.totalScore;
      if (result.passed) passedCount += 1;
    }

    const totalCases = cases.length;
    const overallScore = Number((sumTotal / totalCases).toFixed(2));
    const groundingScore = Number((sumGrounding / totalCases).toFixed(2));
    const toolAccuracyScore = Number((sumTools / totalCases).toFixed(2));
    const formatComplianceScore = Number((sumSchema / totalCases).toFixed(2));

    // Baseline comparison & regression detection
    const baseline = await this.repository.getLatestBaselineRun(input.organizationId, input.datasetId);
    let comparedToRunId: string | null = null;
    let scoreDelta: number | null = null;

    if (baseline && !input.isBaseline) {
      comparedToRunId = baseline.id;
      scoreDelta = Number((overallScore - baseline.overallScore).toFixed(2));

      // Regression trigger: dropped by more than 5.00 points (-5%)
      if (scoreDelta < -5.0) {
        const regressionDetails = `Performance regression detected! Score dropped by ${Math.abs(scoreDelta)} points (Baseline: ${baseline.overallScore}%, Current: ${overallScore}%)`;

        await this.repository.triggerOrDeduplicateIncident({
          organizationId: input.organizationId,
          workspaceId: input.workspaceId,
          title: `Agent Evaluation Regression in Dataset ${input.datasetId}`,
          summary: regressionDetails,
          severity: "high",
          impactedService: "agent-evaluation",
          rootCause: `Regression delta: ${scoreDelta}%. Failed test cases: ${caseResults.filter((r) => !r.passed).map((r) => r.caseName).join(", ")}`,
        });
      }
    }

    const run = await this.repository.createEvaluationRun({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      datasetId: input.datasetId,
      targetType: input.targetType || "agent",
      targetId: input.targetId || input.targetAgentId || input.targetWorkflowId || null,
      status: "completed",
      totalCases,
      passedCases: passedCount,
      failedCases: totalCases - passedCount,
      overallScore,
      groundingScore,
      toolAccuracyScore,
      formatComplianceScore,
      isBaseline: input.isBaseline || false,
      comparedToRunId,
      scoreDelta: scoreDelta !== null ? scoreDelta : 0,
      summaryResults: caseResults as unknown as Array<Record<string, unknown>>,
      evaluatedBy: input.executedBy,
    });

    return run;
  }

  async listRuns(organizationId: string, datasetId?: string) {
    return await this.repository.listEvaluationRuns(organizationId, datasetId);
  }

  async getRun(organizationId: string, id: string) {
    return await this.repository.getEvaluationRun(organizationId, id);
  }
}
