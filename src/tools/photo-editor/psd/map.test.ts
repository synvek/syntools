import { describe, expect, it } from 'vitest';
import { buildPsdPlan, mapBlendMode } from './map';
import type { Layer, PhotoDoc } from '../model/types';

const base = {
  name: '',
  visible: true,
  locked: false,
  opacity: 1,
  blend: 'normal' as const,
  x: 10,
  y: 20,
  width: 100,
  height: 80,
  rotation: 0,
  flipX: false,
  flipY: false,
};

const raster = (id: string, patch: Partial<Layer> = {}): Layer =>
  ({
    ...base,
    id,
    kind: 'raster',
    assetId: `a-${id}`,
    rev: 1,
    adjustments: {} as never,
    filters: [],
    ...patch,
  }) as Layer;

const group = (id: string, passThrough = true, patch: Partial<Layer> = {}): Layer =>
  ({ ...base, id, kind: 'group', passThrough, ...patch }) as Layer;

const adjustment = (id: string, patch: Partial<Layer> = {}): Layer =>
  ({
    ...base,
    id,
    kind: 'adjustment',
    adjustments: {} as never,
    filters: [],
    ...patch,
  }) as Layer;

const docOf = (layers: Layer[]): PhotoDoc => ({
  id: 'd',
  name: '',
  width: 800,
  height: 600,
  background: 'white',
  layers,
  activeLayerId: null,
  swatches: [],
});

describe('PSD structure mapping (pure functions)', () => {
  it('blend modes map to names Photoshop understands', () => {
    expect(mapBlendMode('normal')).toBe('normal');
    expect(mapBlendMode('multiply')).toBe('multiply');
    expect(mapBlendMode('color-dodge')).toBe('color dodge');
    expect(mapBlendMode('luminosity')).toBe('luminosity');
  });

  it('regular layers: one pixel layer each', () => {
    const plan = buildPsdPlan(docOf([raster('a'), raster('b')]));
    expect(plan.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(plan.degraded).toHaveLength(0);
  });

  it('adjustment layers: merged with the level content below into one pixel layer', () => {
    const plan = buildPsdPlan(docOf([raster('a'), raster('b'), adjustment('adj')]));
    // a and b are merged, then folded into the adjustment layer
    expect(plan.nodes).toHaveLength(1);
    expect(plan.nodes[0].sources).toEqual(['a', 'b', 'adj']);
    expect(plan.degraded).toEqual([{ layerId: 'adj', reason: 'adjustment' }]);
  });

  it('hidden adjustment layers are ignored', () => {
    const plan = buildPsdPlan(docOf([raster('a'), adjustment('adj', { visible: false })]));
    expect(plan.nodes).toHaveLength(1);
    expect(plan.nodes[0].sources).toEqual(['a']);
    expect(plan.degraded).toHaveLength(0);
  });

  it('pass-through groups export as PSD layer groups; whole-composite modes flatten to a pixel layer', () => {
    const passThrough = buildPsdPlan(docOf([group('g'), raster('c', { parentId: 'g' })]));
    expect(passThrough.nodes[0].kind).toBe('group');
    expect(passThrough.nodes[0].children).toHaveLength(1);

    const isolated = buildPsdPlan(docOf([group('g', false), raster('c', { parentId: 'g' })]));
    expect(isolated.nodes[0].kind).toBe('pixel');
    // Whole composite: the group's children are flattened into one image (the group itself has no pixels)
    expect(isolated.nodes[0].sources).toEqual(['c']);
  });

  it('empty groups are dropped (meaningless in PSD)', () => {
    const plan = buildPsdPlan(docOf([group('g'), raster('a')]));
    expect(plan.nodes.map((n) => n.id)).toEqual(['a']);
  });

  it('text / shape / smart objects are flagged as rasterized downgrades', () => {
    const plan = buildPsdPlan(
      docOf([
        { ...base, id: 't', kind: 'text', text: 'hi', fontSize: 24 } as Layer,
        { ...base, id: 's', kind: 'shape', shape: 'rect' } as Layer,
        {
          ...base,
          id: 'm',
          kind: 'smart',
          sourceAssetId: 'src',
          sourceWidth: 5,
          sourceHeight: 5,
        } as Layer,
      ]),
    );
    expect(plan.degraded.map((d) => d.reason)).toEqual(['text', 'shape', 'smart']);
  });

  it('masks export with their layer (disabled ones do not)', () => {
    const mask = { assetId: 'mk', rev: 1, enabled: true, inverted: false, density: 1, feather: 3 };
    const plan = buildPsdPlan(docOf([raster('a', { mask })]));
    expect(plan.nodes[0].mask).toMatchObject({ assetId: 'mk', density: 1, feather: 3 });

    const off = buildPsdPlan(docOf([raster('a', { mask: { ...mask, enabled: false } })]));
    expect(off.nodes[0].mask).toBeNull();
  });
});
