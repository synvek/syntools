import { describe, expect, it } from 'vitest';
import { filterStatuses, HTTP_STATUSES, statusClassOf } from './core';

describe('http-status', () => {
  it('状态码不重复', () => {
    const codes = HTTP_STATUSES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('分类与状态码自洽', () => {
    for (const s of HTTP_STATUSES) {
      expect(statusClassOf(s.code)).toBe(s.cls);
    }
  });

  it('按数字过滤', () => {
    const r = filterStatuses('404');
    expect(r.map((s) => s.code)).toContain(404);
  });

  it('按名称过滤（大小写不敏感）', () => {
    const r = filterStatuses('not found');
    expect(r.some((s) => s.code === 404)).toBe(true);
  });

  it('按描述过滤', () => {
    const r = filterStatuses('rate limit');
    expect(r.some((s) => s.code === 429)).toBe(true);
  });

  it('空查询返回全部', () => {
    expect(filterStatuses('').length).toBe(HTTP_STATUSES.length);
  });

  it('越界码返回 null', () => {
    expect(statusClassOf(99)).toBeNull();
    expect(statusClassOf(600)).toBeNull();
  });
});
