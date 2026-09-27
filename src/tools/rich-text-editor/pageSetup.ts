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
}

export interface PageMetrics {
  /** 纸张尺寸（mm，已按方向交换） */
  widthMm: number;
  heightMm: number;
  /** 内容区尺寸（mm） */
  contentWidthMm: number;
  contentHeightMm: number;
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
};

const MIN_MARGIN_MM = 5;
/** 内容区最小宽度（mm），避免边距设置把版面压到不可用 */
const MIN_CONTENT_WIDTH_MM = 40;
const MIN_CONTENT_HEIGHT_MM = 40;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 规范化配置：补齐缺失字段、裁剪非法值 */
export function normalizePageSetup(input: Partial<PageSetupConfig> | null): PageSetupConfig {
  const raw = input ?? {};
  const margin: Partial<PageMargins> = raw.margin ?? {};
  const size: PageSize = raw.size === 'Letter' ? 'Letter' : 'A4';
  return {
    size,
    orientation: raw.orientation === 'landscape' ? 'landscape' : 'portrait',
    margin: {
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
    },
    header: typeof raw.header === 'string' ? raw.header : '',
    footer: typeof raw.footer === 'string' ? raw.footer : '',
    showPageNumber: raw.showPageNumber !== false,
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
      cssVars: {
        '--rte-page-width': `${round(widthMm)}mm`,
        '--rte-page-height': `${round(heightMm)}mm`,
        '--rte-page-margin-top': `${round(config.margin.top)}mm`,
        '--rte-page-margin-right': `${round(config.margin.right)}mm`,
        '--rte-page-margin-bottom': `${round(config.margin.bottom)}mm`,
        '--rte-page-margin-left': `${round(config.margin.left)}mm`,
        '--rte-content-width': `${round(contentWidthMm)}mm`,
        '--rte-content-height': `${round(contentHeightMm)}mm`,
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

/** 生成打印用的 @page 声明（纸张尺寸 + 边距用字面量，CSS 变量在 @page 中不可靠） */
export function buildPrintPageCss(metrics: PageMetrics, margin: PageMargins): string {
  return `@page { size: ${metrics.widthMm}mm ${metrics.heightMm}mm; margin: ${margin.top}mm ${margin.right}mm ${margin.bottom}mm ${margin.left}mm; }`;
}
