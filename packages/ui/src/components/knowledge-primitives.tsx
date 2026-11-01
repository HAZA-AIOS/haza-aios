import * as React from "react";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import {
  BookOpen,
  FileText,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Database,
  Tag,
  ExternalLink,
  ChevronRight,
  Eye,
  Trash2,
  Sparkles,
  ShieldCheck,
  FileCode,
  FileSpreadsheet,
  X,
  SlidersHorizontal,
  FolderOpen,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Types & Interfaces
   ───────────────────────────────────────────────────────────── */

export type KnowledgeIngestionStatus =
  | "pending"
  | "parsing"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed"
  | "archived";

export interface KnowledgeCollectionData {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  industry?: string;
  visibility?: "workspace" | "organization" | "private";
  status?: string;
  documentCount?: number;
  chunkCount?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface KnowledgeSourceData {
  id: string;
  name: string;
  description?: string | null;
  type?: "text" | "document" | "structured";
  visibility?: "internal" | "private";
  status?: string;
  ingestionStatus?: KnowledgeIngestionStatus;
  fileName?: string | null;
  fileType?: string | null;
  fileSizeBytes?: number | null;
  currentVersion?: number;
  chunkCount?: number;
  createdAt?: string | Date;
  collectionId?: string | null;
  requiresOcr?: boolean;
}

export interface ChunkPreviewData {
  id: string;
  sourceId: string;
  ordinal: number;
  sectionHeading?: string | null;
  pageNumber?: number | null;
  tokenCount: number;
  content: string;
  contentHash?: string;
}

export interface RetrievalResultData {
  sourceId: string;
  collectionId?: string | null;
  documentTitle: string;
  documentVersion: number;
  chunkId: string;
  ordinal: number;
  sectionHeading: string | null;
  pageNumber: number | null;
  content: string;
  relevanceScore: number;
  retrievalMethod: "semantic" | "keyword" | "hybrid";
  citationReference: string;
}

export interface CitationReferenceData {
  citationId: string;
  documentTitle: string;
  sourceId: string;
  chunkId: string;
  sectionHeading?: string | null;
  pageNumber?: number | null;
  exactSnippet?: string;
  isValid: boolean;
  validationError?: string;
}

/* ─────────────────────────────────────────────────────────────
   1. KnowledgeSourceStatusBadge
   ───────────────────────────────────────────────────────────── */

export function KnowledgeSourceStatusBadge({
  status,
  className,
}: {
  status?: KnowledgeIngestionStatus | string;
  className?: string;
}) {
  const norm = (status || "ready").toLowerCase();

  if (norm === "ready" || norm === "active") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
          className,
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Indexed & Ready
      </span>
    );
  }

  if (norm === "parsing" || norm === "chunking" || norm === "embedding" || norm === "indexing") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-pulse",
          className,
        )}
      >
        <Clock className="h-3 w-3 text-cyan-400 animate-spin" />
        {norm.charAt(0).toUpperCase() + norm.slice(1)}...
      </span>
    );
  }

  if (norm === "failed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20",
          className,
        )}
      >
        <AlertCircle className="h-3 w-3 text-rose-400" />
        Ingestion Failed
      </span>
    );
  }

  if (norm === "archived") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
          className,
        )}
      >
        Archived
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20",
        className,
      )}
    >
      <Clock className="h-3 w-3 text-amber-400" />
      Pending Ingestion
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
   2. KnowledgeCollectionCard
   ───────────────────────────────────────────────────────────── */

export function KnowledgeCollectionCard({
  collection,
  onSelect,
  onEdit,
  onDelete,
  className,
}: {
  collection: KnowledgeCollectionData;
  onSelect?: (col: KnowledgeCollectionData) => void;
  onEdit?: (col: KnowledgeCollectionData) => void;
  onDelete?: (col: KnowledgeCollectionData) => void;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "group relative p-5 bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-indigo-500/5",
        className,
      )}
      onClick={() => onSelect?.(collection)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
            <FolderOpen className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">
              {collection.name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
              <span className="capitalize">{collection.industry || "General"}</span>
              <span>•</span>
              <span className="capitalize">{collection.visibility || "Workspace"}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(collection);
              }}
              className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
              title="Delete Collection"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {collection.description && (
        <p className="text-xs text-zinc-400 line-clamp-2 mb-4 leading-relaxed">
          {collection.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-xs">
        <div className="flex items-center gap-3 text-zinc-400">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            {collection.documentCount ?? 0} docs
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-zinc-500" />
            {collection.chunkCount ?? 0} chunks
          </span>
        </div>
        <span className="flex items-center gap-1 text-indigo-400 group-hover:translate-x-0.5 transition-transform font-medium">
          Explore <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   3. KnowledgeSourceCard
   ───────────────────────────────────────────────────────────── */

export function KnowledgeSourceCard({
  source,
  onViewChunks,
  onDelete,
  className,
}: {
  source: KnowledgeSourceData;
  onViewChunks?: (src: KnowledgeSourceData) => void;
  onDelete?: (src: KnowledgeSourceData) => void;
  className?: string;
}) {
  const getFileIcon = (fileType?: string | null) => {
    const ext = (fileType || "txt").toLowerCase();
    if (ext === "pdf") return <FileText className="h-5 w-5 text-rose-400" />;
    if (ext === "docx" || ext === "doc") return <FileSpreadsheet className="h-5 w-5 text-blue-400" />;
    if (ext === "md" || ext === "html") return <FileCode className="h-5 w-5 text-emerald-400" />;
    return <FileText className="h-5 w-5 text-zinc-400" />;
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return "Text Content";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card
      className={cn(
        "p-4 bg-zinc-900/60 border-zinc-800 hover:border-zinc-700/80 transition-all duration-200 shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center">
            {getFileIcon(source.fileType)}
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <span className="truncate max-w-[280px]" title={source.name}>
                {source.name}
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                v{source.currentVersion ?? 1}
              </span>
            </h4>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span>{formatBytes(source.fileSizeBytes)}</span>
              <span>•</span>
              <span>{source.chunkCount ?? 0} chunks</span>
              {source.requiresOcr && (
                <>
                  <span>•</span>
                  <span className="text-amber-400 font-medium">Scanned (Needs OCR)</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <KnowledgeSourceStatusBadge status={source.ingestionStatus} />
          {onViewChunks && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewChunks(source)}
              className="h-7 px-2 text-xs text-zinc-300 border-zinc-700 hover:bg-zinc-800"
            >
              <Eye className="h-3.5 w-3.5 mr-1" />
              Chunks
            </Button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(source)}
              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
              title="Archive Document"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   4. IngestionProgressIndicator
   ───────────────────────────────────────────────────────────── */

export function IngestionProgressIndicator({
  stage,
  progressPercent = 100,
  details,
  className,
}: {
  stage: "idle" | "uploading" | "parsing" | "chunking" | "embedding" | "completed" | "error";
  progressPercent?: number;
  details?: string;
  className?: string;
}) {
  if (stage === "idle") return null;

  const stageLabels = {
    idle: "Ready",
    uploading: "Uploading payload to durable repository...",
    parsing: "Extracting structural sections and text...",
    chunking: "Semantic paragraph chunking & token counting...",
    embedding: "Generating dense vector embeddings...",
    completed: "Document successfully indexed!",
    error: "Ingestion halted with an error.",
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl border bg-zinc-900/80 space-y-2.5",
        stage === "error"
          ? "border-rose-500/30 text-rose-300"
          : stage === "completed"
          ? "border-emerald-500/30 text-emerald-300"
          : "border-indigo-500/30 text-indigo-300",
        className,
      )}
    >
      <div className="flex items-center justify-between text-xs font-medium">
        <div className="flex items-center gap-2">
          {stage === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : stage === "error" ? (
            <AlertCircle className="h-4 w-4 text-rose-400" />
          ) : (
            <Clock className="h-4 w-4 text-indigo-400 animate-spin" />
          )}
          <span>{stageLabels[stage]}</span>
        </div>
        <span className="font-mono">{progressPercent}%</span>
      </div>

      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={cn(
            "h-1.5 transition-all duration-300 rounded-full",
            stage === "error"
              ? "bg-rose-500"
              : stage === "completed"
              ? "bg-emerald-500"
              : "bg-indigo-500",
          )}
          style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
        />
      </div>

      {details && <p className="text-[11px] text-zinc-400">{details}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   5. DocumentUploadPanel
   ───────────────────────────────────────────────────────────── */

export function DocumentUploadPanel({
  onUpload,
  isUploading = false,
  collections = [],
  defaultCollectionId,
  className,
}: {
  onUpload: (data: {
    fileName: string;
    mimeType: string;
    fileBase64?: string;
    content?: string;
    collectionId?: string;
    description?: string;
  }) => Promise<void>;
  isUploading?: boolean;
  collections?: KnowledgeCollectionData[];
  defaultCollectionId?: string;
  className?: string;
}) {
  const [dragActive, setDragActive] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedCollection, setSelectedCollection] = React.useState<string>(
    defaultCollectionId || "",
  );
  const [description, setDescription] = React.useState("");
  const [textInput, setTextInput] = React.useState("");
  const [uploadMode, setUploadMode] = React.useState<"file" | "text">("file");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (files && files[0]) {
      setSelectedFile(files[0]);
    }
  };

  const handleSubmit = async () => {
    if (uploadMode === "file" && selectedFile) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await onUpload({
          fileName: selectedFile.name,
          mimeType: selectedFile.type || "application/octet-stream",
          fileBase64: base64,
          collectionId: selectedCollection || undefined,
          description: description || undefined,
        });
        setSelectedFile(null);
        setDescription("");
      };
      reader.readAsDataURL(selectedFile);
    } else if (uploadMode === "text" && textInput.trim()) {
      await onUpload({
        fileName: "manual-entry.txt",
        mimeType: "text/plain",
        content: textInput,
        collectionId: selectedCollection || undefined,
        description: description || undefined,
      });
      setTextInput("");
      setDescription("");
    }
  };

  return (
    <div
      className={cn(
        "p-5 rounded-xl border border-zinc-800 bg-zinc-900/70 space-y-4 shadow-xl",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Upload className="h-4 w-4 text-indigo-400" />
            Ingest Knowledge Document
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Supported: PDF, DOCX, Markdown, Text, HTML. Max size: 25MB.
          </p>
        </div>
        <div className="flex items-center rounded-lg bg-zinc-800 p-0.5 border border-zinc-700/60 text-xs">
          <button
            type="button"
            onClick={() => setUploadMode("file")}
            className={cn(
              "px-2.5 py-1 rounded font-medium transition-colors",
              uploadMode === "file" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            File Upload
          </button>
          <button
            type="button"
            onClick={() => setUploadMode("text")}
            className={cn(
              "px-2.5 py-1 rounded font-medium transition-colors",
              uploadMode === "text" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            Raw Text
          </button>
        </div>
      </div>

      {uploadMode === "file" ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center",
            dragActive
              ? "border-indigo-500 bg-indigo-500/10"
              : selectedFile
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-zinc-700/80 hover:border-zinc-600 bg-zinc-950/40",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.txt,.md,.markdown,.html"
            onChange={(e) => handleFiles(e.target.files)}
          />
          {selectedFile ? (
            <div className="space-y-1">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-medium text-zinc-100">{selectedFile.name}</p>
              <p className="text-xs text-zinc-400">
                {(selectedFile.size / 1024).toFixed(1)} KB — Click or drop another to replace
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 text-zinc-500 mx-auto" />
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  Click to select file or drag & drop here
                </p>
                <p className="text-xs text-zinc-500 mt-1">PDF, DOCX, TXT, MD, HTML (up to 25MB)</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Paste syllabus, institutional guidelines, or curriculum content here..."
            rows={5}
            className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {collections.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Target Collection</label>
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">No Collection (Unassigned)</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">
            Optional Description / Notes
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Official 2026-2027 Grade 9 Curriculum"
            className="w-full rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isUploading || (uploadMode === "file" ? !selectedFile : !textInput.trim())}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 font-medium"
        >
          {isUploading ? (
            <>
              <Clock className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              Ingesting Document...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Ingest & Index
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   6. ChunkPreviewPanel
   ───────────────────────────────────────────────────────────── */

export function ChunkPreviewPanel({
  chunks,
  documentTitle,
  onClose,
  className,
}: {
  chunks: ChunkPreviewData[];
  documentTitle?: string;
  onClose?: () => void;
  className?: string;
}) {
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredChunks = React.useMemo(() => {
    if (!searchTerm.trim()) return chunks;
    const term = searchTerm.toLowerCase();
    return chunks.filter(
      (c) =>
        c.content.toLowerCase().includes(term) ||
        (c.sectionHeading && c.sectionHeading.toLowerCase().includes(term)),
    );
  }, [chunks, searchTerm]);

  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/95 p-4 flex flex-col h-[550px] shadow-2xl",
        className,
      )}
    >
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-400" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Chunk Inspector: {documentTitle || "Document"}
            </h3>
            <p className="text-xs text-zinc-400">
              {chunks.length} chunks generated • Showing {filteredChunks.length}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="py-2.5">
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter chunk text or headings..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredChunks.map((chunk) => (
          <div
            key={chunk.id}
            className="p-3.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700 transition-colors space-y-2"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-indigo-400 text-[10px] font-semibold border border-zinc-700">
                  #{chunk.ordinal}
                </span>
                {chunk.sectionHeading && (
                  <span className="text-zinc-300 font-medium truncate max-w-[250px]">
                    {chunk.sectionHeading}
                  </span>
                )}
                {chunk.pageNumber && (
                  <span className="text-zinc-500 text-[11px]">p. {chunk.pageNumber}</span>
                )}
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">{chunk.tokenCount} tokens</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans bg-zinc-900/30 p-2.5 rounded border border-zinc-800/40 select-text">
              {chunk.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   7. SemanticSearchPanel
   ───────────────────────────────────────────────────────────── */

export function SemanticSearchPanel({
  onSearch,
  isSearching = false,
  collections = [],
  className,
}: {
  onSearch: (params: {
    query: string;
    mode: "hybrid" | "semantic" | "keyword";
    collectionIds?: string[];
    minScore?: number;
    limit?: number;
  }) => Promise<void>;
  isSearching?: boolean;
  collections?: KnowledgeCollectionData[];
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<"hybrid" | "semantic" | "keyword">("hybrid");
  const [selectedCollection, setSelectedCollection] = React.useState<string>("");
  const [minScore, setMinScore] = React.useState<number>(0.2);
  const [showFilters, setShowFilters] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch({
      query: query.trim(),
      mode,
      collectionIds: selectedCollection ? [selectedCollection] : undefined,
      minScore,
    });
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl border border-zinc-800 bg-zinc-900/70 space-y-3 shadow-lg",
        className,
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search curriculum, learning standards, institutional guidelines..."
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-lg bg-zinc-950/60 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <Button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4"
          >
            {isSearching ? <Clock className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "text-xs px-3 border-zinc-700",
              showFilters ? "bg-zinc-800 text-indigo-400 border-indigo-500/50" : "text-zinc-400",
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>

        {showFilters && (
          <div className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-zinc-400 font-medium mb-1">Search Strategy</label>
              <div className="flex rounded bg-zinc-900 p-0.5 border border-zinc-800">
                {(["hybrid", "semantic", "keyword"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "flex-1 py-1 capitalize rounded text-[11px] font-medium transition-colors",
                      mode === m ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {collections.length > 0 && (
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Collection Filter</label>
                <select
                  value={selectedCollection}
                  onChange={(e) => setSelectedCollection(e.target.value)}
                  className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1 text-xs text-zinc-300"
                >
                  <option value="">All Collections</option>
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-zinc-400 font-medium mb-1">
                <span>Min Similarity Score</span>
                <span className="font-mono text-indigo-400">{Math.round(minScore * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={minScore}
                onChange={(e) => setMinScore(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   8. RetrievalResultCard
   ───────────────────────────────────────────────────────────── */

export function RetrievalResultCard({
  result,
  onViewSource,
  className,
}: {
  result: RetrievalResultData;
  onViewSource?: (res: RetrievalResultData) => void;
  className?: string;
}) {
  const percentScore = Math.round(result.relevanceScore * 100);

  return (
    <Card
      className={cn(
        "p-4 bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 transition-all duration-200 space-y-2.5 shadow-md",
        className,
      )}
    >
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-400" />
          <h4 className="font-semibold text-zinc-100 truncate max-w-[320px]">
            {result.documentTitle}
          </h4>
          {result.sectionHeading && (
            <span className="text-zinc-400 font-normal">› {result.sectionHeading}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full font-mono text-[11px] font-semibold",
              percentScore >= 70
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : percentScore >= 40
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700",
            )}
          >
            {percentScore}% match
          </span>
          <span className="capitalize text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
            {result.retrievalMethod}
          </span>
        </div>
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/80 font-sans select-text">
        {result.content}
      </p>

      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1">
        <span className="font-mono text-zinc-500">{result.citationReference}</span>
        {onViewSource && (
          <button
            type="button"
            onClick={() => onViewSource(result)}
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
          >
            Inspect Chunk <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────
   9. CitationReferenceBadge
   ───────────────────────────────────────────────────────────── */

export function CitationReferenceBadge({
  citation,
  onClick,
  className,
}: {
  citation: CitationReferenceData;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
        citation.isValid
          ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/20"
          : "bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20",
        className,
      )}
      title={
        citation.isValid
          ? "Institutional Citation Verified"
          : citation.validationError || "Unverified Citation"
      }
    >
      {citation.isValid ? (
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
      )}
      <span className="font-semibold text-zinc-200">[{citation.documentTitle}</span>
      {citation.sectionHeading && <span>• {citation.sectionHeading}</span>}
      {citation.pageNumber && <span>• p. {citation.pageNumber}</span>}
      <span>]</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────
   10. CitationSourceDrawer
   ───────────────────────────────────────────────────────────── */

export function CitationSourceDrawer({
  citation,
  isOpen,
  onClose,
  className,
}: {
  citation: CitationReferenceData | null;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}) {
  if (!isOpen || !citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className={cn(
          "w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150",
          className,
        )}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Institutional Grounding Citation</h3>
              <p className="text-xs text-zinc-400">Verified against source repository chunks</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 space-y-1.5">
            <div className="text-zinc-400 font-medium">Source Document:</div>
            <div className="text-zinc-100 font-semibold text-sm">{citation.documentTitle}</div>
            <div className="flex items-center gap-3 text-zinc-400">
              {citation.sectionHeading && <span>Section: {citation.sectionHeading}</span>}
              {citation.pageNumber && <span>Page: {citation.pageNumber}</span>}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-zinc-400 font-medium">Cited Passage / Verification Snippet:</div>
            <div className="p-3.5 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-200 leading-relaxed font-sans select-text">
              {citation.exactSnippet || "Verified curriculum standard reference."}
            </div>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded bg-indigo-500/5 border border-indigo-500/20 text-indigo-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Status: Verified Institutional Grounding
            </span>
            <span className="font-mono text-[11px] text-zinc-400">ID: {citation.chunkId.slice(0, 8)}</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

