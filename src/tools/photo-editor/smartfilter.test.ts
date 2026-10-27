import { describe, expect, it } from 'vitest';
import {
  NO_ADJUSTMENTS,
  activeFilters,
  bakeSignature,
  hasActiveFilters,
  needsPixelPass,
} from './core';
import { createSmartLayer } from './model/factory';
import { migrateDoc } from './model/migrate';
import { layerNeedsComposite } from './render/paint';
import type { FilterSpec, PhotoDoc, SmartLayer } from './model/types';

const docStub = { width: 200, height: 200 } as PhotoDoc;

const blur = (patch: Partial<FilterSpec> = {}): FilterSpec => ({
  id: 'gaussianBlur',
  params: { radius: 8 },
  ...patch,
});

const smart = (filters: FilterSpec[]): SmartLayer => ({
  ...createSmartLayer({
    doc: docStub,
    sourceAssetId: 'src',
    sourceWidth: 100,
    sourceHeight: 100,
  }),
  filters,
});

describe('activeFilters: enable / disable semantics', () => {
  it('missing means enabled (no enabled field)', () => {
    expect(activeFilters([{ id: 'blur', params: { radius: 4 } }])).toHaveLength(1);
  });

  it('filters with enabled: false are excluded but keep their entry in the list', () => {
    const filters: FilterSpec[] = [blur(), { id: 'noise', params: { amount: 10 }, enabled: false }];
    expect(activeFilters(filters)).toHaveLength(1);
    expect(activeFilters(filters)[0].id).toBe('gaussianBlur');
    // The panel must keep showing the disabled entry, so the original array must not be mutated in place
    expect(filters).toHaveLength(2);
  });

  it('empty lists / null / undefined are all safe', () => {
    expect(activeFilters([])).toEqual([]);
    expect(activeFilters(null)).toEqual([]);
    expect(activeFilters(undefined)).toEqual([]);
  });

  it('hasActiveFilters reflects whether any filter is still enabled', () => {
    expect(hasActiveFilters([blur()])).toBe(true);
    expect(hasActiveFilters([blur({ enabled: false })])).toBe(false);
    expect(hasActiveFilters([])).toBe(false);
  });
});

describe('Disabled filters drop out of baking', () => {
  it('all disabled needs no pixel pass', () => {
    const filters: FilterSpec[] = [
      blur({ enabled: false }),
      { id: 'unsharp', params: { radius: 4, amount: 100 }, enabled: false },
    ];
    expect(needsPixelPass(NO_ADJUSTMENTS, filters)).toBe(false);
  });

  it('an enabled pixel-level filter (USM) uses the pixel pass', () => {
    expect(
      needsPixelPass(NO_ADJUSTMENTS, [{ id: 'unsharp', params: { radius: 4, amount: 100 } }]),
    ).toBe(true);
  });
});

describe('The cache signature reacts to enable / disable', () => {
  it('the same filter yields different signatures enabled vs disabled (otherwise nothing repaints)', () => {
    const on = bakeSignature('a1', 1, NO_ADJUSTMENTS, [blur()]);
    const off = bakeSignature('a1', 1, NO_ADJUSTMENTS, [blur({ enabled: false })]);
    expect(on).not.toBe(off);
  });

  it('filters with the same parameters in a different key order share a signature', () => {
    const a = bakeSignature('a1', 1, NO_ADJUSTMENTS, [
      { id: 'noise', params: { amount: 10, mono: 1 } },
    ]);
    const b = bakeSignature('a1', 1, NO_ADJUSTMENTS, [
      { id: 'noise', params: { mono: 1, amount: 10 } },
    ]);
    expect(a).toBe(b);
  });

  it('NO_ADJUSTMENTS equals no adjustments', () => {
    expect(needsPixelPass(NO_ADJUSTMENTS, [])).toBe(false);
  });
});

describe('Smart filters decide whether the preview composites offscreen', () => {
  it('with enabled filters it must composite (otherwise Konva draws the source and the filter is invisible)', () => {
    expect(layerNeedsComposite(smart([blur()]))).toBe(true);
  });

  it('no filters or all disabled keeps the lightweight path', () => {
    expect(layerNeedsComposite(smart([]))).toBe(false);
    expect(layerNeedsComposite(smart([blur({ enabled: false })]))).toBe(false);
  });
});

describe('migrateDoc: normalizing the smart filter stack', () => {
  const raw = (filters: unknown) => ({
    id: 'doc-1',
    name: 'n',
    width: 200,
    height: 200,
    background: 'white',
    layers: [
      {
        id: 's1',
        kind: 'smart',
        name: '',
        visible: true,
        locked: false,
        opacity: 1,
        blend: 'normal',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        flipX: false,
        flipY: false,
        sourceAssetId: 'src',
        sourceWidth: 100,
        sourceHeight: 100,
        filters,
      },
    ],
  });

  function parse(input: unknown): PhotoDoc {
    const parsed = migrateDoc(input);
    if (!parsed) throw new Error('migrateDoc 返回 null');
    return parsed;
  }

  it('old projects without a filters field get an empty stack', () => {
    const parsed = parse(raw(undefined));
    const layer = parsed.layers[0] as SmartLayer;
    expect(layer.filters).toEqual([]);
    expect(layerNeedsComposite(layer)).toBe(false);
  });

  it('keeps enabled: false and fills in default parameters', () => {
    const parsed = parse(raw([{ id: 'gaussianBlur', params: { radius: 12 }, enabled: false }]));
    const layer = parsed.layers[0] as SmartLayer;
    expect(layer.filters).toHaveLength(1);
    expect(layer.filters[0].enabled).toBe(false);
    expect(layer.filters[0].params?.radius).toBe(12);
    // Enabled filters are written without an enabled field by default
    const enabled = parse(raw([{ id: 'gaussianBlur', params: { radius: 12 } }]));
    expect((enabled.layers[0] as SmartLayer).filters[0].enabled).toBeUndefined();
  });

  it('unknown filter ids and illegal parameters are dropped / clamped', () => {
    const parsed = parse(
      raw([{ id: 'notAFilter' }, { id: 'gaussianBlur', params: { radius: 99999 } }]),
    );
    const layer = parsed.layers[0] as SmartLayer;
    expect(layer.filters).toHaveLength(1);
    expect(layer.filters[0].id).toBe('gaussianBlur');
    expect(layer.filters[0].params?.radius).toBeLessThan(99999);
  });
});
