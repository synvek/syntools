/**
 * HTML → `DocxBlock[]`.
 *
 * Pure and DOM-only (no `docx` import), so the reading rules — headings, lists, tables, images,
 * page breaks — are unit tested without packing a real .docx. The writer in `build.ts` only maps
 * blocks to OOXML, which keeps both halves small.
 *
 * Inline formatting is intentionally dropped: the PDF editor generates this HTML itself (one
 * paragraph per text row), and Word's inline runs would add size without adding fidelity.
 */

import type { DocxAlign, DocxBlock, DocxHeadingLevel } from './types';

const HEADING_TAGS: Record<string, DocxHeadingLevel> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

const BLOCK_CONTAINERS = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'BODY', 'FIGURE']);

/** Collapse HTML whitespace the way a browser does, keeping explicit line breaks */
function normalizeText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** `textContent` with `<br>` turned into `\n` */
export function elementText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  for (const br of Array.from(clone.querySelectorAll('br'))) br.replaceWith('\n');
  return normalizeText(clone.textContent ?? '');
}

function readAlign(element: Element): DocxAlign | undefined {
  const style = (element as HTMLElement).style?.textAlign;
  const attribute = element.getAttribute('align');
  const value = (style || attribute || '').toLowerCase();
  if (value === 'center' || value === 'right' || value === 'justify') return value;
  if (value === 'left' || value === 'start') return 'left';
  return undefined;
}

function readImage(element: Element): DocxBlock | null {
  const src = element.getAttribute('src');
  if (!src) return null;
  const width = Number(element.getAttribute('width') ?? 0);
  const height = Number(element.getAttribute('height') ?? 0);
  return {
    type: 'image',
    src,
    widthPx: Number.isFinite(width) && width > 0 ? Math.round(width) : 0,
    heightPx: Number.isFinite(height) && height > 0 ? Math.round(height) : 0,
  };
}

function visit(element: Element, blocks: DocxBlock[]): void {
  for (const child of Array.from(element.children)) {
    const tag = child.tagName.toUpperCase();

    const headingLevel = HEADING_TAGS[tag];
    if (headingLevel) {
      const text = elementText(child);
      if (text) blocks.push({ type: 'heading', level: headingLevel, text });
      continue;
    }

    if (tag === 'P') {
      const image = child.querySelector('img');
      const text = elementText(child);
      if (image && !text) {
        const block = readImage(image);
        if (block) blocks.push(block);
        continue;
      }
      if (text) blocks.push({ type: 'paragraph', text, align: readAlign(child) });
      continue;
    }

    if (tag === 'UL' || tag === 'OL') {
      const items = Array.from(child.querySelectorAll(':scope > li'))
        .map((item) => elementText(item))
        .filter(Boolean);
      if (items.length > 0) blocks.push({ type: 'list', ordered: tag === 'OL', items });
      continue;
    }

    if (tag === 'TABLE') {
      const rows = Array.from(child.querySelectorAll('tr')).map((row) =>
        Array.from(row.querySelectorAll('th,td')).map((cell) => elementText(cell)),
      );
      const usable = rows.filter((row) => row.some((cell) => cell.length > 0));
      if (usable.length > 0) blocks.push({ type: 'table', rows: usable });
      continue;
    }

    if (tag === 'IMG') {
      const block = readImage(child);
      if (block) blocks.push(block);
      continue;
    }

    if (tag === 'HR') {
      // The PDF exporter separates pages with `<hr>`; a horizontal rule is a page break in Word
      blocks.push({ type: 'pageBreak' });
      continue;
    }

    if (BLOCK_CONTAINERS.has(tag)) {
      visit(child, blocks);
      continue;
    }

    // Anything else (SPAN, A, STRONG…) that only holds text becomes a paragraph
    const text = elementText(child);
    if (text) blocks.push({ type: 'paragraph', text });
  }
}

/**
 * Parse an HTML string into blocks. A missing DOM (SSR, plain node test) yields `[]` rather than
 * throwing — callers treat an empty block list as "nothing to export".
 */
export function htmlToDocxBlocks(html: string): DocxBlock[] {
  if (typeof DOMParser === 'undefined') return [];
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const blocks: DocxBlock[] = [];
  visit(parsed.body, blocks);
  return blocks;
}

/** Escape a string for interpolation into generated HTML */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
