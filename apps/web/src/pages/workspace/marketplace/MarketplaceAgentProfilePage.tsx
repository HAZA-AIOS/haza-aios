import React, { useEffect, useState } from "react";
import { AppShell } from "../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import {
  PublisherBadge,
  VersionBadge,
  PublishingStatusBadge,
  UpgradeNoticeBadge,
  CapabilityTagList,
} from "@haza-aios/ui/components/agent-marketplace-primitives";
import { AgentService } from "../../../agents/agent-service";
import { useOrganization } from "../../../org/use-organization";
import { usePathname, navigate } from "../../../routes/navigation";
import { MarketplaceInstallModal } from "./MarketplaceInstallModal";
import type { MarketplaceAgentProfile } from "../../../agents/agent.types";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  Settings,
  Shield,
  Tag,
  Zap,
} from "lucide-react";

export const MarketplaceAgentProfilePage: React.FC = () => {
  const pathname = usePathname();
  const { currentOrganization } = useOrganization();
  const [profile, setProfile] = useState<MarketplaceAgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInstallOpen, setIsInstallOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  // Extract templateId from route: /workspace/marketplace/agents/:id or /workspace/agents/:id
  const match = pathname.match(/\/(?:marketplace\/agents|agents)\/([^/]+)/);
  const templateId = match ? match[1] : "";

  const loadProfile = async () => {
    if (!currentOrganization || !templateId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await AgentService.getMarketplaceAgentProfile(
        currentOrganization.id,
        templateId,
      );
      setProfile(data);
    } catch (err: any) {
      setError(err.message || "Failed to load agent profile.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [currentOrganization, templateId]);

  const handleUpgrade = async () => {
    if (!currentOrganization || !profile?.installedInstance) return;
    setIsUpgrading(true);
    try {
      await AgentService.upgradeMarketplaceAgent(
        currentOrganization.id,
        profile.installedInstance.id,
        profile.activeVersion.version,
      );
      setUpgradeSuccess(true);
      await loadProfile();
    } catch (err: any) {
      setError(err.message || "Upgrade failed.");
    } finally {
      setIsUpgrading(false);
    }
  };

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in-0">
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/workspace/agents/discover")}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Marketplace Catalog
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/workspace/marketplace/installed")}
            >
              Installed Agents
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-24 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading agent details from registry...</p>
          </div>
        ) : error || !profile ? (
          <div className="p-12 text-center rounded-2xl border border-destructive/20 bg-destructive/5 space-y-4">
            <p className="text-destructive font-medium">{error || "Agent not found in registry."}</p>
            <Button variant="outline" onClick={loadProfile}>
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Header Card */}
            <div className="p-8 rounded-2xl border border-border bg-card/80 backdrop-blur shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-5">
                  <div className="text-5xl p-4 rounded-2xl bg-muted/80 border border-border shrink-0 shadow-inner">
                    {profile.icon || "🤖"}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        {profile.name}
                      </h1>
                      <VersionBadge version={profile.activeVersion.version} />
                      <PublishingStatusBadge status={profile.publishingStatus} />
                    </div>
                    <p className="text-muted-foreground text-sm max-w-2xl leading-relaxed">
                      {profile.summary || profile.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                      <PublisherBadge publisherType={profile.publisherType} organizationName={profile.publisherOrganizationName} />
                      <span>•</span>
                      <span className="font-medium text-foreground">{profile.category}</span>
                      <span>•</span>
                      <span>{profile.industry}</span>
                      {profile.publishedAt && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Released{" "}
                            {new Date(profile.publishedAt).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full sm:w-auto">
                  {profile.installedInstance ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Installed (v{profile.installedInstance.installedVersion})</span>
                      </div>

                      {profile.installedInstance.isUpgradeAvailable && (
                        <Button
                          onClick={handleUpgrade}
                          disabled={isUpgrading}
                          className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        >
                          {isUpgrading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          Upgrade to v{profile.activeVersion.version}
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => navigate(`/workspace/agents/${profile.installedInstance?.id}/configure`)}
                        className="w-full gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Configure Agent
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => setIsInstallOpen(true)}
                      className="gap-2 shadow-lg hover:shadow-primary/20"
                    >
                      <Download className="h-4 w-4" />
                      Install Agent (v{profile.activeVersion.version})
                    </Button>
                  )}
                </div>
              </div>

              {upgradeSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Agent successfully upgraded to v{profile.activeVersion.version}!</span>
                </div>
              )}
            </div>

            {/* Grid details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column (2 Cols): Overview & Version History */}
              <div className="lg:col-span-2 space-y-8">
                {/* Description & Capabilities */}
                <div className="p-6 rounded-2xl border border-border bg-card space-y-6">
                  <div>
                    <h3 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" /> Overview & Purpose
                    </h3>
                    <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                      {profile.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-border space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Capabilities & Permissions
                    </h4>
                    <div className="space-y-3">
                      {profile.activeVersion.capabilities.map((cap: any, idx: number) => (
                        <div
                          key={cap.key || idx}
                          className="p-3.5 rounded-xl border border-border/80 bg-muted/30 space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">
                              {cap.name || cap.key}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                              {cap.key}
                            </span>
                          </div>
                          {cap.description && (
                            <p className="text-xs text-muted-foreground">{cap.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Version History Table */}
                <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
                  <h3 className="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" /> Version History
                  </h3>
                  <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
                    {profile.versions.map((ver) => (
                      <div key={ver.id} className="p-4 bg-muted/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <VersionBadge version={ver.version} />
                            {ver.version === profile.activeVersion.version && (
                              <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                                Latest
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {ver.publishedAt
                              ? new Date(ver.publishedAt).toLocaleDateString()
                              : new Date(ver.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {ver.changelog ? (
                          <p className="text-xs text-muted-foreground leading-relaxed pl-2 border-l-2 border-border">
                            {ver.changelog}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 italic">
                            Initial baseline release.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column (1 Col): Governance, Requirements & Publisher Info */}
              <div className="space-y-6">
                <div className="p-6 rounded-2xl border border-border bg-card space-y-5 text-sm">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Publisher & Provenance
                  </h3>
                  <div className="space-y-3 text-xs text-muted-foreground">
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span>Publisher Type:</span>
                      <span className="font-medium text-foreground capitalize">
                        {profile.publisherType}
                      </span>
                    </div>
                    {profile.publisherOrganizationName && (
                      <div className="flex justify-between py-1.5 border-b border-border">
                        <span>Organization:</span>
                        <span className="font-medium text-foreground">
                          {profile.publisherOrganizationName}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span>Visibility:</span>
                      <span className="font-medium text-foreground capitalize">
                        {profile.visibility.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-border">
                      <span>Status:</span>
                      <PublishingStatusBadge status={profile.publishingStatus} />
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span>Platform Target:</span>
                      <span className="font-mono text-foreground">HAZA AIOS v0.12+</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-2xl border border-border bg-card space-y-4 text-sm">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" /> Approval Policy
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This agent adheres to HAZA-AIOS enterprise governance policies. Tool invocations
                    classified as sensitive require human reviewer authorization.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Installation Modal */}
        {profile && (
          <MarketplaceInstallModal
            agent={{
              id: profile.id,
              slug: profile.slug,
              name: profile.name,
              summary: profile.summary,
              description: profile.description,
              latestVersion: profile.activeVersion.version,
              category: profile.category,
              industry: profile.industry,
              icon: profile.icon,
              publisherType: profile.publisherType,
              publisherOrganizationId: profile.publisherOrganizationId,
              publisherOrganizationName: profile.publisherOrganizationName,
              visibility: profile.visibility,
              publishingStatus: profile.publishingStatus as any,
              capabilities: profile.activeVersion.capabilities,
              publishedAt: profile.publishedAt,
            }}
            isOpen={isInstallOpen}
            onClose={() => setIsInstallOpen(false)}
            onSuccess={() => {
              loadProfile();
            }}
          />
        )}
      </div>
    </AppShell>
  );
};
