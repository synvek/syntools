import { describe, expect, it } from 'vitest';
import { filterMimes, MIME_TYPES, mimeForExtension } from './core';

describe('mime-types', () => {
  it('扩展名唯一（忽略大小写）', () => {
    const exts = MIME_TYPES.map((m) => m.ext.toLowerCase());
    expect(new Set(exts).size).toBe(exts.length);
  });

  it('按扩展名精确查询', () => {
    expect(mimeForExtension('json')).toBe('application/json');
    expect(mimeForExtension('.png')).toBe('image/png');
    expect(mimeForExtension('unknown')).toBeNull();
  });

  it('按扩展名过滤', () => {
    const r = filterMimes('png');
    expect(r.some((m) => m.ext === '.png')).toBe(true);
  });

  it('按 MIME 过滤', () => {
    const r = filterMimes('image/');
    expect(r.length).toBeGreaterThan(3);
    expect(r.every((m) => m.mime.startsWith('image/'))).toBe(true);
  });

  it('按描述过滤', () => {
    const r = filterMimes('font');
    expect(r.length).toBeGreaterThan(0);
  });

  it('空查询返回全部', () => {
    expect(filterMimes('').length).toBe(MIME_TYPES.length);
  });
});
