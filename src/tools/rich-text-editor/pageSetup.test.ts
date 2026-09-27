import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SETUP,
  MARGIN_PRESETS,
  buildPrintPageCss,
  computePageMetrics,
  mmToTwip,
  normalizePageSetup,
  resolvePageMetrics,
} from './pageSetup';

/** 页面设置纯逻辑单测（纸张 / 方向 / 边距 / CSS 变量 / twip） */

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
  });
});
