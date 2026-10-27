import type { ToolResult } from '@/core/types';
import type { ViewMode } from './draft';
import type { DocComment, TrackedChange } from './docs';
import type { PageSetupConfig } from './pageSetup';

/**
 * Draft / document library schema migration (pure logic, no DOM or IndexedDB, easy to unit test):
 * - v1: no version number, only title / html / view / pageSetup / zoom / pdfMode
 * - v2: adds schemaVersion, comments, tracked changes, custom dictionary and template id
 *
 * Migration contract: **read-compatible + lazily backfilled**; a failed migration never discards user data.
 * On failure the original values are kept and defaults used; an error is returned only when the input
 * can't serve as a draft at all.
 */

export const CURRENT_SCHEMA_VERSION = 2;
/** Implicit version number for legacy v1 data */
export const LEGACY_SCHEMA_VERSION = 1;

/** Cap on entries derived from HTML for comments / tracked changes, so malformed documents can't blow up the metadata */
const MAX_DERIVED_ENTRIES = 200;

export type PdfExportMode = 'text' | 'snapshot';

/** Draft schema v2: the data contract every persistence entry point relies on */
export interface RichTextDraftV2 {
  schemaVersion: number;
  title: string;
  html: string;
  view?: ViewMode;
  zoom?: number;
  pdfMode?: PdfExportMode;
  pageSetup?: Partial<PageSetupConfig>;
  /** Comment metadata (quote, body, author, time, resolved state — everything outside the Mark) */
  comments: DocComment[];
  /** Tracked-change metadata (change type, text, author, time — everything outside the Mark) */
  changes: TrackedChange[];
  /** Custom spellcheck dictionary */
  userWords?: string[];
  /** Id of the most recently applied document template */
  templateId?: string;
}

/**
 * Write-side input: extension fields are optional and backfilled by `writeDraft`.
 * The read side always yields a complete `RichTextDraftV2`.
 */
export type RichTextDraftInput = Omit<
  RichTextDraftV2,
  'schemaVersion' | 'comments' | 'changes' | 'userWords' | 'templateId'
> &
  Partial<Pick<RichTextDraftV2, 'comments' | 'changes' | 'userWords' | 'templateId'>>;

/** Document-level extension fields (missing in v1 records, backfilled lazily on read) */
export interface DocExtras {
  comments: DocComment[];
  changes: TrackedChange[];
  userWords: string[];
  templateId?: string;
}

/** Loose object guard, used to filter arbitrary JSON values on read */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Read a positive timestamp (missing or invalid yields 0; the caller decides the fallback) */
export function readPositiveNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/* ------------------------------------------------------------------ *
 * Single-record normalization
 * ------------------------------------------------------------------ */

function normalizeComment(raw: unknown): DocComment | null {
  if (!isPlainObject(raw)) return null;
  const id = readString(raw.id);
  if (!id) return null;
  return {
    id,
    quote: readString(raw.quote),
    text: readString(raw.text),
    author: readString(raw.author),
    createdAt: readPositiveNumber(raw.createdAt),
    resolved: raw.resolved === true,
  };
}

function normalizeChange(raw: unknown, index: number): TrackedChange | null {
  if (!isPlainObject(raw)) return null;
  const kind = raw.kind === 'insert' || raw.kind === 'delete' ? raw.kind : null;
  if (!kind) return null;
  // Legacy data without an id gets a stable index-based id (the same migration is reproducible)
  const id = readString(raw.id) || `t-migrated-${index}`;
  return {
    id,
    kind,
    text: readString(raw.text),
    author: readString(raw.author),
    createdAt: readPositiveNumber(raw.createdAt),
  };
}

/* ------------------------------------------------------------------ *
 * Derive review info from HTML (only for v1 data lacking metadata)
 * ------------------------------------------------------------------ */

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Strip tags and decode common entities (for derived text; full HTML semantics not required) */
function innerText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (match) => HTML_ENTITIES[match] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * v1 documents kept comment / tracked-change marks in HTML while the metadata was never persisted.
 * On upgrade a minimal metadata set is derived from the HTML so the sidebar never shows "marks but no
 * entries". The result is best-effort: unrecoverable fields stay empty and the author is never guessed.
 */
export function deriveReviewFromHtml(html: string): {
  comments: DocComment[];
  changes: TrackedChange[];
} {
  const comments: DocComment[] = [];
  const seenIds = new Set<string>();
  const commentRe = /data-comment-id="([^"]+)"/g;
  let match = commentRe.exec(html);
  while (match && comments.length < MAX_DERIVED_ENTRIES) {
    const id = match[1];
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      comments.push({
        id,
        quote: '',
        text: '',
        author: '',
        createdAt: 0,
        resolved: false,
      });
    }
    match = commentRe.exec(html);
  }

  const changes: TrackedChange[] = [];
  const trackedRe = /<(ins|del)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let tracked = trackedRe.exec(html);
  while (tracked && changes.length < MAX_DERIVED_ENTRIES) {
    const kind = /(?:^|\s)data-track="insert"/.test(tracked[2])
      ? 'insert'
      : /(?:^|\s)data-track="delete"/.test(tracked[2])
        ? 'delete'
        : null;
    const text = innerText(tracked[3]);
    if (kind && text) {
      changes.push({
        id: `t-migrated-${changes.length}`,
        kind,
        text,
        author: '',
        createdAt: 0,
      });
    }
    tracked = trackedRe.exec(html);
  }

  return { comments, changes };
}

/* ------------------------------------------------------------------ *
 * Extension field normalization
 * ------------------------------------------------------------------ */

/**
 * Normalize document-level extension fields.
 * Review info is derived from the HTML only when `deriveReview` is true (v1 data) — for v2 data an
 * empty comment list must be respected as a deliberate deletion and never resurrected.
 */
export function normalizeDocExtras(raw: unknown, deriveReview: boolean): DocExtras {
  const source = isPlainObject(raw) ? raw : {};
  const html = readString(source.html);

  const comments = Array.isArray(source.comments)
    ? source.comments
        .map((item) => normalizeComment(item))
        .filter((item): item is DocComment => item !== null)
        .slice(0, MAX_DERIVED_ENTRIES)
    : deriveReview
      ? deriveReviewFromHtml(html).comments
      : [];

  const changes = Array.isArray(source.changes)
    ? source.changes
        .map((item, index) => normalizeChange(item, index))
        .filter((item): item is TrackedChange => item !== null)
        .slice(0, MAX_DERIVED_ENTRIES)
    : deriveReview
      ? deriveReviewFromHtml(html).changes
      : [];

  const userWords = Array.isArray(source.userWords)
    ? Array.from(
        new Set(
          source.userWords
            .filter((word): word is string => typeof word === 'string')
            .map((word) => word.trim())
            .filter(Boolean),
        ),
      ).slice(0, 5000)
    : [];

  const templateId = readString(source.templateId) || undefined;

  return { comments, changes, userWords, templateId };
}

/* ------------------------------------------------------------------ *
 * Draft migration
 * ------------------------------------------------------------------ */

/**
 * Migrate any historical draft (v1 / v2 / partially corrupted JSON) to v2.
 * Fails only when the input is completely unusable as a draft (not an object, html isn't a string).
 */
export function migrateDraft(raw: unknown): ToolResult<RichTextDraftV2> {
  if (!isPlainObject(raw)) return { ok: false, error: 'MIGRATION_FAILED' };
  if (typeof raw.html !== 'string') return { ok: false, error: 'MIGRATION_FAILED' };

  const isV2 = raw.schemaVersion === CURRENT_SCHEMA_VERSION;
  const extras = normalizeDocExtras(raw, !isV2);

  const zoom =
    typeof raw.zoom === 'number' && Number.isFinite(raw.zoom) && raw.zoom > 0
      ? raw.zoom
      : undefined;

  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: readString(raw.title),
      html: raw.html,
      view: raw.view === 'paged' || raw.view === 'flow' ? raw.view : undefined,
      zoom,
      pdfMode: raw.pdfMode === 'snapshot' || raw.pdfMode === 'text' ? raw.pdfMode : undefined,
      pageSetup: isPlainObject(raw.pageSetup)
        ? (raw.pageSetup as Partial<PageSetupConfig>)
        : undefined,
      ...extras,
    },
  };
}

/** Normalize write-side input: fill in the version number and extension field defaults */
export function toDraftV2(draft: RichTextDraftInput): RichTextDraftV2 {
  const extras = normalizeDocExtras(draft, false);
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: readString(draft.title),
    html: readString(draft.html),
    view: draft.view,
    zoom: draft.zoom,
    pdfMode: draft.pdfMode,
    pageSetup: draft.pageSetup,
    ...extras,
  };
}
