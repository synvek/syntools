import { afterEach, describe, expect, it } from 'vitest';
import { memoryPressure, readMemoryInfo } from './memoryHint';

describe('memoryPressure', () => {
  it('超过 85% 才提示', () => {
    expect(memoryPressure({ usedBytes: 850, limitBytes: 1000 })).toBe(true);
    expect(memoryPressure({ usedBytes: 849, limitBytes: 1000 })).toBe(false);
    expect(memoryPressure({ usedBytes: 100, limitBytes: 1000 })).toBe(false);
  });

  it('缺失或异常数据一律不提示', () => {
    expect(memoryPressure(null)).toBe(false);
    expect(memoryPressure(undefined)).toBe(false);
    expect(memoryPressure({ usedBytes: 0, limitBytes: 1000 })).toBe(false);
    expect(memoryPressure({ usedBytes: 900, limitBytes: 0 })).toBe(false);
    expect(memoryPressure({ usedBytes: Number.NaN, limitBytes: 1000 })).toBe(false);
  });

  it('阈值可覆盖', () => {
    expect(memoryPressure({ usedBytes: 600, limitBytes: 1000 }, 0.5)).toBe(true);
  });
});

describe('readMemoryInfo', () => {
  afterEach(() => {
    delete (performance as Performance & { memory?: unknown }).memory;
  });

  it('读取 Chromium 的 performance.memory', () => {
    (performance as Performance & { memory?: unknown }).memory = {
      usedJSHeapSize: 900,
      jsHeapSizeLimit: 1000,
    };
    expect(readMemoryInfo()).toEqual({ usedBytes: 900, limitBytes: 1000 });
  });

  it('其他浏览器返回 null', () => {
    expect(readMemoryInfo()).toBeNull();
  });

  it('字段缺失按 0 处理', () => {
    (performance as Performance & { memory?: unknown }).memory = {};
    expect(readMemoryInfo()).toEqual({ usedBytes: 0, limitBytes: 0 });
    expect(memoryPressure(readMemoryInfo())).toBe(false);
  });
});
