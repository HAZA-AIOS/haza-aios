import { createHash } from "node:crypto";
import type {
  ChunkingOptions,
  ExtractedDocument,
  TextChunk,
} from "../knowledge.types.js";

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 150;
const MIN_CHUNK_SIZE = 100;

export class ChunkingEngine {
  static chunkDocument(
    document: ExtractedDocument,
    sourceId: string,
    options: ChunkingOptions = {},
  ): TextChunk[] {
    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const chunkOverlap = Math.min(options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP, Math.floor(chunkSize / 2));

    const chunks: TextChunk[] = [];
    let ordinal = 0;
    const seenHashes = new Set<string>();

    for (const section of document.sections) {
      const sectionText = section.text.trim();
      if (!sectionText) continue;

      if (sectionText.length <= chunkSize) {
        // Section fits in single chunk
        const contentHash = this.computeHash(sectionText);
        if (!seenHashes.has(contentHash)) {
          seenHashes.add(contentHash);
          chunks.push({
            id: this.generateChunkId(sourceId, ordinal, sectionText),
            ordinal,
            content: sectionText,
            sectionHeading: section.heading,
            pageNumber: section.pageNumber,
            tokenCount: this.estimateTokens(sectionText),
            contentHash,
          });
          ordinal++;
        }
        continue;
      }

      // Split large section on paragraph boundaries
      const paragraphs = sectionText.split(/\n\n+/);
      let currentChunkText = "";

      for (const paragraph of paragraphs) {
        const trimmedPara = paragraph.trim();
        if (!trimmedPara) continue;

        if (currentChunkText.length + trimmedPara.length + 2 <= chunkSize) {
          currentChunkText += (currentChunkText ? "\n\n" : "") + trimmedPara;
        } else {
          // If currentChunkText is already populated, emit it
          if (currentChunkText.length >= MIN_CHUNK_SIZE) {
            const contentHash = this.computeHash(currentChunkText);
            if (!seenHashes.has(contentHash)) {
              seenHashes.add(contentHash);
              chunks.push({
                id: this.generateChunkId(sourceId, ordinal, currentChunkText),
                ordinal,
                content: currentChunkText,
                sectionHeading: section.heading,
                pageNumber: section.pageNumber,
                tokenCount: this.estimateTokens(currentChunkText),
                contentHash,
              });
              ordinal++;
            }

            // Carry overlap from end of currentChunkText
            const overlapText = this.getOverlap(currentChunkText, chunkOverlap);
            currentChunkText = overlapText ? `${overlapText}\n\n${trimmedPara}` : trimmedPara;
          } else {
            currentChunkText = trimmedPara;
          }

          // If a single paragraph is longer than chunkSize, split on sentences
          while (currentChunkText.length > chunkSize) {
            const splitPoint = this.findSentenceBreak(currentChunkText, chunkSize);
            const subChunk = currentChunkText.slice(0, splitPoint).trim();
            const remainder = currentChunkText.slice(splitPoint).trim();

            if (subChunk.length >= MIN_CHUNK_SIZE) {
              const contentHash = this.computeHash(subChunk);
              if (!seenHashes.has(contentHash)) {
                seenHashes.add(contentHash);
                chunks.push({
                  id: this.generateChunkId(sourceId, ordinal, subChunk),
                  ordinal,
                  content: subChunk,
                  sectionHeading: section.heading,
                  pageNumber: section.pageNumber,
                  tokenCount: this.estimateTokens(subChunk),
                  contentHash,
                });
                ordinal++;
              }
            }

            const overlap = this.getOverlap(subChunk, chunkOverlap);
            currentChunkText = overlap ? `${overlap} ${remainder}` : remainder;
          }
        }
      }

      // Emit trailing chunk for section
      if (currentChunkText.trim().length >= MIN_CHUNK_SIZE) {
        const text = currentChunkText.trim();
        const contentHash = this.computeHash(text);
        if (!seenHashes.has(contentHash)) {
          seenHashes.add(contentHash);
          chunks.push({
            id: this.generateChunkId(sourceId, ordinal, text),
            ordinal,
            content: text,
            sectionHeading: section.heading,
            pageNumber: section.pageNumber,
            tokenCount: this.estimateTokens(text),
            contentHash,
          });
          ordinal++;
        }
      }
    }

    // Fallback if entire document yielded no chunks
    if (chunks.length === 0 && document.text.trim()) {
      const fallbackText = document.text.trim().slice(0, chunkSize);
      const hash = this.computeHash(fallbackText);
      chunks.push({
        id: this.generateChunkId(sourceId, 0, fallbackText),
        ordinal: 0,
        content: fallbackText,
        sectionHeading: document.title,
        tokenCount: this.estimateTokens(fallbackText),
        contentHash: hash,
      });
    }

    return chunks;
  }

  private static findSentenceBreak(text: string, targetLength: number): number {
    const window = text.slice(Math.floor(targetLength * 0.7), targetLength + 50);
    const sentenceEndings = window.matchAll(/([.!?])\s+/g);
    let bestIndex = -1;

    for (const match of sentenceEndings) {
      if (match.index !== undefined) {
        bestIndex = Math.floor(targetLength * 0.7) + match.index + 1;
      }
    }

    if (bestIndex > 0) return bestIndex;

    // Fallback to space
    const lastSpace = text.lastIndexOf(" ", targetLength);
    if (lastSpace > targetLength * 0.5) return lastSpace;

    return targetLength;
  }

  private static getOverlap(text: string, overlapLength: number): string {
    if (text.length <= overlapLength) return "";
    const slice = text.slice(-overlapLength);
    const firstSpace = slice.indexOf(" ");
    return firstSpace >= 0 ? slice.slice(firstSpace + 1) : slice;
  }

  private static estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private static computeHash(text: string): string {
    return createHash("sha256").update(text).digest("hex");
  }

  private static generateChunkId(sourceId: string, ordinal: number, content: string): string {
    const raw = `${sourceId}:${ordinal}:${content.slice(0, 50)}`;
    const hash = createHash("sha256").update(raw).digest("hex").slice(0, 16);
    return `chunk-${hash}`;
  }
}

