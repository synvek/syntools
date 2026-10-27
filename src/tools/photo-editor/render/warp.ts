import { needsTextBitmap, warpOffset } from '../core';
import { createCanvasElement } from '../model/assets';
import type { Layer } from '../model/types';
import { drawMeshCells } from './mesh';
import { drawText, measureTextBlock } from './text';

/**
 * Text warp, and the cases that need a bitmap to render at all.
 *
 * Approach: draw the text with **normal layout** to an offscreen canvas, then **resample the mesh**.
 * Mesh resampling approximates with one affine transform per cell: at 64×64 the eye can't tell,
 * and the cost is one-time (results cache by signature), so each draw is still a single `drawImage`.
 * Unlike shifting columns on Konva.Text, a mesh supports 2D fields like `fisheye`.
 */

export type TextLayerModel = Extract<Layer, { kind: 'text' }>;

/** Mesh density: 64×64 is smooth enough; denser only adds build cost linearly */
const MESH = 64;
/** Padding factor around warped content (relative to the text block), so bulges aren't clipped */
const MARGIN_X_RATIO = 0.2;
const MARGIN_Y_RATIO = 0.3;

export interface WarpedText {
  canvas: HTMLCanvasElement;
  /** Canvas top-left relative to the text block's (negative = extends up-left) */
  offsetX: number;
  offsetY: number;
}

const cache = new Map<string, WarpedText>();
const CACHE_LIMIT = 24;

/** Cache signature: every pixel-affecting field must be in it, or "changed a parameter, image unchanged" */
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
    layer.direction ?? 'horizontal',
    // Rich text runs change pixels without changing the plain text, so they must enter the cache key
    JSON.stringify(layer.runs ?? null),
    layer.rotation,
    layer.flipX ? 1 : 0,
    layer.flipY ? 1 : 0,
    layer.warp.kind,
    layer.warp.bend,
    layer.warp.horizontal,
  ].join('|');
}

/** Clear the warp bitmap cache (on document switch / memory pressure) */
export function clearWarpCache(): void {
  cache.clear();
}

/**
 * Produce the text bitmap: with `warp.kind === 'none'` it is just the normally laid out text,
 * otherwise mesh-resampled. The canvas includes padding; place it by `offsetX / offsetY`.
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
 * The normally laid out bitmap: size = text block + padding, content anchored at the block's top-left.
 * `rotation` / flips belong to the caller (node transform) and stay out of the bitmap, avoiding doubling.
 */
function renderSourceBitmap(
  layer: TextLayerModel,
): { canvas: HTMLCanvasElement; marginX: number; marginY: number } | null {
  const measured = measureTextBlock(layer);
  // Vertical text can be wider than `layer.width` (the columns decide the width), so measure the block
  const blockWidth = Math.max(1, measured?.width ?? layer.width);
  const blockHeight = Math.max(
    layer.fontSize,
    measured?.height ?? layer.fontSize * layer.lineHeight,
  );
  const marginX = Math.ceil(blockWidth * MARGIN_X_RATIO);
  const marginY = Math.ceil(blockHeight * MARGIN_Y_RATIO);
  const canvas = createCanvasElement(
    Math.max(1, Math.round(blockWidth + marginX * 2)),
    Math.max(1, Math.round(blockHeight + marginY * 2)),
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.save();
  ctx.translate(marginX, marginY);
  // The bitmap origin is the block's top-left; `drawText` shares layout with the export path
  drawText(ctx, layer, { x: 0, y: 0 });
  ctx.restore();
  return { canvas, marginX, marginY };
}

/**
 * Mesh resampling: redraw `source` onto a new canvas through the warp displacement field.
 *
 * Each cell gets an affine matrix from "source cell → target parallelogram", using the field at its corners,
 * so the inside is a linear approximation (the standard way to do a mesh warp).
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
  // The field normalizes against the text block (not the padding), so convert canvas coords back inside
  // (width comes from the bitmap, so vertical columns wider than `layer.width` still warp correctly)
  const width = Math.max(1, source.width - marginX * 2);
  const height = Math.max(1, source.height - marginY * 2);
  const cellW = width / MESH;
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
  // Fine grid node positions: the corners of source cell (col, row) plus their displacements
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
 * Text bitmap (with padding). Returns null when `needsTextBitmap` is false — the caller should use
 * native text instead, keeping it selectable and crisp at any zoom.
 */
export function textBitmap(layer: TextLayerModel): WarpedText | null {
  if (!needsTextBitmap(layer)) return null;
  return warpedText(layer);
}
