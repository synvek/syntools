import { MAX_IMPORT_BYTES } from './core';
import { migrateDraft, toDraftV2, type RichTextDraftInput, type RichTextDraftV2 } from './migrate';

/**
 * Local draft storage: keys follow the syntools:* convention and content never leaves the browser.
 *
 * Since schema v2 it adds comments / tracked changes / custom dictionary / template id plus a version
 * field; the v1 key stays as a read-only fallback (deleted after a successful migration), so upgrades
 * never lose data.
 */

const DRAFT_KEY_V2 = 'syntools:rich-text-editor.draft.v2';
/** Legacy v1 key: used only for the one-off migration */
export const LEGACY_DRAFT_KEY = 'syntools:rich-text-editor.draft.v1';
/** Comment/tracked-change author name: a local preference, never distributed as document content */
const REVIEWER_KEY = 'syntools:rich-text-editor.reviewer';
/** Per-draft size limit (10MB), keeping localStorage from overflowing */
const MAX_DRAFT_BYTES = MAX_IMPORT_BYTES;

/** Editing view mode: flow (continuous scrolling) / paged (A4 page guides) */
export type ViewMode = 'flow' | 'paged';

export type { RichTextDraftV2, RichTextDraftInput } from './migrate';
/** Write-side type alias: extension fields are optional and backfilled by writeDraft */
export type RichTextDraft = RichTextDraftInput;

function readKey(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Read the draft: prefer v2; when missing, fall back to v1 and migrate it to v2 (cleaning up the old key
 * on success). Returns null when neither key parses.
 */
export function readDraft(): RichTextDraftV2 | null {
  const current = migrateDraft(readKey(DRAFT_KEY_V2));
  if (current.ok) return current.value;

  const migrated = migrateDraft(readKey(LEGACY_DRAFT_KEY));
  if (!migrated.ok) return null;
  // On success persist it as v2 and clear the old key; return the content even if writing fails
  if (writeDraft(migrated.value)) clearLegacyDraft();
  return migrated.value;
}

/** Write the draft, returning success (oversized drafts are rejected rather than silently dropped) */
export function writeDraft(draft: RichTextDraftInput): boolean {
  try {
    const normalized = toDraftV2(draft);
    if (normalized.html.length > MAX_DRAFT_BYTES) return false;
    localStorage.setItem(DRAFT_KEY_V2, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

/** Clear the legacy v1 key (called after migration) */
export function clearLegacyDraft(): void {
  try {
    localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    // Ignore when localStorage is unavailable
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY_V2);
    localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    // Ignore when localStorage is unavailable
  }
}

/** Read the local author name (for comments / tracked changes) */
export function readReviewerName(): string {
  try {
    return localStorage.getItem(REVIEWER_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Write the local author name; an empty string restores the default */
export function writeReviewerName(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) localStorage.setItem(REVIEWER_KEY, trimmed);
    else localStorage.removeItem(REVIEWER_KEY);
  } catch {
    // Ignore when localStorage is unavailable
  }
}

export interface DraftWriteResult {
  ok: boolean;
  /** Whether it was degraded (only fit after stripping images) */
  degraded: boolean;
}

/** Strip embedded images (first degradation step) */
function stripImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, '');
}

/**
 * Degraded write when over the limit: write as-is first; on failure retry without images;
 * if that also fails, return ok:false (the UI suggests exporting a file to keep the content).
 */
export function writeDraftSafe(draft: RichTextDraftInput): DraftWriteResult {
  if (writeDraft(draft)) return { ok: true, degraded: false };
  const stripped = stripImages(draft.html);
  if (stripped !== draft.html && writeDraft({ ...draft, html: stripped })) {
    return { ok: true, degraded: true };
  }
  return { ok: false, degraded: false };
}
