import { describe, expect, it } from 'vitest';
import { MAX_CANVAS_SIZE } from '../core';
import {
  parseSvgIntrinsicSize,
  parseSvgLength,
  parseViewBox,
  svgRasterSize,
  SVG_DEFAULT_SCALE,
} from './svg';

describe('parseSvgLength：CSS 长度 → 像素', () => {
  it('无单位与 px 都按像素', () => {
    expect(parseSvgLength('120')).toBe(120);
    expect(parseSvgLength(' 120px ')).toBe(120);
    expect(parseSvgLength('12.5')).toBe(12.5);
    expect(parseSvgLength('.5')).toBe(0.5);
  });

  it('绝对单位按 1in = 96px 换算', () => {
    expect(parseSvgLength('1in')).toBeCloseTo(96, 5);
    expect(parseSvgLength('72pt')).toBeCloseTo(96, 5);
    expect(parseSvgLength('1pc')).toBeCloseTo(16, 5);
    expect(parseSvgLength('2.54cm')).toBeCloseTo(96, 3);
    expect(parseSvgLength('25.4mm')).toBeCloseTo(96, 3);
  });

  it('依赖上下文的单位（% / em）与非法值返回 null', () => {
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
  it('支持空格与逗号分隔', () => {
    expect(parseViewBox('0 0 48 24')).toEqual({ width: 48, height: 24 });
    expect(parseViewBox('0,0,48,24')).toEqual({ width: 48, height: 24 });
    expect(parseViewBox('  -10  -10  20  20 ')).toEqual({ width: 20, height: 20 });
  });

  it('数量不对或尺寸非正时返回 null', () => {
    expect(parseViewBox('0 0 48')).toBeNull();
    expect(parseViewBox('0 0 0 24')).toBeNull();
    expect(parseViewBox('a b c d')).toBeNull();
    expect(parseViewBox('')).toBeNull();
  });
});

describe('parseSvgIntrinsicSize', () => {
  it('width / height 优先', () => {
    expect(parseSvgIntrinsicSize('<svg width="120" height="80"><rect/></svg>')).toEqual({
      width: 120,
      height: 80,
    });
  });

  it('带单位与单引号、跨行属性都能解析', () => {
    const source = `<svg\n  xmlns='http://www.w3.org/2000/svg'\n  width='2.54cm'\n  height='1in'\n></svg>`;
    const size = parseSvgIntrinsicSize(source);
    expect(size?.width).toBeCloseTo(96, 3);
    expect(size?.height).toBeCloseTo(96, 5);
  });

  it('只有 viewBox 时用 viewBox', () => {
    expect(parseSvgIntrinsicSize('<svg viewBox="0 0 48 24"/>')).toEqual({ width: 48, height: 24 });
  });

  it('百分比尺寸退回 viewBox（而不是当成 100px）', () => {
    expect(parseSvgIntrinsicSize('<svg width="100%" height="100%" viewBox="0 0 20 10"/>')).toEqual({
      width: 20,
      height: 10,
    });
  });

  it('width 缺失但 height 有效时也退回 viewBox', () => {
    expect(parseSvgIntrinsicSize('<svg width="100" viewBox="0 0 32 16"/>')).toEqual({
      width: 32,
      height: 16,
    });
  });

  it('既无尺寸也无 viewBox / 不是 SVG 时返回 null', () => {
    expect(parseSvgIntrinsicSize('<svg><rect/></svg>')).toBeNull();
    expect(parseSvgIntrinsicSize('<html></html>')).toBeNull();
    expect(parseSvgIntrinsicSize('')).toBeNull();
  });

  it('自闭合 <svg/> 也能识别', () => {
    expect(parseSvgIntrinsicSize('<svg width="10" height="5"/>')).toEqual({ width: 10, height: 5 });
  });
});

describe('svgRasterSize：栅格化尺寸', () => {
  it('按倍数放大（默认 2 倍，导入后再缩放不易糊）', () => {
    expect(SVG_DEFAULT_SCALE).toBe(2);
    expect(svgRasterSize({ width: 100, height: 50 })).toEqual({ width: 200, height: 100 });
  });

  it('未知尺寸时给默认框（512 见方）', () => {
    expect(svgRasterSize(null)).toEqual({ width: 1024, height: 1024 });
  });

  it('放大后超过画布上限时按最长边整体缩小，保持比例', () => {
    const size = svgRasterSize({ width: 4000, height: 2000 }, 2);
    expect(Math.max(size.width, size.height)).toBe(MAX_CANVAS_SIZE);
    expect(size.width / size.height).toBeCloseTo(2, 5);
  });

  it('倍数小于 1 时按下限 1 处理', () => {
    expect(svgRasterSize({ width: 10, height: 10 }, 0.5)).toEqual({ width: 10, height: 10 });
  });
});
