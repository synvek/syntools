import { describe, expect, it } from 'vitest';
import { CATEGORIES, convertUnit, formatNumber, unitsOf } from './core';

describe('unit-converter', () => {
  it('长度换算', () => {
    expect(convertUnit('1', 'length', 'km', 'm')).toEqual({ ok: true, value: 1000 });
    expect(convertUnit('1', 'length', 'mi', 'km').ok).toBe(true);
  });

  it('质量换算', () => {
    const r = convertUnit('1', 'mass', 'kg', 'lb');
    expect(r.ok).toBe(true);
    if (r.ok) expect(Math.round(r.value * 100) / 100).toBe(2.2);
  });

  it('温度换算（含偏移）', () => {
    expect(convertUnit('0', 'temperature', 'c', 'f')).toEqual({ ok: true, value: 32 });
    expect(convertUnit('100', 'temperature', 'c', 'f')).toEqual({ ok: true, value: 212 });
    expect(convertUnit('273.15', 'temperature', 'k', 'c')).toEqual({ ok: true, value: 0 });
    expect(convertUnit('0', 'temperature', 'c', 'k')).toEqual({ ok: true, value: 273.15 });
  });

  it('数据换算（十进制与二进制）', () => {
    expect(convertUnit('1', 'data', 'kb', 'b')).toEqual({ ok: true, value: 1000 });
    expect(convertUnit('1', 'data', 'kib', 'b')).toEqual({ ok: true, value: 1024 });
  });

  it('速度换算', () => {
    const r = convertUnit('36', 'speed', 'kmh', 'mps');
    expect(r.ok).toBe(true);
    if (r.ok) expect(Math.round(r.value * 100) / 100).toBe(10);
  });

  it('空值与非法值报错', () => {
    expect(convertUnit('', 'length', 'm', 'km')).toEqual({ ok: false, error: 'EMPTY' });
    expect(convertUnit('abc', 'length', 'm', 'km')).toEqual({ ok: false, error: 'INVALID' });
  });

  it('非法单位报错', () => {
    expect(convertUnit('1', 'length', 'm', 'xx')).toEqual({ ok: false, error: 'INVALID' });
  });

  it('formatNumber 去尾零', () => {
    expect(formatNumber(1000)).toBe('1000');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatNumber(1.5)).toBe('1.5');
  });

  it('分类与单位枚举自洽', () => {
    for (const c of CATEGORIES) expect(unitsOf(c).length).toBeGreaterThan(1);
  });
});
