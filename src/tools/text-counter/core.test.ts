import { describe, expect, it } from 'vitest';
import { countTextStats } from './core';

describe('text-counter', () => {
  it('统计中英混合', () => {
    const r = countTextStats('Hello 世界\n\n第二段');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.chars).toBeGreaterThan(0);
    expect(r.value.cjk).toBe(5);
    expect(r.value.words).toBeGreaterThanOrEqual(3);
    expect(r.value.paragraphs).toBe(2);
    expect(r.value.lines).toBe(3);
  });

  it('空输入', () => {
    expect(countTextStats('')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('UTF-8 字节', () => {
    const r = countTextStats('中');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.bytes).toBe(3);
    expect(r.value.chars).toBe(1);
  });
});
