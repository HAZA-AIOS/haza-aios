import { randomUUID } from "node:crypto";
import type { CitationReference, RetrievalResultItem } from "../knowledge.types.js";

export class CitationValidatorService {
  /**
   * Extracts and validates inline citations from agent response text
   * against the set of retrieved chunks present in the context package.
   */
  static validateCitations(
    responseText: string,
    retrievedChunks: RetrievalResultItem[],
  ): {
    citations: CitationReference[];
    validCount: number;
    invalidCount: number;
    groundednessScore: number;
  } {
    const citations: CitationReference[] = [];
    const chunkMap = new Map<string, RetrievalResultItem>();
    const titleMap = new Map<string, RetrievalResultItem[]>();

    for (const chunk of retrievedChunks) {
      chunkMap.set(chunk.chunkId, chunk);
      const lowerTitle = chunk.documentTitle.toLowerCase();
      if (!titleMap.has(lowerTitle)) {
        titleMap.set(lowerTitle, []);
      }
      titleMap.get(lowerTitle)!.push(chunk);
    }

    // Regex matching: [Doc: Title, Chunk: chunk-xyz] or [Doc: Title] or [Source: Title, Section: xyz]
    const citationRegex = /\[(?:Doc|Source):\s*([^,\]]+)(?:,\s*(?:Chunk|Section|Page):\s*([^\]]+))?\]/gi;
    let match: RegExpExecArray | null;
    const seenCitations = new Set<string>();

    while ((match = citationRegex.exec(responseText)) !== null) {
      const fullCitation = match[0];
      if (seenCitations.has(fullCitation)) continue;
      seenCitations.add(fullCitation);

      const matchedTitle = match[1].trim();
      const matchedRef = match[2]?.trim();

      // Check if chunk ID directly matched
      let resolvedChunk: RetrievalResultItem | undefined;

      if (matchedRef && chunkMap.has(matchedRef)) {
        resolvedChunk = chunkMap.get(matchedRef);
      } else if (titleMap.has(matchedTitle.toLowerCase())) {
        const candidates = titleMap.get(matchedTitle.toLowerCase())!;
        resolvedChunk = candidates[0];
      }

      if (resolvedChunk) {
        citations.push({
          citationId: randomUUID(),
          documentTitle: resolvedChunk.documentTitle,
          sourceId: resolvedChunk.sourceId,
          chunkId: resolvedChunk.chunkId,
          sectionHeading: resolvedChunk.sectionHeading,
          pageNumber: resolvedChunk.pageNumber,
          exactSnippet: resolvedChunk.content.slice(0, 150),
          isValid: true,
        });
      } else {
        citations.push({
          citationId: randomUUID(),
          documentTitle: matchedTitle,
          sourceId: "unverified",
          chunkId: matchedRef || "unknown",
          isValid: false,
          validationError: `Referenced document '${matchedTitle}' or chunk was not present in authorized retrieved context.`,
        });
      }
    }

    const validCount = citations.filter((c) => c.isValid).length;
    const invalidCount = citations.filter((c) => !c.isValid).length;

    const groundednessScore =
      citations.length > 0 ? Number((validCount / citations.length).toFixed(2)) : 1.0;

    return {
      citations,
      validCount,
      invalidCount,
      groundednessScore,
    };
  }
}

