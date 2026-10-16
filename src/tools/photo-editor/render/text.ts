import { createCanvasElement } from '../model/assets';
import type { Layer } from '../model/types';

/**
 * 文字排版与绘制（Canvas2D 单一实现）。
 *
 * 为什么要有这一层：文字在两个地方渲染 —— 预览走 Konva（`render/nodes.ts`），
 * 导出 / 拼合走 Canvas2D（`render/paint.ts`）。变形与段间距这两项 Konva.Text 表达不了，
 * 需要落到「先画成位图再重采样」，若各写一份必然漂移。
 * 因此把**排布 + 绘制**收敛到本模块，位图路径（`render/warp.ts`）与导出路径共用同一份代码。
 */

export type TextLayerModel = Extract<Layer, { kind: 'text' }>;

/** Canvas2D font 简写（含粗 / 斜） */
export function textFont(layer: TextLayerModel): string {
  return [
    layer.italic ? 'italic' : 'normal',
    layer.bold ? 'bold' : 'normal',
    `${layer.fontSize}px`,
    `${layer.fontFamily}, sans-serif`,
  ].join(' ');
}

/** CJK 标点 / 假名 / 汉字 / 全角区间：这些字符逐字断行（用转义区间，避免源码出现全角空白） */
const CJK_PATTERN = new RegExp(
  '[\\u2E80-\\u9FFF\\uF900-\\uFAFF\\uFF00-\\uFFEF\\u3000-\\u303F\\u3040-\\u30FF]',
);

/**
 * 断行标记化：拉丁按词、CJK 逐字、空格单独成标记。
 *
 * 之所以先标记化再贪心填行（而不是边扫边决定），是因为「空格处能否断行」必须看到**后面的词**才能判断：
 * 早期实现边扫边断，遇到
 * `aa bb cc` 这类文本会把断行点的那个单词整段丢掉（`bb` 直接消失）。
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

/** 文本换行：CJK 逐字断行，拉丁按空格断词；行尾空白裁掉（避免测量与下划线带出多余宽度） */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let current = '';
    for (const token of tokenize(paragraph)) {
      const candidate = current + token;
      if (current.length > 0 && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current.replace(/\s+$/, ''));
        // 断行处的空格不带到下一行行首
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
  /** 相对文字块顶部的纵向偏移 */
  y: number;
}

/** 设置字体相关状态（字距在不支持的浏览器上静默忽略） */
export function applyTextStyle(ctx: CanvasRenderingContext2D, layer: TextLayerModel): void {
  ctx.font = textFont(layer);
  ctx.fillStyle = layer.fill;
  ctx.textBaseline = 'top';
  ctx.textAlign = layer.align === 'center' ? 'center' : layer.align === 'right' ? 'right' : 'left';
  // `letterSpacing` 是较新的 Canvas2D 能力（Chrome 99+ / Safari 17+）：不支持时退化为 0 字距
  const spacingCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ((layer.letterSpacing ?? 0) !== 0) spacingCtx.letterSpacing = `${layer.letterSpacing}px`;
  else if (spacingCtx.letterSpacing) spacingCtx.letterSpacing = '0px';
}

/** 排版：按段换行并累加纵向位置（段间距只加在段与段之间） */
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

/** 文字块高度（含段间距；空文本按一行计） */
export function textBlockHeight(ctx: CanvasRenderingContext2D, layer: TextLayerModel): number {
  const lines = layoutText(ctx, layer);
  const lineHeight = layer.fontSize * layer.lineHeight;
  if (lines.length === 0) return lineHeight;
  const last = lines[lines.length - 1];
  return last.y + lineHeight;
}

/**
 * 把文字画到 `ctx` 上。
 *
 * `origin` 默认取图层的文档坐标；位图路径传 `{ x: 0, y: 0 }`，把内容画到离屏画布的原点。
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
 * 借一张一次性画布取得「可测量」的 2D 上下文。
 *
 * 换行与字宽必须依赖 `ctx.measureText`，因此排版类查询都需要一个上下文；
 * 画布仅用于测量，尺寸 1×1 即可（`measureText` 与画布尺寸无关）。
 */
export function withMeasureContext<T>(fn: (ctx: CanvasRenderingContext2D) => T): T | null {
  const canvas = createCanvasElement(1, 1);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return fn(ctx);
}

/** 文字块尺寸（文档坐标下的宽 × 排版高度）；测量不可用时返回 null */
export function measureTextBlock(layer: TextLayerModel): { width: number; height: number } | null {
  return withMeasureContext((ctx) => {
    applyTextStyle(ctx, layer);
    return { width: layer.width, height: textBlockHeight(ctx, layer) };
  });
}
