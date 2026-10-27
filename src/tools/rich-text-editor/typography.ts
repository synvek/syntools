/**
 * Font and typography defaults (pure logic + injectable browser capability probing, easy to unit test).
 *
 * Design premise: this tool renders fully locally and fonts aren't distributed with the document, so the
 * font menu lists only fonts actually installed on the current system rather than a hard-coded list —
 * otherwise users pick a font and see no effect.
 */

/** Default body font size (px); must match font-size of .rte-surface .tiptap in editor.css */
export const DEFAULT_FONT_SIZE_PX = 15;
/** Default body line height; must match line-height of .rte-surface .tiptap in editor.css */
export const DEFAULT_LINE_HEIGHT = 1.8;

/** Available font sizes (px): excluding the default, which is shown separately as the first entry */
export const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72] as const;
/** Available line heights: excluding the default */
export const LINE_HEIGHT_OPTIONS = [1, 1.15, 1.5, 1.75, 2, 2.5, 3] as const;

/** CSS generic families and keywords: they don't count as a concrete font name */
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
  '-apple-system',
  'blinkmacsystemfont',
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
]);

/** Font candidate: name is the concrete font, fallback is the generic family used when it's missing */
export interface FontCandidate {
  name: string;
  fallback: 'sans-serif' | 'serif' | 'monospace' | 'cursive';
}

/** Candidate font list (ordered: CJK body text -> Latin sans-serif -> serif -> monospace -> script/decorative) */
export const FONT_CANDIDATES: readonly FontCandidate[] = [
  // CJK fonts (commonly bundled on macOS / Windows / Linux)
  { name: 'PingFang SC', fallback: 'sans-serif' },
  { name: 'PingFang TC', fallback: 'sans-serif' },
  { name: 'Hiragino Sans GB', fallback: 'sans-serif' },
  { name: 'Heiti SC', fallback: 'sans-serif' },
  { name: 'Microsoft YaHei', fallback: 'sans-serif' },
  { name: 'Microsoft JhengHei', fallback: 'sans-serif' },
  { name: 'SimHei', fallback: 'sans-serif' },
  { name: 'DengXian', fallback: 'sans-serif' },
  { name: 'Noto Sans CJK SC', fallback: 'sans-serif' },
  { name: 'Source Han Sans SC', fallback: 'sans-serif' },
  { name: 'WenQuanYi Micro Hei', fallback: 'sans-serif' },
  { name: 'Songti SC', fallback: 'serif' },
  { name: 'STSong', fallback: 'serif' },
  { name: 'SimSun', fallback: 'serif' },
  { name: 'NSimSun', fallback: 'serif' },
  { name: 'Noto Serif CJK SC', fallback: 'serif' },
  { name: 'Source Han Serif SC', fallback: 'serif' },
  { name: 'Kaiti SC', fallback: 'serif' },
  { name: 'KaiTi', fallback: 'serif' },
  { name: 'STKaiti', fallback: 'serif' },
  { name: 'STFangsong', fallback: 'serif' },
  { name: 'FangSong', fallback: 'serif' },
  { name: 'Yuanti SC', fallback: 'sans-serif' },
  { name: 'Lantinghei SC', fallback: 'sans-serif' },
  // Latin sans-serif
  { name: 'Arial', fallback: 'sans-serif' },
  { name: 'Helvetica', fallback: 'sans-serif' },
  { name: 'Helvetica Neue', fallback: 'sans-serif' },
  { name: 'Verdana', fallback: 'sans-serif' },
  { name: 'Tahoma', fallback: 'sans-serif' },
  { name: 'Trebuchet MS', fallback: 'sans-serif' },
  { name: 'Segoe UI', fallback: 'sans-serif' },
  { name: 'Calibri', fallback: 'sans-serif' },
  { name: 'Century Gothic', fallback: 'sans-serif' },
  { name: 'Futura', fallback: 'sans-serif' },
  { name: 'Avenir Next', fallback: 'sans-serif' },
  { name: 'Optima', fallback: 'sans-serif' },
  { name: 'Gill Sans', fallback: 'sans-serif' },
  { name: 'Franklin Gothic Medium', fallback: 'sans-serif' },
  { name: 'Lucida Grande', fallback: 'sans-serif' },
  { name: 'Ubuntu', fallback: 'sans-serif' },
  { name: 'Cantarell', fallback: 'sans-serif' },
  { name: 'DejaVu Sans', fallback: 'sans-serif' },
  { name: 'Liberation Sans', fallback: 'sans-serif' },
  { name: 'Noto Sans', fallback: 'sans-serif' },
  // Serif
  { name: 'Times New Roman', fallback: 'serif' },
  { name: 'Georgia', fallback: 'serif' },
  { name: 'Cambria', fallback: 'serif' },
  { name: 'Garamond', fallback: 'serif' },
  { name: 'Palatino', fallback: 'serif' },
  { name: 'Palatino Linotype', fallback: 'serif' },
  { name: 'Book Antiqua', fallback: 'serif' },
  { name: 'Baskerville', fallback: 'serif' },
  { name: 'Didot', fallback: 'serif' },
  { name: 'Constantia', fallback: 'serif' },
  { name: 'Charter', fallback: 'serif' },
  { name: 'Iowan Old Style', fallback: 'serif' },
  { name: 'Rockwell', fallback: 'serif' },
  { name: 'DejaVu Serif', fallback: 'serif' },
  { name: 'Liberation Serif', fallback: 'serif' },
  { name: 'Noto Serif', fallback: 'serif' },
  // Monospace
  { name: 'Menlo', fallback: 'monospace' },
  { name: 'Monaco', fallback: 'monospace' },
  { name: 'SF Mono', fallback: 'monospace' },
  { name: 'Consolas', fallback: 'monospace' },
  { name: 'Courier New', fallback: 'monospace' },
  { name: 'Courier', fallback: 'monospace' },
  { name: 'Lucida Console', fallback: 'monospace' },
  { name: 'Andale Mono', fallback: 'monospace' },
  { name: 'JetBrains Mono', fallback: 'monospace' },
  { name: 'Fira Code', fallback: 'monospace' },
  { name: 'DejaVu Sans Mono', fallback: 'monospace' },
  { name: 'Liberation Mono', fallback: 'monospace' },
  { name: 'Noto Sans Mono', fallback: 'monospace' },
  // Script / decorative
  { name: 'Chalkboard SE', fallback: 'cursive' },
  { name: 'Marker Felt', fallback: 'cursive' },
  { name: 'Comic Sans MS', fallback: 'cursive' },
  { name: 'Brush Script MT', fallback: 'cursive' },
  { name: 'Snell Roundhand', fallback: 'cursive' },
  { name: 'Impact', fallback: 'sans-serif' },
];

/** Take the first concrete font name from a CSS font stack (skipping keywords like system-ui / sans-serif) */
export function firstFontFamily(stack: string | null | undefined): string | null {
  if (!stack) return null;
  for (const raw of stack.split(',')) {
    const name = raw
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim();
    if (!name) continue;
    if (GENERIC_FAMILIES.has(name.toLowerCase())) continue;
    return name;
  }
  return null;
}

/** Concrete font name + fallback family -> CSS font-family value (always quoted, safe with spaces or CJK) */
export function fontStackFor(candidate: FontCandidate): string {
  return `"${candidate.name}", ${candidate.fallback}`;
}

/** px -> Word half-points (1px = 0.75pt, half-point = pt × 2) */
export function pxToHalfPoints(px: number): number | null {
  if (!Number.isFinite(px) || px <= 0) return null;
  return Math.round(px * 1.5);
}

/** Platform default body font name (the font actually applied when fontFamily isn't set) */
export function detectDefaultFontName(userAgent: string, platform = ''): string {
  const hint = `${platform} ${userAgent}`;
  if (/mac|iphone|ipad/i.test(hint)) return 'PingFang SC';
  if (/win/i.test(hint)) return 'Microsoft YaHei';
  return 'Noto Sans CJK SC';
}

/** Font probe: returns the measured width for a CSS font shorthand, or null when unavailable */
export type FontProbe = (font: string) => number | null;

const PROBE_SAMPLE = 'mmmmmmmmmmlliWW漢字';
const PROBE_FALLBACKS = ['monospace', 'serif', 'sans-serif'] as const;

/** Browser canvas font-measurement probe (compares width differences at the same size) */
export function createSystemFontProbe(): FontProbe {
  if (typeof document === 'undefined') return () => null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => null;
  return (font: string) => {
    ctx.font = font;
    return ctx.measureText(PROBE_SAMPLE).width;
  };
}

/**
 * Check whether a font is really installed: compare against three generic families; any width difference
 * means installed. When the font is missing the browser falls back to the generic family entirely and
 * widths match the baseline.
 */
export function isFontInstalled(name: string, probe: FontProbe): boolean {
  return PROBE_FALLBACKS.some((fallback) => {
    const base = probe(`72px ${fallback}`);
    const test = probe(`72px "${name}", ${fallback}`);
    if (base === null || test === null) return false;
    return Math.abs(test - base) > 0.01;
  });
}

/** Detect installed candidate fonts (keeping list order); returns an empty array when probing is unavailable */
export function detectInstalledFonts(
  probe: FontProbe,
  candidates: readonly FontCandidate[] = FONT_CANDIDATES,
): FontCandidate[] {
  if (probe(`72px sans-serif`) === null) return [];
  return candidates.filter((candidate) => isFontInstalled(candidate.name, probe));
}

/**
 * Build the font dropdown options:
 * the first entry is "document default font" (showing the concrete name; callers pass a generic label
 * when it isn't installed), followed by the installed concrete fonts (deduped against the first entry).
 */
export function buildFontOptions(
  available: readonly FontCandidate[],
  defaultLabel: string,
  excludeName = '',
): { value: string; label: string }[] {
  const options = [{ value: '', label: defaultLabel }];
  const seen = new Set<string>([(excludeName || defaultLabel).toLowerCase()]);
  available.forEach((candidate) => {
    const key = candidate.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push({ value: fontStackFor(candidate), label: candidate.name });
  });
  return options;
}

/** An applied font family (possibly a legacy stack) -> the matching option value for the dropdown */
export function matchFontOption(
  stack: string | null | undefined,
  options: readonly { value: string; label: string }[],
): string {
  if (!stack) return '';
  const exact = options.find((option) => option.value === stack);
  if (exact) return exact.value;
  const name = firstFontFamily(stack);
  if (!name) return '';
  const lower = name.toLowerCase();
  const byName = options.find((option) => option.label.toLowerCase() === lower);
  return byName ? byName.value : '';
}
