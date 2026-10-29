import type { AgentValidationError } from "../agent.types.js";

const forbiddenSecretKeys = new Set([
  "apikey",
  "api_key",
  "secret",
  "token",
  "accesstoken",
  "access_token",
  "password",
  "credential",
  "credentials",
  "privatekey",
  "private_key",
  "client_secret",
  "clientsecret",
  "auth_token",
  "authorization",
]);

const allowedProviderKeys = new Set([
  "provider",
  "modelSelection",
  "temperature",
  "maxTokens",
  "timeoutSeconds",
  "contextWindow",
  "responseQuality",
  "tokenLimits",
]);

export function isSecretKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (allowedProviderKeys.has(key) || lower === "tokenlimits") return false;
  if (forbiddenSecretKeys.has(lower)) return true;
  const stripped = lower.replace(/[-_]/g, "");
  return (
    stripped === "apikey" ||
    stripped === "accesstoken" ||
    stripped === "authtoken" ||
    stripped === "clientsecret" ||
    stripped === "privatekey" ||
    stripped === "credentials" ||
    stripped === "password" ||
    stripped.endsWith("token") ||
    stripped.endsWith("secret") ||
    stripped.endsWith("apikey")
  );
}

export function detectSecretKeys(value: unknown, path = ""): string[] {
  const detected: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, idx) => {
      detected.push(...detectSecretKeys(item, `${path}[${idx}]`));
    });
    return detected;
  }
  if (!value || typeof value !== "object") return detected;

  for (const [key, nested] of Object.entries(value)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (isSecretKey(key)) {
      detected.push(currentPath);
    }
    detected.push(...detectSecretKeys(nested, currentPath));
  }
  return detected;
}

export interface ValidationContextOptions {
  availableProviders?: string[];
  availableModels?: Record<string, string[]>;
  registeredCapabilities?: string[];
  registeredTools?: string[];
  allowedKnowledgeIds?: string[];
}

export function validateBuilderConfiguration(
  input: unknown,
  options: ValidationContextOptions = {},
): {
  valid: boolean;
  status: "valid" | "invalid" | "warning";
  errors: AgentValidationError[];
  warnings: AgentValidationError[];
} {
  const errors: AgentValidationError[] = [];
  const warnings: AgentValidationError[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    errors.push({
      field: "root",
      message: "Configuration payload must be a JSON object.",
      severity: "error",
      section: "root",
    });
    return { valid: false, status: "invalid", errors, warnings };
  }

  const raw = input as Record<string, unknown>;

  // Secret scanner across entire document
  const secrets = detectSecretKeys(raw);
  if (secrets.length > 0) {
    errors.push({
      field: "security",
      message: `Provider secrets detected in configuration (${secrets.join(", ")}). Remove all credentials.`,
      severity: "error",
      section: "model",
    });
  }

  // 1. Identity Validation
  const identity = (raw.identity ?? {}) as Record<string, unknown>;
  const name = typeof identity.name === "string" ? identity.name.trim() : "";
  if (!name || name.length < 2) {
    errors.push({
      field: "identity.name",
      message: "Agent name is required and must be at least 2 characters.",
      severity: "error",
      section: "identity",
    });
  } else if (name.length > 180) {
    errors.push({
      field: "identity.name",
      message: "Agent name cannot exceed 180 characters.",
      severity: "error",
      section: "identity",
    });
  }

  const agentKey = typeof identity.agentKey === "string" ? identity.agentKey.trim() : "";
  if (!agentKey || agentKey.length < 2) {
    errors.push({
      field: "identity.agentKey",
      message: "Agent key is required and must be at least 2 characters.",
      severity: "error",
      section: "identity",
    });
  } else if (agentKey.length > 100) {
    errors.push({
      field: "identity.agentKey",
      message: "Agent key cannot exceed 100 characters.",
      severity: "error",
      section: "identity",
    });
  } else if (!/^[a-z0-9_-]+$/i.test(agentKey)) {
    errors.push({
      field: "identity.agentKey",
      message: "Agent key must contain only letters, numbers, hyphens, and underscores.",
      severity: "error",
      section: "identity",
    });
  }

  const description = typeof identity.description === "string" ? identity.description.trim() : "";
  if (!description || description.length < 5) {
    errors.push({
      field: "identity.description",
      message: "Agent description is required and must be at least 5 characters.",
      severity: "error",
      section: "identity",
    });
  } else if (description.length > 1000) {
    errors.push({
      field: "identity.description",
      message: "Agent description cannot exceed 1000 characters.",
      severity: "error",
      section: "identity",
    });
  }

  // 2. Model & Provider Validation
  const model = (raw.model ?? {}) as Record<string, unknown>;
  const provider = typeof model.provider === "string" ? model.provider.trim() : "";
  if (!provider) {
    errors.push({
      field: "model.provider",
      message: "AI model provider is required.",
      severity: "error",
      section: "model",
    });
  } else if (options.availableProviders && !options.availableProviders.includes(provider)) {
    warnings.push({
      field: "model.provider",
      message: `Provider '${provider}' is not currently in the registered catalog.`,
      severity: "warning",
      section: "model",
    });
  }

  const modelSelection = typeof model.modelSelection === "string" ? model.modelSelection.trim() : "";
  if (!modelSelection) {
    errors.push({
      field: "model.modelSelection",
      message: "Model selection is required.",
      severity: "error",
      section: "model",
    });
  } else if (
    provider &&
    options.availableModels &&
    options.availableModels[provider] &&
    !options.availableModels[provider].includes(modelSelection)
  ) {
    warnings.push({
      field: "model.modelSelection",
      message: `Model '${modelSelection}' is not recognized for provider '${provider}'.`,
      severity: "warning",
      section: "model",
    });
  }

  const temperature = Number(model.temperature ?? 0.7);
  if (isNaN(temperature) || temperature < 0 || temperature > 2.0) {
    errors.push({
      field: "model.temperature",
      message: "Temperature must be a number between 0.0 and 2.0.",
      severity: "error",
      section: "model",
    });
  }

  const maxTokens = Number(model.maxTokens ?? 2048);
  if (isNaN(maxTokens) || maxTokens < 64 || maxTokens > 32768) {
    errors.push({
      field: "model.maxTokens",
      message: "Max tokens must be an integer between 64 and 32,768.",
      severity: "error",
      section: "model",
    });
  }

  const timeoutSeconds = Number(model.timeoutSeconds ?? 60);
  if (isNaN(timeoutSeconds) || timeoutSeconds < 5 || timeoutSeconds > 300) {
    errors.push({
      field: "model.timeoutSeconds",
      message: "Timeout must be between 5 and 300 seconds.",
      severity: "error",
      section: "model",
    });
  }

  // 3. Instructions Validation
  const instructions = (raw.instructions ?? {}) as Record<string, unknown>;
  const role = typeof instructions.role === "string" ? instructions.role.trim() : "";
  if (!role) {
    errors.push({
      field: "instructions.role",
      message: "Agent role definition is required.",
      severity: "error",
      section: "instructions",
    });
  } else if (role.length > 10000) {
    errors.push({
      field: "instructions.role",
      message: "Role definition cannot exceed 10,000 characters.",
      severity: "error",
      section: "instructions",
    });
  }

  const objectives = typeof instructions.objectives === "string" ? instructions.objectives.trim() : "";
  if (!objectives) {
    errors.push({
      field: "instructions.objectives",
      message: "Agent objectives are required.",
      severity: "error",
      section: "instructions",
    });
  } else if (objectives.length > 10000) {
    errors.push({
      field: "instructions.objectives",
      message: "Objectives cannot exceed 10,000 characters.",
      severity: "error",
      section: "instructions",
    });
  }

  for (const [key, maxLen] of [
    ["boundaryConstraints", 10000],
    ["behavioralRules", 10000],
    ["outputFormat", 5000],
    ["prohibitedActions", 10000],
    ["escalationRequirements", 10000],
    ["systemInstructions", 30000],
  ] as const) {
    const val = instructions[key];
    if (typeof val === "string" && val.length > maxLen) {
      errors.push({
        field: `instructions.${key}`,
        message: `${key} exceeds maximum length of ${maxLen} characters.`,
        severity: "error",
        section: "instructions",
      });
    }
  }

  // 4. Capabilities Validation
  const capabilities = Array.isArray(raw.capabilities) ? raw.capabilities : [];
  if (capabilities.length === 0) {
    warnings.push({
      field: "capabilities",
      message: "No capabilities declared. Agent will operate with basic conversation only.",
      severity: "warning",
      section: "capabilities",
    });
  }

  let hasHighRiskCapability = false;
  for (let i = 0; i < capabilities.length; i++) {
    const cap = capabilities[i];
    if (!cap || typeof cap !== "object") {
      errors.push({
        field: `capabilities[${i}]`,
        message: "Invalid capability entry.",
        severity: "error",
        section: "capabilities",
      });
      continue;
    }
    const capKey = typeof cap.key === "string" ? cap.key.trim() : "";
    if (!capKey) {
      errors.push({
        field: `capabilities[${i}].key`,
        message: "Capability key is required.",
        severity: "error",
        section: "capabilities",
      });
    }
    if (cap.riskLevel === "high") {
      hasHighRiskCapability = true;
    }
  }

  // 5. Tools Validation
  const tools = Array.isArray(raw.tools) ? raw.tools : [];
  let hasHighRiskTool = false;
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    if (!tool || typeof tool !== "object") {
      errors.push({
        field: `tools[${i}]`,
        message: "Invalid tool declaration entry.",
        severity: "error",
        section: "tools",
      });
      continue;
    }
    const toolKey = typeof tool.toolKey === "string" ? tool.toolKey.trim() : "";
    if (!toolKey) {
      errors.push({
        field: `tools[${i}].toolKey`,
        message: "Tool key is required.",
        severity: "error",
        section: "tools",
      });
    }
    if (tool.riskLevel === "high") {
      hasHighRiskTool = true;
    }
  }

  // 6. Knowledge Sources Validation & Tenant Isolation
  const knowledge = Array.isArray(raw.knowledge) ? raw.knowledge : [];
  if (options.allowedKnowledgeIds !== undefined) {
    const allowedSet = new Set(options.allowedKnowledgeIds);
    for (let i = 0; i < knowledge.length; i++) {
      const ks = knowledge[i];
      if (!ks || typeof ks !== "object") continue;
      const sourceId = typeof ks.sourceId === "string" ? ks.sourceId.trim() : "";
      if (sourceId && !allowedSet.has(sourceId)) {
        errors.push({
          field: `knowledge[${i}].sourceId`,
          message: `Knowledge source '${sourceId}' does not belong to your organization or does not exist.`,
          severity: "error",
          section: "knowledge",
        });
      }
    }
  }

  // 7. Human Approval Policy Validation
  const humanApproval = (raw.humanApproval ?? {}) as Record<string, unknown>;
  const policy = typeof humanApproval.policy === "string" ? humanApproval.policy : "never";
  const validPolicies = ["never", "always", "risk_threshold"];
  if (!validPolicies.includes(policy)) {
    errors.push({
      field: "humanApproval.policy",
      message: "Human approval policy must be 'never', 'always', or 'risk_threshold'.",
      severity: "error",
      section: "humanApproval",
    });
  }

  const approverRoles = Array.isArray(humanApproval.approverRoles)
    ? (humanApproval.approverRoles as string[])
    : [];

  if (policy !== "never" && approverRoles.length === 0) {
    errors.push({
      field: "humanApproval.approverRoles",
      message: "At least one approver role is required when human approval is enabled.",
      severity: "error",
      section: "humanApproval",
    });
  }

  const escalationTimeout = Number(humanApproval.escalationTimeoutHours ?? 24);
  if (isNaN(escalationTimeout) || escalationTimeout < 1 || escalationTimeout > 168) {
    errors.push({
      field: "humanApproval.escalationTimeoutHours",
      message: "Escalation timeout must be between 1 and 168 hours.",
      severity: "error",
      section: "humanApproval",
    });
  }

  // Security constraint: High-risk capabilities/tools cannot have approval policy set to "never"
  if ((hasHighRiskCapability || hasHighRiskTool) && policy === "never") {
    errors.push({
      field: "humanApproval.policy",
      message:
        "Human approval cannot be disabled ('never') when high-risk capabilities or tools are declared.",
      severity: "error",
      section: "humanApproval",
    });
  }

  const valid = errors.length === 0;
  const status: "valid" | "invalid" | "warning" = !valid
    ? "invalid"
    : warnings.length > 0
      ? "warning"
      : "valid";

  return { valid, status, errors, warnings };
}

export function compileSystemInstructions(instructions: Record<string, unknown>): string {
  const parts: string[] = [];

  const role = typeof instructions.role === "string" ? instructions.role.trim() : "";
  if (role) {
    parts.push(`## ROLE & PERSONA\n${role}`);
  }

  const objectives = typeof instructions.objectives === "string" ? instructions.objectives.trim() : "";
  if (objectives) {
    parts.push(`## OBJECTIVES\n${objectives}`);
  }

  const boundaryConstraints =
    typeof instructions.boundaryConstraints === "string"
      ? instructions.boundaryConstraints.trim()
      : "";
  if (boundaryConstraints) {
    parts.push(`## BOUNDARY CONSTRAINTS\n${boundaryConstraints}`);
  }

  const behavioralRules =
    typeof instructions.behavioralRules === "string" ? instructions.behavioralRules.trim() : "";
  if (behavioralRules) {
    parts.push(`## BEHAVIORAL RULES\n${behavioralRules}`);
  }

  const outputFormat =
    typeof instructions.outputFormat === "string" ? instructions.outputFormat.trim() : "";
  if (outputFormat) {
    parts.push(`## OUTPUT FORMAT SPECIFICATIONS\n${outputFormat}`);
  }

  const prohibitedActions =
    typeof instructions.prohibitedActions === "string"
      ? instructions.prohibitedActions.trim()
      : "";
  if (prohibitedActions) {
    parts.push(`## STRICTLY PROHIBITED ACTIONS\n${prohibitedActions}`);
  }

  const escalationRequirements =
    typeof instructions.escalationRequirements === "string"
      ? instructions.escalationRequirements.trim()
      : "";
  if (escalationRequirements) {
    parts.push(`## HUMAN ESCALATION PROTOCOLS\n${escalationRequirements}`);
  }

  return parts.join("\n\n");
}
