import DOMPurify from 'dompurify';
import type { ToolResult } from '@/core/types';
import { DEFAULT_PAGE_SETUP, normalizePageSetup, type PageSetupConfig } from './pageSetup';
import { countUnsupportedLatex } from './latex';

/**
 * Rich text editor pure logic layer (technical design §8.2):
 * This file imports no heavy dependencies (TipTap / docx / mammoth are all dynamic imports),
 * and every function follows the ToolResult contract — expected errors are returned, never thrown.
 */

export type EditorErrorCode =
  | 'EMPTY'
  | 'UNSUPPORTED_LEGACY_DOC'
  | 'NOT_DOCX'
  | 'TOO_LARGE'
  | 'IMPORT_FAILED'
  | 'EXPORT_FAILED'
  | 'RENDER_FAILED'
  | 'SNAPSHOT_FAILED'
  /** Local draft / document library schema migration failed (data untouched, defaults used) */
  | 'MIGRATION_FAILED';

/** Import file size limit (10MB), kept in sync with FileDropZone */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
/** Export HTML size guard, keeping huge documents from blocking the main thread for long */
export const MAX_EXPORT_HTML_BYTES = 2 * 1024 * 1024;

/** A4 page geometry (mm): shared by print mode and snapshot mode so both PDFs match */
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const PAGE_MARGIN_MM = 20;
export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2;
export const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2;

export type ImportKind = 'docx' | 'legacy-doc' | 'unsupported';

/** Determine the importable kind from the extension; legacy binary .doc can't be parsed reliably in the browser */
export function resolveImportKind(filename: string): ImportKind {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.doc') || lower.endsWith('.wps') || lower.endsWith('.rtf')) {
    return 'legacy-doc';
  }
  return 'unsupported';
}

/** Unified pre-import validation: format + size */
export function checkImportFile(file: {
  name: string;
  size: number;
}): ToolResult<Extract<ImportKind, 'docx'>> {
  const kind = resolveImportKind(file.name);
  if (kind === 'legacy-doc') return { ok: false, error: 'UNSUPPORTED_LEGACY_DOC' };
  if (kind !== 'docx') return { ok: false, error: 'NOT_DOCX' };
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: 'docx' };
}

/** HTML size guard before export */
export function checkExportSize(html: string): ToolResult<true> {
  if (!html.trim() || html === '<p></p>') return { ok: false, error: 'EMPTY' };
  if (html.length > MAX_EXPORT_HTML_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_EXPORT_HTML_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: true };
}

/** HTML produced from Word must be sanitized before entering the editor, blocking inline scripts/event attributes */
export function sanitizeDocHtml(html: string): ToolResult<string> {
  if (!html.trim()) return { ok: false, error: 'EMPTY' };
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return { ok: true, value: clean };
}

/**
 * Repair the block structure of HTML produced by mammoth.
 *
 * Mammoth's `p[style-name='Quote'] => blockquote:fresh` keeps only the blockquote itself, so the
 * quoted text ends up as a bare inline child. Our editor schema requires block content inside
 * blockquote, so wrap loose inline content in a paragraph. (Without this, the text survives only
 * because ProseMirror's parser auto-wraps it — an implicit behaviour we don't want to depend on.)
 */
export function normalizeImportedDocHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const BLOCK = /^(P|H[1-6]|UL|OL|PRE|TABLE|BLOCKQUOTE|DIV|HR)$/;
  let changed = false;
  for (const quote of Array.from(doc.body.querySelectorAll('blockquote'))) {
    const hasBlockChild = Array.from(quote.children).some((child) => BLOCK.test(child.tagName));
    if (hasBlockChild) continue;
    // Empty quotes stay empty: an empty <p> would render a stray blank line
    if (!(quote.textContent ?? '').trim()) continue;
    const paragraph = doc.createElement('p');
    while (quote.firstChild) paragraph.appendChild(quote.firstChild);
    quote.appendChild(paragraph);
    changed = true;
  }
  return changed ? doc.body.innerHTML : html;
}

/** Initial content for a new document (an empty paragraph) */
export function createEmptyDocHtml(): string {
  return '<p></p>';
}

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'HR',
  'TR',
  'TD',
  'TH',
  'FIGCAPTION',
]);

/** HTML -> plain text (block elements become line breaks), used for stats and export-title fallback */
export function htmlToPlain(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const chunks: string[] = [];
  const walk = (parent: Node) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === 3) {
        chunks.push(node.textContent ?? '');
        return;
      }
      if (node.nodeType !== 1) return;
      const el = node as Element;
      if (BLOCK_TAGS.has(el.tagName)) {
        chunks.push('\n');
        walk(el);
        chunks.push('\n');
        return;
      }
      walk(el);
    });
  };
  walk(doc.body);
  return chunks
    .join('')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export interface DocStats {
  /** Character count (excluding line breaks) */
  chars: number;
  /** Character count (excluding whitespace) */
  charsNoSpace: number;
  /** Word count: CJK counted per character, Latin scripts per word */
  words: number;
  /** Paragraph count */
  paragraphs: number;
}

const CJK_RE = /[㐀-䶿一-鿿぀-ヿ가-힯]/g;

/** Compute word/character statistics for a document */
export function countDocStats(plain: string): DocStats {
  // Normalize line breaks to spaces first, so words on adjacent lines aren't glued into one
  const normalized = plain.replace(/\s+/g, ' ').trim();
  const charsSource = plain.replace(/\n/g, '');
  const cjkCount = normalized.match(CJK_RE)?.length ?? 0;
  const latinCount = normalized.replace(CJK_RE, ' ').match(/[A-Za-z0-9_'À-ɏ-]+/g)?.length ?? 0;
  const paragraphs = plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
  return {
    chars: charsSource.length,
    charsNoSpace: normalized.replace(/ /g, '').length,
    words: cjkCount + latinCount,
    paragraphs,
  };
}

/** Strip illegal filename characters and cap the length */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 60) || 'document';
}

/** Build the export filename (keeping the user's original title) */
export type ExportExt = 'docx' | 'pdf' | 'md' | 'html';

export function buildExportFilename(title: string, ext: ExportExt): string {
  return `${sanitizeFilename(title)}.${ext}`;
}

/**
 * Compute page break cut positions on block boundaries (returned in content-height units, same as the input).
 * Never splits a paragraph in the middle: oversized blocks (taller than a page) are allowed to overflow.
 */
export function computePageBreaks(
  items: { top: number; height: number }[],
  pageHeight: number,
): number[] {
  if (pageHeight <= 0) return [];
  const cuts: number[] = [];
  let pageStart = 0;
  for (const item of items) {
    if (item.height <= 0) continue;
    if (item.top < pageStart) continue;
    const bottom = item.top + item.height;
    if (bottom - pageStart <= pageHeight) continue;
    // The block doesn't fit on the current page -> move it entirely to the next page (overflow if it alone exceeds a page)
    const cut = item.height >= pageHeight ? bottom : item.top;
    pageStart = cut;
    cuts.push(cut);
  }
  return cuts;
}

/**
 * Plan pagination for the editing view: returns the indices of block elements that start a new page
 * (page 1 isn't included). Same policy as computePageBreaks: blocks never split across pages,
 * oversized blocks overflow.
 */
export function planPageBlocks(
  items: { top: number; height: number }[],
  pageHeight: number,
): number[] {
  if (pageHeight <= 0) return [];
  const starts: number[] = [];
  let pageStart = 0;
  items.forEach((item, index) => {
    if (item.height <= 0) return;
    if (item.top < pageStart) return;
    const bottom = item.top + item.height;
    if (bottom - pageStart <= pageHeight) return;
    // The first block on a page already exceeds a page: let it overflow without starting a new page (otherwise: infinite loop / blank pages)
    if (item.top <= pageStart && item.height >= pageHeight) {
      pageStart = bottom;
      return;
    }
    pageStart = item.top;
    starts.push(index);
  });
  return starts;
}

/** CSS pixels for the A4 content width (170mm = 210mm page width − 20mm on each side).
 * Image widths are all stored in pixels; toolbar percentage presets and legacy percentage values
 * are converted against this baseline.
 */
export const CONTENT_WIDTH_PX = Math.round((170 * 96) / 25.4);

/**
 * Document position -> page number (1-based).
 * `pageStarts` holds each page's start position (ascending, from the pagination plugin);
 * it's an empty array when not paginated, so every position falls on page 1.
 * Binary search — TOC rendering resolves a page number per heading on every pass, so a full scan is out.
 */
export function pageIndexOfPosition(pageStarts: readonly number[], pos: number): number {
  let low = 0;
  let high = pageStarts.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (pageStarts[mid] <= pos) low = mid + 1;
    else high = mid;
  }
  return low + 1;
}

/** Total pages: number of break points + 1 (at least 1 page without pagination info) */
export function countPages(pageStarts: readonly number[]): number {
  return pageStarts.length + 1;
}

/** Known losses when exporting to Word */
export interface DocxExportLosses {
  /** External images (not base64-embedded) can't be written to .docx and are skipped */
  externalImages: number;
  /** webp images unsupported by docx are skipped */
  webpImages: number;
  /** List items nested deeper than 8 levels are merged into the deepest level */
  deepListItems: number;
  /** Comment marks in the body without metadata: no Word comment can be created (text only) */
  unlinkedComments: number;
  /** Formulas beyond Word's native equation support that were degraded to images */
  mathAsImages: number;
}

const DOCX_IMAGE_MIME_RE = /^data:image\/([a-z+]+);base64,/i;

/**
 * Pre-export loss scan: list content that this export will drop or degrade (ToolResult contract).
 * Lets the UI report it after export instead of discarding silently.
 * @param comments Comment metadata; when omitted, comment writability can't be judged and unlinkedComments isn't reported
 */
export function scanDocxExportLosses(
  html: string,
  comments?: readonly { id: string }[],
): ToolResult<DocxExportLosses> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const losses: DocxExportLosses = {
    externalImages: 0,
    webpImages: 0,
    deepListItems: 0,
    unlinkedComments: 0,
    mathAsImages: 0,
  };
  // Formulas: syntax beyond Word's native equation support degrades to images (visually identical, no longer editable)
  const latexList = Array.from(doc.querySelectorAll('[data-latex]')).map(
    (el) => el.getAttribute('data-latex') ?? '',
  );
  losses.mathAsImages = countUnsupportedLatex(latexList.filter((latex) => latex.trim()));
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    const match = DOCX_IMAGE_MIME_RE.exec(src);
    if (!match) {
      losses.externalImages += 1;
    } else if (match[1].toLowerCase() === 'webp') {
      losses.webpImages += 1;
    }
  });
  if (comments) {
    const known = new Set(comments.map((comment) => comment.id));
    const seen = new Set<string>();
    doc.querySelectorAll('[data-comment-id]').forEach((el) => {
      const id = el.getAttribute('data-comment-id') ?? '';
      if (!id || known.has(id) || seen.has(id)) return;
      seen.add(id);
      losses.unlinkedComments += 1;
    });
  }
  const walkList = (list: Element, depth: number): void => {
    Array.from(list.children).forEach((li) => {
      if (li.tagName !== 'LI') return;
      if (depth > 8) losses.deepListItems += 1;
      Array.from(li.children).forEach((nested) => {
        if (nested.tagName === 'UL' || nested.tagName === 'OL') walkList(nested, depth + 1);
      });
    });
  };
  doc.querySelectorAll('ul, ol').forEach((list) => {
    // Traverse only from top-level lists (nested ones are handled by walkList); closest includes self, so check the parent
    if (list.parentElement?.closest('ul, ol')) return;
    walkList(list, 0);
  });
  return { ok: true, value: losses };
}

/** Known losses when exporting to Markdown (layout info beyond Markdown's syntax) */
export interface MarkdownExportLosses {
  /** Comment marks: Markdown has no comments, so marks are dropped (text is kept) */
  comments: number;
  /** Accept/reject semantics of tracked changes are lost (insert/delete styling survives as HTML tags) */
  trackedChanges: number;
  /** First-line indent and space before/after: Markdown has no paragraph-level layout */
  paragraphSpacing: number;
  /** Floating images degrade to plain inline images (in front of / behind text is lost) */
  floatingImages: number;
  /** Page setup (header / footer / page numbers / paper size / margins) isn't carried into Markdown */
  pageSetupFields: number;
}

/** Count non-default page setup fields: defaults don't count as losses */
function countNonDefaultPageSetup(setup: Partial<PageSetupConfig> | null | undefined): number {
  const normalized = normalizePageSetup(setup ?? null);
  const defaults = DEFAULT_PAGE_SETUP;
  let count = 0;
  if (normalized.header.trim()) count += 1;
  if (normalized.footer.trim()) count += 1;
  if (normalized.showPageNumber !== defaults.showPageNumber) count += 1;
  if (normalized.size !== defaults.size || normalized.orientation !== defaults.orientation) {
    count += 1;
  }
  const marginDiffers = (['top', 'right', 'bottom', 'left'] as const).some(
    (side) => normalized.margin[side] !== defaults.margin[side],
  );
  if (marginDiffers) count += 1;
  return count;
}

/**
 * Pre-export Markdown loss scan: list the information that Markdown syntax can't express and will be dropped.
 * What it can express (underline / highlight / color / font size / page breaks) is preserved by
 * htmlToMarkdown as inline HTML.
 */
export function scanMarkdownExportLosses(
  html: string,
  setup?: Partial<PageSetupConfig> | null,
): ToolResult<MarkdownExportLosses> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const paragraphSpacing = Array.from(doc.querySelectorAll('p, li')).filter((el) => {
    const style = (el as HTMLElement).style;
    if (!style) return false;
    return Boolean(style.textIndent || style.marginTop || style.marginBottom);
  }).length;
  const floatingImages = Array.from(doc.querySelectorAll('img[data-layer]')).filter(
    (img) => (img.getAttribute('data-layer') ?? 'inline') !== 'inline',
  ).length;
  return {
    ok: true,
    value: {
      comments: doc.querySelectorAll('[data-comment-id]').length,
      trackedChanges: doc.querySelectorAll('ins[data-track], del[data-track]').length,
      paragraphSpacing,
      floatingImages,
      pageSetupFields: countNonDefaultPageSetup(setup),
    },
  };
}
