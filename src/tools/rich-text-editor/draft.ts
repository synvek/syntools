import { MAX_IMPORT_BYTES } from './core';

/** 本地草稿存储：键遵循 syntools:* 规范，内容不离开浏览器 */

const DRAFT_KEY = 'syntools:rich-text-editor.draft.v1';
/** 单篇草稿体积上限（10MB），防止 localStorage 被撑爆 */
const MAX_DRAFT_BYTES = MAX_IMPORT_BYTES;

/** 编辑视图模式：流式（连续滚动）/ 页面（A4 分页参考线） */
export type ViewMode = 'flow' | 'paged';

export interface RichTextDraft {
  title: string;
  html: string;
  /** 视图偏好（可选，向后兼容 v1 旧草稿） */
  view?: ViewMode;
}

export function readDraft(): RichTextDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RichTextDraft>;
    if (typeof parsed?.html !== 'string') return null;
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      html: parsed.html,
      view: parsed.view === 'paged' ? 'paged' : 'flow',
    };
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
export function writeDraftSafe(draft: RichTextDraft): DraftWriteResult {
  if (writeDraft(draft)) return { ok: true, degraded: false };
  const stripped = stripImages(draft.html);
  if (stripped !== draft.html && writeDraft({ ...draft, html: stripped })) {
    return { ok: true, degraded: true };
  }
  return { ok: false, degraded: false };
}
