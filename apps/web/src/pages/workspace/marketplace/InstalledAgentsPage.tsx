import React, { useState } from "react";
import { AppShell } from "../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import { Input } from "@haza-aios/ui/components/input";
import {
  VersionBadge,
  PublisherBadge,
  UpgradeNoticeBadge,
} from "@haza-aios/ui/components/agent-marketplace-primitives";
import { useInstalledMarketplaceAgents } from "../../../agents/use-agents";
import { navigate } from "../../../routes/navigation";
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import type { InstalledAgentItem } from "../../../agents/agent.types";

export const InstalledAgentsPage: React.FC = () => {
  const { installedAgents, isLoading, error, fetchInstalled, upgradeAgent, uninstallAgent } =
    useInstalledMarketplaceAgents();

  const [search, setSearch] = useState("");
  const [selectedAgentForUpgrade, setSelectedAgentForUpgrade] = useState<InstalledAgentItem | null>(
    null,
  );
  const [selectedAgentForUninstall, setSelectedAgentForUninstall] =
    useState<InstalledAgentItem | null>(null);
  const [uninstallReason, setUninstallReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filtered = installedAgents.filter((agent) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      agent.agentName.toLowerCase().includes(term) ||
      agent.templateName.toLowerCase().includes(term) ||
      agent.category.toLowerCase().includes(term)
    );
  });

  const handleConfirmUpgrade = async () => {
    if (!selectedAgentForUpgrade) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await upgradeAgent(
        selectedAgentForUpgrade.agentDefinitionId,
        selectedAgentForUpgrade.latestTemplateVersion,
      );
      setActionSuccess(
        `Agent '${selectedAgentForUpgrade.agentName}' successfully upgraded to v${selectedAgentForUpgrade.latestTemplateVersion}.`,
      );
      setSelectedAgentForUpgrade(null);
    } catch (err: any) {
      setActionError(err.message || "Failed to upgrade agent.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmUninstall = async () => {
    if (!selectedAgentForUninstall) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await uninstallAgent(selectedAgentForUninstall.agentDefinitionId, uninstallReason.trim() || undefined);
      setActionSuccess(`Agent '${selectedAgentForUninstall.agentName}' has been uninstalled.`);
      setSelectedAgentForUninstall(null);
      setUninstallReason("");
    } catch (err: any) {
      setActionError(err.message || "Failed to uninstall agent.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Installed AI Agents
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage installed agent versions, upgrade to newer releases, or retire instances.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/workspace/agents/discover")}
              className="gap-2"
            >
              <Layers className="h-4 w-4" /> Browse Catalog
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchInstalled}
              disabled={isLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess(null)} className="text-xs hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError(null)} className="text-xs hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search installed agents..."
            className="pl-9 h-10"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading installed agents...</p>
          </div>
        ) : error ? (
          <div className="p-10 text-center rounded-2xl border border-destructive/20 bg-destructive/5 space-y-3">
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" onClick={fetchInstalled}>
              Retry
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-4">
            <Layers className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <h3 className="font-semibold text-foreground text-base">No installed agents found</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Install agents from the marketplace catalog to enable them in your workspaces.
              </p>
            </div>
            <Button onClick={() => navigate("/workspace/agents/discover")}>
              Go to Marketplace Catalog
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
            {filtered.map((agent) => (
              <div
                key={agent.installationId || agent.agentDefinitionId}
                className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl p-2.5 rounded-xl bg-muted/60 border border-border shrink-0">
                    {agent.icon || "🤖"}
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground text-base">
                        {agent.agentName}
                      </span>
                      <VersionBadge version={agent.installedVersion} />
                      <PublisherBadge publisherType={agent.publisherType} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Template: {agent.templateName}</span>
                      <span>•</span>
                      <span>Category: {agent.category}</span>
                      <span>•</span>
                      <span>Installed {new Date(agent.installedAt).toLocaleDateString()}</span>
                    </div>

                    {agent.isUpgradeAvailable && (
                      <div className="pt-1.5">
                        <UpgradeNoticeBadge
                          installedVersion={agent.installedVersion}
                          latestVersion={agent.latestTemplateVersion}
                          onUpgrade={() => setSelectedAgentForUpgrade(agent)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {agent.isUpgradeAvailable && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedAgentForUpgrade(agent)}
                      className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs h-9"
                    >
                      <ArrowUpCircle className="h-3.5 w-3.5" />
                      Upgrade
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/workspace/agents/${agent.agentDefinitionId}/configure`)}
                    className="gap-1.5 text-xs h-9"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Configure
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAgentForUninstall(agent)}
                    className="text-destructive hover:bg-destructive/10 text-xs h-9"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upgrade Dialog */}
        {selectedAgentForUpgrade && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
            <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-amber-400" />
                Confirm Agent Upgrade
              </h3>
              <p className="text-sm text-muted-foreground">
                Upgrade <strong>{selectedAgentForUpgrade.agentName}</strong> from version{" "}
                <strong className="font-mono">v{selectedAgentForUpgrade.installedVersion}</strong> to{" "}
                <strong className="font-mono text-foreground">
                  v{selectedAgentForUpgrade.latestTemplateVersion}
                </strong>
                ?
              </p>
              <div className="p-3.5 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground space-y-1">
                <span>Safe Upgrade Policy:</span>
                <p>
                  Existing configuration will be preserved. Your agent remains active with zero downtime.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAgentForUpgrade(null)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmUpgrade}
                  disabled={isProcessing}
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold gap-2"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Upgrade Now
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Uninstall Dialog */}
        {selectedAgentForUninstall && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
            <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5">
              <h3 className="text-lg font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Uninstall Agent
              </h3>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to uninstall{" "}
                <strong className="text-foreground">{selectedAgentForUninstall.agentName}</strong>?
                The instance will be safely retired and disabled. Historical run logs are preserved.
              </p>
              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-muted-foreground uppercase tracking-wider">
                  Reason for Uninstall <span className="font-normal">(Optional)</span>
                </label>
                <Input
                  value={uninstallReason}
                  onChange={(e) => setUninstallReason(e.target.value)}
                  placeholder="e.g. Deprecated workflow, moving to another agent..."
                  className="h-9"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setSelectedAgentForUninstall(null)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmUninstall}
                  disabled={isProcessing}
                  className="gap-2"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Confirm Uninstall
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
