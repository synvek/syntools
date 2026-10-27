/**
 * Stopwatch: elapsed-time formatting and laps.
 */

/** Format as HH:MM:SS.cs (hundredths of a second) */
export function formatStopwatch(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const cs = Math.floor(clamped / 10) % 100;
  const totalSec = Math.floor(clamped / 1000);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const body = [m, s].map((n) => String(n).padStart(2, '0')).join(':');
  const prefix = h > 0 ? `${String(h).padStart(2, '0')}:` : '';
  return `${prefix}${body}.${String(cs).padStart(2, '0')}`;
}

/**
 * Compute the current elapsed milliseconds.
 * - running：baseElapsed + (now - segmentStartedAt)
 * - paused：baseElapsed
 */
export function computeElapsed(
  baseElapsed: number,
  segmentStartedAt: number | null,
  now: number,
): number {
  if (segmentStartedAt == null) return Math.max(0, baseElapsed);
  return Math.max(0, baseElapsed + (now - segmentStartedAt));
}

export interface LapRecord {
  index: number;
  /** Duration of this lap */
  lapMs: number;
  /** Cumulative duration */
  totalMs: number;
}

export function buildLap(prevTotalMs: number, currentTotalMs: number, index: number): LapRecord {
  return {
    index,
    lapMs: Math.max(0, currentTotalMs - prevTotalMs),
    totalMs: Math.max(0, currentTotalMs),
  };
}
