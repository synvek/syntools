import type { ToolResult } from '@/core/types';
import type {
  Adjustments,
  BlackWhiteParams,
  BlendMode,
  ChannelMixerParams,
  ColorBalanceParams,
  ColorOverlayStyle,
  CurvePoint,
  CurvesParams,
  DropShadowStyle,
  FilterId,
  InnerShadowStyle,
  LayerStyle,
  MeshWarp,
  OuterGlowStyle,
  TextWarpKind,
  ToolId,
  StrokeStyle,
  FilterSpec,
  GroupLayer,
  Guide,
  HistoryEntry,
  HistoryLabel,
  Layer,
  LevelsParams,
  PhotoDoc,
  PhotoFilterParams,
  Rect,
  Selection,
  SelectionKind,
  SelectionPart,
  SelectiveColorParams,
  SelectiveRange,
  ShadowsHighlightsParams,
  ShapeKind,
  ReplaceColorParams,
  VectorMaskRef,
} from './model/types';

/**
 * 纯函数层：不引用 Konva、不触碰 DOM（便于单测，且可被 prerender 安全载入）。
 * 需要落盘 / 报错的校验统一返回 `ToolResult<T>`，错误码文案见 `strings.ts` 的 `err.*`。
 */

export const MIN_CANVAS_SIZE = 16;
export const MAX_CANVAS_SIZE = 4096;
export const MIN_BRUSH = 1;
export const MAX_BRUSH = 400;
export const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB
export const MAX_PROJECT_BYTES = 60 * 1024 * 1024; // 60MB
/** PSD 导入上限：多图层工程文件常远超普通图片 */
export const MAX_PSD_BYTES = 128 * 1024 * 1024; // 128MB

export interface CanvasPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

/**
 * 常用画布预设：正方形 / 横版 / 竖版 / 纸张。
 * 标签只用「数字 + 比例 + 纸张代号」，不含自然语言，因此无需翻译
 * （文案见 `CanvasPreset.label`，其余枚举的名字统一由 UI 走 i18n，见 `blend.*` / `shape.*`）。
 */
export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'hd', label: '1280 × 720 · 16:9', width: 1280, height: 720 },
  { id: 'square', label: '1080 × 1080 · 1:1', width: 1080, height: 1080 },
  { id: 'photo43', label: '1024 × 768 · 4:3', width: 1024, height: 768 },
  { id: 'portrait', label: '1080 × 1350 · 4:5', width: 1080, height: 1350 },
  { id: 'a4', label: 'A4 · 2480 × 3508', width: 2480, height: 3508 },
];

/** 混合模式：只声明 id，名称由 UI 通过 `tools.photo.blend.<id>` 取当前语言 */
export const BLEND_MODES: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'soft-light',
  'hard-light',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];

/** 滤镜：只声明 id，名称与说明由 UI 通过 `tools.photo.filter*` / `hint*` 取当前语言 */
export const FILTERS: FilterId[] = [
  'grayscale',
  'sepia',
  'invert',
  'blur',
  'gaussianBlur',
  'motionBlur',
  'sharpen',
  'unsharp',
  'emboss',
  'edge',
  'noise',
  'pixelate',
  'posterize',
  // 扭曲
  'twirl',
  'spherize',
  'pinch',
  // 风格化
  'findEdges',
  'traceContour',
  // 渲染
  'clouds',
  'lensFlare',
  // 降噪
  'reduceNoise',
];

/**
 * 滤镜分组（面板按组展示）。
 *
 * 滤镜从 13 个扩到 21 个后，平铺的两列卡片已经难以扫视；分组顺序对齐 Photoshop 的菜单层级。
 */
export const FILTER_GROUPS: { id: string; items: FilterId[] }[] = [
  {
    id: 'basic',
    items: ['grayscale', 'sepia', 'invert', 'noise', 'pixelate', 'posterize'],
  },
  { id: 'blur', items: ['blur', 'gaussianBlur', 'motionBlur', 'reduceNoise'] },
  { id: 'sharpen', items: ['sharpen', 'unsharp'] },
  { id: 'stylize', items: ['emboss', 'edge', 'findEdges', 'traceContour'] },
  { id: 'distort', items: ['twirl', 'spherize', 'pinch'] },
  { id: 'render', items: ['clouds', 'lensFlare'] },
];

/** 滤镜参数描述：UI 据此生成滑杆（标签走 `tools.photo.<label>`） */
export interface FilterParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  default: number;
}

export const FILTER_PARAMS: Record<FilterId, FilterParamSpec[]> = {
  grayscale: [],
  sepia: [],
  invert: [],
  blur: [{ key: 'radius', label: 'paramRadius', min: 1, max: 40, default: 4 }],
  gaussianBlur: [{ key: 'radius', label: 'paramRadius', min: 0, max: 60, default: 6 }],
  motionBlur: [
    { key: 'angle', label: 'paramAngle', min: 0, max: 359, default: 0 },
    { key: 'distance', label: 'paramDistance', min: 2, max: 80, default: 12 },
  ],
  sharpen: [{ key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 50 }],
  unsharp: [
    { key: 'radius', label: 'paramRadius', min: 1, max: 20, default: 2 },
    { key: 'amount', label: 'paramAmount', min: 0, max: 200, default: 80 },
  ],
  emboss: [{ key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 100 }],
  edge: [],
  noise: [
    { key: 'amount', label: 'paramAmount', min: 0, max: 128, default: 24 },
    { key: 'mono', label: 'paramMono', min: 0, max: 1, step: 1, default: 1 },
  ],
  pixelate: [{ key: 'block', label: 'paramBlock', min: 2, max: 64, default: 8 }],
  posterize: [{ key: 'levels', label: 'paramLevels', min: 2, max: 16, default: 4 }],
  twirl: [{ key: 'angle', label: 'paramAngle', min: -360, max: 360, default: 90 }],
  spherize: [{ key: 'amount', label: 'paramAmount', min: -100, max: 100, default: 60 }],
  pinch: [{ key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 50 }],
  findEdges: [],
  traceContour: [{ key: 'level', label: 'paramLevel', min: 0, max: 255, default: 128 }],
  clouds: [
    { key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 70 },
    { key: 'size', label: 'paramSize', min: 2, max: 60, default: 16 },
  ],
  lensFlare: [
    { key: 'amount', label: 'paramAmount', min: 0, max: 200, default: 80 },
    { key: 'size', label: 'paramSize', min: 10, max: 100, default: 40 },
    { key: 'x', label: 'paramX', min: 0, max: 100, default: 70 },
    { key: 'y', label: 'paramY', min: 0, max: 100, default: 30 },
  ],
  reduceNoise: [
    { key: 'amount', label: 'paramAmount', min: 0, max: 100, default: 70 },
    { key: 'radius', label: 'paramRadius', min: 1, max: 3, default: 1 },
  ],
};

/** 滤镜默认参数（新建滤镜实例时写入） */
export function defaultFilterParams(id: FilterId): Record<string, number> {
  const out: Record<string, number> = {};
  for (const spec of FILTER_PARAMS[id]) out[spec.key] = spec.default;
  return out;
}

/** 读取滤镜参数：缺失 / 非法值回落到该参数的默认值 */
export function filterParam(spec: FilterSpec, key: string): number {
  const value = spec.params?.[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return FILTER_PARAMS[spec.id].find((item) => item.key === key)?.default ?? 0;
}

/** CSS `filter` 能直接表达的滤镜（其余走像素通道） */
const CSS_FILTERS: FilterId[] = ['grayscale', 'sepia', 'invert', 'blur', 'gaussianBlur'];

export function isCssFilter(id: FilterId): boolean {
  return CSS_FILTERS.includes(id);
}

/** 形状：只声明 id，名称由 UI 通过 `tools.photo.shape.<id>` 取当前语言 */
export const SHAPE_KINDS: ShapeKind[] = ['rect', 'roundRect', 'ellipse', 'line', 'arrow', 'star'];

/* ------------------------------ 标尺刻度 ------------------------------ */

/** 标尺候选步长（像素）：取「乘以缩放后 ≥ 最小间距」的第一个，保证刻度不挤在一起 */
const RULER_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];

export interface RulerTick {
  /** 屏幕坐标（相对画布宿主左上角） */
  screen: number;
  /** 文档坐标 */
  doc: number;
  label: string;
}

/**
 * 计算标尺刻度：`offset` 为视口平移（屏幕像素），`scale` 为缩放比。
 * 纯函数（可单测）：只做「文档坐标 → 屏幕坐标」的映射与步长选择。
 */
export function rulerTicks(
  scale: number,
  offset: number,
  length: number,
  minGap = 56,
): RulerTick[] {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const step =
    RULER_STEPS.find((value) => value * s >= minGap) ?? RULER_STEPS[RULER_STEPS.length - 1];
  const firstDoc = Math.ceil((0 - offset) / s / step) * step;
  const lastDoc = (length - offset) / s;
  const ticks: RulerTick[] = [];
  for (let doc = firstDoc; doc <= lastDoc; doc += step) {
    ticks.push({ screen: offset + doc * s, doc, label: String(Math.round(doc)) });
    if (ticks.length > 500) break;
  }
  return ticks;
}

/** 数值钳制：非法值回落到 min（与 doodle-board 的 clampBrushSize 一致） */
export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampBrushSize(value: number): number {
  return Math.round(clampNumber(value, MIN_BRUSH, MAX_BRUSH));
}

/* ------------------------------ 笔刷 / 绘制 ------------------------------ */

/** 笔刷间距（相对直径的比例）：0.02 近似连续，>1 出现明显间隔 */
export const MIN_SPACING = 0.02;
export const MAX_SPACING = 2;

export function clampSpacing(value: number): number {
  if (!Number.isFinite(value)) return 0.1;
  return Math.min(MAX_SPACING, Math.max(MIN_SPACING, value));
}

/**
 * 间距足够小（≤ 5%）时用「连续线段」描边，否则按间距逐个盖章。
 * 阈值存在的意义：连续线段更快且边缘更平滑，而大间距必须盖章才能体现「点」的质感。
 */
export const SPACING_LINE_THRESHOLD = 0.05;

/** 笔刷预设：一组可复用的画笔参数 */
export interface BrushPreset {
  id: string;
  /** 内置预设有 i18n 名（`tools.photo.preset<Id>`）；自定义预设自带名字 */
  name?: string;
  size: number;
  hardness: number;
  opacity: number;
  spacing: number;
}

export const DEFAULT_BRUSH_PRESETS: BrushPreset[] = [
  { id: 'hardRound', size: 12, hardness: 1, opacity: 1, spacing: 0.1 },
  { id: 'softRound', size: 40, hardness: 0.15, opacity: 0.6, spacing: 0.15 },
  { id: 'pencil', size: 2, hardness: 1, opacity: 1, spacing: 0.05 },
  { id: 'marker', size: 24, hardness: 0.8, opacity: 0.9, spacing: 0.08 },
  { id: 'spray', size: 60, hardness: 0, opacity: 0.25, spacing: 0.4 },
];

/** 预设归一：丢弃非法项，参数钳制到合法区间 */
export function normalizeBrushPresets(value: unknown): BrushPreset[] {
  if (!Array.isArray(value)) return [];
  const out: BrushPreset[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Partial<BrushPreset>;
    if (typeof raw.id !== 'string' || raw.id.length === 0) continue;
    out.push({
      id: raw.id,
      name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : undefined,
      size: clampBrushSize(Number(raw.size)),
      hardness: clampNumber(Number(raw.hardness), 0, 1),
      opacity: clampNumber(Number(raw.opacity), 0, 1),
      spacing: clampSpacing(Number(raw.spacing)),
    });
    if (out.length >= 24) break;
  }
  return out;
}

/* ------------------------------ 通道 / 取样 / 色板 ------------------------------ */

/** 通道视图：`rgb` = 正常显示，其余为单通道灰度隔离显示（仅影响显示，不改文档） */
export type ChannelView = 'rgb' | 'red' | 'green' | 'blue';
export const CHANNEL_VIEWS: ChannelView[] = ['rgb', 'red', 'green', 'blue'];
/** 可独立隔离的三个颜色通道 */
export const COLOR_CHANNELS: Exclude<ChannelView, 'rgb'>[] = ['red', 'green', 'blue'];

/** 颜色取样器最多保留的取样点数（与 Photoshop 一致） */
export const MAX_SAMPLES = 4;

export interface SamplePoint {
  /** 文档坐标（取整后的像素中心） */
  x: number;
  y: number;
  /** `#RRGGBB` */
  hex: string;
  /** 0~255：透明像素提示用 */
  alpha: number;
}

/** 调色板默认容量 */
export const PALETTE_SIZE = 8;
/** 提取调色板时的量化精度（每通道右移的位数）：4 bit → 4096 个颜色桶 */
const PALETTE_QUANTIZE_SHIFT = 4;

/**
 * 单通道隔离：把 RGBA 数据就地替换为该通道的灰度。
 *
 * 与 Photoshop 的「单通道视图」一致——只看该通道的明暗，因此三个通道都按灰度呈现，
 * 而不是把 R 通道显示成红色。
 */
export function extractChannelData(
  data: Uint8ClampedArray,
  channel: Exclude<ChannelView, 'rgb'>,
): void {
  const offset = channel === 'red' ? 0 : channel === 'green' ? 1 : 2;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i + offset];
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

/**
 * 二值蒙版 → 选区轮廓（扫描线法）。
 *
 * 逐行找出「值 ≥ threshold」的连续区段，每段输出一个矩形轮廓作为**并集**加入选区。
 * 得到的是阶梯状（块状）选区——这正是扫描线法的固有精度，换来的是零依赖与线性复杂度；
 * 用它把「快速蒙版 / 通道」转成可继续运算的选区，比引入轮廓追踪（marching squares）划算。
 *
 * `source` 决定取哪个量作为判据：
 * - `luma`（默认）：亮度 —— 通道图、灰度蒙版（白=选中、黑=未选中）用；
 * - `alpha`：不透明度 —— alpha 蒙版（透明=未选中）用。
 */
export function maskRunsToParts(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 128,
  source: 'luma' | 'alpha' = 'luma',
): SelectionPart[] {
  const parts: SelectionPart[] = [];
  const rect = (x0: number, y0: number, x1: number, y1: number): number[] => [
    x0,
    y0,
    x1,
    y0,
    x1,
    y1,
    x0,
    y1,
  ];
  for (let y = 0; y < height; y += 1) {
    let start = -1;
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value =
        source === 'alpha'
          ? data[offset + 3]
          : data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
      const on = value >= threshold;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        parts.push({ path: rect(start, y, x, y + 1), add: true });
        start = -1;
      }
    }
    if (start >= 0) parts.push({ path: rect(start, y, width, y + 1), add: true });
    // 轮廓数量保护：极端噪点蒙版会产出海量矩形，截断并交由调用方提示
    if (parts.length >= MAX_VECTOR_CONTOURS * 8) return parts;
  }
  return parts;
}

/** 由扫描线矩形并集反推选区外接框（矩形并集的包围盒） */
export function partsBounds(parts: SelectionPart[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const part of parts) {
    const path = part.path;
    for (let i = 0; i < path.length; i += 2) {
      minX = Math.min(minX, path[i]);
      maxX = Math.max(maxX, path[i]);
      minY = Math.min(minY, path[i + 1]);
      maxY = Math.max(maxY, path[i + 1]);
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 快速蒙版 / 通道载入选区时的亮度阈值：白（≥128）视为选中 */
export const MASK_SELECTION_THRESHOLD = 128;

/**
 * 灰度蒙版 → 选区（白 = 选中、黑 = 未选中）。
 *
 * 快速蒙版退出与「载入通道为选区」共用：两者都是「一张灰度图 → 可继续运算的选区」。
 */
export function selectionFromMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = MASK_SELECTION_THRESHOLD,
): Selection | null {
  return selectionFromParts(maskRunsToParts(data, width, height, threshold, 'luma'));
}

/** 由扫描线轮廓组装选区（快速蒙版 / 通道 → 选区统一走这里） */
export function selectionFromParts(parts: SelectionPart[]): Selection | null {
  const usable = parts.filter((part) => part.path.length >= 6);
  if (usable.length === 0) return null;
  const bounds = partsBounds(usable);
  return {
    kind: 'lasso',
    x: bounds.x,
    y: bounds.y,
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height),
    path: [],
    feather: 0,
    // 第一段作为主轮廓，其余作为并集追加（nonzero 填充下等价于矩形并集）
    parts: usable.map((part, index) => ({ path: part.path, add: index === 0 ? true : part.add })),
  };
}

/**
 * 从像素数据提取调色板（主色）。
 *
 * 做法：按 `PALETTE_QUANTIZE_SHIFT` 位量化分桶 → 统计各桶的像素数与颜色和 → 取像素数最多的若干桶的平均色，
 * 再按「与已选颜色的最小距离」做一次去重，避免同色系重复占位。
 * 半透明以下的像素直接跳过（透明区域的 RGB 多为 0，会把黑色顶进色板）。
 */
export function extractPalette(data: Uint8ClampedArray, count = PALETTE_SIZE): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const shift = PALETTE_QUANTIZE_SHIFT;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = ((r >> shift) << 8) | ((g >> shift) << 4) | (b >> shift);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { n: 1, r, g, b });
    }
  }
  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, count * 4)
    .map((bucket) => rgbToHex(bucket.r / bucket.n, bucket.g / bucket.n, bucket.b / bucket.n));

  const picked: string[] = [];
  for (const hex of ranked) {
    if (picked.length >= count) break;
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    if (picked.every((existing) => colorDistance(existing, rgb) > 40)) picked.push(hex);
  }
  return picked;
}

/** 两个颜色的欧氏距离（0~441），用于调色板去重（`hexToRgb` 在文件后部的颜色工具区） */
function colorDistance(hex: string, rgb: { r: number; g: number; b: number }): number {
  const parsed = hexToRgb(hex);
  if (!parsed) return 0;
  return Math.hypot(parsed.r - rgb.r, parsed.g - rgb.g, parsed.b - rgb.b);
}

/* ------------------------------ 旋转视图 ------------------------------ */

/** 旋转视图的步进（度）：菜单按 15° 递进，与 Photoshop 的预设一致 */
export const VIEW_ROTATION_STEP = 15;

/** 视角归一化到 (-180, 180]：避免反复旋转后累出 ±1000° 这类无意义数值 */
export function normalizeViewRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  let value = degrees % 360;
  if (value > 180) value -= 360;
  if (value <= -180) value += 360;
  return Math.round(value * 100) / 100;
}

/** 视口中心：旋转与缩放的共同锚点 */
export function viewCenter(size: { width: number; height: number }): { x: number; y: number } {
  return { x: size.width / 2, y: size.height / 2 };
}

function rotate(px: number, py: number, radians: number): { x: number; y: number } {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: px * cos - py * sin, y: px * sin + py * cos };
}

/**
 * 视口平移量（未旋转）→ Konva 图层位置。
 *
 * 语义：`viewport.x / y` 始终表示**未旋转**时的文档左上角屏幕位置（滚动条、滚动、适配都按它计算），
 * 旋转则围绕视口中心施加。Konva 的节点变换是「先缩放旋转再平移」，因此位置必须是旋转后的结果：
 * `P = C + R(θ)·(t − C)`。
 */
export function stagePosition(
  viewport: { x: number; y: number },
  size: { width: number; height: number },
  rotationDegrees: number,
): { x: number; y: number } {
  if (!rotationDegrees) return { x: viewport.x, y: viewport.y };
  const center = viewCenter(size);
  const offset = rotate(
    viewport.x - center.x,
    viewport.y - center.y,
    (rotationDegrees * Math.PI) / 180,
  );
  return { x: center.x + offset.x, y: center.y + offset.y };
}

/** 文档坐标 → 屏幕坐标（含旋转视图） */
export function docToScreen(
  point: { x: number; y: number },
  viewport: { x: number; y: number; scale: number },
  size: { width: number; height: number },
  rotationDegrees: number,
): { x: number; y: number } {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const center = viewCenter(size);
  const local = rotate(
    viewport.x + point.x * scale - center.x,
    viewport.y + point.y * scale - center.y,
    (rotationDegrees * Math.PI) / 180,
  );
  return { x: center.x + local.x, y: center.y + local.y };
}

/** 屏幕坐标 → 文档坐标（含旋转视图）；与 `docToScreen` 互为逆运算 */
export function screenToDoc(
  point: { x: number; y: number },
  viewport: { x: number; y: number; scale: number },
  size: { width: number; height: number },
  rotationDegrees: number,
): { x: number; y: number } {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const center = viewCenter(size);
  const local = rotate(point.x - center.x, point.y - center.y, (-rotationDegrees * Math.PI) / 180);
  // 反解：R(−θ)(screen − C) = v + p·s − C  →  p = (C + R(−θ)(screen − C) − v) / s
  return {
    x: (center.x + local.x - viewport.x) / scale,
    y: (center.y + local.y - viewport.y) / scale,
  };
}

/** 旋转后的文档外接框尺寸（适配与钳制都按它计算，否则旋转会把画布裁掉） */
export function rotatedDocBounds(
  doc: { width: number; height: number },
  rotationDegrees: number,
): { width: number; height: number } {
  if (!rotationDegrees) return { width: doc.width, height: doc.height };
  const radians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: doc.width * cos + doc.height * sin,
    height: doc.width * sin + doc.height * cos,
  };
}

/* ------------------------------ 对齐吸附（智能参考线） ------------------------------ */

/** 吸附判定阈值（屏幕像素）：换算到文档单位时要除以当前缩放 */
export const SNAP_THRESHOLD_PX = 6;

/** 吸附候选线（文档坐标） */
export interface SnapTargets {
  /** 竖直候选线：吸附 x */
  vertical: number[];
  /** 水平候选线：吸附 y */
  horizontal: number[];
}

/** 正在生效的吸附参考线（画在覆盖层上） */
export interface SnapGuide {
  /** `x` = 竖直参考线（由 x 吸附产生），`y` = 水平参考线 */
  axis: 'x' | 'y';
  /** 文档坐标 */
  position: number;
}

export interface SnapOutcome {
  x: number;
  y: number;
  guides: SnapGuide[];
}

/**
 * 收集吸附候选线。
 *
 * 来源与 Photoshop 的「对齐」一致：画布边界与中心、其它可见图层的边界与中心、已有参考线；
 * 网格线不预先展开（数量随尺寸爆炸），而是在判定时按当前值就近取整。
 */
export function collectSnapTargets(
  doc: PhotoDoc,
  options: { excludeLayerId?: string | null; guides?: readonly Guide[] } = {},
): SnapTargets {
  const vertical = [0, doc.width / 2, doc.width];
  const horizontal = [0, doc.height / 2, doc.height];
  for (const layer of doc.layers) {
    if (layer.id === options.excludeLayerId || !layer.visible) continue;
    vertical.push(layer.x, layer.x + layer.width / 2, layer.x + layer.width);
    horizontal.push(layer.y, layer.y + layer.height / 2, layer.y + layer.height);
  }
  for (const guide of options.guides ?? []) {
    if (guide.axis === 'v') vertical.push(guide.pos);
    else horizontal.push(guide.pos);
  }
  return { vertical, horizontal };
}

/**
 * 拖拽中的吸附：把盒子位置吸到最近的候选线上。
 *
 * 判定用的是「盒子自己的三条线」（左 / 中 / 右，上 / 中 / 下）与候选线的最近距离，
 * 因此拖到与另一个图层左对齐、居中对齐、右对齐都能吸住 —— 这正是参考线要解决的问题。
 */
export function snapBoxPosition(
  box: { x: number; y: number; width: number; height: number },
  targets: SnapTargets,
  threshold: number,
  options: { enabled?: boolean; gridSize?: number } = {},
): SnapOutcome {
  if (options.enabled === false || threshold <= 0) {
    return { x: box.x, y: box.y, guides: [] };
  }
  const gridSize = options.gridSize && options.gridSize > 0 ? options.gridSize : 0;
  const nearest = (values: number[], candidates: readonly number[]) => {
    let best: { delta: number; position: number } | null = null;
    const consider = (candidate: number, value: number) => {
      const delta = candidate - value;
      if (Math.abs(delta) > threshold) return;
      if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, position: candidate };
    };
    for (const value of values) {
      for (const candidate of candidates) consider(candidate, value);
    }
    // 网格只吸「左上角」：三条线都参与的话，小图层的中心线会赢过左上角，
    // 结果图层停在离网格半格的位置上，看起来像没对齐
    if (gridSize > 0 && values.length > 0) {
      consider(Math.round(values[0] / gridSize) * gridSize, values[0]);
    }
    return best as { delta: number; position: number } | null;
  };

  const horizontal = nearest([box.x, box.x + box.width / 2, box.x + box.width], targets.vertical);
  const vertical = nearest([box.y, box.y + box.height / 2, box.y + box.height], targets.horizontal);
  const guides: SnapGuide[] = [];
  if (horizontal) guides.push({ axis: 'x', position: horizontal.position });
  if (vertical) guides.push({ axis: 'y', position: vertical.position });
  return {
    x: box.x + (horizontal?.delta ?? 0),
    y: box.y + (vertical?.delta ?? 0),
    guides,
  };
}

/* ------------------------------ 印章步进 / 润饰族 ------------------------------ */

/** 润饰工具族（沿笔迹逐印章作用的一类工具） */
export type RepairTool =
  'cloneStamp' | 'healing' | 'spotHeal' | 'smudge' | 'blurBrush' | 'sharpenBrush';

export const REPAIR_TOOLS: RepairTool[] = [
  'cloneStamp',
  'healing',
  'spotHeal',
  'smudge',
  'blurBrush',
  'sharpenBrush',
];

/** 需要「Alt + 点击取样」的修复类工具 */
export function needsCloneSource(tool: ToolId): boolean {
  return tool === 'cloneStamp' || tool === 'healing';
}

/** 印章间距（相对直径）：涂抹 / 模糊这类要连续，间距比减淡加深更小 */
export const REPAIR_SPACING = 0.15;
/** 单次 pointermove 的印章上限：防止异常跳点造成海量绘制 */
export const MAX_STAMPS_PER_MOVE = 4096;

export interface StampStep {
  /** 本次该盖章的位置（含起点之间的插值） */
  positions: { x: number; y: number }[];
  /** 供下一次调用使用的「距下一枚印章还需前进的距离」 */
  next: number;
}

/**
 * 沿「上一点 → 当前点」插值出所有该盖章的位置（纯函数）。
 *
 * 抽出来的原因：图章 / 修复 / 涂抹 / 模糊锐化 / 减淡加深五类工具共用同一套步进逻辑，
 * 各写一遍时只要有人写错累积量，就会表现为「走得快时印章变稀」这种极难复现的差异。
 */
export function walkStamps(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  step: number,
  travelled: number,
): StampStep {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return { positions: [], next: travelled };
  const ux = dx / distance;
  const uy = dy / distance;
  const positions: { x: number; y: number }[] = [];
  let walked = travelled;
  while (walked <= distance && positions.length < MAX_STAMPS_PER_MOVE) {
    positions.push({ x: fromX + ux * walked, y: fromY + uy * walked });
    walked += step;
  }
  return { positions, next: Math.max(0, walked - distance) };
}

/** 印章的边缘衰减：中心 1 → 边缘 0（平方衰减，视觉上比线性更接近柔边笔刷） */
export function stampFalloff(distance: number): number {
  if (distance >= 1) return 0;
  const value = 1 - distance;
  return value * value;
}

/**
 * 修复取色：把「源区均值」平移到「目标区均值」所需的分量增量。
 *
 * 修复画笔要的是「保留源的纹理、匹配目标的颜色」，因此复制像素时加上这个增量。
 */
export function healOffset(
  sourceMean: readonly number[],
  targetMean: readonly number[],
): [number, number, number] {
  return [
    (targetMean[0] ?? 0) - (sourceMean[0] ?? 0),
    (targetMean[1] ?? 0) - (sourceMean[1] ?? 0),
    (targetMean[2] ?? 0) - (sourceMean[2] ?? 0),
  ];
}

/** 单通道混合：`value` 向 `target` 靠拢 `weight` 比例 */
export function mixChannel(value: number, target: number, weight: number): number {
  const amount = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0;
  return value + (target - value) * amount;
}

/* ------------------------------ 网格变形（透视 / 扭曲 / 斜切 / 变形） ------------------------------ */

/** 自由变换家族的四种模式（`free` = 常规自由变换） */
export type TransformMode = 'free' | 'perspective' | 'distort' | 'skew' | 'warp';
export const TRANSFORM_MODES: TransformMode[] = ['free', 'perspective', 'distort', 'skew', 'warp'];

/** 控制点位移上限（相对图层宽 / 高）：限制在 ±50%，避免把图层拖到无法收拾 */
export const MAX_MESH_OFFSET = 0.5;
/** 变形（Warp）的网格规模：4×4 = 16 个控制点，与 Photoshop 一致 */
export const WARP_COLS = 4;
export const WARP_ROWS = 4;

export function clampMeshOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_MESH_OFFSET, Math.max(-MAX_MESH_OFFSET, value));
}

/** 全零网格（未变形） */
export function createMesh(cols: number, rows: number): MeshWarp {
  return { cols, rows, points: new Array(cols * rows * 2).fill(0) };
}

/** 四角网格：透视 / 扭曲 / 斜切共用同一存储，差异只在交互约束 */
export function createQuadMesh(): MeshWarp {
  return createMesh(2, 2);
}

export function meshIsIdentity(mesh?: MeshWarp | null): boolean {
  if (!mesh) return true;
  if (mesh.cols < 2 || mesh.rows < 2) return true;
  if (mesh.points.length !== mesh.cols * mesh.rows * 2) return true;
  return mesh.points.every((value) => value === 0);
}

/**
 * 校验 / 归一化外部网格（迁移与导入入口共用）。
 * 只接受 2×2（四角）与 4×4（变形）两种规模 —— 其它规模没有对应的交互实现，宁可丢弃也不留半成品数据。
 * 全零网格直接返回 undefined：数据里不该存在「等价于没有变形」的网格。
 */
export function normalizeMesh(value: unknown): MeshWarp | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Partial<MeshWarp>;
  const cols = Math.round(Number(raw.cols));
  const rows = Math.round(Number(raw.rows));
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return undefined;
  if (!((cols === 2 && rows === 2) || (cols === WARP_COLS && rows === WARP_ROWS))) return undefined;
  if (!Array.isArray(raw.points) || raw.points.length !== cols * rows * 2) return undefined;
  const mesh: MeshWarp = {
    cols,
    rows,
    points: raw.points.map((item) => clampMeshOffset(Number(item) || 0)),
  };
  return meshIsIdentity(mesh) ? undefined : mesh;
}

/**
 * 网格变形需要的额外留白（像素）：按位移场的最大绝对值估算。
 *
 * 用途：合成缓冲（蒙版 / 图层样式）与变形位图都要按此扩张，否则被甩出盒子的内容会被裁掉。
 */
export function meshPadding(
  mesh: MeshWarp | null | undefined,
  width: number,
  height: number,
): number {
  if (meshIsIdentity(mesh)) return 0;
  const grid = mesh as MeshWarp;
  let maxDx = 0;
  let maxDy = 0;
  for (let index = 0; index < grid.points.length; index += 2) {
    maxDx = Math.max(maxDx, Math.abs(grid.points[index] ?? 0));
    maxDy = Math.max(maxDy, Math.abs(grid.points[index + 1] ?? 0));
  }
  return Math.ceil(Math.max(maxDx * width, maxDy * height));
}

/** 缓存签名（渲染据此决定是否重建位图） */
export function meshSignature(mesh?: MeshWarp | null): string {
  if (meshIsIdentity(mesh)) return '';
  const value = mesh as MeshWarp;
  return `${value.cols}x${value.rows}:${value.points.map((item) => item.toFixed(4)).join(',')}`;
}

/** 控制点在「未变形盒子」中的归一化位置（行优先） */
function meshBaseParam(mesh: MeshWarp, index: number): { u: number; v: number } {
  const col = index % mesh.cols;
  const row = Math.floor(index / mesh.cols);
  return { u: col / (mesh.cols - 1), v: row / (mesh.rows - 1) };
}

export interface MeshControlPoint {
  col: number;
  row: number;
  /** 当前控制点（含变形位移） */
  x: number;
  y: number;
  /** 未变形时的位置（画网格参照线要用） */
  baseX: number;
  baseY: number;
}

/**
 * 控制点的文档坐标。
 *
 * `rotated` 决定是否叠加图层旋转：**覆盖层（Konva 覆盖层不带旋转）必须传 true**，
 * 而 Canvas2D 绘制路径外层已经施加过旋转，必须传 false，否则会转两次。
 */
export function meshControlPoints(
  mesh: MeshWarp,
  box: LayerBox,
  rotated = true,
): MeshControlPoint[] {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const rad = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const place = (x: number, y: number) => {
    if (!rotated) return { x, y };
    const dx = x - centerX;
    const dy = y - centerY;
    return { x: centerX + dx * cos - dy * sin, y: centerY + dx * sin + dy * cos };
  };
  const out: MeshControlPoint[] = [];
  for (let index = 0; index < mesh.cols * mesh.rows; index += 1) {
    const { u, v } = meshBaseParam(mesh, index);
    const baseX = box.x + u * box.width;
    const baseY = box.y + v * box.height;
    const x = baseX + (mesh.points[index * 2] ?? 0) * box.width;
    const y = baseY + (mesh.points[index * 2 + 1] ?? 0) * box.height;
    const point = place(x, y);
    const base = place(baseX, baseY);
    out.push({
      col: index % mesh.cols,
      row: Math.floor(index / mesh.cols),
      x: point.x,
      y: point.y,
      baseX: base.x,
      baseY: base.y,
    });
  }
  return out;
}

/**
 * 文档点 → 盒内归一化坐标（u, v ∈ [0,1]，未变形参照系）。
 * 与 `meshControlPoints(rotated = true)` 配套：把指针位置换算成控制点参数。
 */
export function meshParamAt(
  box: LayerBox,
  px: number,
  py: number,
  rotated = true,
): { u: number; v: number } {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  let dx = px - centerX;
  let dy = py - centerY;
  if (rotated) {
    const rad = (-box.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    dx = rx;
    dy = ry;
  }
  return {
    u: dx / Math.max(1, box.width) + 0.5,
    v: dy / Math.max(1, box.height) + 0.5,
  };
}

/**
 * 拖动控制点后的新网格。
 *
 * 四种模式的差异全部收敛在这个纯函数里（便于单测）：
 * - `distort`：拖哪个点动哪个点；
 * - `perspective`：拖角点时，另两个相邻角点沿各自所在边同步平移 → 得到标准梯形；
 * - `skew`：拖边中点时整条边的两个端点同向平移 → 剪切；
 * - `warp`：任意控制点自由移动。
 */
export function dragMeshPoint(
  mesh: MeshWarp,
  index: number,
  u: number,
  v: number,
  mode: TransformMode,
): MeshWarp {
  if (index < 0 || index >= mesh.cols * mesh.rows) return mesh;
  const { u: u0, v: v0 } = meshBaseParam(mesh, index);
  const du = clampMeshOffset(u - u0);
  const dv = clampMeshOffset(v - v0);
  const col = index % mesh.cols;
  const row = Math.floor(index / mesh.cols);
  const points = mesh.points.slice();
  const set = (targetCol: number, targetRow: number, ox: number, oy: number) => {
    const target = targetRow * mesh.cols + targetCol;
    points[target * 2] = clampMeshOffset(ox);
    points[target * 2 + 1] = clampMeshOffset(oy);
  };
  set(col, row, du, dv);

  if (mode === 'perspective') {
    // 相邻点只继承「沿各自边」的那一维位移：横边借 dx、纵边借 dy
    set(mesh.cols - 1 - col, row, du, 0);
    set(col, mesh.rows - 1 - row, 0, dv);
  }
  return { ...mesh, points };
}

export type MeshEdge = 'top' | 'bottom' | 'left' | 'right';

/**
 * 拖动边线后的新网格（斜切）：整条边的端点同向平移。
 *
 * 与「拖角点」互补 —— 斜切要的是剪切（整条边平移），而 2×2 网格里没有边中点可拖，
 * 因此把边本身作为可拖对象。
 */
export function dragMeshEdge(mesh: MeshWarp, edge: MeshEdge, du: number, dv: number): MeshWarp {
  const points = mesh.points.slice();
  const lastCol = mesh.cols - 1;
  const lastRow = mesh.rows - 1;
  const targets: number[] =
    edge === 'top'
      ? Array.from({ length: mesh.cols }, (_, col) => col)
      : edge === 'bottom'
        ? Array.from({ length: mesh.cols }, (_, col) => lastRow * mesh.cols + col)
        : edge === 'left'
          ? Array.from({ length: mesh.rows }, (_, row) => row * mesh.cols)
          : Array.from({ length: mesh.rows }, (_, row) => row * mesh.cols + lastCol);
  for (const index of targets) {
    points[index * 2] = clampMeshOffset((mesh.points[index * 2] ?? 0) + du);
    points[index * 2 + 1] = clampMeshOffset((mesh.points[index * 2 + 1] ?? 0) + dv);
  }
  return { ...mesh, points };
}

/** 命中哪条边（容差按盒内归一化坐标给出）；都不命中返回 null */
export function meshEdgeAt(
  u: number,
  v: number,
  toleranceU: number,
  toleranceV: number,
): MeshEdge | null {
  if (v <= toleranceV) return 'top';
  if (v >= 1 - toleranceV) return 'bottom';
  if (u <= toleranceU) return 'left';
  if (u >= 1 - toleranceU) return 'right';
  return null;
}

/** 网格覆盖层状态（纯数据，`render/overlays.ts` 只负责画） */
export interface MeshGridState {
  cols: number;
  rows: number;
  /** 行优先的控制点（含变形位移） */
  points: { x: number; y: number }[];
  /** 未变形时的控制点位置（参照线用） */
  basePoints: { x: number; y: number }[];
}

/** 由网格与图层盒算出覆盖层状态 */
export function meshGridState(mesh: MeshWarp, box: LayerBox, rotated = true): MeshGridState {
  const controls = meshControlPoints(mesh, box, rotated);
  return {
    cols: mesh.cols,
    rows: mesh.rows,
    points: controls.map((point) => ({ x: point.x, y: point.y })),
    basePoints: controls.map((point) => ({ x: point.baseX, y: point.baseY })),
  };
}

export interface TransformOverlay {
  /** 常规变换框（自由变换模式） */
  transformBox: LayerBox | null;
  /** 网格控制点（透视 / 扭曲 / 斜切 / 变形模式） */
  meshGrid: MeshGridState | null;
}

/**
 * 覆盖层该显示什么，由「图层 + 变换模式」唯一决定。
 *
 * 抽到 core 的原因：画布组件与交互层都要算这一份（两条路径各写一次必然出现「拖拽时显示的框和静态时不一样」）。
 */
export function transformOverlayFor(
  layer: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    locked?: boolean;
    mesh?: MeshWarp | null;
  },
  mode: TransformMode,
): TransformOverlay {
  if (layer.locked) return { transformBox: null, meshGrid: null };
  const box: LayerBox = {
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation,
  };
  if (mode === 'free' || meshIsIdentity(layer.mesh)) return { transformBox: box, meshGrid: null };
  return { transformBox: null, meshGrid: meshGridState(layer.mesh as MeshWarp, box, true) };
}

/* ------------------------------ 再次变换 ------------------------------ */

/** 一次变换的增量：⌘⇧T「再次变换」就是把它再作用一次 */
export interface TransformDelta {
  dx: number;
  dy: number;
  scaleX: number;
  scaleY: number;
  /** 角度增量 */
  rotation: number;
}

export function isIdentityDelta(delta: TransformDelta): boolean {
  return (
    Math.abs(delta.dx) < 0.5 &&
    Math.abs(delta.dy) < 0.5 &&
    Math.abs(delta.scaleX - 1) < 1e-4 &&
    Math.abs(delta.scaleY - 1) < 1e-4 &&
    Math.abs(delta.rotation) < 0.01
  );
}

/**
 * 把增量作用到图层盒：缩放以盒子中心为锚点，再叠加平移与旋转。
 *
 * 网格变形无需额外处理 —— 位移是归一化的，会随盒子一起缩放 / 旋转 / 平移。
 */
export function applyTransformDelta(box: LayerBox, delta: TransformDelta): LayerBox {
  const width = Math.max(MIN_TRANSFORM_SIZE, box.width * delta.scaleX);
  const height = Math.max(MIN_TRANSFORM_SIZE, box.height * delta.scaleY);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  return {
    x: centerX - width / 2 + delta.dx,
    y: centerY - height / 2 + delta.dy,
    width,
    height,
    rotation: box.rotation + delta.rotation,
  };
}

/* ------------------------------ 文字排版 / 变形 ------------------------------ */

/**
 * 可选字体（专有名词，按原名展示，不做翻译）。
 *
 * 放在 core 而不是某个面板里：字符面板与属性面板都要用它，两处各写一份必然出现「一边加了字体另一边没有」。
 */
export const FONT_FAMILIES = [
  'PingFang SC',
  'Microsoft YaHei',
  'Noto Serif SC',
  'Helvetica',
  'Arial',
  'Georgia',
  'Courier New',
].map((name) => ({ id: name, label: name }));

/** 变形样式全集（含 none） */
export const TEXT_WARP_KINDS: TextWarpKind[] = [
  'none',
  'arc',
  'arcLower',
  'arcUpper',
  'arch',
  'shellLower',
  'shellUpper',
  'wave',
  'flag',
  'rise',
  'fisheye',
];

/** 变形强度上限（百分比） */
export const MAX_WARP_AMOUNT = 100;

export function clampWarpAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.min(MAX_WARP_AMOUNT, Math.max(-MAX_WARP_AMOUNT, value)));
}

/** 弯曲强度 → 最大垂直位移占文字块高度的比例（25%：肉眼明显但不会甩出画布太远） */
const WARP_BEND_RATIO = 0.25;
/** 水平强度 → 最大水平位移占文字块宽度的比例 */
const WARP_HORIZONTAL_RATIO = 0.18;

export interface WarpOffset {
  /** 水平位移，单位 = 文字块宽度的比例 */
  dx: number;
  /** 垂直位移，单位 = 文字块高度的比例（负值向上） */
  dy: number;
}

/**
 * 变形位移场（纯函数，供渲染与测试共用）。
 *
 * `u` ∈ [0,1] 为横向归一坐标（左→右），`v` ∈ [0,1] 为纵向（上→下），
 * 返回值为**归一化位移**（乘上宽 / 高即得像素）。参考 Photoshop 的变形样式：
 * 弧度族沿基线弯曲，`lower/upper` 只弯下半 / 上半，`arch` 中间最鼓，
 * `wave` 为 S 形，`flag` 为旗面摆动（振幅随高度递增），`rise` 为整体的斜向抬升，`fisheye` 为径向鼓形。
 */
export function warpOffset(
  kind: TextWarpKind,
  u: number,
  v: number,
  bend: number,
  horizontal: number,
): WarpOffset {
  if (kind === 'none') return { dx: 0, dy: 0 };
  const bendAmount = clampWarpAmount(bend) / MAX_WARP_AMOUNT;
  const horizontalAmount = clampWarpAmount(horizontal) / MAX_WARP_AMOUNT;
  const mid = Math.sin(Math.PI * u);
  /** 到水平中线的距离：0 = 中线，1 = 上下边缘 */
  const center = Math.abs(v * 2 - 1);
  let dx = 0;
  let dy = 0;
  switch (kind) {
    case 'arc':
      dy = -mid;
      break;
    case 'arcLower':
      dy = -mid * v;
      break;
    case 'arcUpper':
      dy = -mid * (1 - v);
      break;
    case 'arch':
      dy = -mid * (1 - center);
      break;
    case 'shellLower':
      dy = -mid * (1 + v) * 0.5;
      break;
    case 'shellUpper':
      dy = -mid * (2 - v) * 0.5;
      break;
    case 'wave':
      dy = Math.sin(Math.PI * 2 * u);
      break;
    case 'flag':
      dy = Math.sin(Math.PI * 2 * u) * (0.5 + 0.5 * v);
      break;
    case 'rise':
      // 右侧整体抬高（bend > 0 时向上）
      dy = -u;
      break;
    case 'fisheye': {
      // 径向鼓形：中心不动，越靠边缘位移越大（bend 控制纵向、horizontal 控制横向）
      const radial = Math.min(1, Math.hypot(u - 0.5, v - 0.5) / 0.7071);
      dx = (u - 0.5) * 2 * radial;
      dy = (v - 0.5) * 2 * radial;
      break;
    }
  }
  return {
    dx: dx * horizontalAmount * WARP_HORIZONTAL_RATIO,
    dy: dy * bendAmount * WARP_BEND_RATIO,
  };
}

/**
 * 是否需要走「位图路径」渲染文字。
 *
 * 两种情况 Konva.Text 无法表达：变形（需要网格重采样）与段间距（需要逐段定位）。
 * 走位图路径时由 `render/text.ts` 统一绘制，与导出用的 Canvas2D 路径**同源**，避免预览与导出漂移。
 */
export function needsTextBitmap(layer: {
  paragraphSpacing: number;
  warp: { kind: string; bend: number; horizontal: number };
}): boolean {
  if (layer.paragraphSpacing > 0) return true;
  if (layer.warp.kind === 'none') return false;
  return layer.warp.bend !== 0 || layer.warp.horizontal !== 0;
}

/* ------------------------------ 矢量蒙版 / 剪贴蒙版 ------------------------------ */

/** 羽化上限：与像素蒙版一致（`render/mask.ts` 的模糊上限 64px） */
export const MAX_VECTOR_FEATHER = 64;
/** 轮廓数量上限：布尔运算叠加出的选区轮廓过多时截断，避免蒙版与工程文件失控 */
export const MAX_VECTOR_CONTOURS = 32;

/** 矢量蒙版签名：轮廓顶点 + 羽化 / 反相都参与缓存键 */
export function vectorMaskSignature(mask: VectorMaskRef | null | undefined): string {
  if (!mask?.enabled || mask.contours.length === 0) return '';
  const parts = mask.contours.map(
    (contour) => `${contour.add ? '+' : '-'}${contour.path.map((n) => Math.round(n)).join(',')}`,
  );
  return `${mask.inverted ? 'i' : ''}${mask.feather.toFixed(1)}|${parts.join(';')}`;
}

/** 该蒙版是否会产生裁切（已启用且至少一条轮廓） */
export function hasVectorMask(mask: VectorMaskRef | null | undefined): boolean {
  return Boolean(mask?.enabled) && (mask?.contours.length ?? 0) > 0;
}

/**
 * 选区 → 矢量蒙版轮廓（图层局部坐标）。
 * 直接把选区的「并集 / 差集」轮廓平移 `-(originX, originY)`，语义完全沿用选区，
 * 因此布尔运算产生的加选 / 减选 / 洞都能原样成为矢量蒙版的多轮廓。
 */
export function selectionToVectorContours(
  selection: Selection,
  originX: number,
  originY: number,
): SelectionPart[] {
  const contours: SelectionPart[] = [];
  for (const contour of selectionContours(selection)) {
    if (contour.path.length < 6) continue;
    const path = new Array<number>(contour.path.length);
    for (let i = 0; i < contour.path.length; i += 2) {
      path[i] = contour.path[i] - originX;
      path[i + 1] = contour.path[i + 1] - originY;
    }
    contours.push({ path, add: contour.add });
  }
  return contours;
}

/**
 * 剪贴蒙版的基准图层下标：同层内、下方最近的「可绘制」图层。
 *
 * 不可当基准的情形：
 * - 调整图层（不产生像素，PS 亦不允许）；
 * - 穿透编组（自身不合成成一张图，没有可用的 alpha）；
 * - 不可见图层（PS 中基准不可见时整组剪贴失效）。
 * 找不到时返回 -1，调用方据此忽略 `clipped`。
 */
export function clipBaseIndex(layers: Layer[], index: number): number {
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = layers[i];
    if (!candidate) continue;
    // 跨出当前编组就不再往上找：剪贴蒙版只能作用于同组内的下方图层
    if ((candidate.parentId ?? null) !== (layers[index]?.parentId ?? null)) return -1;
    if (!candidate.visible) continue;
    if (candidate.kind === 'adjustment') continue;
    if (candidate.kind === 'group' && candidate.passThrough) continue;
    if (candidate.clipped) continue;
    return i;
  }
  return -1;
}

/* ------------------------------ 图层样式 ------------------------------ */

/** 效果 id（与 `LayerStyle` 的字段同名） */
export const STYLE_EFFECTS = [
  'dropShadow',
  'innerShadow',
  'outerGlow',
  'stroke',
  'colorOverlay',
] as const;
export type StyleEffectId = (typeof STYLE_EFFECTS)[number];

export const MAX_EFFECT_SIZE = 250;
export const MAX_EFFECT_DISTANCE = 500;
export const MAX_EFFECT_SPREAD = 100;

export function createDropShadow(): DropShadowStyle {
  return {
    enabled: true,
    color: '#000000',
    opacity: 0.6,
    angle: 135,
    distance: 6,
    spread: 0,
    size: 8,
  };
}

export function createInnerShadow(): InnerShadowStyle {
  return { enabled: true, color: '#000000', opacity: 0.5, angle: 135, distance: 4, size: 6 };
}

export function createOuterGlow(): OuterGlowStyle {
  return { enabled: true, color: '#FACC15', opacity: 0.75, size: 12 };
}

export function createStroke(): StrokeStyle {
  return { enabled: true, color: '#FFFFFF', opacity: 1, size: 3, position: 'outside' };
}

export function createColorOverlay(): ColorOverlayStyle {
  return { enabled: true, color: '#2563EB', opacity: 0.65 };
}

/** 默认样式（五种效果全部关闭）：面板「添加效果」时的起点 */
export function createLayerStyle(): LayerStyle {
  return {
    dropShadow: { ...createDropShadow(), enabled: false },
    innerShadow: { ...createInnerShadow(), enabled: false },
    outerGlow: { ...createOuterGlow(), enabled: false },
    stroke: { ...createStroke(), enabled: false },
    colorOverlay: { ...createColorOverlay(), enabled: false },
  };
}

/** 该效果是否会产生可见绘制 */
export function isEffectActive(effect: { enabled: boolean } | null | undefined): boolean {
  return Boolean(effect?.enabled);
}

/** 图层样式是否有任一启用中的效果 */
export function hasLayerStyle(style: LayerStyle | null | undefined): boolean {
  if (!style) return false;
  return STYLE_EFFECTS.some((id) => isEffectActive(style[id]));
}

/**
 * 样式在自身轮廓之外需要多少留白（像素）。
 *
 * 依据：Canvas2D 的 `filter: blur(r)` 影响范围约为 2r，`spread` 与 `distance` 直接平移外扩；
 * 内阴影与内侧描边都在剪影内部，不占用留白。
 */
export function stylePadding(style: LayerStyle | null | undefined): number {
  if (!style) return 0;
  let pad = 0;
  const shadow = style.dropShadow;
  if (isEffectActive(shadow) && shadow) {
    pad = Math.max(pad, shadow.size * 2 + shadow.spread + Math.abs(shadow.distance));
  }
  const glow = style.outerGlow;
  if (isEffectActive(glow) && glow) pad = Math.max(pad, glow.size * 2);
  const stroke = style.stroke;
  if (isEffectActive(stroke) && stroke && stroke.position === 'outside') {
    pad = Math.max(pad, stroke.size);
  }
  return Math.ceil(pad);
}

/** 样式签名：参与烘焙 / 合成缓存键，任一参数变化都会换键 */
export function styleSignature(style: LayerStyle | null | undefined): string {
  if (!hasLayerStyle(style)) return '';
  const parts: string[] = [];
  for (const id of STYLE_EFFECTS) {
    const effect = style?.[id];
    if (!isEffectActive(effect) || !effect) continue;
    parts.push(
      Object.entries(effect)
        .map(([key, value]) => `${key}=${typeof value === 'number' ? value.toFixed(2) : value}`)
        .join(','),
    );
  }
  return parts.join('|');
}

/* ------------------------------ 渐变 / 润饰 ------------------------------ */

export type GradientKind = 'linear' | 'radial';
/** 渐变端点组合：前景→透明 / 前景→背景 */
export type GradientMode = 'fg-transparent' | 'fg-bg';

export const GRADIENT_KINDS: GradientKind[] = ['linear', 'radial'];
export const GRADIENT_MODES: GradientMode[] = ['fg-transparent', 'fg-bg'];

export type RetouchMode = 'dodge' | 'burn' | 'sponge';
export const RETOUCH_MODES: RetouchMode[] = ['dodge', 'burn', 'sponge'];

/** 润饰工具强度上限（百分比） */
export const MAX_RETOUCH_STRENGTH = 100;

export interface HsvColor {
  /** 色相 0~360 */
  h: number;
  /** 饱和度 0~100 */
  s: number;
  /** 明度 0~100 */
  v: number;
}

/** `#RRGGBB` → HSV；解析失败回落到黑色 */
export function hexToHsv(hex: string): HsvColor {
  const value = String(hex).trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { h: 0, s: 0, v: 0 };
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 1e-6) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max <= 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

/** HSV → `#RRGGBB`（大写，便于与既有颜色字符串比较） */
export function hsvToHex(hsv: HsvColor): string {
  const h = ((hsv.h % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, hsv.s)) / 100;
  const v = Math.min(100, Math.max(0, hsv.v)) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const segment = Math.floor(h / 60) % 6;
  const rgb: [number, number, number] =
    segment === 0
      ? [c, x, 0]
      : segment === 1
        ? [x, c, 0]
        : segment === 2
          ? [0, c, x]
          : segment === 3
            ? [0, x, c]
            : segment === 4
              ? [x, 0, c]
              : [c, 0, x];
  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(rgb[0])}${toHex(rgb[1])}${toHex(rgb[2])}`.toUpperCase();
}

/** `#RRGGBB` + alpha → `rgba(...)`；解析失败回落到黑色 */
export function withAlpha(hex: string, alpha: number): string {
  const value = String(hex).trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  const a = Math.min(1, Math.max(0, Number.isFinite(alpha) ? alpha : 1));
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(0,0,0,${a})`;
  return `rgba(${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(
    full.slice(4, 6),
    16,
  )},${a})`;
}

/** 面板滑杆统一为整数百分比 / 角度 */
export function clampPercent(value: number, min = -100, max = 100): number {
  return Math.round(clampNumber(value, min, max));
}

/** 0~1 的不透明度，滑杆用 0~100 展示 */
export function clampUnit(value: number): number {
  return Math.round(clampNumber(value, 0, 1) * 100) / 100;
}

/**
 * 调整参数 → CSS filter 字符串（只覆盖 CSS 能表达的部分）。
 * 温度、锐化等无法用 CSS 表达的项由 `render/filters.ts` 走像素运算。
 */
export function buildFilterString(adjustments: Adjustments): string {
  const parts: string[] = [];
  const brightness = 1 + adjustments.brightness / 100 + adjustments.exposure / 140;
  if (Math.abs(brightness - 1) > 0.001) parts.push(`brightness(${round(brightness)})`);
  if (adjustments.contrast !== 0) {
    parts.push(`contrast(${round(1 + adjustments.contrast / 100)})`);
  }
  if (adjustments.saturation !== 0) {
    parts.push(`saturate(${round(1 + adjustments.saturation / 100)})`);
  }
  if (adjustments.hue !== 0) parts.push(`hue-rotate(${adjustments.hue}deg)`);
  return parts.join(' ');
}

/** 是否启用了任一扩展调整（色阶 / 曲线 / 色彩平衡 / 黑白 / 阈值 / 渐变映射 / 去色） */
export function hasExtendedAdjustments(adjustments: Adjustments): boolean {
  return Boolean(
    adjustments.levels ||
    adjustments.curves ||
    adjustments.colorBalance ||
    adjustments.blackWhite ||
    (adjustments.threshold !== null && adjustments.threshold !== undefined) ||
    adjustments.gradientMap ||
    adjustments.desaturate ||
    adjustments.photoFilter ||
    adjustments.channelMixer ||
    adjustments.shadowsHighlights ||
    adjustments.selectiveColor ||
    adjustments.replaceColor,
  );
}

/** 是否存在需要像素运算的调整项（决定是否需要 getImageData 通道） */
export function needsPixelPass(adjustments: Adjustments, filters: FilterSpec[]): boolean {
  if (adjustments.temperature !== 0) return true;
  if (adjustments.sharpen > 0) return true;
  if (hasExtendedAdjustments(adjustments)) return true;
  return activeFilters(filters).some((spec) => !isCssFilter(spec.id));
}

/**
 * 启用中的滤镜（`enabled === false` 表示「保留参数但暂时关闭」）。
 *
 * 所有**渲染**路径都必须经过它；而缓存签名（`filterSpecKey`）仍然序列化整份列表，
 * 这样「停用某个滤镜」既能改变画面，又能让缓存跟着失效。
 */
export function activeFilters(filters: FilterSpec[] | null | undefined): FilterSpec[] {
  if (!filters || filters.length === 0) return [];
  return filters.filter((spec) => spec.enabled !== false);
}

/** 智能滤镜是否会产生画面变化（决定智能对象能否走轻量预览路径） */
export function hasActiveFilters(filters: FilterSpec[] | null | undefined): boolean {
  return activeFilters(filters).length > 0;
}

/**
 * 「没有调整」的调整参数。
 * 供只关心滤镜栈的场景（智能滤镜烘焙、签名）使用，避免为了取默认值而依赖 `model/factory`。
 */
export const NO_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  exposure: 0,
  sharpen: 0,
};

/** 滤镜实例的稳定序列化（参数按键名排序，避免键序不同导致签名漂移） */
function filterSpecKey(filters: FilterSpec[]): string {
  return filters
    .map((spec) => {
      const params = spec.params
        ? Object.keys(spec.params)
            .sort()
            .map((key) => `${key}=${spec.params?.[key]}`)
            .join(',')
        : '';
      // `enabled` 参与签名：停用 / 启用必须让缓存失效
      return `${spec.id}(${params})${spec.enabled === false ? ':off' : ''}`;
    })
    .join('|');
}

/** 烘焙缓存签名：参数不变则复用上一次的画布 */
export function bakeSignature(
  assetId: string,
  rev: number,
  adjustments: Adjustments,
  filters: FilterSpec[],
): string {
  return [assetId, rev, JSON.stringify(adjustments ?? {}), filterSpecKey(filters ?? [])].join('|');
}

/* ------------------------------ 调整 LUT ------------------------------ */

/** 0~255 钳制 */
function clampByte(value: number): number {
  return value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
}

function identityLut(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) lut[i] = i;
  return lut;
}

/** 色阶 LUT */
export function buildLevelsLut(params: LevelsParams): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const inBlack = clampByte(params.inBlack);
  const inWhite = clampByte(params.inWhite);
  const range = Math.max(1, inWhite - inBlack);
  const gamma = Math.min(10, Math.max(0.05, params.gamma || 1));
  const outBlack = clampByte(params.outBlack);
  const outWhite = clampByte(params.outWhite);
  for (let i = 0; i < 256; i += 1) {
    let value = (i - inBlack) / range;
    value = value <= 0 ? 0 : value >= 1 ? 1 : value;
    value = Math.pow(value, 1 / gamma);
    lut[i] = outBlack + value * (outWhite - outBlack);
  }
  return lut;
}

/**
 * 曲线 LUT：控制点按 x 排序后做**单调三次插值（PCHIP）**，
 * 相比普通三次样条不会在控制点之间产生过冲，调色结果更可控。
 */
export function buildCurveLut(points: CurvePoint[]): Uint8ClampedArray {
  const sorted = [...points]
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
  if (sorted.length === 0) return identityLut();
  if (sorted.length === 1) {
    const lut = new Uint8ClampedArray(256);
    lut.fill(clampByte(sorted[0].y));
    return lut;
  }

  const count = sorted.length;
  const h: number[] = [];
  const delta: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const step = Math.max(1e-6, sorted[i + 1].x - sorted[i].x);
    h.push(step);
    delta.push((sorted[i + 1].y - sorted[i].y) / step);
  }
  const slope: number[] = new Array(count).fill(0);
  slope[0] = delta[0];
  slope[count - 1] = delta[count - 2];
  for (let i = 1; i < count - 1; i += 1) {
    if (delta[i - 1] * delta[i] <= 0) {
      slope[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      slope[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }

  const lut = new Uint8ClampedArray(256);
  for (let x = 0; x < 256; x += 1) {
    if (x <= sorted[0].x) {
      lut[x] = clampByte(sorted[0].y);
      continue;
    }
    if (x >= sorted[count - 1].x) {
      lut[x] = clampByte(sorted[count - 1].y);
      continue;
    }
    let i = 0;
    while (i < count - 2 && x > sorted[i + 1].x) i += 1;
    const t = (x - sorted[i].x) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    lut[x] =
      h00 * sorted[i].y + h10 * h[i] * slope[i] + h01 * sorted[i + 1].y + h11 * h[i] * slope[i + 1];
  }
  return lut;
}

/** 串联两条 LUT：先 a 后 b */
export function composeLut(a: Uint8ClampedArray, b: Uint8ClampedArray): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) lut[i] = b[a[i]];
  return lut;
}

/**
 * 把「色阶 + 曲线」合成为每通道一条 LUT（可分离的部分）。
 * 色彩平衡 / 黑白 / 阈值 / 渐变映射依赖亮度或跨通道，无法用 LUT 表达，由 `render/adjust.ts` 逐像素处理。
 * 返回 null 表示没有可分离的调整。
 */
export function buildAdjustLuts(
  adjustments: Adjustments,
): { r: Uint8ClampedArray; g: Uint8ClampedArray; b: Uint8ClampedArray } | null {
  const levelsLut = adjustments.levels ? buildLevelsLut(adjustments.levels) : null;
  const curves = adjustments.curves;
  const rgbLut = curves?.rgb?.length ? buildCurveLut(curves.rgb) : null;
  const redLut = curves?.red?.length ? buildCurveLut(curves.red) : null;
  const greenLut = curves?.green?.length ? buildCurveLut(curves.green) : null;
  const blueLut = curves?.blue?.length ? buildCurveLut(curves.blue) : null;
  if (!levelsLut && !rgbLut && !redLut && !greenLut && !blueLut) return null;

  const chain = (extra: Uint8ClampedArray | null): Uint8ClampedArray => {
    let lut = levelsLut ? Uint8ClampedArray.from(levelsLut) : null;
    if (rgbLut) lut = lut ? composeLut(lut, rgbLut) : Uint8ClampedArray.from(rgbLut);
    if (extra) lut = lut ? composeLut(lut, extra) : Uint8ClampedArray.from(extra);
    return lut ?? identityLut();
  };

  return { r: chain(redLut), g: chain(greenLut), b: chain(blueLut) };
}

/** 默认色阶参数 */
export function defaultLevels(): LevelsParams {
  return { inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 };
}

/** 曲线编辑器使用的固定 x 控制点（0 / 64 / 128 / 192 / 255） */
export const CURVE_X = [0, 64, 128, 192, 255];

/** 把任意曲线点集对齐到固定 x 控制点：缺失的点补成对角（不变） */
export function curvePointsFrom(points: CurvePoint[] | null | undefined): CurvePoint[] {
  const source = points && points.length >= 2 ? points : null;
  return CURVE_X.map((x) => {
    const existing = source?.find((point) => Math.abs(point.x - x) < 1);
    return { x, y: existing ? existing.y : x };
  });
}

/** 默认曲线（两点直线 = 不变） */
export function defaultCurves(): CurvesParams {
  return {
    rgb: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    red: null,
    green: null,
    blue: null,
  };
}

export function defaultColorBalance(): ColorBalanceParams {
  return { shadows: [0, 0, 0], midtones: [0, 0, 0], highlights: [0, 0, 0] };
}

export function defaultBlackWhite(): BlackWhiteParams {
  return { red: 40, yellow: 60, green: 40, cyan: 60, blue: 20, magenta: 80 };
}

/* --------------------------- 更多调整（P1-C2） --------------------------- */

/** 照片滤镜默认：暖色调（PS 的「加温滤镜 85」近似） */
export function defaultPhotoFilter(): PhotoFilterParams {
  return { color: '#EC8A00', density: 25, preserveLuminosity: true };
}

/** 通道混合器默认：恒等（每个输出通道只取自己的源通道） */
export function defaultChannelMixer(): ChannelMixerParams {
  return {
    red: [100, 0, 0, 0],
    green: [0, 100, 0, 0],
    blue: [0, 0, 100, 0],
  };
}

export function defaultShadowsHighlights(): ShadowsHighlightsParams {
  return { shadows: 35, highlights: 0 };
}

export function defaultReplaceColor(): ReplaceColorParams {
  return { color: '#FF0000', hue: 0, saturation: 0, lightness: 0, fuzziness: 60 };
}

/** 可选颜色的 9 个色域（顺序即面板展示顺序） */
export const SELECTIVE_RANGES: readonly SelectiveRange[] = [
  'reds',
  'yellows',
  'greens',
  'cyans',
  'blues',
  'magentas',
  'whites',
  'neutrals',
  'blacks',
];

/** 全零的可选颜色参数（面板启用时的起点） */
export function defaultSelectiveColor(): SelectiveColorParams {
  const ranges = {} as Record<SelectiveRange, number[]>;
  for (const range of SELECTIVE_RANGES) ranges[range] = [0, 0, 0, 0];
  return { ranges };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/* ------------------------------ 视口滚动 / 缩放 ------------------------------ */

/** 缩放上下限：滚轮缩放与 store 共用同一套钳制，避免两处各写一份 */
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(scale * 1000) / 1000));
}

/** 越界余量（屏幕像素）：画布四周留出可滚动余白，而不是贴死在视口边缘 */
export const OVERSCROLL_SCREEN = 160;

export interface ScrollMetrics {
  /** 视口尺寸（文档坐标单位 = 屏幕像素 / scale） */
  viewW: number;
  viewH: number;
  /** 可滚动世界（文档矩形 + 越界余量，且不小于视口）在文档坐标中的位置与大小 */
  worldLeft: number;
  worldTop: number;
  worldW: number;
  worldH: number;
  /** 当前视口左上角在世界中的位置（已钳制） */
  left: number;
  top: number;
  /** 可滚动范围（世界尺寸 − 视口尺寸，≥ 0） */
  rangeX: number;
  rangeY: number;
}

/**
 * 滚动几何：把「文档 + 视口」换算成滚动条需要的一组量。
 * 世界 = 文档矩形四周各留 `overscroll`（屏幕像素）余量，并与视口尺寸取最大值——
 * 这样文档小于视口时范围为 0（不显示滚动条），且「居中」正好落在合法区间内。
 */
export function scrollMetrics(
  doc: { width: number; height: number },
  viewport: { width: number; height: number; scale: number; x: number; y: number },
  overscroll = OVERSCROLL_SCREEN,
  rotation = 0,
): ScrollMetrics {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const viewW = Math.max(1, viewport.width) / scale;
  const viewH = Math.max(1, viewport.height) / scale;
  const pad = overscroll / scale;
  // 旋转视图下可滚动世界要按外接框扩张，否则画布会被钳制在视口里滚动不动
  const bounds = rotatedDocBounds(doc, rotation);
  const worldW = Math.max(bounds.width + pad * 2, viewW);
  const worldH = Math.max(bounds.height + pad * 2, viewH);
  const worldLeft = (doc.width - worldW) / 2;
  const worldTop = (doc.height - worldH) / 2;
  const rangeX = Math.max(0, worldW - viewW);
  const rangeY = Math.max(0, worldH - viewH);
  return {
    viewW,
    viewH,
    worldLeft,
    worldTop,
    worldW,
    worldH,
    left: clampNumber(-viewport.x / scale, worldLeft, worldLeft + rangeX),
    top: clampNumber(-viewport.y / scale, worldTop, worldTop + rangeY),
    rangeX,
    rangeY,
  };
}

/** 世界坐标（视口左上角）→ 屏幕平移量 */
export function viewportFromScroll(
  left: number,
  top: number,
  scale: number,
): { x: number; y: number } {
  const safe = scale > 0 ? scale : 1;
  return { x: Math.round(-left * safe), y: Math.round(-top * safe) };
}

/** 把候选视口钳制进可滚动世界（滚轮滚动 / 抓手平移共用） */
export function clampViewport(
  viewport: { x: number; y: number; scale: number },
  doc: { width: number; height: number },
  size: { width: number; height: number },
  overscroll = OVERSCROLL_SCREEN,
  rotation = 0,
): { x: number; y: number } {
  const metrics = scrollMetrics(doc, { ...size, ...viewport }, overscroll, rotation);
  return viewportFromScroll(metrics.left, metrics.top, viewport.scale);
}

/** 以某点为锚点缩放：让该点下的文档坐标保持不动（滚轮缩放共用） */
export function zoomAtPoint(
  viewport: { x: number; y: number; scale: number },
  nextScale: number,
  anchor: { x: number; y: number },
  size?: { width: number; height: number },
  rotation = 0,
): { x: number; y: number; scale: number } {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const target = clampScale(nextScale);
  // 旋转视图：锚点下的文档坐标要按逆变换求，再用正变换反解新的平移量
  if (size && rotation) {
    const p = screenToDoc(anchor, viewport, size, rotation);
    const center = viewCenter(size);
    const local = rotate(anchor.x - center.x, anchor.y - center.y, (-rotation * Math.PI) / 180);
    return {
      scale: target,
      x: Math.round(center.x + local.x - p.x * target),
      y: Math.round(center.y + local.y - p.y * target),
    };
  }
  const docX = (anchor.x - viewport.x) / scale;
  const docY = (anchor.y - viewport.y) / scale;
  return {
    scale: target,
    x: Math.round(anchor.x - docX * target),
    y: Math.round(anchor.y - docY * target),
  };
}

/** 画布适配缩放：留 padding 且不超过 1（小图不放大，避免糊） */
export function computeFitScale(
  doc: Pick<PhotoDoc, 'width' | 'height'>,
  viewport: { width: number; height: number },
  padding = 32,
  rotation = 0,
): number {
  const available = {
    width: Math.max(1, viewport.width - padding * 2),
    height: Math.max(1, viewport.height - padding * 2),
  };
  if (doc.width <= 0 || doc.height <= 0) return 1;
  // 旋转后按外接框适配：按原始宽高算会让旋转后的画布超出视口
  const bounds = rotatedDocBounds(doc, rotation);
  const scale = Math.min(available.width / bounds.width, available.height / bounds.height);
  return Math.max(0.02, Math.min(1, Math.round(scale * 1000) / 1000));
}

export function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function clampRect(rect: Rect, bounds: { width: number; height: number }): Rect {
  const x = clampNumber(rect.x, 0, bounds.width);
  const y = clampNumber(rect.y, 0, bounds.height);
  return {
    x,
    y,
    width: clampNumber(rect.width, 0, bounds.width - x),
    height: clampNumber(rect.height, 0, bounds.height - y),
  };
}

/* ------------------------------ 自由变换几何 ------------------------------ */

/** 变换把手：8 个缩放手柄 + 1 个旋转柄 */
export type TransformHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';

/** 变换盒：位置 / 尺寸 + 旋转（角度制，绕中心） */
export interface LayerBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** 缩放下限（文档像素）：避免拖成 0 尺寸后无法再拖回 */
export const MIN_TRANSFORM_SIZE = 8;

const HANDLE_LOCAL: { id: Exclude<TransformHandle, 'rotate'>; lx: number; ly: number }[] = [
  { id: 'nw', lx: -1, ly: -1 },
  { id: 'n', lx: 0, ly: -1 },
  { id: 'ne', lx: 1, ly: -1 },
  { id: 'e', lx: 1, ly: 0 },
  { id: 'se', lx: 1, ly: 1 },
  { id: 's', lx: 0, ly: 1 },
  { id: 'sw', lx: -1, ly: 1 },
  { id: 'w', lx: -1, ly: 0 },
];

function boxCenter(box: LayerBox): { x: number; y: number } {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** 图层盒的控制点（文档坐标）。`rotateOffset` 为旋转柄相对顶边的屏幕距离换算到文档单位后的值 */
export function transformHandles(
  box: LayerBox,
  rotateOffset = 0,
): { id: TransformHandle; x: number; y: number }[] {
  const center = boxCenter(box);
  const rad = (box.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = box.width / 2;
  const hh = box.height / 2;
  const toDoc = (lx: number, ly: number) => ({
    x: center.x + lx * cos - ly * sin,
    y: center.y + lx * sin + ly * cos,
  });
  const out = HANDLE_LOCAL.map((h) => ({
    id: h.id as TransformHandle,
    ...toDoc(h.lx * hw, h.ly * hh),
  }));
  out.push({ id: 'rotate', ...toDoc(0, -hh - rotateOffset) });
  return out;
}

/** 文档坐标 → 图层局部坐标（以图层中心为原点、未旋转的坐标系） */
export function toLocalPoint(box: LayerBox, px: number, py: number): { x: number; y: number } {
  const center = boxCenter(box);
  const rad = (-box.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - center.x;
  const dy = py - center.y;
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/**
 * 拖拽手柄后的新盒子。
 * - `local` 为指针在「初始盒子」局部坐标系中的位置；
 * - `keepRatio`（Shift）保持宽高比，`fromCenter`（Alt）以中心为锚点对称缩放。
 */
export function resizeLayerBox(
  start: LayerBox,
  handle: Exclude<TransformHandle, 'rotate'>,
  local: { x: number; y: number },
  options: { keepRatio?: boolean; fromCenter?: boolean } = {},
): LayerBox {
  const min = MIN_TRANSFORM_SIZE;
  const hw = start.width / 2;
  const hh = start.height / 2;

  let left = -hw;
  let right = hw;
  let top = -hh;
  let bottom = hh;

  const hasW = handle.includes('w');
  const hasE = handle.includes('e');
  const hasN = handle.includes('n');
  const hasS = handle.includes('s');

  if (options.fromCenter) {
    // 中心锚点：拖一侧时对侧镜像
    const dx = Math.abs(local.x);
    const dy = Math.abs(local.y);
    if (hasW || hasE) {
      const half = Math.max(min / 2, dx);
      left = -half;
      right = half;
    }
    if (hasN || hasS) {
      const half = Math.max(min / 2, dy);
      top = -half;
      bottom = half;
    }
  } else {
    if (hasW) left = Math.min(local.x, right - min);
    if (hasE) right = Math.max(local.x, left + min);
    if (hasN) top = Math.min(local.y, bottom - min);
    if (hasS) bottom = Math.max(local.y, top + min);
  }

  let width = right - left;
  let height = bottom - top;

  if (options.keepRatio && start.width > 0 && start.height > 0) {
    const ratio = start.width / start.height;
    // 角手柄按最大边等比；边手柄只按对应轴等比
    const isCorner = (hasW || hasE) && (hasN || hasS);
    if (isCorner) {
      const scale = Math.max(width / start.width, height / start.height);
      width = start.width * scale;
      height = start.height * scale;
    } else if (hasW || hasE) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
    // 等比缩放后按锚点重新贴边
    if (options.fromCenter) {
      left = -width / 2;
      right = width / 2;
      top = -height / 2;
      bottom = height / 2;
    } else {
      if (hasW) left = right - width;
      else right = left + width;
      if (hasN) top = bottom - height;
      else bottom = top + height;
    }
  }

  const center = boxCenter(start);
  const rad = (start.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localCx = (left + right) / 2;
  const localCy = (top + bottom) / 2;
  const newCenterX = center.x + localCx * cos - localCy * sin;
  const newCenterY = center.y + localCx * sin + localCy * cos;
  const w = Math.max(1, right - left);
  const h = Math.max(1, bottom - top);

  return {
    x: Math.round(newCenterX - w / 2),
    y: Math.round(newCenterY - h / 2),
    width: Math.round(w),
    height: Math.round(h),
    rotation: start.rotation,
  };
}

/** 拖拽旋转柄：`deltaDeg` 为指针相对起始角的变化量；`snap` 时吸附到 15° */
export function rotateLayerBox(start: LayerBox, deltaDeg: number, snap = false): LayerBox {
  let rotation = start.rotation + deltaDeg;
  if (snap) rotation = Math.round(rotation / 15) * 15;
  rotation = ((((rotation + 180) % 360) + 360) % 360) - 180;
  return { ...start, rotation: Math.round(rotation * 10) / 10 };
}

/** 指针位置相对图层中心的角度（度，屏幕/文档同向） */
export function angleFromCenter(box: LayerBox, px: number, py: number): number {
  const center = boxCenter(box);
  return (Math.atan2(py - center.y, px - center.x) * 180) / Math.PI;
}

/** 命中判定：把手（`radius` 为文档单位下的命中半径）或盒内部 */
export function hitTransformHandle(
  box: LayerBox,
  px: number,
  py: number,
  radius: number,
  rotateOffset = 0,
): TransformHandle | 'inside' | null {
  const handles = transformHandles(box, rotateOffset);
  let best: { id: TransformHandle; distance: number } | null = null;
  for (const handle of handles) {
    const distance = Math.hypot(handle.x - px, handle.y - py);
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { id: handle.id, distance };
    }
  }
  if (best) return best.id;
  const local = toLocalPoint(box, px, py);
  if (Math.abs(local.x) <= box.width / 2 && Math.abs(local.y) <= box.height / 2) return 'inside';
  return null;
}

export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** 把选区轮廓写入当前路径（文档坐标）：矩形 / 椭圆 / 套索统一入口 */
/** 多边形有向面积（鞋带公式）：y 轴向下时，顺时针为正 */
export function signedArea(path: number[]): number {
  let area = 0;
  for (let i = 0, j = path.length - 2; i < path.length; j = i, i += 2) {
    area += path[j] * path[i + 1] - path[i] * path[j + 1];
  }
  return area / 2;
}

/** 把轮廓方向规范化为「正/负面积」，nonzero 填充下并集与差集才能正确叠加 */
export function orientPolygon(path: number[], positive: boolean): number[] {
  if (path.length < 6) return path;
  const area = signedArea(path);
  if (area === 0) return path;
  if (area > 0 === positive) return path;
  const reversed: number[] = [];
  for (let i = path.length - 2; i >= 0; i -= 2) reversed.push(path[i], path[i + 1]);
  return reversed;
}

/** 矩形 / 椭圆 → 多边形顶点（统一表示，便于方向规范化与布尔运算） */
export function shapePolygon(selection: {
  kind: SelectionKind;
  x: number;
  y: number;
  width: number;
  height: number;
  path: number[];
}): number[] {
  if (selection.kind === 'lasso' && selection.path.length >= 6) return [...selection.path];
  if (selection.kind === 'ellipse') {
    const rx = Math.max(0, selection.width / 2);
    const ry = Math.max(0, selection.height / 2);
    const cx = selection.x + rx;
    const cy = selection.y + ry;
    const points: number[] = [];
    for (let i = 0; i < 48; i += 1) {
      const angle = (i / 48) * Math.PI * 2;
      points.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }
    return points;
  }
  const { x, y, width, height } = selection;
  return [x, y, x + width, y, x + width, y + height, x, y + height];
}

/**
 * 选区的全部轮廓（含并/差语义）。
 * 主轮廓恒为并集；`hole` 与 `parts` 中 `add: false` 的轮廓为差集。
 */
export function selectionContours(selection: Selection): SelectionPart[] {
  const contours: SelectionPart[] = [{ path: shapePolygon(selection), add: true }];
  if (selection.hole && selection.hole.length >= 6) {
    contours.push({ path: [...selection.hole], add: false });
  }
  for (const part of selection.parts ?? []) {
    if (part.path.length >= 6) contours.push({ path: [...part.path], add: part.add });
  }
  return contours;
}

/** 选区外接矩形（全部轮廓的并集包围盒） */
export function selectionBounds(selection: Selection): Rect {
  const contours = selectionContours(selection);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const contour of contours) {
    const bounds = polygonBounds(contour.path);
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * 把选区写入当前路径：矩形 / 椭圆 / 套索 / 布尔运算结果统一为多边形子路径，
 * 并按并集（正向）/ 差集（反向）规范化方向，调用方需使用 `nonzero` 填充规则
 * （`ctx.fill('nonzero')` / `ctx.clip('nonzero')`）。
 */
export function traceSelection(ctx: CanvasRenderingContext2D, selection: Selection): void {
  ctx.beginPath();
  for (const contour of selectionContours(selection)) {
    const path = orientPolygon(contour.path, contour.add);
    if (path.length < 6) continue;
    ctx.moveTo(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1]);
    ctx.closePath();
  }
}

/** 选区 → 等效多边形顶点（用于反选等需要拼接路径的场合） */
export function selectionPolygon(selection: Selection): number[] {
  return shapePolygon(selection);
}

/**
 * 反选：画布外框作为并集，原选区的全部轮廓翻转并/差标记后追加。
 * 用 nonzero 填充验证：内部区域 winding 相加为 0（不选中），原选区未覆盖处为 1（选中）。
 */
export function invertSelection(
  selection: Selection,
  canvas: { width: number; height: number },
): Selection {
  const contours = selectionContours(selection);
  return {
    kind: 'lasso',
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    path: [0, 0, canvas.width, 0, canvas.width, canvas.height, 0, canvas.height],
    parts: contours.map((contour) => ({ path: contour.path, add: !contour.add })),
    feather: selection.feather,
  };
}

/** 整块画布作为矩形选区 */
export function fullSelection(canvas: { width: number; height: number }): Selection {
  return {
    kind: 'rect',
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    path: [],
    feather: 0,
  };
}

/**
 * 选区是否命中某点：按 nonzero 缠绕数判定（并集 +1、差集 -1，正值即在选区内）。
 * 与 `traceSelection` 的填充结果严格一致，因此笔刷裁剪、填充与命中判定不会互相矛盾。
 */
export function pointInSelection(selection: Selection, px: number, py: number): boolean {
  let winding = 0;
  for (const contour of selectionContours(selection)) {
    if (pointInPolygon(contour.path, px, py)) winding += contour.add ? 1 : -1;
  }
  return winding !== 0;
}

export function pointInPolygon(path: number[], px: number, py: number): boolean {
  if (path.length < 6) return false;
  let inside = false;
  for (let i = 0, j = path.length - 2; i < path.length; j = i, i += 2) {
    const xi = path[i];
    const yi = path[i + 1];
    const xj = path[j];
    const yj = path[j + 1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 套索顶点 → 外接矩形 */
export function polygonBounds(path: number[]): Rect {
  if (path.length < 2) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < path.length; i += 2) {
    minX = Math.min(minX, path[i]);
    maxX = Math.max(maxX, path[i]);
    minY = Math.min(minY, path[i + 1]);
    maxY = Math.max(maxY, path[i + 1]);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** 按步长抽稀套索顶点，避免长笔画产生上万个点 */
export function simplifyPath(path: number[], minDistance = 3): number[] {
  if (path.length < 4) return path;
  const out: number[] = [path[0], path[1]];
  for (let i = 2; i < path.length; i += 2) {
    const x = path[i];
    const y = path[i + 1];
    const lastX = out[out.length - 2];
    const lastY = out[out.length - 1];
    if (Math.hypot(x - lastX, y - lastY) >= minDistance) out.push(x, y);
  }
  return out;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function mixHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampUnit(alpha)})`;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|\n\r\t]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : 'photo';
}

export function buildExportFilename(title: string, ext: string): string {
  return `${sanitizeFilename(title)}.${ext}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

/* ------------------------------ 文件校验 ------------------------------ */

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
const SVG_EXTENSIONS = ['.svg'];

/**
 * 图片文件类型判定。
 *
 * SVG 单列一类：它**不是**位图，导入时要先栅格化（`render/svg.ts`），
 * 因此调用方需要区分「直接解码」与「先解析尺寸再按倍数渲染」两条路径。
 */
export function resolveImageKind(filename: string): 'image' | 'svg' | 'unsupported' {
  const lower = filename.trim().toLowerCase();
  if (SVG_EXTENSIONS.some((ext) => lower.endsWith(ext))) return 'svg';
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext)) ? 'image' : 'unsupported';
}

export function checkImageFile(file: { name: string; size: number }): ToolResult<void> {
  if (resolveImageKind(file.name) === 'unsupported') return { ok: false, error: 'NOT_IMAGE' };
  if (file.size === 0) return { ok: false, error: 'EMPTY' };
  // SVG 是文本，体积与像素量无关，但仍要防超大文件（多数编辑器会把它当炸弹）
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_IMAGE_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: undefined };
}

/**
 * PSD 导入校验。
 *
 * 与图片共用体积上限的检查方式，但上限单独放宽（PSD 承载多图层，常远大于普通图片）；
 * 真正的格式校验交给 `psd/reader.ts` 的解析结果（坏文件返回 INVALID_PSD）。
 */
export function checkPsdFile(file: { name: string; size: number }): ToolResult<void> {
  if (!/\.psd$/i.test(file.name.trim())) return { ok: false, error: 'NOT_PSD' };
  if (file.size === 0) return { ok: false, error: 'EMPTY' };
  if (file.size > MAX_PSD_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_PSD_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: undefined };
}

export function checkProjectFile(file: { name: string; size: number }): ToolResult<void> {
  const lower = file.name.trim().toLowerCase();
  if (!lower.endsWith('.json') && !lower.endsWith('.photo.json')) {
    return { ok: false, error: 'NOT_PROJECT' };
  }
  if (file.size === 0) return { ok: false, error: 'EMPTY' };
  if (file.size > MAX_PROJECT_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_PROJECT_BYTES / 1024 / 1024) },
    };
  }
  return { ok: true, value: undefined };
}

/**
 * 工程文件版本号：导入时据此拒绝未来格式，旧版本走 `model/migrate.ts` 归一。
 * v2 → v3：滤镜由 `FilterId[]` 升级为「规格 + 参数」（`FilterSpec[]`），
 * 调整新增色阶 / 曲线 / 色彩平衡 / 黑白 / 阈值 / 渐变映射 / 去色等可选参数。
 * 旧文件仍可读取（`normalizeFilters` 兼容字符串数组），但新文件不应被旧版本打开。
 */
export const PROJECT_VERSION = 3;

/* ------------------------------------------------------------------ *
 * 层栈：扁平数组 + parentId → 合成指令序列
 * ------------------------------------------------------------------ */

export type StackStep =
  | { kind: 'group-begin'; layer: GroupLayer }
  | { kind: 'group-end'; layer: GroupLayer }
  | { kind: 'layer'; layer: Layer };

/**
 * 把 `doc.layers`（扁平、尾部为最上层）展开成可顺序合成的指令序列。
 *
 * 表示法约定：编组的子图层紧随编组之后，并用 `parentId` 指回编组；
 * 因此这里按 parentId 建索引后递归即可。`parentId` 指向不存在 / 非编组时降级为顶层
 * （旧工程或迁移异常时不至于丢图层）。
 */
export function flattenStack(doc: PhotoDoc): StackStep[] {
  const knownIds = new Set(doc.layers.map((layer) => layer.id));
  const childrenOf = new Map<string, Layer[]>();
  const roots: Layer[] = [];

  for (const layer of doc.layers) {
    const parentId = layer.parentId ?? null;
    if (parentId && knownIds.has(parentId)) {
      const list = childrenOf.get(parentId);
      if (list) list.push(layer);
      else childrenOf.set(parentId, [layer]);
    } else {
      roots.push(layer);
    }
  }

  const steps: StackStep[] = [];
  const walk = (list: Layer[]) => {
    for (const layer of list) {
      if (layer.kind === 'group') {
        steps.push({ kind: 'group-begin', layer });
        walk(childrenOf.get(layer.id) ?? []);
        steps.push({ kind: 'group-end', layer });
      } else {
        steps.push({ kind: 'layer', layer });
      }
    }
  };
  walk(roots);
  return steps;
}

/** 子树 id（自身 + 全部后代），按 `doc.layers` 顺序 */
export function subtreeIdsOf(doc: PhotoDoc, id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const layer of doc.layers) {
    const parentId = layer.parentId ?? null;
    if (!parentId) continue;
    const list = childrenOf.get(parentId);
    if (list) list.push(layer.id);
    else childrenOf.set(parentId, [layer.id]);
  }
  const out: string[] = [];
  const walk = (current: string) => {
    out.push(current);
    for (const child of childrenOf.get(current) ?? []) walk(child);
  };
  walk(id);
  return out;
}

/** 编组的直接子图层（按层栈顺序） */
export function childrenOfLayer(doc: PhotoDoc, id: string): Layer[] {
  return doc.layers.filter((layer) => (layer.parentId ?? null) === id);
}

/**
 * 把某图层（连同其子树）移动到目标父级下，返回新的层数组。
 *
 * 纯函数：不动原数组。落位规则——
 * - 目标父级为 null → 移到最顶层（数组末尾）；
 * - 目标为编组 → 紧跟在该编组子树之后（即成为组内最上层）；
 * - 目标是自己的后代时拒绝（会形成环），原样返回。
 */
export function moveSubtree(layers: Layer[], id: string, targetParentId: string | null): Layer[] {
  const byId = new Map(layers.map((layer) => [layer.id, layer] as const));
  const moving = layers.find((layer) => layer.id === id);
  if (!moving) return layers;

  // 环检测：目标父级不能是自己的后代
  if (targetParentId) {
    const descendants = new Set<string>();
    const walk = (current: string) => {
      for (const child of layers.filter((layer) => (layer.parentId ?? null) === current)) {
        descendants.add(child.id);
        walk(child.id);
      }
    };
    walk(id);
    if (targetParentId === id || descendants.has(targetParentId)) return layers;
    if (!byId.has(targetParentId)) return layers;
  }

  const movingIds = new Set<string>();
  {
    const walk = (current: string) => {
      movingIds.add(current);
      for (const child of layers.filter((layer) => (layer.parentId ?? null) === current)) {
        walk(child.id);
      }
    };
    walk(id);
  }

  const rest = layers.filter((layer) => !movingIds.has(layer.id));
  const moved = layers
    .filter((layer) => movingIds.has(layer.id))
    .map((layer) => (layer.id === id ? { ...layer, parentId: targetParentId } : layer));

  if (!targetParentId) return [...rest, ...moved];

  // 落点：目标编组子树之后
  const targetIds = new Set<string>();
  {
    const walk = (current: string) => {
      targetIds.add(current);
      for (const child of layers.filter((layer) => (layer.parentId ?? null) === current)) {
        walk(child.id);
      }
    };
    walk(targetParentId);
  }
  const at = rest.findIndex((layer) => targetIds.has(layer.id));
  let insertAt = rest.length;
  if (at >= 0) {
    insertAt = at + 1;
    while (insertAt < rest.length && targetIds.has(rest[insertAt].id)) insertAt += 1;
  }
  return [...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)];
}

/** 祖先链（由外到内） */
export function ancestorChainOf(doc: PhotoDoc, layer: Layer): Layer[] {
  const byId = new Map(doc.layers.map((item) => [item.id, item] as const));
  const chain: Layer[] = [];
  let cursor = layer.parentId ?? null;
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    const parent = byId.get(cursor);
    if (!parent) break;
    chain.unshift(parent);
    cursor = parent.parentId ?? null;
  }
  return chain;
}

/** 编组会向下继承可见性：任一祖先不可见 → 子图层不可见 */
export function effectiveVisible(doc: PhotoDoc, layer: Layer): boolean {
  if (!layer.visible) return false;
  return ancestorChainOf(doc, layer).every((parent) => parent.visible);
}

/** 锁定同样向下继承（Photoshop 行为：锁住的组内子图层也不可编辑） */
export function effectiveLocked(doc: PhotoDoc, layer: Layer): boolean {
  if (layer.locked) return true;
  return ancestorChainOf(doc, layer).some((parent) => parent.locked);
}

/** 蒙版烘焙缓存键：蒙版像素或参数一变就换键；无蒙版返回 null */
export function maskSignature(layer: Layer): string | null {
  const mask = layer.mask;
  if (!mask || !mask.assetId || !mask.enabled) return null;
  return `${mask.assetId}:${mask.rev}:${mask.inverted ? 1 : 0}:${mask.density.toFixed(3)}:${mask.feather}`;
}

/** 历史面板的一行（纯展示数据：操作名键 + 时间 + 是否当前状态） */
export interface HistoryRow {
  label: HistoryLabel;
  at: number;
  current: boolean;
}

/**
 * 由 past / future 推导面板行序列。
 * 行序列即「时间轴」：0 = 最初状态，past.length = 当前，末尾 = 可重做的最远状态。
 * 面板点击第 i 行 → `jumpTo(i)`。
 */
export function historyTimeline(past: HistoryEntry[], future: HistoryEntry[]): HistoryRow[] {
  const rows: HistoryRow[] = past.map((entry, index) => ({
    label: index === 0 ? 'histOpen' : past[index - 1].label,
    at: index === 0 ? entry.at : past[index - 1].at,
    current: false,
  }));
  rows.push({
    label: past.length > 0 ? past[past.length - 1].label : 'histOpen',
    at: past.length > 0 ? past[past.length - 1].at : 0,
    current: true,
  });
  for (const entry of future) rows.push({ label: entry.label, at: entry.at, current: false });
  return rows;
}

/** 图层引用的全部资产 id（位图 / 智能对象源 / 蒙版），供资产回收与序列化使用 */
export function layerAssetIds(layer: Layer): string[] {
  const ids: string[] = [];
  if (layer.kind === 'raster' && layer.assetId) ids.push(layer.assetId);
  if (layer.kind === 'smart' && layer.sourceAssetId) ids.push(layer.sourceAssetId);
  if (layer.mask?.assetId) ids.push(layer.mask.assetId);
  return ids;
}
