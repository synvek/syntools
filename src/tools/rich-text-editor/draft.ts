import { MAX_IMPORT_BYTES } from './core';

/** 本地草稿存储：键遵循 syntools:* 规范，内容不离开浏览器 */

const DRAFT_KEY = 'syntools:rich-text-editor.draft.v1';
/** 单篇草稿体积上限（10MB），防止 localStorage 被撑爆 */
const MAX_DRAFT_BYTES = MAX_IMPORT_BYTES;

export interface RichTextDraft {
  title: string;
  html: string;
}

export function readDraft(): RichTextDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RichTextDraft>;
    if (typeof parsed?.html !== 'string') return null;
    return { title: typeof parsed.title === 'string' ? parsed.title : '', html: parsed.html };
  } catch {
    return null;
  }
}

/** 写入草稿，返回是否成功（超限时放弃写入而非静默失败） */
export function writeDraft(draft: RichTextDraft): boolean {
  try {
    if (draft.html.length > MAX_DRAFT_BYTES) return false;
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
