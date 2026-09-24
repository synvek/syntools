import { describe, expect, it } from 'vitest';
import { mergeBytes, splitBytes } from './core';

const bytes = (s: string) => new TextEncoder().encode(s);

describe('file-split-merge 切分', () => {
  it('按大小切分', () => {
    const r = splitBytes(bytes('abcdefgh'), { mode: 'size', size: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((p) => new TextDecoder().decode(p))).toEqual(['abc', 'def', 'gh']);
  });

  it('按数量切分（尽量均分）', () => {
    const r = splitBytes(bytes('abcdefghij'), { mode: 'count', count: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((p) => p.length)).toEqual([4, 3, 3]);
  });

  it('空数据报错', () => {
    expect(splitBytes(new Uint8Array(), { mode: 'size', size: 4 })).toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });

  it('非法大小报错', () => {
    expect(splitBytes(bytes('abc'), { mode: 'size', size: 0 })).toEqual({
      ok: false,
      error: 'INVALID_SIZE',
    });
  });

  it('非法数量报错', () => {
    expect(splitBytes(bytes('abc'), { mode: 'count', count: 1 })).toEqual({
      ok: false,
      error: 'INVALID_COUNT',
    });
  });
});

describe('file-split-merge 合并', () => {
  it('切分后合并可还原', () => {
    const original = bytes('The quick brown fox jumps over the lazy dog 中文内容');
    const split = splitBytes(original, { mode: 'count', count: 5 });
    expect(split.ok).toBe(true);
    if (!split.ok) return;
    const merged = mergeBytes(split.value);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(Array.from(merged.value)).toEqual(Array.from(original));
  });

  it('空分片列表报错', () => {
    expect(mergeBytes([])).toEqual({ ok: false, error: 'EMPTY' });
  });
});
