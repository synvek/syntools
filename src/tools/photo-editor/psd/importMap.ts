import {
  createColorOverlay,
  createDropShadow,
  createInnerShadow,
  createOuterGlow,
  createStroke,
} from '../core';
import type { BlendMode, LayerStyle } from '../model/types';

/**
 * PSD → 我们的模型的映射（纯函数，可单测）。
 *
 * ag-psd 的结构体字段多且互相可选，直接散在读取流程里会变成「改一处漏一处」。
 * 这里只声明**我们真正读取的字段**（结构化子集），既避免绑定它的完整类型，
 * 也让映射规则能脱离真实 PSD 文件被测试覆盖。
 */

export type PsdBlendName = string;

/** 我们的混合模式 ↔ PSD 名称：写出用的是「带空格的写法」，读入按同表反向映射 */
const PSD_TO_BLEND: Record<string, BlendMode> = {
  normal: 'normal',
  // PSD 的「穿透」不是混合模式，读入时按正常处理（组内穿透由组自身的 passThrough 表达）
  'pass through': 'normal',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  'soft light': 'soft-light',
  'hard light': 'hard-light',
  darken: 'darken',
  lighten: 'lighten',
  'color dodge': 'color-dodge',
  'color burn': 'color-burn',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

export function mapPsdBlendMode(mode: PsdBlendName | undefined): BlendMode {
  return PSD_TO_BLEND[(mode ?? 'normal').toLowerCase()] ?? 'normal';
}

export interface PsdColor {
  r: number;
  g: number;
  b: number;
}

/** PSD 颜色（0~255 分量）→ `#RRGGBB`；缺省回落黑色 */
export function mapPsdColor(color: PsdColor | undefined): string {
  const to = (value: number | undefined) =>
    Math.max(0, Math.min(255, Math.round(value ?? 0)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(color?.r)}${to(color?.g)}${to(color?.b)}`.toUpperCase();
}

export interface PsdDropShadow {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
  angle?: number;
  distance?: { units?: string; value?: number } | number;
  /**
   * 「扩展」在 PSD 描述符里叫 `choke`（ag-psd 读出来的就是它），
   * `spread` 是其它实现（以及部分工具的导出）使用的别名，两个都认。
   */
  choke?: { units?: string; value?: number } | number;
  spread?: { units?: string; value?: number } | number;
  blur?: { units?: string; value?: number } | number;
  size?: { units?: string; value?: number } | number;
}

export interface PsdInnerShadow {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
  angle?: number;
  distance?: { value?: number } | number;
  blur?: { value?: number } | number;
  size?: { value?: number } | number;
}

export interface PsdGlowLike {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
  blur?: { value?: number } | number;
  size?: { value?: number } | number;
}

export interface PsdSolidFill {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
}

export interface PsdStroke {
  enabled?: boolean;
  color?: PsdColor;
  opacity?: number;
  size?: { value?: number } | number;
  position?: string;
}

export interface PsdEffects {
  dropShadow?: PsdDropShadow[];
  innerShadow?: PsdInnerShadow[];
  outerGlow?: PsdGlowLike | PsdGlowLike[];
  solidFill?: PsdSolidFill | PsdSolidFill[];
  stroke?: PsdStroke | PsdStroke[];
}

/** PSD 的尺寸值是 `{ units, value }`（有些字段直接给数字） */
function sizeOf(value: PsdDropShadow['distance']): number {
  if (typeof value === 'number') return value;
  const raw = value?.value ?? 0;
  return Math.abs(Number.isFinite(raw) ? raw : 0);
}

function first<T extends { enabled?: boolean }>(value: T | T[] | undefined): T | undefined {
  if (Array.isArray(value)) return value.find((item) => item?.enabled !== false) ?? value[0];
  return value;
}

function hexWithAlpha(
  color: PsdColor | undefined,
  opacity: number | undefined,
): {
  color: string;
  opacity: number;
} {
  return {
    color: mapPsdColor(color),
    // ag-psd 的 opacity 走 FixedPoint8，取值 0~1（不是 PS 界面上的百分比）；缺省按完全不透明
    opacity: Math.max(0, Math.min(1, opacity ?? 1)),
  };
}

/**
 * 图层效果 → 图层样式。
 *
 * 只映射我们**确实能渲染**的五种效果；PSD 里其它效果（图案叠加 / 渐变叠加 / 斜面和浮雕…）
 * 会被静默忽略 —— 宁可少读，也不要读成一个渲染不出来的半成品。
 * 返回 null 表示「这份 PSD 没有我们支持的图层效果」。
 */
export function mapPsdEffects(effects: PsdEffects | undefined): LayerStyle | null {
  if (!effects) return null;
  const style: LayerStyle = {};
  const shadow = effects.dropShadow?.find((item) => item.enabled !== false);
  if (shadow) {
    const base = createDropShadow();
    const paint = hexWithAlpha(shadow.color, shadow.opacity);
    style.dropShadow = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
      angle: shadow.angle ?? base.angle,
      distance: sizeOf(shadow.distance),
      spread: sizeOf(shadow.choke ?? shadow.spread),
      size: sizeOf(shadow.blur ?? shadow.size),
    };
  }
  const inner = effects.innerShadow?.find((item) => item.enabled !== false);
  if (inner) {
    const base = createInnerShadow();
    const paint = hexWithAlpha(inner.color, inner.opacity);
    style.innerShadow = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
      angle: inner.angle ?? base.angle,
      distance: sizeOf(inner.distance),
      size: sizeOf(inner.blur ?? inner.size),
    };
  }
  const glow = first(effects.outerGlow);
  if (glow) {
    const base = createOuterGlow();
    const paint = hexWithAlpha(glow.color, glow.opacity);
    style.outerGlow = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
      size: sizeOf(glow.blur ?? glow.size),
    };
  }
  const fill = first(effects.solidFill);
  if (fill) {
    const base = createColorOverlay();
    const paint = hexWithAlpha(fill.color, fill.opacity);
    style.colorOverlay = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
    };
  }
  const stroke = first(effects.stroke);
  if (stroke) {
    const base = createStroke();
    const paint = hexWithAlpha(stroke.color, stroke.opacity);
    style.stroke = {
      ...base,
      enabled: true,
      color: paint.color,
      opacity: paint.opacity,
      size: sizeOf(stroke.size),
      position:
        stroke.position === 'inside' || stroke.position === 'center' ? stroke.position : 'outside',
    };
  }
  return Object.keys(style).length > 0 ? style : null;
}

/** 图层的矩形（PSD 用 left/top/right/bottom 表达） */
export interface PsdBounds {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

export interface PsdRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function mapPsdBounds(bounds: PsdBounds | undefined): PsdRect | null {
  if (!bounds) return null;
  const left = Math.round(bounds.left ?? 0);
  const top = Math.round(bounds.top ?? 0);
  const width = Math.round((bounds.right ?? left) - left);
  const height = Math.round((bounds.bottom ?? top) - top);
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}
