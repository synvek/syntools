/**
 * Heap-pressure hint (M4-5).
 *
 * Only Chromium exposes `performance.memory`; Firefox/Safari report `null` and the editor stays
 * silent rather than guessing. The check is advisory: a large PDF plus a nearly full heap is the
 * combination that makes saving fail, so warning before the save is worth one banner.
 */

export interface MemoryInfo {
  usedBytes: number;
  /** `jsHeapSizeLimit`; 0 / missing means "unknown" */
  limitBytes: number;
}

/** Warn at 85%: browsers usually start evicting aggressively around there */
export const MEMORY_PRESSURE_RATIO = 0.85;

/** Pure so the threshold is testable without a browser */
export function memoryPressure(
  info: MemoryInfo | null | undefined,
  ratio: number = MEMORY_PRESSURE_RATIO,
): boolean {
  if (!info) return false;
  if (!Number.isFinite(info.usedBytes) || !Number.isFinite(info.limitBytes)) return false;
  if (info.usedBytes <= 0 || info.limitBytes <= 0) return false;
  return info.usedBytes / info.limitBytes >= ratio;
}

interface PerformanceMemory {
  usedJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

/** Read the non-standard Chromium API; returns `null` where it does not exist */
export function readMemoryInfo(): MemoryInfo | null {
  if (typeof performance === 'undefined') return null;
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  if (!memory) return null;
  return {
    usedBytes: memory.usedJSHeapSize ?? 0,
    limitBytes: memory.jsHeapSizeLimit ?? 0,
  };
}
