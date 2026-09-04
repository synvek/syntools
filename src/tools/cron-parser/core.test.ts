import { describe, expect, it } from 'vitest';
import { analyzeCron, MAX_COUNT, MIN_COUNT } from './core';

/** 固定基准时间保证确定性（本地时区解析，断言均为相对量） */
const NOW = new Date('2024-01-01T10:03:00');

const ok = (expression: string, count?: number) => {
  const result = analyzeCron(expression, count, NOW);
  expect(result.ok).toBe(true);
  return result.ok ? result.value : null;
};

describe('analyzeCron', () => {
  it('标准 5 字段：字段拆分与下次执行间隔正确', () => {
    const value = ok('*/5 * * * *', 3)!;
    expect(value.normalized).toBe('*/5 * * * *');
    expect(value.fields.map((f) => f.key)).toEqual(['minute', 'hour', 'day', 'month', 'week']);
    expect(value.next).toHaveLength(3);
    expect(value.next[0].getTime()).toBeGreaterThan(NOW.getTime());
    expect(value.next[1].getTime() - value.next[0].getTime()).toBe(5 * 60 * 1000);
  });

  it('范围与列表：1-5 / 0,30 字段原样归一', () => {
    const value = ok('0,30 8-18 * * 1-5')!;
    expect(value.fields[0].raw).toBe('0,30');
    expect(value.fields[1].raw).toBe('8-18');
    expect(value.fields[4].raw).toBe('1-5');
    // 首次执行应在 8:00 之后（当前 10:03 落在窗口内）
    expect(value.next[0].getHours()).toBeGreaterThanOrEqual(8);
    expect(value.next[0].getHours()).toBeLessThanOrEqual(18);
  });

  it('宏表达式：@daily 归一化为 0 0 * * *', () => {
    const value = ok('@daily')!;
    expect(value.normalized).toBe('0 0 * * *');
    expect(value.fields).toHaveLength(5);
  });

  it('6 字段（含秒）：字段拆分含 second', () => {
    const value = ok('0 */5 * * * *', 2)!;
    expect(value.fields.map((f) => f.key)).toEqual([
      'second',
      'minute',
      'hour',
      'day',
      'month',
      'week',
    ]);
    expect(value.next[1].getTime() - value.next[0].getTime()).toBe(5 * 60 * 1000);
  });

  it('月份/星期名称可解析并归一为数字', () => {
    const value = ok('0 0 1 JAN MON')!;
    expect(value.fields[3].raw).toBe('1'); // JAN → 1
    expect(value.fields[4].raw).toBe('1'); // MON → 1
  });

  it('非法表达式返回 INVALID', () => {
    expect(analyzeCron('invalid', 5, NOW)).toEqual({ ok: false, error: 'INVALID' });
    expect(analyzeCron('* * *', 5, NOW)).toEqual({ ok: false, error: 'INVALID' });
    expect(analyzeCron('99 * * * *', 5, NOW)).toEqual({ ok: false, error: 'INVALID' });
  });

  it('空输入返回 EMPTY', () => {
    expect(analyzeCron('', 5, NOW)).toEqual({ ok: false, error: 'EMPTY' });
    expect(analyzeCron('   ', 5, NOW)).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('count 钳制在 1-20', () => {
    expect(ok('* * * * *', 0)!.next).toHaveLength(MIN_COUNT);
    expect(ok('* * * * *', 999)!.next).toHaveLength(MAX_COUNT);
    expect(ok('* * * * *')!.next).toHaveLength(5); // 默认 5
  });
});
