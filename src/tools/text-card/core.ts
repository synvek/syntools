/**
 * 文字转卡片：主题与布局参数（渲染/导出在 UI）。
 */

export type CardThemeId = 'slate' | 'ocean' | 'sunset' | 'forest' | 'mono' | 'paper';
export type TextAlign = 'left' | 'center' | 'right';

export const CARD_THEMES: CardThemeId[] = [
  'slate',
  'ocean',
  'sunset',
  'forest',
  'mono',
  'paper',
];

export interface CardThemeStyle {
  background: string;
  color: string;
  muted: string;
  border: string;
}

export const THEME_STYLES: Record<CardThemeId, CardThemeStyle> = {
  slate: {
    background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
    color: '#f8fafc',
    muted: '#94a3b8',
    border: '#334155',
  },
  ocean: {
    background: 'linear-gradient(145deg, #0c4a6e 0%, #0369a1 55%, #0ea5e9 100%)',
    color: '#f0f9ff',
    muted: '#bae6fd',
    border: '#0284c7',
  },
  sunset: {
    background: 'linear-gradient(145deg, #7c2d12 0%, #c2410c 45%, #ea580c 100%)',
    color: '#fff7ed',
    muted: '#fed7aa',
    border: '#ea580c',
  },
  forest: {
    background: 'linear-gradient(145deg, #14532d 0%, #166534 50%, #15803d 100%)',
    color: '#f0fdf4',
    muted: '#bbf7d0',
    border: '#16a34a',
  },
  mono: {
    background: '#111111',
    color: '#fafafa',
    muted: '#a3a3a3',
    border: '#404040',
  },
  paper: {
    background: '#faf7f2',
    color: '#1c1917',
    muted: '#78716c',
    border: '#e7e5e4',
  },
};

export interface TextCardOptions {
  theme: CardThemeId;
  align: TextAlign;
  fontSize: number;
  padding: number;
  radius: number;
  width: number;
}

export const DEFAULT_TEXT_CARD: TextCardOptions = {
  theme: 'slate',
  align: 'left',
  fontSize: 20,
  padding: 36,
  radius: 20,
  width: 560,
};

export function clampTextCard(raw: Partial<TextCardOptions>): TextCardOptions {
  const n = (v: unknown, min: number, max: number, fallback: number) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(max, Math.max(min, Math.round(x)));
  };
  const theme = CARD_THEMES.includes(raw.theme as CardThemeId)
    ? (raw.theme as CardThemeId)
    : DEFAULT_TEXT_CARD.theme;
  const align: TextAlign =
    raw.align === 'center' || raw.align === 'right' ? raw.align : 'left';
  return {
    theme,
    align,
    fontSize: n(raw.fontSize, 12, 48, DEFAULT_TEXT_CARD.fontSize),
    padding: n(raw.padding, 16, 72, DEFAULT_TEXT_CARD.padding),
    radius: n(raw.radius, 0, 48, DEFAULT_TEXT_CARD.radius),
    width: n(raw.width, 280, 900, DEFAULT_TEXT_CARD.width),
  };
}

export function hasCardContent(title: string, body: string): boolean {
  return Boolean(title.trim() || body.trim());
}
