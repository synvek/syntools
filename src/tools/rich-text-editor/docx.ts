import type { ToolResult } from '@/core/types';
import { checkExportSize, checkImportFile, sanitizeDocHtml } from './core';

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
  const color = normalizeColor(style?.color);
  if (color) next.color = color;
  const background = style?.backgroundColor ? normalizeColor(style.backgroundColor) : undefined;
  if (background) next.highlight = nearestHighlight(background);
  return next;
}

/** 行内节点 → docx 行（TextRun / ImageRun） */
function collectRuns(
  D: DocxNs,
  parent: Element,
  mark: Mark,
): InstanceType<DocxNs['TextRun'] | DocxNs['ImageRun']>[] {
  const runs: InstanceType<DocxNs['TextRun'] | DocxNs['ImageRun']>[] = [];
  parent.childNodes.forEach((node) => {
    if (node.nodeType === 3) {
      const text = node.textContent ?? '';
      if (!text) return;
      runs.push(
        new D.TextRun({
          text,
          bold: mark.bold,
          italics: mark.italics,
          strike: mark.strike,
          underline: mark.underline ? {} : undefined,
          color: mark.color,
          highlight: mark.highlight,
          font: mark.font,
        }),
      );
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.tagName === 'BR') {
      runs.push(new D.TextRun({ text: '', break: 1 }));
      return;
    }
    if (el.tagName === 'IMG') {
      const decoded = decodeDataUrl(el.getAttribute('src') ?? '');
      if (decoded) {
        const size = readImageSize(decoded.bytes);
        const ratio = size ? size.height / Math.max(1, size.width) : 0.62;
        // 优先使用编辑器中显式指定的宽度（style width / width 属性，px）
        const styleWidth = Number.parseInt((el as HTMLElement).style.width, 10);
        const attrWidth = Number.parseInt(el.getAttribute('width') ?? '', 10);
        const specified = Number.isFinite(styleWidth)
          ? styleWidth
          : Number.isFinite(attrWidth)
            ? attrWidth
            : undefined;
        const width = specified
          ? Math.min(MAX_IMAGE_WIDTH * 1.3, Math.max(16, specified))
          : size
            ? Math.min(MAX_IMAGE_WIDTH, size.width)
            : MAX_IMAGE_WIDTH;
        runs.push(
          new D.ImageRun({
            data: decoded.bytes,
            type: decoded.type,
            transformation: { width, height: Math.round(width * ratio) },
          }),
        );
      }
      return;
    }
    runs.push(...collectRuns(D, el, mergeMark(mark, el)));
  });
  return runs;
}

interface CellRunOptions {
  children: InstanceType<DocxNs['TextRun'] | DocxNs['ImageRun']>[];
}

function cellRuns(D: DocxNs, cell: Element): CellRunOptions {
  return { children: collectRuns(D, cell, {}) };
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
function buildTable(D: DocxNs, table: Element): InstanceType<DocxNs['Table']> {
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
  const rows: InstanceType<DocxNs['TableRow']>[] = [];
  Array.from(table.querySelectorAll('tr')).forEach((tr) => {
    const cells = Array.from(tr.children).map((child) => {
      const isHeader = child.tagName === 'TH';
      const background =
        normalizeColor((child as HTMLElement).style.backgroundColor) ??
        (isHeader ? 'F3F4F6' : undefined);
      const colspan = Math.max(1, Number(child.getAttribute('colspan')) || 1);
      const rowspan = Math.max(1, Number(child.getAttribute('rowspan')) || 1);
      const paragraph = new D.Paragraph({
        children: cellRuns(D, child).children,
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
  D: DocxNs,
  list: Element,
  ordered: boolean,
  depth = 0,
): InstanceType<DocxNs['Paragraph']>[] {
  const reference = ordered ? 'rte-number' : 'rte-bullet';
  const level = Math.min(depth, MAX_LIST_LEVEL);
  const isTaskList = list.getAttribute('data-type') === 'taskList';
  const out: InstanceType<DocxNs['Paragraph']>[] = [];
  Array.from(list.children)
    .filter((child) => child.tagName === 'LI')
    .forEach((li) => {
      const children = Array.from(li.children).filter(
        (c) => c.tagName !== 'UL' && c.tagName !== 'OL',
      );
      const host = children.length > 0 ? children : [li];
      const runs = host.flatMap((piece) => collectRuns(D, piece, {}));
      // 任务清单：复选框状态转为前缀符号
      if (isTaskList) {
        const checked = li.getAttribute('data-checked') === 'true';
        runs.unshift(new D.TextRun({ text: checked ? '\u2611 ' : '\u2610 ' }));
      }
      out.push(
        new D.Paragraph({
          children: runs,
          bullet: ordered ? undefined : { level },
          numbering: ordered ? { reference, level } : undefined,
        }),
      );
      // 递归导出嵌套子列表
      Array.from(li.children)
        .filter((c) => c.tagName === 'UL' || c.tagName === 'OL')
        .forEach((nested) => {
          out.push(...buildList(D, nested, nested.tagName === 'OL', depth + 1));
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

/** 正文 HTML → docx 文档内容数组 */
function htmlToDocxChildren(
  D: DocxNs,
  root: Element,
): (InstanceType<DocxNs['Paragraph']> | InstanceType<DocxNs['Table']>)[] {
  const out: (InstanceType<DocxNs['Paragraph']> | InstanceType<DocxNs['Table']>)[] = [];
  Array.from(root.children).forEach((el) => {
    const heading = HEADING_LEVEL[el.tagName];
    if (el.hasAttribute('data-page-break')) {
      // 分页符：空段落 + pageBreakBefore
      out.push(new D.Paragraph({ children: [], pageBreakBefore: true }));
      return;
    }
    if (el.tagName === 'TABLE') {
      out.push(buildTable(D, el));
      return;
    }
    if (el.tagName === 'UL' || el.tagName === 'OL') {
      out.push(...buildList(D, el, el.tagName === 'OL'));
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
    const paragraphOptions: ParagraphOptions = {
      children: collectRuns(D, el, {}),
      alignment: alignmentType(D, blockAlignment(el)),
      heading: heading ? headingLevel(D, heading) : undefined,
      spacing: { before: 120, after: 120, line: 300 },
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
    const parsed = await mammoth.convertToHtml(
      { arrayBuffer: buffer },
      { styleMap: MAMMOTH_STYLE_MAP },
    );
    return sanitizeDocHtml(parsed.value);
  } catch {
    return { ok: false, error: 'IMPORT_FAILED' };
  }
}

/** 导出 .docx：编辑器 HTML → Word 文档 Blob */
export async function exportDocxBlob(html: string, title: string): Promise<ToolResult<Blob>> {
  const check = checkExportSize(html);
  if (!check.ok) return check;
  try {
    const D = await import('docx');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const children = htmlToDocxChildren(D, doc.body);
    if (children.length === 0) {
      children.push(new D.Paragraph({ children: [] }));
    }
    const document = new D.Document({
      title: title || 'SynTools Document',
      creator: 'SynTools',
      numbering: {
        config: [
          { reference: 'rte-bullet', levels: buildNumberingLevels(D, true) },
          { reference: 'rte-number', levels: buildNumberingLevels(D, false) },
        ],
      },
      sections: [{ children }],
    });
    return { ok: true, value: await D.Packer.toBlob(document) };
  } catch {
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}
