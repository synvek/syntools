import { describe, expect, it } from 'vitest';
import { generateFakeData } from './core';

describe('fake-data', () => {
  it('非法数量', () => {
    expect(generateFakeData('name', 0, 'en')).toEqual({ ok: false, error: 'INVALID_COUNT' });
    expect(generateFakeData('name', 51, 'zh')).toEqual({ ok: false, error: 'INVALID_COUNT' });
    expect(generateFakeData('name', 1.5, 'en')).toEqual({ ok: false, error: 'INVALID_COUNT' });
  });

  it('生成指定行数', () => {
    const r = generateFakeData('uuid', 3, 'en');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.split('\n')).toHaveLength(3);
  });

  it('中文姓名非空', () => {
    const r = generateFakeData('name', 1, 'zh');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.length).toBeGreaterThan(1);
  });

  it('email 含 @', () => {
    const r = generateFakeData('email', 1, 'en');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('@');
  });

  it('lorem 段落', () => {
    const r = generateFakeData('lorem', 2, 'zh');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.split('\n')).toHaveLength(2);
  });
});
