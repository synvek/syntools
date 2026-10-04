import { MAX_IMPORT_BYTES } from './core';
import { migrateDraft, toDraftV2, type RichTextDraftInput, type RichTextDraftV2 } from './migrate';

/**
 * 本地草稿存储：键遵循 syntools:* 规范，内容不离开浏览器。
 *
 * schema v2 起新增批注 / 修订 / 自定义词典 / 模板 id，并引入版本字段；
 * v1 旧键保留只读回退（迁移成功后删除），保证升级过程零数据丢失。
 */

const DRAFT_KEY_V2 = 'syntools:rich-text-editor.draft.v2';
/** v1 旧键：仅用于一次性迁移 */
export const LEGACY_DRAFT_KEY = 'syntools:rich-text-editor.draft.v1';
/** 批注/修订署名：属于本地偏好，不作为文档内容分发 */
const REVIEWER_KEY = 'syntools:rich-text-editor.reviewer';
/** 单篇草稿体积上限（10MB），防止 localStorage 被撑爆 */
const MAX_DRAFT_BYTES = MAX_IMPORT_BYTES;

/** 编辑视图模式：流式（连续滚动）/ 页面（A4 分页参考线） */
export type ViewMode = 'flow' | 'paged';

export type { RichTextDraftV2, RichTextDraftInput } from './migrate';
/** 写入侧类型别名：扩展字段可省略，由 writeDraft 归一化补齐 */
export type RichTextDraft = RichTextDraftInput;

function readKey(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * 读取草稿：优先 v2；缺失时回退读取 v1 并迁移为 v2（成功后清理旧键）。
 * 两种键都无法解析时返回 null。
 */
export function readDraft(): RichTextDraftV2 | null {
  const current = migrateDraft(readKey(DRAFT_KEY_V2));
  if (current.ok) return current.value;

  const migrated = migrateDraft(readKey(LEGACY_DRAFT_KEY));
  if (!migrated.ok) return null;
  // 迁移成功顺手固化为 v2 并清理旧键；写入失败也照常返回内容
  if (writeDraft(migrated.value)) clearLegacyDraft();
  return migrated.value;
}

/** 写入草稿，返回是否成功（超限时放弃写入而非静默失败） */
export function writeDraft(draft: RichTextDraftInput): boolean {
  try {
    const normalized = toDraftV2(draft);
    if (normalized.html.length > MAX_DRAFT_BYTES) return false;
    localStorage.setItem(DRAFT_KEY_V2, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

/** 清理 v1 旧键（迁移完成后调用） */
export function clearLegacyDraft(): void {
  try {
    localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    // localStorage 不可用时忽略
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY_V2);
    localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    // localStorage 不可用时忽略
  }
}

/** 读取本地署名（批注 / 修订的作者名） */
export function readReviewerName(): string {
  try {
    return localStorage.getItem(REVIEWER_KEY) ?? '';
  } catch {
    return '';
  }
}

/** 写入本地署名；空串表示恢复默认署名 */
export function writeReviewerName(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) localStorage.setItem(REVIEWER_KEY, trimmed);
    else localStorage.removeItem(REVIEWER_KEY);
  } catch {
    // localStorage 不可用时忽略
  }
}

export interface DraftWriteResult {
  ok: boolean;
  /** 是否经过降级（剥离图片后才能放下） */
  degraded: boolean;
}

/** 剥离内嵌图片（降级策略第一步） */
function stripImages(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, '');
}

/**
 * 超限降级写入：先原样写入；失败则剥离图片重试；
 * 仍失败返回 ok:false（UI 提示导出文件以保留内容）。
 */
export function writeDraftSafe(draft: RichTextDraftInput): DraftWriteResult {
  if (writeDraft(draft)) return { ok: true, degraded: false };
  const stripped = stripImages(draft.html);
  if (stripped !== draft.html && writeDraft({ ...draft, html: stripped })) {
    return { ok: true, degraded: true };
  }
  return { ok: false, degraded: false };
}
