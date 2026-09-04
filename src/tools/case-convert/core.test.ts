import { describe, expect, it } from 'vitest';
import { convertCase, splitWords } from './core';

describe('case-convert', () => {
  it('大小写与交换', () => {
    expect(convertCase('AbC', 'upper')).toEqual({ ok: true, value: 'ABC' });
    expect(convertCase('AbC', 'lower')).toEqual({ ok: true, value: 'abc' });
    expect(convertCase('AbC', 'swap')).toEqual({ ok: true, value: 'aBc' });
  });

  it('命名风格', () => {
    expect(convertCase('hello world', 'camel')).toEqual({ ok: true, value: 'helloWorld' });
    expect(convertCase('hello world', 'pascal')).toEqual({ ok: true, value: 'HelloWorld' });
    expect(convertCase('helloWorld', 'snake')).toEqual({ ok: true, value: 'hello_world' });
    expect(convertCase('hello_world', 'kebab')).toEqual({ ok: true, value: 'hello-world' });
    expect(convertCase('hello world', 'constant')).toEqual({ ok: true, value: 'HELLO_WORLD' });
  });

  it('分词', () => {
    expect(splitWords('fooBar-baz')).toEqual(['foo', 'Bar', 'baz']);
  });

  it('空输入', () => {
    expect(convertCase('', 'upper')).toEqual({ ok: false, error: 'EMPTY' });
  });
});
