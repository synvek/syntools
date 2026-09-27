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

/**
 * 写入草稿的结果：
 * - `ok:false, degraded:false` → 内容超出体积上限（本次未保存）
 * - `ok:false, degraded:true`  → localStorage 不可用 / 配额不足
 */
export interface DraftWriteResult {
  ok: boolean;
  degraded: boolean;
}

/** 写入草稿并返回可区分的原因（供 UI 明确提示，而不是永远停在「保存中」） */
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

/** 便捷布尔版（失败原因不关心时使用） */
export function writeDraft(snapshot: WorkbookSnapshot): boolean {
  return writeDraftSafe(snapshot).ok;
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // localStorage 不可用时忽略
  }
}

export { DRAFT_KEY };
