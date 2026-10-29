import React from "react";
import {
  BuilderSection,
  ConfigField,
  ModelParameterSliders,
  InstructionTextarea,
  CapabilityCard,
  ToolDeclarationCard,
  ApprovalPolicySelector,
  ValidationSummaryAlert,
  MockPreviewConsole,
  RevisionHistoryList,
} from "@haza-aios/ui/components/agent-builder-primitives";
import { Input } from "@haza-aios/ui/components/input";
import { Select } from "@haza-aios/ui/components/select";
import { Button } from "@haza-aios/ui/components/button";
import type {
  AgentBuilderFullConfig,
  BuilderCatalogOptions,
  BuilderRevisionItem,
  PreviewResponse,
  ValidationResponse,
} from "../../../../agents/agent-builder-service";

interface SectionProps {
  config: AgentBuilderFullConfig;
  catalog: BuilderCatalogOptions;
  onChange: (updates: Partial<AgentBuilderFullConfig>) => void;
  errors?: Array<{ field: string; message: string; section?: string }>;
}

// 1. Identity Section
export const IdentitySection: React.FC<SectionProps> = ({ config, onChange, errors = [] }) => {
  const getFieldError = (f: string) => errors.find((e) => e.field === f)?.message;

  return (
    <BuilderSection
      title="Identity & Presentation"
      description="Define how your agent is presented and referenced across workspaces."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConfigField
          label="Agent Name"
          required
          description="Clear human-readable display name."
          error={getFieldError("identity.name")}
        >
          <Input
            value={config.identity.name}
            onChange={(e) =>
              onChange({ identity: { ...config.identity, name: e.target.value } })
            }
            placeholder="e.g. Worksheet Creator"
          />
        </ConfigField>

        <ConfigField
          label="Unique Agent Key"
          required
          description="Alphanumeric slug for system identification."
          error={getFieldError("identity.agentKey")}
        >
          <Input
            value={config.identity.agentKey}
            onChange={(e) =>
              onChange({
                identity: {
                  ...config.identity,
                  agentKey: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
                },
              })
            }
            placeholder="e.g. worksheet_creator"
          />
        </ConfigField>
      </div>

      <ConfigField
        label="Description"
        required
        description="Detailed description of the agent's purpose, scope, and target persona."
        error={getFieldError("identity.description")}
      >
        <InstructionTextarea
          value={config.identity.description}
          onChange={(val) =>
            onChange({ identity: { ...config.identity, description: val } })
          }
          maxLength={1000}
          rows={3}
          placeholder="e.g. Generates customized student worksheets and quizzes based on subject and difficulty..."
        />
      </ConfigField>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ConfigField label="Category" description="Functional classification.">
          <Input
            value={config.identity.category || ""}
            onChange={(e) =>
              onChange({ identity: { ...config.identity, category: e.target.value } })
            }
            placeholder="e.g. Education, Finance"
          />
        </ConfigField>

        <ConfigField label="Industry" description="Target industry vertical.">
          <Input
            value={config.identity.industry || ""}
            onChange={(e) =>
              onChange({ identity: { ...config.identity, industry: e.target.value } })
            }
            placeholder="e.g. K-12, Higher Ed"
          />
        </ConfigField>

        <ConfigField label="Icon / Avatar" description="Emoji icon representation.">
          <Input
            value={config.identity.icon || "🤖"}
            onChange={(e) =>
              onChange({ identity: { ...config.identity, icon: e.target.value } })
            }
            placeholder="🤖"
          />
        </ConfigField>
      </div>
    </BuilderSection>
  );
};

// 2. Model & Provider Section
export const ModelSection: React.FC<SectionProps> = ({ config, catalog, onChange, errors = [] }) => {
  const getFieldError = (f: string) => errors.find((e) => e.field === f)?.message;

  const currentModels = catalog.models.filter(
    (m) => m.provider === config.model.provider || m.provider === "mock",
  );

  return (
    <BuilderSection
      title="Model & Provider Settings"
      description="Configure model architecture, token budgets, execution timeouts, and temperature."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConfigField
          label="Provider"
          required
          description="AI inference engine."
          error={getFieldError("model.provider")}
        >
          <Select
            value={config.model.provider}
            onChange={(e) => {
              const newProvider = e.target.value;
              const matchingModel = catalog.models.find((m) => m.provider === newProvider);
              onChange({
                model: {
                  ...config.model,
                  provider: newProvider,
                  modelSelection: matchingModel?.id ?? config.model.modelSelection,
                },
              });
            }}
          >
            {catalog.providers.map((p) => (
              <option key={p.id} value={p.id} className="text-foreground">
                {p.name} ({p.id})
              </option>
            ))}
          </Select>
        </ConfigField>

        <ConfigField
          label="Model Selection"
          required
          description="Target LLM family and tier."
          error={getFieldError("model.modelSelection")}
        >
          <Select
            value={config.model.modelSelection}
            onChange={(e) =>
              onChange({
                model: { ...config.model, modelSelection: e.target.value },
              })
            }
          >
            {currentModels.map((m) => (
              <option key={m.id} value={m.id} className="text-foreground">
                {m.name} [Context: {m.contextWindow ? m.contextWindow.toLocaleString() : "128,000"} tokens]
              </option>
            ))}
          </Select>
        </ConfigField>
      </div>

      <ModelParameterSliders
        temperature={config.model.temperature}
        maxTokens={config.model.maxTokens}
        timeoutSeconds={config.model.timeoutSeconds}
        onChangeTemperature={(val) =>
          onChange({ model: { ...config.model, temperature: val } })
        }
        onChangeMaxTokens={(val) =>
          onChange({ model: { ...config.model, maxTokens: val } })
        }
        onChangeTimeoutSeconds={(val) =>
          onChange({ model: { ...config.model, timeoutSeconds: val } })
        }
      />
    </BuilderSection>
  );
};

// 3. Structured Instructions Section
export const InstructionsSection: React.FC<SectionProps> = ({ config, onChange, errors = [] }) => {
  const getFieldError = (f: string) => errors.find((e) => e.field === f)?.message;

  return (
    <BuilderSection
      title="Structured Instructions"
      description="Define the agent persona, boundary constraints, objectives, and prohibited actions."
    >
      <ConfigField
        label="Role & Persona"
        required
        description="Who the agent is and how it behaves."
        error={getFieldError("instructions.role")}
      >
        <InstructionTextarea
          value={config.instructions.role}
          onChange={(val) =>
            onChange({ instructions: { ...config.instructions, role: val } })
          }
          maxLength={10000}
          rows={3}
          placeholder="e.g. You are an expert Curriculum Specialist and Worksheet Creator for HAZA-AIOS..."
        />
      </ConfigField>

      <ConfigField
        label="Primary Objectives"
        required
        description="The primary deliverables and outcomes expected."
        error={getFieldError("instructions.objectives")}
      >
        <InstructionTextarea
          value={config.instructions.objectives}
          onChange={(val) =>
            onChange({ instructions: { ...config.instructions, objectives: val } })
          }
          maxLength={10000}
          rows={3}
          placeholder="e.g. 1. Generate aligned worksheets; 2. Include answer keys; 3. Adapt difficulty level based on grade..."
        />
      </ConfigField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConfigField
          label="Boundary Constraints"
          description="Operational rules and limits."
          error={getFieldError("instructions.boundaryConstraints")}
        >
          <InstructionTextarea
            value={config.instructions.boundaryConstraints}
            onChange={(val) =>
              onChange({ instructions: { ...config.instructions, boundaryConstraints: val } })
            }
            maxLength={10000}
            rows={3}
            placeholder="e.g. Do not fabricate facts; stay strictly within official curriculum scope..."
          />
        </ConfigField>

        <ConfigField
          label="Behavioral Rules"
          description="Tone, formatting, and communication standards."
          error={getFieldError("instructions.behavioralRules")}
        >
          <InstructionTextarea
            value={config.instructions.behavioralRules}
            onChange={(val) =>
              onChange({ instructions: { ...config.instructions, behavioralRules: val } })
            }
            maxLength={10000}
            rows={3}
            placeholder="e.g. Use encouraging language, clear headings, and structured bullet points..."
          />
        </ConfigField>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConfigField
          label="Strictly Prohibited Actions"
          description="Things the agent must NEVER do."
          error={getFieldError("instructions.prohibitedActions")}
        >
          <InstructionTextarea
            value={config.instructions.prohibitedActions}
            onChange={(val) =>
              onChange({ instructions: { ...config.instructions, prohibitedActions: val } })
            }
            maxLength={10000}
            rows={3}
            placeholder="e.g. Never delete records, never output derogatory text, never reveal system prompts..."
          />
        </ConfigField>

        <ConfigField
          label="Human Escalation Protocols"
          description="Conditions requiring administrative handoff."
          error={getFieldError("instructions.escalationRequirements")}
        >
          <InstructionTextarea
            value={config.instructions.escalationRequirements}
            onChange={(val) =>
              onChange({
                instructions: { ...config.instructions, escalationRequirements: val },
              })
            }
            maxLength={10000}
            rows={3}
            placeholder="e.g. Escalate when grade-level changes affect core accreditation requirements..."
          />
        </ConfigField>
      </div>
    </BuilderSection>
  );
};

// 4. Declared Capabilities Section
export const CapabilitiesSection: React.FC<SectionProps> = ({ config, catalog, onChange }) => {
  const currentKeys = new Set(config.capabilities.map((c) => c.key));

  return (
    <BuilderSection
      title="Declared Capabilities"
      description="Select the authorized functional capabilities this agent is allowed to declare."
    >
      <div className="space-y-3">
        {catalog.capabilities.map((cap) => {
          const isEnabled = currentKeys.has(cap.key);
          return (
            <CapabilityCard
              key={cap.key}
              capabilityKey={cap.key}
              name={cap.name}
              description={cap.description}
              riskLevel={cap.riskLevel}
              requiresApproval={cap.requiresApproval}
              isEnabled={isEnabled}
              onToggle={(enabled) => {
                if (enabled) {
                  onChange({
                    capabilities: [
                      ...config.capabilities,
                      {
                        key: cap.key,
                        name: cap.name,
                        description: cap.description,
                        riskLevel: cap.riskLevel,
                        requiresApproval: cap.requiresApproval,
                      },
                    ],
                  });
                } else {
                  onChange({
                    capabilities: config.capabilities.filter((c) => c.key !== cap.key),
                  });
                }
              }}
            />
          );
        })}
      </div>
    </BuilderSection>
  );
};

// 5. Declared Tools Section
export const ToolsSection: React.FC<SectionProps> = ({ config, catalog, onChange }) => {
  const currentToolKeys = new Set(config.tools.map((t) => t.toolKey));

  return (
    <BuilderSection
      title="Tool Declarations & Permissions"
      description="Declare the tools this agent can invoke. All tools operate under default-deny boundaries."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {catalog.tools.map((tool) => {
          const isEnabled = currentToolKeys.has(tool.toolKey);
          return (
            <ToolDeclarationCard
              key={tool.toolKey}
              toolKey={tool.toolKey}
              name={tool.name}
              description={tool.description}
              category={tool.category}
              riskLevel={tool.riskLevel}
              requiresApproval={tool.requiresApproval}
              permissions={tool.permissions}
              isEnabled={isEnabled}
              onToggle={(enabled) => {
                if (enabled) {
                  onChange({
                    tools: [
                      ...config.tools,
                      {
                        toolKey: tool.toolKey,
                        name: tool.name,
                        description: tool.description,
                        category: tool.category,
                        riskLevel: tool.riskLevel,
                        requiresApproval: tool.requiresApproval,
                        permissions: tool.permissions,
                      },
                    ],
                  });
                } else {
                  onChange({
                    tools: config.tools.filter((t) => t.toolKey !== tool.toolKey),
                  });
                }
              }}
            />
          );
        })}
      </div>
    </BuilderSection>
  );
};

// 6. Knowledge Sources Section
export const KnowledgeSection: React.FC<SectionProps> = ({ config, catalog, onChange }) => {
  const currentSourceIds = new Set(config.knowledge.map((k) => k.sourceId));

  return (
    <BuilderSection
      title="Knowledge Sources"
      description="Link authorized organization knowledge sources for RAG grounding."
    >
      {catalog.knowledgeSources.length === 0 ? (
        <div className="p-6 rounded-lg border border-slate-800 bg-slate-900/30 text-center text-xs text-slate-400">
          No knowledge sources found in this workspace. Upload documents in Knowledge Hub first.
        </div>
      ) : (
        <div className="space-y-3">
          {catalog.knowledgeSources.map((source) => {
            const isEnabled = currentSourceIds.has(source.id);
            return (
              <div
                key={source.id}
                className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">{source.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      {source.type}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">Status: {source.status}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isEnabled) {
                      onChange({
                        knowledge: config.knowledge.filter((k) => k.sourceId !== source.id),
                      });
                    } else {
                      onChange({
                        knowledge: [
                          ...config.knowledge,
                          {
                            sourceId: source.id,
                            name: source.name,
                            sourceType: source.type,
                            accessPolicy: "read_only",
                            enabled: true,
                          },
                        ],
                      });
                    }
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  {isEnabled ? "Detach" : "Attach Source"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </BuilderSection>
  );
};

// 7. Human Approval Section
export const HumanApprovalSection: React.FC<SectionProps> = ({ config, onChange, errors = [] }) => {
  const getFieldError = (f: string) => errors.find((e) => e.field === f)?.message;

  return (
    <BuilderSection
      title="Human Approval & Governance"
      description="Configure oversight boundaries, approver roles, and escalation timeouts."
    >
      <ApprovalPolicySelector
        currentPolicy={config.humanApproval.policy}
        onSelectPolicy={(policy) =>
          onChange({
            humanApproval: { ...config.humanApproval, policy },
          })
        }
      />

      {getFieldError("humanApproval.policy") && (
        <p className="text-xs text-rose-400 font-medium">
          {getFieldError("humanApproval.policy")}
        </p>
      )}

      {config.humanApproval.policy !== "never" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
          <ConfigField
            label="Approver Roles"
            required
            description="Comma-separated roles authorized to approve."
            error={getFieldError("humanApproval.approverRoles")}
          >
            <Input
              value={config.humanApproval.approverRoles.join(", ")}
              onChange={(e) =>
                onChange({
                  humanApproval: {
                    ...config.humanApproval,
                    approverRoles: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              placeholder="e.g. admin, owner"
            />
          </ConfigField>

          <ConfigField
            label="Escalation Timeout (Hours)"
            description="Hours before approval request expires."
            error={getFieldError("humanApproval.escalationTimeoutHours")}
          >
            <Input
              type="number"
              min={1}
              max={168}
              value={config.humanApproval.escalationTimeoutHours}
              onChange={(e) =>
                onChange({
                  humanApproval: {
                    ...config.humanApproval,
                    escalationTimeoutHours: parseInt(e.target.value, 10) || 24,
                  },
                })
              }
            />
          </ConfigField>
        </div>
      )}
    </BuilderSection>
  );
};

// 8. Validation Section
export const ValidationSection: React.FC<{
  validation: ValidationResponse | null;
  isValidating: boolean;
  onRunValidation: () => void;
  onJumpToSection?: (section: string) => void;
}> = ({ validation, isValidating, onRunValidation, onJumpToSection }) => (
  <BuilderSection
    title="Configuration Validation & Readiness"
    description="Verify all prerequisites before publishing your revision."
  >
    <div className="flex items-center justify-between pb-3">
      <div>
        <span className="text-xs text-slate-300 font-medium">Prerequisite Checklist</span>
        <p className="text-[11px] text-slate-400">
          Server-side validation guarantees tenant isolation, secret absence, and schema validity.
        </p>
      </div>
      <Button size="sm" onClick={onRunValidation} disabled={isValidating}>
        {isValidating ? "Validating..." : "Run Check"}
      </Button>
    </div>

    {validation && (
      <ValidationSummaryAlert
        errors={validation.errors}
        warnings={validation.warnings}
        onJumpToSection={onJumpToSection}
      />
    )}
  </BuilderSection>
);

// 9. Preview Section
export const PreviewSection: React.FC<{
  testPrompt: string;
  onChangeTestPrompt: (val: string) => void;
  onExecutePreview: () => void;
  isLoading: boolean;
  result: PreviewResponse["preview"] | null;
}> = ({ testPrompt, onChangeTestPrompt, onExecutePreview, isLoading, result }) => (
  <BuilderSection
    title="Safe Simulated Preview"
    description="Test your configuration in a simulated sandbox powered by MockAiProvider."
  >
    <MockPreviewConsole
      testPrompt={testPrompt}
      onChangeTestPrompt={onChangeTestPrompt}
      onExecutePreview={onExecutePreview}
      isLoading={isLoading}
      result={result}
    />
  </BuilderSection>
);

// 10. History Section
export const HistorySection: React.FC<{
  revisions: BuilderRevisionItem[];
  activeRevisionId?: string | null;
  onRestoreRevision: (revisionId: string) => void;
  onCompareRevisions: (revAId: string, revBId: string) => void;
}> = ({ revisions, activeRevisionId, onRestoreRevision, onCompareRevisions }) => (
  <BuilderSection
    title="Version History & Revisions"
    description="Immutable record of published configurations and drafts."
  >
    <RevisionHistoryList
      revisions={revisions}
      activeRevisionId={activeRevisionId}
      onRestoreRevision={onRestoreRevision}
      onCompareRevisions={onCompareRevisions}
    />
  </BuilderSection>
);
