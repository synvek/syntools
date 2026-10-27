import type { ToolResult } from '@/core/types';

/**
 * Countdown: duration parsing and remaining-time formatting.
 */

export type CountdownError = 'INVALID' | 'ZERO';

export const MAX_TOTAL_MS = 99 * 3600_000 + 59 * 60_000 + 59_000;

export function parseCountdownDuration(
  hours: number,
  minutes: number,
  seconds: number,
): ToolResult<number> {
  if (
    ![hours, minutes, seconds].every((n) => Number.isFinite(n) && Number.isInteger(n)) ||
    hours < 0 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59 ||
    hours > 99
  ) {
    return { ok: false, error: 'INVALID' };
  }
  const total = hours * 3600_000 + minutes * 60_000 + seconds * 1000;
  if (total <= 0) return { ok: false, error: 'ZERO' };
  if (total > MAX_TOTAL_MS) return { ok: false, error: 'INVALID' };
  return { ok: true, value: total };
}

/** Remaining milliseconds → HH:MM:SS (floored to the second) */
export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const totalSec = Math.ceil(clamped / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function remainingMs(endAt: number, now: number): number {
  return Math.max(0, endAt - now);
}
