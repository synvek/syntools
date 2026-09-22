/**
 * 本地草稿（不离开浏览器）：停止编辑后防抖写入 localStorage，刷新后自动恢复。
 * 读写均 try/catch 容错，超限时静默忽略。
 */

import { migrateDoc } from './io/projectJson';
import type { MindDoc } from './model/types';

const DRAFT_KEY = 'syntools:mindmap-editor.draft.v1';

export function readDraft(): MindDoc | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { doc?: unknown; savedAt?: number } | null;
    if (!parsed || typeof parsed !== 'object' || !('doc' in parsed)) return null;
    return migrateDoc(parsed.doc);
  } catch {
    return null;
  }
}

export function writeDraft(doc: MindDoc): boolean {
  try {
    // 空脑图（仅中心主题且无文案）不保留草稿：刷新后应回到初始状态
    const root = doc.nodes.find((n) => n.id === doc.rootId);
    const empty = doc.nodes.length <= 1 && !root?.text?.trim();
    if (empty) {
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
