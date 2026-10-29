import { describe, expect, it } from 'vitest';
import type { PageSetupConfig } from './pageSetup';
import {
  DEFAULT_PAGE_SETUP,
  DEFAULT_WATERMARK,
  MARGIN_PRESETS,
  buildPrintPageCss,
  computePageMetrics,
  mergePageSetup,
  mmToTwip,
  normalizePageSetup,
  resolvePageMetrics,
  watermarkCssVars,
} from './pageSetup';

/** Pure-logic tests for page setup (paper / orientation / margins / columns / watermark / CSS vars / twips) */

/**
 * Build "dirty" inputs: at runtime normalizePageSetup faces arbitrary JSON from local storage,
 * so the tests bypass type checking to cover invalid values.
 */
function raw(patch: Record<string, unknown>): Partial<PageSetupConfig> {
  return { ...DEFAULT_PAGE_SETUP, ...patch } as unknown as Partial<PageSetupConfig>;
}

describe('normalizePageSetup', () => {
  it('falls back to A4 portrait with default margins for empty input', () => {
    const config = normalizePageSetup(null);
    expect(config.size).toBe('A4');
    expect(config.orientation).toBe('portrait');
    expect(config.margin).toEqual(MARGIN_PRESETS.normal);
    expect(config.showPageNumber).toBe(true);
  });

  it('clamps invalid margins to the lower bound', () => {
    const config = normalizePageSetup({ margin: { top: 1, right: 0, bottom: 999, left: 8 } });
    expect(config.margin.top).toBe(5);
    expect(config.margin.right).toBe(5);
    expect(config.margin.bottom).toBe(999);
    expect(config.margin.left).toBe(8);
  });
});

describe('computePageMetrics', () => {
  it('A4 portrait is 210×297 with a 170×257 content area', () => {
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

  it('swaps width and height in landscape', () => {
    const result = computePageMetrics({ ...DEFAULT_PAGE_SETUP, orientation: 'landscape' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.widthMm).toBe(297);
      expect(result.value.heightMm).toBe(210);
      expect(result.value.contentHeightMm).toBe(170);
    }
  });

  it('supports Letter size with narrow margins', () => {
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

  it('reports INVALID_RANGE when huge margins leave no usable content area', () => {
    const result = computePageMetrics({
      ...DEFAULT_PAGE_SETUP,
      margin: { top: 150, right: 20, bottom: 150, left: 20 },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe('INVALID_RANGE');
  });

  it('resolvePageMetrics falls back to default A4 for invalid settings', () => {
    const metrics = resolvePageMetrics({
      margin: { top: 200, right: 200, bottom: 200, left: 200 },
    });
    expect(metrics.widthMm).toBe(210);
    expect(metrics.contentWidthMm).toBe(170);
  });
});

describe('unit conversion and print CSS', () => {
  it('converts mm → twips (A4 width ≈ 11907)', () => {
    expect(mmToTwip(210)).toBe(11906);
  });

  it('includes paper size and margins in the print CSS', () => {
    const metrics = resolvePageMetrics(DEFAULT_PAGE_SETUP);
    const css = buildPrintPageCss(metrics, DEFAULT_PAGE_SETUP.margin);
    expect(css).toContain('size: 210mm 297mm');
    expect(css).toContain('margin: 20mm 20mm 20mm 20mm');
    expect(css).toContain('background: var(--rte-page-background');
  });

  it('includes the column count in print CSS for columns (@page cannot express them)', () => {
    const metrics = resolvePageMetrics({ ...DEFAULT_PAGE_SETUP, columns: 2 });
    const css = buildPrintPageCss(metrics, DEFAULT_PAGE_SETUP.margin);
    expect(css).toContain('column-count: 2');
    expect(css).toContain('column-gap: 8mm');
    // No column rule for a single column, to keep the browser default layout
    const single = buildPrintPageCss(
      resolvePageMetrics(DEFAULT_PAGE_SETUP),
      DEFAULT_PAGE_SETUP.margin,
    );
    expect(single).not.toContain('column-count');
  });
});

describe('layout field normalization', () => {
  it('clamps columns to 1-3 and falls back when each column would be too narrow', () => {
    expect(normalizePageSetup({ ...DEFAULT_PAGE_SETUP, columns: 3 }).columns).toBe(3);
    expect(normalizePageSetup(raw({ columns: 9 })).columns).toBe(3);
    expect(normalizePageSetup(raw({ columns: 0 })).columns).toBe(1);
    // With margins squeezing the content area to 80mm, 3 columns (26.7mm each) are unreadable → fall back to 2 (40mm each)
    const narrowContent = { top: 20, right: 65, bottom: 20, left: 65 };
    expect(normalizePageSetup(raw({ margin: narrowContent, columns: 3 })).columns).toBe(2);
    // Squeezing the content area to 50mm allows a single column only
    const tiny = { top: 20, right: 80, bottom: 20, left: 80 };
    expect(normalizePageSetup(raw({ margin: tiny, columns: 3 })).columns).toBe(1);
  });

  it('watermark: empty text disables it, opacity and angle are clamped, colors normalize to #rrggbb', () => {
    expect(normalizePageSetup(raw({ watermark: { text: '   ' } })).watermark).toBeNull();
    const watermark = normalizePageSetup(
      raw({ watermark: { text: '机密', opacity: 5, rotation: 400, color: '#ABC' } }),
    ).watermark;
    expect(watermark).toEqual({ text: '机密', opacity: 0.6, rotation: 90, color: '#aabbcc' });
    expect(
      normalizePageSetup(raw({ watermark: { text: 'x', opacity: 0 } })).watermark?.opacity,
    ).toBe(0.02);
  });

  it('truncates overly long watermark text and falls back for invalid colors', () => {
    const watermark = normalizePageSetup(
      raw({ watermark: { text: 'x'.repeat(60), color: 'red' } }),
    ).watermark;
    expect(watermark?.text).toHaveLength(40);
    expect(watermark?.color).toBe(DEFAULT_WATERMARK.color);
  });

  it('page background: anything other than hex means no color', () => {
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

  it('a different first page requires an explicit true', () => {
    expect(
      normalizePageSetup({ ...DEFAULT_PAGE_SETUP, differentFirstPage: true }).differentFirstPage,
    ).toBe(true);
    expect(
      normalizePageSetup({ ...DEFAULT_PAGE_SETUP, differentFirstPage: 'yes' as never })
        .differentFirstPage,
    ).toBe(false);
  });

  it('CSS variables cover columns, column gap, and page background', () => {
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

  it('watermarkCssVars emits color / angle / opacity variables', () => {
    expect(watermarkCssVars({ text: 'x', color: '#ff0000', rotation: -30, opacity: 0.2 })).toEqual({
      '--rte-watermark-color': '#ff0000',
      '--rte-watermark-rotation': '-30deg',
      '--rte-watermark-opacity': '0.2',
    });
  });
});

describe('mergePageSetup', () => {
  it('composes two edits that arrive before a re-render', () => {
    // Regression: the panel used to rebuild a whole config from the rendered props, so picking Letter and
    // then landscape stored "A4 landscape" (the second edit read the size back before the first landed)
    const afterSize = mergePageSetup(DEFAULT_PAGE_SETUP, { size: 'Letter' });
    const afterOrientation = mergePageSetup(afterSize, { orientation: 'landscape' });
    expect(afterOrientation.size).toBe('Letter');
    expect(afterOrientation.orientation).toBe('landscape');
  });

  it('merges one margin side without touching the others', () => {
    const merged = mergePageSetup(DEFAULT_PAGE_SETUP, { margin: { top: 30 } });
    expect(merged.margin).toEqual({ ...DEFAULT_PAGE_SETUP.margin, top: 30 });
  });

  it('merges watermark fields and treats null as "remove"', () => {
    const withWatermark = mergePageSetup(DEFAULT_PAGE_SETUP, {
      watermark: { ...DEFAULT_WATERMARK, text: '内部资料' },
    });
    expect(withWatermark.watermark?.text).toBe('内部资料');
    const recolored = mergePageSetup(withWatermark, { watermark: { color: '#ff0000' } });
    expect(recolored.watermark).toMatchObject({ text: '内部资料', color: '#ff0000' });
    expect(mergePageSetup(recolored, { watermark: null }).watermark).toBeNull();
  });

  it('keeps null for background but ignores untouched fields', () => {
    const themed = mergePageSetup(DEFAULT_PAGE_SETUP, { background: '#fff8e1' });
    expect(themed.background).toBe('#fff8e1');
    expect(mergePageSetup(themed, { background: null }).background).toBeNull();
    expect(mergePageSetup(themed, {}).background).toBe('#fff8e1');
    expect(mergePageSetup(themed, {}).size).toBe(DEFAULT_PAGE_SETUP.size);
  });
});
