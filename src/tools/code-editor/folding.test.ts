import { describe, expect, it } from 'vitest';
import { getLangSpec } from './core';
import { defaultFoldMode, foldRangeAtLine, foldRanges } from './folding';

const java = getLangSpec('java');
const python = getLangSpec('python');

describe('foldRanges（括号模式）', () => {
  it('跨行的括号对形成可折叠范围', () => {
    const text = ['class A {', '  void f() {', '    g();', '  }', '}'].join('\n');
    expect(foldRanges(text, java)).toEqual([
      { headerLine: 2, endLine: 4, depth: 1 },
      { headerLine: 1, endLine: 5, depth: 0 },
    ]);
  });

  it('单行内闭合的括号不算折叠范围', () => {
    expect(foldRanges('const a = { b: 1 };', java)).toEqual([]);
  });

  it('忽略字符串与注释里的括号', () => {
    const text = ['a("{");', '// }', '/* { */', 'b();'].join('\n');
    expect(foldRanges(text, java)).toEqual([]);
  });

  it('未闭合的括号不产生范围', () => {
    expect(foldRanges('a {\n  b();\n', java)).toEqual([]);
  });
});

describe('foldRanges（缩进模式）', () => {
  it('缩进更深的连续行构成块，空行不打断', () => {
    const text = ['def f():', '    a = 1', '', '    b = 2', 'c = 3'].join('\n');
    expect(foldRanges(text, python, 'indent')).toEqual([{ headerLine: 1, endLine: 4, depth: 0 }]);
  });

  it('默认模式按语言推断', () => {
    expect(defaultFoldMode(python)).toBe('indent');
    expect(defaultFoldMode(java)).toBe('brackets');
  });
});

describe('foldRangeAtLine', () => {
  it('同一行有多个范围时取最外层', () => {
    const ranges = [
      { headerLine: 1, endLine: 3, depth: 0 },
      { headerLine: 1, endLine: 9, depth: 0 },
      { headerLine: 2, endLine: 4, depth: 1 },
    ];
    expect(foldRangeAtLine(ranges, 1)).toEqual({ headerLine: 1, endLine: 9, depth: 0 });
    expect(foldRangeAtLine(ranges, 2)).toEqual({ headerLine: 2, endLine: 4, depth: 1 });
    expect(foldRangeAtLine(ranges, 7)).toBeNull();
  });
});
