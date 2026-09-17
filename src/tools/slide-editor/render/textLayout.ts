import type { Paragraph, RunStyle, TextBody, VAlign } from '../model/types';

/**
 * 文本排版：把 TextBody（段落 + run 级混排）转换成可绘制的行/片段。
 *
 * Konva.Text 只支持整块统一样式，无法表达 pptx 同一段落内的 `<a:r>` 混排，
 * 因此这里用一个离线 canvas 的 measureText 自行折行，
 * 每个 run 片段交给一个 Konva.Text 节点定位绘制，从而保留加粗/颜色/字号差异。
 */

export interface LayoutSegment {
  text: string;
  style: RunStyle;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutLine {
  y: number;
  height: number;
  segments: LayoutSegment[];
}

export interface TextLayout {
  lines: LayoutLine[];
  /** 排版总高（px，含段间距） */
  height: number;
}

const DEFAULT_SIZE = 18;
const DEFAULT_FONT = 'Arial, Helvetica, sans-serif';

/** 默认内边距（px）：pptx 缺省 bodyPr 大约为 0.1 英寸 */
const DEFAULT_MARGIN = { left: 9, top: 5, right: 9, bottom: 5 };

let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  measureCtx = canvas.getContext('2d');
  return measureCtx;
}

export function fontString(style: RunStyle = {}): string {
  const weight = style.bold ? 'bold ' : '';
  const slant = style.italic ? 'italic ' : '';
  const size = style.size ?? DEFAULT_SIZE;
  return `${slant}${weight}${size}px ${style.font || DEFAULT_FONT}`;
}

function measure(ctx: CanvasRenderingContext2D, text: string, style: RunStyle): number {
  ctx.font = fontString(style);
  return ctx.measureText(text).width;
}

/** CJK 字符需逐字断行，因此单独成挪ragm */
const CJK = '\\u2E80-\\u9FFF\\u3000-\\u303F\\u3040-\\u30FF\\u3400-\\u4DBF\\uAC00-\\uD7AF';
const TOKEN_RE = new RegExp(`(\\s+)|([${CJK}])|(?:[^\\s${CJK}]+)`, 'g');

interface Atom {
  text: string;
  runIndex: number;
  kind: 'space' | 'char';
  style: RunStyle;
  width: number;
}

/** 单段落拆行：返回行内片段（已合并相邻同 run 的原子） */
function layoutParagraph(
  paragraph: Paragraph,
  available: number,
  ctx: CanvasRenderingContext2D,
  startY: number,
): { lines: LayoutLine[]; height: number } {
  const runs = paragraph.runs.length > 0 ? paragraph.runs : [{ text: '' }];
  const atoms: Atom[] = [];
  runs.forEach((run, runIndex) => {
    const style = run.style ?? {};
    const text = run.text ?? '';
    const matches = text.matchAll(TOKEN_RE);
    for (const match of matches) {
      const [raw, space, cjk] = match;
      atoms.push({
        text: raw,
        runIndex,
        kind: space ? 'space' : 'char',
        style,
        width: 0,
      });
      void cjk;
    }
    if (text === '') atoms.push({ text: '', runIndex, kind: 'char', style, width: 0 });
  });

  for (const atom of atoms) atom.width = measure(ctx, atom.text, atom.style);

  const bullet = paragraph.bullet ? '• ' : '';
  const bulletWidth = bullet ? measure(ctx, bullet, runs[0]?.style ?? {}) : 0;

  const lineHeightof = (line: Atom[]) => {
    let max = 0;
    for (const atom of line) max = Math.max(max, atom.style.size ?? DEFAULT_SIZE);
    return max * (paragraph.lineSpacing ?? 1.2) * 1.15;
  };

  const lines: Atom[][] = [];
  let current: Atom[] = [];
  let currentWidth = 0;

  for (const atom of atoms) {
    const isFirst = current.length === 0;
    if (isFirst && atom.kind === 'space') continue;
    const projected = currentWidth + atom.width;
    if (current.length > 0 && projected > available) {
      // 行尾的空格不下沉到下一行
      while (current.length > 0 && current[current.length - 1].kind === 'space') {
        const dropped = current.pop();
        currentWidth -= dropped?.width ?? 0;
      }
      lines.push(current);
      current = [];
      currentWidth = 0;
      if (atom.kind === 'space') continue;
    }
    current.push(atom);
    currentWidth += atom.width;
  }
  if (current.length > 0 || lines.length === 0) lines.push(current);

  const out: LayoutLine[] = [];
  let y = startY + (paragraph.spaceBefore ?? 0);
  lines.forEach((lineAtoms, lineIndex) => {
    const lineHeight = lineHeightof(lineAtoms);
    const bulletPad = lineIndex === 0 ? bulletWidth : 0;
    const contentWidth = lineAtoms.reduce((sum, atom) => sum + atom.width, 0);
    const totalWidth = contentWidth + bulletPad;
    const padLeft =
      paragraph.align === 'center'
        ? (available - totalWidth) / 2
        : paragraph.align === 'right'
          ? available - totalWidth
          : (paragraph.indent ?? 0);
    let cursor = padLeft + bulletPad;

    const segments: LayoutSegment[] = [];
    let pending: { text: string; runIndex: number; style: RunStyle; start: number } | null = null;
    const flush = (endX: number) => {
      if (!pending) return;
      segments.push({
        text: pending.text,
        style: pending.style,
        x: pending.start,
        y,
        width: Math.max(0, endX - pending.start),
        height: lineHeight,
      });
      pending = null;
    };
    for (const atom of lineAtoms) {
      if (!pending || pending.runIndex !== atom.runIndex) {
        flush(cursor);
        pending = { text: '', runIndex: atom.runIndex, style: atom.style, start: cursor };
      }
      pending.text += atom.text;
      cursor += atom.width;
    }
    flush(cursor);

    if (lineIndex === 0 && bullet) {
      segments.unshift({
        text: bullet,
        style: runs[0]?.style ?? {},
        x: padLeft,
        y,
        width: bulletWidth,
        height: lineHeight,
      });
    }

    out.push({ y, height: lineHeight, segments });
    y += lineHeight;
  });

  return { lines: out, height: y - startY + (paragraph.spaceAfter ?? 0) };
}

function verticalStart(anchor: VAlign | undefined, free: number): number {
  if (anchor === 'middle') return free / 2;
  if (anchor === 'bottom') return free;
  return 0;
}

/** 计算整块文本在盒子内的排版结果 */
export function layoutTextBody(body: TextBody, box: { width: number; height: number }): TextLayout {
  const ctx = getMeasureContext();
  const margins = body.margins ?? DEFAULT_MARGIN;
  const innerWidth = Math.max(4, box.width - margins.left - margins.right);
  const paragraphs = body.paragraphs.length > 0 ? body.paragraphs : [{ runs: [{ text: '' }] }];

  if (!ctx) {
    // 无 canvas 环境（如 SSR / 测试）退化为等距估算，保证不崩
    let y = margins.top;
    const lines: LayoutLine[] = paragraphs.map((paragraph) => {
      const height = (paragraph.runs[0]?.style?.size ?? DEFAULT_SIZE) * 1.2;
      const line: LayoutLine = {
        y,
        height,
        segments: paragraph.runs.map((run) => ({
          text: run.text,
          style: run.style ?? {},
          x: margins.left,
          y,
          width: innerWidth,
          height,
        })),
      };
      y += height;
      return line;
    });
    return { lines, height: y + margins.bottom };
  }

  const measured = paragraphs.map((paragraph) => {
    const result = layoutParagraph(paragraph, innerWidth, ctx, 0);
    return result;
  });
  const totalTextHeight = measured.reduce((sum, item) => sum + item.height, 0);
  const freeHeight = Math.max(0, box.height - margins.top - margins.bottom - totalTextHeight);
  let cursor = margins.top + verticalStart(body.anchor, freeHeight);

  const lines: LayoutLine[] = [];
  measured.forEach((item) => {
    const offset = cursor;
    for (const line of item.lines) {
      lines.push({
        y: line.y + offset,
        height: line.height,
        segments: line.segments.map((segment) => ({
          ...segment,
          x: segment.x + margins.left,
          y: segment.y + offset,
        })),
      });
    }
    cursor += item.height;
  });

  return { lines, height: cursor + margins.bottom };
}

/** 估算文本自然高度（自动增高 / autofit 场景） */
export function measureTextBodyHeight(body: TextBody, width: number, minHeight: number): number {
  const lines = layoutTextBody(body, { width, height: 100000 });
  const natural = lines.lines.reduce((sum, line) => sum + line.height, 0);
  const margins = body.margins ?? DEFAULT_MARGIN;
  return Math.max(minHeight, natural + margins.top + margins.bottom);
}
