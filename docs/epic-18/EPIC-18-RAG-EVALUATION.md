# HAZA-AIOS — EPIC 18 RAG & SEMANTIC RETRIEVAL EVALUATION
## Multi-Provider Embeddings, Dimension Compatibility & Grounded Responses

**Document ID:** `HAZA-EPIC-18-RAG-001`  
**Target Release:** `v0.18.0-epic18`  
**Classification:** `TECHNICAL EVALUATION & QUALITY REPORT`  
**Status:** `VERIFIED`  
**Author:** Antigravity AI Systems Architect & NLP Research Engineer  
**Date:** 2026-11-02  

---

## 1. Executive Summary & Evaluation Scope

In Epic 17, the Agent Knowledge & Context Engine established hybrid lexical (BM25) and semantic vector search with deterministic mock embeddings.

Epic 18 advances the system with **production live embeddings (OpenAI `text-embedding-3-small`, 1536-dimensions)**, explicit tenant policy control, zero-leak embedding space separation, dimension compatibility checks, and controlled collection re-indexing.

---

## 2. Strict Embedding Space Isolation Guarantee

A fundamental flaw in naive RAG systems is mixing embedding vectors produced by different models or dimensionalities in the same cosine similarity calculation. 

$$\text{Cosine}(u, v) = \frac{u \cdot v}{\|u\| \|v\|}$$

If $\dim(u) \neq \dim(v)$, the mathematical dot product is undefined. Furthermore, comparing vectors trained on different semantic manifolds produces invalid distances.

### Architectural Invariant:
In `HybridSearchService`, candidate chunks are verified before semantic scoring:
```ts
if (
  row.provider === embeddingProvider.id &&
  row.dimensions === embeddingProvider.dimensions &&
  row.embedding.length === queryVector.length
) {
  chunkEmbeddingsMap.set(row.chunkId, row.embedding);
}
```
**Guarantee:** Vectors produced by different providers (e.g. `mock` 64-dim vs `openai` 1536-dim) are **never mixed**. Incompatible chunks are scored exclusively via lexical BM25 matching, preserving 100% retrieval integrity without errors or false positives.

---

## 3. Policy-Controlled Embedding Selection

Automatic provider guessing has been replaced with explicit policy-controlled selection in `EmbeddingProviderRegistry`:
- **Default Policy:** Deterministic mock provider (`MockEmbeddingProvider`, 64-dim) is active by default.
- **Live Activation Gate:** Live semantic embeddings (`OpenAiEmbeddingProvider`, 1536-dim) are engaged only when the tenant explicitly enables `embeddingLiveEnabled: true` and credentials have been verified.
- **Fail-Safe Fallback:** If live credentials are removed or expired, the registry falls back to mock mode without breaking search availability.

---

## 4. Controlled Collection Re-Indexing Pipeline

When an organization migrates from mock to live embeddings (or upgrades models):
1. **Endpoint:** `POST /api/v1/organizations/:orgId/knowledge/collections/:colId/reindex`
2. **Execution Steps:**
   - Retrieves all active sources and chunks within the collection.
   - Generates new embedding vectors using the selected target provider.
   - Atomically deletes obsolete embedding vectors for those chunk IDs.
   - Inserts newly generated vectors with updated `provider`, `model`, and `dimensions` metadata.
3. **Zero Downtime:** Lexical search remains active throughout the reindexing process.

---

## 5. Source Provenance, Deletion & Permission Invalidation

### 5.1 Immutable Provenance
Every chunk retained in `knowledge_chunks` preserves:
- Source document title (`documentTitle`).
- Chunk sequence ordinal (`ordinal`).
- Structural section heading (`sectionHeading`).
- Page number (`pageNumber`).
- SHA-256 content checksum (`contentHash`).

### 5.2 Cascade Deletion
When a knowledge source is permanently deleted via `DELETE /api/v1/organizations/:orgId/knowledge/sources/:sourceId`:
- MySQL foreign key constraints (`ON DELETE CASCADE`) automatically purge all associated chunks, documents, and embeddings.
- In-memory retrieval caches are invalidated immediately.

---

## 6. Grounded Response & Citation Verification

The Academic Planning Assistant grounds Grade 6 Science lesson plans directly against the Demo Academy curriculum:
- **Test Query:** "Shared cell structures in plant and animal cells"
- **Retrieved Chunk:** Section `Cell Structure & Organelles`
- **Generated Attribution:** `[Doc: Grade 6 Science Curriculum Standards, Chunk: c0000000-0000-4710-8000-000000000001]`
- **Citation Validator:** Checks that 100% of generated claims correspond to real chunks in the retrieved context package.
