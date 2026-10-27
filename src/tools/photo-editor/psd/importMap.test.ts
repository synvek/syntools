import { describe, expect, it } from 'vitest';
import { mapPsdBounds, mapPsdBlendMode, mapPsdColor, mapPsdEffects } from './importMap';
import { flattenPsdLayers, isPsdFile, type PsdImportReport } from './reader';
import type { GroupLayer, Layer } from '../model/types';

/**
 * Tests for the PSD import mapping.
 *
 * Assertions use a structured subset rather than real PSD files: the value of the mapping rules is "how to degrade
 * when a field is missing / disabled / unknown", branches real files rarely cover yet the most likely to break in production.
 */

const report = (): PsdImportReport => ({ rasterized: [], skipped: [] });
const fakeCanvas = () => ({ width: 10, height: 10 }) as unknown as HTMLCanvasElement;

describe('mapPsdBlendMode', () => {
  it('PSD names with spaces map back to our kebab-case values', () => {
    expect(mapPsdBlendMode('soft light')).toBe('soft-light');
    expect(mapPsdBlendMode('color dodge')).toBe('color-dodge');
    expect(mapPsdBlendMode('Hard Light')).toBe('hard-light');
  });

  it('pass-through is not a blend mode and maps to normal (group pass-through is expressed by passThrough)', () => {
    expect(mapPsdBlendMode('pass through')).toBe('normal');
  });

  it('unknown / missing values fall back to normal', () => {
    expect(mapPsdBlendMode(undefined)).toBe('normal');
    expect(mapPsdBlendMode('vivid light')).toBe('normal');
  });
});

describe('mapPsdColor', () => {
  it('components become uppercase hex', () => {
    expect(mapPsdColor({ r: 255, g: 128, b: 0 })).toBe('#FF8000');
  });

  it('out-of-range components clamp, missing ones fall back to black', () => {
    expect(mapPsdColor({ r: 300, g: -20, b: 10 })).toBe('#FF000A');
    expect(mapPsdColor(undefined)).toBe('#000000');
  });
});

describe('mapPsdBounds', () => {
  it('left/top/right/bottom become a rectangle', () => {
    expect(mapPsdBounds({ left: 10, top: 20, right: 110, bottom: 70 })).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it('an empty / degenerate rectangle returns null (empty layers must not yield zero-size objects)', () => {
    expect(mapPsdBounds(undefined)).toBeNull();
    expect(mapPsdBounds({ left: 5, top: 5, right: 5, bottom: 9 })).toBeNull();
  });
});

describe('mapPsdEffects', () => {
  it('returns null when there are no effects', () => {
    expect(mapPsdEffects(undefined)).toBeNull();
    expect(mapPsdEffects({})).toBeNull();
  });

  it('drop shadow: color / opacity / angle / distance / spread / blur all map over (opacity is 0~1)', () => {
    const style = mapPsdEffects({
      dropShadow: [
        {
          enabled: true,
          color: { r: 10, g: 20, b: 30 },
          // ag-psd's opacity is 0~1 (FixedPoint8)
          opacity: 0.6,
          angle: 120,
          distance: { units: 'Pixels', value: 8 },
          choke: { units: 'Pixels', value: 3 },
          blur: { units: 'Pixels', value: 12 },
        },
      ],
    });
    expect(style?.dropShadow).toMatchObject({
      enabled: true,
      color: '#0A141E',
      opacity: 0.6,
      angle: 120,
      distance: 8,
      spread: 3,
      size: 12,
    });
  });

  it('disabled effects are ignored', () => {
    const style = mapPsdEffects({ dropShadow: [{ enabled: false }] });
    expect(style).toBeNull();
  });

  it('takes the first enabled effect (the PSD array may hold several)', () => {
    const style = mapPsdEffects({
      outerGlow: [
        { enabled: false, color: { r: 1, g: 1, b: 1 } },
        { enabled: true, color: { r: 255, g: 0, b: 0 }, opacity: 1, size: { value: 6 } },
      ],
    });
    expect(style?.outerGlow).toMatchObject({ color: '#FF0000', size: 6, enabled: true });
  });

  it('color overlay and stroke: an illegal stroke position falls back to outside', () => {
    const style = mapPsdEffects({
      solidFill: { enabled: true, color: { r: 0, g: 0, b: 255 }, opacity: 0.5 },
      stroke: { enabled: true, color: { r: 0, g: 0, b: 0 }, size: { value: 4 }, position: 'weird' },
    });
    expect(style?.colorOverlay).toMatchObject({ color: '#0000FF', opacity: 0.5 });
    expect(style?.stroke).toMatchObject({ size: 4, position: 'outside' });
  });

  it('inner shadow and inside stroke map normally', () => {
    const style = mapPsdEffects({
      innerShadow: [{ enabled: true, angle: 90, distance: 4, blur: { value: 6 } }],
      stroke: { enabled: true, position: 'inside', size: { value: 2 } },
    });
    expect(style?.innerShadow).toMatchObject({ angle: 90, distance: 4, size: 6 });
    expect(style?.stroke).toMatchObject({ position: 'inside', size: 2 });
  });

  it('spread accepts both choke (the PSD descriptor name) and spread (the alias other tools use)', () => {
    const viaChoke = mapPsdEffects({ dropShadow: [{ enabled: true, choke: 5 }] });
    expect(viaChoke?.dropShadow?.spread).toBe(5);
    const viaSpread = mapPsdEffects({ dropShadow: [{ enabled: true, spread: { value: 2 } }] });
    expect(viaSpread?.dropShadow?.spread).toBe(2);
  });

  it('size fields given as plain numbers are read too', () => {
    const style = mapPsdEffects({ dropShadow: [{ enabled: true, distance: 5, blur: 9 }] });
    expect(style?.dropShadow).toMatchObject({ distance: 5, size: 9 });
  });
});

describe('isPsdFile', () => {
  it('only the .psd extension is accepted (case and surrounding whitespace tolerated)', () => {
    expect(isPsdFile('a.PSD')).toBe(true);
    expect(isPsdFile('  b.psd  ')).toBe(true);
    expect(isPsdFile('c.png')).toBe(false);
    expect(isPsdFile('d.psb')).toBe(false);
  });
});

describe('flattenPsdLayers: flattening the layer stack', () => {
  const raster = (name: string, extra: Record<string, unknown> = {}) => ({
    name,
    canvas: fakeCanvas(),
    left: 0,
    top: 0,
    right: 10,
    bottom: 10,
    opacity: 255,
    ...extra,
  });

  it('flat layers keep bottom-up order (matching our layers array)', () => {
    const out = flattenPsdLayers([raster('bottom'), raster('top')], report(), {
      width: 100,
      height: 100,
    });
    expect(out.map((layer) => layer.name)).toEqual(['bottom', 'top']);
  });

  it('a group expands to the group followed by its children and sets parentId', () => {
    const out = flattenPsdLayers(
      [
        raster('below'),
        {
          name: 'Group',
          blendMode: 'pass through',
          opened: true,
          children: [raster('inner-1'), raster('inner-2')],
        },
      ],
      report(),
      { width: 100, height: 100 },
    );
    expect(out.map((layer) => layer.name)).toEqual(['below', 'Group', 'inner-1', 'inner-2']);
    const group = out[1] as GroupLayer;
    expect(group.kind).toBe('group');
    expect(group.passThrough).toBe(true);
    expect([out[2].parentId, out[3].parentId]).toEqual([group.id, group.id]);
    expect(out[0].parentId).toBeNull();
  });

  it('non-pass-through groups blend normally', () => {
    const out = flattenPsdLayers(
      [{ name: 'G', blendMode: 'multiply', children: [raster('x')] }],
      report(),
      { width: 10, height: 10 },
    );
    expect((out[0] as GroupLayer).passThrough).toBe(false);
    expect(out[0].blend).toBe('multiply');
  });

  it('layers without pixels count as skipped and stay out of the document', () => {
    const stats = report();
    const out = flattenPsdLayers([{ name: 'no-pixels' }, raster('ok')], stats, {
      width: 10,
      height: 10,
    });
    expect(out.map((layer) => layer.name)).toEqual(['ok']);
    expect(stats.skipped).toEqual(['no-pixels']);
  });

  it('smart objects (placed layers) count toward the rasterized total', () => {
    const stats = report();
    const out = flattenPsdLayers([raster('smart', { placedLayer: { id: 'abc' } })], stats, {
      width: 10,
      height: 10,
    });
    expect(out).toHaveLength(1);
    expect(stats.rasterized).toEqual(['smart']);
  });

  it('text layers come back as editable text layers (not bitmaps)', () => {
    const out: Layer[] = flattenPsdLayers(
      [
        raster('Title', {
          text: {
            text: 'Hello',
            transform: [0, 1, -1, 0, 100, 200],
            style: {
              font: { name: 'Georgia-Bold' },
              fontSize: 36,
              fillColor: { r: 255, g: 0, b: 0 },
            },
          },
        }),
      ],
      report(),
      { width: 400, height: 300 },
    );
    const layer = out[0];
    expect(layer.kind).toBe('text');
    if (layer.kind !== 'text') return;
    expect(layer.text).toBe('Hello');
    expect(layer.fontSize).toBe(36);
    // Restore the family name and the bold marker from the font name separately
    expect(layer.fontFamily).toBe('Georgia');
    expect(layer.bold).toBe(true);
    expect(layer.fill).toBe('#FF0000');
    // [0, 1, -1, 0] means a 90° rotation
    expect(layer.rotation).toBe(90);
  });

  it('a group reports no pixel size of its own (derived from its children)', () => {
    const out = flattenPsdLayers([{ name: 'G', children: [raster('x')] }], report(), {
      width: 10,
      height: 10,
    });
    expect(out[0].width).toBe(0);
    expect(out[0].height).toBe(0);
  });

  it('empty input returns an empty array (the caller reports INVALID_PSD)', () => {
    expect(flattenPsdLayers(undefined, report(), { width: 1, height: 1 })).toEqual([]);
  });
});
