/**
 * Text measurement used by shrink-to-fit ("缩小字体填充").
 *
 * Univer's render engine has no shrink-to-fit: it draws `fs` at its nominal size and clips or lets the
 * text overflow (WrapStrategy). Excel instead keeps shrinking the glyphs until the cell's content fits,
 * so the only way to reproduce it is to hand the renderer the size Excel would have picked — measured
 * here, at import time, against the real column width.
 *
 * Canvas measureText is used when available (browser and worker both have it, and it is the same text
 * shaper the canvas renderer uses). Tests and exotic environments fall back to a deterministic estimate.
 */

/** Width of `text` in px when drawn at `fontPt` with `fontFamily` */
export type TextMeasure = (text: string, fontPt: number, fontFamily?: string) => number;

/** px per pt at the 96 dpi both Canvas and Univer assume */
const PX_PER_PT = 4 / 3;

/** Wrap a family name for the CSS font shorthand (multi-word names must be quoted) */
function cssFamily(fontFamily: string | undefined): string {
  if (!fontFamily) return 'sans-serif';
  return /^[A-Za-z0-9-]+$/.test(fontFamily) ? fontFamily : `"${fontFamily.replace(/"/g, '')}"`;
}

/** The jsdom test environment ships a canvas element whose getContext only logs "not implemented" */
function hasRealCanvas(): boolean {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return false;
  return true;
}

/** Canvas when the environment has one (main thread or worker), otherwise null */
function createContext(): { font: string; measureText(text: string): { width: number } } | null {
  if (!hasRealCanvas()) return null;
  try {
    if (typeof OffscreenCanvas !== 'undefined') {
      const context = new OffscreenCanvas(1, 1).getContext('2d');
      if (context) return context;
    }
    if (typeof document !== 'undefined') {
      const context = document.createElement('canvas').getContext('2d');
      if (context) return context;
    }
  } catch {
    return null;
  }
  return null;
}

/** Measure with a canvas, or estimate when the environment has no 2d context (jsdom, tests) */
export function createTextMeasure(): TextMeasure {
  const context = createContext();
  if (!context) return (text, fontPt) => estimateTextWidth(text, fontPt);
  return (text, fontPt, fontFamily) => {
    context.font = `${fontPt}pt ${cssFamily(fontFamily)}`;
    return context.measureText(text).width;
  };
}

/** A CJK / fullwidth glyph is roughly one em wide, Latin text about half */
function isWideChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f)
  );
}

/** Deterministic width estimate, within roughly 10% of what a canvas reports for common UI fonts */
export function estimateTextWidth(text: string, fontPt: number): number {
  let em = 0;
  for (const char of text) em += isWideChar(char) ? 1 : 0.55;
  return em * fontPt * PX_PER_PT;
}

/**
 * Font size (pt) at which `text` just fits `availablePx`, or null when it already fits.
 * Excel never grows text, so the result is capped at `fontPt`; the glyph width scales linearly with the
 * point size, so one measurement is enough.
 */
export function shrinkFontSize(
  text: string,
  fontPt: number,
  fontFamily: string | undefined,
  availablePx: number,
  measure: TextMeasure,
): number | null {
  if (!text || !(fontPt > 0) || !(availablePx > 0)) return null;
  const width = measure(text, fontPt, fontFamily);
  if (!(width > availablePx)) return null;
  const scaled = Math.floor(((fontPt * availablePx) / width) * 10) / 10;
  const next = Math.max(1, Math.min(fontPt, scaled));
  return next < fontPt ? next : null;
}
