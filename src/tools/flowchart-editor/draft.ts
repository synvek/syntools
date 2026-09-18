/**
 * 本地草稿（不离开浏览器）：停止编辑后防抖写入 localStorage，
 * 刷新后自动恢复。读写均 try/catch 容错，超限时静默忽略。
 */

import { type FlowDoc } from './model/types';
import { deserializeDoc, type SerializeResult } from './core';

const DRAFT_KEY = 'syntools:flowchart-editor.draft.v1';

export function readDraft(): FlowDoc | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const result: SerializeResult = deserializeDoc(parsed);
    return result.ok ? (result.doc as FlowDoc) : null;
  } catch {
    return null;
  }
}

export function writeDraft(doc: FlowDoc): boolean {
  try {
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
