import React from "react";
import { BuilderSection, ConfigField } from "@haza-aios/ui/components/agent-builder-primitives";
import { Input } from "@haza-aios/ui/components/input";
import { Textarea } from "@haza-aios/ui/components/textarea";
import { Select } from "@haza-aios/ui/components/select";
import { Switch } from "@haza-aios/ui/components/switch";
import { Button } from "@haza-aios/ui/components/button";
import type { AgentConfiguration } from "../../../../agents/agent.types";

interface SectionProps {
  config: AgentConfiguration;
  onChange: (updates: Partial<AgentConfiguration>) => void;
}

export const GeneralSettings: React.FC<SectionProps> = ({ config, onChange }) => (
  <BuilderSection title="General" description="Basic identity settings for this agent instance.">
    <ConfigField
      label="Description"
      description="Describe what this agent does within your organization."
    >
      <Textarea
        value={config.general.description}
        onChange={(e) => onChange({ general: { ...config.general, description: e.target.value } })}
        rows={3}
      />
    </ConfigField>
  </BuilderSection>
);

export const InstructionsEditor: React.FC<SectionProps> = ({ config, onChange }) => (
  <BuilderSection
    title="Instructions"
    description="Define how the agent should behave and what it should prioritize."
  >
    <ConfigField
      label="System Instructions"
      description="The core prompt that guides the agent's behavior."
    >
      <Textarea
        value={config.instructions.systemInstructions}
        onChange={(e) =>
          onChange({ instructions: { ...config.instructions, systemInstructions: e.target.value } })
        }
        rows={6}
        placeholder="You are an AI assistant..."
      />
    </ConfigField>
    <ConfigField label="Objectives" description="What are the specific goals of this agent?">
      <Textarea
        value={config.instructions.objectives}
        onChange={(e) =>
          onChange({ instructions: { ...config.instructions, objectives: e.target.value } })
        }
        rows={3}
      />
    </ConfigField>
    <ConfigField label="Constraints" description="What should the agent avoid doing?">
      <Textarea
        value={config.instructions.constraints}
        onChange={(e) =>
          onChange({ instructions: { ...config.instructions, constraints: e.target.value } })
        }
        rows={3}
      />
    </ConfigField>
  </BuilderSection>
);

export const BehaviorSettings: React.FC<SectionProps> = ({ config, onChange }) => (
  <BuilderSection title="Behavior" description="Tune the tone and communication style.">
    <div className="grid grid-cols-2 gap-4">
      <ConfigField label="Tone">
        <Select
          value={config.behavior.tone}
          onChange={(e) => onChange({ behavior: { ...config.behavior, tone: e.target.value } })}
        >
          <option className="text-foreground" value="Neutral">
            Neutral
          </option>
          <option className="text-foreground" value="Professional">
            Professional
          </option>
          <option className="text-foreground" value="Friendly">
            Friendly
          </option>
          <option className="text-foreground" value="Authoritative">
            Authoritative
          </option>
        </Select>
      </ConfigField>
      <ConfigField label="Formality">
        <Select
          value={config.behavior.formality}
          onChange={(e) =>
            onChange({ behavior: { ...config.behavior, formality: e.target.value } })
          }
        >
          <option className="text-foreground" value="Standard">
            Standard
          </option>
          <option className="text-foreground" value="Casual">
            Casual
          </option>
          <option className="text-foreground" value="Strict">
            Strict
          </option>
        </Select>
      </ConfigField>
      <ConfigField label="Response Length">
        <Select
          value={config.behavior.responseLength}
          onChange={(e) =>
            onChange({ behavior: { ...config.behavior, responseLength: e.target.value } })
          }
        >
          <option className="text-foreground" value="Concise">
            Concise
          </option>
          <option className="text-foreground" value="Medium">
            Medium
          </option>
          <option className="text-foreground" value="Detailed">
            Detailed
          </option>
        </Select>
      </ConfigField>
      <ConfigField label="Language">
        <Input
          value={config.behavior.language}
          onChange={(e) => onChange({ behavior: { ...config.behavior, language: e.target.value } })}
        />
      </ConfigField>
      <div className="col-span-2">
        <ConfigField
          label="Creativity (Temperature)"
          description="0 is strict, 100 is highly creative."
        >
          <input
            type="range"
            min="0"
            max="100"
            value={config.behavior.creativity}
            onChange={(e) =>
              onChange({ behavior: { ...config.behavior, creativity: parseInt(e.target.value) } })
            }
            className="w-full"
          />
        </ConfigField>
      </div>
    </div>
  </BuilderSection>
);

export const InputsConfig: React.FC<SectionProps> = ({ config, onChange }) => {
  const addInput = () => {
    onChange({
      inputs: [
        ...config.inputs,
        {
          id: `input_${Date.now()}`,
          name: "New Input",
          label: "New Input",
          description: "",
          type: "Text",
          required: false,
        },
      ],
    });
  };

  return (
    <BuilderSection
      title="Inputs"
      description="Define the data fields this agent accepts when run."
    >
      {config.inputs.map((input, idx) => (
        <div key={input.id} className="bg-muted/50 space-y-4 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{input.name}</h4>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive h-8"
              onClick={() => {
                const newInputs = [...config.inputs];
                newInputs.splice(idx, 1);
                onChange({ inputs: newInputs });
              }}
            >
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ConfigField label="Name (Key)">
              <Input
                value={input.name}
                onChange={(e) => {
                  const newInputs = [...config.inputs];
                  newInputs[idx].name = e.target.value;
                  onChange({ inputs: newInputs });
                }}
              />
            </ConfigField>
            <ConfigField label="Label (Display)">
              <Input
                value={input.label}
                onChange={(e) => {
                  const newInputs = [...config.inputs];
                  newInputs[idx].label = e.target.value;
                  onChange({ inputs: newInputs });
                }}
              />
            </ConfigField>
            <ConfigField label="Type">
              <Select
                value={input.type}
                onChange={(e) => {
                  const newInputs = [...config.inputs];
                  newInputs[idx].type = e.target.value as any;
                  onChange({ inputs: newInputs });
                }}
              >
                <option className="text-foreground" value="Text">
                  Text
                </option>
                <option className="text-foreground" value="Number">
                  Number
                </option>
                <option className="text-foreground" value="Boolean">
                  Boolean
                </option>
                <option className="text-foreground" value="Date">
                  Date
                </option>
                <option className="text-foreground" value="Select">
                  Select
                </option>
              </Select>
            </ConfigField>
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                aria-checked={input.required}
                onClick={() => {
                  const newInputs = [...config.inputs];
                  newInputs[idx].required = !input.required;
                  onChange({ inputs: newInputs });
                }}
              />
              <label className="text-sm font-medium">Required field</label>
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={addInput}>
        + Add Input
      </Button>
    </BuilderSection>
  );
};

export const OutputsConfig: React.FC<SectionProps> = ({ config, onChange }) => {
  const addOutput = () => {
    onChange({
      outputs: [
        ...config.outputs,
        {
          id: `output_${Date.now()}`,
          name: "New Output",
          description: "",
          type: "string",
          format: "Text",
          required: true,
        },
      ],
    });
  };

  return (
    <BuilderSection title="Outputs" description="Define what data formats this agent returns.">
      {config.outputs.map((output, idx) => (
        <div key={output.id} className="bg-muted/50 space-y-4 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{output.name}</h4>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive h-8"
              onClick={() => {
                const newOutputs = [...config.outputs];
                newOutputs.splice(idx, 1);
                onChange({ outputs: newOutputs });
              }}
            >
              Remove
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ConfigField label="Name (Key)">
              <Input
                value={output.name}
                onChange={(e) => {
                  const newOutputs = [...config.outputs];
                  newOutputs[idx].name = e.target.value;
                  onChange({ outputs: newOutputs });
                }}
              />
            </ConfigField>
            <ConfigField label="Format">
              <Select
                value={output.format}
                onChange={(e) => {
                  const newOutputs = [...config.outputs];
                  newOutputs[idx].format = e.target.value as any;
                  onChange({ outputs: newOutputs });
                }}
              >
                <option className="text-foreground" value="Text">
                  Text
                </option>
                <option className="text-foreground" value="JSON">
                  JSON
                </option>
                <option className="text-foreground" value="Table">
                  Table
                </option>
              </Select>
            </ConfigField>
          </div>
        </div>
      ))}
      <Button variant="outline" onClick={addOutput}>
        + Add Output
      </Button>
    </BuilderSection>
  );
};

import { ToolRegistry } from "../../../../agents/runtime/tools/ToolRegistry";
// Ensure tools are registered
import "../../../../modules/education/tools/education-tools";

export const ToolsConfig: React.FC<SectionProps> = ({ config, onChange }) => {
  const availableTools = ToolRegistry.getAllTools();

  return (
    <BuilderSection
      title="Tools"
      description="Select the external tools this agent is authorized to use."
    >
      <div className="space-y-3">
        {availableTools.map((tool) => {
          const isEnabled = config.tools.includes(tool.id);
          return (
            <div key={tool.id} className="flex items-center justify-between rounded-md border p-4">
              <div>
                <h4 className="flex items-center gap-2 font-medium">
                  {tool.name}
                  <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-[10px] tracking-wider uppercase">
                    {tool.category}
                  </span>
                </h4>
                <p className="text-muted-foreground text-sm">{tool.description}</p>
              </div>
              <Switch
                aria-checked={isEnabled}
                onClick={() => {
                  let newTools = [...config.tools];
                  if (!isEnabled) newTools.push(tool.id);
                  else newTools = newTools.filter((t) => t !== tool.id);
                  onChange({ tools: newTools });
                }}
              />
            </div>
          );
        })}
      </div>
    </BuilderSection>
  );
};

import { KnowledgeService } from "../../../../agents/runtime/knowledge/KnowledgeService";
import { useOrganization } from "@/org/use-organization";
import type { KnowledgeSource } from "../../../../agents/agent.types";

export const KnowledgeConfig: React.FC<SectionProps> = ({ config, onChange }) => {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id;
  const [sources, setSources] = React.useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [name, setName] = React.useState("");
  const [content, setContent] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError("");
      setSources([]);
      try {
        const result = organizationId
          ? await KnowledgeService.getKnowledgeSources(organizationId)
          : [];
        if (active) setSources(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Knowledge could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [organizationId]);

  const addSource = async () => {
    if (!organizationId || saving) return;
    setSaving(true);
    setError("");
    try {
      const source = await KnowledgeService.create(organizationId, {
        name,
        content,
        type: "text",
        description: "",
      });
      setSources((previous) => [...previous, source]);
      setName("");
      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BuilderSection
      title="Knowledge"
      description="Select the organizational knowledge sources this agent is authorized to retrieve."
    >
      {error && (
        <p role="alert" className="text-red-400">
          {error}
        </p>
      )}
      <div className="mb-4 grid gap-3">
        <label className="grid gap-1">
          Source name
          <input
            className="rounded border p-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={200}
          />
        </label>
        <label className="grid gap-1">
          Document text
          <textarea
            className="min-h-32 rounded border p-2"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={12000}
          />
        </label>
        <button
          type="button"
          className="justify-self-start rounded border px-4 py-2 disabled:opacity-50"
          disabled={!name.trim() || !content.trim() || saving || !organizationId}
          onClick={addSource}
        >
          {saving ? "Saving..." : "Add source"}
        </button>
      </div>
      {loading ? (
        <div className="text-sm text-slate-400">Loading knowledge sources...</div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => {
            const isEnabled = config.knowledge && config.knowledge.includes(source.id);
            return (
              <div
                key={source.id}
                className="flex items-center justify-between rounded-md border p-4"
              >
                <div>
                  <h4 className="flex items-center gap-2 font-medium">
                    {source.name}
                    <span className="rounded bg-purple-500/10 px-2 py-0.5 text-[10px] tracking-wider text-purple-400 uppercase">
                      {source.type}
                    </span>
                  </h4>
                  <p className="text-muted-foreground text-sm">{source.description}</p>
                </div>
                <Switch
                  aria-label={`Use ${source.name}`}
                  aria-checked={isEnabled}
                  onClick={() => {
                    let newKnowledge = [...(config.knowledge || [])];
                    if (!isEnabled) newKnowledge.push(source.id);
                    else newKnowledge = newKnowledge.filter((id) => id !== source.id);
                    onChange({ knowledge: newKnowledge });
                  }}
                />
              </div>
            );
          })}
          {sources.length === 0 && (
            <div className="text-sm text-slate-400 italic">
              No authorized knowledge sources found in your organization.
            </div>
          )}
        </div>
      )}
    </BuilderSection>
  );
};

export const ModelMemorySettings: React.FC<SectionProps> = ({ config, onChange }) => (
  <div className="space-y-12">
    <BuilderSection title="Model Configuration" description="AI provider neutral settings.">
      <div className="grid grid-cols-2 gap-4">
        <ConfigField label="Provider">
          <Select
            value={config.model.provider}
            onChange={(e) => onChange({ model: { ...config.model, provider: e.target.value } })}
          >
            <option className="text-foreground" value="Platform Default">
              Platform Default
            </option>
            <option className="text-foreground" value="Anthropic">
              Anthropic
            </option>
            <option className="text-foreground" value="OpenAI">
              OpenAI
            </option>
            <option className="text-foreground" value="Google">
              Google
            </option>
          </Select>
        </ConfigField>
        <ConfigField label="Response Quality">
          <Select
            value={config.model.responseQuality}
            onChange={(e) =>
              onChange({ model: { ...config.model, responseQuality: e.target.value } })
            }
          >
            <option className="text-foreground" value="Fast">
              Fast (Latency Optimized)
            </option>
            <option className="text-foreground" value="Balanced">
              Balanced
            </option>
            <option className="text-foreground" value="High">
              High (Quality Optimized)
            </option>
          </Select>
        </ConfigField>
      </div>
    </BuilderSection>
    <BuilderSection title="Memory Settings" description="Configure persistent knowledge bounds.">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <div className="font-medium">Enable Memory</div>
            <div className="text-muted-foreground text-sm">
              Allow agent to retain state across sessions
            </div>
          </div>
          <Switch
            aria-checked={config.memory.enabled}
            onClick={() =>
              onChange({ memory: { ...config.memory, enabled: !config.memory.enabled } })
            }
          />
        </div>
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <div className="font-medium">Organization Knowledge</div>
            <div className="text-muted-foreground text-sm">
              Inject RAG context from Workspace data
            </div>
          </div>
          <Switch
            aria-checked={config.memory.organizationKnowledgeFoundation}
            onClick={() =>
              onChange({
                memory: {
                  ...config.memory,
                  organizationKnowledgeFoundation: !config.memory.organizationKnowledgeFoundation,
                },
              })
            }
          />
        </div>
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <div className="font-medium">Conversation Context</div>
            <div className="text-muted-foreground text-sm">
              Include recent messages in prompt context
            </div>
          </div>
          <Switch
            aria-checked={config.memory.conversationContext}
            onClick={() =>
              onChange({
                memory: {
                  ...config.memory,
                  conversationContext: !config.memory.conversationContext,
                },
              })
            }
          />
        </div>
        <div className="flex items-center justify-between pb-2">
          <div>
            <div className="font-medium">Persistent Memory Extraction</div>
            <div className="text-muted-foreground text-sm">
              Automatically extract and save user preferences from chat
            </div>
          </div>
          <Switch
            aria-checked={config.memory.persistentMemory}
            onClick={() =>
              onChange({
                memory: { ...config.memory, persistentMemory: !config.memory.persistentMemory },
              })
            }
          />
        </div>
      </div>
    </BuilderSection>
  </div>
);
