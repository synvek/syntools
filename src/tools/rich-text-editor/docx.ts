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

/** 读取 PNG / JPEG 的像素尺寸（docx 的 ImageRun 需要显式给出 transformation） */
function readImageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const u32 = (offset: number) =>
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0;
  const u16 = (offset: number) => (bytes[offset] << 8) | bytes[offset + 1];
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
      const length = u16(offset + 2);
      const isSOF = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSOF) return { height: u16(offset + 5), width: u16(offset + 7) };
      offset += 2 + length;
    }
  }
  return null;
}

const MAX_IMAGE_WIDTH = 480;

/** data URL → 二进制字节（仅处理 base64 图片） */
function decodeDataUrl(src: string): { bytes: Uint8Array; type: 'png' | 'jpg' } | null {
  const match = DATA_URL_RE.exec(src);
  if (!match) return null;
  const [, mime, , payload] = match;
  const raw = atob(payload);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return { bytes, type: mime.toLowerCase().includes('jp') ? 'jpg' : 'png' };
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
        const width = size ? Math.min(MAX_IMAGE_WIDTH, size.width) : MAX_IMAGE_WIDTH;
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

/** 表格 → docx Table */
function buildTable(D: DocxNs, table: Element): InstanceType<DocxNs['Table']> {
  const rows: InstanceType<DocxNs['TableRow']>[] = [];
  Array.from(table.querySelectorAll('tr')).forEach((tr) => {
    const cells = Array.from(tr.children).map((child) => {
      const isHeader = child.tagName === 'TH';
      const paragraph = new D.Paragraph({
        children: cellRuns(D, child).children,
      });
      return new D.TableCell({
        children: [paragraph],
        shading: isHeader ? { fill: 'F3F4F6' } : undefined,
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
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
  const columnCount = Math.max(
    1,
    ...Array.from(table.querySelectorAll('tr')).map((tr) => tr.children.length),
  );
  const widthPct = Math.floor(100 / columnCount);
  return new D.Table({
    rows,
    width: { size: 100, type: D.WidthType.PERCENTAGE },
    columnWidths: Array.from({ length: columnCount }, () => widthPct).map((size) => size * 50),
  });
}

/** 列表（有序/无序/任务清单）→ docx 段落集合 */
function buildList(
  D: DocxNs,
  list: Element,
  ordered: boolean,
): InstanceType<DocxNs['Paragraph']>[] {
  const reference = ordered ? 'rte-number' : 'rte-bullet';
  return Array.from(list.children)
    .filter((child) => child.tagName === 'LI')
    .map((li) => {
      const children = Array.from(li.children).filter(
        (c) => c.tagName !== 'UL' && c.tagName !== 'OL',
      );
      const host = children.length > 0 ? children : [li];
      const runs = host.flatMap((piece) => collectRuns(D, piece, {}));
      return new D.Paragraph({
        children: runs,
        bullet: { level: 0 },
        numbering: { reference, level: 0 },
      });
    });
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

/** 导入 .docx：mammoth 解析 → 消毒 HTML */
export async function importDocx(file: File): Promise<ToolResult<string>> {
  const check = checkImportFile(file);
  if (!check.ok) return check;
  try {
    const buffer = await file.arrayBuffer();
    const mammoth = (await import('mammoth')).default;
    const parsed = await mammoth.convertToHtml({ arrayBuffer: buffer });
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
          {
            reference: 'rte-bullet',
            levels: [
              {
                level: 0,
                format: D.LevelFormat.BULLET,
                text: '•',
                alignment: D.AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
          {
            reference: 'rte-number',
            levels: [
              {
                level: 0,
                format: D.LevelFormat.DECIMAL,
                text: '%1.',
                alignment: D.AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } },
              },
            ],
          },
        ],
      },
      sections: [{ children }],
    });
    return { ok: true, value: await D.Packer.toBlob(document) };
  } catch {
    return { ok: false, error: 'EXPORT_FAILED' };
  }
}
