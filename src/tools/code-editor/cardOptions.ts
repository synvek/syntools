import { escapeHtml } from './prism';

/**
 * Export card style model (phase 6): the options bar, export preview, image export and standalone
 * HTML all share one config, which keeps WYSIWYG consistent. Colours still come from the
 * `--ce-*` variables in `themes.ts`; this module only owns the layout variables.
 */

export type CardWindowStyle = 'mac' | 'title' | 'plain' | 'none';
export type CardShadow = 'none' | 'soft' | 'medium' | 'strong';
export type CardBackground = 'theme' | 'gradient' | 'grid' | 'transparent';

export interface CodeCardStyle {
  windowStyle: CardWindowStyle;
  /** Card padding (px) */
  padding: number;
  /** Corner radius (px) */
  radius: number;
  shadow: CardShadow;
  background: CardBackground;
  /** Watermark text; an empty string means no watermark */
  watermarkText: string;
  /** Watermark opacity (0–1) */
  watermarkOpacity: number;
  /** Highlighted line range (1-based, inclusive); treated as unset when from > to */
  highlightFrom: number;
  highlightTo: number;
  /** Card font size (px) */
  fontSize: number;
  showLineNumbers: boolean;
}

export interface CardBounds {
  padding: readonly [number, number];
  radius: readonly [number, number];
  fontSize: readonly [number, number];
  opacity: readonly [number, number];
}

export const CARD_BOUNDS: CardBounds = {
  padding: [16, 128],
  radius: [0, 24],
  fontSize: [12, 20],
  opacity: [0, 1],
};

/** Export scale factors (matching Carbon's 1x / 2x / 4x) */
export const CARD_SCALES = [1, 2, 4] as const;
export type CardScale = (typeof CARD_SCALES)[number];

export const CARD_WINDOW_STYLES: readonly CardWindowStyle[] = ['mac', 'title', 'plain', 'none'];
export const CARD_SHADOWS: readonly CardShadow[] = ['none', 'soft', 'medium', 'strong'];
export const CARD_BACKGROUNDS: readonly CardBackground[] = [
  'theme',
  'gradient',
  'grid',
  'transparent',
];

export const DEFAULT_CARD_STYLE: CodeCardStyle = {
  windowStyle: 'mac',
  padding: 20,
  radius: 12,
  shadow: 'soft',
  background: 'theme',
  watermarkText: '',
  watermarkOpacity: 0.6,
  highlightFrom: 0,
  highlightTo: 0,
  fontSize: 13,
  showLineNumbers: false,
};

function clamp(value: number, [min, max]: readonly [number, number], fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}

/** Clamp without rounding (opacity is a 0–1 fraction) */
function clampFloat(
  value: number,
  [min, max]: readonly [number, number],
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, min), max);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Normalise with bounds clamping: draft and shared-link values are untrusted, so all go through here */
export function normalizeCardStyle(
  input: Partial<CodeCardStyle> | null | undefined,
): CodeCardStyle {
  const source = input ?? {};
  const highlightFrom = Number.isFinite(source.highlightFrom)
    ? Math.max(0, Math.round(source.highlightFrom as number))
    : 0;
  const highlightTo = Number.isFinite(source.highlightTo)
    ? Math.max(0, Math.round(source.highlightTo as number))
    : 0;
  return {
    windowStyle: pick(source.windowStyle, CARD_WINDOW_STYLES, DEFAULT_CARD_STYLE.windowStyle),
    padding: clamp(source.padding as number, CARD_BOUNDS.padding, DEFAULT_CARD_STYLE.padding),
    radius: clamp(source.radius as number, CARD_BOUNDS.radius, DEFAULT_CARD_STYLE.radius),
    shadow: pick(source.shadow, CARD_SHADOWS, DEFAULT_CARD_STYLE.shadow),
    background: pick(source.background, CARD_BACKGROUNDS, DEFAULT_CARD_STYLE.background),
    watermarkText:
      typeof source.watermarkText === 'string' ? source.watermarkText.slice(0, 60) : '',
    watermarkOpacity: clampFloat(
      source.watermarkOpacity as number,
      CARD_BOUNDS.opacity,
      DEFAULT_CARD_STYLE.watermarkOpacity,
    ),
    // from > to counts as unset (avoids inverted ranges)
    highlightFrom: highlightTo > 0 && highlightFrom > highlightTo ? 0 : highlightFrom,
    highlightTo,
    fontSize: clamp(source.fontSize as number, CARD_BOUNDS.fontSize, DEFAULT_CARD_STYLE.fontSize),
    showLineNumbers: source.showLineNumbers === true,
  };
}

/** Whether the line falls inside the configured highlight range */
export function isHighlightedLine(style: CodeCardStyle, line: number): boolean {
  if (style.highlightFrom <= 0 || style.highlightTo < style.highlightFrom) return false;
  return line >= style.highlightFrom && line <= style.highlightTo;
}

const SHADOW_CSS: Record<CardShadow, string> = {
  none: 'none',
  soft: '0 6px 18px rgba(0, 0, 0, 0.18)',
  medium: '0 12px 32px rgba(0, 0, 0, 0.28)',
  strong: '0 20px 48px rgba(0, 0, 0, 0.4)',
};

export function shadowCssOf(shadow: CardShadow): string {
  return SHADOW_CSS[shadow];
}

/** Card CSS variables, shared by the preview card and the standalone HTML */
export function cardCssVars(style: CodeCardStyle): Record<string, string> {
  return {
    '--ce-card-padding': `${style.padding}px`,
    '--ce-card-radius': `${style.radius}px`,
    '--ce-card-shadow': shadowCssOf(style.shadow),
    '--ce-card-font-size': `${style.fontSize}px`,
    // Keep line height at 1.6× the font size so per-line highlights stay aligned
    '--ce-line-h': `${Math.round(style.fontSize * 1.6)}px`,
  };
}

export interface CardBackgroundCss {
  backgroundImage: string;
  backgroundColor: string;
}

/** Card background (`theme` follows the theme colours; gradient / grid / transparent derive from them) */
export function cardBackground(
  style: CodeCardStyle,
  themeBg: string,
  themeFg: string,
): CardBackgroundCss {
  switch (style.background) {
    case 'gradient':
      return {
        backgroundImage: `linear-gradient(135deg, ${themeBg} 0%, ${themeFg}22 100%)`,
        backgroundColor: themeBg,
      };
    case 'grid':
      return {
        backgroundImage: [
          `repeating-linear-gradient(0deg, transparent 0 20px, ${themeFg}1f 20px 21px)`,
          `repeating-linear-gradient(90deg, transparent 0 20px, ${themeFg}1f 20px 21px)`,
        ].join(', '),
        backgroundColor: themeBg,
      };
    case 'transparent':
      return { backgroundImage: 'none', backgroundColor: 'transparent' };
    default:
      return { backgroundImage: 'none', backgroundColor: themeBg };
  }
}

/** html-to-image needs an explicit background colour (a neutral base for transparent, so JPG stays light) */
export function exportBackgroundCss(
  style: CodeCardStyle,
  themeBg: string,
  isDark: boolean,
): string {
  if (style.background === 'theme') return themeBg;
  if (style.background === 'transparent') return isDark ? '#0b0b0d' : '#f4f5f7';
  return isDark ? '#15161b' : '#eef1f5';
}

export interface CardBodyOptions {
  /** Language name (shown in the title bar) */
  label: string;
  style: CodeCardStyle;
  /** Per-line highlighted HTML (see highlightLines.splitHighlightedLines) */
  lines: string[];
}

/**
 * Card body HTML: the export preview and the standalone HTML share this structure, so the
 * exported file looks exactly like the preview.
 */
export function buildCardBodyHtml({ label, style, lines }: CardBodyOptions): string {
  const parts: string[] = [];
  if (style.windowStyle !== 'none') {
    const dots =
      style.windowStyle === 'mac'
        ? '<span class="code-dot code-dot-red"></span><span class="code-dot code-dot-amber"></span><span class="code-dot code-dot-green"></span>'
        : '';
    parts.push(`<div class="code-title">${dots}<span>${escapeHtml(label)}</span></div>`);
  }
  const rendered = lines
    .map((line, index) => {
      const number = index + 1;
      const lineNo = style.showLineNumbers ? `<span class="code-line-no">${number}</span>` : '';
      const hit = isHighlightedLine(style, number) ? ' code-line-hit' : '';
      return `<div class="code-line${hit}">${lineNo}<span class="code-line-code">${line}</span></div>`;
    })
    .join('\n');
  parts.push(`<pre class="code-lines">${rendered}</pre>`);
  if (style.watermarkText) {
    parts.push(
      `<div class="code-watermark" style="opacity: ${style.watermarkOpacity}">${escapeHtml(
        style.watermarkText,
      )}</div>`,
    );
  }
  return `\n${parts.join('\n')}\n`;
}

/** Card styles inlined into the exported HTML (kept in sync with the card rules in editor.css) */
export function cardStyleBlock(style: CodeCardStyle, background?: CardBackgroundCss): string {
  const vars = Object.entries(cardCssVars(style))
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  const backgroundRules = background
    ? [
        `  background-color: ${background.backgroundColor};`,
        `  background-image: ${background.backgroundImage};`,
      ]
    : [];
  return [
    `:root {`,
    vars,
    `}`,
    `.code-card {`,
    `  position: relative;`,
    `  padding: var(--ce-card-padding);`,
    `  border-radius: var(--ce-card-radius);`,
    `  box-shadow: var(--ce-card-shadow);`,
    `  font-size: var(--ce-card-font-size);`,
    `  line-height: var(--ce-line-h);`,
    ...backgroundRules,
    `}`,
    `.code-title { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 12px; opacity: 0.7; }`,
    `.code-dot { width: 10px; height: 10px; border-radius: 9999px; display: inline-block; }`,
    `.code-dot-red { background: #f87171; }`,
    `.code-dot-amber { background: #fbbf24; }`,
    `.code-dot-green { background: #34d399; }`,
    `.code-lines { margin: 0; white-space: pre; }`,
    `.code-line { display: flex; gap: 12px; height: var(--ce-line-h); }`,
    `.code-line-no { min-width: 2ch; text-align: right; opacity: 0.5; user-select: none; }`,
    `.code-line-hit { background: rgba(127, 127, 127, 0.18); }`,
    `.code-watermark { position: absolute; right: 12px; bottom: 8px; font-size: 12px; }`,
  ].join('\n');
}
