import { MAX_IMPORT_BYTES } from './core';
import type { CodeCardStyle } from './cardOptions';

/** Local draft storage: keys follow the syntools:* convention; code never leaves the browser */

const DRAFT_KEY = 'syntools:code-editor.draft.v1';
/** Draft size cap (10MB) so localStorage is never blown up */
const MAX_DRAFT_BYTES = MAX_IMPORT_BYTES;

export interface CodeDraft {
  code: string;
  language: string;
  theme: string;
  indent: string;
  filename: string;
  lineNumbers: boolean;
  wordWrap: boolean;
  /** Export card style (added in phase 6; legacy drafts without it fall back to normalizeCardStyle) */
  card?: Partial<CodeCardStyle>;
  /** Export scale factor (1x / 2x / 4x) */
  cardScale?: number;
}

export function readDraft(): CodeDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CodeDraft>;
    if (typeof parsed?.code !== 'string') return null;
    return {
      code: parsed.code,
      language: typeof parsed.language === 'string' ? parsed.language : '',
      theme: typeof parsed.theme === 'string' ? parsed.theme : '',
      indent: typeof parsed.indent === 'string' ? parsed.indent : '',
      filename: typeof parsed.filename === 'string' ? parsed.filename : '',
      lineNumbers: parsed.lineNumbers !== false,
      wordWrap: parsed.wordWrap === true,
      card: typeof parsed.card === 'object' && parsed.card !== null ? parsed.card : undefined,
      cardScale: typeof parsed.cardScale === 'number' ? parsed.cardScale : undefined,
    };
  } catch {
    return null;
  }
}

/** Write the draft and report success (over-limit writes are dropped explicitly, never silently) */
export function writeDraft(draft: CodeDraft): boolean {
  try {
    if (draft.code.length > MAX_DRAFT_BYTES) return false;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
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
