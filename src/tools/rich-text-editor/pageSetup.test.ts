import { describe, expect, it } from 'vitest';
import type { PageSetupConfig } from './pageSetup';
import {
  DEFAULT_PAGE_SETUP,
  DEFAULT_WATERMARK,
  MARGIN_PRESETS,
  buildPrintPageCss,
  computePageMetrics,
  mmToTwip,
  normalizePageSetup,
  resolvePageMetrics,
  watermarkCssVars,
} from './pageSetup';

/** 页面设置纯逻辑单测（纸张 / 方向 / 边距 / 分栏 / 水印 / CSS 变量 / twip） */

/**
 * 构造「脏数据」入参：normalizePageSetup 在运行时面对的是本地存储里的任意 JSON，
 * 因此测试里需要绕过类型检查来覆盖非法取值。
 */
function raw(patch: Record<string, unknown>): Partial<PageSetupConfig> {
  return { ...DEFAULT_PAGE_SETUP, ...patch } as unknown as Partial<PageSetupConfig>;
}

describe('normalizePageSetup', () => {
  it('空输入回落到 A4 纵向默认边距', () => {
    const config = normalizePageSetup(null);
    expect(config.size).toBe('A4');
    expect(config.orientation).toBe('portrait');
    expect(config.margin).toEqual(MARGIN_PRESETS.normal);
    expect(config.showPageNumber).toBe(true);
  });

  it('非法边距被裁剪到下限', () => {
    const config = normalizePageSetup({ margin: { top: 1, right: 0, bottom: 999, left: 8 } });
    expect(config.margin.top).toBe(5);
    expect(config.margin.right).toBe(5);
    expect(config.margin.bottom).toBe(999);
    expect(config.margin.left).toBe(8);
  });
});

describe('computePageMetrics', () => {
  it('A4 纵向：210×297，内容 170×257', () => {
    const result = computePageMetrics(DEFAULT_PAGE_SETUP);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.widthMm).toBe(210);
      expect(result.value.heightMm).toBe(297);
      expect(result.value.contentWidthMm).toBe(170);
      expect(result.value.contentHeightMm).toBe(257);
      expect(result.value.cssVars['--rte-content-width']).toBe('170mm');
    }
  });

  it('横向交换宽高', () => {
    const result = computePageMetrics({ ...DEFAULT_PAGE_SETUP, orientation: 'landscape' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.widthMm).toBe(297);
      expect(result.value.heightMm).toBe(210);
      expect(result.value.contentHeightMm).toBe(170);
    }
  });

  it('Letter 尺寸与窄边距', () => {
    const result = computePageMetrics({
      ...DEFAULT_PAGE_SETUP,
      size: 'Letter',
      margin: MARGIN_PRESETS.narrow,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.widthMm).toBe(215.9);
      expect(result.value.heightMm).toBe(279.4);
      expect(result.value.contentWidthMm).toBe(190.5);
    }
  });

  it('边距过大导致内容区不可用 → INVALID_RANGE', () => {
    const result = computePageMetrics({
      ...DEFAULT_PAGE_SETUP,
      margin: { top: 150, right: 20, bottom: 150, left: 20 },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe('INVALID_RANGE');
  });

  it('resolvePageMetrics 在非法设置下退回默认 A4', () => {
    const metrics = resolvePageMetrics({
      margin: { top: 200, right: 200, bottom: 200, left: 200 },
    });
    expect(metrics.widthMm).toBe(210);
    expect(metrics.contentWidthMm).toBe(170);
  });
});

describe('单位换算与打印 CSS', () => {
  it('mm → twip（A4 宽 ≈ 11907）', () => {
    expect(mmToTwip(210)).toBe(11906);
  });

  it('打印 CSS 带纸张尺寸与边距', () => {
    const metrics = resolvePageMetrics(DEFAULT_PAGE_SETUP);
    const css = buildPrintPageCss(metrics, DEFAULT_PAGE_SETUP.margin);
    expect(css).toContain('size: 210mm 297mm');
    expect(css).toContain('margin: 20mm 20mm 20mm 20mm');
    expect(css).toContain('background: var(--rte-page-background');
  });

  it('分栏时打印 CSS 带上列数（@page 无法表达分栏）', () => {
    const metrics = resolvePageMetrics({ ...DEFAULT_PAGE_SETUP, columns: 2 });
    const css = buildPrintPageCss(metrics, DEFAULT_PAGE_SETUP.margin);
    expect(css).toContain('column-count: 2');
    expect(css).toContain('column-gap: 8mm');
    // 单栏时不写分栏规则，避免影响浏览器默认排版
    const single = buildPrintPageCss(
      resolvePageMetrics(DEFAULT_PAGE_SETUP),
      DEFAULT_PAGE_SETUP.margin,
    );
    expect(single).not.toContain('column-count');
  });
});

describe('版式字段规范化', () => {
  it('分栏裁剪到 1-3，并在栏宽不足时回退', () => {
    expect(normalizePageSetup({ ...DEFAULT_PAGE_SETUP, columns: 3 }).columns).toBe(3);
    expect(normalizePageSetup(raw({ columns: 9 })).columns).toBe(3);
    expect(normalizePageSetup(raw({ columns: 0 })).columns).toBe(1);
    // 页边距把内容区压到 80mm 时，3 栏（26.7mm/栏）不可读 → 回退到 2 栏（40mm/栏）
    const narrowContent = { top: 20, right: 65, bottom: 20, left: 65 };
    expect(normalizePageSetup(raw({ margin: narrowContent, columns: 3 })).columns).toBe(2);
    // 内容区进一步压缩到 50mm 时只能单栏
    const tiny = { top: 20, right: 80, bottom: 20, left: 80 };
    expect(normalizePageSetup(raw({ margin: tiny, columns: 3 })).columns).toBe(1);
  });

  it('水印：空文字视为关闭，透明度与角度被裁剪，颜色统一为 #rrggbb', () => {
    expect(normalizePageSetup(raw({ watermark: { text: '   ' } })).watermark).toBeNull();
    const watermark = normalizePageSetup(
      raw({ watermark: { text: '机密', opacity: 5, rotation: 400, color: '#ABC' } }),
    ).watermark;
    expect(watermark).toEqual({ text: '机密', opacity: 0.6, rotation: 90, color: '#aabbcc' });
    expect(
      normalizePageSetup(raw({ watermark: { text: 'x', opacity: 0 } })).watermark?.opacity,
    ).toBe(0.02);
  });

  it('水印超长文字被截断，非法颜色回退默认值', () => {
    const watermark = normalizePageSetup(
      raw({ watermark: { text: 'x'.repeat(60), color: 'red' } }),
    ).watermark;
    expect(watermark?.text).toHaveLength(40);
    expect(watermark?.color).toBe(DEFAULT_WATERMARK.color);
  });

  it('页面背景：十六进制外的一律视为无色', () => {
    expect(normalizePageSetup({ ...DEFAULT_PAGE_SETUP, background: '#EEF2FF' }).background).toBe(
      '#eef2ff',
    );
    expect(normalizePageSetup({ ...DEFAULT_PAGE_SETUP, background: '#123' }).background).toBe(
      '#112233',
    );
    expect(
      normalizePageSetup({ ...DEFAULT_PAGE_SETUP, background: 'rgb(1,2,3)' }).background,
    ).toBeNull();
  });

  it('首页不同只有显式 true 才生效', () => {
    expect(
      normalizePageSetup({ ...DEFAULT_PAGE_SETUP, differentFirstPage: true }).differentFirstPage,
    ).toBe(true);
    expect(
      normalizePageSetup({ ...DEFAULT_PAGE_SETUP, differentFirstPage: 'yes' as never })
        .differentFirstPage,
    ).toBe(false);
  });

  it('CSS 变量包含分栏、列间距与页面背景', () => {
    const metrics = resolvePageMetrics({
      ...DEFAULT_PAGE_SETUP,
      columns: 2,
      background: '#fff8e1',
    });
    expect(metrics.cssVars['--rte-column-count']).toBe('2');
    expect(metrics.cssVars['--rte-column-gap']).toBe('8mm');
    expect(metrics.cssVars['--rte-page-background']).toBe('#fff8e1');
    expect(metrics.columns).toBe(2);
  });

  it('watermarkCssVars 输出颜色 / 角度 / 透明度变量', () => {
    expect(watermarkCssVars({ text: 'x', color: '#ff0000', rotation: -30, opacity: 0.2 })).toEqual({
      '--rte-watermark-color': '#ff0000',
      '--rte-watermark-rotation': '-30deg',
      '--rte-watermark-opacity': '0.2',
    });
  });
});
