import type { ToolResult } from '@/core/types';

export interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
}

/** Compute the tile rectangles for a grid cut. gap is the spacing between tiles in pixels. */
export function computeGrid(
  imgW: number,
  imgH: number,
  cols: number,
  rows: number,
  gap = 0,
): ToolResult<GridCell[]> {
  if (!Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW < 1 || imgH < 1) {
    return { ok: false, error: 'EMPTY' };
  }
  const c = Math.max(1, Math.min(Math.round(cols), 50));
  const r = Math.max(1, Math.min(Math.round(rows), 50));
  const g = Math.max(0, Math.round(gap));
  const cellW = Math.floor((imgW - g * (c - 1)) / c);
  const cellH = Math.floor((imgH - g * (r - 1)) / r);
  if (cellW < 1 || cellH < 1) return { ok: false, error: 'TOO_MANY' };

  const cells: GridCell[] = [];
  for (let row = 0; row < r; row += 1) {
    for (let col = 0; col < c; col += 1) {
      cells.push({
        x: col * (cellW + g),
        y: row * (cellH + g),
        width: cellW,
        height: cellH,
        row,
        col,
      });
    }
  }
  return { ok: true, value: cells };
}
