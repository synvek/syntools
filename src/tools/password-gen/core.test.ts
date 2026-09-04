import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPTIONS,
  entropyBits,
  generatePassword,
  MAX_LENGTH,
  MIN_LENGTH,
  poolFor,
  strengthOf,
  type PasswordOptions,
} from './core';

const AMBIGUOUS = '0O1lI|`\'"';

const ok = (options: PasswordOptions): string => {
  const result = generatePassword(options);
  expect(result.ok).toBe(true);
  return result.ok ? result.value : '';
};

describe('generatePassword', () => {
  it('默认选项：长度 16，字符均落在所选字符集内', () => {
    const password = ok(DEFAULT_OPTIONS);
    expect(password).toHaveLength(16);
    const pool = poolFor(DEFAULT_OPTIONS).join('');
    for (const c of password) expect(pool).toContain(c);
  });

  it('尊重自定义长度；小数长度向下取整', () => {
    expect(ok({ ...DEFAULT_OPTIONS, length: 32 })).toHaveLength(32);
    expect(ok({ ...DEFAULT_OPTIONS, length: 12.9 })).toHaveLength(12);
  });

  it('边界长度可用：4 与 128', () => {
    expect(ok({ ...DEFAULT_OPTIONS, length: MIN_LENGTH })).toHaveLength(MIN_LENGTH);
    expect(ok({ ...DEFAULT_OPTIONS, length: MAX_LENGTH })).toHaveLength(MAX_LENGTH);
  });

  it('非法长度返回 INVALID_LENGTH', () => {
    for (const length of [3, 129, NaN, Infinity]) {
      expect(generatePassword({ ...DEFAULT_OPTIONS, length })).toEqual({
        ok: false,
        error: 'INVALID_LENGTH',
      });
    }
  });

  it('未选任何字符集返回 NO_SETS', () => {
    expect(
      generatePassword({
        length: 12,
        lowercase: false,
        uppercase: false,
        digits: false,
        symbols: false,
        excludeAmbiguous: false,
        ensureEach: false,
      }),
    ).toEqual({ ok: false, error: 'NO_SETS' });
  });

  it('仅数字时输出全数字', () => {
    const password = ok({ ...DEFAULT_OPTIONS, lowercase: false, uppercase: false, symbols: false });
    expect(password).toMatch(/^\d+$/);
  });

  it('excludeAmbiguous：多次生成均不含易混淆字符', () => {
    for (let i = 0; i < 50; i += 1) {
      const password = ok({ ...DEFAULT_OPTIONS, excludeAmbiguous: true });
      for (const c of password) expect(AMBIGUOUS).not.toContain(c);
    }
  });

  it('ensureEach：多次生成均包含每个已选字符集至少一个字符', () => {
    for (let i = 0; i < 50; i += 1) {
      const password = ok(DEFAULT_OPTIONS);
      for (const set of poolFor(DEFAULT_OPTIONS)) {
        expect([...password].some((c) => set.includes(c))).toBe(true);
      }
    }
  });

  it('长度不足以保证所有字符集时不报错（退化为普通生成）', () => {
    const password = ok({ ...DEFAULT_OPTIONS, length: MIN_LENGTH, ensureEach: true });
    expect(password).toHaveLength(MIN_LENGTH);
  });

  it('两次生成结果不同（随机性冒烟）', () => {
    const a = ok(DEFAULT_OPTIONS);
    const b = ok(DEFAULT_OPTIONS);
    expect(a).not.toBe(b);
  });
});

describe('熵与强度', () => {
  it('entropyBits 计算正确', () => {
    expect(entropyBits(8, 2)).toBe(8);
    expect(entropyBits(1, 1)).toBe(0);
    expect(entropyBits(16, 62)).toBeCloseTo(16 * Math.log2(62), 10);
  });

  it('strengthOf 分级边界', () => {
    expect(strengthOf(49)).toBe('weak');
    expect(strengthOf(50)).toBe('medium');
    expect(strengthOf(79)).toBe('medium');
    expect(strengthOf(80)).toBe('strong');
  });
});
