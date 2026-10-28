import React, { useEffect, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import { Textarea } from "@haza-aios/ui/components/textarea";
import {
  PublishingStatusBadge,
  MarketplaceMetricCard,
  PublisherBadge,
} from "@haza-aios/ui/components/agent-marketplace-primitives";
import { AgentService } from "../../agents/agent-service";
import { useOrganization } from "../../org/use-organization";
import type {
  MarketplaceAnalytics,
  MarketplaceReviewSubmission,
} from "../../agents/agent.types";
import {
  AlertCircle,
  Archive,
  Ban,
  CheckCircle,
  CheckCircle2,
  Clock,
  Eye,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";

export const MarketplaceReviewPage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [submissions, setSubmissions] = useState<MarketplaceReviewSubmission[]>([]);
  const [analytics, setAnalytics] = useState<MarketplaceAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review modal
  const [selectedSub, setSelectedSub] = useState<MarketplaceReviewSubmission | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const subs = await AgentService.listPlatformMarketplaceReviews();
      setSubmissions(subs);

      if (currentOrganization) {
        const stats = await AgentService.getMarketplaceAnalytics(currentOrganization.id);
        setAnalytics(stats);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load marketplace review submissions.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentOrganization]);

  const handleDecision = async (
    decision: "under_review" | "approved" | "rejected" | "published" | "deprecated" | "withdrawn",
  ) => {
    if (!selectedSub) return;
    if (decision === "rejected" && !reviewNotes.trim()) {
      setError("Please provide review notes explaining the rejection reason.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      await AgentService.reviewMarketplaceSubmission(
        selectedSub.id,
        decision,
        reviewNotes.trim() || undefined,
      );

      setActionSuccess(`Submission '${selectedSub.name}' marked as ${decision}.`);
      setSelectedSub(null);
      setReviewNotes("");
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to update review status.");
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
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Marketplace Governance & Reviews
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Platform administration review desk for AI agent submissions, approvals, and publication.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {/* Analytics row */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MarketplaceMetricCard
              title="Published Agents"
              value={analytics.publishedAgentsCount}
              subtitle="Active in catalog"
              icon={<Zap className="h-4 w-4" />}
            />
            <MarketplaceMetricCard
              title="Pending Reviews"
              value={analytics.pendingReviewsCount}
              subtitle="Awaiting decision"
              icon={<Clock className="h-4 w-4" />}
            />
            <MarketplaceMetricCard
              title="Total Installations"
              value={analytics.totalInstallationsCount}
              subtitle="All-time installs"
              icon={<Layers className="h-4 w-4" />}
            />
            <MarketplaceMetricCard
              title="Active Installations"
              value={analytics.activeInstallationsCount}
              subtitle="Currently operating"
              icon={<Users className="h-4 w-4" />}
            />
          </div>
        )}

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

        {error && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-xs hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Submissions Table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">
              Submissions Requiring Review ({submissions.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="p-16 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading submissions...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-16 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-2">
              <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
              <h3 className="font-semibold text-foreground text-base">Inbox Zero</h3>
              <p className="text-xs text-muted-foreground">
                There are no agent submissions currently pending review or approval.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-semibold text-foreground text-base">{sub.name}</span>
                      <PublishingStatusBadge status={sub.publishingStatus} />
                      <PublisherBadge
                        publisherType={sub.publisherType}
                        organizationName={sub.publisherOrganizationName}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl">
                      {sub.summary || sub.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                      <span>Submitted by: <strong>{sub.publisherUserEmail || "N/A"}</strong></span>
                      <span>•</span>
                      <span>Category: {sub.category}</span>
                      <span>•</span>
                      <span>Industry: {sub.industry}</span>
                      <span>•</span>
                      <span>Last Updated: {new Date(sub.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedSub(sub);
                        setReviewNotes(sub.reviewNotes || "");
                      }}
                      className="gap-1.5 text-xs h-9"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Review & Decide
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Review Modal */}
        {selectedSub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-foreground">{selectedSub.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <PublishingStatusBadge status={selectedSub.publishingStatus} />
                    <span className="text-xs text-muted-foreground">• {selectedSub.category}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSub(null)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 rounded-xl border border-border/80 bg-muted/30 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Publisher Organization:</span>
                  <span className="font-semibold text-foreground">
                    {selectedSub.publisherOrganizationName || "Platform / Independent"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Author Email:</span>
                  <span className="font-mono text-foreground">{selectedSub.publisherUserEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slug:</span>
                  <span className="font-mono text-foreground">{selectedSub.slug}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <label className="font-semibold text-muted-foreground uppercase tracking-wider">
                  Reviewer Notes / Feedback
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Mandatory when rejecting. Detail any security, quality, or formatting issues..."
                  rows={4}
                  className="text-sm resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSub(null)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDecision("under_review")}
                  disabled={isProcessing}
                  className="text-amber-400 hover:text-amber-300"
                >
                  Under Review
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDecision("rejected")}
                  disabled={isProcessing}
                  className="gap-1.5"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Reject
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleDecision("published")}
                  disabled={isProcessing}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Approve & Publish
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
