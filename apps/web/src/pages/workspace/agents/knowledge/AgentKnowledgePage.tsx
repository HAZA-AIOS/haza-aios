import React, { useEffect, useState } from "react";
import { AppShell } from "../../../../components/AppShell";
import { Button } from "@haza-aios/ui/components/button";
import { Card } from "@haza-aios/ui/components/card";
import {
  KnowledgeCollectionCard,
  KnowledgeSourceCard,
  DocumentUploadPanel,
  IngestionProgressIndicator,
  ChunkPreviewPanel,
  SemanticSearchPanel,
  RetrievalResultCard,
  CitationSourceDrawer,
  type KnowledgeCollectionData,
  type KnowledgeSourceData,
  type ChunkPreviewData,
  type RetrievalResultData,
  type CitationReferenceData,
} from "@haza-aios/ui/components/knowledge-primitives";
import {
  agentKnowledgeService,
  type KnowledgeStatsData,
  type KnowledgeRetrievalHistoryItem,
} from "../../../../agents/knowledge-service";
import { useOrganization } from "../../../../org/use-organization";
import {
  BookOpen,
  FolderOpen,
  FileText,
  Search,
  Activity,
  Plus,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Database,
  Layers,
  Clock,
  Cpu,
} from "lucide-react";

export const AgentKnowledgePage: React.FC = () => {
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id || "org-mentor-school";
  const workspaceId = "default-ws";

  const [activeTab, setActiveTab] = useState<
    "overview" | "collections" | "sources" | "search" | "telemetry"
  >("overview");

  const [stats, setStats] = useState<KnowledgeStatsData | null>(null);
  const [collections, setCollections] = useState<KnowledgeCollectionData[]>([]);
  const [sources, setSources] = useState<KnowledgeSourceData[]>([]);
  const [retrievals, setRetrievals] = useState<KnowledgeRetrievalHistoryItem[]>([]);
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<
    "idle" | "uploading" | "parsing" | "chunking" | "embedding" | "completed" | "error"
  >("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadDetails, setUploadDetails] = useState("");

  // Inspect Chunks Modal
  const [inspectingSource, setInspectingSource] = useState<KnowledgeSourceData | null>(null);
  const [inspectChunks, setInspectChunks] = useState<ChunkPreviewData[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Search State
  const [searchResults, setSearchResults] = useState<RetrievalResultData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchLatency, setSearchLatency] = useState(0);

  // Citation Drawer
  const [selectedCitation, setSelectedCitation] = useState<CitationReferenceData | null>(null);
  const [isCitationDrawerOpen, setIsCitationDrawerOpen] = useState(false);

  // New Collection Form Modal
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [newCollectionIndustry, setNewCollectionIndustry] = useState("education");
  const [newCollectionVisibility, setNewCollectionVisibility] = useState<
    "workspace" | "organization" | "private"
  >("workspace");

  useEffect(() => {
    loadAllData();
  }, [organizationId, workspaceId]);

  const loadAllData = async () => {
    if (!organizationId) return;
    setIsLoading(true);
    try {
      const [fetchedStats, fetchedCollections, fetchedSources, fetchedRetrievals] =
        await Promise.all([
          agentKnowledgeService.getStats(organizationId, workspaceId),
          agentKnowledgeService.listCollections(organizationId, workspaceId),
          agentKnowledgeService.listSources(organizationId, workspaceId),
          agentKnowledgeService.listRetrievals(organizationId, 30),
        ]);
      setStats(fetchedStats);
      setCollections(fetchedCollections);
      setSources(fetchedSources);
      setRetrievals(fetchedRetrievals);
    } catch (err) {
      console.error("Failed to load knowledge engine data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (data: {
    fileName: string;
    mimeType: string;
    fileBase64?: string;
    content?: string;
    collectionId?: string;
    description?: string;
  }) => {
    setIsUploading(true);
    setUploadStage("uploading");
    setUploadProgress(20);
    setUploadDetails("Uploading document payload to durable storage...");

    try {
      setTimeout(() => {
        setUploadStage("parsing");
        setUploadProgress(45);
        setUploadDetails("Extracting structured headings and paragraphs...");
      }, 400);

      setTimeout(() => {
        setUploadStage("chunking");
        setUploadProgress(70);
        setUploadDetails("Applying token-bounded chunking and hash generation...");
      }, 800);

      setTimeout(() => {
        setUploadStage("embedding");
        setUploadProgress(85);
        setUploadDetails("Generating vector embeddings via provider...");
      }, 1200);

      const source = await agentKnowledgeService.uploadDocument(organizationId, workspaceId, data);

      setUploadStage("completed");
      setUploadProgress(100);
      setUploadDetails(
        `Successfully ingested ${source.name} (${source.chunkCount || 0} chunks generated).`,
      );

      await loadAllData();

      setTimeout(() => {
        setUploadStage("idle");
        setIsUploading(false);
      }, 2500);
    } catch (err: any) {
      setUploadStage("error");
      setUploadProgress(100);
      setUploadDetails(err.message || "Failed to ingest document.");
      setIsUploading(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      await agentKnowledgeService.createCollection(organizationId, workspaceId, {
        name: newCollectionName.trim(),
        description: newCollectionDesc.trim() || undefined,
        industry: newCollectionIndustry,
        visibility: newCollectionVisibility,
      });
      setShowCreateCollection(false);
      setNewCollectionName("");
      setNewCollectionDesc("");
      await loadAllData();
    } catch (err) {
      console.error("Failed to create collection:", err);
    }
  };

  const handleDeleteCollection = async (col: KnowledgeCollectionData) => {
    if (!confirm(`Are you sure you want to archive collection "${col.name}"?`)) return;
    try {
      await agentKnowledgeService.deleteCollection(organizationId, col.id);
      await loadAllData();
    } catch (err) {
      console.error("Failed to delete collection:", err);
    }
  };

  const handleDeleteSource = async (src: KnowledgeSourceData) => {
    if (!confirm(`Are you sure you want to archive document "${src.name}"?`)) return;
    try {
      await agentKnowledgeService.deleteSource(organizationId, src.id);
      await loadAllData();
    } catch (err) {
      console.error("Failed to delete source:", err);
    }
  };

  const handleViewChunks = async (src: KnowledgeSourceData) => {
    setInspectingSource(src);
    setIsLoadingChunks(true);
    try {
      const chunks = await agentKnowledgeService.getChunks(organizationId, src.id);
      setInspectChunks(chunks);
    } catch (err) {
      console.error("Failed to load chunks:", err);
      setInspectChunks([]);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  const handleSearch = async (params: {
    query: string;
    mode: "hybrid" | "semantic" | "keyword";
    collectionIds?: string[];
    minScore?: number;
    limit?: number;
  }) => {
    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await agentKnowledgeService.search(organizationId, {
        ...params,
        workspaceId,
      });
      setSearchResults(res.results);
      setSearchLatency(res.latencyMs);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInspectCitationFromSearch = (result: RetrievalResultData) => {
    setSelectedCitation({
      citationId: result.chunkId,
      documentTitle: result.documentTitle,
      sourceId: result.sourceId,
      chunkId: result.chunkId,
      sectionHeading: result.sectionHeading,
      pageNumber: result.pageNumber,
      exactSnippet: result.content,
      isValid: true,
    });
    setIsCitationDrawerOpen(true);
  };

  const filteredSources = selectedCollectionFilter
    ? sources.filter((s) => s.collectionId === selectedCollectionFilter)
    : sources;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Database className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                Agent Knowledge & Context Engine
              </h1>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Institutional RAG repository, dense vector search, and grounded attribution for AI
              agents.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllData}
              disabled={isLoading}
              className="border-zinc-800 text-zinc-300 hover:bg-zinc-800/60"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setActiveTab("overview");
                window.scrollTo({ top: 300, behavior: "smooth" });
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Ingest Document
            </Button>
          </div>
        </div>

        {/* Global Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 bg-zinc-900/60 border-zinc-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400">Knowledge Collections</p>
              <p className="text-xl font-bold text-zinc-100 mt-0.5">
                {stats?.collectionsCount ?? collections.length}
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-zinc-900/60 border-zinc-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400">Indexed Documents</p>
              <p className="text-xl font-bold text-zinc-100 mt-0.5">
                {stats?.sourcesCount ?? sources.length}
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-zinc-900/60 border-zinc-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400">Indexed Text Chunks</p>
              <p className="text-xl font-bold text-zinc-100 mt-0.5">
                {sources.reduce((acc, s) => acc + (s.chunkCount || 0), 0)}
              </p>
            </div>
          </Card>

          <Card className="p-4 bg-zinc-900/60 border-zinc-800 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Cpu className="h-5 w-5" />
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-zinc-400">Vector Embeddings</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-semibold text-zinc-100 truncate">
                  {stats?.embeddingProvider?.name || "1536-dim Unit"}
                </span>
                <span className="text-[10px] px-1 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
                  {stats?.embeddingProvider?.dimensions ?? 1536}d
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-3 flex items-center gap-2 transition-colors border-b-2 -mb-px ${
              activeTab === "overview"
                ? "border-indigo-500 text-indigo-400 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Overview & Ingest
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("collections")}
            className={`pb-3 flex items-center gap-2 transition-colors border-b-2 -mb-px ${
              activeTab === "collections"
                ? "border-indigo-500 text-indigo-400 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FolderOpen className="h-4 w-4" />
            Collections ({collections.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sources")}
            className={`pb-3 flex items-center gap-2 transition-colors border-b-2 -mb-px ${
              activeTab === "sources"
                ? "border-indigo-500 text-indigo-400 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents & Chunks ({sources.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`pb-3 flex items-center gap-2 transition-colors border-b-2 -mb-px ${
              activeTab === "search"
                ? "border-indigo-500 text-indigo-400 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Search className="h-4 w-4" />
            Semantic Search Lab
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("telemetry")}
            className={`pb-3 flex items-center gap-2 transition-colors border-b-2 -mb-px ${
              activeTab === "telemetry"
                ? "border-indigo-500 text-indigo-400 font-semibold"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Activity className="h-4 w-4" />
            Audit & Telemetry ({retrievals.length})
          </button>
        </div>

        {/* Tab 1: Overview & Ingest */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <DocumentUploadPanel
                  onUpload={handleUpload}
                  isUploading={isUploading}
                  collections={collections}
                />
                <IngestionProgressIndicator
                  stage={uploadStage}
                  progressPercent={uploadProgress}
                  details={uploadDetails}
                />
              </div>

              <div className="space-y-4">
                <Card className="p-5 bg-zinc-900/60 border-zinc-800 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Security & Context Boundaries
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    HAZA-AIOS enforces strict tenant isolation at database and vector retrieval
                    boundaries. Retrieved content is quarantined within untrusted delimiters to
                    prevent indirect prompt injection.
                  </p>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Tenant workspace scoping on all chunk queries
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Role-based access checks (RBAC)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Prompt injection sanitization boundary
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Validated inline academic citations
                    </li>
                  </ul>
                </Card>

                <Card className="p-5 bg-zinc-900/60 border-zinc-800 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-indigo-400" />
                    Embedding Provider Status
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-400">Provider</span>
                      <span className="text-zinc-200 font-mono">
                        {stats?.embeddingProvider?.id || "mock-deterministic"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-400">Model</span>
                      <span className="text-zinc-200 font-mono">
                        {stats?.embeddingProvider?.model || "haza-embed-1536"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800">
                      <span className="text-zinc-400">Dimensions</span>
                      <span className="text-zinc-200 font-mono">
                        {stats?.embeddingProvider?.dimensions ?? 1536}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400">Live Semantic Inference</span>
                      <span
                        className={`font-medium ${
                          stats?.embeddingProvider?.isReal ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        {stats?.embeddingProvider?.isReal ? "Active (OpenAI)" : "Mock Deterministic"}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Collections */}
        {activeTab === "collections" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Knowledge Collections</h3>
                <p className="text-xs text-zinc-400">
                  Logical groupings of organizational curriculum, policies, and documents.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowCreateCollection(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Collection
              </Button>
            </div>

            {collections.length === 0 ? (
              <Card className="p-8 text-center bg-zinc-900/40 border-zinc-800">
                <FolderOpen className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <h4 className="text-sm font-medium text-zinc-300">No collections created yet</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Create a collection to organize your institution&apos;s curriculum frameworks, syllabus
                  standards, and guidelines.
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowCreateCollection(true)}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                >
                  Create Collection
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {collections.map((col) => (
                  <KnowledgeCollectionCard
                    key={col.id}
                    collection={col}
                    onSelect={(c) => {
                      setSelectedCollectionFilter(c.id);
                      setActiveTab("sources");
                    }}
                    onDelete={handleDeleteCollection}
                  />
                ))}
              </div>
            )}

            {/* Create Collection Modal */}
            {showCreateCollection && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 shadow-2xl">
                  <h3 className="text-sm font-semibold text-zinc-100">Create Knowledge Collection</h3>
                  <form onSubmit={handleCreateCollection} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Collection Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newCollectionName}
                        onChange={(e) => setNewCollectionName(e.target.value)}
                        placeholder="e.g. Cambridge IGCSE Curriculum 2026"
                        className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">
                        Description
                      </label>
                      <textarea
                        value={newCollectionDesc}
                        onChange={(e) => setNewCollectionDesc(e.target.value)}
                        placeholder="Official syllabus benchmarks, learning objectives, and grading criteria."
                        rows={3}
                        className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          Industry
                        </label>
                        <select
                          value={newCollectionIndustry}
                          onChange={(e) => setNewCollectionIndustry(e.target.value)}
                          className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
                        >
                          <option value="education">Education</option>
                          <option value="cross_industry">Cross-Industry</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">
                          Visibility
                        </label>
                        <select
                          value={newCollectionVisibility}
                          onChange={(e) => setNewCollectionVisibility(e.target.value as any)}
                          className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-xs text-zinc-200"
                        >
                          <option value="workspace">Workspace</option>
                          <option value="organization">Organization</option>
                          <option value="private">Private</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCreateCollection(false)}
                        className="text-xs border-zinc-700 text-zinc-300"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                      >
                        Create
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Sources & Documents */}
        {activeTab === "sources" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">Documents & Chunks</h3>
                <p className="text-xs text-zinc-400">
                  Inspected files, chunk ordinals, token counts, and persistent embeddings.
                </p>
              </div>
              {collections.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Filter by collection:</span>
                  <select
                    value={selectedCollectionFilter}
                    onChange={(e) => setSelectedCollectionFilter(e.target.value)}
                    className="rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs text-zinc-200"
                  >
                    <option value="">All Collections ({sources.length})</option>
                    {collections.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {filteredSources.length === 0 ? (
              <Card className="p-8 text-center bg-zinc-900/40 border-zinc-800">
                <FileText className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                <h4 className="text-sm font-medium text-zinc-300">No documents found</h4>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Upload PDF, DOCX, Markdown, or text documents to start building your
                  institution&apos;s retrieval knowledge base.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredSources.map((src) => (
                  <KnowledgeSourceCard
                    key={src.id}
                    source={src}
                    onViewChunks={handleViewChunks}
                    onDelete={handleDeleteSource}
                  />
                ))}
              </div>
            )}

            {/* Chunk Inspector Modal */}
            {inspectingSource && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className="w-full max-w-3xl">
                  {isLoadingChunks ? (
                    <Card className="p-8 text-center bg-zinc-900 border-zinc-800 text-zinc-400 text-xs">
                      <Clock className="h-6 w-6 text-indigo-400 animate-spin mx-auto mb-2" />
                      Loading chunks from repository...
                    </Card>
                  ) : (
                    <ChunkPreviewPanel
                      chunks={inspectChunks}
                      documentTitle={inspectingSource.name}
                      onClose={() => setInspectingSource(null)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Semantic Search Lab */}
        {activeTab === "search" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">Semantic Search Lab</h3>
              <p className="text-xs text-zinc-400">
                Test hybrid keyword and dense semantic vector retrieval against authorized
                collections.
              </p>
            </div>

            <SemanticSearchPanel
              onSearch={handleSearch}
              isSearching={isSearching}
              collections={collections}
            />

            {isSearching && (
              <Card className="p-8 text-center bg-zinc-900/40 border-zinc-800 text-xs text-zinc-400">
                <Clock className="h-6 w-6 text-indigo-400 animate-spin mx-auto mb-2" />
                Executing hybrid vector and BM25 lexical fusion...
              </Card>
            )}

            {!isSearching && hasSearched && searchResults.length === 0 && (
              <Card className="p-8 text-center bg-zinc-900/40 border-zinc-800">
                <Search className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">
                  No relevant chunks found above the similarity threshold.
                </p>
              </Card>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                  <span>
                    Top {searchResults.length} ranked result(s) across authorized knowledge base
                  </span>
                  <span className="font-mono text-zinc-500">Latency: {searchLatency}ms</span>
                </div>
                {searchResults.map((result) => (
                  <RetrievalResultCard
                    key={result.chunkId}
                    result={result}
                    onViewSource={handleInspectCitationFromSearch}
                  />
                ))}
              </div>
            )}

            {/* Citation Source Drawer */}
            <CitationSourceDrawer
              citation={selectedCitation}
              isOpen={isCitationDrawerOpen}
              onClose={() => setIsCitationDrawerOpen(false)}
            />
          </div>
        )}

        {/* Tab 5: Audit & Telemetry */}
        {activeTab === "telemetry" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-100">
                Retrieval Telemetry & Audit Log
              </h3>
              <p className="text-xs text-zinc-400">
                Audited agent queries, retrieved chunk counts, similarity scores, and execution
                latencies.
              </p>
            </div>

            {retrievals.length === 0 ? (
              <Card className="p-8 text-center bg-zinc-900/40 border-zinc-800 text-xs text-zinc-400">
                No retrieval events logged yet.
              </Card>
            ) : (
              <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/60 shadow-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-zinc-400 border-b border-zinc-800 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Query</th>
                      <th className="py-3 px-4">Mode</th>
                      <th className="py-3 px-4">Chunks Matched</th>
                      <th className="py-3 px-4">Latency</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    {retrievals.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-zinc-100 truncate max-w-xs">
                          {r.query}
                        </td>
                        <td className="py-3 px-4 capitalize font-mono text-[11px]">
                          {r.retrievalMode}
                        </td>
                        <td className="py-3 px-4 font-mono text-indigo-400">
                          {r.matchedChunkIds.length} chunks
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-400">{r.latencyMs}ms</td>
                        <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
};

