import { describe, expect, it } from 'vitest';
import { formatCountdown, parseCountdownDuration, remainingMs } from './core';

describe('countdown', () => {
  it('解析时长', () => {
    expect(parseCountdownDuration(1, 2, 3)).toEqual({
      ok: true,
      value: 1 * 3600_000 + 2 * 60_000 + 3_000,
    });
    expect(parseCountdownDuration(0, 0, 0)).toEqual({ ok: false, error: 'ZERO' });
    expect(parseCountdownDuration(0, 60, 0)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('格式化', () => {
    expect(formatCountdown(3661000)).toBe('01:01:01');
    expect(formatCountdown(0)).toBe('00:00:00');
  });

  it('剩余', () => {
    expect(remainingMs(1000, 400)).toBe(600);
    expect(remainingMs(1000, 1500)).toBe(0);
  });
});
