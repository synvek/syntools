import type { WorkbookSnapshot } from './xlsx-io';

/** 本地草稿存储：键遵循 syntools:* 规范，内容不离开浏览器 */

const DRAFT_KEY = 'syntools:spreadsheet-editor.draft.v1';
/** 单篇草稿体积上限（10MB），防止 localStorage 被撑爆 */
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

/** 写入草稿，返回是否成功（超限时放弃写入而非静默失败） */
export function writeDraft(snapshot: WorkbookSnapshot): boolean {
  try {
    const raw = JSON.stringify(snapshot);
    if (raw.length > MAX_DRAFT_BYTES) return false;
    localStorage.setItem(DRAFT_KEY, raw);
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
