import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_SIZE } from '../core';
import {
  parseSvgIntrinsicSize,
  parseSvgLength,
  parseViewBox,
  svgRasterSize,
  SVG_DEFAULT_SCALE,
} from './svg';

describe('parseSvgLength: CSS length → pixels', () => {
  it('unitless and px both mean pixels', () => {
    expect(parseSvgLength('120')).toBe(120);
    expect(parseSvgLength(' 120px ')).toBe(120);
    expect(parseSvgLength('12.5')).toBe(12.5);
    expect(parseSvgLength('.5')).toBe(0.5);
  });

  it('absolute units convert at 1in = 96px', () => {
    expect(parseSvgLength('1in')).toBeCloseTo(96, 5);
    expect(parseSvgLength('72pt')).toBeCloseTo(96, 5);
    expect(parseSvgLength('1pc')).toBeCloseTo(16, 5);
    expect(parseSvgLength('2.54cm')).toBeCloseTo(96, 3);
    expect(parseSvgLength('25.4mm')).toBeCloseTo(96, 3);
  });

  it('context-dependent units (% / em) and illegal values return null', () => {
    expect(parseSvgLength('100%')).toBeNull();
    expect(parseSvgLength('2em')).toBeNull();
    expect(parseSvgLength('auto')).toBeNull();
    expect(parseSvgLength(undefined)).toBeNull();
    expect(parseSvgLength('abc')).toBeNull();
    expect(parseSvgLength('0')).toBeNull();
    expect(parseSvgLength('-5')).toBeNull();
  });
});

describe('parseViewBox', () => {
  it('accepts space and comma separators', () => {
    expect(parseViewBox('0 0 48 24')).toEqual({ width: 48, height: 24 });
    expect(parseViewBox('0,0,48,24')).toEqual({ width: 48, height: 24 });
    expect(parseViewBox('  -10  -10  20  20 ')).toEqual({ width: 20, height: 20 });
  });

  it('returns null on a wrong count or non-positive size', () => {
    expect(parseViewBox('0 0 48')).toBeNull();
    expect(parseViewBox('0 0 0 24')).toBeNull();
    expect(parseViewBox('a b c d')).toBeNull();
    expect(parseViewBox('')).toBeNull();
  });
});

describe('parseSvgIntrinsicSize', () => {
  it('width / height win', () => {
    expect(parseSvgIntrinsicSize('<svg width="120" height="80"><rect/></svg>')).toEqual({
      width: 120,
      height: 80,
    });
  });

  it('parses units, single quotes and multi-line attributes', () => {
    const source = `<svg\n  xmlns='http://www.w3.org/2000/svg'\n  width='2.54cm'\n  height='1in'\n></svg>`;
    const size = parseSvgIntrinsicSize(source);
    expect(size?.width).toBeCloseTo(96, 3);
    expect(size?.height).toBeCloseTo(96, 5);
  });

  it('falls back to viewBox when it is the only size', () => {
    expect(parseSvgIntrinsicSize('<svg viewBox="0 0 48 24"/>')).toEqual({ width: 48, height: 24 });
  });

  it('percentage sizes fall back to viewBox (not treated as 100px)', () => {
    expect(parseSvgIntrinsicSize('<svg width="100%" height="100%" viewBox="0 0 20 10"/>')).toEqual({
      width: 20,
      height: 10,
    });
  });

  it('a missing width with a valid height also falls back to viewBox', () => {
    expect(parseSvgIntrinsicSize('<svg width="100" viewBox="0 0 32 16"/>')).toEqual({
      width: 32,
      height: 16,
    });
  });

  it('returns null with neither size nor viewBox, or when it is not SVG', () => {
    expect(parseSvgIntrinsicSize('<svg><rect/></svg>')).toBeNull();
    expect(parseSvgIntrinsicSize('<html></html>')).toBeNull();
    expect(parseSvgIntrinsicSize('')).toBeNull();
  });

  it('recognizes self-closing <svg/>', () => {
    expect(parseSvgIntrinsicSize('<svg width="10" height="5"/>')).toEqual({ width: 10, height: 5 });
  });
});

describe('svgRasterSize: rasterization size', () => {
  it('scales by a factor (2× by default, so later resizing stays sharp)', () => {
    expect(SVG_DEFAULT_SCALE).toBe(2);
    expect(svgRasterSize({ width: 100, height: 50 })).toEqual({ width: 200, height: 100 });
  });

  it('unknown sizes get a default box (512 square)', () => {
    expect(svgRasterSize(null)).toEqual({ width: 1024, height: 1024 });
  });

  it('when upscaling exceeds the canvas cap the longest side shrinks proportionally', () => {
    const size = svgRasterSize({ width: 4000, height: 2000 }, 2);
    expect(Math.max(size.width, size.height)).toBe(MAX_CANVAS_SIZE);
    expect(size.width / size.height).toBeCloseTo(2, 5);
  });

  it('factors below 1 are treated as 1', () => {
    expect(svgRasterSize({ width: 10, height: 10 }, 0.5)).toEqual({ width: 10, height: 10 });
  });
});
