import { describe, expect, it } from 'vitest';
import { convertZones, getZoneOffsetMs, isValidZone, wallTimeToUtc, zoneOffsetLabel } from './core';

describe('timezone-converter', () => {
  it('时区名校验', () => {
    expect(isValidZone('Asia/Shanghai')).toBe(true);
    expect(isValidZone('Not/AZone')).toBe(false);
  });

  it('上海偏移为 +8 小时', () => {
    const d = new Date(Date.UTC(2024, 0, 1, 0, 0, 0));
    expect(getZoneOffsetMs(d, 'Asia/Shanghai')).toBe(8 * 3600 * 1000);
    expect(zoneOffsetLabel(d, 'Asia/Shanghai')).toBe('GMT+08:00');
  });

  it('纽约冬季偏移为 -5 小时', () => {
    const d = new Date(Date.UTC(2024, 0, 15, 12, 0, 0));
    expect(zoneOffsetLabel(d, 'America/New_York')).toBe('GMT-05:00');
  });

  it('墙上时间转 UTC', () => {
    const utc = wallTimeToUtc(2024, 1, 1, 12, 0, 'Asia/Shanghai');
    expect(utc.toISOString()).toBe('2024-01-01T04:00:00.000Z');
  });

  it('多时区转换', () => {
    const d = new Date(Date.UTC(2024, 0, 1, 4, 0, 0));
    const r = convertZones(d, ['Asia/Shanghai', 'UTC']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0].local).toBe('2024-01-01 12:00:00');
    expect(r.value[1].local).toBe('2024-01-01 04:00:00');
  });

  it('非法时区报错', () => {
    const r = convertZones(new Date(), ['Not/AZone']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('INVALID_ZONE');
  });
});
