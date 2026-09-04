import { describe, expect, it } from 'vitest';
import {
  compressJson,
  formatJson,
  locateJsonError,
  positionToLineColumn,
  validateJson,
} from './core';

describe('formatJson', () => {
  it('2 空格缩进格式化', () => {
    expect(formatJson('{"a":1,"b":[1,2]}', 2)).toEqual({
      ok: true,
      value: '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}',
    });
  });

  it('4 空格缩进格式化', () => {
    expect(formatJson('{"a":1}', 4)).toEqual({ ok: true, value: '{\n    "a": 1\n}' });
  });

  it('深层嵌套（100 层）格式化成功', () => {
    const depth = 100;
    const input = '['.repeat(depth) + '1' + ']'.repeat(depth);
    const r = formatJson(input, 2);
    expect(r.ok).toBe(true);
    if (r.ok) expect(JSON.parse(r.value)).toEqual(JSON.parse(input));
  });

  it('空输入报错', () => {
    expect(formatJson('   ', 2)).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('非法 JSON 报错并定位行列', () => {
    const r = formatJson('{\n  "a": 1,\n  "b": \n}', 2);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('MISSING_VALUE');
      expect(r.params?.line).toBe(3);
    }
  });

  it('尾随逗号报错', () => {
    const r = formatJson('{"a": 1,}', 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('TRAILING_COMMA');
  });
});

describe('compressJson', () => {
  it('去除空白', () => {
    expect(compressJson('{\n  "a": 1\n}')).toEqual({ ok: true, value: '{"a":1}' });
  });

  it('非法输入报错定位', () => {
    expect(compressJson('[1, 2').ok).toBe(false);
  });
});

describe('validateJson', () => {
  it('合法 JSON', () => {
    const r = validateJson('{"a": [true, null, 1.5e3]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('VALID');
  });

  it('非法字符给出行列', () => {
    const r = validateJson("{'a': 1}");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('KEY_MUST_BE_STRING');
      expect(r.params?.line).toBe(1);
      expect(r.params?.column).toBe(2);
    }
  });

  it('值之后的多余内容报错', () => {
    expect(validateJson('{} {}').ok).toBe(false);
  });
});

describe('locateJsonError', () => {
  it('合法输入返回 null', () => {
    expect(locateJsonError('{"a": 1}')).toBeNull();
  });

  it('未闭合字符串', () => {
    const issue = locateJsonError('{"a": "abc');
    expect(issue).not.toBeNull();
    expect(issue?.code).toBe('UNCLOSED_STRING');
  });

  it('非法转义', () => {
    const issue = locateJsonError('"a\\qb"');
    expect(issue?.code).toBe('INVALID_ESCAPE');
  });

  it('非法 \\u 转义', () => {
    expect(locateJsonError('"\\u12"')?.code).toBe('INVALID_UNICODE_ESCAPE');
  });

  it('非法数字', () => {
    expect(locateJsonError('01')?.code).toBe('EXTRA_CONTENT');
  });

  it('数组缺少逗号', () => {
    const issue = locateJsonError('[1 2]');
    expect(issue?.code).toBe('MISSING_COMMA_ARRAY');
  });
});

describe('positionToLineColumn', () => {
  it('多行位置换算', () => {
    expect(positionToLineColumn('ab\ncd\ne', 4)).toEqual({ line: 2, column: 2 });
  });
});
