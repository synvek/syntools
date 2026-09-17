import type { ShapeGeometry } from './model/types';

/**
 * 幻灯片编辑器纯逻辑层（技术设计 §8.2 契约在本工具内的延续）：
 * - 不引用 Konva / JSZip，纯函数便于单测；
 * - 单位换算、DrawingML 颜色修正、prstGeom 几何映射、吸附对齐集中在此。
 */

/** 1px = 9525 EMU（96dpi：1 inch = 914400 EMU = 96px，整除） */
export const EMU_PER_PX = 9525;
/** DrawingML 字号单位为 1/100 pt */
export const PT_HUNDREDTHS = 100;
/** DrawingML 百分比单位：1000 = 100% */
export const PCT_UNIT = 1000;
/** DrawingML alpha / lumMod 单位：100000 = 100% */
export const ALPHA_UNIT = 100000;

export function emuToPx(emu: number): number {
  return Math.round(emu / EMU_PER_PX);
}

export function pxToEmu(px: number): number {
  return Math.round(px * EMU_PER_PX);
}

/** DrawingML 字号（1/100 pt）→ 磅值 */
export function hundredthsPtToPt(value: number): number {
  return value / 100;
}

/** 磅值 → DrawingML 字号整数（1/100 pt） */
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

/** DrawingML 千分比 → px */
export function permilleToPx(value: number, base: number): number {
  return (value / PCT_UNIT) * base;
}

/* ------------------------------- 颜色 ------------------------------- */

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

/** 归一化 6 位十六进制色；非法输入返回 null */
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

/** 依据 lumMod/lumOff/shade/tint 修正颜色（DrawingML §20.1.2.3 等价语义） */
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

/** #RRGGBB + 透明度 → rgba() 字符串（alpha=1 时返回原色） */
export function withAlpha(hex: string, alpha?: number): string {
  if (alpha === undefined || alpha >= 1) return hex;
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha).toFixed(3)})`;
}

/* ------------------------- DrawingML 预设几何映射 ------------------------- */

/** 归一化多边形顶点（每点为 [x,y]，取值 0~1） */
function poly(points: number[][]): number[] {
  return points.flat();
}

const PRST_GEOMS: Record<string, ShapeGeometry> = {
  // 矩形族
  rect: { kind: 'rect', prst: 'rect' },
  roundRect: { kind: 'rect', radius: 0.167, prst: 'roundRect' },
  snip1Rect: { kind: 'rect', prst: 'snip1Rect' },
  snipRoundRect: { kind: 'rect', radius: 0.083, prst: 'snipRoundRect' },
  frame: { kind: 'rect', prst: 'frame' },
  // 椭圆族
  ellipse: { kind: 'ellipse', prst: 'ellipse' },
  // 三角形族
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
  isoTriangle: {
    kind: 'polygon',
    points: poly([
      [0.5, 0],
      [1, 1],
      [0, 1],
    ]),
    prst: 'rtTriangle',
  },
  // 菱形 / 梯形
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
  pentagon: {
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
  // 箭头族
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
  // 星形族
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

/** prstGeom → 渲染几何；未收录的形状降级为同尺寸矩形（并保留原 prst 名） */
export function resolvePresetGeometry(prst: string): ShapeGeometry {
  return PRST_GEOMS[prst] ?? { kind: 'rect', prst: prst || 'rect' };
}

/** 星形顶点数（prst: star5 → 5） */
export function starPoints(prst: string): number {
  const direct = /^star(\d+)$/.exec(prst);
  if (direct) return Math.max(3, Number(direct[1]));
  return 5;
}

/* ----------------------------- 吸附与对齐 ----------------------------- */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Guide {
  axis: 'x' | 'y';
  /** 参考线位置（页面坐标） */
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

/** 目标矩形各边、中线 → 候选吸附值 */
function candidatesOf(rect: SnapCandidate, axis: 'x' | 'y'): number[] {
  if (axis === 'x') {
    return [rect.x, rect.x + rect.width / 2, rect.x + rect.width];
  }
  return [rect.y, rect.y + rect.height / 2, rect.y + rect.height];
}

/**
 * 计算移动元素的吸附落点：
 * 比较「当前边/中线」与「页面中心 + 其它元素的边/中线」，距离 ≤ tolerance 时吸附并产生参考线。
 */
export function computeSnap(
  moving: Rect,
  others: SnapCandidate[],
  page: { width: number; height: number },
  tolerance = 6,
): SnapResult {
  let dx = 0;
  let dy = 0;
  const guides: Guide[] = [];
  let bestX: { delta: number; position: number } | null = null;
  let bestY: { delta: number; position: number } | null = null;

  const staticX = [0, page.width / 2, page.width];
  const staticY = [0, page.height / 2, page.height];
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
  }
  if (bestY) {
    dy = bestY.delta;
    guides.push({ axis: 'y', position: bestY.position });
  }

  return { x: moving.x + dx, y: moving.y + dy, guides };
}

/** 把角度收敛到 [0,360) */
export function normalizeAngle(deg: number): number {
  const value = deg % 360;
  return value < 0 ? value + 360 : value;
}

/** 角度 → 弧度 */
export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 等比缩放：给定新宽，返回保持原始比例的高 */
export function scaleHeight(width: number, source: { width: number; height: number }): number {
  if (!source.width || !source.height) return width;
  return (width * source.height) / source.width;
}

/** 把等比缩放的结果收敛到页面尺寸内 */
export function containInto(
  source: { width: number; height: number },
  bounds: { width: number; height: number },
): { width: number; height: number } {
  if (!source.width || !source.height) return { width: bounds.width, height: bounds.height };
  const ratio = Math.min(bounds.width / source.width, bounds.height / source.height, 1);
  return { width: Math.round(source.width * ratio), height: Math.round(source.height * ratio) };
}

/** 依据内容 Availability 计算画布缩放比例（留白 32px） */
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

/** 元素 z-order：默认按数组顺序，绘制时自上而下 */
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

/** 计算导出文件名 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 60) || 'presentation';
}

export function buildExportFilename(title: string, ext: 'pptx'): string {
  return `${sanitizeFilename(title)}.${ext}`;
}
