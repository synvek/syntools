import type { Fill, ShapeGeometry, SlideBackground, SlideDoc, SlideElement } from './model/types';

/**
 * Slide editor pure-logic layer (continuation of the §8.2 contract inside this tool):
 * - no Konva / JSZip imports, pure functions are easy to unit test;
 * - unit conversion, DrawingML color correction, prstGeom mapping and snapping live here.
 */

/** 1px = 9525 EMU (96dpi: 1 inch = 914400 EMU = 96px, exact) */
export const EMU_PER_PX = 9525;
/** DrawingML font size is in 1/100 pt */
export const PT_HUNDREDTHS = 100;
/** DrawingML percentage unit: 1000 = 100% */
export const PCT_UNIT = 1000;
/** DrawingML alpha / lumMod unit: 100000 = 100% */
export const ALPHA_UNIT = 100000;

export function emuToPx(emu: number): number {
  return Math.round(emu / EMU_PER_PX);
}

export function pxToEmu(px: number): number {
  return Math.round(px * EMU_PER_PX);
}

/** DrawingML font size (1/100 pt) → points */
export function hundredthsPtToPt(value: number): number {
  return value / 100;
}

/** Points → DrawingML integer font size (1/100 pt) */
export function ptToHundredthsPt(pt: number): number {
  return Math.round(pt * 100);
}

/** pt → px（96dpi：1pt = 4/3 px） */
export function ptToPx(pt: number): number {
  return (pt * 96) / 72;
}

export function pxToPt(px: number): number {
  return (px * 72) / 96;
}

/** DrawingML permille → px */
export function permilleToPx(value: number, base: number): number {
  return (value / PCT_UNIT) * base;
}

/* ------------------------------- Colors ------------------------------- */

export interface ColorTransform {
  lumMod?: number;
  lumOff?: number;
  shade?: number;
  tint?: number;
  /** 0~1 */
  alpha?: number;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) =>
    Math.round(Math.min(255, Math.max(0, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Normalize a 6-digit hex color; returns null for invalid input */
export function normalizeHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const text = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(text)) {
    return `#${text
      .split('')
      .map((c) => c + c)
      .join('')
      .toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(text)) return `#${text.toLowerCase()}`;
  return null;
}

/** Correct a color via lumMod/lumOff/shade/tint (equivalent to DrawingML §20.1.2.3) */
export function applyColorTransform(hex: string, tf: ColorTransform = {}): string {
  let [r, g, b] = hexToRgb(hex);
  if (typeof tf.lumMod === 'number' && Number.isFinite(tf.lumMod)) {
    const k = clamp01(tf.lumMod / ALPHA_UNIT);
    r *= k;
    g *= k;
    b *= k;
  }
  if (typeof tf.lumOff === 'number' && Number.isFinite(tf.lumOff)) {
    const k = clamp01(tf.lumOff / ALPHA_UNIT);
    r += 255 * k;
    g += 255 * k;
    b += 255 * k;
  }
  if (typeof tf.shade === 'number' && Number.isFinite(tf.shade)) {
    const k = clamp01(tf.shade / ALPHA_UNIT);
    r *= k;
    g *= k;
    b *= k;
  }
  if (typeof tf.tint === 'number' && Number.isFinite(tf.tint)) {
    const k = clamp01(tf.tint / ALPHA_UNIT);
    r = r * (1 - k) + 255 * k;
    g = g * (1 - k) + 255 * k;
    b = b * (1 - k) + 255 * k;
  }
  return rgbToHex(r, g, b);
}

/** #RRGGBB + alpha → rgba() string (returns the original color when alpha=1) */
export function withAlpha(hex: string, alpha?: number): string {
  if (alpha === undefined || alpha >= 1) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha).toFixed(3)})`;
}

/* --------------------------- Background normalization --------------------------- */

/**
 * Normalize a slide background to `Fill`.
 *
 * In v1 `background` was a solid color string; since v2 it may be a `Fill` (gradient/none).
 * All read paths (opening `.sld`, localStorage drafts, master inheritance) go through here, so
 * rendering and export only ever handle one shape: `Fill`.
 */
export function normalizeBackground(bg: SlideBackground | undefined): Fill | undefined {
  if (bg === undefined || bg === null) return undefined;
  if (typeof bg === 'string') {
    const color = normalizeHex(bg);
    return color ? { type: 'solid', color } : undefined;
  }
  return bg;
}

/** Representative color of a background: solid uses itself, gradient its first stop, none returns fallback */
export function backgroundToColor(bg: SlideBackground | undefined, fallback = '#FFFFFF'): string {
  const fill = normalizeBackground(bg);
  if (!fill) return fallback;
  if (fill.type === 'solid') return fill.color;
  if (fill.type === 'gradient' && fill.stops.length > 0) return fill.stops[0].color;
  return fallback;
}

/** Whether the background is solid (the property panel picks a color picker or gradient editor from this) */
export function isSolidBackground(bg: SlideBackground | undefined): boolean {
  const fill = normalizeBackground(bg);
  return fill?.type === 'solid';
}

/* ------------------------- DrawingML preset geometry mapping ------------------------- */

/** Normalized polygon vertices (each point is [x,y], values 0~1) */
function poly(points: number[][]): number[] {
  return points.flat();
}

const PRST_GEOMS: Record<string, ShapeGeometry> = {
  // Rectangle family
  rect: { kind: 'rect', prst: 'rect' },
  roundRect: { kind: 'rect', radius: 0.167, prst: 'roundRect' },
  snip1Rect: { kind: 'rect', prst: 'snip1Rect' },
  snipRoundRect: { kind: 'rect', radius: 0.083, prst: 'snipRoundRect' },
  frame: { kind: 'rect', prst: 'frame' },
  // Ellipse family
  ellipse: { kind: 'ellipse', prst: 'ellipse' },
  // Triangle family
  triangle: {
    kind: 'polygon',
    points: poly([
      [0.5, 0],
      [1, 1],
      [0, 1],
    ]),
    prst: 'triangle',
  },
  rtTriangle: {
    kind: 'polygon',
    points: poly([
      [0, 0],
      [1, 1],
      [0, 1],
    ]),
    prst: 'rtTriangle',
  },
  // Isosceles triangle (apex up). prst used to be mislabeled rtTriangle, which changed the shape on export
  isoTriangle: {
    kind: 'polygon',
    points: poly([
      [0.5, 0],
      [1, 1],
      [0, 1],
    ]),
    prst: 'isoTriangle',
  },
  // Diamond / trapezoid
  diamond: {
    kind: 'polygon',
    points: poly([
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ]),
    prst: 'diamond',
  },
  trapezoid: {
    kind: 'polygon',
    points: poly([
      [0.2, 0],
      [0.8, 0],
      [1, 1],
      [0, 1],
    ]),
    prst: 'trapezoid',
  },
  // Regular pentagon (apex up, vertices on a circumcircle of radius 0.5)
  pentagon: {
    kind: 'polygon',
    points: poly([
      [0.5, 0],
      [0.976, 0.345],
      [0.794, 0.905],
      [0.206, 0.905],
      [0.024, 0.345],
    ]),
    prst: 'pentagon',
  },
  // Home plate (DrawingML homePlate): previously mistaken for a pentagon geometry
  homePlate: {
    kind: 'polygon',
    points: poly([
      [0.5, 0],
      [1, 0.38],
      [0.82, 1],
      [0.18, 1],
      [0, 0.38],
    ]),
    prst: 'homePlate',
  },
  hexagon: {
    kind: 'polygon',
    points: poly([
      [0.25, 0],
      [0.75, 0],
      [1, 0.5],
      [0.75, 1],
      [0.25, 1],
      [0, 0.5],
    ]),
    prst: 'hexagon',
  },
  octagon: {
    kind: 'polygon',
    points: poly([
      [0.29, 0],
      [0.71, 0],
      [1, 0.29],
      [1, 0.71],
      [0.71, 1],
      [0.29, 1],
      [0, 0.71],
      [0, 0.29],
    ]),
    prst: 'octagon',
  },
  // Arrow family
  rightArrow: {
    kind: 'polygon',
    points: poly([
      [0, 0.25],
      [0.6, 0.25],
      [0.6, 0],
      [1, 0.5],
      [0.6, 1],
      [0.6, 0.75],
      [0, 0.75],
    ]),
    prst: 'rightArrow',
  },
  leftArrow: {
    kind: 'polygon',
    points: poly([
      [1, 0.25],
      [0.4, 0.25],
      [0.4, 0],
      [0, 0.5],
      [0.4, 1],
      [0.4, 0.75],
      [1, 0.75],
    ]),
    prst: 'leftArrow',
  },
  upArrow: {
    kind: 'polygon',
    points: poly([
      [0.5, 0],
      [1, 0.4],
      [0.75, 0.4],
      [0.75, 1],
      [0.25, 1],
      [0.25, 0.4],
      [0, 0.4],
    ]),
    prst: 'upArrow',
  },
  downArrow: {
    kind: 'polygon',
    points: poly([
      [0.5, 1],
      [1, 0.6],
      [0.75, 0.6],
      [0.75, 0],
      [0.25, 0],
      [0.25, 0.6],
      [0, 0.6],
    ]),
    prst: 'downArrow',
  },
  chevron: {
    kind: 'polygon',
    points: poly([
      [0, 0],
      [0.6, 0],
      [1, 0.5],
      [0.6, 1],
      [0, 1],
      [0.4, 0.5],
    ]),
    prst: 'chevron',
  },
  // Star family
  star5: { kind: 'star', innerRatio: 0.382, prst: 'star' },
  star: { kind: 'star', innerRatio: 0.382, prst: 'star' },
  star4: { kind: 'star', innerRatio: 0.4, prst: 'star4' },
  star6: { kind: 'star', innerRatio: 0.4, prst: 'star6' },
  star8: { kind: 'star', innerRatio: 0.45, prst: 'star8' },
  star12: { kind: 'star', innerRatio: 0.5, prst: 'star12' },
  star16: { kind: 'star', innerRatio: 0.5, prst: 'star16' },
  star24: { kind: 'star', innerRatio: 0.55, prst: 'star24' },
  star32: { kind: 'star', innerRatio: 0.6, prst: 'star32' },
};

/** prstGeom → render geometry; unknown shapes degrade to a same-size rect (keeping the original prst name) */
export function resolvePresetGeometry(prst: string): ShapeGeometry {
  return PRST_GEOMS[prst] ?? { kind: 'rect', prst: prst || 'rect' };
}

/** Number of star points (prst: star5 → 5) */
export function starPoints(prst: string): number {
  const direct = /^star(\d+)$/.exec(prst);
  if (direct) return Math.max(3, Number(direct[1]));
  return 5;
}

/* ----------------------------- Snapping and alignment ----------------------------- */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Guide {
  axis: 'x' | 'y';
  /** Guide position (page coordinates) */
  position: number;
}

export interface SnapResult {
  x: number;
  y: number;
  guides: Guide[];
}

export interface SnapCandidate {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Candidate snap values from each edge and center line of the target rect */
function candidatesOf(rect: SnapCandidate, axis: 'x' | 'y'): number[] {
  if (axis === 'x') {
    return [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
  }
  return [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
}

/** Grid snap step (px @96dpi), kept in sync with the canvas background grid */
export const GRID_SIZE = 24;

export interface SnapOptions {
  /** Extra static snap positions (manual guides) */
  extraX?: number[];
  extraY?: number[];
  /** Grid snap step; pass 0 / omit to disable */
  grid?: number;
}

/**
 * Compute the snap landing point for a moving element:
 * compares its edges/center lines with the page center, other elements' edges/center lines and guides,
 * snapping within tolerance; an unmatched axis falls back to the nearest grid line when grid snap is on.
 */
export function computeSnap(
  moving: Rect,
  others: SnapCandidate[],
  page: { width: number; height: number },
  tolerance = 6,
  options: SnapOptions = {},
): SnapResult {
  let dx = 0;
  let dy = 0;
  const guides: Guide[] = [];
  let bestX: { delta: number; position: number } | null = null;
  let bestY: { delta: number; position: number } | null = null;

  const staticX = [0, page.width / 2, page.width, ...(options.extraX ?? [])];
  const staticY = [0, page.height / 2, page.height, ...(options.extraY ?? [])];
  for (const other of others) {
    staticX.push(...candidatesOf(other, 'x'));
    staticY.push(...candidatesOf(other, 'y'));
  }

  for (const movingX of candidatesOf(moving, 'x')) {
    for (const targetX of staticX) {
      const delta = targetX - movingX;
      if (Math.abs(delta) > tolerance) continue;
      if (!bestX || Math.abs(delta) < Math.abs(bestX.delta)) bestX = { delta, position: targetX };
    }
  }
  for (const movingY of candidatesOf(moving, 'y')) {
    for (const targetY of staticY) {
      const delta = targetY - movingY;
      if (Math.abs(delta) > tolerance) continue;
      if (!bestY || Math.abs(delta) < Math.abs(bestY.delta)) bestY = { delta, position: targetY };
    }
  }

  if (bestX) {
    dx = bestX.delta;
    guides.push({ axis: 'x', position: bestX.position });
  } else if (options.grid && options.grid > 0) {
    // No alignment hit: fall back to grid snapping (no guide, to avoid visual noise)
    dx = Math.round(moving.x / options.grid) * options.grid - moving.x;
  }
  if (bestY) {
    dy = bestY.delta;
    guides.push({ axis: 'y', position: bestY.position });
  } else if (options.grid && options.grid > 0) {
    dy = Math.round(moving.y / options.grid) * options.grid - moving.y;
  }

  return { x: moving.x + dx, y: moving.y + dy, guides };
}

/* ----------------------------- Align and distribute ----------------------------- */

/** Alignment mode: left/right/top/bottom align to the reference edge, hcenter/vcenter to the reference center line */
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

/** Distribution axis: evenly spaced (the first and last elements stay in place) */
export type DistributeAxis = 'horizontal' | 'vertical';

export interface AlignBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Union bounding box of a set of rects */
export function unionBounds(boxes: AlignBox[]): AlignBox {
  if (boxes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const box of boxes) {
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.width);
    maxY = Math.max(maxY, box.y + box.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Compute alignment offsets: align each rect's matching edge/center line to bounds.
 *
 * The caller decides what bounds means: the union of the selected elements for multi-select
 * (align to selection), or the page rect for single-select (align to slide), as PowerPoint / WPS do.
 */
export function computeAlign(
  mode: AlignMode,
  targets: AlignBox[],
  bounds: AlignBox,
): { dx: number; dy: number }[] {
  return targets.map((target) => {
    let dx = 0;
    let dy = 0;
    switch (mode) {
      case 'left':
        dx = bounds.x - target.x;
        break;
      case 'right':
        dx = bounds.x + bounds.width - (target.x + target.width);
        break;
      case 'hcenter':
        dx = bounds.x + bounds.width / 2 - (target.x + target.width / 2);
        break;
      case 'top':
        dy = bounds.y - target.y;
        break;
      case 'bottom':
        dy = bounds.y + bounds.height - (target.y + target.height);
        break;
      case 'vcenter':
        dy = bounds.y + bounds.height / 2 - (target.y + target.height / 2);
        break;
    }
    return { dx: Math.round(dx), dy: Math.round(dy) };
  });
}

/**
 * Compute equal-spacing offsets: keep the first and last elements fixed and even out the gaps.
 * With fewer than 3 objects there is no gap to distribute, so it returns zero offsets.
 */
export function computeDistribute(
  axis: DistributeAxis,
  targets: AlignBox[],
): { dx: number; dy: number }[] {
  const zeros = targets.map(() => ({ dx: 0, dy: 0 }));
  if (targets.length < 3) return zeros;

  const horizontal = axis === 'horizontal';
  const order = targets
    .map((box, index) => ({ box, index }))
    .sort((a, b) =>
      horizontal ? a.box.x - b.box.x || a.box.y - b.box.y : a.box.y - b.box.y || a.box.x - b.box.x,
    );

  const first = order[0].box;
  const last = order[order.length - 1].box;
  const span = horizontal ? last.x + last.width - first.x : last.y + last.height - first.y;
  const total = targets.reduce((sum, box) => sum + (horizontal ? box.width : box.height), 0);
  const gap = (span - total) / (targets.length - 1);

  let cursor = horizontal ? first.x : first.y;
  for (const entry of order) {
    const size = horizontal ? entry.box.width : entry.box.height;
    const offset = cursor - (horizontal ? entry.box.x : entry.box.y);
    zeros[entry.index] = horizontal
      ? { dx: Math.round(offset), dy: 0 }
      : { dx: 0, dy: Math.round(offset) };
    cursor += size + gap;
  }
  return zeros;
}

/** Normalize an angle into [0,360) */
export function normalizeAngle(deg: number): number {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
}

/** Degrees → radians */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Proportional resize: given a new width, return the height that keeps the original ratio */
export function scaleHeight(width: number, source: { width: number; height: number }): number {
  if (!source.width || !source.height) return width;
  return (width * source.height) / source.width;
}

/** Constrain a proportional resize result to fit inside the page */
export function containInto(
  source: { width: number; height: number },
  bounds: { width: number; height: number },
): { width: number; height: number } {
  if (!source.width || !source.height) return { width: bounds.width, height: bounds.height };
  const ratio = Math.min(bounds.width / source.width, bounds.height / source.height, 1);
  return { width: Math.round(source.width * ratio), height: Math.round(source.height * ratio) };
}

/** Compute the canvas scale that fits the content (32px padding) */
export function fitScale(
  doc: { width: number; height: number },
  viewport: { width: number; height: number },
  padding = 32,
): number {
  if (!doc.width || !doc.height) return 1;
  const scale = Math.min(
    (viewport.width - padding * 2) / doc.width,
    (viewport.height - padding * 2) / doc.height,
    2,
  );
  return Math.max(0.1, Math.round(scale * 1000) / 1000);
}

/** Element z-order: array order by default, drawn top-down */
export function clampBounds(rect: Rect, page: { width: number; height: number }): Rect {
  const width = Math.max(1, Math.min(rect.width, page.width * 4));
  const height = Math.max(1, Math.min(rect.height, page.height * 4));
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Page size change: proportionally scale existing content and re-center it in the new size.
 *
 * Pure function (does not mutate its input), returns a new SlideDoc.
 * The scale factor is the smaller of the width/height ratios (contain semantics) so content never
 * overflows; the whole is then shifted to the new page center, i.e. PowerPoint's "maximize / ensure fit".
 * Groups scale only their frame; children follow automatically via the Konva.Group transform.
 */
export function scaleDocForSize(doc: SlideDoc, width: number, height: number): SlideDoc {
  const targetWidth = Math.max(1, Math.round(width));
  const targetHeight = Math.max(1, Math.round(height));
  const scaleX = targetWidth / (doc.width || 1);
  const scaleY = targetHeight / (doc.height || 1);
  const ratio = Math.min(scaleX, scaleY);

  const remap = (elements: SlideElement[]): SlideElement[] =>
    elements.map((element) => {
      const nextWidth = Math.max(1, Math.round(element.width * ratio));
      const nextHeight = Math.max(1, Math.round(element.height * ratio));
      return {
        ...element,
        width: nextWidth,
        height: nextHeight,
        x: Math.round(
          (targetWidth - nextWidth) / 2 + (element.x - (doc.width - element.width) / 2) * ratio,
        ),
        y: Math.round(
          (targetHeight - nextHeight) / 2 + (element.y - (doc.height - element.height) / 2) * ratio,
        ),
      };
    });

  return {
    ...doc,
    width: targetWidth,
    height: targetHeight,
    masters: doc.masters.map((master) => ({ ...master, elements: remap(master.elements) })),
    layouts: doc.layouts.map((layout) => ({ ...layout, elements: remap(layout.elements) })),
    slides: doc.slides.map((slide) => ({ ...slide, elements: remap(slide.elements) })),
    version: doc.version + 1,
  };
}

/** Compute the export file name */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 60) || 'presentation';
}

export function buildExportFilename(title: string, ext: 'pptx' | 'pdf' | 'png' | 'sld'): string {
  return `${sanitizeFilename(title)}.${ext}`;
}
