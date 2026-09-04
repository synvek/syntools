import { describe, expect, it } from 'vitest';
import { queryJsonPath, tokenizePath } from './core';

describe('json-path', () => {
  it('空输入 EMPTY', () => {
    expect(queryJsonPath('', 'a')).toEqual({ ok: false, error: 'EMPTY' });
    expect(queryJsonPath('{}', '')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法 JSON', () => {
    expect(queryJsonPath('{', 'a')).toEqual({ ok: false, error: 'INVALID_JSON' });
  });

  it('点路径与数组下标', () => {
    const json = JSON.stringify({ a: { b: [{ c: 1 }, { c: 2 }] } });
    expect(queryJsonPath(json, 'a.b[1].c')).toEqual({ ok: true, value: '2' });
    expect(queryJsonPath(json, '$.a.b[0].c')).toEqual({ ok: true, value: '1' });
  });

  it('未找到', () => {
    expect(queryJsonPath('{"a":1}', 'b')).toEqual({ ok: false, error: 'NOT_FOUND' });
  });

  it('tokenize 根路径', () => {
    expect(tokenizePath('$')).toEqual({ ok: true, value: [] });
  });
});
