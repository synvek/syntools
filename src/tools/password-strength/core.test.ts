import { describe, expect, it } from 'vitest';
import { estimateStrength } from './core';

describe('password-strength', () => {
  it('空密码为最弱', () => {
    expect(estimateStrength('').score).toBe(0);
    expect(estimateStrength('').label).toBe('very_weak');
  });

  it('常见弱密码被识别', () => {
    const r = estimateStrength('password');
    expect(r.issues).toContain('common');
    expect(r.score).toBe(0);
  });

  it('短密码触发 too_short', () => {
    expect(estimateStrength('abc').issues).toContain('too_short');
  });

  it('强密码获得高分与完整字符类', () => {
    const r = estimateStrength('Pm5#Vb2@Kx9Qz7');
    expect(r.hasLower).toBe(true);
    expect(r.hasUpper).toBe(true);
    expect(r.hasDigit).toBe(true);
    expect(r.hasSymbol).toBe(true);
    expect(r.score).toBe(4);
    expect(r.label).toBe('very_strong');
  });

  it('顺序字符被惩罚', () => {
    const r = estimateStrength('abcd1234');
    expect(r.issues).toContain('sequential');
  });

  it('重复字符被惩罚', () => {
    const r = estimateStrength('aaaabbbb');
    expect(r.issues).toContain('repeated');
  });

  it('缺失字符类给出对应建议', () => {
    const r = estimateStrength('onlylowercase');
    expect(r.issues).toContain('no_upper');
    expect(r.issues).toContain('no_digit');
    expect(r.issues).toContain('no_symbol');
  });
});
