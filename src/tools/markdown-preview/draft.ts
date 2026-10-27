import { MAX_MARKDOWN_BYTES } from './core';

/** Local draft storage: keys follow the syntools:* convention; documents never leave the browser */

const DRAFT_KEY = 'syntools:markdown-preview.draft.v1';

export type MarkdownViewMode = 'edit' | 'split' | 'preview';

export interface MarkdownDraft {
  text: string;
  view: MarkdownViewMode;
  gfm: boolean;
  breaks: boolean;
  syncScroll: boolean;
  outline: boolean;
  /** Last used document name (the default when saving a file) */
  name: string;
}

const VIEW_MODES: MarkdownViewMode[] = ['edit', 'split', 'preview'];

function isViewMode(value: unknown): value is MarkdownViewMode {
  return typeof value === 'string' && (VIEW_MODES as string[]).includes(value);
}

export function readDraft(): MarkdownDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MarkdownDraft>;
    if (typeof parsed?.text !== 'string') return null;
    return {
      text: parsed.text,
      view: isViewMode(parsed.view) ? parsed.view : 'split',
      gfm: parsed.gfm !== false,
      breaks: parsed.breaks === true,
      syncScroll: parsed.syncScroll !== false,
      outline: parsed.outline === true,
      name: typeof parsed.name === 'string' ? parsed.name : '',
    };
  } catch {
    return null;
  }
}

/** Write the draft and report success (over-limit writes are dropped explicitly, never silently) */
export function writeDraft(draft: MarkdownDraft): boolean {
  try {
    if (draft.text.length > MAX_MARKDOWN_BYTES) return false;
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
