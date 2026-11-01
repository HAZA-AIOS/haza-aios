import { inflateSync } from "node:zlib";
import { ApiError } from "../../../common/errors/api-error.js";
import type { ExtractedDocument, SupportedDocumentType } from "../knowledge.types.js";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_EXTRACTED_CHARS = 500_000;

export class DocumentExtractor {
  static extract(
    buffer: Buffer,
    fileName: string,
    declaredMimeType?: string,
  ): ExtractedDocument {
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new ApiError(
        400,
        "PAYLOAD_TOO_LARGE",
        `Document exceeds maximum supported size of 15 MB (actual: ${(buffer.length / 1024 / 1024).toFixed(2)} MB).`,
      );
    }

    const fileType = this.detectFileType(buffer, fileName, declaredMimeType);

    switch (fileType) {
      case "txt":
        return this.extractPlainText(buffer, fileName);
      case "markdown":
        return this.extractMarkdown(buffer, fileName);
      case "html":
        return this.extractHtml(buffer, fileName);
      case "docx":
        return this.extractDocx(buffer, fileName);
      case "pdf":
        return this.extractPdf(buffer, fileName);
      default:
        throw new ApiError(400, "VALIDATION_FAILED", `Unsupported file format: ${fileName}`);
    }
  }

  static detectFileType(
    buffer: Buffer,
    fileName: string,
    mimeType?: string,
  ): SupportedDocumentType {
    const ext = fileName.split(".").pop()?.toLowerCase();

    // Magic bytes check for PDF
    if (buffer.length >= 4 && buffer.slice(0, 4).toString("ascii") === "%PDF") {
      return "pdf";
    }

    // Magic bytes check for DOCX (ZIP format: PK\x03\x04)
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04 &&
      (ext === "docx" || mimeType?.includes("wordprocessingml"))
    ) {
      return "docx";
    }

    if (ext === "md" || ext === "markdown" || mimeType === "text/markdown") {
      return "markdown";
    }

    if (ext === "html" || ext === "htm" || mimeType === "text/html") {
      return "html";
    }

    if (ext === "pdf" || mimeType === "application/pdf") {
      return "pdf";
    }

    if (ext === "docx") {
      return "docx";
    }

    return "txt";
  }

  private static extractPlainText(buffer: Buffer, fileName: string): ExtractedDocument {
    const raw = buffer.toString("utf-8");
    const normalized = this.normalizeText(raw);
    const title = this.cleanTitle(fileName);

    return {
      text: normalized,
      title,
      fileType: "txt",
      sections: [{ heading: "General", text: normalized }],
    };
  }

  private static extractMarkdown(buffer: Buffer, fileName: string): ExtractedDocument {
    const raw = buffer.toString("utf-8");
    const normalized = this.normalizeText(raw);
    const title = this.cleanTitle(fileName);

    const sections: Array<{ heading: string; text: string }> = [];
    const lines = normalized.split("\n");
    let currentHeading = "Overview";
    let currentLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headingMatch) {
        if (currentLines.length > 0) {
          sections.push({
            heading: currentHeading,
            text: currentLines.join("\n").trim(),
          });
          currentLines = [];
        }
        currentHeading = headingMatch[1].trim();
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      sections.push({
        heading: currentHeading,
        text: currentLines.join("\n").trim(),
      });
    }

    return {
      text: normalized,
      title,
      fileType: "markdown",
      sections: sections.length > 0 ? sections : [{ heading: "Document", text: normalized }],
    };
  }

  private static extractHtml(buffer: Buffer, fileName: string): ExtractedDocument {
    const raw = buffer.toString("utf-8");
    const title = this.cleanTitle(fileName);

    // Strip scripts and styles
    let cleaned = raw
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

    // Extract headings and paragraphs
    cleaned = cleaned
      .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\n\n### $1\n\n")
      .replace(/<p[^>]*>/gi, "\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, " ");

    // Decode HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    const normalized = this.normalizeText(cleaned);

    return {
      text: normalized,
      title,
      fileType: "html",
      sections: [{ heading: "Content", text: normalized }],
    };
  }

  private static extractDocx(buffer: Buffer, fileName: string): ExtractedDocument {
    const title = this.cleanTitle(fileName);
    try {
      // Parse ZIP directory to find word/document.xml
      const xmlContent = this.extractFileFromZip(buffer, "word/document.xml");
      if (!xmlContent) {
        throw new Error("Could not find word/document.xml in DOCX archive.");
      }

      const xmlText = xmlContent.toString("utf-8");

      // Extract paragraphs (<w:p>) and text (<w:t>)
      const paragraphRegex = /<w:p\b[^>]*>(.*?)<\/w:p>/gs;
      const textRegex = /<w:t\b[^>]*>(.*?)<\/w:t>/gs;
      const headingRegex = /<w:pStyle\s+w:val="Heading(\d)"/i;

      const paragraphs: string[] = [];
      const sections: Array<{ heading: string; text: string }> = [];
      let currentHeading = "General";
      let currentSectionLines: string[] = [];

      let pMatch: RegExpExecArray | null;
      while ((pMatch = paragraphRegex.exec(xmlText)) !== null) {
        const pXml = pMatch[1];
        let pText = "";
        let tMatch: RegExpExecArray | null;
        while ((tMatch = textRegex.exec(pXml)) !== null) {
          pText += tMatch[1];
        }

        pText = pText.trim();
        if (!pText) continue;

        const isHeading = headingRegex.test(pXml) || pXml.includes("w:styleId=\"Heading");
        if (isHeading) {
          if (currentSectionLines.length > 0) {
            sections.push({
              heading: currentHeading,
              text: currentSectionLines.join("\n").trim(),
            });
            currentSectionLines = [];
          }
          currentHeading = pText;
        } else {
          currentSectionLines.push(pText);
        }

        paragraphs.push(pText);
      }

      if (currentSectionLines.length > 0) {
        sections.push({
          heading: currentHeading,
          text: currentSectionLines.join("\n").trim(),
        });
      }

      const normalized = this.normalizeText(paragraphs.join("\n\n"));

      return {
        text: normalized,
        title,
        fileType: "docx",
        sections: sections.length > 0 ? sections : [{ heading: "Content", text: normalized }],
      };
    } catch (err: any) {
      throw new ApiError(
        400,
        "BAD_REQUEST",
        `Failed to extract text from DOCX document: ${err.message}`,
      );
    }
  }

  private static extractPdf(buffer: Buffer, fileName: string): ExtractedDocument {
    const title = this.cleanTitle(fileName);
    const pdfString = buffer.toString("binary");

    // Check for text-producing stream operators
    const textChunks: string[] = [];
    let pageCount = 0;

    // Split on /Page objects or scan streams
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let streamMatch: RegExpExecArray | null;

    while ((streamMatch = streamRegex.exec(pdfString)) !== null) {
      let streamData = streamMatch[1];

      // Try decompression if FlateDecode
      const precedingIndex = Math.max(0, streamMatch.index - 300);
      const precedingContext = pdfString.slice(precedingIndex, streamMatch.index);

      if (precedingContext.includes("/FlateDecode")) {
        try {
          const rawBuffer = Buffer.from(streamData, "binary");
          const decompressed = inflateSync(rawBuffer);
          streamData = decompressed.toString("latin1");
        } catch {
          // If inflation fails, continue with raw streamData
        }
      }

      // Parse PDF Text Operators: BT (Begin Text) ... ET (End Text)
      const btEtRegex = /BT[\r\n\s]+([\s\S]*?)[\r\n\s]+ET/g;
      let textBlockMatch: RegExpExecArray | null;

      while ((textBlockMatch = btEtRegex.exec(streamData)) !== null) {
        const textBlock = textBlockMatch[1];

        // Extract (string) Tj or [(str1)(str2)] TJ
        const tjRegex = /\(([^)]*)\)\s*Tj/g;
        let tjMatch: RegExpExecArray | null;
        while ((tjMatch = tjRegex.exec(textBlock)) !== null) {
          const unescaped = this.unescapePdfString(tjMatch[1]);
          if (unescaped.trim()) textChunks.push(unescaped);
        }

        const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
        let arrayMatch: RegExpExecArray | null;
        while ((arrayMatch = arrayTjRegex.exec(textBlock)) !== null) {
          const arrayContent = arrayMatch[1];
          const innerTjRegex = /\(([^)]*)\)/g;
          let innerMatch: RegExpExecArray | null;
          let combinedStr = "";
          while ((innerMatch = innerTjRegex.exec(arrayContent)) !== null) {
            combinedStr += this.unescapePdfString(innerMatch[1]);
          }
          if (combinedStr.trim()) textChunks.push(combinedStr);
        }
      }
    }

    const rawExtracted = textChunks.join(" ");
    const normalized = this.normalizeText(rawExtracted);

    // If no text was extracted or text is too short, flag requiresOcr
    const requiresOcr = normalized.length < 50;

    if (requiresOcr) {
      return {
        text: "Scanned PDF document contains no digital text stream. OCR processing is required.",
        title,
        fileType: "pdf",
        pageCount: 1,
        requiresOcr: true,
        sections: [
          {
            heading: "Scanned Document",
            text: "Scanned PDF document contains no digital text stream. OCR processing is required.",
          },
        ],
      };
    }

    return {
      text: normalized,
      title,
      fileType: "pdf",
      pageCount: Math.max(1, pageCount),
      requiresOcr: false,
      sections: [{ heading: "Page Content", text: normalized }],
    };
  }

  private static unescapePdfString(str: string): string {
    return str
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\b/g, "\b")
      .replace(/\\f/g, "\f")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");
  }

  private static extractFileFromZip(zipBuffer: Buffer, targetPath: string): Buffer | null {
    let offset = 0;
    while (offset < zipBuffer.length - 30) {
      // Local file header signature 0x04034b50
      if (
        zipBuffer[offset] === 0x50 &&
        zipBuffer[offset + 1] === 0x4b &&
        zipBuffer[offset + 2] === 0x03 &&
        zipBuffer[offset + 3] === 0x04
      ) {
        const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
        const compressedSize = zipBuffer.readUInt32LE(offset + 18);
        const fileNameLength = zipBuffer.readUInt16LE(offset + 26);
        const extraFieldLength = zipBuffer.readUInt16LE(offset + 28);

        const currentFileName = zipBuffer
          .slice(offset + 30, offset + 30 + fileNameLength)
          .toString("utf-8");
        const dataOffset = offset + 30 + fileNameLength + extraFieldLength;

        if (currentFileName === targetPath) {
          const compressedData = zipBuffer.slice(dataOffset, dataOffset + compressedSize);
          if (compressionMethod === 0) {
            return compressedData; // Stored (no compression)
          } else if (compressionMethod === 8) {
            // Deflate
            return inflateSync(compressedData);
          }
        }

        offset = dataOffset + compressedSize;
      } else {
        offset++;
      }
    }
    return null;
  }

  private static normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\0/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .slice(0, MAX_EXTRACTED_CHARS)
      .trim();
  }

  private static cleanTitle(fileName: string): string {
    return fileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }
}
