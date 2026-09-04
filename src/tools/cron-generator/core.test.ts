import { describe, expect, it } from 'vitest';
import { buildCronExpression, buildCronPart, defaultFields } from './core';

describe('cron-generator', () => {
  it('默认每分钟', () => {
    const r = buildCronExpression(defaultFields());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe('* * * * *');
  });

  it('步进与列表', () => {
    expect(buildCronPart('minute', { ...defaultFields().minute, mode: 'step', step: 5 })).toEqual({
      ok: true,
      value: '*/5',
    });
    expect(
      buildCronPart('hour', { ...defaultFields().hour, mode: 'list', list: '1, 3, 2' }),
    ).toEqual({ ok: true, value: '1,2,3' });
  });

  it('非法范围', () => {
    expect(
      buildCronPart('hour', {
        ...defaultFields().hour,
        mode: 'range',
        from: 10,
        to: 5,
      }),
    ).toEqual({ ok: false, error: 'INVALID_FIELD' });
  });
});
