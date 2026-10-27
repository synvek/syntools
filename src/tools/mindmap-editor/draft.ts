/**
 * Local draft (never leaves the browser): debounced writes to localStorage once editing stops,
 * restored automatically on reload. Reads and writes are wrapped in try/catch and silently ignored
 * when storage is unavailable or over quota.
 */

import { activeSheetOf, migrateProject } from './io/projectJson';
import type { MindProject } from './model/types';

const DRAFT_KEY = 'syntools:mindmap-editor.draft.v2';
// Draft key from before the upgrade (single-sheet v1)
const DRAFT_KEY_LEGACY = 'syntools:mindmap-editor.draft.v1';

export function readDraft(): MindProject | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY) ?? localStorage.getItem(DRAFT_KEY_LEGACY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { doc?: unknown; savedAt?: number } | null;
    if (!parsed || typeof parsed !== 'object' || !('doc' in parsed)) return null;
    return migrateProject(parsed.doc);
  } catch {
    return null;
  }
}

export function writeDraft(project: MindProject): boolean {
  try {
    // Keep no draft for an empty active sheet (only the central topic and no text): a reload should return to the initial state
    const active = activeSheetOf(project).doc;
    const root = active.nodes.find((n) => n.id === active.rootId);
    const empty = active.nodes.length <= 1 && !root?.text?.trim();
    if (empty) {
      localStorage.removeItem(DRAFT_KEY);
      return false;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ doc: project, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore when localStorage is unavailable
  }
}
