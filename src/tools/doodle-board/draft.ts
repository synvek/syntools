/** 本地草稿：不离开浏览器的自动保存 / 恢复。 */

import { parseScene, serializeScene, type Scene } from './core';

const DRAFT_KEY = 'syntools:doodle-board:draft.v1';
/** 草稿预算：localStorage 常见配额 5MB，单工具留 1.5MB 足够 */
const DRAFT_BUDGET = 1_500_000;

/** 写入成功返回 true；超预算或 localStorage 不可用时静默降级 */
export function writeDraft(scene: Scene): boolean {
  const raw = serializeScene(scene, DRAFT_BUDGET);
  if (!raw) return false;
  try {
    localStorage.setItem(DRAFT_KEY, raw);
    return true;
  } catch {
    // 隐私模式 / 配额不足
    return false;
  }
}

/** 读取草稿：内容可能被人为改过，一律交给 parseScene 校验 */
export function readDraft(): Scene | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  return parseScene(raw);
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // 忽略
  }
}
