import { describe, expect, it } from 'vitest';
import { isWordChar, replaceRanges, wordAtOffset, wordRanges } from './multiEdit';

describe('wordAtOffset', () => {
  it('光标在词内 / 词尾都能取到词', () => {
    expect(wordAtOffset('const total = 1;', 8)).toBe('total');
    expect(wordAtOffset('const total = 1;', 10)).toBe('total');
    expect(wordAtOffset('const total = 1;', 11)).toBe('total');
    expect(wordAtOffset('const total = 1;', 0)).toBe('const');
  });

  it('支持下划线 / 数字 / CJK 组成的词', () => {
    expect(wordAtOffset('let foo_bar2 = 1;', 6)).toBe('foo_bar2');
    expect(wordAtOffset('变量名称 = 1', 1)).toBe('变量名称');
  });

  it('不在词上时返回 null', () => {
    expect(wordAtOffset('a + b', 2)).toBeNull();
    expect(wordAtOffset('', 0)).toBeNull();
  });
});

describe('isWordChar', () => {
  it('字母 / 数字 / 下划线为词字符', () => {
    expect(isWordChar('a')).toBe(true);
    expect(isWordChar('_')).toBe(true);
    expect(isWordChar('7')).toBe(true);
    expect(isWordChar(' ')).toBe(false);
    expect(isWordChar(undefined)).toBe(false);
  });
});

describe('wordRanges', () => {
  it('枚举全文同词并区分大小写', () => {
    const text = 'total totalTotal total_1 total';
    const found = wordRanges(text, 3);
    expect(found?.word).toBe('total');
    // 「totalTotal」与「total_1」都不算独立词
    expect(found?.ranges.map((range) => range.start)).toEqual([0, 25]);
    expect(wordRanges(text, 3, false)?.ranges.length).toBe(2);
  });

  it('词上的光标落在符号旁时返回 null', () => {
    expect(wordRanges('a + b', 2)).toBeNull();
  });
});

describe('replaceRanges', () => {
  it('多处替换从后往前应用，互不影响', () => {
    const text = 'total = total + total;';
    const ranges = [
      { start: 0, end: 5 },
      { start: 8, end: 13 },
      { start: 16, end: 21 },
    ];
    expect(replaceRanges(text, ranges, 'sum')).toBe('sum = sum + sum;');
  });

  it('替换文本长度与原文不同的区间时偏移依旧正确', () => {
    expect(
      replaceRanges(
        'a b a',
        [
          { start: 0, end: 1 },
          { start: 4, end: 5 },
        ],
        'long',
      ),
    ).toBe('long b long');
  });

  it('空区间列表原样返回', () => {
    expect(replaceRanges('abc', [], 'x')).toBe('abc');
  });
});
