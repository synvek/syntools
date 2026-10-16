import { hexToRgb } from '../core';
import type { LayerStyle } from '../model/types';

/**
 * 图层样式 → PSD 图层效果（写出侧映射，纯函数）。
 *
 * 与 `./importMap.ts` 的读入方向对称：读入时 PSD 名称 → 我们的取值，写出时反向。
 *
 * 两个**单位陷阱**（都靠「写出 → ag-psd 读回 → 映射」的往返测试兜住）：
 * 1. ag-psd 的 `opacity` 走 `FixedPoint8`，取值是 **0~1**，不是 PS 界面上的百分比；
 * 2. 尺寸类字段必须是 `{ units: 'Pixels', value }`，直接写数字会被序列化成 0。
 */

/** 只声明我们写入的字段，避免绑定 ag-psd 的完整类型（运行时仍然动态 import） */
export interface PsdEffectColor {
  r: number;
  g: number;
  b: number;
}

export interface PsdUnitsValue {
  units: 'Pixels';
  value: number;
}

export interface PsdShadowEffect {
  present: boolean;
  showInDialog: boolean;
  enabled: boolean;
  size: PsdUnitsValue;
  angle: number;
  distance: PsdUnitsValue;
  color: PsdEffectColor;
  blendMode: string;
  opacity: number;
  useGlobalLight: boolean;
  antialiased: boolean;
  choke?: PsdUnitsValue;
  layerConceals?: boolean;
}

export interface PsdGlowEffect {
  present: boolean;
  showInDialog: boolean;
  enabled: boolean;
  size: PsdUnitsValue;
  color: PsdEffectColor;
  blendMode: string;
  opacity: number;
  source: 'edge' | 'center';
  antialiased: boolean;
  range: number;
}

export interface PsdSolidFillEffect {
  present: boolean;
  showInDialog: boolean;
  enabled: boolean;
  blendMode: string;
  color: PsdEffectColor;
  opacity: number;
}

export interface PsdStrokeEffect {
  present: boolean;
  showInDialog: boolean;
  enabled: boolean;
  size: PsdUnitsValue;
  position: 'inside' | 'center' | 'outside';
  fillType: 'color';
  blendMode: string;
  opacity: number;
  color: PsdEffectColor;
  overprint: boolean;
}

export interface PsdLayerEffects {
  disabled?: boolean;
  dropShadow?: PsdShadowEffect[];
  innerShadow?: PsdShadowEffect[];
  outerGlow?: PsdGlowEffect;
  solidFill?: PsdSolidFillEffect[];
  stroke?: PsdStrokeEffect[];
}

const pixels = (value: number): PsdUnitsValue => ({
  units: 'Pixels',
  value: Math.max(0, Math.round(value)),
});

function colorOf(hex: string): PsdEffectColor {
  const parsed = hexToRgb(hex);
  // 解析失败回落黑色：宁可在 PS 里看到一个黑效果，也不要写出非法描述符让文件打不开
  return parsed ? { r: parsed.r, g: parsed.g, b: parsed.b } : { r: 0, g: 0, b: 0 };
}

const clampOpacity = (value: number) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 1));

/**
 * 图层样式 → PSD 图层效果。
 *
 * 只写我们**确实能渲染**的五种效果；`enabled: false` 的效果按「存在但停用」写出，
 * 而不是直接丢弃 —— 用户关掉效果只是临时行为，参数应当保留。
 * 全部效果都为空时返回 `undefined`：让 ag-psd 完全跳过 `lfx2` 段。
 */
export function toPsdEffects(style: LayerStyle | null | undefined): PsdLayerEffects | undefined {
  if (!style) return undefined;
  const effects: PsdLayerEffects = {};

  const shadow = style.dropShadow;
  if (shadow) {
    effects.dropShadow = [
      {
        present: true,
        showInDialog: true,
        enabled: shadow.enabled,
        size: pixels(shadow.size),
        angle: shadow.angle,
        distance: pixels(shadow.distance),
        color: colorOf(shadow.color),
        // 我们的投影是按 alpha 直接叠加（等价于正常混合），写成 multiply 会让 PS 里偏暗
        blendMode: 'normal',
        opacity: clampOpacity(shadow.opacity),
        useGlobalLight: false,
        antialiased: true,
        choke: pixels(shadow.spread),
        layerConceals: true,
      },
    ];
  }

  const inner = style.innerShadow;
  if (inner) {
    effects.innerShadow = [
      {
        present: true,
        showInDialog: true,
        enabled: inner.enabled,
        size: pixels(inner.size),
        angle: inner.angle,
        distance: pixels(inner.distance),
        color: colorOf(inner.color),
        blendMode: 'normal',
        opacity: clampOpacity(inner.opacity),
        useGlobalLight: false,
        antialiased: true,
      },
    ];
  }

  const glow = style.outerGlow;
  if (glow) {
    effects.outerGlow = {
      present: true,
      showInDialog: true,
      enabled: glow.enabled,
      size: pixels(glow.size),
      color: colorOf(glow.color),
      blendMode: 'normal',
      opacity: clampOpacity(glow.opacity),
      source: 'edge',
      antialiased: true,
      range: 50,
    };
  }

  const overlay = style.colorOverlay;
  if (overlay) {
    effects.solidFill = [
      {
        present: true,
        showInDialog: true,
        enabled: overlay.enabled,
        blendMode: 'normal',
        color: colorOf(overlay.color),
        opacity: clampOpacity(overlay.opacity),
      },
    ];
  }

  const stroke = style.stroke;
  if (stroke) {
    effects.stroke = [
      {
        present: true,
        showInDialog: true,
        enabled: stroke.enabled,
        size: pixels(stroke.size),
        position: stroke.position,
        fillType: 'color',
        blendMode: 'normal',
        opacity: clampOpacity(stroke.opacity),
        color: colorOf(stroke.color),
        overprint: false,
      },
    ];
  }

  return hasAnyEffect(effects) ? effects : undefined;
}

function hasAnyEffect(effects: PsdLayerEffects): boolean {
  return Boolean(
    effects.dropShadow ||
    effects.innerShadow ||
    effects.outerGlow ||
    effects.solidFill ||
    effects.stroke,
  );
}
