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
/** Warn the user once a draft uses this share of the budget (localStorage is a shared, small quota) */
export const DRAFT_WARN_RATIO = 0.8;

/**
 * UTF-8 byte length. localStorage quotas are counted in bytes while JS strings are UTF-16, so a
 * Chinese document takes 3 bytes per character — measuring `html.length` under-reported it by ~3x.
 */
export function utf8Bytes(text: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  let bytes = text.length;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code > 0x7ff) bytes += 2;
    else if (code > 0x7f) bytes += 1;
  }
  return bytes;
}

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

/** Serialize + measure once: what lands in storage is the whole payload (comments / changes / words too) */
function measure(draft: RichTextDraftInput): { text: string; bytes: number } {
  const text = JSON.stringify(toDraftV2(draft));
  return { text, bytes: utf8Bytes(text) };
}

function putIfItFits(text: string, bytes: number): boolean {
  if (bytes > MAX_DRAFT_BYTES) return false;
  try {
    localStorage.setItem(DRAFT_KEY_V2, text);
    return true;
  } catch {
    return false;
  }
}

/** Write the draft, returning success (oversized drafts are rejected rather than silently dropped) */
export function writeDraft(draft: RichTextDraftInput): boolean {
  try {
    const { text, bytes } = measure(draft);
    return putIfItFits(text, bytes);
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
  /** UTF-8 bytes of the payload that was attempted (may exceed the limit when rejected) */
  bytes: number;
  /** `bytes / MAX_DRAFT_BYTES`, so the UI can warn before the write starts failing */
  ratio: number;
  /** True when the draft was rejected purely because of its size */
  tooLarge: boolean;
}

/** How the UI should report a write: nothing, a "almost full" warning, or a hard failure */
export type DraftWarningLevel = 'ok' | 'nearLimit' | 'failed';

/** Single source of truth for the warning threshold, so the notice and its tests cannot drift */
export function draftWarningLevel(result: DraftWriteResult): DraftWarningLevel {
  if (!result.ok) return 'failed';
  return result.ratio >= DRAFT_WARN_RATIO ? 'nearLimit' : 'ok';
}

/** Strip embedded images (first degradation step) */
function stripImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, '');
}

const EMPTY_RESULT: DraftWriteResult = {
  ok: false,
  degraded: false,
  bytes: 0,
  ratio: 0,
  tooLarge: false,
};

/**
 * Degraded write when over the limit: write as-is first; on failure retry without images;
 * if that also fails, return ok:false (the UI suggests exporting a file to keep the content).
 */
export function writeDraftSafe(draft: RichTextDraftInput): DraftWriteResult {
  let original: { text: string; bytes: number };
  try {
    original = measure(draft);
  } catch {
    return EMPTY_RESULT;
  }

  const ratio = original.bytes / MAX_DRAFT_BYTES;
  if (putIfItFits(original.text, original.bytes)) {
    return { ok: true, degraded: false, bytes: original.bytes, ratio, tooLarge: false };
  }

  const stripped = stripImages(draft.html);
  if (stripped !== draft.html) {
    try {
      const fallback = measure({ ...draft, html: stripped });
      if (putIfItFits(fallback.text, fallback.bytes)) {
        return {
          ok: true,
          degraded: true,
          bytes: fallback.bytes,
          ratio: fallback.bytes / MAX_DRAFT_BYTES,
          tooLarge: false,
        };
      }
      return {
        ok: false,
        degraded: false,
        bytes: fallback.bytes,
        ratio: fallback.bytes / MAX_DRAFT_BYTES,
        tooLarge: fallback.bytes > MAX_DRAFT_BYTES,
      };
    } catch {
      return { ...EMPTY_RESULT, bytes: original.bytes, ratio };
    }
  }

  return {
    ok: false,
    degraded: false,
    bytes: original.bytes,
    ratio,
    tooLarge: original.bytes > MAX_DRAFT_BYTES,
  };
}
