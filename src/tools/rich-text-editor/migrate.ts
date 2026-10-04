import type { ToolResult } from '@/core/types';
import type { ViewMode } from './draft';
import type { DocComment, TrackedChange } from './docs';
import type { PageSetupConfig } from './pageSetup';

/**
 * 草稿 / 文档库 schema 迁移（纯逻辑，不依赖 DOM 与 IndexedDB，便于单测）：
 * - v1：无版本号，仅有 title / html / view / pageSetup / zoom / pdfMode
 * - v2：新增 schemaVersion、批注、修订、自定义词典、模板 id
 *
 * 迁移契约：**读时兼容 + 惰性补齐**，绝不因迁移失败丢弃用户数据。
 * 迁移失败时保留原值并回退默认值，仅当传入值无法作为草稿使用时返回错误。
 */

export const CURRENT_SCHEMA_VERSION = 2;
/** v1 旧数据的隐含版本号 */
export const LEGACY_SCHEMA_VERSION = 1;

/** 从 HTML 反推批注 / 修订条目时的上限，避免异常文档撑爆元数据 */
const MAX_DERIVED_ENTRIES = 200;

export type PdfExportMode = 'text' | 'snapshot';

/** 草稿 schema v2：所有持久化入口共同依赖的数据契约 */
export interface RichTextDraftV2 {
  schemaVersion: number;
  title: string;
  html: string;
  view?: ViewMode;
  zoom?: number;
  pdfMode?: PdfExportMode;
  pageSetup?: Partial<PageSetupConfig>;
  /** 批注元数据（Mark 之外的引用原文 / 正文 / 作者 / 时间 / 已解决状态） */
  comments: DocComment[];
  /** 修订条目元数据（Mark 之外的变更类型 / 文本 / 作者 / 时间） */
  changes: TrackedChange[];
  /** 拼写检查自定义词典 */
  userWords?: string[];
  /** 最近套用的文档模板 id */
  templateId?: string;
}

/**
 * 写入侧入参：扩展字段可省略，由 `writeDraft` 归一化补齐。
 * 读取侧统一得到完整的 `RichTextDraftV2`。
 */
export type RichTextDraftInput = Omit<
  RichTextDraftV2,
  'schemaVersion' | 'comments' | 'changes' | 'userWords' | 'templateId'
> &
  Partial<Pick<RichTextDraftV2, 'comments' | 'changes' | 'userWords' | 'templateId'>>;

/** 文档级扩展字段（v1 记录缺失，读取时惰性补齐） */
export interface DocExtras {
  comments: DocComment[];
  changes: TrackedChange[];
  userWords: string[];
  templateId?: string;
}

/** 宽松对象守卫：持久化读取时用于过滤任意 JSON 值 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 读取正数时间戳（缺失/非法返回 0，由调用方决定兜底） */
export function readPositiveNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/* ------------------------------------------------------------------ *
 * 单条记录归一化
 * ------------------------------------------------------------------ */

function normalizeComment(raw: unknown): DocComment | null {
  if (!isPlainObject(raw)) return null;
  const id = readString(raw.id);
  if (!id) return null;
  return {
    id,
    quote: readString(raw.quote),
    text: readString(raw.text),
    author: readString(raw.author),
    createdAt: readPositiveNumber(raw.createdAt),
    resolved: raw.resolved === true,
  };
}

function normalizeChange(raw: unknown, index: number): TrackedChange | null {
  if (!isPlainObject(raw)) return null;
  const kind = raw.kind === 'insert' || raw.kind === 'delete' ? raw.kind : null;
  if (!kind) return null;
  // 缺 id 的历史数据用序号补一个稳定 id（同一次迁移结果可复现）
  const id = readString(raw.id) || `t-migrated-${index}`;
  return {
    id,
    kind,
    text: readString(raw.text),
    author: readString(raw.author),
    createdAt: readPositiveNumber(raw.createdAt),
  };
}

/* ------------------------------------------------------------------ *
 * 从 HTML 反推审阅信息（仅用于无元数据的 v1 数据）
 * ------------------------------------------------------------------ */

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** 去掉标签并还原常见实体（反推文本用，不追求完整 HTML 语义） */
function innerText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (match) => HTML_ENTITIES[match] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * v1 文档的批注/修订 Mark 保存在 HTML 里但元数据从未落盘。
 * 升级时按 HTML 反推一份最小元数据，保证侧栏不会「有标记却无条目」。
 * 结果为尽力而为：无法还原的字段留空，不猜测作者。
 */
export function deriveReviewFromHtml(html: string): {
  comments: DocComment[];
  changes: TrackedChange[];
} {
  const comments: DocComment[] = [];
  const seenIds = new Set<string>();
  const commentRe = /data-comment-id="([^"]+)"/g;
  let match = commentRe.exec(html);
  while (match && comments.length < MAX_DERIVED_ENTRIES) {
    const id = match[1];
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      comments.push({
        id,
        quote: '',
        text: '',
        author: '',
        createdAt: 0,
        resolved: false,
      });
    }
    match = commentRe.exec(html);
  }

  const changes: TrackedChange[] = [];
  const trackedRe = /<(ins|del)\b([^>]*)>([\s\S]*?)<\/\1>/g;
  let tracked = trackedRe.exec(html);
  while (tracked && changes.length < MAX_DERIVED_ENTRIES) {
    const kind = /(?:^|\s)data-track="insert"/.test(tracked[2])
      ? 'insert'
      : /(?:^|\s)data-track="delete"/.test(tracked[2])
        ? 'delete'
        : null;
    const text = innerText(tracked[3]);
    if (kind && text) {
      changes.push({
        id: `t-migrated-${changes.length}`,
        kind,
        text,
        author: '',
        createdAt: 0,
      });
    }
    tracked = trackedRe.exec(html);
  }

  return { comments, changes };
}

/* ------------------------------------------------------------------ *
 * 扩展字段归一化
 * ------------------------------------------------------------------ */

/**
 * 归一化文档级扩展字段。
 * `deriveReview` 为真时（v1 数据）才从 HTML 反推审阅信息——
 * v2 数据即使批注列表为空也必须尊重用户已删除的事实，不能复活。
 */
export function normalizeDocExtras(raw: unknown, deriveReview: boolean): DocExtras {
  const source = isPlainObject(raw) ? raw : {};
  const html = readString(source.html);

  const comments = Array.isArray(source.comments)
    ? source.comments
        .map((item) => normalizeComment(item))
        .filter((item): item is DocComment => item !== null)
        .slice(0, MAX_DERIVED_ENTRIES)
    : deriveReview
      ? deriveReviewFromHtml(html).comments
      : [];

  const changes = Array.isArray(source.changes)
    ? source.changes
        .map((item, index) => normalizeChange(item, index))
        .filter((item): item is TrackedChange => item !== null)
        .slice(0, MAX_DERIVED_ENTRIES)
    : deriveReview
      ? deriveReviewFromHtml(html).changes
      : [];

  const userWords = Array.isArray(source.userWords)
    ? Array.from(
        new Set(
          source.userWords
            .filter((word): word is string => typeof word === 'string')
            .map((word) => word.trim())
            .filter(Boolean),
        ),
      ).slice(0, 5000)
    : [];

  const templateId = readString(source.templateId) || undefined;

  return { comments, changes, userWords, templateId };
}

/* ------------------------------------------------------------------ *
 * 草稿迁移
 * ------------------------------------------------------------------ */

/**
 * 把任意历史草稿（v1 / v2 / 半损坏 JSON）迁移为 v2。
 * 仅在「完全无法作为草稿使用」时失败（非对象、html 不是字符串）。
 */
export function migrateDraft(raw: unknown): ToolResult<RichTextDraftV2> {
  if (!isPlainObject(raw)) return { ok: false, error: 'MIGRATION_FAILED' };
  if (typeof raw.html !== 'string') return { ok: false, error: 'MIGRATION_FAILED' };

  const isV2 = raw.schemaVersion === CURRENT_SCHEMA_VERSION;
  const extras = normalizeDocExtras(raw, !isV2);

  const zoom =
    typeof raw.zoom === 'number' && Number.isFinite(raw.zoom) && raw.zoom > 0
      ? raw.zoom
      : undefined;

  return {
    ok: true,
    value: {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      title: readString(raw.title),
      html: raw.html,
      view: raw.view === 'paged' || raw.view === 'flow' ? raw.view : undefined,
      zoom,
      pdfMode: raw.pdfMode === 'snapshot' || raw.pdfMode === 'text' ? raw.pdfMode : undefined,
      pageSetup: isPlainObject(raw.pageSetup)
        ? (raw.pageSetup as Partial<PageSetupConfig>)
        : undefined,
      ...extras,
    },
  };
}

/** 归一化写入侧入参：补齐版本号与扩展字段默认值 */
export function toDraftV2(draft: RichTextDraftInput): RichTextDraftV2 {
  const extras = normalizeDocExtras(draft, false);
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title: readString(draft.title),
    html: readString(draft.html),
    view: draft.view,
    zoom: draft.zoom,
    pdfMode: draft.pdfMode,
    pageSetup: draft.pageSetup,
    ...extras,
  };
}
