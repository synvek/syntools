import type { ToolResult } from '@/core/types';

/**
 * 页面设置纯逻辑层（不依赖 DOM，便于单测）：
 * 纸张 / 方向 / 页边距 → 内容区尺寸与 CSS 变量。
 * 屏幕页面视图、Word 导出、打印流、快照 PDF 四端共用同一份设置，
 * 保证「所见即所得」。
 */

export type PageSize = 'A4' | 'Letter';
export type Orientation = 'portrait' | 'landscape';

export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 分栏数：与 Word「分栏」一致，最多三栏（更多会让正文列宽低到不可读） */
export type ColumnCount = 1 | 2 | 3;

/** 文字水印配置 */
export interface WatermarkConfig {
  text: string;
  /** 0–1 之间的透明度 */
  opacity: number;
  /** 旋转角度（度），正值为逆时针倾斜 */
  rotation: number;
  /** 十六进制颜色 */
  color: string;
}

export interface PageSetupConfig {
  size: PageSize;
  orientation: Orientation;
  /** 页边距（mm） */
  margin: PageMargins;
  /** 页眉文本（空字符串表示不显示） */
  header: string;
  /** 页脚文本 */
  footer: string;
  /** 是否在页脚显示页码 */
  showPageNumber: boolean;
  /** 分栏数 */
  columns: ColumnCount;
  /** 文字水印（null 表示无水印） */
  watermark: WatermarkConfig | null;
  /** 页面背景色（#rrggbb；null 表示白色） */
  background: string | null;
  /** 首页是否使用不同的页眉页脚（Word「首页不同」） */
  differentFirstPage: boolean;
}

export interface PageMetrics {
  /** 纸张尺寸（mm，已按方向交换） */
  widthMm: number;
  heightMm: number;
  /** 内容区尺寸（mm） */
  contentWidthMm: number;
  contentHeightMm: number;
  /** 分栏数（已按内容宽度裁剪到可读范围） */
  columns: ColumnCount;
  /** 列间距（mm） */
  columnGapMm: number;
  /** 供视图层与打印层共用的 CSS 变量 */
  cssVars: Record<string, string>;
}

/** 纸张原始尺寸（mm，纵向） */
const PAPER_SIZES: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
};

/** 页边距预设（mm） */
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

/** 水印默认样式（面板首次启用时使用） */
export const DEFAULT_WATERMARK: WatermarkConfig = {
  text: '',
  opacity: 0.12,
  rotation: -30,
  color: '#9ca3af',
};

/**
 * 水印 → CSS 变量：屏幕页面视图、流式视图、打印层共用同一段样式规则，
 * 颜色 / 角度 / 透明度只在这里换算一次。
 */
export function watermarkCssVars(watermark: WatermarkConfig): Record<string, string> {
  return {
    '--rte-watermark-color': watermark.color,
    '--rte-watermark-rotation': `${watermark.rotation}deg`,
    '--rte-watermark-opacity': String(watermark.opacity),
  };
}

/** 列间距（mm）：与 Word 默认相近，避免两栏贴在一起 */
export const COLUMN_GAP_MM = 8;

const MIN_MARGIN_MM = 5;
/** 内容区最小宽度（mm），避免边距设置把版面压到不可用 */
const MIN_CONTENT_WIDTH_MM = 40;
const MIN_CONTENT_HEIGHT_MM = 40;
/** 分栏后单列最小宽度（mm）：低于此值正文会难读，据此限制最大栏数 */
const MIN_COLUMN_WIDTH_MM = 35;
const MIN_WATERMARK_OPACITY = 0.02;
const MAX_WATERMARK_OPACITY = 0.6;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 十六进制颜色（#rgb / #rrggbb）→ 统一为 #rrggbb；非法值返回 null */
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
  // 栏宽不足时逐级回退，避免把正文挤到不可读
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

/** 规范化配置：补齐缺失字段、裁剪非法值 */
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
 * 计算页面几何。边距过大导致内容区不可用时返回错误码（不抛异常）。
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

/** 便捷：直接用默认设置兜底计算（视图层用，失败时退回 A4 纵向） */
export function resolvePageMetrics(config: Partial<PageSetupConfig> | null): PageMetrics {
  const metrics = computePageMetrics(normalizePageSetup(config));
  if (metrics.ok) return metrics.value;
  // normalizePageSetup 已把边距裁剪到下限，默认设置必定合法，这里只做静态兜底
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

/** mm → twip（1mm ≈ 56.7 twip），docx 页面尺寸与边距单位 */
export function mmToTwip(mm: number): number {
  return Math.round(mm * 56.6929);
}

/** CSS 规范：1in = 96px，1mm = 96/25.4px */
export const MM_TO_PX = 96 / 25.4;
/** 相邻两页纸之间的可见留白（mm） */
export const SHEET_GAP_MM = 12;

export interface PageMetricsPx {
  widthPx: number;
  heightPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
  /** 上/下页边距（px） */
  padTopPx: number;
  padBottomPx: number;
  /** 页间空白 widget 的兜底高度（px）= 上下页边距 + 纸间留白 */
  gapPx: number;
  /** 相邻两页纸步进（px）= 纸高 + 纸间留白 */
  advancePx: number;
}

/** 页面几何 → 像素（屏幕分页、纸面定位、快照切页共用） */
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
 * 生成打印用的样式：
 * - @page 声明纸张尺寸 + 边距（CSS 变量在 @page 中不可靠，必须用字面量）；
 * - 分栏与页面背景作用在打印流容器上（@page 无法表达分栏）。
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
