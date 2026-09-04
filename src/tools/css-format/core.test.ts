import { describe, expect, it } from 'vitest';
import { processCss } from './core';

describe('processCss', () => {
  it('空输入返回 EMPTY', () => {
    expect(processCss('   ', 'format')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('格式化 CSS', () => {
    const r = processCss('a{color:red}', 'format', 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toContain('color');
      expect(r.value).toContain('\n');
    }
  });

  it('压缩 CSS', () => {
    const r = processCss('a { color: red; }', 'compress');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe('a{color:red}');
    }
  });

  it('4 空格缩进', () => {
    const r = processCss('.box{margin:0}', 'format', 4);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatch(/\n {4}/);
  });
});
