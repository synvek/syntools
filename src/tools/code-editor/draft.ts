import { MAX_IMPORT_BYTES } from './core';

/** 本地草稿存储：键遵循 syntools:* 规范，代码内容不离开浏览器 */

const DRAFT_KEY = 'syntools:code-editor.draft.v1';
/** 草稿体积上限（10MB），防止 localStorage 被撑爆 */
const MAX_DRAFT_BYTES = MAX_IMPORT_BYTES;

export interface CodeDraft {
  code: string;
  language: string;
  theme: string;
  indent: string;
  filename: string;
  lineNumbers: boolean;
  wordWrap: boolean;
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
    };
  } catch {
    return null;
  }
}

/** 写入草稿，返回是否成功（超限时放弃写入而非静默失败） */
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
    // localStorage 不可用时忽略
  }
}
