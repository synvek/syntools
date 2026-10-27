import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from '../core';
import { migrateDoc } from './migrate';
import type { Layer, PhotoDoc } from './types';

function doc(layers: unknown[], extra: Record<string, unknown> = {}): unknown {
  return { id: 'doc-1', name: 'n', width: 800, height: 600, background: 'white', layers, ...extra };
}

function raster(id: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    kind: 'raster',
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
    assetId: `asset-${id}`,
    rev: 1,
    adjustments: {},
    filters: [],
    ...patch,
  };
}

function group(id: string, patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    kind: 'group',
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    blend: 'normal',
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    rotation: 0,
    flipX: false,
    flipY: false,
    passThrough: true,
    ...patch,
  };
}

describe('Document migration / normalization (project v1 → v2)', () => {
  it('a v1 document (three legacy layer kinds) gains new fields without changing content', () => {
    const result = migrateDoc(doc([raster('a'), { ...raster('b'), kind: 'text', text: 'hi' }]));
    expect(result).not.toBeNull();
    expect(result!.layers).toHaveLength(2);
    for (const layer of result!.layers) {
      expect(layer.parentId ?? null).toBeNull();
      expect(layer.mask ?? null).toBeNull();
    }
    expect(result!.width).toBe(800);
    expect(result!.activeLayerId).toBeNull();
  });

  it('layers of unknown type are dropped rather than breaking the whole file', () => {
    const result = migrateDoc(doc([raster('a'), { id: 'x', kind: 'ufo' }, raster('b')]));
    expect(result!.layers.map((layer) => layer.id)).toEqual(['a', 'b']);
  });

  it('a parentId pointing at nothing or a non-group demotes the layer to top level', () => {
    const result = migrateDoc(
      doc([
        group('g'),
        raster('child', { parentId: 'g' }),
        raster('ghost', { parentId: 'g' }),
        raster('orphan', { parentId: 'nope' }),
      ]),
    )!;
    expect(result.layers.find((l) => l.id === 'child')!.parentId).toBe('g');
    expect(result.layers.find((l) => l.id === 'ghost')!.parentId).toBe('g');
    expect(result.layers.find((l) => l.id === 'orphan')!.parentId).toBeNull();
  });

  it('self-referencing groups and parent/child cycles are broken', () => {
    const self = migrateDoc(doc([group('g', { parentId: 'g' })]))!;
    expect(self.layers[0].parentId).toBeNull();

    const loop = migrateDoc(doc([group('a', { parentId: 'b' }), group('b', { parentId: 'a' })]))!;
    // Neither group may remain in the cycle
    expect(loop.layers.filter((l) => l.parentId === null).length).toBeGreaterThanOrEqual(1);
  });

  it('missing fields get defaults per layer type', () => {
    const result = migrateDoc(doc([{ id: 'a', kind: 'raster' }]))!;
    const layer = result.layers[0];
    expect(layer.visible).toBe(true);
    expect(layer.opacity).toBe(1);
    expect(layer.blend).toBe('normal');
    expect(layer.width).toBeGreaterThanOrEqual(1);
    expect(layer.kind === 'raster' && layer.rev).toBeGreaterThanOrEqual(1);
    expect(layer.kind === 'raster' && layer.adjustments.brightness).toBe(0);
  });

  it('illegal blend modes and filters are filtered out', () => {
    const result = migrateDoc(
      doc([
        raster('a', { blend: 'luminosity' }),
        raster('b', { blend: 'nope', filters: ['blur', 'fake'] }),
      ]),
    )!;
    expect(result.layers[0].blend).toBe('luminosity');
    expect(result.layers[1].blend).toBe('normal');
    // The old `FilterId[]` format is upgraded to "spec + default params"
    const filters = result.layers[1].kind === 'raster' ? result.layers[1].filters : [];
    expect(filters).toEqual([{ id: 'blur', params: { radius: 4 } }]);
  });

  it('new-format filters keep their parameters, out-of-range ones clamp', () => {
    const result = migrateDoc(
      doc([
        raster('a', {
          filters: [
            { id: 'posterize', params: { levels: 999 } },
            { id: 'nope', params: {} },
          ],
        }),
      ]),
    )!;
    const filters = result.layers[0].kind === 'raster' ? result.layers[0].filters : [];
    expect(filters).toHaveLength(1);
    expect(filters[0].id).toBe('posterize');
    // FILTER_PARAMS has max = 16
    expect(filters[0].params?.levels).toBe(16);
  });

  it('extended adjustment fields are normalized and nulls fall back to disabled', () => {
    const result = migrateDoc(
      doc([
        raster('a', {
          adjustments: {
            levels: { inBlack: 10, inWhite: 240, gamma: 1.2, outBlack: 0, outWhite: 255 },
            threshold: 999,
            curves: {
              rgb: [
                { x: 0, y: 0 },
                { x: 255, y: 200 },
              ],
            },
          },
        }),
        raster('b', { adjustments: { threshold: 128 } }),
      ]),
    )!;
    const first = result.layers[0].kind === 'raster' ? result.layers[0].adjustments : null;
    const second = result.layers[1].kind === 'raster' ? result.layers[1].adjustments : null;
    expect(first?.levels?.inWhite).toBe(240);
    expect(first?.threshold).toBe(255);
    expect(first?.curves?.rgb).toHaveLength(2);
    expect(second?.levels ?? null).toBeNull();
    expect(second?.threshold).toBe(128);
  });

  it('canvas dimensions clamp to the valid range', () => {
    const small = migrateDoc(doc([], { width: 1, height: 99999 }))!;
    expect(small.width).toBe(MIN_CANVAS_SIZE);
    expect(small.height).toBe(MAX_CANVAS_SIZE);
  });

  it('activeLayerId resets when it points at nothing', () => {
    const result = migrateDoc(doc([raster('a')], { activeLayerId: 'gone' }))!;
    expect(result.activeLayerId).toBeNull();
    const ok = migrateDoc(doc([raster('a')], { activeLayerId: 'a' }))!;
    expect(ok.activeLayerId).toBe('a');
  });

  it('mask parameters are normalized (density 0~1, rev ≥ 1, no assetId means no mask)', () => {
    const result = migrateDoc(
      doc([
        raster('a', { mask: { assetId: 'm1', density: 9, rev: 0, feather: -2 } }),
        raster('b', { mask: { density: 0.5 } }),
      ]),
    )!;
    const mask = result.layers[0].mask!;
    expect(mask.assetId).toBe('m1');
    expect(mask.density).toBe(1);
    expect(mask.rev).toBe(1);
    expect(mask.feather).toBe(0);
    expect(result.layers[1].mask).toBeNull();
  });

  it('an unusable structure (no layers / not an object) returns null', () => {
    expect(migrateDoc(null)).toBeNull();
    expect(migrateDoc({ width: 100, height: 100 })).toBeNull();
    expect(migrateDoc(doc([]))).not.toBeNull();
  });

  it('smart objects keep their source pixel size', () => {
    const result = migrateDoc(
      doc([{ id: 's', kind: 'smart', sourceAssetId: 'src', sourceWidth: 40, sourceHeight: 30 }]),
    )!;
    const layer = result.layers[0];
    expect(layer.kind === 'smart' && layer.sourceWidth).toBe(40);
    expect(layer.kind === 'smart' && layer.sourceHeight).toBe(30);
  });

  it('layer order is z order (the tail is the top layer)', () => {
    const result = migrateDoc(doc([raster('a'), raster('b'), raster('c')]))!;
    expect((result.layers as Layer[]).map((l) => l.id)).toEqual(['a', 'b', 'c']);
    expect((result as PhotoDoc).layers.at(-1)!.id).toBe('c');
  });
});
