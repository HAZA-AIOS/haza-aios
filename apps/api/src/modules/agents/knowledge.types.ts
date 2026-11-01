export type KnowledgeVisibility = "organization" | "workspace" | "private";
export type KnowledgeSourceStatus = "active" | "archived" | "deleted";
export type KnowledgeIngestionStatus =
  | "pending"
  | "extracting"
  | "chunking"
  | "embedding"
  | "ready"
  | "failed";

export type SupportedDocumentType = "pdf" | "docx" | "txt" | "markdown" | "html";

export interface KnowledgeAccessPolicy {
  allowedRoles?: string[];
  deniedRoles?: string[];
  allowPublicRead?: boolean;
  [key: string]: unknown;
}

export interface KnowledgeCollectionRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  industry: string;
  visibility: KnowledgeVisibility;
  accessPolicy: KnowledgeAccessPolicy | null;
  status: KnowledgeSourceStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateKnowledgeCollectionInput {
  name: string;
  slug?: string;
  description?: string;
  industry?: string;
  visibility?: KnowledgeVisibility;
  accessPolicy?: KnowledgeAccessPolicy;
}

export interface UpdateKnowledgeCollectionInput {
  name?: string;
  description?: string;
  industry?: string;
  visibility?: KnowledgeVisibility;
  accessPolicy?: KnowledgeAccessPolicy;
  status?: KnowledgeSourceStatus;
}

export interface KnowledgeSourceRecord {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  collectionId: string | null;
  name: string;
  description: string;
  type: "text" | "document" | "structured";
  visibility: "internal" | "private";
  status: "active" | "archived";
  content: string;
  contentHash: string;
  ingestionStatus: KnowledgeIngestionStatus;
  fileName: string | null;
  fileType: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  storageUri: string | null;
  storageBackend: string;
  currentVersion: number;
  metadata: Record<string, unknown> | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeChunkRecord {
  id: string;
  sourceId: string;
  organizationId: string;
  workspaceId: string | null;
  ordinal: number;
  sectionHeading: string | null;
  pageNumber: number | null;
  tokenCount: number;
  contentHash: string | null;
  content: string;
}

export interface KnowledgeDocumentRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  sourceId: string;
  version: number;
  contentType: string;
  rawContent: string | null;
  contentHash: string;
  checksum: string;
  createdAt: Date;
}

export interface KnowledgeEmbeddingRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  sourceId: string;
  chunkId: string;
  provider: string;
  model: string;
  dimensions: number;
  embedding: number[];
  contentHash: string;
  createdAt: Date;
}

export interface KnowledgeRetrievalRecord {
  id: string;
  organizationId: string;
  workspaceId: string;
  agentId: string | null;
  runId: string | null;
  query: string;
  retrievalMode: "hybrid" | "semantic" | "keyword";
  matchedChunkIds: string[];
  scores: Record<string, number>;
  latencyMs: number;
  requestedBy: string;
  createdAt: Date;
}

export interface ExtractedDocument {
  text: string;
  title: string;
  fileType: SupportedDocumentType;
  pageCount?: number;
  sections: Array<{
    heading: string;
    text: string;
    pageNumber?: number;
  }>;
  requiresOcr?: boolean;
}

export interface TextChunk {
  id: string;
  ordinal: number;
  content: string;
  sectionHeading?: string;
  pageNumber?: number;
  tokenCount: number;
  contentHash: string;
}

export interface ChunkingOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface RetrievalResultItem {
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

export interface RetrievalQueryInput {
  query: string;
  collectionIds?: string[];
  sourceIds?: string[];
  limit?: number;
  minScore?: number;
  mode?: "hybrid" | "semantic" | "keyword";
  searchMode?: "hybrid" | "semantic" | "keyword";
  workspaceId?: string;
}

export interface CitationReference {
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

export interface GroundedContextPackage {
  retrievedChunks: RetrievalResultItem[];
  formattedContext: string;
  citations: CitationReference[];
  tokenEstimate: number;
  semanticIndexingAvailable: boolean;
}
