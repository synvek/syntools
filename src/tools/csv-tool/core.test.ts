import { describe, expect, it } from 'vitest';
import { csvToJson, jsonToCsv, parseCsv, serializeCsv } from './core';

describe('csv-tool 解析', () => {
  it('基础解析', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('处理引号内的分隔符与换行', () => {
    const rows = parseCsv('a,"b,c",d\n"line1\nline2",2,3');
    expect(rows[0]).toEqual(['a', 'b,c', 'd']);
    expect(rows[1]).toEqual(['line1\nline2', '2', '3']);
  });

  it('双引号转义', () => {
    expect(parseCsv('"he said ""hi""",2')).toEqual([['he said "hi"', '2']]);
  });

  it('CRLF 换行', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('分号分隔', () => {
    expect(parseCsv('a;b\n1;2', ';')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('csv-tool 转换', () => {
  it('CSV → JSON（带表头）', () => {
    const r = csvToJson('name,age\nTom,20', { delimiter: ',', hasHeader: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.parse(r.value)).toEqual([{ name: 'Tom', age: '20' }]);
  });

  it('CSV → JSON（无表头）', () => {
    const r = csvToJson('1,2\n3,4', { delimiter: ',', hasHeader: false });
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(JSON.parse(r.value)).toEqual([
        ['1', '2'],
        ['3', '4'],
      ]);
  });

  it('空输入报错', () => {
    expect(csvToJson('', { delimiter: ',', hasHeader: true })).toEqual({
      ok: false,
      error: 'EMPTY',
    });
  });

  it('JSON → CSV（对象数组）', () => {
    const r = jsonToCsv('[{"a":1,"b":2},{"a":3,"b":4}]');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('a,b\n1,2\n3,4');
  });

  it('JSON → CSV（二维数组）', () => {
    const r = jsonToCsv('[[1,2],[3,4]]');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('1,2\n3,4');
  });

  it('非法 JSON 报错', () => {
    expect(jsonToCsv('{bad}')).toEqual({ ok: false, error: 'INVALID_JSON' });
  });

  it('非数组报错', () => {
    expect(jsonToCsv('{"a":1}')).toEqual({ ok: false, error: 'NOT_ARRAY' });
  });

  it('序列化含分隔符的字段加引号', () => {
    expect(serializeCsv([['a,b', 'c"d']])).toBe('"a,b","c""d"');
  });
});
