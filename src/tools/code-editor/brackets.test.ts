import { describe, expect, it } from 'vitest';
import { findBracketPair, MAX_BRACKET_SCAN } from './brackets';
import { getLangSpec } from './core';

const java = getLangSpec('java');
const python = getLangSpec('python');
const plain = getLangSpec('plaintext');

describe('findBracketPair', () => {
  it('从光标所在括号向前 / 向后配对', () => {
    // f(0)o(1)o(2)((3)b(4)a(5)r(6)[(7)1(8)](9))(10)
    const text = 'foo(bar[1])';
    expect(findBracketPair(text, 4, java)).toEqual({ open: 3, close: 10 });
    expect(findBracketPair(text, 3, java)).toEqual({ open: 3, close: 10 });
    // 偏移 8 是 '1'，回看偏移 7 的 '['
    expect(findBracketPair(text, 8, java)).toEqual({ open: 7, close: 9 });
    expect(findBracketPair(text, 9, java)).toEqual({ open: 7, close: 9 });
  });

  it('按同类型括号计数嵌套', () => {
    const text = 'a { b { c } }';
    expect(findBracketPair(text, 2, java)).toEqual({ open: 2, close: 12 });
    expect(findBracketPair(text, 6, java)).toEqual({ open: 6, close: 10 });
  });

  it('跳过字符串与注释里的括号', () => {
    // 字符串里的右括号不参与配对：f(/* ) */ 1) 的 '(' 应配到末位
    const block = 'f(/* ) */ 1)';
    expect(findBracketPair(block, 1, java)).toEqual({ open: 1, close: 11 });
    // 光标停在字符串内部的括号上时不配对
    expect(findBracketPair('x = "{"; }', 5, java)).toBeNull();
    expect(findBracketPair('x = "}";', 6, java)).toBeNull();
  });

  it('缩进语言用 `#` 注释时同样跳过注释里的括号', () => {
    // call(  # )↵  1↵) —— 注释里的 ')' 不参与配对
    const text = 'call(  # )\n  1\n)';
    expect(findBracketPair(text, 4, python)).toEqual({ open: 4, close: 15 });
  });

  it('不在括号旁或括号不配对时返回 null', () => {
    expect(findBracketPair('abc', 1, java)).toBeNull();
    expect(findBracketPair('{', 0, plain)).toBeNull();
    expect(findBracketPair('{}', 0, plain)).toEqual({ open: 0, close: 1 });
  });

  it('未闭合括号不越界（超出扫描上限返回 null）', () => {
    const text = 'foo(' + 'x'.repeat(MAX_BRACKET_SCAN + 10);
    expect(findBracketPair(text, 3, java)).toBeNull();
  });
});
