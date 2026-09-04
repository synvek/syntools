import { describe, expect, it } from 'vitest';
import { convertZh } from './core';

describe('zh-convert', () => {
  it('简转繁', () => {
    const r = convertZh('汉字', 's2t');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe('漢字');
  });

  it('繁转简', () => {
    const r = convertZh('漢字', 't2s');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe('汉字');
  });

  it('空输入', () => {
    expect(convertZh('', 's2t')).toEqual({ ok: false, error: 'EMPTY' });
  });
});
