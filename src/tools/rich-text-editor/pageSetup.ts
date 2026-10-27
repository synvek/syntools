import type { ToolResult } from '@/core/types';

/**
 * Page setup pure logic layer (DOM-free, easy to unit test):
 * paper / orientation / margins -> content area size and CSS variables.
 * The on-screen page view, Word export, print flow and snapshot PDF all share one configuration,
 * guaranteeing WYSIWYG.
 */

export type PageSize = 'A4' | 'Letter';
export type Orientation = 'portrait' | 'landscape';

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Column count: like Word's columns, at most three (more would make columns unreadably narrow) */
export type ColumnCount = 1 | 2 | 3;

/** Text watermark configuration */
export interface WatermarkConfig {
  text: string;
  /** Opacity between 0 and 1 */
  opacity: number;
  /** Rotation angle in degrees; positive values tilt counter-clockwise */
  rotation: number;
  /** Hex color */
  color: string;
}

export interface PageSetupConfig {
  size: PageSize;
  orientation: Orientation;
  /** Page margins (mm) */
  margin: PageMargins;
  /** Header text (empty string means hidden) */
  header: string;
  /** Footer text */
  footer: string;
  /** Whether to show page numbers in the footer */
  showPageNumber: boolean;
  /** Column count */
  columns: ColumnCount;
  /** Text watermark (null = none) */
  watermark: WatermarkConfig | null;
  /** Page background color (#rrggbb; null = white) */
  background: string | null;
  /** Whether the first page uses a different header/footer (Word's "different first page") */
  differentFirstPage: boolean;
}

export interface PageMetrics {
  /** Paper size (mm, already swapped for orientation) */
  widthMm: number;
  heightMm: number;
  /** Content area size (mm) */
  contentWidthMm: number;
  contentHeightMm: number;
  /** Column count (clamped by content width to stay readable) */
  columns: ColumnCount;
  /** Column gap (mm) */
  columnGapMm: number;
  /** CSS variables shared by the view and print layers */
  cssVars: Record<string, string>;
}

/** Native paper sizes (mm, portrait) */
const PAPER_SIZES: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
};

/** Margin presets (mm) */
export const MARGIN_PRESETS: Record<'normal' | 'narrow' | 'wide', PageMargins> = {
  normal: { top: 20, right: 20, bottom: 20, left: 20 },
  narrow: { top: 12.7, right: 12.7, bottom: 12.7, left: 12.7 },
  wide: { top: 25.4, right: 25.4, bottom: 25.4, left: 25.4 },
};

export const DEFAULT_PAGE_SETUP: PageSetupConfig = {
  size: 'A4',
  orientation: 'portrait',
  margin: { ...MARGIN_PRESETS.normal },
  header: '',
  footer: '',
  showPageNumber: true,
  columns: 1,
  watermark: null,
  background: null,
  differentFirstPage: false,
};

/** Default watermark style (used when the panel first enables it) */
export const DEFAULT_WATERMARK: WatermarkConfig = {
  text: '',
  opacity: 0.12,
  rotation: -30,
  color: '#9ca3af',
};

/**
 * Watermark -> CSS variables: the on-screen page view, flow view and print layer share one style rule,
 * so color / angle / opacity are converted only here.
 */
export function watermarkCssVars(watermark: WatermarkConfig): Record<string, string> {
  return {
    '--rte-watermark-color': watermark.color,
    '--rte-watermark-rotation': `${watermark.rotation}deg`,
    '--rte-watermark-opacity': String(watermark.opacity),
  };
}

/** Column gap (mm): close to Word's default, keeping two columns from touching */
export const COLUMN_GAP_MM = 8;

const MIN_MARGIN_MM = 5;
/** Minimum content width (mm), so margins can't squeeze the layout into unusability */
const MIN_CONTENT_WIDTH_MM = 40;
const MIN_CONTENT_HEIGHT_MM = 40;
/** Minimum single-column width after splitting (mm): narrower text is hard to read, which caps the column count */
const MIN_COLUMN_WIDTH_MM = 35;
const MIN_WATERMARK_OPACITY = 0.02;
const MAX_WATERMARK_OPACITY = 0.6;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Hex color (#rgb / #rrggbb) -> normalized to #rrggbb; invalid values return null */
function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(raw);
  if (short)
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const full = /^#([0-9a-f]{6})$/i.exec(raw);
  return full ? `#${full[1]}`.toLowerCase() : null;
}

function normalizeColumns(value: unknown, contentWidthMm: number): ColumnCount {
  const parsed = isFiniteNumber(value) ? Math.round(value) : 1;
  const wanted: ColumnCount = parsed >= 3 ? 3 : parsed >= 2 ? 2 : 1;
  // Fall back level by level when columns would be too narrow, keeping the text readable
  for (let count = wanted; count > 1; count -= 1) {
    if (contentWidthMm / count >= MIN_COLUMN_WIDTH_MM) return count as ColumnCount;
  }
  return 1;
}

function normalizeWatermark(value: unknown): WatermarkConfig | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<WatermarkConfig>;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!text) return null;
  return {
    text: text.slice(0, 40),
    opacity: isFiniteNumber(raw.opacity)
      ? Math.min(MAX_WATERMARK_OPACITY, Math.max(MIN_WATERMARK_OPACITY, raw.opacity))
      : DEFAULT_WATERMARK.opacity,
    rotation: isFiniteNumber(raw.rotation)
      ? Math.min(90, Math.max(-90, Math.round(raw.rotation)))
      : DEFAULT_WATERMARK.rotation,
    color: normalizeHexColor(raw.color) ?? DEFAULT_WATERMARK.color,
  };
}

/** Normalize the config: fill in missing fields and clamp invalid values */
export function normalizePageSetup(input: Partial<PageSetupConfig> | null): PageSetupConfig {
  const raw = input ?? {};
  const margin: Partial<PageMargins> = raw.margin ?? {};
  const size: PageSize = raw.size === 'Letter' ? 'Letter' : 'A4';
  const orientation: Orientation = raw.orientation === 'landscape' ? 'landscape' : 'portrait';
  const normalizedMargin = {
    top: isFiniteNumber(margin.top)
      ? Math.max(MIN_MARGIN_MM, margin.top)
      : DEFAULT_PAGE_SETUP.margin.top,
    right: isFiniteNumber(margin.right)
      ? Math.max(MIN_MARGIN_MM, margin.right)
      : DEFAULT_PAGE_SETUP.margin.right,
    bottom: isFiniteNumber(margin.bottom)
      ? Math.max(MIN_MARGIN_MM, margin.bottom)
      : DEFAULT_PAGE_SETUP.margin.bottom,
    left: isFiniteNumber(margin.left)
      ? Math.max(MIN_MARGIN_MM, margin.left)
      : DEFAULT_PAGE_SETUP.margin.left,
  };
  const paper = PAPER_SIZES[size];
  const contentWidthMm = Math.max(
    0,
    (orientation === 'landscape' ? paper.height : paper.width) -
      normalizedMargin.left -
      normalizedMargin.right,
  );
  return {
    size,
    orientation,
    margin: normalizedMargin,
    header: typeof raw.header === 'string' ? raw.header : '',
    footer: typeof raw.footer === 'string' ? raw.footer : '',
    showPageNumber: raw.showPageNumber !== false,
    columns: normalizeColumns(raw.columns, contentWidthMm),
    watermark: normalizeWatermark(raw.watermark),
    background: normalizeHexColor(raw.background),
    differentFirstPage: raw.differentFirstPage === true,
  };
}

/**
 * Compute page geometry. Returns an error code (never throws) when oversized margins leave no usable content area.
 */
export function computePageMetrics(config: PageSetupConfig): ToolResult<PageMetrics> {
  const paper = PAPER_SIZES[config.size] ?? PAPER_SIZES.A4;
  const landscape = config.orientation === 'landscape';
  const widthMm = landscape ? paper.height : paper.width;
  const heightMm = landscape ? paper.width : paper.height;
  const contentWidthMm = widthMm - config.margin.left - config.margin.right;
  const contentHeightMm = heightMm - config.margin.top - config.margin.bottom;
  if (contentWidthMm < MIN_CONTENT_WIDTH_MM || contentHeightMm < MIN_CONTENT_HEIGHT_MM) {
    return { ok: false, error: 'INVALID_RANGE' };
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    ok: true,
    value: {
      widthMm: round(widthMm),
      heightMm: round(heightMm),
      contentWidthMm: round(contentWidthMm),
      contentHeightMm: round(contentHeightMm),
      columns: config.columns,
      columnGapMm: COLUMN_GAP_MM,
      cssVars: {
        '--rte-page-width': `${round(widthMm)}mm`,
        '--rte-page-height': `${round(heightMm)}mm`,
        '--rte-page-margin-top': `${round(config.margin.top)}mm`,
        '--rte-page-margin-right': `${round(config.margin.right)}mm`,
        '--rte-page-margin-bottom': `${round(config.margin.bottom)}mm`,
        '--rte-page-margin-left': `${round(config.margin.left)}mm`,
        '--rte-content-width': `${round(contentWidthMm)}mm`,
        '--rte-content-height': `${round(contentHeightMm)}mm`,
        '--rte-column-count': String(config.columns),
        '--rte-column-gap': `${COLUMN_GAP_MM}mm`,
        '--rte-page-background': config.background ?? '#ffffff',
      },
    },
  };
}

/** Convenience wrapper: falls back to defaults (view layer; A4 portrait on failure) */
export function resolvePageMetrics(config: Partial<PageSetupConfig> | null): PageMetrics {
  const metrics = computePageMetrics(normalizePageSetup(config));
  if (metrics.ok) return metrics.value;
  // normalizePageSetup already clamps margins to the lower bound, so defaults are always valid; this is a static fallback
  return {
    widthMm: 210,
    heightMm: 297,
    contentWidthMm: 170,
    contentHeightMm: 257,
    columns: 1,
    columnGapMm: COLUMN_GAP_MM,
    cssVars: {},
  };
}

/** mm -> twip (1mm ≈ 56.7 twip), the unit for docx page size and margins */
export function mmToTwip(mm: number): number {
  return Math.round(mm * 56.6929);
}

/** CSS spec: 1in = 96px, 1mm = 96/25.4px */
export const MM_TO_PX = 96 / 25.4;
/** Visible gap between adjacent sheets (mm) */
export const SHEET_GAP_MM = 12;

export interface PageMetricsPx {
  widthPx: number;
  heightPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
  /** Top/bottom page margin (px) */
  padTopPx: number;
  padBottomPx: number;
  /** Fallback gap widget height (px) = top and bottom margins + sheet gap */
  gapPx: number;
  /** Step between adjacent sheets (px) = sheet height + sheet gap */
  advancePx: number;
}

/** Page geometry -> pixels (shared by on-screen pagination, sheet positioning and snapshot page splitting) */
export function pageMetricsToPx(metrics: PageMetrics): PageMetricsPx {
  const widthPx = metrics.widthMm * MM_TO_PX;
  const heightPx = metrics.heightMm * MM_TO_PX;
  const contentWidthPx = metrics.contentWidthMm * MM_TO_PX;
  const contentHeightPx = metrics.contentHeightMm * MM_TO_PX;
  return {
    widthPx,
    heightPx,
    contentWidthPx,
    contentHeightPx,
    padTopPx: ((metrics.heightMm - metrics.contentHeightMm) / 2) * MM_TO_PX,
    padBottomPx: ((metrics.heightMm - metrics.contentHeightMm) / 2) * MM_TO_PX,
    gapPx: (metrics.heightMm - metrics.contentHeightMm + SHEET_GAP_MM) * MM_TO_PX,
    advancePx: (metrics.heightMm + SHEET_GAP_MM) * MM_TO_PX,
  };
}

/**
 * Build print styles:
 * - @page declares paper size + margins (CSS variables aren't reliable inside @page, so use literals);
 * - columns and page background apply to the print flow container (@page can't express columns).
 */
export function buildPrintPageCss(metrics: PageMetrics, margin: PageMargins): string {
  const page = `@page { size: ${metrics.widthMm}mm ${metrics.heightMm}mm; margin: ${margin.top}mm ${margin.right}mm ${margin.bottom}mm ${margin.left}mm; }`;
  const flow =
    metrics.columns > 1
      ? `.rte-print-flow { column-count: ${metrics.columns}; column-gap: ${metrics.columnGapMm}mm; }`
      : '';
  return [page, flow, '.rte-print-flow { background: var(--rte-page-background, #ffffff); }']
    .filter(Boolean)
    .join('\n');
}
