import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BRUSH_PRESETS,
  MAX_SPACING,
  MIN_SPACING,
  SPACING_LINE_THRESHOLD,
  clampBrushSize,
  clampSpacing,
  hexToHsv,
  hsvToHex,
  normalizeBrushPresets,
  withAlpha,
} from './core';
import { gradientColors } from './render/gradient';

describe('clampSpacing', () => {
  it('keeps values inside the allowed range', () => {
    expect(clampSpacing(0)).toBe(MIN_SPACING);
    expect(clampSpacing(10)).toBe(MAX_SPACING);
    expect(clampSpacing(0.25)).toBe(0.25);
  });

  it('falls back to a sane default for invalid input', () => {
    expect(clampSpacing(Number.NaN)).toBe(0.1);
  });

  it('agrees with the line-vs-stamp threshold semantics', () => {
    // 阈值以下走连续描边、以上走盖章，边界值本身应落在「盖章」一侧
    expect(clampSpacing(SPACING_LINE_THRESHOLD)).toBe(SPACING_LINE_THRESHOLD);
    expect(SPACING_LINE_THRESHOLD).toBeGreaterThan(0);
  });
});

describe('withAlpha', () => {
  it('converts hex to rgba', () => {
    expect(withAlpha('#FF0000', 0)).toBe('rgba(255,0,0,0)');
    expect(withAlpha('#00ff00', 0.5)).toBe('rgba(0,255,0,0.5)');
  });

  it('expands short hex', () => {
    expect(withAlpha('#0f0', 1)).toBe('rgba(0,255,0,1)');
  });

  it('clamps alpha and tolerates garbage', () => {
    expect(withAlpha('#000000', 5)).toBe('rgba(0,0,0,1)');
    expect(withAlpha('nope', 1)).toBe('rgba(0,0,0,1)');
  });
});

describe('hexToHsv / hsvToHex', () => {
  it('round-trips the primary colors', () => {
    for (const hex of ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000', '#808080']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it('reports hue, saturation and value for pure red', () => {
    const hsv = hexToHsv('#FF0000');
    expect(Math.round(hsv.h)).toBe(0);
    expect(Math.round(hsv.s)).toBe(100);
    expect(Math.round(hsv.v)).toBe(100);
  });

  it('reports zero saturation for grays', () => {
    expect(Math.round(hexToHsv('#808080').s)).toBe(0);
  });

  it('falls back to black for invalid input', () => {
    expect(hexToHsv('zzz')).toEqual({ h: 0, s: 0, v: 0 });
  });

  it('wraps negative and over-360 hues', () => {
    expect(hsvToHex({ h: -120, s: 100, v: 100 })).toBe(hsvToHex({ h: 240, s: 100, v: 100 }));
    expect(hsvToHex({ h: 480, s: 100, v: 100 })).toBe(hsvToHex({ h: 120, s: 100, v: 100 }));
  });
});

describe('normalizeBrushPresets', () => {
  it('drops malformed entries and clamps parameters', () => {
    const presets = normalizeBrushPresets([
      { id: 'ok', size: 99999, hardness: 5, opacity: -1, spacing: 99 },
      { size: 10 },
      null,
      'nope',
    ]);
    expect(presets).toHaveLength(1);
    expect(presets[0].id).toBe('ok');
    expect(presets[0].size).toBe(clampBrushSize(99999));
    expect(presets[0].hardness).toBe(1);
    expect(presets[0].opacity).toBe(0);
    expect(presets[0].spacing).toBe(MAX_SPACING);
  });

  it('returns an empty list for non-arrays', () => {
    expect(normalizeBrushPresets(null)).toEqual([]);
    expect(normalizeBrushPresets({})).toEqual([]);
  });

  it('keeps a custom name but drops empty ones', () => {
    const presets = normalizeBrushPresets([
      { id: 'a', name: 'Mine', size: 10, hardness: 1, opacity: 1, spacing: 0.1 },
      { id: 'b', name: '', size: 10, hardness: 1, opacity: 1, spacing: 0.1 },
    ]);
    expect(presets[0].name).toBe('Mine');
    expect(presets[1].name).toBeUndefined();
  });
});

describe('built-in brush presets', () => {
  it('are all within legal ranges', () => {
    for (const preset of DEFAULT_BRUSH_PRESETS) {
      expect(preset.size).toBeGreaterThanOrEqual(1);
      expect(preset.hardness).toBeGreaterThanOrEqual(0);
      expect(preset.hardness).toBeLessThanOrEqual(1);
      expect(preset.spacing).toBeGreaterThanOrEqual(MIN_SPACING);
      expect(preset.spacing).toBeLessThanOrEqual(MAX_SPACING);
    }
  });

  it('have unique ids', () => {
    const ids = DEFAULT_BRUSH_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('gradientColors', () => {
  it('fades the foreground to transparent by default', () => {
    expect(gradientColors('fg-transparent', '#123456', '#FFFFFF')).toEqual([
      '#123456',
      withAlpha('#123456', 0),
    ]);
  });

  it('uses both colors for the foreground-to-background mode', () => {
    expect(gradientColors('fg-bg', '#123456', '#FFFFFF')).toEqual(['#123456', '#FFFFFF']);
  });
});
