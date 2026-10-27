import type { WorkbookSnapshot } from './xlsx-io';

/** Local draft storage: keys follow the syntools:* convention; contents never leave the browser */

const DRAFT_KEY = 'syntools:spreadsheet-editor.draft.v1';
/** Per-draft size cap (10MB) so localStorage does not get blown up */
const MAX_DRAFT_BYTES = 10 * 1024 * 1024;

export function readDraft(): WorkbookSnapshot | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkbookSnapshot>;
    if (!parsed?.sheets || !parsed?.sheetOrder || !Array.isArray(parsed.sheetOrder)) return null;
    return parsed as WorkbookSnapshot;
  } catch {
    return null;
  }
}

/**
 * Draft write outcome:
 * - `ok:false, degraded:false` → content exceeds the size cap (not saved this time)
 * - `ok:false, degraded:true`  → localStorage unavailable / out of quota
 */
export interface DraftWriteResult {
  ok: boolean;
  degraded: boolean;
}

/** Write the draft and report a distinguishable reason (so the UI can say why instead of sitting on "saving" forever) */
export function writeDraftSafe(snapshot: WorkbookSnapshot): DraftWriteResult {
  let raw: string;
  try {
    raw = JSON.stringify(snapshot);
  } catch {
    return { ok: false, degraded: false };
  }
  if (raw.length > MAX_DRAFT_BYTES) return { ok: false, degraded: false };
  try {
    localStorage.setItem(DRAFT_KEY, raw);
    return { ok: true, degraded: false };
  } catch {
    return { ok: false, degraded: true };
  }
}

/** Boolean convenience wrapper for callers that do not care about the failure reason */
export function writeDraft(snapshot: WorkbookSnapshot): boolean {
  return writeDraftSafe(snapshot).ok;
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore when localStorage is unavailable
  }
}

export { DRAFT_KEY };
