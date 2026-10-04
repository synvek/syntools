import DOMPurify from 'dompurify';
import type { ToolResult } from '@/core/types';
import { DEFAULT_PAGE_SETUP, normalizePageSetup, type PageSetupConfig } from './pageSetup';
import { countUnsupportedLatex } from './latex';

/**
 * 富文本编辑器纯逻辑层（技术设计 §8.2）：
 * 本文件不引入 TipTap / docx / mammoth 等重依赖（全部动态导入），
 * 且所有函数遵循 ToolResult 契约——预期错误返回结果而非抛异常。
 */

export type EditorErrorCode =
  | 'EMPTY'
  | 'UNSUPPORTED_LEGACY_DOC'
  | 'NOT_DOCX'
  | 'TOO_LARGE'
  | 'IMPORT_FAILED'
  | 'EXPORT_FAILED'
  | 'RENDER_FAILED'
  | 'SNAPSHOT_FAILED'
  /** 本地草稿/文档库 schema 迁移失败（数据保持不变，回退默认值） */
  | 'MIGRATION_FAILED';

/** 导入文件大小上限（10MB），与 FileDropZone 保持一致 */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
/** 导出前 HTML 体积上限保护，避免超大文档长时间阻塞主线程 */
export const MAX_EXPORT_HTML_BYTES = 2 * 1024 * 1024;

/** A4 页面几何（mm）：打印模式与快照模式共用，保证两种 PDF 版式一致 */
export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const PAGE_MARGIN_MM = 20;
export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2;
export const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2;

export type ImportKind = 'docx' | 'legacy-doc' | 'unsupported';

/** 依据扩展名判定可导入类型；旧版 .doc 二进制格式浏览器端无法可靠解析 */
export function resolveImportKind(filename: string): ImportKind {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.doc') || lower.endsWith('.wps') || lower.endsWith('.rtf')) {
    return 'legacy-doc';
  }
  return 'unsupported';
}

/** 导入前的统一前置校验：格式 + 体积 */
export function checkImportFile(file: {
  name: string;
  size: number;
}): ToolResult<Extract<ImportKind, 'docx'>> {
  const kind = resolveImportKind(file.name);
  if (kind === 'legacy-doc') return { ok: false, error: 'UNSUPPORTED_LEGACY_DOC' };
  if (kind !== 'docx') return { ok: false, error: 'NOT_DOCX' };
  if (file.size > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: 'docx' };
}

/** 导出前的 HTML 体积保护 */
export function checkExportSize(html: string): ToolResult<true> {
  if (!html.trim() || html === '<p></p>') return { ok: false, error: 'EMPTY' };
  if (html.length > MAX_EXPORT_HTML_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_EXPORT_HTML_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: true };
}

/** Word 转换出的 HTML 必须消毒后再写入编辑器，防止内嵌脚本/事件属性 */
export function sanitizeDocHtml(html: string): ToolResult<string> {
  if (!html.trim()) return { ok: false, error: 'EMPTY' };
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return { ok: true, value: clean };
}

/** 新建文档时的初始内容（空段落） */
export function createEmptyDocHtml(): string {
  return '<p></p>';
}

const BLOCK_TAGS = new Set([
  'P',
  'DIV',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'HR',
  'TR',
  'TD',
  'TH',
  'FIGCAPTION',
]);

/** HTML → 纯文本（块级元素转为换行），用于字数统计与导出标题兜底 */
export function htmlToPlain(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const chunks: string[] = [];
  const walk = (parent: Node) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === 3) {
        chunks.push(node.textContent ?? '');
        return;
      }
      if (node.nodeType !== 1) return;
      const el = node as Element;
      if (BLOCK_TAGS.has(el.tagName)) {
        chunks.push('\n');
        walk(el);
        chunks.push('\n');
        return;
      }
      walk(el);
    });
  };
  walk(doc.body);
  return chunks
    .join('')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

export interface DocStats {
  /** 字符数（不含换行） */
  chars: number;
  /** 字符数（不含空白） */
  charsNoSpace: number;
  /** 词数：中日韩按字计，拉丁语系按单词计 */
  words: number;
  /** 段落数 */
  paragraphs: number;
}

const CJK_RE = /[㐀-䶿一-鿿぀-ヿ가-힯]/g;

/** 统计文档的字数信息 */
export function countDocStats(plain: string): DocStats {
  // 换行先归一为空格，避免相邻两行的单词被粘连算作一个词
  const normalized = plain.replace(/\s+/g, ' ').trim();
  const charsSource = plain.replace(/\n/g, '');
  const cjkCount = normalized.match(CJK_RE)?.length ?? 0;
  const latinCount = normalized.replace(CJK_RE, ' ').match(/[A-Za-z0-9_'À-ɏ-]+/g)?.length ?? 0;
  const paragraphs = plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean).length;
  return {
    chars: charsSource.length,
    charsNoSpace: normalized.replace(/ /g, '').length,
    words: cjkCount + latinCount,
    paragraphs,
  };
}

/** 清洗非法文件名字符，并限制长度 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 60) || 'document';
}

/** 生成导出文件名（保留用户原标题） */
export type ExportExt = 'docx' | 'pdf' | 'md' | 'html';

export function buildExportFilename(title: string, ext: ExportExt): string {
  return `${sanitizeFilename(title)}.${ext}`;
}

/**
 * 按块级边界计算分页切割位置（返回内容高度的切点，单位同入参）。
 * 保证不要把一个段落从中间切开：超长块（高于一整页）允许溢出。
 */
export function computePageBreaks(
  items: { top: number; height: number }[],
  pageHeight: number,
): number[] {
  if (pageHeight <= 0) return [];
  const cuts: number[] = [];
  let pageStart = 0;
  for (const item of items) {
    if (item.height <= 0) continue;
    if (item.top < pageStart) continue;
    const bottom = item.top + item.height;
    if (bottom - pageStart <= pageHeight) continue;
    // 该块放不下当前页 → 它整体挪到下一页（自身超过一页则只能溢出）
    const cut = item.height >= pageHeight ? bottom : item.top;
    pageStart = cut;
    cuts.push(cut);
  }
  return cuts;
}

/**
 * 规划编辑态分页：返回「从新一页开始」的块级元素索引（第 1 页不计入）。
 * 与 computePageBreaks 同策略：块不跨页切开，超长块允许溢出。
 */
export function planPageBlocks(
  items: { top: number; height: number }[],
  pageHeight: number,
): number[] {
  if (pageHeight <= 0) return [];
  const starts: number[] = [];
  let pageStart = 0;
  items.forEach((item, index) => {
    if (item.height <= 0) return;
    if (item.top < pageStart) return;
    const bottom = item.top + item.height;
    if (bottom - pageStart <= pageHeight) return;
    // 页内首个块就超过一页：允许溢出，不因此新建页（否则会死循环/空页）
    if (item.top <= pageStart && item.height >= pageHeight) {
      pageStart = bottom;
      return;
    }
    pageStart = item.top;
    starts.push(index);
  });
  return starts;
}

/** A4 正文内容宽度（170mm = 页宽 210mm − 左右各 20mm）对应的 CSS 像素。
 * 图片宽度统一以像素存储，工具栏的百分比预设、旧版百分比数据的换算都用它作基准。
 */
export const CONTENT_WIDTH_PX = Math.round((170 * 96) / 25.4);

/**
 * 文档位置 → 页码（1 起）。
 * `pageStarts` 为各页起始块在文档中的位置（升序，来自分页插件）；
 * 未分页时为空数组，所有位置都落在第 1 页。
 * 二分查找——目录渲染每次都要对每个标题求页码，不能全量遍历。
 */
export function pageIndexOfPosition(pageStarts: readonly number[], pos: number): number {
  let low = 0;
  let high = pageStarts.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (pageStarts[mid] <= pos) low = mid + 1;
    else high = mid;
  }
  return low + 1;
}

/** 总页数：分页点数量 + 1（无分页信息时至少 1 页） */
export function countPages(pageStarts: readonly number[]): number {
  return pageStarts.length + 1;
}

/** Word 导出时的已知损耗清单 */
export interface DocxExportLosses {
  /** 外链图片（非 base64 内嵌）无法写入 .docx，将被跳过 */
  externalImages: number;
  /** docx 不支持的 webp 图片将被跳过 */
  webpImages: number;
  /** 嵌套超过 8 层的列表项会并入最深层级 */
  deepListItems: number;
  /** 正文有批注标记但缺少元数据：无法生成 Word 批注（仅保留文本） */
  unlinkedComments: number;
  /** 语法超出 Word 原生公式能力、已降级为图片的公式数量 */
  mathAsImages: number;
}

const DOCX_IMAGE_MIME_RE = /^data:image\/([a-z+]+);base64,/i;

/**
 * 导出前差异扫描：列出本次导出会丢失或降级的内容（ToolResult 契约）。
 * 供 UI 在导出后提示，替代静默丢弃。
 * @param comments 批注元数据；缺省时无法判断批注是否可写，不报告 unlinkedComments
 */
export function scanDocxExportLosses(
  html: string,
  comments?: readonly { id: string }[],
): ToolResult<DocxExportLosses> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const losses: DocxExportLosses = {
    externalImages: 0,
    webpImages: 0,
    deepListItems: 0,
    unlinkedComments: 0,
    mathAsImages: 0,
  };
  // 公式：语法超出 Word 原生公式能力时会降级为图片（视觉一致但不可再编辑）
  const latexList = Array.from(doc.querySelectorAll('[data-latex]')).map(
    (el) => el.getAttribute('data-latex') ?? '',
  );
  losses.mathAsImages = countUnsupportedLatex(latexList.filter((latex) => latex.trim()));
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') ?? '';
    const match = DOCX_IMAGE_MIME_RE.exec(src);
    if (!match) {
      losses.externalImages += 1;
    } else if (match[1].toLowerCase() === 'webp') {
      losses.webpImages += 1;
    }
  });
  if (comments) {
    const known = new Set(comments.map((comment) => comment.id));
    const seen = new Set<string>();
    doc.querySelectorAll('[data-comment-id]').forEach((el) => {
      const id = el.getAttribute('data-comment-id') ?? '';
      if (!id || known.has(id) || seen.has(id)) return;
      seen.add(id);
      losses.unlinkedComments += 1;
    });
  }
  const walkList = (list: Element, depth: number): void => {
    Array.from(list.children).forEach((li) => {
      if (li.tagName !== 'LI') return;
      if (depth > 8) losses.deepListItems += 1;
      Array.from(li.children).forEach((nested) => {
        if (nested.tagName === 'UL' || nested.tagName === 'OL') walkList(nested, depth + 1);
      });
    });
  };
  doc.querySelectorAll('ul, ol').forEach((list) => {
    // 只从顶层列表开始遍历（嵌套列表由 walkList 递归处理）；closest 含自身，故从父级查起
    if (list.parentElement?.closest('ul, ol')) return;
    walkList(list, 0);
  });
  return { ok: true, value: losses };
}

/** Markdown 导出时的已知损耗清单（Markdown 语法边界之外的排版信息） */
export interface MarkdownExportLosses {
  /** 批注标记：Markdown 无批注概念，标记被丢弃（文本保留） */
  comments: number;
  /** 修订追踪的接受/拒绝语义丢失（插入/删除样式仍以 HTML 标签保留） */
  trackedChanges: number;
  /** 段落首行缩进与段前段后间距：Markdown 无段落级排版 */
  paragraphSpacing: number;
  /** 浮动图片退化为普通行内图片（浮于文字上方 / 衬于文字下方失效） */
  floatingImages: number;
  /** 页面设置（页眉 / 页脚 / 页码 / 纸张 / 边距）不随 Markdown 导出 */
  pageSetupFields: number;
}

/** 页面设置中「非默认」字段计数：默认值不算损耗 */
function countNonDefaultPageSetup(setup: Partial<PageSetupConfig> | null | undefined): number {
  const normalized = normalizePageSetup(setup ?? null);
  const defaults = DEFAULT_PAGE_SETUP;
  let count = 0;
  if (normalized.header.trim()) count += 1;
  if (normalized.footer.trim()) count += 1;
  if (normalized.showPageNumber !== defaults.showPageNumber) count += 1;
  if (normalized.size !== defaults.size || normalized.orientation !== defaults.orientation) {
    count += 1;
  }
  const marginDiffers = (['top', 'right', 'bottom', 'left'] as const).some(
    (side) => normalized.margin[side] !== defaults.margin[side],
  );
  if (marginDiffers) count += 1;
  return count;
}

/**
 * Markdown 导出前的差异扫描：列出无法用 Markdown 语法表达、会被丢弃的信息。
 * 可表达的部分（下划线 / 高亮 / 颜色 / 字号 / 分页符）由 htmlToMarkdown 内联 HTML 保留。
 */
export function scanMarkdownExportLosses(
  html: string,
  setup?: Partial<PageSetupConfig> | null,
): ToolResult<MarkdownExportLosses> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const paragraphSpacing = Array.from(doc.querySelectorAll('p, li')).filter((el) => {
    const style = (el as HTMLElement).style;
    if (!style) return false;
    return Boolean(style.textIndent || style.marginTop || style.marginBottom);
  }).length;
  const floatingImages = Array.from(doc.querySelectorAll('img[data-layer]')).filter(
    (img) => (img.getAttribute('data-layer') ?? 'inline') !== 'inline',
  ).length;
  return {
    ok: true,
    value: {
      comments: doc.querySelectorAll('[data-comment-id]').length,
      trackedChanges: doc.querySelectorAll('ins[data-track], del[data-track]').length,
      paragraphSpacing,
      floatingImages,
      pageSetupFields: countNonDefaultPageSetup(setup),
    },
  };
}
