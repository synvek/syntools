import { describe, expect, it } from 'vitest';
import { minifyHtml, processHtml } from './core';

describe('processHtml', () => {
  it('空输入返回 EMPTY', () => {
    expect(processHtml('   ', 'format')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('格式化缩进 HTML', () => {
    const r = processHtml('<div><span>a</span></div>', 'format', 2);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toContain('<div>');
      expect(r.value).toContain('<span>a</span>');
    }
  });

  it('压缩去除多余空白', () => {
    const r = processHtml('<div>  <span>a</span>  </div>', 'compress');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe('<div><span>a</span></div>');
    }
  });

  it('4 空格缩进', () => {
    const r = processHtml('<div><p>x</p></div>', 'format', 4);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatch(/\n {4}</);
  });
});

describe('minifyHtml', () => {
  it('保留 pre 内部空白', () => {
    const input = '<div>  <pre>  a  b  </pre>  </div>';
    const out = minifyHtml(input);
    expect(out).toContain('<pre>  a  b  </pre>');
    expect(out).not.toContain('  <pre>');
  });

  it('移除 HTML 注释', () => {
    expect(minifyHtml('<div><!-- x --><span>a</span></div>')).toBe('<div><span>a</span></div>');
  });
});
