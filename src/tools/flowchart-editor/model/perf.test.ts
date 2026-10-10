import { describe, expect, it } from 'vitest';
import { virtualizeThresholdOf } from './perf';

describe('自适应虚拟化阈值', () => {
  it('小视口不低于下限（保持小图全量渲染）', () => {
    expect(virtualizeThresholdOf(375 * 667)).toBe(150);
  });

  it('大视口提高阈值（大屏容纳更多节点仍全量渲染）', () => {
    expect(virtualizeThresholdOf(1920 * 1080)).toBeGreaterThan(150);
  });

  it('极端分辨率下封顶，避免阈值失控', () => {
    expect(virtualizeThresholdOf(7680 * 4320)).toBe(600);
  });
});
