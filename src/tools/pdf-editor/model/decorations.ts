/**
 * Page decoration rules (P1-A): page numbers, header, footer and a text watermark.
 *
 * Everything here is pure: the dialog edits a `PdfDecoration`, `savePdf` paints it with
 * `io/drawDecorations.ts`, and the page view previews it with `render/DecorationLayer.tsx`. The
 * clamping lives in one place so the preview and the saved file can never disagree on limits —
 * except for the coordinate system, which is documented at each drawing site.
 *
 * No I/O, no React, no pdf-lib: the rules are unit tested in plain jsdom.
 */

import { touch } from './doc';
import type {
  PdfDecoration,
  PdfEditorDoc,
  PdfLineDecoration,
  PdfPageNumberRule,
  PdfWatermarkDecoration,
} from './types';

export const DECORATION_LIMITS = {
  lineFontSize: { min: 6, max: 36 },
  watermarkFontSize: { min: 8, max: 120 },
  margin: { min: 8, max: 120 },
  opacity: { min: 0.05, max: 1 },
  rotation: { min: -90, max: 90 },
  spacing: { min: 60, max: 600 },
  startFrom: { min: 1, max: 9999 },
} as const;

export const DEFAULT_PAGE_NUMBERS: PdfPageNumberRule = {
  enabled: false,
  format: '{n} / {total}',
  position: 'bottom-center',
  fontSize: 10,
  color: '#333333',
  margin: 24,
  startFrom: 1,
};

export const DEFAULT_HEADER: PdfLineDecoration = {
  text: '',
  align: 'center',
  fontSize: 9,
  color: '#444444',
  margin: 28,
};

export const DEFAULT_FOOTER: PdfLineDecoration = {
  text: '',
  align: 'center',
  fontSize: 9,
  color: '#444444',
  margin: 28,
};

export const DEFAULT_WATERMARK: PdfWatermarkDecoration = {
  text: '',
  fontSize: 48,
  color: '#b3261e',
  opacity: 0.15,
  rotation: 45,
  tiled: false,
  spacing: 220,
};

/** Starting point for the dialog: every section present, nothing switched on */
export function createDecoration(): PdfDecoration {
  return {
    numbers: { ...DEFAULT_PAGE_NUMBERS },
    header: { ...DEFAULT_HEADER },
    footer: { ...DEFAULT_FOOTER },
    watermark: { ...DEFAULT_WATERMARK },
  };
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function clampNumberRule(rule: PdfPageNumberRule): PdfPageNumberRule {
  return {
    ...rule,
    fontSize: clamp(
      rule.fontSize,
      DECORATION_LIMITS.lineFontSize.min,
      DECORATION_LIMITS.lineFontSize.max,
      DEFAULT_PAGE_NUMBERS.fontSize,
    ),
    margin: clamp(rule.margin, DECORATION_LIMITS.margin.min, DECORATION_LIMITS.margin.max, 24),
    startFrom: Math.round(
      clamp(rule.startFrom, DECORATION_LIMITS.startFrom.min, DECORATION_LIMITS.startFrom.max, 1),
    ),
    // An empty format would print nothing while still being "enabled"
    format: rule.format.trim() || DEFAULT_PAGE_NUMBERS.format,
  };
}

function clampLine(line: PdfLineDecoration): PdfLineDecoration {
  return {
    ...line,
    text: line.text.trim(),
    fontSize: clamp(
      line.fontSize,
      DECORATION_LIMITS.lineFontSize.min,
      DECORATION_LIMITS.lineFontSize.max,
      DEFAULT_HEADER.fontSize,
    ),
    margin: clamp(line.margin, DECORATION_LIMITS.margin.min, DECORATION_LIMITS.margin.max, 28),
  };
}

function clampWatermark(mark: PdfWatermarkDecoration): PdfWatermarkDecoration {
  return {
    ...mark,
    text: mark.text.trim(),
    fontSize: clamp(
      mark.fontSize,
      DECORATION_LIMITS.watermarkFontSize.min,
      DECORATION_LIMITS.watermarkFontSize.max,
      DEFAULT_WATERMARK.fontSize,
    ),
    opacity: clamp(
      mark.opacity,
      DECORATION_LIMITS.opacity.min,
      DECORATION_LIMITS.opacity.max,
      DEFAULT_WATERMARK.opacity,
    ),
    rotation: clamp(
      mark.rotation,
      DECORATION_LIMITS.rotation.min,
      DECORATION_LIMITS.rotation.max,
      DEFAULT_WATERMARK.rotation,
    ),
    spacing: clamp(
      mark.spacing,
      DECORATION_LIMITS.spacing.min,
      DECORATION_LIMITS.spacing.max,
      DEFAULT_WATERMARK.spacing,
    ),
  };
}

/**
 * Clamp every numeric field and trim every text field.
 *
 * The dialog is the only writer, but it is also the place where "12" can arrive as `NaN` from an
 * empty number input; normalising here keeps `NaN` out of the model and out of the draft.
 */
export function normalizeDecoration(decoration: PdfDecoration | undefined): PdfDecoration {
  if (!decoration) return {};
  const next: PdfDecoration = {};
  if (decoration.numbers) next.numbers = clampNumberRule(decoration.numbers);
  if (decoration.header) next.header = clampLine(decoration.header);
  if (decoration.footer) next.footer = clampLine(decoration.footer);
  if (decoration.watermark) next.watermark = clampWatermark(decoration.watermark);
  return next;
}

/**
 * `'第 {n} 页 / 共 {total} 页'` → the string printed on page `n`.
 *
 * Unknown placeholders are left alone: a custom format may legitimately contain braces, and
 * silently dropping them would make the printed text differ from the dialog preview.
 */
export function formatPageNumber(format: string, page: number, total: number): string {
  return (format.trim() || DEFAULT_PAGE_NUMBERS.format)
    .replace(/\{n\}/g, String(page))
    .replace(/\{total\}/g, String(total));
}

/** Number printed on the `index`-th page (0-based) for the given rule */
export function pageNumberFor(rule: PdfPageNumberRule, index: number, total: number): string {
  return formatPageNumber(rule.format, rule.startFrom + index, total);
}

/** True when saving would print anything at all; used to skip the drawing pass */
export function hasDecoration(decoration: PdfDecoration | undefined): boolean {
  if (!decoration) return false;
  return (
    decoration.numbers?.enabled === true ||
    (decoration.header?.text.trim().length ?? 0) > 0 ||
    (decoration.footer?.text.trim().length ?? 0) > 0 ||
    (decoration.watermark?.text.trim().length ?? 0) > 0
  );
}

/**
 * Tile anchors for the tiled watermark, as fractions of the page (0–1, origin bottom-left).
 *
 * Tiles are *evenly distributed* rather than stepped from the corner: with a plain step the last row
 * and column get clipped at the page edge, which looks like a rendering bug. Both the preview (CSS
 * px) and the save pipeline (PDF points) multiply these fractions by their own page size, so the two
 * stay identical.
 */
export function watermarkTileAnchors(
  pageWidth: number,
  pageHeight: number,
  spacing: number,
): Array<{ x: number; y: number }> {
  if (pageWidth <= 0 || pageHeight <= 0) return [{ x: 0.5, y: 0.5 }];
  const step = spacing > 0 ? spacing : DEFAULT_WATERMARK.spacing;
  const columns = Math.max(1, Math.round(pageWidth / step));
  const rows = Math.max(1, Math.round(pageHeight / step));
  const anchors: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      anchors.push({ x: (column + 0.5) / columns, y: (row + 0.5) / rows });
    }
  }
  return anchors;
}

/**
 * Store the decoration on the document (one history step).
 *
 * An empty decoration (`{}`) is stored as `undefined` so "cleared" and "never set" behave the same
 * for saving and for the draft.
 */
export function setDecoration(
  doc: PdfEditorDoc,
  decoration: PdfDecoration | undefined,
): PdfEditorDoc {
  const next = hasDecoration(decoration) ? normalizeDecoration(decoration) : undefined;
  if (!next && !doc.decoration) return doc;
  if (next && doc.decoration && JSON.stringify(next) === JSON.stringify(doc.decoration)) return doc;
  return touch({ ...doc, decoration: next });
}
