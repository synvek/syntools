/**
 * 本地草稿（不离开浏览器）：停止编辑后防抖写入 localStorage，
 * 刷新后自动恢复。读写均 try/catch 容错，超限时静默忽略。
 */

import { type FlowDoc } from './model/types';
import { activePageOf, migrateDoc } from './model/migrate';

const DRAFT_KEY = 'syntools:flowchart-editor.draft.v1';

export function readDraft(): FlowDoc | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    // 存储结构是 { doc, savedAt }，必须取出 doc 再校验
    const parsed = JSON.parse(raw) as { doc?: unknown; savedAt?: number } | null;
    if (!parsed || typeof parsed !== 'object' || !('doc' in parsed)) return null;
    // 旧草稿是 v1（{nodes, edges}），迁移后统一为 v2，保证内容不丢
    return migrateDoc(parsed.doc);
  } catch {
    return null;
  }
}

export function writeDraft(doc: FlowDoc): boolean {
  try {
    // 空画布不保留草稿：用户主动清空后刷新不应再恢复出内容
    const page = activePageOf(doc);
    if (!page || page.nodes.length === 0) {
      localStorage.removeItem(DRAFT_KEY);
      return false;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ doc, savedAt: Date.now() }));
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
