/**
 * 涂鸦画板核心模型与纯函数（不依赖 DOM，便于复用与验证）。
 *
 * 场景采用**矢量操作列表**而非像素快照：每次落笔是一条 Op，
 * 画布只是 ops 的重放结果。这样撤销只是替换 ops 列表（O(1)），
 * 改变画布尺寸 / DPR 不清空笔迹，草稿也能被序列化成很小的 JSON。
 */

export type ToolId =
  | 'pen'
  | 'marker'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'polygon'
  | 'text'
  | 'picker'
  | 'move';

/** 背景类型：`solid` 纯色 / `grid` 网格（屏幕上由 CSS 呈现，导出时才合成） */
export type BackgroundKind = 'transparent' | 'solid' | 'grid';

export type SizePreset = 'fit' | '800x600' | '1280x720' | '1920x1080' | 'custom';

/** 采样点：`p` 为该点的压感系数（0~1，鼠标恒为 1） */
export interface Point {
  x: number;
  y: number;
  p: number;
}

export interface StrokeOp {
  kind: 'stroke';
  mode: 'pen' | 'marker' | 'eraser';
  color: string;
  width: number;
  opacity: number;
  points: Point[];
}

export interface LineOp {
  kind: 'line' | 'arrow';
  from: Point;
  to: Point;
  color: string;
  width: number;
  opacity: number;
}

export interface ShapeOp {
  kind: 'rect' | 'ellipse';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  width: number;
  opacity: number;
  /** 是否填充（填充色取 `fillColor`，缺省回退描边色；透明度取 opacity 的三成） */
  fill: boolean;
  /** 填充色（工具栏的「背景色」），缺省时与描边同色 */
  fillColor?: string;
}

/** 自由多边形：依次点击的顶点，闭合成面 */
export interface PolygonOp {
  kind: 'polygon';
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  fill: boolean;
  /** 填充色（工具栏的「背景色」），缺省时与描边同色 */
  fillColor?: string;
}

export interface TextOp {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  size: number;
  color: string;
  opacity: number;
}

export type Op = StrokeOp | LineOp | ShapeOp | PolygonOp | TextOp;

export interface Background {
  kind: BackgroundKind;
  /** `solid` / `grid` 使用的底色 */
  color: string;
}

export interface Scene {
  width: number;
  height: number;
  background: Background;
  ops: Op[];
}

/* ------------------------------- 常量 ------------------------------- */

export const BRUSH_MIN = 1;
export const BRUSH_MAX = 32;
export const TEXT_MIN = 12;
export const TEXT_MAX = 96;
export const HISTORY_LIMIT = 32;
/** 采样阈值：移动距离小于该值不记点，避免长笔画堆积无效点 */
export const SAMPLE_MIN_DISTANCE = 1.2;
/** 网格间距（同时决定屏幕上 CSS 网格的视觉密度） */
export const GRID_SIZE = 24;
/** 自适应预设的宽高比与取值区间 */
export const FIT_ASPECT = 0.6;
export const FIT_MIN_WIDTH = 360;
export const FIT_MAX_WIDTH = 1600;
export const DEFAULT_COLOR = '#0f172a';
export const DEFAULT_WIDTH = 4;
export const DEFAULT_OPACITY = 1;
/** 不透明度下限：低于 10% 的笔迹几乎看不见 */
export const OPACITY_STEP = 0.1;
export const DEFAULT_TEXT_SIZE = 24;
/** 荧光笔默认透明度：半透明叠加才是“划重点”的观感 */
export const MARKER_OPACITY = 0.4;
export const MARKER_MIN_WIDTH = 10;
/** 默认「背景色」（经典画板语义：形状填充色 / 右键落笔色） */
export const DEFAULT_SECONDARY = '#ffffff';

/** 缩放区间与档位（`fit` 由容器宽度实时计算，不在此列） */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
/** 整体移动的最小位移（画布坐标），小于该值视为误触 */
export const MOVE_MIN_DELTA = 1;
/** 多边形闭合判定：指针与起点的屏幕距离小于该值即闭合 */
export const POLYGON_CLOSE_PX = 12;
/** 最近使用颜色的保留数量 */
export const RECENT_LIMIT = 10;

/** 调色板：按行排列的 40 色，第一行沿用旧版预设，保持肌肉记忆 */
export const PALETTE = [
  '#0f172a',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#ffffff',
  '#64748b',
  '#94a3b8',
  '#cbd5e1',
  '#e2e8f0',
  '#7f1d1d',
  '#b91c1c',
  '#dc2626',
  '#f87171',
  '#7c2d12',
  '#c2410c',
  '#ea580c',
  '#fb923c',
  '#78350f',
  '#b45309',
  '#d97706',
  '#fbbf24',
  '#14532d',
  '#15803d',
  '#16a34a',
  '#4ade80',
  '#164e63',
  '#0e7490',
  '#0891b2',
  '#22d3ee',
  '#1e3a8a',
  '#1d4ed8',
  '#2563eb',
  '#60a5fa',
  '#4c1d95',
  '#6d28d9',
  '#7c3aed',
  '#c084fc',
  '#831843',
  '#be185d',
  '#db2777',
  '#f472b6',
];

/** 颜色是否可作为前景/背景色（仅接受 `#rgb` / `#rrggbb`） */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export const BACKGROUND_COLORS = ['#ffffff', '#f8fafc', '#111827', '#fff7ed', '#eef2ff'];

/** 尺寸预设表（`fit` 与 `custom` 不在此列） */
export const SIZE_PRESETS: Record<
  Exclude<SizePreset, 'fit' | 'custom'>,
  { width: number; height: number }
> = {
  '800x600': { width: 800, height: 600 },
  '1280x720': { width: 1280, height: 720 },
  '1920x1080': { width: 1920, height: 1080 },
};

/* ----------------------------- 数值工具 ----------------------------- */

/** 画笔尺寸钳制（保留原导出：默认区间 1~32） */
export function clampBrushSize(n: number, min = BRUSH_MIN, max = BRUSH_MAX): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 任意区间取整钳制 */
export function clampInt(n: number, min: number, max: number, fallback = min): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 0~1 钳制（不透明度） */
export function clampUnit(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

/** 给颜色加上不透明度，输出 canvas 可直接使用的 rgba / #rrggbbaa */
export function withAlpha(color: string, opacity: number): string {
  const alpha = clampUnit(opacity);
  const hex = color.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}${alphaHex(alpha)}`;
  }
  const full = /^#([0-9a-f]{6})$/i.exec(hex);
  if (full) return `${full[0]}${alphaHex(alpha)}`;
  // rgb() / 颜色名等：交给浏览器解析，失败时退回原色
  return parseToRgba(hex, alpha);
}

function alphaHex(alpha: number): string {
  const value = Math.round(alpha * 255);
  return value.toString(16).padStart(2, '0');
}

/** rgb() / 英文色名 → rgba()；无法解析时原样返回 */
function parseToRgba(color: string, alpha: number): string {
  if (typeof document === 'undefined') return color;
  const probe = document.createElement('canvas').getContext('2d');
  if (!probe) return color;
  probe.fillStyle = '#000000';
  probe.fillStyle = color;
  if (probe.fillStyle === '#000000' && color !== '#000000') return color;
  const value = probe.fillStyle;
  if (!/^#[0-9a-f]{6}$/i.test(value)) return color;
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ----------------------------- 几何工具 ----------------------------- */

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 距离足够才采样 */
export function shouldSample(prev: Point, next: Point, min = SAMPLE_MIN_DISTANCE): boolean {
  return distance(prev, next) >= min;
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, p: (a.p + b.p) / 2 };
}

/** 拖拽矩形归一：支持任意方向拖拽；`square` 时取长边 */
export function normalizeRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  square = false,
): { x: number; y: number; w: number; h: number } {
  let w = Math.abs(x1 - x0);
  let h = Math.abs(y1 - y0);
  if (square) {
    const side = Math.max(w, h);
    w = side;
    h = side;
  }
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w, h };
}

/**
 * 压感系数：触控笔按 `pressure` 缩放（轻触也有 0.35 底线），
 * 鼠标 / 触屏统一返回 1（否则浏览器给的 0 或 0.5 会让笔画忽粗忽细）。
 */
export function pressureFactor(pointer: { pressure?: number; pointerType?: string }): number {
  if (pointer.pointerType !== 'pen') return 1;
  const pressure = pointer.pressure ?? 0;
  if (!Number.isFinite(pressure) || pressure <= 0) return 1;
  return clampUnit(0.35 + 0.65 * pressure);
}

/* ----------------------------- 颜色工具 ----------------------------- */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rgb` / `#rrggbb` → RGB；其他格式返回 null */
export function hexToRgb(color: string): Rgb | null {
  const hex = color.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }
  const full = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (full) {
    return { r: parseInt(full[1], 16), g: parseInt(full[2], 16), b: parseInt(full[3], 16) };
  }
  return null;
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (n: number) => clampInt(n, 0, 255, 0).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * 吸管取色：把画布上带 alpha 的像素合成到背景色之上，
 * 得到「肉眼看到的颜色」（画布本身透明，不合成的话取到的是黑色）。
 */
export function compositeOver(pixel: Rgb & { a: number }, backdrop: string): string {
  const bg = hexToRgb(backdrop) ?? { r: 255, g: 255, b: 255 };
  const alpha = clampUnit(pixel.a / 255);
  if (alpha <= 0) return rgbToHex(bg);
  return rgbToHex({
    r: Math.round(pixel.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(pixel.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(pixel.b * alpha + bg.b * (1 - alpha)),
  });
}

/** 取色时的合成底：透明背景在屏幕上显示为白色棋盘格 */
export function backdropOf(kind: BackgroundKind, color: string): string {
  return kind === 'transparent' ? '#ffffff' : color;
}

/* ----------------------------- 缩放工具 ----------------------------- */

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** 在档位表上按方向步进；`current` 落在两档之间时取相邻档 */
export function nextZoom(current: number, direction: 1 | -1): number {
  const value = clampZoom(current);
  const epsilon = 0.001;
  if (direction === 1) {
    const next = ZOOM_STEPS.find((step) => step > value + epsilon);
    return next ?? ZOOM_MAX;
  }
  const prev = [...ZOOM_STEPS].reverse().find((step) => step < value - epsilon);
  return prev ?? ZOOM_MIN;
}

/* ----------------------------- 平移工具 ----------------------------- */

export function translatePoint(point: Point, dx: number, dy: number): Point {
  return { x: point.x + dx, y: point.y + dy, p: point.p };
}

/** 平移单个操作（整体移动时把位移烘焙进坐标，画布坐标系保持唯一真相） */
export function translateOp(op: Op, dx: number, dy: number): Op {
  switch (op.kind) {
    case 'stroke':
      return { ...op, points: op.points.map((point) => translatePoint(point, dx, dy)) };
    case 'line':
    case 'arrow':
      return { ...op, from: translatePoint(op.from, dx, dy), to: translatePoint(op.to, dx, dy) };
    case 'rect':
    case 'ellipse':
      return { ...op, x: op.x + dx, y: op.y + dy };
    case 'polygon':
      return { ...op, points: op.points.map((point) => translatePoint(point, dx, dy)) };
    default:
      return { ...op, x: op.x + dx, y: op.y + dy };
  }
}

export function translateOps(ops: Op[], dx: number, dy: number): Op[] {
  return ops.map((op) => translateOp(op, dx, dy));
}

/* ----------------------------- 场景工具 ----------------------------- */

export function createScene(
  width: number,
  height: number,
  background?: Partial<Background>,
): Scene {
  return {
    width: Math.max(FIT_MIN_WIDTH, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    background: { kind: 'solid', color: '#ffffff', ...background },
    ops: [],
  };
}

/** 坐标保留 1 位小数后再序列化，草稿体积可压掉近一半 */
function roundScene(scene: Scene): Scene {
  const roundOp = (op: Op): Op => {
    const r1 = (n: number) => Math.round(n * 10) / 10;
    switch (op.kind) {
      case 'stroke':
        return {
          ...op,
          width: r1(op.width),
          opacity: Math.round(op.opacity * 100) / 100,
          points: op.points.map((point) => ({
            x: r1(point.x),
            y: r1(point.y),
            p: Math.round(point.p * 100) / 100,
          })),
        };
      case 'line':
      case 'arrow':
        return {
          ...op,
          from: { x: r1(op.from.x), y: r1(op.from.y), p: 1 },
          to: { x: r1(op.to.x), y: r1(op.to.y), p: 1 },
        };
      case 'rect':
      case 'ellipse':
        return { ...op, x: r1(op.x), y: r1(op.y), w: r1(op.w), h: r1(op.h) };
      case 'polygon':
        return {
          ...op,
          points: op.points.map((point) => ({ x: r1(point.x), y: r1(point.y), p: 1 })),
        };
      default:
        return op;
    }
  };
  return { ...scene, ops: scene.ops.map(roundOp) };
}

/** 场景 → JSON；超出预算返回 null（草稿 / URL 内容都不可信且不可膨胀） */
export function serializeScene(scene: Scene, budget = 1_500_000): string | null {
  try {
    const raw = JSON.stringify(roundScene(scene));
    return raw.length > budget ? null : raw;
  } catch {
    return null;
  }
}

const VALID_KINDS: Op['kind'][] = ['stroke', 'line', 'arrow', 'rect', 'ellipse', 'polygon', 'text'];

function isNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parsePoint(value: unknown): Point | null {
  if (!value || typeof value !== 'object') return null;
  const { x, y, p } = value as Record<string, unknown>;
  if (!isNum(x) || !isNum(y)) return null;
  return { x, y, p: isNum(p) ? clampUnit(p) : 1 };
}

function parseOp(value: unknown): Op | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const color = typeof raw.color === 'string' ? raw.color : DEFAULT_COLOR;
  const width = isNum(raw.width) ? clampBrushSize(raw.width) : DEFAULT_WIDTH;
  const opacity = isNum(raw.opacity) ? clampUnit(raw.opacity) : DEFAULT_OPACITY;
  if (raw.kind === 'stroke') {
    const points = Array.isArray(raw.points)
      ? raw.points.map(parsePoint).filter((item): item is Point => item !== null)
      : [];
    if (points.length === 0) return null;
    const mode =
      raw.mode === 'marker' || raw.mode === 'eraser' || raw.mode === 'pen' ? raw.mode : 'pen';
    return { kind: 'stroke', mode, color, width, opacity, points };
  }
  if (raw.kind === 'line' || raw.kind === 'arrow') {
    const from = parsePoint(raw.from);
    const to = parsePoint(raw.to);
    if (!from || !to) return null;
    return { kind: raw.kind, from, to, color, width, opacity };
  }
  if (raw.kind === 'rect' || raw.kind === 'ellipse') {
    if (!isNum(raw.x) || !isNum(raw.y) || !isNum(raw.w) || !isNum(raw.h)) return null;
    return {
      kind: raw.kind,
      x: raw.x,
      y: raw.y,
      w: Math.max(0, raw.w),
      h: Math.max(0, raw.h),
      color,
      width,
      opacity,
      fill: raw.fill === true,
      fillColor: typeof raw.fillColor === 'string' ? raw.fillColor : undefined,
    };
  }
  if (raw.kind === 'polygon') {
    const points = Array.isArray(raw.points)
      ? raw.points.map(parsePoint).filter((item): item is Point => item !== null)
      : [];
    if (points.length < 2) return null;
    return {
      kind: 'polygon',
      points,
      color,
      width,
      opacity,
      fill: raw.fill === true,
      fillColor: typeof raw.fillColor === 'string' ? raw.fillColor : undefined,
    };
  }
  if (raw.kind === 'text') {
    if (!isNum(raw.x) || !isNum(raw.y) || typeof raw.text !== 'string') return null;
    return {
      kind: 'text',
      x: raw.x,
      y: raw.y,
      text: raw.text,
      size: isNum(raw.size)
        ? clampInt(raw.size, TEXT_MIN, TEXT_MAX, DEFAULT_TEXT_SIZE)
        : DEFAULT_TEXT_SIZE,
      color,
      opacity,
    };
  }
  return null;
}

/** JSON → 场景：逐字段校验，任何异常都返回 null（草稿内容不可信） */
export function parseScene(raw: string): Scene | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const value = parsed as Record<string, unknown>;
  if (!isNum(value.width) || !isNum(value.height)) return null;
  const backgroundRaw = (value.background ?? {}) as Record<string, unknown>;
  const kind: BackgroundKind =
    backgroundRaw.kind === 'transparent' || backgroundRaw.kind === 'grid'
      ? backgroundRaw.kind
      : 'solid';
  const ops = Array.isArray(value.ops)
    ? value.ops.map(parseOp).filter((op): op is Op => op !== null)
    : [];
  return {
    width: clampInt(value.width, FIT_MIN_WIDTH, 4096, 960),
    height: clampInt(value.height, 1, 4096, 600),
    background: {
      kind,
      color: typeof backgroundRaw.color === 'string' ? backgroundRaw.color : '#ffffff',
    },
    ops: ops.filter((op) => VALID_KINDS.includes(op.kind)),
  };
}
