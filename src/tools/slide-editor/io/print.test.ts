import { describe, expect, it, vi } from 'vitest';

// raster.ts pulls in Konva, which requires the native `canvas` package under Node.
// The layout/HTML tests never rasterize, so the renderer is stubbed out.
vi.mock('./raster', () => ({
  renderSlideToDataUrl: () => 'data:image/png;base64,STUB',
  dataUrlToBytes: () => new Uint8Array([0]),
}));

import {
  buildPrintHtml,
  buildPrintPages,
  DEFAULT_PRINT_OPTIONS,
  resolvePageSize,
  type PrintOptions,
} from './print';

/** Print pagination is pure geometry, so it can be asserted without a canvas */

const options = (patch: Partial<PrintOptions> = {}): PrintOptions => ({
  ...DEFAULT_PRINT_OPTIONS,
  ...patch,
});

describe('buildPrintPages', () => {
  it('places one slide per sheet by default', () => {
    const pages = buildPrintPages(10, options());
    expect(pages).toHaveLength(10);
    expect(pages.every((page) => page.slots.length === 1)).toBe(true);
    expect(pages.map((page) => page.slots[0].slideIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('groups four slides per sheet and keeps the remainder on the last sheet', () => {
    const pages = buildPrintPages(10, options({ perPage: 4 }));
    expect(pages).toHaveLength(3);
    expect(pages[0].slots).toHaveLength(4);
    expect(pages[2].slots).toHaveLength(2);
  });

  it('keeps the slide aspect ratio inside each cell', () => {
    const pages = buildPrintPages(4, options({ perPage: 4 }), 16 / 9);
    for (const slot of pages[0].slots) {
      expect(slot.width / slot.height).toBeCloseTo(16 / 9, 5);
    }
  });

  it('never places a slide outside the margins', () => {
    const opts = options({ perPage: 6, margin: 40 });
    const { width, height } = resolvePageSize(opts);
    for (const page of buildPrintPages(6, opts)) {
      for (const slot of page.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(opts.margin - 1e-6);
        expect(slot.y).toBeGreaterThanOrEqual(opts.margin - 1e-6);
        expect(slot.x + slot.width).toBeLessThanOrEqual(width - opts.margin + 1e-6);
        expect(slot.y + slot.height).toBeLessThanOrEqual(height - opts.margin + 1e-6);
      }
    }
  });

  it('returns no pages for an empty document', () => {
    expect(buildPrintPages(0, options())).toEqual([]);
  });
});

describe('resolvePageSize', () => {
  it('swaps width and height for landscape', () => {
    const portrait = resolvePageSize(options({ orientation: 'portrait' }));
    const landscape = resolvePageSize(options({ orientation: 'landscape' }));
    expect(portrait.width).toBeCloseTo(595.28, 2);
    expect(landscape.width).toBeCloseTo(841.89, 2);
    expect(landscape.height).toBeCloseTo(595.28, 2);
  });

  it('supports A3 and Letter', () => {
    expect(resolvePageSize(options({ paper: 'A3' })).width).toBeCloseTo(1190.55, 2);
    expect(resolvePageSize(options({ paper: 'Letter', orientation: 'portrait' })).width).toBe(612);
  });
});

describe('buildPrintHtml', () => {
  it('emits one section per sheet with positioned images', () => {
    const pages = buildPrintPages(2, options({ perPage: 2 }));
    const images = new Map<number, string>([
      [0, 'data:image/png;base64,AAA'],
      [1, 'data:image/png;base64,BBB'],
    ]);
    const html = buildPrintHtml(pages, images, options({ perPage: 2 }), 'deck');
    expect(html.match(/class="print-page"/g)).toHaveLength(1);
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).toContain('@page');
    expect(html).toContain('deck');
  });

  it('adds page numbers only when requested', () => {
    const pages = buildPrintPages(2, options({ perPage: 1 }));
    const images = new Map<number, string>([[0, 'data:image/png;base64,AAA']]);
    expect(buildPrintHtml(pages, images, options({ pageNumbers: false }))).not.toContain(
      'class="num"',
    );
    expect(buildPrintHtml(pages, images, options({ pageNumbers: true }))).toContain('class="num"');
  });
});
