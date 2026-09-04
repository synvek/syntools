import { describe, expect, it } from 'vitest';
import { WEB_COLORS } from './colors';
import {
  contrastText,
  filterWebColors,
  hexToRgb,
  toWebColorRows,
} from './core';

describe('web-color-table', () => {
  it('has CSS named colors including RebeccaPurple', () => {
    expect(WEB_COLORS.length).toBeGreaterThanOrEqual(140);
    expect(WEB_COLORS.some((c) => c.name === 'RebeccaPurple')).toBe(true);
    expect(WEB_COLORS.some((c) => c.name === 'AliceBlue')).toBe(true);
  });

  it('hexToRgb parses hex', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('bad')).toBeNull();
  });

  it('toWebColorRows builds rgb strings', () => {
    const rows = toWebColorRows([{ name: 'Red', hex: '#FF0000', group: 'red' }]);
    expect(rows[0].rgb).toBe('rgb(255, 0, 0)');
  });

  it('filterWebColors by name hex group', () => {
    const rows = toWebColorRows();
    expect(filterWebColors(rows, 'tomato').map((r) => r.name)).toContain('Tomato');
    expect(filterWebColors(rows, 'ff0000').some((r) => r.name === 'Red')).toBe(true);
    expect(filterWebColors(rows, '', 'blue').every((r) => r.group === 'blue')).toBe(true);
    expect(filterWebColors(rows, 'zzzz-nope')).toHaveLength(0);
  });

  it('contrastText picks readable foreground', () => {
    expect(contrastText('#FFFFFF')).toBe('#111827');
    expect(contrastText('#000000')).toBe('#f9fafb');
  });
});
