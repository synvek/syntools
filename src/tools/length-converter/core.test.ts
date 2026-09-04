import { describe, expect, it } from 'vitest';
import { convertLength, convertLengthAll, formatLength } from './core';

describe('length-converter', () => {
  it('米转厘米', () => {
    const r = convertLength('1', 'm', 'cm');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe(100);
  });

  it('英寸转毫米', () => {
    const r = convertLength('1', 'in', 'mm');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBeCloseTo(25.4, 6);
  });

  it('全部单位', () => {
    const r = convertLengthAll('1', 'm');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.cm).toBe('100');
    expect(r.value.km).toBe('0.001');
  });

  it('格式化', () => {
    expect(formatLength(1.23)).toBe('1.23');
    expect(formatLength(0)).toBe('0');
  });

  it('非法输入', () => {
    expect(convertLength('abc', 'm', 'cm')).toEqual({ ok: false, error: 'INVALID' });
  });
});
