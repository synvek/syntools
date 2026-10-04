import type { ToolResult } from '@/core/types';
import { CONTENT_WIDTH_PX, checkExportSize, checkImportFile, sanitizeDocHtml } from './core';
import {
  COLUMN_GAP_MM,
  DEFAULT_PAGE_SETUP,
  MM_TO_PX,
  mmToTwip,
  normalizePageSetup,
  resolvePageMetrics,
  type PageSetupConfig,
} from './pageSetup';
import { renderWatermarkImage, type WatermarkImage } from './watermarkImage';
import { firstFontFamily, pxToHalfPoints } from './typography';
import { isFloatingImageLayer, normalizeImageLayer, pxToEmu } from './imageLayer';
import { FOOTNOTE_ATTR } from './footnotes';
import { latexToOmml } from './mathOmml';
import { renderLatexImages, type MathImage, type MathImageRequest } from './mathImage';
import type { DocComment, TrackedChange } from './docs';

/**
 * Word 双向适配层（重度依赖 mammoth / docx 均走动态 import，
 * 保证不进入首屏包，且不影响 core 层纯度）。
 */

/** docx 模块命名空间类型：用于在不静态引入依赖的前提下描述结构 */
type DocxNs = typeof import('docx');
type ParagraphOptions = import('docx').IParagraphOptions;

const DATA_URL_RE = /^data:(image\/(png|jpe?g|gif|webp|bmp));base64,(.+)$/i;

/** 读取 PNG / JPEG / GIF / BMP 的像素尺寸（docx 的 ImageRun 需要显式给出 transformation） */
function readImageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const u32 = (offset: number) =>
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0;
  const u16be = (offset: number) => (bytes[offset] << 8) | bytes[offset + 1];
  const u16le = (offset: number) => (bytes[offset + 1] << 8) | bytes[offset];
  // PNG: IHDR 宽高位于 offset 16/20
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: u32(16), height: u32(20) };
  }
  // JPEG: 扫描段的 SOF 标记
  if (bytes.length > 8 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset < bytes.length - 9) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      const length = u16be(offset + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSOF) return { height: u16be(offset + 5), width: u16be(offset + 7) };
      offset += 2 + length;
    }
  }
  // GIF: 逻辑屏幕描述符宽高（小端，offset 6/8）
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: u16le(6), height: u16le(8) };
  }
  // BMP: BITMAPINFOHEADER 宽高（小端，offset 18/22）
  if (bytes.length > 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return { width: u32(18), height: Math.abs(u32(22) | 0) };
  }
  return null;
}

const MAX_IMAGE_WIDTH = 480;

/** docx ImageRun 支持的位图类型（webp 不支持，由丢失清单提示） */
type DecodedImage = { bytes: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp' };

/** data URL → 二进制字节（仅处理 base64 图片） */
function decodeDataUrl(src: string): DecodedImage | null {
  const match = DATA_URL_RE.exec(src);
  if (!match) return null;
  const [, mime, , payload] = match;
  const lower = mime.toLowerCase();
  if (lower.includes('webp')) return null; // docx 不支持 webp
  const raw = atob(payload);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  const type: DecodedImage['type'] = lower.includes('jp')
    ? 'jpg'
    : lower.includes('png')
      ? 'png'
      : lower.includes('gif')
        ? 'gif'
        : 'bmp';
  return { bytes, type };
}

/** docx 高亮仅支持有限的颜色名，需由十六进制色取近似值 */
type DocxHighlight = NonNullable<import('docx').IRunStylePropertiesOptions['highlight']>;

const HIGHLIGHT_PALETTE: Record<string, DocxHighlight> = {
  ffffff: 'white',
  '000000': 'black',
  ff0000: 'red',
  '00ff00': 'green',
  '0000ff': 'blue',
  ffff00: 'yellow',
  '00ffff': 'cyan',
  ff00ff: 'magenta',
  '808080': 'darkGray',
  c0c0c0: 'lightGray',
  '008000': 'darkGreen',
  '000080': 'darkBlue',
  '800000': 'darkRed',
  '800080': 'darkMagenta',
  '008080': 'darkCyan',
  '808000': 'darkYellow',
};

interface Mark {
  bold?: boolean;
  italics?: boolean;
  underline?: Record<string, never> | true;
  strike?: boolean;
  color?: string;
  highlight?: DocxHighlight;
  font?: string;
  /** 字号（半磅值，Word 的 w:sz） */
  size?: number;
}

/** 十六进制 → 最近的 docx 高亮色名 */
function nearestHighlight(hex: string): DocxHighlight {
  const target = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let best: DocxHighlight = 'yellow';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [value, name] of Object.entries(HIGHLIGHT_PALETTE)) {
    const candidate = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
    const distance =
      (target[0] - candidate[0]) ** 2 +
      (target[1] - candidate[1]) ** 2 +
      (target[2] - candidate[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = name;
    }
  }
  return best;
}

const HEADING_LEVEL: Record<string, number> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

function normalizeColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const hex = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) return hex[1].toUpperCase();
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(value);
  if (rgb) {
    return [rgb[1], rgb[2], rgb[3]]
      .map((part) => Number(part).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return undefined;
}

/** 行样式 → 行属性：合并字色/高亮/加粗等 */
function mergeMark(parent: Mark, el: Element): Mark {
  const next: Mark = { ...parent };
  const style = (el as HTMLElement).style;
  const tag = el.tagName;
  if (tag === 'STRONG' || tag === 'B') next.bold = true;
  if (tag === 'EM' || tag === 'I') next.italics = true;
  if (tag === 'U') next.underline = true;
  if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') next.strike = true;
  if (tag === 'CODE') next.font = 'Consolas';
  if (tag === 'MARK') next.highlight = 'yellow';
  // 显式设置的字体/字号需写入 Word 行属性，否则导出后选择失效
  const family = firstFontFamily(style?.fontFamily);
  if (family) next.font = family;
  const sizePx = Number.parseFloat(style?.fontSize ?? '');
  const halfPoints = pxToHalfPoints(sizePx);
  if (halfPoints !== null) next.size = halfPoints;
  const color = normalizeColor(style?.color);
  if (color) next.color = color;
  const background = style?.backgroundColor ? normalizeColor(style.backgroundColor) : undefined;
  if (background) next.highlight = nearestHighlight(background);
  return next;
}

/**
 * 单个 <img> → docx ImageRun（图片节点自身，不依赖子节点）。
 * 层级（浮于文字上方 / 衬于文字下方）→ Word 浮动图片，嵌入型保持随文排版。
 */
function imageRun(D: DocxNs, el: Element): InstanceType<DocxNs['ImageRun']> | null {
  const decoded = decodeDataUrl(el.getAttribute('src') ?? '');
  if (!decoded) return null;
  const size = readImageSize(decoded.bytes);
  const ratio = size ? size.height / Math.max(1, size.width) : 0.62;
  // 优先使用编辑器中显式指定的宽度（style width / width 属性，px）
  const styleWidth = (el as HTMLElement).style.width;
  const rawWidth = styleWidth || el.getAttribute('width') || '';
  const parsedWidth = Number.parseFloat(rawWidth);
  const specified = Number.isFinite(parsedWidth)
    ? // 兼容旧数据：百分比宽度换算成像素（Word 里需要绝对尺寸）
      styleWidth.includes('%')
      ? (parsedWidth / 100) * CONTENT_WIDTH_PX
      : parsedWidth
    : undefined;
  const width = specified
    ? Math.min(MAX_IMAGE_WIDTH * 1.3, Math.max(16, specified))
    : size
      ? Math.min(MAX_IMAGE_WIDTH, size.width)
      : MAX_IMAGE_WIDTH;
  // 浮动图片锚定在所属段落，偏移相对分栏与段落，与编辑器的绝对定位语义一致
  const layer = normalizeImageLayer(el.getAttribute('data-layer'));
  const offsetX = Number.parseFloat((el as HTMLElement).style.left ?? '');
  const offsetY = Number.parseFloat((el as HTMLElement).style.top ?? '');
  const floating = isFloatingImageLayer(layer)
    ? {
        horizontalPosition: {
          relative: D.HorizontalPositionRelativeFrom.COLUMN,
          offset: pxToEmu(Number.isFinite(offsetX) ? offsetX : 0),
        },
        verticalPosition: {
          relative: D.VerticalPositionRelativeFrom.PARAGRAPH,
          offset: pxToEmu(Number.isFinite(offsetY) ? offsetY : 0),
        },
        wrap: { type: D.TextWrappingType.NONE },
        behindDocument: layer === 'behind',
        allowOverlap: true,
      }
    : undefined;
  return new D.ImageRun({
    data: decoded.bytes,
    type: decoded.type,
    transformation: { width, height: Math.round(width * ratio) },
    floating,
  });
}

/** 行内内容节点：在文本/图片之外补充超链接、修订与批注标记 */
type RunChild = InstanceType<
  | DocxNs['TextRun']
  | DocxNs['ImageRun']
  | DocxNs['ExternalHyperlink']
  | DocxNs['InsertedTextRun']
  | DocxNs['DeletedTextRun']
>;
type ParagraphChild = import('docx').ParagraphChild;

/**
 * 行内内容 + 其覆盖的批注集合。
 * 批注范围需要「合并连续同批注的 run」，因此在收集阶段先记录、渲染阶段再成对包裹。
 */
interface InlineRun {
  node: RunChild;
  /** 该 run 覆盖的批注 id（文档顺序） */
  commentIds: string[];
}

/** 修订追踪状态：进入 <ins>/<del> 后其内部文本节点直接生成 Word 修订运行 */
type TrackedKind = 'insert' | 'delete' | null;

/** 导出上下文：把 docx 命名空间与批注 / 修订 / 脚注所需的全局状态一并传递 */
interface ExportContext {
  D: DocxNs;
  /** 编辑器批注 id → Word 批注数字 id（仅包含有元数据的批注） */
  commentIds: Map<string, number>;
  /** 修订与批注署名 */
  author: string;
  /** 修订时间（统一取导出时刻，避免逐处新建 Date） */
  date: string;
  /** 修订 id 计数器：Word 要求文档内唯一 */
  revisionId: { value: number };
  /** 按正文顺序收集的脚注正文（编号 = 下标 + 1） */
  footnoteNotes: string[];
  /** OMML 表达不了的公式 → 预渲染图片（按 mathKey 索引） */
  mathImages: Map<string, MathImage>;
}

/** 超链接默认样式：docx 未内置 Hyperlink 字符样式，显式补蓝色下划线 */
function hyperlinkMark(mark: Mark): Mark {
  return { ...mark, color: mark.color ?? '0563C1', underline: mark.underline ?? true };
}

/** 生成一个文本运行（自动套用修订包装） */
function createTextRun(
  ctx: ExportContext,
  mark: Mark,
  tracked: TrackedKind,
  text: string,
): RunChild {
  const { D } = ctx;
  const options = {
    text,
    bold: mark.bold,
    italics: mark.italics,
    strike: mark.strike,
    underline: mark.underline ? {} : undefined,
    color: mark.color,
    highlight: mark.highlight,
    font: mark.font,
    size: mark.size,
  };
  if (!tracked) return new D.TextRun(options);
  const revision = {
    id: (ctx.revisionId.value += 1),
    author: ctx.author,
    date: ctx.date,
    ...options,
  };
  return tracked === 'insert' ? new D.InsertedTextRun(revision) : new D.DeletedTextRun(revision);
}

/**
 * 行内节点 → docx 行。
 * 覆盖：文本 / 换行 / 图片 / 超链接（ExternalHyperlink）/
 * 修订（ins → InsertedTextRun、del → DeletedTextRun）/ 批注范围（commentId 向后传递）。
 */
function collectInlineRuns(
  ctx: ExportContext,
  parent: Element,
  mark: Mark,
  commentIds: string[],
  tracked: TrackedKind,
): InlineRun[] {
  const { D } = ctx;
  const runs: InlineRun[] = [];
  parent.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      const text = node.textContent ?? '';
      if (!text) return;
      runs.push({ node: createTextRun(ctx, mark, tracked, text), commentIds });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;

    // 修订追踪：内部文本直接产出 Word 原生修订运行
    if (el.tagName === 'INS' && el.getAttribute('data-track') === 'insert') {
      runs.push(...collectInlineRuns(ctx, el, mergeMark(mark, el), commentIds, 'insert'));
      return;
    }
    if (el.tagName === 'DEL' && el.getAttribute('data-track') === 'delete') {
      runs.push(...collectInlineRuns(ctx, el, mergeMark(mark, el), commentIds, 'delete'));
      return;
    }

    if (el.tagName === 'A') {
      const href = (el.getAttribute('href') ?? '').trim();
      const inner = collectInlineRuns(ctx, el, hyperlinkMark(mark), commentIds, tracked);
      // 无 href 的锚点退化为普通文本，避免生成空链接
      if (!href || inner.length === 0) {
        runs.push(...inner);
        return;
      }
      runs.push({
        node: new D.ExternalHyperlink({
          link: href,
          children: inner.map((run) => run.node) as ParagraphChild[],
        }),
        commentIds,
      });
      return;
    }

    if (el.tagName === 'BR') {
      runs.push({
        node: tracked
          ? createTextRun(ctx, mark, tracked, '')
          : new D.TextRun({ text: '', break: 1 }),
        commentIds,
      });
      return;
    }

    // 行内公式 → 原生公式（OMML）或降级图片
    if (el.hasAttribute('data-math') && el.getAttribute('data-display') !== 'true') {
      runs.push({ node: buildMathRun(ctx, el), commentIds });
      return;
    }

    // 脚注引用 → Word 脚注：编号取正文顺序（权威来源是遍历顺序，不信任 HTML 里的编号）
    if (el.tagName === 'SUP' && el.hasAttribute(FOOTNOTE_ATTR)) {
      ctx.footnoteNotes.push((el.getAttribute('data-note') ?? '').trim());
      runs.push({
        node: new D.FootnoteReferenceRun(ctx.footnoteNotes.length),
        commentIds,
      });
      return;
    }

    if (el.tagName === 'IMG') {
      const run = imageRun(D, el);
      if (run) runs.push({ node: run, commentIds });
      return;
    }

    // 批注标记：把 id 叠加到后续内容，渲染阶段再成对包裹
    const commentId = el.getAttribute('data-comment-id');
    const nested =
      commentId && ctx.commentIds.has(commentId) ? [...commentIds, commentId] : commentIds;
    runs.push(...collectInlineRuns(ctx, el, mergeMark(mark, el), nested, tracked));
  });
  return runs;
}

/**
 * 把行内内容渲染为段落子节点，并为连续的批注内容成对插入
 * CommentRangeStart / CommentRangeEnd / CommentReference（Word 批注必需的三段标记）。
 * 批注集合发生变化时整体收合再重开，保证范围严格嵌套（Word 不接受交叉范围）。
 */
function runsToChildren(ctx: ExportContext, runs: readonly InlineRun[]): ParagraphChild[] {
  const { D } = ctx;
  const children: ParagraphChild[] = [];
  let open: string[] = [];
  const sameSet = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((id, index) => id === b[index]);

  runs.forEach((run) => {
    if (!sameSet(open, run.commentIds)) {
      [...open].reverse().forEach((id) => {
        const numeric = ctx.commentIds.get(id);
        if (numeric === undefined) return;
        children.push(new D.CommentRangeEnd(numeric), new D.CommentReference(numeric));
      });
      run.commentIds.forEach((id) => {
        const numeric = ctx.commentIds.get(id);
        if (numeric !== undefined) children.push(new D.CommentRangeStart(numeric));
      });
      open = [...run.commentIds];
    }
    children.push(run.node as ParagraphChild);
  });

  [...open].reverse().forEach((id) => {
    const numeric = ctx.commentIds.get(id);
    if (numeric === undefined) return;
    children.push(new D.CommentRangeEnd(numeric), new D.CommentReference(numeric));
  });

  return children;
}

/** 单元格/段落级别的一站式转换 */
function blockChildren(ctx: ExportContext, parent: Element): ParagraphChild[] {
  return runsToChildren(ctx, collectInlineRuns(ctx, parent, {}, [], null));
}

/** A4 内容宽度（170mm）换算为 twip（1mm ≈ 56.7 twip），用于按百分比列宽换算 */
const CONTENT_WIDTH_DXA = 9640;

/** 读取 TipTap 表格 colgroup 的百分比/像素列宽（dxa） */
function readColumnWidthsDxa(table: Element, columnCount: number): number[] {
  const cols = Array.from(table.querySelectorAll('colgroup > col'));
  if (cols.length === 0) {
    const widthPct = Math.floor(100 / columnCount);
    return Array.from({ length: columnCount }, () =>
      Math.round((widthPct / 100) * CONTENT_WIDTH_DXA),
    );
  }
  const pcts = cols.map((col) => {
    const style = (col as HTMLElement).style;
    const pct = Number.parseFloat(style.width);
    return Number.isFinite(pct) ? pct : 100 / Math.max(1, cols.length);
  });
  const total = pcts.reduce((sum, pct) => sum + pct, 0) || 100;
  return pcts.map((pct) => Math.round((pct / total) * CONTENT_WIDTH_DXA));
}

/** 表格 → docx Table（保留列宽 / 合并单元格 / 单元格底色） */
function buildTable(ctx: ExportContext, table: Element): InstanceType<DocxNs['Table']> {
  const D = ctx.D;
  const colCount =
    table.querySelectorAll('colgroup > col').length ||
    Math.max(
      1,
      ...Array.from(table.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.children).reduce(
          (sum, cell) => sum + Math.max(1, Number(cell.getAttribute('colspan')) || 1),
          0,
        ),
      ),
    );
  // 表格样式：边框开关与斑马纹（data 属性由 TableStyle 扩展写入）
  const bordered = table.getAttribute('data-bordered') !== 'false';
  const zebra = table.getAttribute('data-zebra') === 'true';
  const rows: InstanceType<DocxNs['TableRow']>[] = [];
  Array.from(table.querySelectorAll('tr')).forEach((tr, rowIndex) => {
    const zebraFill = zebra && rowIndex % 2 === 1 ? 'F9FAFB' : undefined;
    const cells = Array.from(tr.children).map((child) => {
      const isHeader = child.tagName === 'TH';
      const background =
        normalizeColor((child as HTMLElement).style.backgroundColor) ??
        zebraFill ??
        (isHeader ? 'F3F4F6' : undefined);
      const colspan = Math.max(1, Number(child.getAttribute('colspan')) || 1);
      const rowspan = Math.max(1, Number(child.getAttribute('rowspan')) || 1);
      const paragraph = new D.Paragraph({
        children: blockChildren(ctx, child),
      });
      return new D.TableCell({
        children: [paragraph],
        shading: background ? { fill: background } : undefined,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        columnSpan: colspan > 1 ? colspan : undefined,
        rowSpan: rowspan > 1 ? rowspan : undefined,
      });
    });
    if (cells.length === 0) return;
    rows.push(
      new D.TableRow({
        children: cells,
        tableHeader: tr.children[0]?.tagName === 'TH',
      }),
    );
  });
  return new D.Table({
    rows,
    width: { size: 100, type: D.WidthType.PERCENTAGE },
    columnWidths: readColumnWidthsDxa(table, colCount),
    borders: bordered
      ? undefined
      : {
          top: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideVertical: { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' },
        },
  });
}

/** docx 编号最多 9 级（0-8），超出部分拍平到最深层 */
const MAX_LIST_LEVEL = 8;

/** 生成 0-8 级编号定义：无序用圆点循环，有序用多级十进制（%1.%2.…） */
function buildNumberingLevels(D: DocxNs, bullet: boolean) {
  const bulletGlyphs = ['\u2022', '\u25E6', '\u25AA'];
  return Array.from({ length: MAX_LIST_LEVEL + 1 }, (_, level) => {
    const text = bullet
      ? bulletGlyphs[level % bulletGlyphs.length]
      : `${Array.from({ length: level + 1 }, (_, i) => `%${i + 1}`).join('.')}.`;
    return {
      level,
      format: bullet ? D.LevelFormat.BULLET : D.LevelFormat.DECIMAL,
      text,
      alignment: D.AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
    };
  });
}

/** 列表（有序/无序/任务清单）→ docx 段落集合，保留嵌套层级 */
function buildList(
  ctx: ExportContext,
  list: Element,
  ordered: boolean,
  depth = 0,
): InstanceType<DocxNs['Paragraph']>[] {
  const D = ctx.D;
  const reference = ordered ? 'rte-number' : 'rte-bullet';
  const level = Math.min(depth, MAX_LIST_LEVEL);
  const isTaskList = list.getAttribute('data-type') === 'taskList';
  const out: InstanceType<DocxNs['Paragraph']>[] = [];
  Array.from(list.children)
    .filter((child) => child.tagName === 'LI')
    .forEach((li) => {
      const inline = Array.from(li.children).filter(
        (c) => c.tagName !== 'UL' && c.tagName !== 'OL',
      );
      const host = inline.length > 0 ? inline : [li];
      const children = host.flatMap((piece) => blockChildren(ctx, piece));
      // 任务清单：复选框状态转为前缀符号
      if (isTaskList) {
        const checked = li.getAttribute('data-checked') === 'true';
        children.unshift(new D.TextRun({ text: checked ? '\u2611 ' : '\u2610 ' }));
      }
      out.push(
        new D.Paragraph({
          children,
          bullet: ordered ? undefined : { level },
          numbering: ordered ? { reference, level } : undefined,
        }),
      );
      // 递归导出嵌套子列表
      Array.from(li.children)
        .filter((c) => c.tagName === 'UL' || c.tagName === 'OL')
        .forEach((nested) => {
          out.push(...buildList(ctx, nested, nested.tagName === 'OL', depth + 1));
        });
    });
  return out;
}

/** 标题层级 → docx HeadingLevel（避免索引访问导致的类型不精确） */
function headingLevel(D: DocxNs, level: number) {
  switch (level) {
    case 1:
      return D.HeadingLevel.HEADING_1;
    case 2:
      return D.HeadingLevel.HEADING_2;
    case 3:
      return D.HeadingLevel.HEADING_3;
    case 4:
      return D.HeadingLevel.HEADING_4;
    case 5:
      return D.HeadingLevel.HEADING_5;
    default:
      return D.HeadingLevel.HEADING_6;
  }
}

/** text-align → docx AlignmentType */
function alignmentType(D: DocxNs, align: string | undefined) {
  if (align === 'center') return D.AlignmentType.CENTER;
  if (align === 'right') return D.AlignmentType.RIGHT;
  if (align === 'justify') return D.AlignmentType.JUSTIFIED;
  return undefined;
}

function blockAlignment(el: Element): string | undefined {
  return (el.getAttribute('style') ?? '').match(/text-align:\s*(\w+)/)?.[1];
}

/** 区块级子节点：段落 / 表格 / 目录域 */
type BlockChild = InstanceType<DocxNs['Paragraph'] | DocxNs['Table'] | DocxNs['TableOfContents']>;

/**
 * 目录节点 → Word 目录域（TOC field）。
 * 条目文本取自导出 HTML 中已渲染的 `li[data-level]`，
 * 作为 cachedEntries 让文档打开即显示目录；页码由 Word 更新域时重算，
 * 因此编辑器侧算出的页码只是「打开前的预览值」。
 */
function buildTocField(D: DocxNs, el: Element): InstanceType<DocxNs['TableOfContents']> {
  const caption = el.querySelector('.rte-toc-title')?.textContent?.trim() ?? '';
  const cachedEntries = Array.from(el.querySelectorAll('li[data-level]')).map((item) => {
    const text = item.querySelector('.rte-toc-text')?.textContent?.trim() ?? '';
    const page = Number.parseInt(item.querySelector('.rte-toc-page')?.textContent ?? '', 10);
    return {
      title: text,
      level: Math.max(1, Number(item.getAttribute('data-level')) || 1),
      page: Number.isFinite(page) && page > 0 ? page : 1,
    };
  });
  return new D.TableOfContents(caption || undefined, {
    hyperlink: true,
    headingStyleRange: '1-6',
    cachedEntries,
    beginDirty: true,
  });
}

/** 正文 HTML → docx 文档内容数组 */
function htmlToDocxChildren(ctx: ExportContext, root: Element): BlockChild[] {
  const D = ctx.D;
  const out: BlockChild[] = [];
  Array.from(root.children).forEach((el) => {
    const heading = HEADING_LEVEL[el.tagName];
    if (el.hasAttribute('data-toc')) {
      out.push(buildTocField(D, el));
      return;
    }
    // 块级公式：独占一行，Word 中作为独立公式段落
    if (el.hasAttribute('data-math')) {
      out.push(new D.Paragraph({ children: [buildMathRun(ctx, el) as ParagraphChild] }));
      return;
    }
    if (el.hasAttribute('data-page-break')) {
      // 分页符：空段落 + pageBreakBefore
      out.push(new D.Paragraph({ children: [], pageBreakBefore: true }));
      return;
    }
    // 图片在编辑器里是块级节点（独占一行）：必须包一层段落输出，否则导出时整张图被丢弃。
    // 注意要处理 <img> 元素本身（它没有子节点），不能沿用遍历子节点的 collectInlineRuns。
    if (el.tagName === 'IMG') {
      const run = imageRun(D, el);
      out.push(
        new D.Paragraph({
          children: run ? [run] : [],
          alignment: alignmentType(D, blockAlignment(el)),
        }),
      );
      return;
    }
    if (el.tagName === 'TABLE') {
      out.push(buildTable(ctx, el));
      return;
    }
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      out.push(...buildList(ctx, el, el.tagName === 'OL'));
      return;
    }
    if (el.tagName === 'HR') {
      out.push(
        new D.Paragraph({
          text: '',
          border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: 'D1D5DB' } },
        }),
      );
      return;
    }
    if (el.tagName === 'PRE') {
      const text = el.textContent ?? '';
      out.push(
        new D.Paragraph({
          children: [new D.TextRun({ text, font: 'Consolas' })],
          shading: { fill: 'F3F4F6' },
        }),
      );
      return;
    }
    // 段落排版：首行缩进与段前段后（内联样式为 px，需换算成 twip：1px = 15 twip）
    const PX_TO_TWIP = 15;
    const style = (el as HTMLElement).style;
    const textIndent = style?.textIndent
      ? Math.round(Number.parseFloat(style.textIndent) * PX_TO_TWIP)
      : 0;
    // 未设置内联样式时沿用原有默认间距（120 twip）
    const spaceBefore = style?.marginTop
      ? Math.round(Number.parseFloat(style.marginTop) * PX_TO_TWIP)
      : 120;
    const spaceAfter = style?.marginBottom
      ? Math.round(Number.parseFloat(style.marginBottom) * PX_TO_TWIP)
      : 120;

    const paragraphOptions: ParagraphOptions = {
      children: blockChildren(ctx, el),
      alignment: alignmentType(D, blockAlignment(el)),
      heading: heading ? headingLevel(D, heading) : undefined,
      indent: textIndent > 0 ? { firstLine: textIndent } : undefined,
      spacing: {
        before: Math.max(0, spaceBefore),
        after: Math.max(0, spaceAfter),
        line: 300,
      },
    };
    out.push(
      el.tagName === 'BLOCKQUOTE'
        ? new D.Paragraph({
            ...paragraphOptions,
            indent: { left: 720 },
            shading: { fill: 'F9FAFB' },
          })
        : new D.Paragraph(paragraphOptions),
    );
  });
  return out;
}

/** mammoth 样式映射：把 Word 内置/中文样式映射为语义 HTML（标题 1-6 默认已映射） */
const MAMMOTH_STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='标题'] => h1:fresh",
  "p[style-name='副标题'] => h2:fresh",
  "p[style-name='引用'] => blockquote:fresh",
  "p[style-name='明显引用'] => blockquote:fresh",
  "p[style-name='代码'] => pre:fresh",
];

/** 导入 .docx：mammoth 解析（含样式映射）→ 消毒 HTML */
export async function importDocx(file: File): Promise<ToolResult<string>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;
  try {
    const buffer = await file.arrayBuffer();
    const mammoth = (await import('mammoth')).default;
    // mammoth 的浏览器构建认 `arrayBuffer`，Node 构建只认 `buffer`（且 buffer 优先），
    // 一次传入两种形态即可在两种环境都命中，无需失败重试（重试会产生未处理拒绝）
    const nodeBuffer =
      typeof Buffer === 'undefined' ? undefined : Buffer.from(new Uint8Array(buffer));
    const parsed = await mammoth.convertToHtml(
      (nodeBuffer ? { arrayBuffer: buffer, buffer: nodeBuffer } : { arrayBuffer: buffer }) as {
        arrayBuffer: ArrayBuffer;
      },
      { styleMap: MAMMOTH_STYLE_MAP },
    );
    return sanitizeDocHtml(parsed.value);
  } catch (error) {
    console.error('[richText] docx import failed:', error);
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}

/** 审阅元数据：批注清单、修订条目与署名 */
export interface DocxReviewOptions {
  comments?: DocComment[];
  changes?: TrackedChange[];
  /** 批注与修订的署名 */
  author?: string;
}

/** 公式去重键：同一条公式（含展示模式）只渲染一次 */
function mathKey(latex: string, display: boolean): string {
  return `${display ? 'block' : 'inline'}|${latex}`;
}

/**
 * 公式节点 → Word 内容。
 * 优先输出原生公式（OMML，Word 中可继续编辑）；
 * 语法不支持时用预渲染的图片降级，保证视觉一致；
 * 图片也拿不到时退回 LaTeX 源码文本，绝不静默丢内容。
 */
function buildMathRun(
  ctx: ExportContext,
  el: Element,
): InstanceType<DocxNs['TextRun'] | DocxNs['ImageRun'] | DocxNs['Math']> {
  const { D } = ctx;
  const latex = (el.getAttribute('data-latex') ?? '').trim();
  const display = el.getAttribute('data-display') === 'true';
  const omml = latexToOmml(D, latex);
  if (omml) return omml;

  const image = ctx.mathImages.get(mathKey(latex, display));
  if (image) {
    const decoded = decodeDataUrl(image.dataUrl);
    if (decoded) {
      const width = Math.min(MAX_IMAGE_WIDTH * 1.3, Math.max(16, image.width));
      const ratio = image.height / Math.max(1, image.width);
      return new D.ImageRun({
        data: decoded.bytes,
        type: decoded.type,
        transformation: {
          width: Math.round(width),
          height: Math.max(8, Math.round(width * ratio)),
        },
      });
    }
  }
  // 兜底：原样输出源码，至少内容不丢
  return new D.TextRun({ text: display ? `$$${latex}$$` : `$${latex}$` });
}

type CommentsOptions = NonNullable<import('docx').ICommentsOptions>;

/**
 * 生成 Word 原生批注：正文标记由 runsToChildren 写入，此处只提供批注内容。
 *
 * 注意：当前 docx 版本只序列化 `comments.xml`（批注正文 / 作者 / 时间），
 * `resolved` 标志不会落盘；已解决的批注在编辑器侧已移除正文标记，
 * 因此不会出现在导出文档中，行为与 Word「已解决批注默认隐藏」一致。
 */
function buildComments(
  D: DocxNs,
  comments: readonly DocComment[],
  author: string,
): CommentsOptions | undefined {
  if (comments.length === 0) return undefined;
  return {
    // ICommentsOptions 接收的是普通选项对象（docx 内部再构造 Comment 组件）
    children: comments.map((comment, index) => {
      const byline = comment.author.trim() || author;
      return {
        id: index,
        author: byline,
        initials: byline.slice(0, 2),
        date: comment.createdAt > 0 ? new Date(comment.createdAt) : new Date(),
        resolved: comment.resolved,
        children: [
          ...(comment.quote.trim()
            ? [
                new D.Paragraph({
                  children: [new D.TextRun({ text: comment.quote.trim(), italics: true })],
                }),
              ]
            : []),
          new D.Paragraph({ children: [new D.TextRun({ text: comment.text })] }),
        ],
      };
    }),
  };
}

/** 导出 .docx：编辑器 HTML → Word 文档 Blob（含页面设置、页眉页脚、批注与修订） */
export async function exportDocxBlob(
  html: string,
  title: string,
  setupInput?: PageSetupConfig | null,
  review?: DocxReviewOptions | null,
): Promise<ToolResult<Blob>> {
  const check = checkExportSize(html);
  if (!check.ok) return check;
  try {
    const setup = normalizePageSetup(setupInput ?? DEFAULT_PAGE_SETUP);
    const metrics = resolvePageMetrics(setup);
    const D = await import('docx');
    const comments = review?.comments ?? [];
    const ctx: ExportContext = {
      D,
      // 仅正文中确实引用了的批注才需要数字 id；顺序即 Word 批注窗格顺序
      commentIds: new Map(comments.map((comment, index) => [comment.id, index])),
      author: review?.author?.trim() || 'SynTools',
      date: new Date().toISOString(),
      revisionId: { value: 1000 },
      footnoteNotes: [],
      mathImages: new Map(),
    };
    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 先把「OMML 表达不了」的公式离屏渲染为图片（异步），再进入同步的遍历阶段
    const mathRequests: MathImageRequest[] = [];
    const seenMath = new Set<string>();
    Array.from(doc.querySelectorAll('[data-math]')).forEach((el) => {
      const latex = (el.getAttribute('data-latex') ?? '').trim();
      if (!latex) return;
      const display = el.getAttribute('data-display') === 'true';
      const key = mathKey(latex, display);
      if (seenMath.has(key)) return;
      seenMath.add(key);
      if (latexToOmml(D, latex)) return;
      mathRequests.push({ key, latex, display });
    });
    ctx.mathImages = await renderLatexImages(mathRequests);

    const children = htmlToDocxChildren(ctx, doc.body);
    if (children.length === 0) {
      children.push(new D.Paragraph({ children: [] }));
    }
    // 水印：Word 行属性不支持文字旋转，改为页眉中的浮动透明图片（衬于文字下方）
    const watermarkImage = await renderWatermarkImage(
      setup.watermark,
      metrics.contentWidthMm * MM_TO_PX,
      metrics.contentHeightMm * MM_TO_PX,
    );
    const watermarkChild = watermarkImage
      ? (buildWatermarkRun(D, watermarkImage) ?? undefined)
      : undefined;

    const commentOptions = buildComments(D, comments, ctx.author);
    // 脚注正文由遍历正文时收集，编号即数组下标 + 1（与 FootnoteReferenceRun 一致）
    const footnoteOptions =
      ctx.footnoteNotes.length > 0
        ? Object.fromEntries(
            ctx.footnoteNotes.map((note, index) => [
              String(index + 1),
              {
                // docx 会自动在脚注段落前插入 w:footnoteRef（引用序号），
                // 这里只写正文，避免出现两个序号
                children: [
                  new D.Paragraph({
                    children: [new D.TextRun({ text: note || ' ', size: 18 })],
                  }),
                ],
              },
            ]),
          )
        : undefined;
    const document = new D.Document({
      title: title || 'SynTools Document',
      creator: 'SynTools',
      numbering: {
        config: [
          { reference: 'rte-bullet', levels: buildNumberingLevels(D, true) },
          { reference: 'rte-number', levels: buildNumberingLevels(D, false) },
        ],
      },
      // 修订追踪：正文中的 ins/del 已映射为 Word 修订运行，
      // 打开开关让 Word 以「修订」模式呈现并允许接受/拒绝
      features: {
        trackRevisions: (review?.changes?.length ?? 0) > 0,
        updateFields: true,
      },
      ...(commentOptions ? { comments: commentOptions } : {}),
      ...(footnoteOptions ? { footnotes: footnoteOptions } : {}),
      // 页面背景色（Word 打开时铺满纸张）
      ...(setup.background ? { background: { color: setup.background } } : {}),
      sections: [
        {
          properties: {
            page: {
              // Word 约定：pgSz 始终写纵向尺寸，靠 orient 标志表达横向
              size: {
                width: mmToTwip(
                  setup.orientation === 'landscape' ? metrics.heightMm : metrics.widthMm,
                ),
                height: mmToTwip(
                  setup.orientation === 'landscape' ? metrics.widthMm : metrics.heightMm,
                ),
                orientation:
                  setup.orientation === 'landscape'
                    ? D.PageOrientation.LANDSCAPE
                    : D.PageOrientation.PORTRAIT,
              },
              margin: {
                top: mmToTwip(setup.margin.top),
                right: mmToTwip(setup.margin.right),
                bottom: mmToTwip(setup.margin.bottom),
                left: mmToTwip(setup.margin.left),
              },
            },
            // 分栏：Word 自行按栏流排（与屏幕流式视图 / 打印一致）
            ...(setup.columns > 1
              ? {
                  column: {
                    count: setup.columns,
                    space: mmToTwip(COLUMN_GAP_MM),
                    equalWidth: true,
                    separate: false,
                  },
                }
              : {}),
            // 首页不同：为 true 时首页不再显示页眉页脚（与 Word「首页不同」一致）
            ...(setup.differentFirstPage ? { titlePage: true } : {}),
          },
          headers: buildHeaderFooter(D, setup, 'header', watermarkChild),
          footers: buildHeaderFooter(D, setup, 'footer'),
          children,
        },
      ],
    });
    return { ok: true, value: await D.Packer.toBlob(document) };
  } catch (error) {
    console.error('[richText] docx export failed:', error);
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}

/**
 * 水印 → 页眉中锚定到页面的浮动图片（衬于文字下方）。
 * Word 的水印本质上就是页眉里的 behindDoc 图形，因此这一做法与 Word 行为一致。
 */
function buildWatermarkRun(
  D: DocxNs,
  image: WatermarkImage,
): InstanceType<DocxNs['ImageRun']> | null {
  const decoded = decodeDataUrl(image.dataUrl);
  if (!decoded) return null;
  return new D.ImageRun({
    data: decoded.bytes,
    type: decoded.type,
    transformation: { width: image.width, height: image.height },
    floating: {
      horizontalPosition: { relative: D.HorizontalPositionRelativeFrom.PAGE, offset: 0 },
      verticalPosition: { relative: D.VerticalPositionRelativeFrom.PAGE, offset: 0 },
      wrap: { type: D.TextWrappingType.NONE },
      behindDocument: true,
      allowOverlap: true,
    },
  });
}

/** 生成 docx 页眉/页脚（无内容时返回 undefined，避免出现空页眉） */
function buildHeaderFooter(
  D: DocxNs,
  setup: PageSetupConfig,
  kind: 'header' | 'footer',
  extra: InstanceType<DocxNs['ImageRun']> | undefined = undefined,
): { default: InstanceType<DocxNs['Header'] | DocxNs['Footer']> } | undefined {
  const text = (kind === 'header' ? setup.header : setup.footer).trim();
  const pageNumber = kind === 'footer' && setup.showPageNumber;
  if (!text && !pageNumber && !extra) return undefined;
  const children: InstanceType<DocxNs['Paragraph']>[] = [
    new D.Paragraph({
      alignment: pageNumber && !text ? D.AlignmentType.CENTER : D.AlignmentType.LEFT,
      children: [
        ...(text ? [new D.TextRun({ text })] : []),
        ...(pageNumber
          ? [
              new D.TextRun({
                children: [text ? '  ' : '', D.PageNumber.CURRENT],
              }),
            ]
          : []),
        ...(extra ? [extra] : []),
      ],
    }),
  ];
  return {
    default: kind === 'header' ? new D.Header({ children }) : new D.Footer({ children }),
  } as { default: InstanceType<DocxNs['Header'] | DocxNs['Footer']> };
}
