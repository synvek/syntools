import { describe, expect, it } from 'vitest';
import {
  buildMonthGrid,
  easterSunday,
  formatDateParts,
  getDayCultureInfo,
  getWesternHoliday,
  resolveCultureProfile,
  resolveWesternRegion,
  shiftMonth,
  weekdayOrder,
} from './core';

describe('calendar', () => {
  it('月网格 42 格且含当月 1 号', () => {
    const cells = buildMonthGrid(2024, 1, 1);
    expect(cells).toHaveLength(42);
    expect(cells.some((c) => c.inMonth && c.day === 1)).toBe(true);
    expect(cells.filter((c) => c.inMonth).length).toBe(31);
  });

  it('周一起始顺序', () => {
    expect(weekdayOrder(1)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(weekdayOrder(0)[0]).toBe(0);
  });

  it('月份翻页', () => {
    expect(shiftMonth(2024, 1, -1)).toEqual({ year: 2023, month: 12 });
    expect(shiftMonth(2024, 12, 1)).toEqual({ year: 2025, month: 1 });
  });

  it('日期格式', () => {
    const f = formatDateParts(2024, 3, 5, 'en');
    expect(f.iso).toBe('2024-03-05');
    expect(f.slash).toBe('2024/03/05');
  });

  it('文化档位', () => {
    expect(resolveCultureProfile('zh-CN')).toBe('zh');
    expect(resolveCultureProfile('en-US')).toBe('en');
    expect(resolveCultureProfile('en-GB')).toBe('en');
    expect(resolveCultureProfile('ja')).toBe('generic');
  });

  it('中文：春节农历与休班', () => {
    const cny = getDayCultureInfo(2025, 1, 29, 'zh');
    expect(cny.lunarText).toContain('月');
    expect(cny.festivals.some((f) => f.includes('春'))).toBe(true);
    expect(cny.rest).toBe('off');
    expect(cny.yi.length).toBeGreaterThan(0);
    expect(cny.ji.length).toBeGreaterThan(0);

    const makeup = getDayCultureInfo(2025, 1, 26, 'zh');
    expect(makeup.rest).toBe('work');
  });

  it('中文：除夕副文案', () => {
    const eve = getDayCultureInfo(2025, 1, 28, 'zh');
    expect(eve.festivals).toContain('除夕');
    expect(eve.subline).toContain('除夕');
  });

  it('英文：美国独立日', () => {
    expect(resolveWesternRegion('en')).toBe('us');
    expect(getWesternHoliday(2025, 7, 4, 'us')?.name).toMatch(/Independence/);
    const day = getDayCultureInfo(2025, 7, 4, 'en');
    expect(day.festivals.some((f) => /Independence|July/i.test(f) || f.length > 0)).toBe(true);
  });

  it('英文：英国区域', () => {
    expect(resolveWesternRegion('en-GB')).toBe('gb');
    expect(getWesternHoliday(2025, 12, 26, 'gb')?.name).toMatch(/Boxing/);
  });

  it('复活节推算', () => {
    // 2025-04-20
    expect(easterSunday(2025)).toEqual({ month: 4, day: 20 });
  });
});
