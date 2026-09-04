import { describe, expect, it } from 'vitest';
import { generateRandomNumbers, randomIntInclusive } from './core';

describe('random-number', () => {
  it('整数落在区间内', () => {
    for (let i = 0; i < 20; i++) {
      const n = randomIntInclusive(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('批量去重整数', () => {
    const r = generateRandomNumbers({
      min: 1,
      max: 10,
      count: 10,
      decimals: 0,
      unique: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(new Set(r.value).size).toBe(10);
  });

  it('范围非法', () => {
    expect(
      generateRandomNumbers({ min: 5, max: 1, count: 1, decimals: 0, unique: false }),
    ).toEqual({ ok: false, error: 'INVALID_RANGE' });
  });
});
