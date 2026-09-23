import type { ToolResult } from '@/core/types';
import type { Adjustments, BlendMode, FilterId, PhotoDoc, Rect, Selection } from './model/types';

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

/** 常用画布预设：正方形 / 横版 / 竖版 / 纸张 */
export const CANVAS_PRESETS: CanvasPreset[] = [
  { id: 'hd', label: '1280 × 720（16:9）', width: 1280, height: 720 },
  { id: 'square', label: '1080 × 1080（1:1）', width: 1080, height: 1080 },
  { id: 'photo43', label: '1024 × 768（4:3）', width: 1024, height: 768 },
  { id: 'portrait', label: '1080 × 1350（4:5）', width: 1080, height: 1350 },
  { id: 'a4', label: 'A4 竖版（2480 × 3508）', width: 2480, height: 3508 },
];

export const BLEND_MODES: { id: BlendMode; label: string }[] = [
  { id: 'normal', label: '正常' },
  { id: 'multiply', label: '正片叠底' },
  { id: 'screen', label: '滤色' },
  { id: 'overlay', label: '叠加' },
  { id: 'darken', label: '变暗' },
  { id: 'lighten', label: '变亮' },
  { id: 'color-dodge', label: '颜色减淡' },
  { id: 'difference', label: '差值' },
  { id: 'exclusion', label: '排除' },
  { id: 'hue', label: '色相' },
  { id: 'saturation', label: '饱和度' },
  { id: 'color', label: '颜色' },
  { id: 'luminosity', label: '明度' },
];

export const FILTERS: { id: FilterId; label: string; hint: string }[] = [
  { id: 'grayscale', label: '灰度', hint: '去掉全部色彩，转为黑白' },
  { id: 'sepia', label: '复古', hint: '棕褐色调，模拟老照片' },
  { id: 'invert', label: '反相', hint: '颜色取反，生成负片' },
  { id: 'blur', label: '模糊', hint: '高斯柔化，弱化细节' },
  { id: 'sharpen', label: '锐化', hint: '增强边缘对比，画面更清晰' },
  { id: 'emboss', label: '浮雕', hint: '突出轮廓，形成立体压印感' },
  { id: 'edge', label: '边缘', hint: '只保留轮廓线条' },
  { id: 'noise', label: '噪点', hint: '叠加颗粒，模拟胶片质感' },
  { id: 'pixelate', label: '像素化', hint: '马赛克化，隐藏细节' },
  { id: 'posterize', label: '色调分离', hint: '压缩色阶，形成色块' },
];

export const SHAPE_KINDS = [
  { id: 'rect', label: '矩形' },
  { id: 'roundRect', label: '圆角矩形' },
  { id: 'ellipse', label: '椭圆' },
  { id: 'line', label: '直线' },
  { id: 'arrow', label: '箭头' },
  { id: 'star', label: '星形' },
] as const;

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

/** 工程文件版本号：导入时据此拒绝未来 / 过旧格式 */
export const PROJECT_VERSION = 1;
