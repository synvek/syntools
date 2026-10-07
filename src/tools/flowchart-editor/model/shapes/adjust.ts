/**
 * 形状「可调参数」核心机制（类 draw.io 的调整顶点）。
 *
 * 单一数据源：每个参数只声明一次（形状专属项在 `ShapeDef.adjust`，
 * 通用项按 `draw` / `decor` 自动派生，如圆角、折角、斜切、分栏高……），
 * 绘制层、画布手柄、属性面板、draw.io 导入导出四端共用同一份声明与解析器，
 * 避免 20+ 处参数各写一套交互与映射逻辑。
 *
 * 约定：入参 `w` / `h` 为节点像素尺寸；所有函数对尺寸做防御处理（不产生 NaN）。
 */

import { type FlowNodeStyle, SWIMLANE_HEADER_HEIGHT, SWIMLANE_HEADER_WIDTH } from '../types';
import type { ShapeDef } from './index';

/** 参数取值读取器：键 → 数值（已按 min/max 夹取）；供绘制层复用 */
export type ParamGetter = (key: string) => number;

/** 节点本地坐标系中的点 */
export interface AdjustPoint {
  x: number;
  y: number;
}

/** mxGraph（draw.io）双向映射：把可调参数写入 / 读出 `size` 等 token */
export interface AdjustMx {
  /** mxGraph token 名，如 'size' | 'arcSize' */
  key: string;
  /** 取值 → token 值字符串 */
  to: (value: number, w: number, h: number) => string;
  /** token 值 → 取值；解析失败返回 null（此时该 token 会原样保留在 mxStyle 中） */
  from: (raw: string, w: number, h: number) => number | null;
}

/** 单个可调参数的声明式元数据；四端共用 */
export interface ShapeAdjustDef {
  key: string;
  /** i18n 后缀：`tools.flowchart.shapeParam.*` */
  labelKey: string;
  unit: 'px' | 'ratio';
  default: (w: number, h: number) => number;
  min: (w: number, h: number) => number;
  max: (w: number, h: number) => number;
  /** 取值 → 手柄在节点本地坐标 */
  anchor: (w: number, h: number, value: number) => AdjustPoint;
  /** 指针本地坐标 → 新取值 */
  project: (x: number, y: number, w: number, h: number) => number;
  mx?: AdjustMx;
}

/* ------------------------------ mx 映射助手 ------------------------------ */

/** 绝对像素参数 → `size=<px>`；导入时把 ≤1 的值视作 draw.io 比例（× 参考尺寸）还原 */
export function pxMx(ref: (w: number, h: number) => number): AdjustMx {
  return {
    key: 'size',
    to: (v) => String(Math.round(v)),
    from: (raw, w, h) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return n <= 1 ? n * ref(w, h) : n;
    },
  };
}

/** 比例参数 → `size=<ratio>`（draw.io 的比例语义） */
export function ratioMx(): AdjustMx {
  return {
    key: 'size',
    to: (v) => String(Math.round(v * 1000) / 1000),
    from: (raw) => {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    },
  };
}

/** 圆角 → `arcSize`（沿用既有导出约定：arcSize = cornerRadius / 2） */
function arcSizeMx(): AdjustMx {
  return {
    key: 'arcSize',
    to: (v) => String(Math.round((v / 2) * 100) / 100),
    from: (raw) => {
      const n = Number(raw);
      return Number.isFinite(n) ? n * 2 : null;
    },
  };
}

/* ------------------------------ 线性轴工厂 ------------------------------ */

export interface LinearAdjustOptions {
  key: string;
  labelKey: string;
  unit?: 'px' | 'ratio';
  /** 拖动主轴 */
  axis: 'x' | 'y';
  /** 取值 = 主轴坐标 × scale(w,h) + bias(w,h)，默认 scale=1 / bias=0 */
  scale?: (w: number, h: number) => number;
  bias?: (w: number, h: number) => number;
  /** 另一轴上手柄的坐标（可随取值变化） */
  cross: number | ((w: number, h: number, value: number) => number);
  default: (w: number, h: number) => number;
  min?: (w: number, h: number) => number;
  max: (w: number, h: number) => number;
  mx?: AdjustMx;
}

/** 沿单一轴拖动的可调参数：手柄位置与指针投影互为逆变换 */
export function axisAdjust(o: LinearAdjustOptions): ShapeAdjustDef {
  const scale = o.scale ?? (() => 1);
  const bias = o.bias ?? (() => 0);
  const min = o.min ?? (() => 0);
  const crossOf =
    typeof o.cross === 'function' ? o.cross : () => (typeof o.cross === 'number' ? o.cross : 0);
  return {
    key: o.key,
    labelKey: o.labelKey,
    unit: o.unit ?? 'px',
    default: o.default,
    min,
    max: o.max,
    project: (x, y, w, h) => (o.axis === 'x' ? x : y) * scale(w, h) + bias(w, h),
    anchor: (w, h, value) => {
      const coord = (value - bias(w, h)) / scale(w, h);
      return o.axis === 'x'
        ? { x: coord, y: crossOf(w, h, value) }
        : { x: crossOf(w, h, value), y: coord };
    },
    mx: o.mx,
  };
}

/** 右上角折角（便签 / 卡片 / 制品 / 数据对象）：值 = 折角边长 px */
export function foldAdjust(
  labelKey: string,
  dflt: (w: number, h: number) => number,
): ShapeAdjustDef {
  return axisAdjust({
    key: 'foldSize',
    labelKey,
    axis: 'x',
    scale: () => -1,
    bias: (w) => w,
    cross: (_w, _h, value) => value,
    default: dflt,
    max: (w, h) => Math.min(w, h) * 0.9,
    mx: pxMx((w, h) => Math.min(w, h)),
  });
}

/* ------------------------------ 派生规则 ------------------------------ */

/** 只读缓存：同一 ShapeDef 的派生结果复用，避免渲染热路径重复分配 */
const adjustCache = new WeakMap<ShapeDef, ShapeAdjustDef[]>();

/** 由 `draw` / `decor` 自动派生的通用参数（顺序即面板显示顺序，置于形状专属项之前） */
function derivedAdjusts(def: ShapeDef): ShapeAdjustDef[] {
  const out: ShapeAdjustDef[] = [];
  switch (def.draw) {
    case 'rect':
      out.push(
        axisAdjust({
          key: 'cornerRadius',
          labelKey: 'cornerRadius',
          axis: 'x',
          cross: 0,
          default: () => 4,
          max: (w, h) => Math.min(w, h) / 2,
          mx: arcSizeMx(),
        }),
      );
      break;
    case 'roundRect':
      out.push(
        axisAdjust({
          key: 'cornerRadius',
          labelKey: 'cornerRadius',
          axis: 'x',
          cross: 0,
          default: () => 10,
          max: (w, h) => Math.min(w, h) / 2,
          mx: arcSizeMx(),
        }),
      );
      break;
    case 'note':
      out.push(foldAdjust('foldSize', (w) => Math.min(16, w * 0.13)));
      break;
    case 'card':
      out.push(foldAdjust('foldSize', (w, h) => Math.min(22, w * 0.22, h * 0.5)));
      break;
    case 'parallelogram':
    case 'invParallelogram':
      out.push(
        axisAdjust({
          key: 'skew',
          labelKey: 'skew',
          axis: 'x',
          cross: 0,
          default: (_w, h) => h * 0.25,
          max: (w) => w * 0.8,
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'trapezoid':
    case 'invTrapezoid':
    case 'hexagon':
      out.push(
        axisAdjust({
          key: 'inset',
          labelKey: 'inset',
          axis: 'x',
          cross: 0,
          default: (w) => w * 0.16,
          max: (w) => w * 0.45,
          mx: pxMx((w) => w),
        }),
      );
      break;
    case 'cylinder':
      out.push(
        axisAdjust({
          key: 'capHeight',
          labelKey: 'capHeight',
          axis: 'y',
          cross: (w) => w / 2,
          default: (w, h) => Math.min(h * 0.16, w * 0.22),
          max: (w, h) => Math.min(h * 0.45, w * 0.5),
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'document':
      out.push(
        axisAdjust({
          key: 'waveHeight',
          labelKey: 'waveHeight',
          axis: 'y',
          scale: () => -1,
          bias: (_w, h) => h,
          cross: (w) => w / 2,
          default: (_w, h) => Math.min(14, h * 0.2),
          max: (_w, h) => h * 0.5,
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'chevron':
      out.push(
        axisAdjust({
          key: 'chevronDepth',
          labelKey: 'chevronDepth',
          axis: 'x',
          cross: (_w, h) => h / 2,
          default: (w) => w * 0.38,
          max: (w) => w * 0.8,
          mx: pxMx((w) => w),
        }),
      );
      break;
    case 'callout':
      out.push(
        axisAdjust({
          key: 'calloutTail',
          labelKey: 'calloutTail',
          axis: 'y',
          scale: () => -1,
          bias: (_w, h) => h,
          cross: (w) => w / 2,
          default: (_w, h) => h * 0.2,
          max: (_w, h) => h * 0.6,
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'plus':
    case 'cross':
      out.push(
        axisAdjust({
          key: 'plusArm',
          labelKey: 'plusArm',
          unit: 'ratio',
          axis: 'x',
          scale: (w) => 1 / Math.max(1, w),
          cross: 0,
          default: () => 0.34,
          min: () => 0.05,
          max: () => 0.5,
          mx: ratioMx(),
        }),
      );
      break;
    case 'arrow':
      out.push(
        axisAdjust({
          key: 'arrowHead',
          labelKey: 'arrowHead',
          axis: 'x',
          scale: () => -1,
          bias: (w) => w,
          cross: (_w, h) => h / 2,
          default: (w) => w * 0.38,
          max: (w) => w * 0.8,
          mx: pxMx((w) => w),
        }),
      );
      break;
    case 'bracket':
      out.push(
        axisAdjust({
          key: 'bracketArm',
          labelKey: 'bracketArm',
          axis: 'y',
          cross: (w) => w / 2,
          default: (w, h) => Math.min(w * 0.3, h * 0.28),
          max: (_w, h) => h * 0.45,
          mx: pxMx((_w, h) => h),
        }),
      );
      break;
    case 'star':
      out.push(
        axisAdjust({
          key: 'starInner',
          labelKey: 'starInner',
          unit: 'ratio',
          axis: 'x',
          scale: (w) => 1 / Math.max(1, w),
          cross: (_w, h) => h / 2,
          default: () => 0.44,
          min: () => 0.1,
          max: () => 0.9,
          mx: ratioMx(),
        }),
      );
      break;
    case 'laneH':
      out.push(
        axisAdjust({
          key: 'laneHeader',
          labelKey: 'laneHeader',
          axis: 'x',
          cross: (_w, h) => h / 2,
          default: () => SWIMLANE_HEADER_WIDTH,
          min: () => 16,
          max: (w) => Math.max(24, w * 0.5),
          mx: pxMx(() => 1),
        }),
      );
      break;
    case 'laneV':
      out.push(
        axisAdjust({
          key: 'laneHeader',
          labelKey: 'laneHeader',
          axis: 'y',
          cross: (w) => w / 2,
          default: () => SWIMLANE_HEADER_HEIGHT,
          min: () => 16,
          max: (_w, h) => Math.max(24, h * 0.5),
          mx: pxMx(() => 1),
        }),
      );
      break;
    default:
      break;
  }
  return out;
}

/** 内部分栏（decor === 'compartments'）：两处分隔线高度 */
const COMPARTMENT_ADJUSTS: ShapeAdjustDef[] = [
  axisAdjust({
    key: 'dividerTop',
    labelKey: 'dividerTop',
    axis: 'y',
    cross: (w) => w / 2,
    default: (_w, h) => h * 0.34,
    min: () => 8,
    max: (_w, h) => h - 8,
    mx: pxMx((_w, h) => h),
  }),
  axisAdjust({
    key: 'dividerBottom',
    labelKey: 'dividerBottom',
    axis: 'y',
    cross: (w) => w / 2,
    default: (_w, h) => h * 0.67,
    min: () => 8,
    max: (_w, h) => h - 8,
  }),
];

/**
 * 某形状的全部可调参数（派生项 + `ShapeDef.adjust` 声明项）。
 * 结果按 ShapeDef 缓存，渲染热路径零额外分配。
 */
export function adjustsFor(def: ShapeDef): ShapeAdjustDef[] {
  const cached = adjustCache.get(def);
  if (cached) return cached;
  const list = [...derivedAdjusts(def), ...(def.adjust ?? [])];
  if (def.decor === 'compartments') list.push(...COMPARTMENT_ADJUSTS);
  adjustCache.set(def, list);
  return list;
}

/** 是否具备可调参数（决定是否渲染手柄 / 面板分组） */
export function hasAdjusts(def: ShapeDef | undefined): boolean {
  return !!def && adjustsFor(def).length > 0;
}

/* ------------------------------ 解析器 ------------------------------ */

/**
 * 读取参数值：优先 `style.shapeParams[key]`，为兼容旧草稿回退 `foldSize` / `cornerRadius`，
 * 否则取该形状声明的默认值，最后按 min/max 夹取（含 NaN 防御）。
 */
export function paramValue(
  def: ShapeDef,
  style: Partial<FlowNodeStyle> | undefined,
  key: string,
  w: number,
  h: number,
): number {
  const adj = adjustsFor(def).find((a) => a.key === key);
  const fallback = adj ? adj.default(w, h) : 0;
  let raw = style?.shapeParams?.[key];
  if (raw === undefined) {
    if (key === 'foldSize') raw = style?.foldSize;
    else if (key === 'cornerRadius') raw = style?.cornerRadius;
  }
  if (raw === undefined || !Number.isFinite(raw)) return fallback;
  if (!adj) return raw;
  const min = adj.min(w, h);
  const max = adj.max(w, h);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback;
  return Math.max(min, Math.min(max, raw));
}

/** 构造某形状的参数读取器，供绘制层与手柄复用 */
export function paramGetterFor(
  def: ShapeDef,
  style: Partial<FlowNodeStyle> | undefined,
  w: number,
  h: number,
): ParamGetter {
  return (key) => paramValue(def, style, key, w, h);
}

/** 指针本地坐标 → 夹取后的参数值（画布拖拽用） */
export function projectAdjust(
  adj: ShapeAdjustDef,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const raw = adj.project(x, y, w, h);
  if (!Number.isFinite(raw)) return adj.default(w, h);
  return Math.max(adj.min(w, h), Math.min(adj.max(w, h), raw));
}
