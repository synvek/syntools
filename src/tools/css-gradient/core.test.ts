import { describe, expect, it } from 'vitest';
import {
  GRADIENT_PRESETS,
  buildGradientCss,
  buildGradientValue,
  getPresetsByCategory,
  normalizeStops,
  presetToOptions,
} from './core';

describe('css-gradient', () => {
  it('linear CSS', () => {
    const css = buildGradientCss({
      type: 'linear',
      angle: 90,
      shape: 'circle',
      stops: [
        { color: '#fff', position: 0 },
        { color: '#000', position: 100 },
      ],
    });
    expect(css).toBe('background: linear-gradient(90deg, #fff 0%, #000 100%);');
  });

  it('radial CSS', () => {
    const css = buildGradientCss({
      type: 'radial',
      angle: 0,
      shape: 'ellipse',
      stops: [
        { color: 'red', position: 0 },
        { color: 'blue', position: 100 },
      ],
    });
    expect(css).toContain('radial-gradient(ellipse');
    expect(buildGradientValue({
      type: 'radial',
      angle: 0,
      shape: 'ellipse',
      stops: [
        { color: 'red', position: 0 },
        { color: 'blue', position: 100 },
      ],
    })).toBe('radial-gradient(ellipse, red 0%, blue 100%)');
  });

  it('normalizeStops 排序与 clamp', () => {
    expect(
      normalizeStops([
        { color: '#a', position: 150 },
        { color: '#b', position: -10 },
      ]),
    ).toEqual([
      { color: '#b', position: 0 },
      { color: '#a', position: 100 },
    ]);
  });

  it('预设分类与数量', () => {
    expect(GRADIENT_PRESETS.length).toBeGreaterThanOrEqual(150);
    expect(getPresetsByCategory('warm').length).toBeGreaterThanOrEqual(18);
    expect(getPresetsByCategory('rainbow').length).toBeGreaterThanOrEqual(20);
    expect(getPresetsByCategory('rainbow').some((p) => p.options.stops.length >= 5)).toBe(true);
  });

  it('presetToOptions 深拷贝', () => {
    const preset = GRADIENT_PRESETS[0];
    const a = presetToOptions(preset);
    const b = presetToOptions(preset);
    a.stops[0].color = '#000000';
    expect(b.stops[0].color).not.toBe('#000000');
    expect(buildGradientCss(a)).toContain('linear-gradient');
  });
});
