import { describe, expect, it } from 'vitest';
import { minifyJs, processJs } from './core';

describe('processJs', () => {
  it('空输入返回 EMPTY', () => {
    expect(processJs('   ', 'format')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('格式化 JS', () => {
    const r = processJs('function a(){return 1}', 'format', 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toContain('function a()');
      expect(r.value).toContain('return 1');
      expect(r.value).toContain('\n');
    }
  });

  it('压缩 JS 去除空白与注释', () => {
    const input = `function hello() {
  // comment
  return 1 + 2;
}`;
    const r = processJs(input, 'compress');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe('function hello(){return 1+2;}');
      expect(r.value).not.toContain('comment');
    }
  });
});

describe('minifyJs', () => {
  it('保留字符串内容', () => {
    expect(minifyJs('const a = "  x  y  ";')).toBe('const a="  x  y  ";');
  });

  it('保留正则字面量', () => {
    expect(minifyJs('const r = /a b/g;')).toBe('const r=/a b/g;');
  });

  it('标识符之间保留空格', () => {
    expect(minifyJs('return true')).toBe('return true');
  });
});
