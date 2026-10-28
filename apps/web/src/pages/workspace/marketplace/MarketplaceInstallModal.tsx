import React, { useState, useEffect } from "react";
import { Button } from "@haza-aios/ui/components/button";
import { Input } from "@haza-aios/ui/components/input";
import { Textarea } from "@haza-aios/ui/components/textarea";
import {
  PublisherBadge,
  VersionBadge,
  CapabilityTagList,
} from "@haza-aios/ui/components/agent-marketplace-primitives";
import { AgentService } from "../../../agents/agent-service";
import { useOrganization } from "../../../org/use-organization";
import type { AgentTemplateVersion, MarketplaceCatalogItem } from "../../../agents/agent.types";
import { X, CheckCircle2, AlertCircle, Shield, ArrowRight, Loader2 } from "lucide-react";

interface MarketplaceInstallModalProps {
  agent: MarketplaceCatalogItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (installedAgent: any) => void;
}

export const MarketplaceInstallModal: React.FC<MarketplaceInstallModalProps> = ({
  agent,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentOrganization } = useOrganization();
  const [versions, setVersions] = useState<AgentTemplateVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [agentName, setAgentName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"configure" | "confirm">("configure");

  useEffect(() => {
    if (isOpen && agent && currentOrganization) {
      setAgentName(agent.name);
      setDescription(agent.summary || agent.description);
      setSelectedVersion(agent.latestVersion);
      setStep("configure");
      setError(null);

      // Fetch versions
      setIsLoadingVersions(true);
      AgentService.getAgentTemplateVersions(currentOrganization.id, agent.id)
        .then((vList) => {
          setVersions(vList);
          if (vList.length > 0) {
            setSelectedVersion(vList[0].version);
          }
        })
        .catch(() => {
          // Fallback to latestVersion
          setVersions([]);
        })
        .finally(() => {
          setIsLoadingVersions(false);
        });
    }
  }, [isOpen, agent, currentOrganization]);

  if (!isOpen || !agent) return null;

  const currentVerObj = versions.find((v) => v.version === selectedVersion);
  const capabilities = currentVerObj?.capabilities || agent.capabilities || [];
  const requiredPermissions = currentVerObj?.requiredPermissions || [];

  const handleInstall = async () => {
    if (!currentOrganization) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // Fetch default workspace
      const defaultWorkspaceId = (currentOrganization as any).workspaces?.[0]?.id || currentOrganization.id;

      const installed = await AgentService.installMarketplaceAgent(currentOrganization.id, {
        workspaceId: defaultWorkspaceId,
        templateId: agent.id,
        version: selectedVersion,
        name: agentName.trim() || agent.name,
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
      });

      onSuccess(installed);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to install agent into organization.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
      <div className="relative w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl p-2.5 rounded-xl bg-muted/60 border border-border">
              {agent.icon || "🤖"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-foreground">{agent.name}</h3>
                <VersionBadge version={selectedVersion || agent.latestVersion} />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <PublisherBadge publisherType={agent.publisherType} />
                <span className="text-xs text-muted-foreground">• {agent.category}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "configure" ? (
          <div className="space-y-4 text-sm">
            {/* Version Selection */}
            {versions.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Target Version
                </label>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  disabled={isLoadingVersions}
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      v{v.version} {v.version === agent.latestVersion ? "(Latest)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Instance Name
              </label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Agent display name"
                className="h-10"
              />
            </div>

            {/* Custom Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of how this agent is used"
                className="h-10"
              />
            </div>

            {/* Custom Instructions (Optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Custom Instructions <span className="text-muted-foreground/60 font-normal">(Optional)</span>
              </label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Add organization-specific guidelines or constraints..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Capabilities Summary */}
            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/40 space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Declared Capabilities
              </span>
              <CapabilityTagList capabilities={capabilities} limit={6} />
            </div>

            {/* Permissions Notice */}
            {requiredPermissions.length > 0 && (
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  Required Permissions
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {requiredPermissions.map((perm) => (
                    <span
                      key={perm}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-muted text-muted-foreground border border-border"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={() => setStep("confirm")} className="gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 text-sm">
            {/* Confirmation details */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Shield className="h-4 w-4" />
                <span>Governance & Installation Policy</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
                <li>
                  Agent will be installed into <strong>{currentOrganization?.name || "your organization"}</strong> in an <strong>active</strong> state.
                </li>
                <li>
                  Installed version: <strong>v{selectedVersion}</strong>. Upgrades are explicit and require manual approval.
                </li>
                <li>
                  No undeclared permissions or automatic autonomous actions are granted.
                </li>
                <li>
                  An immutable installation audit event will be recorded under your account.
                </li>
              </ul>
            </div>

            <div className="p-3.5 rounded-xl border border-border space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Display Name:</span>
                <span className="font-semibold text-foreground">{agentName || agent.name}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Selected Version:</span>
                <span className="font-mono text-foreground">v{selectedVersion}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Publisher:</span>
                <span className="text-foreground capitalize">{agent.publisherType}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="ghost" onClick={() => setStep("configure")} disabled={isSubmitting}>
                Back
              </Button>
              <Button onClick={handleInstall} disabled={isSubmitting} className="gap-2 min-w-[140px]">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm & Install
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
