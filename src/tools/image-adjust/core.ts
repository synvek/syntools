/**
 * 图片调色：亮度 / 对比度 / 饱和度 / 色相 → CSS filter 字符串。
 */

export interface AdjustOptions {
  /** 百分比，100 = 原图 */
  brightness: number;
  contrast: number;
  saturate: number;
  /** 色相旋转角度 */
  hue: number;
}

export const DEFAULT_ADJUST: AdjustOptions = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hue: 0,
};

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}

export function clampAdjust(raw: Partial<AdjustOptions>): AdjustOptions {
  const pct = (v: unknown, fallback: number) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(200, Math.max(0, Math.round(x)));
  };
  const hue = Number(raw.hue);
  return {
    brightness: pct(raw.brightness, DEFAULT_ADJUST.brightness),
    contrast: pct(raw.contrast, DEFAULT_ADJUST.contrast),
    saturate: pct(raw.saturate, DEFAULT_ADJUST.saturate),
    hue: Number.isFinite(hue) ? Math.min(180, Math.max(-180, Math.round(hue))) : 0,
  };
}

export function buildCssFilter(options: AdjustOptions): string {
  const o = clampAdjust(options);
  return [
    `brightness(${o.brightness}%)`,
    `contrast(${o.contrast}%)`,
    `saturate(${o.saturate}%)`,
    `hue-rotate(${o.hue}deg)`,
  ].join(' ');
}

export function isIdentityAdjust(options: AdjustOptions): boolean {
  const o = clampAdjust(options);
  return (
    o.brightness === 100 && o.contrast === 100 && o.saturate === 100 && o.hue === 0
  );
}
