import type { ToolResult } from '@/core/types';
import type {
  Adjustments,
  BlendMode,
  FilterId,
  GroupLayer,
  HistoryEntry,
  HistoryLabel,
  Layer,
  PhotoDoc,
  Rect,
  Selection,
  ShapeKind,
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
  'darken',
  'lighten',
  'color-dodge',
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
  'sharpen',
  'emboss',
  'edge',
  'noise',
  'pixelate',
  'posterize',
];

/** 形状：只声明 id，名称由 UI 通过 `tools.photo.shape.<id>` 取当前语言 */
export const SHAPE_KINDS: ShapeKind[] = ['rect', 'roundRect', 'ellipse', 'line', 'arrow', 'star'];

/** 数值钳制：非法值回落到 min（与 doodle-board 的 clampBrushSize 一致） */
export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function clampBrushSize(value: number): number {
  return Math.round(clampNumber(value, MIN_BRUSH, MAX_BRUSH));
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

/** 是否存在需要像素运算的调整项（决定是否需要 getImageData 通道） */
export function needsPixelPass(adjustments: Adjustments, filters: FilterId[]): boolean {
  if (adjustments.temperature !== 0) return true;
  if (adjustments.sharpen > 0) return true;
  return filters.some(
    (id) => id !== 'grayscale' && id !== 'sepia' && id !== 'invert' && id !== 'blur',
  );
}

/** 烘焙缓存签名：参数不变则复用上一次的画布 */
export function bakeSignature(
  assetId: string,
  rev: number,
  adjustments: Adjustments,
  filters: FilterId[],
): string {
  const a = adjustments;
  return [
    assetId,
    rev,
    a.brightness,
    a.contrast,
    a.saturation,
    a.hue,
    a.temperature,
    a.exposure,
    a.sharpen,
    filters.join(','),
  ].join('|');
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
): ScrollMetrics {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const viewW = Math.max(1, viewport.width) / scale;
  const viewH = Math.max(1, viewport.height) / scale;
  const pad = overscroll / scale;
  const worldW = Math.max(doc.width + pad * 2, viewW);
  const worldH = Math.max(doc.height + pad * 2, viewH);
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
): { x: number; y: number } {
  const metrics = scrollMetrics(doc, { ...size, ...viewport }, overscroll);
  return viewportFromScroll(metrics.left, metrics.top, viewport.scale);
}

/** 以某点为锚点缩放：让该点下的文档坐标保持不动（滚轮缩放共用） */
export function zoomAtPoint(
  viewport: { x: number; y: number; scale: number },
  nextScale: number,
  anchor: { x: number; y: number },
): { x: number; y: number; scale: number } {
  const scale = viewport.scale > 0 ? viewport.scale : 1;
  const target = clampScale(nextScale);
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
): number {
  const available = {
    width: Math.max(1, viewport.width - padding * 2),
    height: Math.max(1, viewport.height - padding * 2),
  };
  if (doc.width <= 0 || doc.height <= 0) return 1;
  const scale = Math.min(available.width / doc.width, available.height / doc.height);
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

export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** 把选区轮廓写入当前路径（文档坐标）：矩形 / 椭圆 / 套索统一入口 */
export function traceSelection(ctx: CanvasRenderingContext2D, selection: Selection): void {
  ctx.beginPath();
  if (selection.kind === 'ellipse') {
    const rx = selection.width / 2;
    const ry = selection.height / 2;
    ctx.ellipse(
      selection.x + rx,
      selection.y + ry,
      Math.max(0, rx),
      Math.max(0, ry),
      0,
      0,
      Math.PI * 2,
    );
    return;
  }
  if (selection.kind === 'lasso' && selection.path.length >= 6) {
    ctx.moveTo(selection.path[0], selection.path[1]);
    for (let i = 2; i < selection.path.length; i += 2)
      ctx.lineTo(selection.path[i], selection.path[i + 1]);
    ctx.closePath();
    // 内轮廓作为独立子路径加入：even-odd 下即「挖洞」
    if (selection.hole && selection.hole.length >= 6) {
      ctx.moveTo(selection.hole[0], selection.hole[1]);
      for (let i = 2; i < selection.hole.length; i += 2) {
        ctx.lineTo(selection.hole[i], selection.hole[i + 1]);
      }
      ctx.closePath();
    }
    return;
  }
  ctx.rect(selection.x, selection.y, selection.width, selection.height);
}

/** 选区 → 等效多边形顶点（用于反选等需要拼接路径的场合） */
export function selectionPolygon(selection: Selection): number[] {
  if (selection.kind === 'lasso' && selection.path.length >= 6) return [...selection.path];
  if (selection.kind === 'ellipse') {
    const rx = selection.width / 2;
    const ry = selection.height / 2;
    const cx = selection.x + rx;
    const cy = selection.y + ry;
    const points: number[] = [];
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      points.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }
    return points;
  }
  const { x, y, width, height } = selection;
  return [x, y, x + width, y, x + width, y + height, x, y + height];
}

/**
 * 反选：用「画布外框 + 原选区内框」的两条闭合轮廓表示带洞区域，
 * 依赖奇偶规则（even-odd）——命中判定与裁剪都按 even-odd 处理，见
 * `pointInPolygon` 与 `render/brush.ts` 的裁剪。
 */
export function invertSelection(
  selection: Selection,
  canvas: { width: number; height: number },
): Selection {
  return {
    kind: 'lasso',
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    path: [0, 0, canvas.width, 0, canvas.width, canvas.height, 0, canvas.height],
    hole: selectionPolygon(selection),
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

/** 选区是否命中某点：矩形 / 椭圆走解析式，套索走奇偶规则射线法 */
export function pointInSelection(selection: Selection, px: number, py: number): boolean {
  const { x, y, width, height } = selection;
  if (px < x || py < y || px > x + width || py > y + height) return false;
  if (selection.kind === 'rect') return true;
  if (selection.kind === 'ellipse') {
    const rx = width / 2;
    const ry = height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const nx = (px - (x + rx)) / rx;
    const ny = (py - (y + ry)) / ry;
    return nx * nx + ny * ny <= 1;
  }
  if (!pointInPolygon(selection.path, px, py)) return false;
  // 反选的「洞」：落在外轮廓内但命中内轮廓的点属于选区之外
  if (selection.hole && selection.hole.length >= 6) return !pointInPolygon(selection.hole, px, py);
  return true;
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

export function resolveImageKind(filename: string): 'image' | 'unsupported' {
  const lower = filename.trim().toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext)) ? 'image' : 'unsupported';
}

export function checkImageFile(file: { name: string; size: number }): ToolResult<void> {
  if (resolveImageKind(file.name) !== 'image') return { ok: false, error: 'NOT_IMAGE' };
  if (file.size === 0) return { ok: false, error: 'EMPTY' };
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: 'TOO_LARGE',
      params: { max: Math.round(MAX_IMAGE_BYTES / 1024 / 1024) },
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

/** 工程文件版本号：导入时据此拒绝未来格式，旧版本走 `model/migrate.ts` 归一 */
export const PROJECT_VERSION = 2;

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
