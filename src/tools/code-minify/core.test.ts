import { describe, expect, it } from 'vitest';
import { minifyCode, minifyHtml, minifyJs, stripJsComments } from './core';

describe('code-minify JS', () => {
  it('移除行注释与块注释', () => {
    const out = stripJsComments('const a = 1; // 注释\n/* 块 */ const b = 2;');
    expect(out).not.toContain('注释');
    expect(out).toContain('const a = 1;');
    expect(out).toContain('const b = 2;');
  });

  it('保留字符串内的 // 与 /*', () => {
    const out = minifyJs('const url = "http://x.com/*y"; // note');
    expect(out).toContain('http://x.com/*y');
    expect(out).not.toContain('note');
  });

  it('保留换行以避免 ASI 问题', () => {
    const out = minifyJs('let a = 1\nlet b = 2');
    expect(out.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('压缩多余空白', () => {
    expect(minifyJs('const x    =     1;')).toBe('const x = 1;');
  });

  it('保留正则字面量内的 // 与 /*', () => {
    const out = stripJsComments('const r = /a\\/\\/b/g; // note');
    expect(out).toContain('/a\\/\\/b/g');
    expect(out).not.toContain('note');
  });

  it('区分除号与正则', () => {
    const out = stripJsComments('const x = a / b; const r = /ab/g;');
    expect(out).toContain('a / b');
    expect(out).toContain('/ab/g');
  });
});

describe('code-minify HTML', () => {
  it('移除注释与标签间空白', () => {
    const out = minifyHtml('<div>  <p>hi</p>  </div><!-- c -->');
    expect(out).toBe('<div><p>hi</p></div>');
  });
});

describe('code-minify minifyCode', () => {
  it('JSON 压缩并校验', async () => {
    const r = await minifyCode('json', '{ "a" : 1,  "b": [1, 2] }');
    expect(r).toEqual({ ok: true, value: '{"a":1,"b":[1,2]}' });
  });

  it('非法 JSON 报错', async () => {
    expect(await minifyCode('json', '{bad}')).toEqual({ ok: false, error: 'INVALID_JSON' });
  });

  it('空输入报错', async () => {
    expect(await minifyCode('css', '   ')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('CSS 压缩（csso）', async () => {
    const r = await minifyCode('css', 'body {  color: #ff0000;  margin: 0 0 0 0; }');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).not.toContain('\n');
      expect(r.value).toContain('body');
    }
  });
});
