import { polygonBounds, selectionContours, simplifyPath, traceSelection } from '../core';
import { createCanvasElement } from '../model/assets';
import { compositeDoc } from './export';
import type { PhotoDoc, Selection, SelectionPart } from '../model/types';

/**
 * Selection extras: boolean ops, morphological edits, magic wand and quick select.
 *
 * Design trade-off (important):
 * - **union / difference go through vectors** (`unionSelection` / `subtractSelection`): append outlines and
 *   flip their direction, so nonzero fill gives an exact result with no loss of precision.
 * - **intersection / morphology / magic wand go through rasters**: quantize to a capped size (`MAX_WORK`),
 *   do pixel math, then extract polygons from per-row left / right bounds. That gives a **column-monotone
 *   outline**: exact for rects / ovals / normal lassos, but notches and holes get filled in (approximate).
 *   This avoids general polygon clipping and contour tracing; it is logged as a future optimization.
 */

/** Boolean op kind */
export type SelectionOp = 'replace' | 'add' | 'subtract' | 'intersect';

/** Morphological edit kind */
export type SelectionModify = 'expand' | 'contract' | 'smooth';

/** Max raster side: bounds the cost on a 4096² canvas */
const MAX_WORK = 1024;

interface Grid {
  width: number;
  height: number;
  /** Scale from document coordinates to raster coordinates */
  scale: number;
}

function makeGrid(doc: { width: number; height: number }): Grid {
  const scale = Math.min(1, MAX_WORK / Math.max(1, Math.max(doc.width, doc.height)));
  return {
    width: Math.max(1, Math.round(doc.width * scale)),
    height: Math.max(1, Math.round(doc.height * scale)),
    scale,
  };
}

/** Selection (may be null) → binary mask */
export function selectionToMask(selection: Selection | null, grid: Grid): Uint8Array {
  const canvas = createCanvasElement(grid.width, grid.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const mask = new Uint8Array(grid.width * grid.height);
  if (!ctx || !selection) return mask;
  ctx.scale(grid.scale, grid.scale);
  ctx.fillStyle = '#ffffff';
  traceSelection(ctx, selection);
  ctx.fill('nonzero');
  const data = ctx.getImageData(0, 0, grid.width, grid.height).data;
  for (let i = 0; i < mask.length; i += 1) {
    if (data[i * 4 + 3] > 127) mask[i] = 1;
  }
  return mask;
}

/**
 * Mask → polygon (document coordinates).
 * Leftmost / rightmost foreground pixels bound each row: walk down the left, up the right, and close.
 */
export function maskToPolygon(mask: Uint8Array, grid: Grid, minDistance = 1.5): number[] | null {
  const left = new Int32Array(grid.height).fill(-1);
  const right = new Int32Array(grid.height).fill(-1);
  for (let y = 0; y < grid.height; y += 1) {
    const rowStart = y * grid.width;
    for (let x = 0; x < grid.width; x += 1) {
      if (mask[rowStart + x]) {
        left[y] = x;
        break;
      }
    }
    for (let x = grid.width - 1; x >= 0; x -= 1) {
      if (mask[rowStart + x]) {
        right[y] = x;
        break;
      }
    }
  }
  const rows: number[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    if (left[y] >= 0) rows.push(y);
  }
  if (rows.length === 0) return null;

  const points: number[] = [];
  for (const y of rows) points.push(left[y] / grid.scale, y / grid.scale);
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const y = rows[i];
    points.push((right[y] + 1) / grid.scale, (y + 1) / grid.scale);
  }
  const simplified = simplifyPath(points, minDistance);
  return simplified.length >= 6 ? simplified : null;
}

/** Polygon → selection (lasso) */
export function selectionFromPolygon(polygon: number[], feather = 0): Selection {
  const simplified = simplifyPath(polygon, 1.5);
  const bounds = polygonBounds(simplified);
  return {
    kind: 'lasso',
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    path: simplified,
    feather,
  };
}

/** Combine by op kind (`replace` swaps outright; the others run a boolean against the current selection) */
export function applySelectionOp(
  base: Selection | null,
  next: Selection,
  op: SelectionOp,
  doc: { width: number; height: number },
): Selection | null {
  switch (op) {
    case 'replace':
      return next;
    case 'add':
      return unionSelection(base, next);
    case 'subtract':
      return subtractSelection(base, next);
    case 'intersect':
      return intersectSelection(base, next, doc);
  }
}

/** Union: append outlines directly (exact under nonzero fill) */
export function unionSelection(base: Selection | null, next: Selection): Selection {
  if (!base) return next;
  const parts: SelectionPart[] = [...(base.parts ?? []), ...selectionContours(next)];
  return { ...base, parts };
}

/** Difference: append the new outlines reversed (under nonzero that carves them out) */
export function subtractSelection(base: Selection | null, next: Selection): Selection | null {
  if (!base) return null;
  const parts: SelectionPart[] = [
    ...(base.parts ?? []),
    ...selectionContours(next).map((contour) => ({ path: contour.path, add: !contour.add })),
  ];
  // Check the bounds to see if it subtracted everything (avoids leaving an empty selection)
  const probe = { ...base, parts };
  const grid = makeGrid({
    width: Math.max(1, base.x + base.width),
    height: Math.max(1, base.y + base.height),
  });
  const mask = selectionToMask(probe, grid);
  return mask.some((value) => value === 1) ? { ...base, parts } : null;
}

/** Intersection: rasterize, AND the pixels, then extract outlines (approximate) */
export function intersectSelection(
  base: Selection | null,
  next: Selection,
  doc: { width: number; height: number },
): Selection | null {
  if (!base) return null;
  const grid = makeGrid(doc);
  const a = selectionToMask(base, grid);
  const b = selectionToMask(next, grid);
  const out = new Uint8Array(a.length);
  for (let i = 0; i < out.length; i += 1) out[i] = a[i] && b[i] ? 1 : 0;
  const polygon = maskToPolygon(out, grid);
  return polygon ? selectionFromPolygon(polygon, next.feather) : null;
}

/**
 * Morphological edits (raster):
 * - expand / contract: dilate / erode with a square structuring element by radius (two separable passes)
 * - smooth: dilate then erode (a closing fills small notches, then eroding removes the fringe)
 */
export function modifySelection(
  selection: Selection,
  mode: SelectionModify,
  amount: number,
  doc: { width: number; height: number },
  fallbackFeather = 0,
): Selection | null {
  const grid = makeGrid(doc);
  const source = selectionToMask(selection, grid);
  const radius = Math.max(1, Math.round((Math.abs(amount) || 1) * grid.scale));

  let mask = source;
  if (mode === 'expand') {
    mask = dilate(dilate(source, grid, radius), grid, radius);
  } else if (mode === 'contract') {
    mask = erode(erode(source, grid, radius), grid, radius);
  } else {
    const expanded = dilate(dilate(source, grid, radius), grid, radius);
    mask = erode(erode(expanded, grid, radius), grid, radius);
  }
  const polygon = maskToPolygon(mask, grid);
  return polygon ? selectionFromPolygon(polygon, fallbackFeather || selection.feather) : null;
}

/** Horizontal dilation */
function dilate(mask: Uint8Array, grid: Grid, radius: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  const sums = new Int32Array(grid.width);
  for (let y = 0; y < grid.height; y += 1) {
    const row = y * grid.width;
    let running = 0;
    for (let x = 0; x < grid.width; x += 1) {
      running += mask[row + x];
      if (x - radius - 1 >= 0) running -= mask[row + x - radius - 1];
      sums[x] = running;
    }
    for (let x = 0; x < grid.width; x += 1) {
      const from = Math.max(0, x - radius);
      const to = Math.min(grid.width - 1, x + radius);
      let total = sums[to];
      if (from - 1 >= 0) total -= sums[from - 1];
      if (total > 0) out[row + x] = 1;
    }
  }
  // Vertical pass
  const result = new Uint8Array(mask.length);
  for (let x = 0; x < grid.width; x += 1) {
    let running = 0;
    const column = new Int32Array(grid.height);
    for (let y = 0; y < grid.height; y += 1) {
      running += out[y * grid.width + x];
      if (y - radius - 1 >= 0) running -= out[(y - radius - 1) * grid.width + x];
      column[y] = running;
    }
    for (let y = 0; y < grid.height; y += 1) {
      const from = Math.max(0, y - radius);
      const to = Math.min(grid.height - 1, y + radius);
      let total = column[to];
      if (from - 1 >= 0) total -= column[from - 1];
      if (total > 0) result[y * grid.width + x] = 1;
    }
  }
  return result;
}

/** Horizontal erosion (= invert, dilate the background, invert back) */
function erode(mask: Uint8Array, grid: Grid, radius: number): Uint8Array {
  const inverted = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) inverted[i] = mask[i] ? 0 : 1;
  const grown = dilate(inverted, grid, radius);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i += 1) out[i] = grown[i] ? 0 : 1;
  return out;
}

export interface WandOptions {
  tolerance: number;
  /** true = connected region only; false = same-colored areas across the whole image */
  contiguous: boolean;
}

/**
 * Magic wand: sample the pixel at (x, y) and select same-colored areas within the tolerance.
 * Sampling happens on the capped-resolution composite (what you see), returning an approximate outline.
 */
export function magicWandSelection(
  doc: PhotoDoc,
  x: number,
  y: number,
  options: WandOptions,
): Selection | null {
  const grid = makeGrid(doc);
  const canvas = compositeDoc(doc, null, grid.scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, grid.width, grid.height).data;

  const sx = Math.min(grid.width - 1, Math.max(0, Math.round(x * grid.scale)));
  const sy = Math.min(grid.height - 1, Math.max(0, Math.round(y * grid.scale)));
  const start = (sy * grid.width + sx) * 4;
  const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
  const tolerance = Math.max(0, Math.min(255, options.tolerance));

  const mask = new Uint8Array(grid.width * grid.height);
  const match = (index: number) => {
    const offset = index * 4;
    return (
      Math.abs(data[offset] - target[0]) <= tolerance &&
      Math.abs(data[offset + 1] - target[1]) <= tolerance &&
      Math.abs(data[offset + 2] - target[2]) <= tolerance &&
      Math.abs(data[offset + 3] - target[3]) <= tolerance
    );
  };

  if (!options.contiguous) {
    for (let i = 0; i < mask.length; i += 1) if (match(i)) mask[i] = 1;
  } else {
    const stack = [sx, sy];
    while (stack.length > 0) {
      const cy = stack.pop() as number;
      const cx = stack.pop() as number;
      if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) continue;
      const index = cy * grid.width + cx;
      if (mask[index] || !match(index)) continue;
      mask[index] = 1;
      stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
    }
  }

  const polygon = maskToPolygon(mask, grid);
  return polygon ? selectionFromPolygon(polygon, 0) : null;
}
