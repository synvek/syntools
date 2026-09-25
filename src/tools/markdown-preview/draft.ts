import { MAX_MARKDOWN_BYTES } from './core';

/** 本地草稿存储：键遵循 syntools:* 规范，文档内容不离开浏览器 */

const DRAFT_KEY = 'syntools:markdown-preview.draft.v1';

export type MarkdownViewMode = 'edit' | 'split' | 'preview';

export interface MarkdownDraft {
  text: string;
  view: MarkdownViewMode;
  gfm: boolean;
  breaks: boolean;
  syncScroll: boolean;
  outline: boolean;
  /** 最近使用的文档名（保存文件时的默认名） */
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

/** 写入草稿，返回是否成功（超限时放弃写入而非静默失败） */
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
    // localStorage 不可用时忽略
  }
}
