/**
 * 图片转卡片：外层背景 + 内层图文一体区块。
 */

export type ImageCardTextPosition = 'below' | 'above';
export type ImageCardAlign = 'left' | 'center' | 'right';
export type ImageCardBackdropMode = 'preset' | 'color' | 'gradient';

export type ImageCardBackdropPresetId =
  | 'paper'
  | 'fog'
  | 'night'
  | 'mint'
  | 'sand'
  | 'ink'
  | 'sunset'
  | 'ocean'
  | 'lavender'
  | 'peach'
  | 'aurora'
  | 'charcoal';

export const IMAGE_CARD_BACKDROP_PRESETS: ImageCardBackdropPresetId[] = [
  'paper',
  'fog',
  'night',
  'mint',
  'sand',
  'ink',
  'sunset',
  'ocean',
  'lavender',
  'peach',
  'aurora',
  'charcoal',
];

export const IMAGE_CARD_BACKDROP_CSS: Record<ImageCardBackdropPresetId, string> = {
  paper: '#f8fafc',
  fog: 'linear-gradient(160deg, #f5f7fa 0%, #c3cfe2 100%)',
  night: 'linear-gradient(160deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  mint: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)',
  sand: 'linear-gradient(135deg, #fffbeb 0%, #fde68a 100%)',
  ink: '#18181b',
  sunset: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)',
  ocean: 'linear-gradient(180deg, #2193b0 0%, #6dd5ed 100%)',
  lavender: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  peach: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  aurora: 'linear-gradient(120deg, #00c6ff 0%, #0072ff 33%, #7b2ff7 66%, #f107a3 100%)',
  charcoal: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
};

export const IMAGE_CARD_ALIGNS: ImageCardAlign[] = ['left', 'center', 'right'];
export const IMAGE_CARD_POSITIONS: ImageCardTextPosition[] = ['below', 'above'];
export const IMAGE_CARD_BACKDROP_MODES: ImageCardBackdropMode[] = [
  'preset',
  'color',
  'gradient',
];

export interface ImageCardOptions {
  padding: number;
  radius: number;
  shadow: boolean;
  width: number;
  textPosition: ImageCardTextPosition;
  textBg: string;
  textAlign: ImageCardAlign;
  textPadding: number;
  titleSize: number;
  subtitleSize: number;
  rotate: number;
  backdropMode: ImageCardBackdropMode;
  backdropPreset: ImageCardBackdropPresetId;
  backdropColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
}

export const DEFAULT_IMAGE_CARD: ImageCardOptions = {
  padding: 24,
  radius: 16,
  shadow: true,
  width: 640,
  textPosition: 'below',
  textBg: '#ffffff',
  textAlign: 'left',
  textPadding: 16,
  titleSize: 18,
  subtitleSize: 13,
  rotate: 0,
  backdropMode: 'preset',
  backdropPreset: 'fog',
  backdropColor: '#e2e8f0',
  gradientFrom: '#3b82f6',
  gradientTo: '#ec4899',
  gradientAngle: 135,
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isImageFile(type: string): boolean {
  return type.startsWith('image/');
}

export function normalizeHexColor(raw: string, fallback: string): string {
  const v = raw.trim();
  if (!HEX.test(v)) return fallback;
  if (v.length === 4) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return v.toLowerCase();
}

export function isImageCardBackdropPresetId(v: string): v is ImageCardBackdropPresetId {
  return IMAGE_CARD_BACKDROP_PRESETS.includes(v as ImageCardBackdropPresetId);
}

export function isImageCardAlign(v: string): v is ImageCardAlign {
  return IMAGE_CARD_ALIGNS.includes(v as ImageCardAlign);
}

export function isImageCardTextPosition(v: string): v is ImageCardTextPosition {
  return IMAGE_CARD_POSITIONS.includes(v as ImageCardTextPosition);
}

export function isImageCardBackdropMode(v: string): v is ImageCardBackdropMode {
  return IMAGE_CARD_BACKDROP_MODES.includes(v as ImageCardBackdropMode);
}

export function clampImageCard(raw: Partial<ImageCardOptions>): ImageCardOptions {
  const n = (v: unknown, min: number, max: number, fallback: number) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(max, Math.max(min, Math.round(x)));
  };
  const nf = (v: unknown, min: number, max: number, fallback: number) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(max, Math.max(min, Math.round(x * 10) / 10));
  };
  return {
    padding: n(raw.padding, 8, 80, DEFAULT_IMAGE_CARD.padding),
    radius: n(raw.radius, 0, 48, DEFAULT_IMAGE_CARD.radius),
    shadow: raw.shadow !== false,
    width: n(raw.width, 240, 1000, DEFAULT_IMAGE_CARD.width),
    textPosition: isImageCardTextPosition(String(raw.textPosition))
      ? raw.textPosition!
      : DEFAULT_IMAGE_CARD.textPosition,
    textBg: normalizeHexColor(String(raw.textBg ?? ''), DEFAULT_IMAGE_CARD.textBg),
    textAlign: isImageCardAlign(String(raw.textAlign))
      ? raw.textAlign!
      : DEFAULT_IMAGE_CARD.textAlign,
    textPadding: n(raw.textPadding, 4, 48, DEFAULT_IMAGE_CARD.textPadding),
    titleSize: n(raw.titleSize, 12, 48, DEFAULT_IMAGE_CARD.titleSize),
    subtitleSize: n(raw.subtitleSize, 10, 36, DEFAULT_IMAGE_CARD.subtitleSize),
    rotate: nf(raw.rotate, -180, 180, DEFAULT_IMAGE_CARD.rotate),
    backdropMode: isImageCardBackdropMode(String(raw.backdropMode))
      ? raw.backdropMode!
      : DEFAULT_IMAGE_CARD.backdropMode,
    backdropPreset: isImageCardBackdropPresetId(String(raw.backdropPreset))
      ? raw.backdropPreset!
      : DEFAULT_IMAGE_CARD.backdropPreset,
    backdropColor: normalizeHexColor(
      String(raw.backdropColor ?? ''),
      DEFAULT_IMAGE_CARD.backdropColor,
    ),
    gradientFrom: normalizeHexColor(
      String(raw.gradientFrom ?? ''),
      DEFAULT_IMAGE_CARD.gradientFrom,
    ),
    gradientTo: normalizeHexColor(String(raw.gradientTo ?? ''), DEFAULT_IMAGE_CARD.gradientTo),
    gradientAngle: n(raw.gradientAngle, 0, 360, DEFAULT_IMAGE_CARD.gradientAngle),
  };
}

export function resolveBackdropCss(options: ImageCardOptions): string {
  if (options.backdropMode === 'color') return options.backdropColor;
  if (options.backdropMode === 'gradient') {
    const angle = ((options.gradientAngle % 360) + 360) % 360;
    return `linear-gradient(${angle}deg, ${options.gradientFrom}, ${options.gradientTo})`;
  }
  return IMAGE_CARD_BACKDROP_CSS[options.backdropPreset];
}
