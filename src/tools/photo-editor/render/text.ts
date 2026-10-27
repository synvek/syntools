import { createCanvasElement } from '../model/assets';
import {
  effectiveRuns,
  hasRichText,
  resolveRunStyle,
  type ResolvedRunStyle,
} from '../model/textRuns';
import type { Layer } from '../model/types';

/**
 * Text layout and drawing (the single Canvas2D implementation).
 *
 * Why this layer exists: text renders in two places — the preview goes through Konva (`render/nodes.ts`)
 * and export / flatten through Canvas2D (`render/paint.ts`). Warp and paragraph spacing are beyond Konva.Text,
 * requiring "draw to a bitmap, then resample", and two copies would inevitably drift.
 * So **layout + drawing** live here, shared by the bitmap path (`render/warp.ts`) and the export path.
 *
 * Multi-line and rich text:
 * - plain text keeps the original fast path (`wrapText` / `layoutText`) so Konva can render it natively;
 * - rich text (per-run styles) and vertical text use the segment-based / column-based renderers below,
 *   reached through the bitmap path (`needsTextBitmap`) so preview and export stay identical.
 */

export type TextLayerModel = Extract<Layer, { kind: 'text' }>;

/** Canvas2D font shorthand for one resolved run style */
function fontOf(layer: TextLayerModel, style: ResolvedRunStyle): string {
  return [
    style.italic ? 'italic' : 'normal',
    style.bold ? 'bold' : 'normal',
    `${style.fontSize}px`,
    `${layer.fontFamily}, sans-serif`,
  ].join(' ');
}

/** Canvas2D font shorthand (including bold / italic) for the layer-level style */
export function textFont(layer: TextLayerModel): string {
  return fontOf(layer, resolveRunStyle(layer));
}

/** CJK punctuation / kana / ideograph / full-width ranges: they break per character (escaped, no raw glyphs) */
const CJK_PATTERN = new RegExp(
  '[\\u2E80-\\u9FFF\\uF900-\\uFAFF\\uFF00-\\uFFEF\\u3000-\\u303F\\u3040-\\u30FF]',
);

/**
 * Wrapping tokenizer: Latin by word, CJK per character, spaces as their own tokens.
 *
 * Tokenize first, then fill lines greedily, because "can we break at this space" needs the **next word**:
 * an early implementation decided while scanning and, on text like
 * `aa bb cc`, dropped the whole word at the break (the `bb` simply vanished).
 */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let word = '';
  for (const char of line) {
    if (CJK_PATTERN.test(char) || char === ' ') {
      if (word) {
        tokens.push(word);
        word = '';
      }
      tokens.push(char);
      continue;
    }
    word += char;
  }
  if (word) tokens.push(word);
  return tokens;
}

/** Line breaking: CJK per character, Latin at spaces; trailing space is trimmed (it skews measurement) */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (const token of tokenize(paragraph)) {
      const candidate = current + token;
      if (current.length > 0 && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current.replace(/\s+$/, ''));
        // A break at a space must not carry that space to the start of the next line
        current = token === ' ' ? '' : token;
      } else {
        current = candidate;
      }
    }
    lines.push(current.replace(/\s+$/, ''));
  }
  return lines;
}

export interface PositionedLine {
  text: string;
  /** Vertical offset relative to the top of the text block */
  y: number;
}

/** Set font-related state (letter spacing is silently ignored where unsupported) */
export function applyTextStyle(ctx: CanvasRenderingContext2D, layer: TextLayerModel): void {
  ctx.font = textFont(layer);
  ctx.fillStyle = layer.fill;
  ctx.textBaseline = 'top';
  ctx.textAlign = layer.align === 'center' ? 'center' : layer.align === 'right' ? 'right' : 'left';
  // `letterSpacing` is a newer Canvas2D feature (Chrome 99+ / Safari 17+); without it, tracking falls to 0
  const spacingCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ((layer.letterSpacing ?? 0) !== 0) spacingCtx.letterSpacing = `${layer.letterSpacing}px`;
  else if (spacingCtx.letterSpacing) spacingCtx.letterSpacing = '0px';
}

/** Layout: wrap per paragraph and accumulate y (paragraph spacing only goes between paragraphs) */
export function layoutText(ctx: CanvasRenderingContext2D, layer: TextLayerModel): PositionedLine[] {
  const lineHeight = layer.fontSize * layer.lineHeight;
  const paragraphs = layer.text.split('\n');
  const out: PositionedLine[] = [];
  let y = 0;
  paragraphs.forEach((paragraph, index) => {
    for (const line of wrapText(ctx, paragraph, layer.width)) {
      out.push({ text: line, y });
      y += lineHeight;
    }
    if (index < paragraphs.length - 1) y += layer.paragraphSpacing ?? 0;
  });
  return out;
}

/* ------------------------------ Rich text (per-run styles) ------------------------------ */

interface StyledChar {
  ch: string;
  style: ResolvedRunStyle;
}

interface RichSegment {
  text: string;
  style: ResolvedRunStyle;
}

interface RichLine {
  segments: RichSegment[];
  /** Measured line width (for center / right alignment) */
  width: number;
  y: number;
}

function styleEquals(a: ResolvedRunStyle, b: ResolvedRunStyle): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.fill === b.fill &&
    a.fontSize === b.fontSize
  );
}

function setFont(
  ctx: CanvasRenderingContext2D,
  layer: TextLayerModel,
  style: ResolvedRunStyle,
): void {
  ctx.font = fontOf(layer, style);
}

/** The whole text as resolved styled characters (paragraphs are split later on '\n') */
function styledChars(layer: TextLayerModel): StyledChar[] {
  const out: StyledChar[] = [];
  for (const run of effectiveRuns(layer)) {
    const style = resolveRunStyle(layer, run.style);
    for (const ch of Array.from(run.text)) out.push({ ch, style });
  }
  return out;
}

/** Split styled characters on '\n', preserving an empty paragraph for empty text */
function styledParagraphs(chars: StyledChar[]): StyledChar[][] {
  const paragraphs: StyledChar[][] = [[]];
  for (const char of chars) {
    if (char.ch === '\n') paragraphs.push([]);
    else paragraphs[paragraphs.length - 1].push(char);
  }
  return paragraphs;
}

function measureChars(
  ctx: CanvasRenderingContext2D,
  layer: TextLayerModel,
  chars: StyledChar[],
): number {
  let width = 0;
  for (const char of chars) {
    setFont(ctx, layer, char.style);
    width += ctx.measureText(char.ch).width;
  }
  return width;
}

/** Tokenize styled chars (Latin words stay whole, CJK / spaces are single tokens) */
function tokenizeStyled(chars: StyledChar[]): StyledChar[][] {
  const tokens: StyledChar[][] = [];
  let word: StyledChar[] = [];
  for (const char of chars) {
    if (CJK_PATTERN.test(char.ch) || char.ch === ' ') {
      if (word.length > 0) {
        tokens.push(word);
        word = [];
      }
      tokens.push([char]);
      continue;
    }
    word.push(char);
  }
  if (word.length > 0) tokens.push(word);
  return tokens;
}

function buildRichLine(
  ctx: CanvasRenderingContext2D,
  layer: TextLayerModel,
  chars: StyledChar[],
  y: number,
): RichLine {
  let end = chars.length;
  while (end > 0 && chars[end - 1].ch === ' ') end -= 1;
  const segments: RichSegment[] = [];
  for (const char of chars.slice(0, end)) {
    const last = segments[segments.length - 1];
    if (last && styleEquals(last.style, char.style)) last.text += char.ch;
    else segments.push({ text: char.ch, style: char.style });
  }
  let width = 0;
  for (const segment of segments) {
    setFont(ctx, layer, segment.style);
    width += ctx.measureText(segment.text).width;
  }
  return { segments, width, y };
}

/** Rich horizontal layout: greedy wrap by token, then merge same-style neighbors into segments */
function layoutRichHorizontal(ctx: CanvasRenderingContext2D, layer: TextLayerModel): RichLine[] {
  applyTextStyle(ctx, layer);
  const lineHeight = layer.fontSize * layer.lineHeight;
  const lines: RichLine[] = [];
  let y = 0;
  const paragraphs = styledParagraphs(styledChars(layer));
  paragraphs.forEach((paragraph, index) => {
    let current: StyledChar[] = [];
    let currentWidth = 0;
    const flush = () => {
      lines.push(buildRichLine(ctx, layer, current, y));
      y += lineHeight;
      current = [];
      currentWidth = 0;
    };
    for (const token of tokenizeStyled(paragraph)) {
      const tokenWidth = measureChars(ctx, layer, token);
      if (current.length > 0 && currentWidth + tokenWidth > layer.width) flush();
      current.push(...token);
      currentWidth += tokenWidth;
    }
    flush();
    if (index < paragraphs.length - 1) y += layer.paragraphSpacing ?? 0;
  });
  return lines;
}

function drawRichHorizontal(
  ctx: CanvasRenderingContext2D,
  layer: TextLayerModel,
  origin: { x: number; y: number },
): void {
  const lines = layoutRichHorizontal(ctx, layer);
  const lineHeight = layer.fontSize * layer.lineHeight;
  // Manual placement uses left alignment; the anchor below already accounts for center / right
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const line of lines) {
    const anchorX =
      layer.align === 'center'
        ? origin.x + layer.width / 2 - line.width / 2
        : layer.align === 'right'
          ? origin.x + layer.width - line.width
          : origin.x;
    let x = anchorX;
    for (const segment of line.segments) {
      setFont(ctx, layer, segment.style);
      ctx.fillStyle = segment.style.fill;
      ctx.fillText(segment.text, x, origin.y + line.y);
      const width = ctx.measureText(segment.text).width;
      if (segment.style.underline) {
        ctx.fillRect(
          x,
          origin.y + line.y + lineHeight - 2,
          width,
          Math.max(1, segment.style.fontSize / 14),
        );
      }
      x += width;
    }
  }
}

/* ------------------------------ Vertical text ------------------------------ */

/**
 * Vertical columns: characters stack top-to-bottom inside `layer.height` (the user-resizable box),
 * then flow into new columns right-to-left. Resizing the box height re-wraps, like a real vertical text box.
 */
function verticalColumns(layer: TextLayerModel): { columns: StyledChar[][]; pitch: number } {
  const pitch = Math.max(1, layer.fontSize * layer.lineHeight);
  // The box height limits characters per column; a box shorter than one line still fits one character
  const maxRows = Math.max(1, Math.floor((layer.height || pitch) / pitch));
  const columns: StyledChar[][] = [];
  for (const paragraph of styledParagraphs(styledChars(layer))) {
    if (paragraph.length === 0) {
      columns.push([]);
      continue;
    }
    for (let index = 0; index < paragraph.length; index += maxRows) {
      columns.push(paragraph.slice(index, index + maxRows));
    }
  }
  return { columns, pitch };
}

function verticalMetrics(layer: TextLayerModel): { width: number; height: number; pitch: number } {
  const { columns, pitch } = verticalColumns(layer);
  let maxChars = 0;
  for (const column of columns) maxChars = Math.max(maxChars, column.length);
  return {
    width: Math.max(1, columns.length) * pitch,
    height: Math.max(1, maxChars) * pitch,
    pitch,
  };
}

function drawVerticalText(
  ctx: CanvasRenderingContext2D,
  layer: TextLayerModel,
  origin: { x: number; y: number },
): void {
  applyTextStyle(ctx, layer);
  const { columns, pitch } = verticalColumns(layer);
  const width = Math.max(1, columns.length) * pitch;
  columns.forEach((column, columnIndex) => {
    // Right-to-left columns: the first column is the rightmost
    const columnX = width - (columnIndex + 1) * pitch;
    column.forEach((char, rowIndex) => {
      const cx = origin.x + columnX + pitch / 2;
      const cy = origin.y + rowIndex * pitch + pitch / 2;
      ctx.save();
      ctx.translate(cx, cy);
      setFont(ctx, layer, char.style);
      ctx.fillStyle = char.style.fill;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // CJK / full-width glyphs sit upright; Latin glyphs rotate 90° clockwise (as in Photoshop)
      if (!CJK_PATTERN.test(char.ch)) ctx.rotate(Math.PI / 2);
      ctx.fillText(char.ch, 0, 0);
      ctx.restore();
    });
  });
}

/* ------------------------------ Public dispatch ------------------------------ */

/** Text block height (paragraph spacing included; empty text counts as one line) */
export function textBlockHeight(ctx: CanvasRenderingContext2D, layer: TextLayerModel): number {
  if (layer.direction === 'vertical') return verticalMetrics(layer).height;
  const lineHeight = layer.fontSize * layer.lineHeight;
  if (hasRichText(layer)) {
    const lines = layoutRichHorizontal(ctx, layer);
    if (lines.length === 0) return lineHeight;
    return lines[lines.length - 1].y + lineHeight;
  }
  const lines = layoutText(ctx, layer);
  if (lines.length === 0) return lineHeight;
  const last = lines[lines.length - 1];
  return last.y + lineHeight;
}

/**
 * Draw the text onto `ctx`.
 *
 * `origin` defaults to the layer's document position; the bitmap path passes `{ x: 0, y: 0 }` (offscreen).
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  layer: TextLayerModel,
  origin: { x: number; y: number } = { x: layer.x, y: layer.y },
): void {
  if (layer.direction === 'vertical') {
    drawVerticalText(ctx, layer, origin);
    return;
  }
  if (hasRichText(layer)) {
    drawRichHorizontal(ctx, layer, origin);
    return;
  }
  applyTextStyle(ctx, layer);
  const anchorX =
    layer.align === 'center'
      ? origin.x + layer.width / 2
      : layer.align === 'right'
        ? origin.x + layer.width
        : origin.x;
  const lineHeight = layer.fontSize * layer.lineHeight;
  for (const line of layoutText(ctx, layer)) {
    const top = origin.y + line.y;
    ctx.fillText(line.text, anchorX, top);
    if (layer.underline) {
      const width = ctx.measureText(line.text).width;
      const startX =
        layer.align === 'center'
          ? anchorX - width / 2
          : layer.align === 'right'
            ? anchorX - width
            : anchorX;
      ctx.fillRect(startX, top + lineHeight - 2, width, Math.max(1, layer.fontSize / 14));
    }
  }
}

/**
 * Borrow a throwaway canvas to get a measurable 2D context.
 *
 * Wrapping and widths need `ctx.measureText`, so layout queries require a context;
 * the canvas is only for measuring, and 1×1 is enough (`measureText` doesn't care about size).
 */
export function withMeasureContext<T>(fn: (ctx: CanvasRenderingContext2D) => T): T | null {
  const canvas = createCanvasElement(1, 1);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return fn(ctx);
}

/** Text block size (width × layout height in document units); null when measurement isn't available */
export function measureTextBlock(layer: TextLayerModel): { width: number; height: number } | null {
  return withMeasureContext((ctx) => {
    applyTextStyle(ctx, layer);
    if (layer.direction === 'vertical') {
      const metrics = verticalMetrics(layer);
      return { width: metrics.width, height: metrics.height };
    }
    return { width: layer.width, height: textBlockHeight(ctx, layer) };
  });
}
