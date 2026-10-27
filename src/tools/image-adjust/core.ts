/**
 * Image color adjustment: brightness / contrast / saturation / hue → CSS filter string.
 */

export interface AdjustOptions {
  /** Percentage, 100 = original image */
  brightness: number;
  contrast: number;
  saturate: number;
  /** Hue rotation angle */
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
  return o.brightness === 100 && o.contrast === 100 && o.saturate === 100 && o.hue === 0;
}
