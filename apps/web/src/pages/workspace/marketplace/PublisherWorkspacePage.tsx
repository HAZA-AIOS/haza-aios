import React, { useEffect, useState } from "react";
import { AppShell } from "../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import { Input } from "@haza-aios/ui/components/input";
import { Textarea } from "@haza-aios/ui/components/textarea";
import {
  PublishingStatusBadge,
  VersionBadge,
} from "@haza-aios/ui/components/agent-marketplace-primitives";
import { AgentService } from "../../../agents/agent-service";
import { useOrganization } from "../../../org/use-organization";
import { navigate } from "../../../routes/navigation";
import type { AgentTemplate } from "../../../agents/agent.types";
import {
  AlertCircle,
  CheckCircle2,
  FileCode,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";

export const PublisherWorkspacePage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("Productivity");
  const [industry, setIndustry] = useState("Education");
  const [version, setVersion] = useState("1.0.0");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🤖");
  const [visibility, setVisibility] = useState<"platform" | "private_organization" | "approved_shared">(
    "platform",
  );

  const fetchAuthored = async () => {
    if (!currentOrganization) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await AgentService.listPublisherTemplates(currentOrganization.id);
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || "Failed to load authored templates.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthored();
  }, [currentOrganization]);

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await AgentService.createPublisherTemplate(currentOrganization.id, {
        name: name.trim(),
        slug: slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        category,
        industry,
        version: version.trim(),
        summary: summary.trim() || undefined,
        description: description.trim(),
        icon: icon.trim() || "🤖",
        visibility,
        capabilities: [{ key: "task_execution", name: "Task Execution", description: "Standard automated agent execution" }],
        requiredPermissions: [],
      });

      setActionSuccess(`Agent draft '${name}' created successfully.`);
      setIsCreateOpen(false);
      setName("");
      setSlug("");
      setSummary("");
      setDescription("");
      await fetchAuthored();
    } catch (err: any) {
      setError(err.message || "Failed to create agent draft.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForReview = async (templateId: string, templateName: string) => {
    if (!currentOrganization) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await AgentService.submitTemplateForReview(currentOrganization.id, templateId);
      setActionSuccess(`Agent '${templateName}' submitted for platform review.`);
      await fetchAuthored();
    } catch (err: any) {
      setError(err.message || "Failed to submit agent for review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              Publisher Workspace
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Author, test, version, and submit custom AI agents for marketplace publishing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/workspace/agents/discover")}
              className="gap-2"
            >
              <Layers className="h-4 w-4" /> Marketplace
            </Button>
            <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> New Agent Listing
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

        {/* Templates list */}
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading authored agents...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="p-16 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-4">
            <FileCode className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <h3 className="font-semibold text-foreground text-base">No authored agents yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Create an agent definition to publish it privately or to the public marketplace.
              </p>
            </div>
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create First Agent
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-muted/10 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl p-2.5 rounded-xl bg-muted/60 border border-border shrink-0">
                    {tmpl.icon || "🤖"}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground text-base">{tmpl.name}</span>
                      <VersionBadge version={tmpl.version} />
                      <PublishingStatusBadge status={tmpl.publishingStatus || "draft"} />
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xl line-clamp-2">
                      {tmpl.summary || tmpl.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
                      <span>Category: {tmpl.category}</span>
                      <span>•</span>
                      <span>Industry: {tmpl.industry}</span>
                      <span>•</span>
                      <span>Visibility: {tmpl.visibility}</span>
                    </div>

                    {tmpl.reviewNotes && (
                      <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs mt-2">
                        <strong>Reviewer Feedback:</strong> {tmpl.reviewNotes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  {tmpl.publishingStatus === "draft" || tmpl.publishingStatus === "rejected" ? (
                    <Button
                      size="sm"
                      onClick={() => handleSubmitForReview(tmpl.id, tmpl.name)}
                      disabled={isSubmitting}
                      className="gap-1.5 text-xs h-9"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Submit for Review
                    </Button>
                  ) : null}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/workspace/agents/${tmpl.id}`)}
                    className="text-xs h-9"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Create New Agent Listing</h3>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateAgent} className="space-y-4 text-sm">
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Icon
                    </label>
                    <Input
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      className="h-10 text-center text-xl"
                      maxLength={4}
                    />
                  </div>
                  <div className="col-span-3 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Agent Name *
                    </label>
                    <Input
                      required
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!slug) {
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                        }
                      }}
                      placeholder="e.g. Student Progress Evaluator"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Identifier Slug *
                    </label>
                    <Input
                      required
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="student-progress-evaluator"
                      className="h-10 font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Initial Version *
                    </label>
                    <Input
                      required
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0.0"
                      className="h-10 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Productivity">Productivity</option>
                      <option value="Education">Education</option>
                      <option value="Content">Content</option>
                      <option value="Communication">Communication</option>
                      <option value="Analytics">Analytics</option>
                      <option value="Operations">Operations</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Industry
                    </label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Education">Education</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Corporate">Corporate</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Summary (Short headline)
                  </label>
                  <Input
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Brief 1-sentence value proposition"
                    className="h-10"
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Detailed Description *
                  </label>
                  <Textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed functionality, capabilities, and intended workflow..."
                    rows={4}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="platform">Platform (Public catalog upon approval)</option>
                    <option value="private_organization">Private Organization (Only visible to your tenant)</option>
                    <option value="approved_shared">Approved Shared (Shared with approved partner orgs)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsCreateOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="gap-2">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save Draft
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
