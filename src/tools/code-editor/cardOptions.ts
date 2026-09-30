import { escapeHtml } from './prism';

/**
 * 导出卡片样式模型（阶段 6）：选项栏、导出预览、图片导出与独立 HTML 四方共用同一份配置，
 * 保证「所见即所得」。配色仍由 `themes.ts` 的 `--ce-*` 提供，这里只负责版式变量。
 */

export type CardWindowStyle = 'mac' | 'title' | 'plain' | 'none';
export type CardShadow = 'none' | 'soft' | 'medium' | 'strong';
export type CardBackground = 'theme' | 'gradient' | 'grid' | 'transparent';

export interface CodeCardStyle {
  windowStyle: CardWindowStyle;
  /** 卡片内边距（px） */
  padding: number;
  /** 圆角（px） */
  radius: number;
  shadow: CardShadow;
  background: CardBackground;
  /** 水印文本；空串表示不加水印 */
  watermarkText: string;
  /** 水印透明度（0–1） */
  watermarkOpacity: number;
  /** 指定行高亮区间（1 起始，含两端）；from > to 时视为未设置 */
  highlightFrom: number;
  highlightTo: number;
  /** 卡片字号（px） */
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

/** 导出倍率（与 Carbon 的 1x / 2x / 4x 对齐） */
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

/** 不取整的钳制（透明度是 0–1 的小数） */
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

/** 归一化（含边界钳制）：草稿 / 分享链接里的值不可信，一律经此收敛 */
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
    // from > to 视为未设置（避免反向区间）
    highlightFrom: highlightTo > 0 && highlightFrom > highlightTo ? 0 : highlightFrom,
    highlightTo,
    fontSize: clamp(source.fontSize as number, CARD_BOUNDS.fontSize, DEFAULT_CARD_STYLE.fontSize),
    showLineNumbers: source.showLineNumbers === true,
  };
}

/** 该行是否落在指定的高亮区间内 */
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

/** 卡片 CSS 变量：预览卡片与独立 HTML 共用 */
export function cardCssVars(style: CodeCardStyle): Record<string, string> {
  return {
    '--ce-card-padding': `${style.padding}px`,
    '--ce-card-radius': `${style.radius}px`,
    '--ce-card-shadow': shadowCssOf(style.shadow),
    '--ce-card-font-size': `${style.fontSize}px`,
    // 卡片字号与行高保持 1.6 倍同步，行级高亮位置才不会错位
    '--ce-line-h': `${Math.round(style.fontSize * 1.6)}px`,
  };
}

export interface CardBackgroundCss {
  backgroundImage: string;
  backgroundColor: string;
}

/** 卡片背景（theme 跟随主题色；gradient / grid / transparent 由主题色派生） */
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

/** html-to-image 需要显式背景色（transparent 时给一个中性底，避免 JPG 变黑） */
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
  /** 语言名称（标题栏展示） */
  label: string;
  style: CodeCardStyle;
  /** 逐行高亮 HTML（见 highlightLines.splitHighlightedLines） */
  lines: string[];
}

/**
 * 卡片正文 HTML：导出预览与独立 HTML 共用同一份结构，
 * 因此「预览长什么样，导出的 HTML 就长什么样」。
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

/** 导出 HTML 时内嵌的卡片样式（与 editor.css 的卡片规则保持一致） */
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
