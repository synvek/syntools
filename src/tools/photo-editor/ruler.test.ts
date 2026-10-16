import { describe, expect, it } from 'vitest';
import { rulerTicks } from './core';

describe('rulerTicks', () => {
  it('maps document coordinates to screen coordinates', () => {
    // scale 1、无平移：文档 0 落在屏幕 0，文档 100 落在屏幕 100
    const ticks = rulerTicks(1, 0, 300, 50);
    expect(ticks[0].doc).toBe(0);
    expect(ticks[0].screen).toBe(0);
    expect(ticks[1].doc).toBe(50);
    expect(ticks[1].screen).toBe(50);
    expect(ticks[2].doc).toBe(100);
  });

  it('honours pan offset', () => {
    const ticks = rulerTicks(1, -120, 300, 50);
    // 屏幕 0 对应文档 120，因此第一个刻度从文档 150 开始
    expect(ticks[0].doc).toBe(150);
    expect(ticks[0].screen).toBe(30);
  });

  it('chooses a larger step when zoomed out so ticks never overlap', () => {
    const ticks = rulerTicks(0.1, 0, 600, 50);
    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i].screen - ticks[i - 1].screen).toBeGreaterThanOrEqual(50);
    }
  });

  it('chooses a smaller step when zoomed in', () => {
    const ticks = rulerTicks(8, 0, 400, 50);
    expect(ticks[1].doc - ticks[0].doc).toBeLessThanOrEqual(10);
  });

  it('treats an invalid scale as 1 and stays finite', () => {
    const ticks = rulerTicks(0, 0, 200, 50);
    expect(ticks.every((tick) => Number.isFinite(tick.screen) && Number.isFinite(tick.doc))).toBe(
      true,
    );
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('labels ticks with rounded document coordinates', () => {
    const ticks = rulerTicks(0.5, 0, 300, 50);
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) {
      expect(tick.label).toBe(String(Math.round(tick.doc)));
    }
  });
});
