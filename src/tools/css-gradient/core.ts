/**
 * CSS 渐变生成器：linear / radial + color stops。
 */

export type GradientType = 'linear' | 'radial';

export interface GradientStop {
  color: string;
  position: number; // 0-100
}

export interface GradientOptions {
  type: GradientType;
  angle: number; // degrees for linear
  shape: 'circle' | 'ellipse'; // radial
  stops: GradientStop[];
}

export const DEFAULT_GRADIENT: GradientOptions = {
  type: 'linear',
  angle: 135,
  shape: 'circle',
  stops: [
    { color: '#3b82f6', position: 0 },
    { color: '#8b5cf6', position: 50 },
    { color: '#ec4899', position: 100 },
  ],
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function normalizeStops(stops: GradientStop[]): GradientStop[] {
  return [...stops]
    .map((s) => ({
      color: s.color.trim() || '#000000',
      position: Math.round(clamp(s.position, 0, 100)),
    }))
    .sort((a, b) => a.position - b.position);
}

export function buildGradientCss(options: GradientOptions): string {
  const stops = normalizeStops(options.stops);
  const stopCss = stops.map((s) => `${s.color} ${s.position}%`).join(', ');
  if (options.type === 'radial') {
    return `background: radial-gradient(${options.shape}, ${stopCss});`;
  }
  const angle = Math.round((((options.angle % 360) + 360) % 360) * 10) / 10;
  return `background: linear-gradient(${angle}deg, ${stopCss});`;
}

export function buildGradientValue(options: GradientOptions): string {
  const css = buildGradientCss(options);
  return css.replace(/^background:\s*/, '').replace(/;$/, '');
}

export {
  GRADIENT_PRESET_CATEGORY_IDS,
  GRADIENT_PRESETS,
  cloneGradientOptions,
  getPresetsByCategory,
  isGradientPresetCategoryId,
  presetToOptions,
  type GradientPreset,
  type GradientPresetCategoryId,
} from './presets';
