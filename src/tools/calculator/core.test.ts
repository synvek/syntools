import { describe, expect, it } from 'vitest';
import { evaluateExpression, formatCalcResult } from './core';

describe('calculator', () => {
  it('四则与优先级', () => {
    const a = evaluateExpression('1+2*3');
    const b = evaluateExpression('(1+2)*3');
    expect(a.ok && a.value).toBe(7);
    expect(b.ok && b.value).toBe(9);
  });

  it('幂与函数', () => {
    const a = evaluateExpression('2^3');
    const b = evaluateExpression('sqrt(9)');
    const c = evaluateExpression('abs(-2)');
    expect(a.ok && a.value).toBe(8);
    expect(b.ok && b.value).toBe(3);
    expect(c.ok && c.value).toBe(2);
  });

  it('常量', () => {
    const r = evaluateExpression('pi');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBeCloseTo(Math.PI, 10);
  });

  it('除零', () => {
    expect(evaluateExpression('1/0')).toEqual({ ok: false, error: 'DIV_ZERO' });
  });

  it('语法错误', () => {
    expect(evaluateExpression('1+')).toEqual({ ok: false, error: 'SYNTAX' });
  });

  it('格式化', () => {
    expect(formatCalcResult(3)).toBe('3');
  });
});
