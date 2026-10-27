import { describe, expect, it } from 'vitest';
import {
  createColorOverlay,
  createDropShadow,
  createLayerStyle,
  createOuterGlow,
  createStroke,
  hasLayerStyle,
  isEffectActive,
  stylePadding,
  styleSignature,
} from './core';
import { effectOffset, strokeWidths } from './render/style';
import { normalizeLayerStyle } from './model/migrate';
import type { LayerStyle } from './model/types';

describe('Layer styles: active detection and signature', () => {
  it('a default style (all off) does not count as styled', () => {
    expect(hasLayerStyle(createLayerStyle())).toBe(false);
    expect(hasLayerStyle(null)).toBe(false);
    expect(hasLayerStyle(undefined)).toBe(false);
  });

  it('keeping parameters without enabling them still does not count as styled', () => {
    const style: LayerStyle = { dropShadow: { ...createDropShadow(), enabled: false } };
    expect(hasLayerStyle(style)).toBe(false);
    expect(styleSignature(style)).toBe('');
  });

  it('once enabled the signature is non-empty and changes with parameters', () => {
    const style: LayerStyle = { dropShadow: createDropShadow() };
    const first = styleSignature(style);
    expect(first.length).toBeGreaterThan(0);
    const changed: LayerStyle = { dropShadow: { ...createDropShadow(), distance: 20 } };
    expect(styleSignature(changed)).not.toBe(first);
  });

  it('disabled effects stay out of the signature (editing a disabled effect does not force repaints)', () => {
    const a: LayerStyle = {
      dropShadow: createDropShadow(),
      stroke: { ...createStroke(), enabled: false, size: 1 },
    };
    const b: LayerStyle = {
      dropShadow: createDropShadow(),
      stroke: { ...createStroke(), enabled: false, size: 90 },
    };
    expect(styleSignature(a)).toBe(styleSignature(b));
  });

  it('isEffectActive only looks at enabled', () => {
    expect(isEffectActive(createOuterGlow())).toBe(true);
    expect(isEffectActive({ enabled: false })).toBe(false);
    expect(isEffectActive(null)).toBe(false);
  });
});

describe('Layer styles: outward padding', () => {
  it('no padding without a style', () => {
    expect(stylePadding(createLayerStyle())).toBe(0);
    expect(stylePadding(null)).toBe(0);
  });

  it('drop-shadow padding covers blur, spread and offset', () => {
    const style: LayerStyle = {
      dropShadow: { ...createDropShadow(), size: 10, spread: 5, distance: 30 },
    };
    // 20 (blur) + 5 (spread) + 30 (offset)
    expect(stylePadding(style)).toBe(55);
  });

  it('inner shadow and inner stroke take no padding', () => {
    const style: LayerStyle = {
      innerShadow: {
        enabled: true,
        color: '#000000',
        opacity: 1,
        angle: 0,
        distance: 50,
        size: 20,
      },
      stroke: { ...createStroke(), position: 'inside', size: 40 },
    };
    expect(stylePadding(style)).toBe(0);
  });

  it('an outside stroke pads by its width', () => {
    const style: LayerStyle = { stroke: { ...createStroke(), position: 'outside', size: 12 } };
    expect(stylePadding(style)).toBe(12);
  });

  it('multiple effects take the largest padding', () => {
    const style: LayerStyle = {
      dropShadow: { ...createDropShadow(), size: 4, spread: 0, distance: 2 },
      outerGlow: { ...createOuterGlow(), size: 30 },
    };
    expect(stylePadding(style)).toBe(60);
  });
});

describe('effectOffset: angle semantics', () => {
  it('90° means the light is above → the shadow falls straight down', () => {
    const offset = effectOffset(90, 10);
    expect(offset.x).toBeCloseTo(0, 5);
    expect(offset.y).toBeCloseTo(10, 5);
  });

  it('135° matches the Photoshop default: the shadow falls to the bottom right', () => {
    const offset = effectOffset(135, 10);
    expect(offset.x).toBeGreaterThan(0);
    expect(offset.y).toBeGreaterThan(0);
  });

  it('distance 0 gives no offset', () => {
    expect(effectOffset(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('strokeWidths: distributing the stroke width', () => {
  it('outside puts it all outside, inside all inside', () => {
    expect(strokeWidths('outside', 10)).toEqual({ outside: 10, inside: 0 });
    expect(strokeWidths('inside', 10)).toEqual({ outside: 0, inside: 10 });
  });

  it('center splits it evenly and conserves the total (odd widths included)', () => {
    expect(strokeWidths('center', 10)).toEqual({ outside: 5, inside: 5 });
    const odd = strokeWidths('center', 7);
    expect(odd.outside + odd.inside).toBeCloseTo(7, 5);
  });

  it('negative values count as 0', () => {
    expect(strokeWidths('outside', -5)).toEqual({ outside: 0, inside: 0 });
  });
});

describe('normalizeLayerStyle: normalizing project files', () => {
  it('a non-object / unknown structure returns null', () => {
    expect(normalizeLayerStyle(null)).toBeNull();
    expect(normalizeLayerStyle('nope')).toBeNull();
    expect(normalizeLayerStyle({ unknownEffect: { enabled: true } })).toBeNull();
  });

  it('out-of-range parameters clamp and illegal colors fall back to defaults', () => {
    const style = normalizeLayerStyle({
      dropShadow: {
        enabled: true,
        color: 'red',
        opacity: 5,
        distance: 9999,
        spread: 9999,
        size: 9999,
      },
    });
    expect(style?.dropShadow).toBeDefined();
    expect(style?.dropShadow?.color).toBe('#000000');
    expect(style?.dropShadow?.opacity).toBe(1);
    expect(style?.dropShadow?.distance).toBe(500);
    expect(style?.dropShadow?.spread).toBe(100);
    expect(style?.dropShadow?.size).toBe(250);
  });

  it('missing fields get defaults and an unknown stroke position falls back to outside', () => {
    const style = normalizeLayerStyle({ stroke: { enabled: true, position: 'weird' } });
    expect(style?.stroke?.position).toBe('outside');
    expect(style?.stroke?.color).toBe('#FFFFFF');
    expect(style?.stroke?.size).toBe(3);
  });

  it('valid colors are kept and uppercased', () => {
    const style = normalizeLayerStyle({ colorOverlay: createColorOverlay() });
    expect(style?.colorOverlay?.color).toBe('#2563EB');
    expect(style?.colorOverlay?.enabled).toBe(true);
  });
});
