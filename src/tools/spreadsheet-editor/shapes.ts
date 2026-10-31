import { resolvePresetGeometry, shapeAdjustValues } from '../../core/drawing/shapeDefs';
import { shapePathD } from '../../core/drawing/svgPath';

/**
 * Floating shapes on a sheet (SHEET-02 / P4-SH0).
 *
 * Two coordinate systems exist and only one of them is the truth:
 * - **cell anchor** (`from`: row/col + pixel offsets) — what the file stores, what survives a
 *   reopen, and what Excel actually understands (`xdr:oneCellAnchor`);
 * - **pixels** — derived for the overlay renderer from the sheet's real column widths / row
 *   heights, because defaulting to a single column width (what the chart layer does) drifts as soon
 *   as the user resizes a column.
 */

export interface SheetShapeConfig {
  id: string;
  /** DrawingML preset geometry name, shared with `core/drawing/SHAPE_DEFS` */
  prst: string;
  sheetId?: string;
  /** Top-left anchor: cell + pixel offset inside that cell — the persisted source of truth */
  from: { col: number; row: number; colOff: number; rowOff: number };
  width: number;
  height: number;
  rotation?: number;
  /** Adjustment handle values, 0~1 normalized (same contract as the slide/RTE shape layers) */
  adj?: Record<string, number>;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Text inside the shape (one paragraph, one run style — the documented scope) */
  text?: string;
  /** Stacking order, smaller is lower */
  z: number;
}

/** Only the geometry half of a sheet snapshot: enough to convert anchors and pixels */
export interface SheetLayout {
  defaultColumnWidth: number;
  defaultRowHeight: number;
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
}

export interface SheetLayoutSource {
  defaultColumnWidth?: number;
  defaultRowHeight?: number;
  columnData?: Record<string, { w?: number }>;
  rowData?: Record<string, { h?: number }>;
}

export const DEFAULT_COLUMN_WIDTH = 93;
export const DEFAULT_ROW_HEIGHT = 27;
export const DEFAULT_SHAPE_WIDTH = 180;
export const DEFAULT_SHAPE_HEIGHT = 100;

/** Colors offered to a freshly inserted shape (accent palette, not a theme reference) */
export const SHAPE_DEFAULT_FILL = '#4472C4';
export const SHAPE_DEFAULT_STROKE = '#2F5597';

const clampInt = (value: number, min: number): number =>
  Number.isFinite(value) ? Math.max(min, Math.round(value)) : min;

const clampSize = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.max(8, Math.round(value)) : fallback;

/** Snapshot sheet → the layout used for both rendering and export (one source, no drift) */
export function buildSheetLayout(sheet: SheetLayoutSource | undefined): SheetLayout {
  const columnWidths: Record<string, number> = {};
  const rowHeights: Record<string, number> = {};
  for (const [key, column] of Object.entries(sheet?.columnData ?? {})) {
    if (column?.w && column.w > 0) columnWidths[key] = column.w;
  }
  for (const [key, row] of Object.entries(sheet?.rowData ?? {})) {
    if (row?.h && row.h > 0) rowHeights[key] = row.h;
  }
  return {
    defaultColumnWidth: sheet?.defaultColumnWidth || DEFAULT_COLUMN_WIDTH,
    defaultRowHeight: sheet?.defaultRowHeight || DEFAULT_ROW_HEIGHT,
    columnWidths,
    rowHeights,
  };
}

export function columnWidthPx(layout: SheetLayout, column: number): number {
  return Math.max(1, layout.columnWidths[String(column)] ?? layout.defaultColumnWidth);
}

export function rowHeightPx(layout: SheetLayout, row: number): number {
  return Math.max(1, layout.rowHeights[String(row)] ?? layout.defaultRowHeight);
}

/** Left edge of a column in sheet content coordinates (px) */
export function columnLeftPx(layout: SheetLayout, column: number): number {
  let left = 0;
  for (let index = 0; index < column; index += 1) left += columnWidthPx(layout, index);
  return left;
}

/** Top edge of a row in sheet content coordinates (px) */
export function rowTopPx(layout: SheetLayout, row: number): number {
  let top = 0;
  for (let index = 0; index < row; index += 1) top += rowHeightPx(layout, index);
  return top;
}

/** Anchor → content pixels (top-left corner of the shape) */
export function anchorToPx(
  from: SheetShapeConfig['from'],
  layout: SheetLayout,
): { x: number; y: number } {
  const column = clampInt(from.col, 0);
  const row = clampInt(from.row, 0);
  return {
    x: columnLeftPx(layout, column) + Math.max(0, from.colOff),
    y: rowTopPx(layout, row) + Math.max(0, from.rowOff),
  };
}

/**
 * Content pixels → anchor.
 *
 * Walks rows/columns instead of dividing by a default size, so a shape dropped past a resized
 * column lands on the cell that is actually under the pointer. `limit` bounds the walk for
 * pathological coordinates (a click far outside the used range).
 */
export function pxToAnchor(
  x: number,
  y: number,
  layout: SheetLayout,
  limit = 4096,
): SheetShapeConfig['from'] {
  const targetX = Math.max(0, x);
  const targetY = Math.max(0, y);
  let col = 0;
  let left = 0;
  while (col < limit && left + columnWidthPx(layout, col) <= targetX) {
    left += columnWidthPx(layout, col);
    col += 1;
  }
  let row = 0;
  let top = 0;
  while (row < limit && top + rowHeightPx(layout, row) <= targetY) {
    top += rowHeightPx(layout, row);
    row += 1;
  }
  return {
    col,
    row,
    colOff: Math.round(targetX - left),
    rowOff: Math.round(targetY - top),
  };
}

/** Shape → content-space box, ready for an absolutely positioned overlay */
export function shapeRect(
  shape: SheetShapeConfig,
  layout: SheetLayout,
): { x: number; y: number; width: number; height: number } {
  const { x, y } = anchorToPx(shape.from, layout);
  return {
    x,
    y,
    width: clampSize(shape.width, DEFAULT_SHAPE_WIDTH),
    height: clampSize(shape.height, DEFAULT_SHAPE_HEIGHT),
  };
}

/** SVG path for the shape at its own size (rotation is applied by the caller) */
export function shapePath(
  shape: Pick<SheetShapeConfig, 'prst' | 'adj' | 'width' | 'height'>,
): string {
  const geometry = resolvePresetGeometry(shape.prst, shape.adj);
  return shapePathD(geometry, shape.width, shape.height);
}

/** Adjustment handles this preset exposes (empty for most shapes) */
export function shapeAdjustHandles(prst: string): { name: string; defaultValue: number }[] {
  const values = shapeAdjustValues({ prst });
  return Object.entries(values).map(([name, defaultValue]) => ({ name, defaultValue }));
}

let shapeSeq = 0;

/** Fresh shape with defaults; `id` stays unique per document session */
export function createSheetShape(options: {
  prst: string;
  from: SheetShapeConfig['from'];
  sheetId?: string;
  width?: number;
  height?: number;
  z?: number;
}): SheetShapeConfig {
  shapeSeq += 1;
  return {
    id: `shape-${Date.now().toString(36)}-${shapeSeq}`,
    prst: options.prst || 'rect',
    ...(options.sheetId ? { sheetId: options.sheetId } : {}),
    from: options.from,
    width: clampSize(options.width ?? DEFAULT_SHAPE_WIDTH, DEFAULT_SHAPE_WIDTH),
    height: clampSize(options.height ?? DEFAULT_SHAPE_HEIGHT, DEFAULT_SHAPE_HEIGHT),
    fill: SHAPE_DEFAULT_FILL,
    stroke: SHAPE_DEFAULT_STROKE,
    strokeWidth: 1,
    z: options.z ?? 0,
  };
}

/** Palette entry: `labelKey` resolves under `tools.sheet.*` in `shapeStrings.ts` */
export interface SheetShapePreset {
  prst: string;
  labelKey: string;
}

/**
 * 23 presets in four groups. Deliberately a curated subset: the sheet palette is a quick annotation
 * tool, not a full shape library (that lives in the slide editor).
 */
export const SHEET_SHAPE_PRESETS: SheetShapePreset[][] = [
  [
    { prst: 'rect', labelKey: 'shapeRect' },
    { prst: 'roundRect', labelKey: 'shapeRoundRect' },
    { prst: 'ellipse', labelKey: 'shapeEllipse' },
    { prst: 'triangle', labelKey: 'shapeTriangle' },
    { prst: 'rtTriangle', labelKey: 'shapeRtTriangle' },
    { prst: 'diamond', labelKey: 'shapeDiamond' },
    { prst: 'pentagon', labelKey: 'shapePentagon' },
    { prst: 'hexagon', labelKey: 'shapeHexagon' },
    { prst: 'parallelogram', labelKey: 'shapeParallelogram' },
    { prst: 'trapezoid', labelKey: 'shapeTrapezoid' },
  ],
  [
    { prst: 'rightArrow', labelKey: 'shapeRightArrow' },
    { prst: 'leftArrow', labelKey: 'shapeLeftArrow' },
    { prst: 'upArrow', labelKey: 'shapeUpArrow' },
    { prst: 'downArrow', labelKey: 'shapeDownArrow' },
    { prst: 'leftRightArrow', labelKey: 'shapeLeftRightArrow' },
    { prst: 'chevron', labelKey: 'shapeChevron' },
  ],
  [
    { prst: 'star4', labelKey: 'shapeStar4' },
    { prst: 'star6', labelKey: 'shapeStar6' },
    { prst: 'star8', labelKey: 'shapeStar8' },
  ],
  [
    { prst: 'flowChartProcess', labelKey: 'shapeProcess' },
    { prst: 'flowChartDecision', labelKey: 'shapeDecision' },
    { prst: 'flowChartTerminator', labelKey: 'shapeTerminator' },
    { prst: 'flowChartDocument', labelKey: 'shapeDocument' },
  ],
];
