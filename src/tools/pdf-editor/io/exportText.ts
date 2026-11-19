/**
 * Plain-text export (M4-4).
 *
 * Reuses the structure pass so headings and lists survive as readable text instead of one line per
 * PDF row. No HTML, no docx: this is what users paste into a ticket or a translation tool.
 */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ToolResult } from '@/core/types';
import { extractPageStructure, type StructureBlock } from './pdfStructure';

/** Flatten blocks into plain text with blank lines between blocks */
export function blocksToPlainText(blocks: readonly StructureBlock[]): string {
  return blocks
    .map((block) => {
      if (block.kind === 'list') {
        return block.items
          .map((item, index) => (block.ordered ? `${index + 1}. ${item}` : `- ${item}`))
          .join('\n');
      }
      return block.text;
    })
    .join('\n\n');
}

/** Join per-page text with a blank line; empty pages contribute nothing */
export function joinPageTexts(pageTexts: readonly string[]): string {
  return pageTexts.filter((text) => text.trim().length > 0).join('\n\n');
}

export function textFileName(docName: string): string {
  const base = docName.replace(/\.pdf$/i, '').trim() || 'document';
  return `${base}.txt`;
}

/** Download-ready UTF-8 bytes (no BOM: the editor's own imports strip BOM anyway) */
export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export interface PdfTextExport {
  text: string;
  lines: number;
  /** Pages that had no text layer; the caller reports them as a fidelity loss */
  emptyPages: number[];
}

/** Structure every requested page and concatenate the plain text */
export async function collectPdfText(
  pdfDoc: PDFDocumentProxy,
  pageNumbers: readonly number[],
): Promise<ToolResult<PdfTextExport>> {
  if (pageNumbers.length === 0) return { ok: false, error: 'NO_PAGES' };

  const pageTexts: string[] = [];
  const emptyPages: number[] = [];
  let lines = 0;

  for (const pageNumber of pageNumbers) {
    const page = await extractPageStructure(pdfDoc, pageNumber);
    lines += page.lineCount;
    if (page.lineCount === 0) {
      emptyPages.push(pageNumber);
      continue;
    }
    pageTexts.push(blocksToPlainText(page.blocks));
  }

  return { ok: true, value: { text: joinPageTexts(pageTexts), lines, emptyPages } };
}
