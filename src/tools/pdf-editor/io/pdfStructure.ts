/**
 * PDF text layer → document structure (M4-2).
 *
 * The docx export needs more than "one paragraph per line": a 14-page contract would turn into 600
 * paragraphs and read badly in Word. Rules applied here, in order:
 *
 * - the median font size is the body size; clearly larger lines become headings;
 * - lines starting with a bullet / number become list items and consecutive items form one list;
 * - body lines that continue a paragraph (same indent, small vertical gap) are joined, with CJK
 *   neighbours joined without a space;
 * - an indent jump of more than two body lines starts a new paragraph (columns, quotes).
 *
 * Everything is pure and unit tested; `extractPageStructure` is the only pdfjs-aware helper.
 */

import { escapeHtml } from '@/core/docx/html';
import { getPageTextLines, type TextLine } from '@/core/pdf/textLines';

export type StructureBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] };

export interface PageStructure {
  html: string;
  blocks: StructureBlock[];
  /** Number of text lines the structure was derived from (0 ⇒ scanned page) */
  lineCount: number;
}

const LIST_PATTERN = /^\s*(?:[-•·*–—]|(\d{1,3})\s*[.)、]|\((\d{1,3})\))\s+/;
const CJK = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/;

/**
 * Body font size = the most common size on the page.
 *
 * A median is wrong on a title page (three headings outvote one body paragraph), while the mode is
 * exactly "what most glyphs use". Ties go to the smaller size, which is the body in every layout
 * where a heading and its text appear once each.
 */
function bodyFontSize(lines: readonly TextLine[]): number {
  const counts = new Map<number, number>();
  for (const line of lines) {
    // Half-point buckets absorb rounding noise between items of the same paragraph
    const size = Math.round(line.fontSize * 2) / 2;
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [size, count] of counts) {
    if (count > bestCount || (count === bestCount && size < best)) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}

function endsWithCjk(value: string): boolean {
  return CJK.test(value.slice(-1));
}

function startsWithCjk(value: string): boolean {
  return CJK.test(value.slice(0, 1));
}

/** Join two lines, omitting the space between CJK characters like a word processor does */
function joinLines(left: string, right: string): string {
  if (!left) return right;
  if (!right) return left;
  return endsWithCjk(left) || startsWithCjk(right) ? `${left}${right}` : `${left} ${right}`;
}

function headingLevel(fontSize: number, bodySize: number): 1 | 2 | 3 {
  if (bodySize <= 0) return 3;
  const ratio = fontSize / bodySize;
  if (ratio >= 1.8) return 1;
  if (ratio >= 1.45) return 2;
  return 3;
}

/** Does `next` continue the paragraph that `current` belongs to? */
function continuesParagraph(
  current: TextLine,
  next: TextLine,
  first: TextLine,
  bodySize: number,
): boolean {
  const indentDelta = Math.abs(next.rect.x - first.rect.x);
  // 2% of the page is roughly two body characters; anything wider is a new paragraph
  const indentTolerance = Math.max(0.008, (bodySize / 800) * 2);
  if (indentDelta > indentTolerance) return false;

  const gap = next.rect.y - (current.rect.y + current.rect.h);
  const lineHeight = Math.max(current.rect.h, 0.004);
  return gap <= lineHeight * 0.8 && gap >= -lineHeight * 0.6;
}

/**
 * Build blocks from clustered lines. Lines are consumed top-to-bottom; the output keeps the reading
 * order of the text layer, which is also the order pdfjs reports glyphs in.
 */
export function structureLines(lines: readonly TextLine[]): StructureBlock[] {
  if (lines.length === 0) return [];

  const ordered = [...lines].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const bodySize = bodyFontSize(ordered);

  const blocks: StructureBlock[] = [];
  let paragraph: string | null = null;
  let paragraphFirst: TextLine | null = null;
  let paragraphLast: TextLine | null = null;
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph && paragraph.trim()) blocks.push({ kind: 'paragraph', text: paragraph.trim() });
    paragraph = null;
    paragraphFirst = null;
    paragraphLast = null;
  };
  const flushList = () => {
    if (list && list.items.length > 0) blocks.push({ kind: 'list', ...list });
    list = null;
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const line of ordered) {
    const text = line.text.trim();
    if (!text) continue;

    const listMatch = LIST_PATTERN.exec(text);
    if (listMatch) {
      flushParagraph();
      const isOrdered = listMatch[1] !== undefined || listMatch[2] !== undefined;
      const item = text.replace(LIST_PATTERN, '').trim();
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      if (item) list.items.push(item);
      continue;
    }

    const isHeading = bodySize > 0 && line.fontSize >= bodySize * 1.25 && text.length <= 120;
    if (isHeading) {
      flushAll();
      blocks.push({ kind: 'heading', level: headingLevel(line.fontSize, bodySize), text });
      continue;
    }

    flushList();

    if (
      paragraph !== null &&
      paragraphFirst &&
      paragraphLast &&
      continuesParagraph(paragraphLast, line, paragraphFirst, bodySize)
    ) {
      paragraph = joinLines(paragraph, text);
      paragraphLast = line;
      continue;
    }

    flushParagraph();
    paragraph = text;
    paragraphFirst = line;
    paragraphLast = line;
  }

  flushAll();
  return blocks;
}

/** Render blocks as the minimal HTML the core docx writer understands */
export function blocksToHtml(blocks: readonly StructureBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.kind === 'heading') {
      parts.push(`<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`);
    } else if (block.kind === 'paragraph') {
      parts.push(`<p>${escapeHtml(block.text)}</p>`);
    } else {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      parts.push(`<${tag}>${items}</${tag}>`);
    }
  }
  return parts.join('\n');
}

/**
 * Structure one pdfjs page. A page with no text layer (a scan) returns an empty block list so the
 * caller can fall back to rasterizing it.
 */
export async function extractPageStructure(
  pdfDoc: Parameters<typeof getPageTextLines>[0],
  pageNumber1Based: number,
): Promise<PageStructure> {
  const lines = await getPageTextLines(pdfDoc, pageNumber1Based);
  const blocks = structureLines(lines);
  return { html: blocksToHtml(blocks), blocks, lineCount: lines.length };
}
