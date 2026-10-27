/**
 * Editor line geometry: converting between line numbers and pixel positions.
 *
 * Why it exists: the overlays in the editor and export card (current-line highlight, find
 * matches, indent guides, fold ranges) must align **exactly** with text lines. CSS
 * `line-height: 1.6` (13px × 1.6 = 20.8px) is fractional, so accumulating positions per line
 * drifts into subpixels on long documents. The line height is therefore pinned to an integer
 * constant, injected by `CodeSurface` as the inline `--ce-line-h`, and consumed by `editor.css`
 * via `var(--ce-line-h, 21px)` — a single source, so no drift.
 */

/** Line height (px): 13px font × 1.6 rounded up to an integer line box */
export const LINE_HEIGHT_PX = 21;
/** Top padding of the editor / gutter / export card (keep in sync with editor.css padding-top) */
export const EDITOR_PADDING_TOP_PX = 12;
/** Editor left padding (horizontal baseline for indent guides / bracket highlights; sync with editor.css padding-left) */
export const EDITOR_PADDING_LEFT_PX = 16;
/** `tab-size`: keep in sync with editor.css `tab-size`; used to convert indentation to columns */
export const TAB_SIZE = 2;
/** Name of the line-height CSS custom property (consumed by editor.css) */
export const LINE_HEIGHT_VAR = '--ce-line-h';

/** Line number (1-based) → pixel offset of the line box's top edge */
export function lineTopPx(line: number, paddingTop: number = EDITOR_PADDING_TOP_PX): number {
  const safe = Number.isFinite(line) ? Math.max(1, Math.trunc(line)) : 1;
  return paddingTop + (safe - 1) * LINE_HEIGHT_PX;
}

/** Pixel offset → line number (1-based); clamped to the valid range when the total is known */
export function lineAtOffsetY(
  offsetY: number,
  totalLines: number = Number.MAX_SAFE_INTEGER,
  paddingTop: number = EDITOR_PADDING_TOP_PX,
): number {
  const raw = Math.floor((offsetY - paddingTop) / LINE_HEIGHT_PX) + 1;
  if (!Number.isFinite(raw)) return 1;
  const max = Number.isFinite(totalLines)
    ? Math.max(1, Math.trunc(totalLines))
    : Number.MAX_SAFE_INTEGER;
  return Math.min(Math.max(Math.trunc(raw), 1), max);
}
