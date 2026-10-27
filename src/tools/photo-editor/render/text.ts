import { createCanvasElement } from '../model/assets';
import type { Layer } from '../model/types';

/**
 * Text layout and drawing (the single Canvas2D implementation).
 *
 * Why this layer exists: text renders in two places — the preview goes through Konva (`render/nodes.ts`)
 * and export / flatten through Canvas2D (`render/paint.ts`). Warp and paragraph spacing are beyond Konva.Text,
 * requiring "draw to a bitmap, then resample", and two copies would inevitably drift.
 * So **layout + drawing** live here, shared by the bitmap path (`render/warp.ts`) and the export path.
 */

export type TextLayerModel = Extract<Layer, { kind: 'text' }>;

/** Canvas2D font shorthand (including bold / italic) */
export function textFont(layer: TextLayerModel): string {
  return [
    layer.italic ? 'italic' : 'normal',
    layer.bold ? 'bold' : 'normal',
    `${layer.fontSize}px`,
    `${layer.fontFamily}, sans-serif`,
  ].join(' ');
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

/** Text block height (paragraph spacing included; empty text counts as one line) */
export function textBlockHeight(ctx: CanvasRenderingContext2D, layer: TextLayerModel): number {
  const lines = layoutText(ctx, layer);
  const lineHeight = layer.fontSize * layer.lineHeight;
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
    return { width: layer.width, height: textBlockHeight(ctx, layer) };
  });
}
