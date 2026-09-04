import { describe, expect, it } from 'vitest';
import { detectUnit, formatTimestamp, parseDate, parseTimestamp, relativeParts } from './core';

describe('detectUnit', () => {
  it('10 位识别为秒', () => {
    expect(detectUnit('1725000000')).toEqual({ ok: true, value: 'seconds' });
  });

  it('13 位识别为毫秒', () => {
    expect(detectUnit('1725000000000')).toEqual({ ok: true, value: 'milliseconds' });
  });

  it('非数字报错', () => {
    expect(detectUnit('12a').ok).toBe(false);
    expect(detectUnit('1.5').ok).toBe(false);
  });

  it('支持负数', () => {
    expect(detectUnit('-1')).toEqual({ ok: true, value: 'seconds' });
  });
});

describe('parseTimestamp + formatTimestamp', () => {
  it('秒级自动换算', () => {
    const r = parseTimestamp('1725000000');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ ms: 1725000000000, unit: 'seconds' });
  });

  it('毫秒级直接使用', () => {
    const r = parseTimestamp('1725000000123');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ ms: 1725000000123, unit: 'milliseconds' });
  });

  it('边界：0 = 1970-01-01 00:00:00 UTC', () => {
    const f = formatTimestamp(0);
    expect(f.utc).toBe('1970-01-01 00:00:00 UTC');
    expect(f.iso).toBe('1970-01-01T00:00:00.000Z');
  });

  it('边界：32 位溢出点 2147483647 = 2038-01-19 03:14:07 UTC', () => {
    const r = parseTimestamp('2147483647');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(formatTimestamp(r.value.ms).utc).toBe('2038-01-19 03:14:07 UTC');
  });

  it('2038 之后的大时间戳正常', () => {
    const r = parseTimestamp('4102444800'); // 2100-01-01
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(formatTimestamp(r.value.ms).utc).toBe('2100-01-01 00:00:00 UTC');
  });

  it('负数时间戳（1970 之前）', () => {
    const r = parseTimestamp('-1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(formatTimestamp(r.value.ms).utc).toBe('1969-12-31 23:59:59 UTC');
  });

  it('超出可表示范围报错', () => {
    const r = parseTimestamp('9999999999999999999');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('TS_TOO_LARGE');
  });
});

describe('relativeParts', () => {
  const now = 1_700_000_000_000;

  it('过去时间', () => {
    expect(relativeParts(now - 3 * 86_400_000, now)).toEqual({
      count: 3,
      unit: 'day',
      direction: 'ago',
    });
  });

  it('未来时间', () => {
    expect(relativeParts(now + 2 * 3_600_000, now)).toEqual({
      count: 2,
      unit: 'hour',
      direction: 'later',
    });
  });
});

describe('parseDate', () => {
  it('ISO 格式解析', () => {
    const r = parseDate('2026-09-01T00:00:00Z');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.milliseconds).toBe(Date.UTC(2026, 8, 1));
    expect(r.value.seconds).toBe(Math.floor(r.value.milliseconds / 1000));
  });

  it('空格分隔按本地时区解析并可往返', () => {
    const r = parseDate('2026-09-01 12:00:00');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = new Date(r.value.milliseconds);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getHours()).toBe(12);
  });

  it('非法日期报错', () => {
    expect(parseDate('not a date').ok).toBe(false);
    expect(parseDate('').ok).toBe(false);
  });
});
