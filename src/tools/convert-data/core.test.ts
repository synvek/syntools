import { describe, expect, it } from 'vitest';
import { convert, parseData, stringifyData } from './core';

const okConvert = (text: string, from: 'yaml' | 'json' | 'toml', to: 'yaml' | 'json' | 'toml') => {
  const result = convert(text, from, to);
  expect(result.ok).toBe(true);
  return result.ok ? result.value : '';
};

describe('convert', () => {
  it('YAML → JSON：嵌套与数组', () => {
    const output = okConvert('a: 1\nb:\n  - x\n  - y', 'yaml', 'json');
    expect(JSON.parse(output)).toEqual({ a: 1, b: ['x', 'y'] });
  });

  it('JSON → YAML', () => {
    const output = okConvert('{"a":1,"b":{"c":true}}', 'json', 'yaml');
    expect(output).toContain('a: 1');
    expect(output).toContain('c: true');
  });

  it('YAML → TOML：表结构保留', () => {
    const output = okConvert('title: T\nowner:\n  name: Alice', 'yaml', 'toml');
    expect(output).toContain('title = "T"');
    expect(output).toContain('[owner]');
    expect(output).toContain('name = "Alice"');
  });

  it('TOML → JSON', () => {
    const output = okConvert('a = 1\n[b]\nc = "d"', 'toml', 'json');
    expect(JSON.parse(output)).toEqual({ a: 1, b: { c: 'd' } });
  });

  it('TOML → YAML 与 JSON → TOML', () => {
    const toYaml = okConvert('a = 1', 'toml', 'yaml');
    expect(toYaml).toContain('a: 1');
    const toToml = okConvert('{"name":"SynTools"}', 'json', 'toml');
    expect(toToml).toContain('name = "SynTools"');
  });

  it('Unicode 键值往返不丢失', () => {
    const output = okConvert('名字: 工具集', 'yaml', 'json');
    expect(JSON.parse(output)).toEqual({ 名字: '工具集' });
  });

  it('空输入返回 EMPTY', () => {
    expect(convert('', 'yaml', 'json')).toEqual({ ok: false, error: 'EMPTY' });
    expect(convert('   ', 'json', 'yaml')).toEqual({ ok: false, error: 'EMPTY' });
  });

  it('解析失败返回 PARSE', () => {
    expect(convert('{', 'json', 'yaml')).toEqual({ ok: false, error: 'PARSE' });
    expect(convert('= invalid =', 'toml', 'json')).toEqual({ ok: false, error: 'PARSE' });
  });

  it('TOML 顶层数组不可序列化，返回 STRINGIFY', () => {
    expect(convert('[1, 2, 3]', 'json', 'toml')).toEqual({ ok: false, error: 'STRINGIFY' });
  });
});

describe('parseData / stringifyData', () => {
  it('parseData：YAML null 与 JSON 标量', () => {
    const yamlNull = parseData('', 'yaml');
    expect(yamlNull.ok && yamlNull.value).toBeNull();
    const jsonNum = parseData('42', 'json');
    expect(jsonNum.ok && jsonNum.value).toBe(42);
  });

  it('stringifyData：JSON 缩进 2 空格', () => {
    const result = stringifyData({ a: 1 }, 'json');
    expect(result.ok && result.value).toBe('{\n  "a": 1\n}');
  });

  it('stringifyData：TOML 拒绝顶层标量', () => {
    expect(stringifyData(42, 'toml')).toEqual({ ok: false, error: 'STRINGIFY' });
  });
});
