import { describe, expect, it } from 'vitest';
import { urlDecode, urlEncode } from './core';

describe('urlEncode', () => {
  it('中文编码', () => {
    expect(urlEncode('你好', 'component')).toEqual({ ok: true, value: '%E4%BD%A0%E5%A5%BD' });
  });

  it('component 模式编码保留字符', () => {
    expect(urlEncode('a=1&b=2?c', 'component')).toEqual({
      ok: true,
      value: 'a%3D1%26b%3D2%3Fc',
    });
  });

  it('full 模式保留 URL 结构字符', () => {
    expect(urlEncode('https://a.com/p?x=1&y=中文', 'full')).toEqual({
      ok: true,
      value: 'https://a.com/p?x=1&y=%E4%B8%AD%E6%96%87',
    });
  });

  it('空格编码差异', () => {
    expect(urlEncode('a b', 'component')).toEqual({ ok: true, value: 'a%20b' });
  });
});

describe('urlDecode', () => {
  it('正常解码', () => {
    expect(urlDecode('%E4%BD%A0%E5%A5%BD', 'component')).toEqual({ ok: true, value: '你好' });
  });

  it('双重编码逐层解码', () => {
    const once = urlEncode('50%', 'component');
    expect(once).toEqual({ ok: true, value: '50%25' });
    if (!once.ok) return;
    const twice = urlEncode(once.value, 'component');
    expect(twice).toEqual({ ok: true, value: '50%2525' });
    if (!twice.ok) return;
    const back1 = urlDecode(twice.value, 'component');
    expect(back1).toEqual({ ok: true, value: '50%25' });
    if (!back1.ok) return;
    expect(urlDecode(back1.value, 'component')).toEqual({ ok: true, value: '50%' });
  });

  it('非法 % 序列报错', () => {
    expect(urlDecode('%zz', 'component').ok).toBe(false);
    expect(urlDecode('abc%', 'component').ok).toBe(false);
  });

  it('full 模式不解码组件保留字符', () => {
    // decodeURI 不会解码 %26（&），与 decodeURIComponent 行为不同
    expect(urlDecode('%26', 'full')).toEqual({ ok: true, value: '%26' });
    expect(urlDecode('%26', 'component')).toEqual({ ok: true, value: '&' });
  });
});
