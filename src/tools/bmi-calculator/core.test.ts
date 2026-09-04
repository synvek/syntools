import { describe, expect, it } from 'vitest';
import { classifyBmi, computeBmi } from './core';

describe('bmi-calculator', () => {
  it('公制 BMI', () => {
    const r = computeBmi('170', '65', 'metric');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.bmi).toBeCloseTo(22.5, 0);
    expect(r.value.category).toBe('normal');
  });

  it('分级', () => {
    expect(classifyBmi(17)).toBe('underweight');
    expect(classifyBmi(22)).toBe('normal');
    expect(classifyBmi(27)).toBe('overweight');
    expect(classifyBmi(32)).toBe('obese');
  });

  it('非法输入', () => {
    expect(computeBmi('0', '60', 'metric')).toEqual({ ok: false, error: 'INVALID' });
  });
});
