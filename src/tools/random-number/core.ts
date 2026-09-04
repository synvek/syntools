import type { ToolResult } from '@/core/types';

/**
 * 随机数生成：crypto.getRandomValues，支持整数 / 小数与批量。
 */

export type RandomNumberError = 'INVALID_RANGE' | 'INVALID_COUNT' | 'INVALID_DECIMALS';

export interface RandomNumberOptions {
  min: number;
  max: number;
  count: number;
  /** 小数位数；0 表示整数 */
  decimals: number;
  unique: boolean;
}

export const MIN_COUNT = 1;
export const MAX_COUNT = 1000;
export const MAX_DECIMALS = 10;

/** [0, 1) 均匀随机 */
function randomUnit(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 0x1_0000_0000;
}

/** [min, max] 闭区间整数（含端点） */
export function randomIntInclusive(min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  const span = hi - lo + 1;
  if (span <= 0) return lo;
  // 拒绝采样消除模偏差
  const limit = Math.floor(0x1_0000_0000 / span) * span;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return lo + (x % span);
}

export function generateRandomNumbers(
  options: RandomNumberOptions,
): ToolResult<number[]> {
  const { min, max, count, decimals, unique } = options;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return { ok: false, error: 'INVALID_RANGE' };
  }
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    return { ok: false, error: 'INVALID_COUNT' };
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    return { ok: false, error: 'INVALID_DECIMALS' };
  }

  if (decimals === 0 && unique) {
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    const span = hi - lo + 1;
    if (span < count) return { ok: false, error: 'INVALID_RANGE' };
    const pool = Array.from({ length: span }, (_, i) => lo + i);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = randomIntInclusive(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { ok: true, value: pool.slice(0, count) };
  }

  const out: number[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard < count * 50) {
    guard += 1;
    let n: number;
    if (decimals === 0) {
      n = randomIntInclusive(min, max);
    } else {
      const raw = min + randomUnit() * (max - min);
      const factor = 10 ** decimals;
      n = Math.round(raw * factor) / factor;
      if (n < min) n = min;
      if (n > max) n = max;
    }
    const key = String(n);
    if (unique && seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  if (out.length < count) return { ok: false, error: 'INVALID_RANGE' };
  return { ok: true, value: out };
}
