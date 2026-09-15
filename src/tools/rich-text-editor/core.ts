import DOMPurify from 'dompurify';
import type { ToolResult } from '@/core/types';

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
  | 'SNAPSHOT_FAILED';

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
export function buildExportFilename(title: string, ext: 'docx' | 'pdf'): string {
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
