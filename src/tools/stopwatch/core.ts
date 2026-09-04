/**
 * 秒表：经过时间格式化与分段。
 */

/** 格式化为 HH:MM:SS.cs（百分之一秒） */
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
 * 计算当前经过毫秒。
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
  /** 本圈用时 */
  lapMs: number;
  /** 累计用时 */
  totalMs: number;
}

export function buildLap(
  prevTotalMs: number,
  currentTotalMs: number,
  index: number,
): LapRecord {
  return {
    index,
    lapMs: Math.max(0, currentTotalMs - prevTotalMs),
    totalMs: Math.max(0, currentTotalMs),
  };
}
