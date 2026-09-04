import { describe, expect, it } from 'vitest';
import { convertJson, jsonToCsv, jsonToXml } from './core';

describe('convertJson', () => {
  it('空输入 EMPTY', () => {
    expect(convertJson('  ', 'yaml')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法 JSON PARSE', () => {
    expect(convertJson('{', 'yaml')).toEqual({ ok: false, error: 'PARSE' });
  });

  it('转 YAML', () => {
    const r = convertJson('{"a":1,"b":true}', 'yaml');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toContain('a: 1');
      expect(r.value).toContain('b: true');
    }
  });

  it('转 XML', () => {
    const r = convertJson('{"user":{"name":"Ada"}}', 'xml');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toContain('<user>');
      expect(r.value).toContain('<name>Ada</name>');
    }
  });

  it('转 CSV', () => {
    const r = convertJson('[{"id":1,"name":"a"},{"id":2,"name":"b"}]', 'csv');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe('id,name\n1,a\n2,b');
    }
  });

  it('非对象数组转 CSV 失败', () => {
    expect(convertJson('[1,2,3]', 'csv')).toEqual({ ok: false, error: 'CONVERT' });
  });
});

describe('jsonToCsv / jsonToXml', () => {
  it('CSV 转义逗号与引号', () => {
    expect(jsonToCsv([{ note: 'a,b', q: 'say "hi"' }])).toBe('note,q\n"a,b","say ""hi"""');
  });

  it('标量包 root', () => {
    expect(jsonToXml(1)).toContain('<root>1</root>');
  });
});
