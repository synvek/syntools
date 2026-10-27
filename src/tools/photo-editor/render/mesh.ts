import { meshControlPoints, meshIsIdentity } from '../core';
import type { LayerBox } from '../core';
import { createCanvasElement } from '../model/assets';
import type { MeshWarp } from '../model/types';

/**
 * Mesh warp rendering: redraw a bitmap according to a target grid.
 *
 * The core is **per-cell affine**: each fine cell draws with its own affine matrix, and once cells are dense
 * enough they're invisible, yet perspective / distort / warp (**non-affine**) come through (`drawImage` is affine).
 * Text warp and layer mesh warp share this implementation, avoiding two interpolators with different looks.
 */

export type Point = { x: number; y: number };

export interface MeshNodes {
  /** Cells across (the node count is cols + 1) */
  cols: number;
  rows: number;
  /** Row-major target positions, length = (cols + 1) * (rows + 1) */
  nodes: Point[];
}

/** Extra pixels per cell: hides hairline seams between neighbors (float rounding leaves 1px gaps) */
const CELL_BLEED = 1;
/** Padding around the warped bitmap, as a fraction of the layer size */
const MESH_PAD_RATIO = 0.3;

/**
 * Draw `source` cell by cell onto the target grid.
 *
 * `sourceRect` is the region of `source` being mapped, and `nodes` are the target positions after
 * subdivision: node (r, c) corresponds to `(c/cols, r/rows)` inside the source rect.
 */
export function drawMeshCells(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceRect: { x: number; y: number; width: number; height: number },
  meshNodes: MeshNodes,
  bleed = CELL_BLEED,
): void {
  const { cols, rows, nodes } = meshNodes;
  const cellW = sourceRect.width / cols;
  const cellH = sourceRect.height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const p00 = nodes[row * (cols + 1) + col];
      const p10 = nodes[row * (cols + 1) + col + 1];
      const p01 = nodes[(row + 1) * (cols + 1) + col];
      if (!p00 || !p10 || !p01) continue;
      const sx = sourceRect.x + col * cellW;
      const sy = sourceRect.y + row * cellH;
      // Affine: map the source cell onto the parallelogram defined by p00 / p10 / p01
      const a = (p10.x - p00.x) / cellW;
      const b = (p10.y - p00.y) / cellW;
      const c = (p01.x - p00.x) / cellH;
      const d = (p01.y - p00.y) / cellH;
      ctx.save();
      ctx.setTransform(a, b, c, d, p00.x, p00.y);
      ctx.drawImage(
        source,
        sx - bleed,
        sy - bleed,
        cellW + bleed * 2,
        cellH + bleed * 2,
        -bleed,
        -bleed,
        cellW + bleed * 2,
        cellH + bleed * 2,
      );
      ctx.restore();
    }
  }
}

/** Bilinear lookup (u, v normalized across the whole grid) */
function sampleGrid(values: Point[], cols: number, rows: number, u: number, v: number): Point {
  const gx = u * (cols - 1);
  const gy = v * (rows - 1);
  const c0 = Math.min(cols - 2, Math.max(0, Math.floor(gx)));
  const r0 = Math.min(rows - 2, Math.max(0, Math.floor(gy)));
  const tx = gx - c0;
  const ty = gy - r0;
  const p = (c: number, r: number) => values[r * cols + c] ?? { x: 0, y: 0 };
  const top = {
    x: p(c0, r0).x + (p(c0 + 1, r0).x - p(c0, r0).x) * tx,
    y: p(c0, r0).y + (p(c0 + 1, r0).y - p(c0, r0).y) * tx,
  };
  const bottom = {
    x: p(c0, r0 + 1).x + (p(c0 + 1, r0 + 1).x - p(c0, r0 + 1).x) * tx,
    y: p(c0, r0 + 1).y + (p(c0 + 1, r0 + 1).y - p(c0, r0 + 1).y) * tx,
  };
  return { x: top.x + (bottom.x - top.x) * ty, y: top.y + (bottom.y - top.y) * ty };
}

/**
 * Compute the fine grid's target positions from the control grid (bilinear interpolation).
 *
 * `subdivisions` is how finely each control cell is split: 2×2 (perspective / distort / skew) needs more,
 * since a single bilinear cell approximates perspective worst; 4×4 (warp) is dense enough with fewer.
 */
export function meshFineNodes(
  mesh: MeshWarp,
  box: LayerBox,
  subdivisions: number,
  rotated = false,
): MeshNodes {
  const controls = meshControlPoints(mesh, box, rotated);
  const values: Point[] = controls.map((point) => ({ x: point.x, y: point.y }));
  const fineCols = (mesh.cols - 1) * subdivisions;
  const fineRows = (mesh.rows - 1) * subdivisions;
  const nodes: Point[] = [];
  for (let row = 0; row <= fineRows; row += 1) {
    for (let col = 0; col <= fineCols; col += 1) {
      nodes.push(sampleGrid(values, mesh.cols, mesh.rows, col / fineCols, row / fineRows));
    }
  }
  return { cols: fineCols, rows: fineRows, nodes };
}

/** Subdivision counts per mesh size, aiming to keep fine cells under about 20px per side */
function subdivisionsFor(mesh: MeshWarp, box: LayerBox): number {
  const target = 20;
  const spanCols = Math.max(1, mesh.cols - 1);
  const spanRows = Math.max(1, mesh.rows - 1);
  const perCol = Math.ceil(Math.max(box.width, box.height) / target / Math.max(spanCols, spanRows));
  return Math.min(24, Math.max(4, perCol));
}

const cache = new Map<string, { canvas: HTMLCanvasElement; offsetX: number; offsetY: number }>();
const CACHE_LIMIT = 16;

/** Placement of the warped bitmap in document coords (layer origin - padding), shared by node updates */
export function meshBitmapOrigin(layer: { x: number; y: number; width: number; height: number }): {
  x: number;
  y: number;
} {
  const padX = Math.ceil(Math.max(1, layer.width) * MESH_PAD_RATIO);
  const padY = Math.ceil(Math.max(1, layer.height) * MESH_PAD_RATIO);
  return { x: layer.x - padX, y: layer.y - padY };
}

export interface MeshBitmap {
  canvas: HTMLCanvasElement;
  /** Offset of the canvas from the layer origin (negative = extends up-left) */
  offsetX: number;
  offsetY: number;
}

/**
 * The layer bitmap after mesh warping (cached by signature).
 *
 * Same trade-off as text warp: bake the non-affine mapping into a bitmap so each draw is one `drawImage`,
 * at the cost of vector crispness while warped. The `render` callback draws the **undeformed** layer
 * into the given context, and callers must keep that callback out of the mesh branch (or it recurses).
 */
export function meshLayerBitmap(
  layer: { mesh?: MeshWarp | null; x: number; y: number; width: number; height: number },
  signature: string,
  render: (ctx: CanvasRenderingContext2D, box: LayerBox) => void,
): MeshBitmap | null {
  const mesh = layer.mesh;
  if (meshIsIdentity(mesh)) return null;
  const grid = mesh as MeshWarp;
  const cached = cache.get(signature);
  if (cached) return cached;

  const box: LayerBox = {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: 0,
  };
  // Warping can throw content outside the box: leave 30% padding on each side so it isn't clipped
  const padX = Math.ceil(Math.max(1, layer.width) * MESH_PAD_RATIO);
  const padY = Math.ceil(Math.max(1, layer.height) * MESH_PAD_RATIO);
  const width = Math.max(1, Math.round(layer.width + padX * 2));
  const height = Math.max(1, Math.round(layer.height + padY * 2));
  // Inside the canvas, translate document space so the box's top-left sits at (padX, padY)
  const shiftX = padX - layer.x;
  const shiftY = padY - layer.y;

  const source = createCanvasElement(width, height);
  const sourceCtx = source.getContext('2d');
  if (!sourceCtx) return null;
  sourceCtx.save();
  sourceCtx.translate(shiftX, shiftY);
  render(sourceCtx, box);
  sourceCtx.restore();

  const out = createCanvasElement(width, height);
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.save();
  ctx.translate(shiftX, shiftY);
  const nodes = meshFineNodes(grid, box, subdivisionsFor(grid, box), false);
  drawMeshCells(
    ctx,
    source,
    { x: 0, y: 0, width, height },
    {
      cols: nodes.cols,
      rows: nodes.rows,
      nodes: nodes.nodes.map((point) => ({ x: point.x, y: point.y })),
    },
  );
  ctx.restore();

  const bitmap: MeshBitmap = { canvas: out, offsetX: layer.x - padX, offsetY: layer.y - padY };
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(signature, bitmap);
  return bitmap;
}

/** Clear the mesh bitmap cache (on document switch / memory pressure) */
export function clearMeshCache(): void {
  cache.clear();
}
