import { needsTextBitmap, warpOffset } from '../core';
import { createCanvasElement } from '../model/assets';
import type { Layer } from '../model/types';
import { drawMeshCells } from './mesh';
import { applyTextStyle, layoutText, textBlockHeight } from './text';

/**
 * 文字变形（变形文字）与「需要位图才能渲染」的情况。
 *
 * 做法：先把文字按**正常排版**画到一张离屏画布，再做**网格重采样**得到变形结果。
 * 网格重采样用「每个单元格一个仿射变换」近似：单元足够密（64×64）时肉眼无法分辨，
 * 代价只有一次性的（结果按签名缓存），因此每次绘制仍然是一次 `drawImage`。
 * 与直接在 Konva.Text 上做逐列位移相比，网格法的好处是支持 `fisheye` 这类二维位移场。
 */

export type TextLayerModel = Extract<Layer, { kind: 'text' }>;

/** 网格密度：64×64 已足够平滑，再密只会线性增加构建成本 */
const MESH = 64;
/** 变形后内容的留白倍数（相对文字块），避免拱起部分被裁掉 */
const MARGIN_X_RATIO = 0.2;
const MARGIN_Y_RATIO = 0.3;

export interface WarpedText {
  canvas: HTMLCanvasElement;
  /** 画布左上角相对文字块左上角的偏移（负值 = 向左上扩） */
  offsetX: number;
  offsetY: number;
}

const cache = new Map<string, WarpedText>();
const CACHE_LIMIT = 24;

/** 缓存签名：任何影响像素的字段都必须进来，否则会出现「改了参数画面不变」 */
function signatureOf(layer: TextLayerModel): string {
  return [
    layer.text,
    layer.fontSize,
    layer.fontFamily,
    layer.fill,
    layer.bold ? 1 : 0,
    layer.italic ? 1 : 0,
    layer.underline ? 1 : 0,
    layer.align,
    layer.lineHeight,
    layer.letterSpacing ?? 0,
    layer.paragraphSpacing ?? 0,
    layer.width,
    layer.rotation,
    layer.flipX ? 1 : 0,
    layer.flipY ? 1 : 0,
    layer.warp.kind,
    layer.warp.bend,
    layer.warp.horizontal,
  ].join('|');
}

/** 清空变形位图缓存（文档切换 / 内存吃紧时可调用） */
export function clearWarpCache(): void {
  cache.clear();
}

/**
 * 生成文字位图：`warp.kind === 'none'` 时就是「正常排版的位图」，
 * 否则在其上做网格重采样。返回的画布带留白，调用方按 `offsetX / offsetY` 落位。
 */
export function warpedText(layer: TextLayerModel): WarpedText | null {
  const key = signatureOf(layer);
  const hit = cache.get(key);
  if (hit) return hit;

  const source = renderSourceBitmap(layer);
  if (!source) return null;
  const needsWarpPass =
    layer.warp.kind !== 'none' && (layer.warp.bend !== 0 || layer.warp.horizontal !== 0);
  const warped = needsWarpPass
    ? warpBitmap(source.canvas, layer, source.marginX, source.marginY)
    : { canvas: source.canvas, offsetX: -source.marginX, offsetY: -source.marginY };
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, warped);
  return warped;
}

/**
 * 正常排版的位图：尺寸 = 文字块 + 留白，内容按文字块左上角定位。
 * `rotation` / 翻转由调用方（节点变换）负责，不进位图，避免重复应用。
 */
function renderSourceBitmap(
  layer: TextLayerModel,
): { canvas: HTMLCanvasElement; marginX: number; marginY: number } | null {
  const probe = createCanvasElement(1, 1);
  const probeCtx = probe.getContext('2d');
  if (!probeCtx) return null;
  applyTextStyle(probeCtx, layer);
  const blockHeight = Math.max(layer.fontSize, textBlockHeight(probeCtx, layer));
  const marginX = Math.ceil(layer.width * MARGIN_X_RATIO);
  const marginY = Math.ceil(blockHeight * MARGIN_Y_RATIO);
  const canvas = createCanvasElement(
    Math.max(1, Math.round(layer.width + marginX * 2)),
    Math.max(1, Math.round(blockHeight + marginY * 2)),
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.save();
  ctx.translate(marginX, marginY);
  // 位图内原点即文字块左上角：align 的对齐基准仍是 layer.width
  drawInto(ctx, layer);
  ctx.restore();
  return { canvas, marginX, marginY };
}

/** 位图内的排版绘制（origin 固定为文字块左上角在画布内的位置） */
function drawInto(ctx: CanvasRenderingContext2D, layer: TextLayerModel): void {
  applyTextStyle(ctx, layer);
  const lineHeight = layer.fontSize * layer.lineHeight;
  const anchorX =
    layer.align === 'center' ? layer.width / 2 : layer.align === 'right' ? layer.width : 0;
  for (const line of layoutText(ctx, layer)) {
    ctx.fillText(line.text, anchorX, line.y);
    if (layer.underline) {
      const width = ctx.measureText(line.text).width;
      const startX =
        layer.align === 'center'
          ? anchorX - width / 2
          : layer.align === 'right'
            ? anchorX - width
            : anchorX;
      ctx.fillRect(startX, line.y + lineHeight - 2, width, Math.max(1, layer.fontSize / 14));
    }
  }
}

/**
 * 网格重采样：把 `source` 按变形位移场重画到新画布。
 *
 * 每个单元格按「源单元 → 目标平行四边形」求仿射矩阵；位移取单元格四角的位移场值，
 * 因此单元内是线性近似（这正是网格变形的标准做法）。
 */
function warpBitmap(
  source: HTMLCanvasElement,
  layer: TextLayerModel,
  marginX: number,
  marginY: number,
): WarpedText {
  const out = createCanvasElement(source.width, source.height);
  const ctx = out.getContext('2d');
  const { kind, bend, horizontal } = layer.warp;
  if (!ctx) return { canvas: source, offsetX: -marginX, offsetY: -marginY };
  // 位移场以「文字块」为归一化基准（不含留白），故把画布坐标换算回块内坐标
  const width = Math.max(1, layer.width);
  const height = Math.max(1, source.height - marginY * 2);
  const cellW = layer.width / MESH;
  const cellH = height / MESH;
  const disp = (x: number, y: number) => {
    const { dx, dy } = warpOffset(
      kind,
      (x - marginX) / width,
      (y - marginY) / height,
      bend,
      horizontal,
    );
    return { x: x + dx * width, y: y + dy * height };
  };
  // 细网格节点位置：源单元 (col, row) 的四角 + 各自位移
  const nodes: { x: number; y: number }[] = [];
  for (let row = 0; row <= MESH; row += 1) {
    for (let col = 0; col <= MESH; col += 1) {
      nodes.push(disp(marginX + col * cellW, marginY + row * cellH));
    }
  }
  drawMeshCells(
    ctx,
    source,
    { x: 0, y: 0, width: source.width, height: source.height },
    {
      cols: MESH,
      rows: MESH,
      nodes,
    },
  );
  return { canvas: out, offsetX: -marginX, offsetY: -marginY };
}

/**
 * 文字位图（含留白）。`needsTextBitmap` 为 false 时返回 null —— 调用方应走原生文字路径，
 * 以保留可选中、可清晰缩放的优点。
 */
export function textBitmap(layer: TextLayerModel): WarpedText | null {
  if (!needsTextBitmap(layer)) return null;
  return warpedText(layer);
}
