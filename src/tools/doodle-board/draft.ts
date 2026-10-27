/** Local draft: autosave / restore that never leaves the browser. */

import { parseScene, serializeScene, type Scene } from './core';

const DRAFT_KEY = 'syntools:doodle-board:draft.v1';
/** Draft budget: the usual localStorage quota is 5MB, so 1.5MB per tool is plenty */
const DRAFT_BUDGET = 1_500_000;

/** Returns true on success; degrades silently when over budget or localStorage is unavailable */
export function writeDraft(scene: Scene): boolean {
  const raw = serializeScene(scene, DRAFT_BUDGET);
  if (!raw) return false;
  try {
    localStorage.setItem(DRAFT_KEY, raw);
    return true;
  } catch {
    // Private mode / quota exhausted
    return false;
  }
}

/** Read the draft: the content may have been tampered with, so parseScene always validates it */
export function readDraft(): Scene | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  return parseScene(raw);
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore
  }
}
