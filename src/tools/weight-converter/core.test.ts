import { describe, expect, it } from 'vitest';
import { convertWeight, convertWeightAll } from './core';

describe('weight-converter', () => {
  it('千克转克', () => {
    const r = convertWeight('1', 'kg', 'g');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe(1000);
  });

  it('磅转千克', () => {
    const r = convertWeight('1', 'lb', 'kg');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBeCloseTo(0.45359237, 8);
  });

  it('全部单位', () => {
    const r = convertWeightAll('1', 'kg');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.g).toBe('1000');
    expect(r.value.mg).toBe('1000000');
  });

  it('非法输入', () => {
    expect(convertWeight('x', 'kg', 'g')).toEqual({ ok: false, error: 'INVALID' });
  });
});
