import { describe, expect, it } from 'vitest';
import { buildLap, computeElapsed, formatStopwatch } from './core';

describe('stopwatch', () => {
  it('格式化', () => {
    expect(formatStopwatch(0)).toBe('00:00.00');
    expect(formatStopwatch(61230)).toBe('01:01.23');
    expect(formatStopwatch(3661230)).toBe('01:01:01.23');
  });

  it('经过时间', () => {
    expect(computeElapsed(1000, null, 9999)).toBe(1000);
    expect(computeElapsed(1000, 5000, 5500)).toBe(1500);
  });

  it('计圈', () => {
    expect(buildLap(1000, 2500, 2)).toEqual({
      index: 2,
      lapMs: 1500,
      totalMs: 2500,
    });
  });
});
