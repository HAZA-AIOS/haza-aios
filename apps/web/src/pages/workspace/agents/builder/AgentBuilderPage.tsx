import React, { useEffect, useState, useMemo } from "react";
import { usePathname, navigate } from "../../../../routes/navigation";
import { useOrganization } from "../../../../org/use-organization";
import { AppShell } from "../../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import {
  BuilderContainer,
  BuilderSidebar,
  BuilderNavItem,
  BuilderContent,
  BuilderHeaderBar,
} from "@haza-aios/ui/components/agent-builder-primitives";
import {
  IdentitySection,
  ModelSection,
  InstructionsSection,
  CapabilitiesSection,
  ToolsSection,
  KnowledgeSection,
  HumanApprovalSection,
  ValidationSection,
  PreviewSection,
  HistorySection,
} from "./AgentBuilderSections";
import {
  AgentBuilderApiClient,
  type AgentBuilderFullConfig,
  type BuilderCatalogOptions,
  type BuilderRevisionItem,
  type PreviewResponse,
  type RevisionDiffItem,
  type ValidationResponse,
} from "../../../../agents/agent-builder-service";

type BuilderTab =
  | "identity"
  | "model"
  | "instructions"
  | "capabilities"
  | "tools"
  | "knowledge"
  | "approval"
  | "validation"
  | "preview"
  | "history";

const TABS: Array<{ key: BuilderTab; label: string; icon: string }> = [
  { key: "identity", label: "1. Identity", icon: "🆔" },
  { key: "model", label: "2. Model & Settings", icon: "⚙️" },
  { key: "instructions", label: "3. Instructions", icon: "📝" },
  { key: "capabilities", label: "4. Capabilities", icon: "⚡" },
  { key: "tools", label: "5. Tools & Permissions", icon: "🛠️" },
  { key: "knowledge", label: "6. Knowledge Sources", icon: "📚" },
  { key: "approval", label: "7. Human Approval", icon: "🛡️" },
  { key: "validation", label: "8. Validation", icon: "✅" },
  { key: "preview", label: "9. Safe Preview", icon: "🧪" },
  { key: "history", label: "10. Version History", icon: "📜" },
];

const DEFAULT_BLANK_CONFIG: AgentBuilderFullConfig = {
  identity: {
    name: "",
    agentKey: "",
    description: "",
    category: "General",
    icon: "🤖",
    tags: [],
  },
  model: {
    provider: "mock",
    modelSelection: "mock-gpt-4o",
    temperature: 0.7,
    maxTokens: 2048,
    timeoutSeconds: 60,
  },
  instructions: {
    role: "",
    objectives: "",
    boundaryConstraints: "",
    behavioralRules: "",
    outputFormat: "Markdown",
    prohibitedActions: "",
    escalationRequirements: "",
    systemInstructions: "",
  },
  capabilities: [],
  tools: [],
  knowledge: [],
  humanApproval: {
    policy: "risk_threshold",
    riskThreshold: "high",
    approverRoles: ["admin", "owner"],
    escalationTimeoutHours: 24,
    fallbackAction: "deny",
    sensitiveCapabilities: [],
  },
};

export const AgentBuilderPage: React.FC = () => {
  const pathname = usePathname();
  const { currentOrganization } = useOrganization();

  // Parse path: e.g. /workspace/agents/:id/builder or /workspace/agents/builder/new
  const pathParts = pathname.split("/");
  const isCreateNew = pathname.includes("/new") || pathParts[3] === "builder";
  const agentId = isCreateNew ? undefined : pathParts[3];

  const [activeTab, setActiveTab] = useState<BuilderTab>("identity");
  const [catalog, setCatalog] = useState<BuilderCatalogOptions | null>(null);
  const [configDraft, setConfigDraft] = useState<AgentBuilderFullConfig>(DEFAULT_BLANK_CONFIG);
  const [initialConfig, setInitialConfig] = useState<AgentBuilderFullConfig>(DEFAULT_BLANK_CONFIG);
  const [agentData, setAgentData] = useState<any>(null);
  const [activeRev, setActiveRev] = useState<BuilderRevisionItem | null>(null);
  const [revisions, setRevisions] = useState<BuilderRevisionItem[]>([]);

  // Workflow states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);

  // Preview state
  const [testPrompt, setTestPrompt] = useState("");
  const [previewResult, setPreviewResult] = useState<PreviewResponse["preview"] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Modals state
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishVersion, setPublishVersion] = useState("1.0.0");
  const [publishChangelog, setPublishChangelog] = useState("");

  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateKey, setDuplicateKey] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);

  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [diffComparison, setDiffComparison] = useState<{
    base: BuilderRevisionItem;
    target: BuilderRevisionItem;
    diffs: RevisionDiffItem[];
  } | null>(null);

  // Dirty detection
  const hasChanges = useMemo(() => {
    return JSON.stringify(configDraft) !== JSON.stringify(initialConfig);
  }, [configDraft, initialConfig]);

  // Load initial context
  useEffect(() => {
    if (!currentOrganization) return;
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      try {
        const cat = await AgentBuilderApiClient.getCatalogOptions(currentOrganization!.id);
        if (cancelled) return;
        setCatalog(cat);

        if (agentId && !isCreateNew) {
          const ctx = await AgentBuilderApiClient.getBuilderContext(
            currentOrganization!.id,
            agentId,
          );
          if (cancelled) return;
          setAgentData(ctx.agent);
          setActiveRev(ctx.activeRevision);

          const draft = ctx.draftRevision?.configuration ?? ctx.activeRevision?.configuration ?? DEFAULT_BLANK_CONFIG;
          setConfigDraft(JSON.parse(JSON.stringify(draft)));
          setInitialConfig(JSON.parse(JSON.stringify(draft)));

          if (ctx.activeRevision?.version) {
            const nextSemver = incrementPatchVersion(ctx.activeRevision.version);
            setPublishVersion(nextSemver);
          }

          // Fetch revision history
          const revs = await AgentBuilderApiClient.listRevisions(
            currentOrganization!.id,
            agentId,
          );
          if (cancelled) return;
          setRevisions(revs.items);
        } else {
          // Initialize blank new draft with default catalog values
          const blank = JSON.parse(JSON.stringify(DEFAULT_BLANK_CONFIG));
          if (cat.providers.length > 0) blank.model.provider = cat.providers[0].id;
          if (cat.models.length > 0) blank.model.modelSelection = cat.models[0].id;
          setConfigDraft(blank);
          setInitialConfig(blank);
        }
      } catch (err) {
        console.error("Failed to load builder context:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization, agentId, isCreateNew]);

  // Handlers
  const handleConfigChange = (updates: Partial<AgentBuilderFullConfig>) => {
    setConfigDraft((prev) => ({ ...prev, ...updates }));
  };

  const handleDiscardChanges = () => {
    setConfigDraft(JSON.parse(JSON.stringify(initialConfig)));
  };

  const handleRunValidation = async () => {
    if (!currentOrganization) return;
    setIsValidating(true);
    try {
      const outcome = await AgentBuilderApiClient.validateConfiguration(
        currentOrganization.id,
        agentId || "00000000-0000-0000-0000-000000000000",
        configDraft,
      );
      setValidation(outcome);
      setActiveTab("validation");
    } catch (err: any) {
      console.error("Validation error:", err);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!currentOrganization || !agentId) return;
    setIsSaving(true);
    try {
      const res = await AgentBuilderApiClient.saveDraft(
        currentOrganization.id,
        agentId,
        configDraft,
        publishVersion ? `${publishVersion}-draft` : undefined,
        "Draft saved from visual builder",
      );
      setInitialConfig(JSON.parse(JSON.stringify(configDraft)));
      setValidation(res.validation);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishRevision = async () => {
    if (!currentOrganization || !agentId) return;
    setIsPublishing(true);
    try {
      // Save draft first to ensure state is synchronized
      await AgentBuilderApiClient.saveDraft(
        currentOrganization.id,
        agentId,
        configDraft,
        `${publishVersion}-draft`,
        publishChangelog || "Pre-publish update",
      );

      const res = await AgentBuilderApiClient.publishRevision(
        currentOrganization.id,
        agentId,
        publishVersion,
        publishChangelog || "Published via visual builder",
      );

      setActiveRev(res.revision);
      setAgentData(res.agent);
      setInitialConfig(JSON.parse(JSON.stringify(configDraft)));
      setPublishModalOpen(false);

      // Refresh revisions list
      const revs = await AgentBuilderApiClient.listRevisions(currentOrganization.id, agentId);
      setRevisions(revs.items);

      alert(`Revision ${res.revision.version} (#${res.revision.revisionNumber}) published successfully!`);
    } catch (err: any) {
      alert(`Publish failed: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDuplicate = async () => {
    if (!currentOrganization || !agentId || !agentData) return;
    setIsDuplicating(true);
    try {
      const res = await AgentBuilderApiClient.duplicateAgent(
        currentOrganization.id,
        agentData.workspaceId,
        agentId,
        duplicateName,
        duplicateKey,
      );
      setDuplicateModalOpen(false);
      navigate(`/workspace/agents/${res.agent.id}/builder`);
    } catch (err: any) {
      alert(`Duplication failed: ${err.message}`);
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleRestoreRevision = async (revId: string) => {
    if (!currentOrganization || !agentId) return;
    if (!confirm("Restore this revision into your working draft? Any unsaved edits will be replaced.")) {
      return;
    }
    try {
      const res = await AgentBuilderApiClient.restoreRevision(
        currentOrganization.id,
        agentId,
        revId,
      );
      setConfigDraft(JSON.parse(JSON.stringify(res.revision.configuration)));
      alert(`Revision #${res.revision.revisionNumber} restored to draft.`);
    } catch (err: any) {
      alert(`Restore failed: ${err.message}`);
    }
  };

  const handleCompareRevisions = async (revAId: string, revBId: string) => {
    if (!currentOrganization || !agentId) return;
    try {
      const res = await AgentBuilderApiClient.compareRevisions(
        currentOrganization.id,
        agentId,
        revAId,
        revBId,
      );
      setDiffComparison({
        base: res.baseRevision,
        target: res.targetRevision,
        diffs: res.diffs,
      });
      setCompareModalOpen(true);
    } catch (err: any) {
      alert(`Comparison failed: ${err.message}`);
    }
  };

  const handleExecutePreview = async () => {
    if (!currentOrganization) return;
    setIsSimulating(true);
    try {
      const res = await AgentBuilderApiClient.executeMockPreview(
        currentOrganization.id,
        agentId || "00000000-0000-0000-0000-000000000000",
        testPrompt,
        configDraft,
      );
      setPreviewResult(res.preview);
    } catch (err: any) {
      alert(`Preview failed: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  if (isLoading || !catalog) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-slate-950 text-slate-400 text-sm">
          Loading AI Agent Builder...
        </div>
      </AppShell>
    );
  }

  // Count errors per section to show in tab badges
  const errorsBySection = (validation?.errors ?? []).reduce((acc, err) => {
    const sec = err.section || "root";
    acc[sec] = (acc[sec] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AppShell>
      <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-950">
        {/* Top Action Bar */}
        <BuilderHeaderBar
          title={configDraft.identity.name || "Untitled Agent"}
          subtitle={`Key: ${configDraft.identity.agentKey || "unassigned"} • Active Version: ${activeRev?.version || "1.0.0"}`}
          statusBadge={
            hasChanges ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Unsaved Draft Edits
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Synchronized
              </span>
            )
          }
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(agentId ? `/workspace/agents/${agentId}` : "/workspace/agents")}
                className="text-xs text-slate-400 hover:text-slate-100"
              >
                &larr; Exit
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasChanges}
                onClick={handleDiscardChanges}
                className="text-xs"
              >
                Discard
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunValidation}
                disabled={isValidating}
                className="text-xs"
              >
                {isValidating ? "Checking..." : "Validate"}
              </Button>
              {agentId && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasChanges || isSaving}
                    onClick={handleSaveDraft}
                    className="text-xs"
                  >
                    {isSaving ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDuplicateName(`${configDraft.identity.name} Copy`);
                      setDuplicateKey(`${configDraft.identity.agentKey}_copy`);
                      setDuplicateModalOpen(true);
                    }}
                    className="text-xs"
                  >
                    Duplicate
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setPublishModalOpen(true);
                    }}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500"
                  >
                    Publish Revision
                  </Button>
                </>
              )}
            </>
          }
        />

        {/* Builder Main Grid */}
        <BuilderContainer>
          {/* Left Navigation Sidebar */}
          <BuilderSidebar>
            <div className="space-y-1">
              <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase px-3 pb-1 block">
                Builder Sections
              </span>
              {TABS.map((tab) => {
                const count = errorsBySection[tab.key] || 0;
                return (
                  <BuilderNavItem
                    key={tab.key}
                    label={tab.label}
                    sectionKey={tab.key}
                    icon={tab.icon}
                    isActive={activeTab === tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    badgeCount={count}
                    badgeSeverity="error"
                  />
                );
              })}
            </div>

            <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 space-y-1 text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 block">Governance Checklist</span>
              <p>Default-deny security model active. High-risk actions require designated administrative approval.</p>
            </div>
          </BuilderSidebar>

          {/* Center Main Work Content */}
          <BuilderContent>
            {activeTab === "identity" && (
              <IdentitySection
                config={configDraft}
                catalog={catalog}
                onChange={handleConfigChange}
                errors={validation?.errors}
              />
            )}

            {activeTab === "model" && (
              <ModelSection
                config={configDraft}
                catalog={catalog}
                onChange={handleConfigChange}
                errors={validation?.errors}
              />
            )}

            {activeTab === "instructions" && (
              <InstructionsSection
                config={configDraft}
                catalog={catalog}
                onChange={handleConfigChange}
                errors={validation?.errors}
              />
            )}

            {activeTab === "capabilities" && (
              <CapabilitiesSection
                config={configDraft}
                catalog={catalog}
                onChange={handleConfigChange}
                errors={validation?.errors}
              />
            )}

            {activeTab === "tools" && (
              <ToolsSection
                config={configDraft}
                catalog={catalog}
                onChange={handleConfigChange}
                errors={validation?.errors}
              />
            )}

            {activeTab === "knowledge" && (
              <KnowledgeSection
                config={configDraft}
                catalog={catalog}
                onChange={handleConfigChange}
                errors={validation?.errors}
              />
            )}

            {activeTab === "approval" && (
              <HumanApprovalSection
                config={configDraft}
                catalog={catalog}
                onChange={handleConfigChange}
                errors={validation?.errors}
              />
            )}

            {activeTab === "validation" && (
              <ValidationSection
                validation={validation}
                isValidating={isValidating}
                onRunValidation={handleRunValidation}
                onJumpToSection={(sec) => {
                  const match = TABS.find((t) => t.key === sec);
                  if (match) setActiveTab(match.key);
                }}
              />
            )}

            {activeTab === "preview" && (
              <PreviewSection
                testPrompt={testPrompt}
                onChangeTestPrompt={setTestPrompt}
                onExecutePreview={handleExecutePreview}
                isLoading={isSimulating}
                result={previewResult}
              />
            )}

            {activeTab === "history" && (
              <HistorySection
                revisions={revisions}
                activeRevisionId={activeRev?.id}
                onRestoreRevision={handleRestoreRevision}
                onCompareRevisions={handleCompareRevisions}
              />
            )}
          </BuilderContent>
        </BuilderContainer>
      </div>

      {/* Publish Modal */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Publish Immutable Revision</h3>
              <p className="text-xs text-slate-400 mt-1">
                This creates an immutable snapshot of your agent configuration and activates it across the workspace.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Semantic Version</label>
                <input
                  type="text"
                  value={publishVersion}
                  onChange={(e) => setPublishVersion(e.target.value)}
                  placeholder="e.g. 1.1.0"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Changelog / Release Notes</label>
                <textarea
                  value={publishChangelog}
                  onChange={(e) => setPublishChangelog(e.target.value)}
                  rows={3}
                  placeholder="Describe what changed in this revision..."
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPublishModalOpen(false)}
                disabled={isPublishing}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePublishRevision}
                disabled={isPublishing || !publishVersion.trim()}
                className="bg-indigo-600 hover:bg-indigo-500"
              >
                {isPublishing ? "Publishing..." : "Confirm & Publish"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Modal */}
      {duplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-base font-semibold text-slate-100">Duplicate Agent Configuration</h3>
              <p className="text-xs text-slate-400 mt-1">
                Creates an independent custom agent initialized with this configuration snapshot.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300">New Agent Name</label>
                <input
                  type="text"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">New Agent Key</label>
                <input
                  type="text"
                  value={duplicateKey}
                  onChange={(e) =>
                    setDuplicateKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_"))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDuplicateModalOpen(false)}
                disabled={isDuplicating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDuplicate}
                disabled={isDuplicating || !duplicateName.trim() || !duplicateKey.trim()}
                className="bg-indigo-600 hover:bg-indigo-500"
              >
                {isDuplicating ? "Cloning..." : "Clone Agent"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Compare Revisions Modal */}
      {compareModalOpen && diffComparison && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-semibold text-slate-100">Revision Diff Comparison</h3>
                <p className="text-xs text-slate-400">
                  Comparing Rev #{diffComparison.base.revisionNumber} ({diffComparison.base.version}) &rarr; Rev #{diffComparison.target.revisionNumber} ({diffComparison.target.version})
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCompareModalOpen(false)}>
                ✕
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {diffComparison.diffs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No structural differences detected between these revisions.
                </div>
              ) : (
                diffComparison.diffs.map((d, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-800 bg-slate-950 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-indigo-300 font-semibold">{d.path}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          d.action === "added"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : d.action === "removed"
                              ? "bg-rose-500/20 text-rose-300"
                              : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {d.action.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
                      <div className="p-2 rounded bg-rose-950/20 text-rose-300 border border-rose-900/40 truncate">
                        - {JSON.stringify(d.before)}
                      </div>
                      <div className="p-2 rounded bg-emerald-950/20 text-emerald-300 border border-emerald-900/40 truncate">
                        + {JSON.stringify(d.after)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

function incrementPatchVersion(version: string): string {
  const parts = version.replace(/-.*$/, "").split(".");
  if (parts.length === 3) {
    const patch = parseInt(parts[2], 10);
    if (!isNaN(patch)) {
      return `${parts[0]}.${parts[1]}.${patch + 1}`;
    }
  }
  return "1.0.1";
}
