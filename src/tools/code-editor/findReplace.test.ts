import { describe, expect, it } from 'vitest';
import {
  findMatches,
  MAX_MATCHES,
  replaceAll,
  replaceOne,
  stepIndex,
  type FindResult,
} from './findReplace';

function matchesOf(text: string, query: string, options = {}): FindResult {
  const result = findMatches(text, query, options);
  if (!result.ok) throw new Error(`unexpected failure: ${result.error}`);
  return result.value;
}

describe('findMatches', () => {
  it('枚举命中并给出行列号', () => {
    expect(matchesOf('a\nbb\na', 'a').matches).toEqual([
      { start: 0, end: 1, line: 1, col: 0 },
      { start: 5, end: 6, line: 3, col: 0 },
    ]);
    expect(matchesOf('aaa', 'a').matches).toHaveLength(3);
  });

  it('空查找内容返回空结果', () => {
    expect(matchesOf('abc', '')).toEqual({ matches: [], truncated: false });
  });

  it('区分大小写', () => {
    expect(matchesOf('Foo foo', 'foo').matches).toHaveLength(2);
    expect(matchesOf('Foo foo', 'foo', { matchCase: true }).matches).toHaveLength(1);
  });

  it('全词匹配按词字符边界判定（中英文均适用）', () => {
    expect(matchesOf('foo foobar foo_bar', 'foo', { wholeWord: true }).matches).toHaveLength(1);
    expect(matchesOf('中文 中文测试', '中文', { wholeWord: true }).matches).toHaveLength(1);
    // 非词字符开头的查找内容不做前边界限制
    expect(matchesOf('a //b //c', '//', { wholeWord: true }).matches).toHaveLength(2);
  });

  it('正则模式与非法正则', () => {
    expect(matchesOf('a1 b2', '\\d', { regex: true }).matches).toHaveLength(2);
    expect(findMatches('abc', '[', { regex: true })).toEqual({ ok: false, error: 'REGEX_INVALID' });
  });

  it('零长度命中不会死循环', () => {
    expect(matchesOf('bbb', 'a*', { regex: true }).matches).toHaveLength(4);
    expect(matchesOf('abc', '^', { regex: true }).matches).toHaveLength(1);
  });

  it('超过上限时截断并标记', () => {
    const result = matchesOf('a'.repeat(MAX_MATCHES + 100), 'a');
    expect(result.matches).toHaveLength(MAX_MATCHES);
    expect(result.truncated).toBe(true);
  });

  it('命中数量上限内不标记截断', () => {
    expect(matchesOf('a'.repeat(10), 'a').truncated).toBe(false);
  });
});

describe('替换', () => {
  it('替换单处命中', () => {
    const text = 'hello world';
    const match = matchesOf(text, 'world').matches[0]!;
    expect(replaceOne(text, match, 'world', 'there')).toBe('hello there');
  });

  it('正则替换支持捕获组', () => {
    const text = 'a=1';
    const match = matchesOf(text, '(\\w+)=(\\d+)', { regex: true }).matches[0]!;
    expect(replaceOne(text, match, '(\\w+)=(\\d+)', '$2=$1', { regex: true })).toBe('1=a');
    const all = replaceAll(text, '(\\w+)=(\\d+)', '$2=$1', { regex: true });
    expect(all.ok && all.value).toBe('1=a');
  });

  it('全部替换按命中位置推进，不会错位', () => {
    const plain = replaceAll('a b a', 'a', 'x');
    expect(plain.ok && plain.value).toBe('x b x');
    const word = replaceAll('foo foobar', 'foo', 'x', { wholeWord: true });
    expect(word.ok && word.value).toBe('x foobar');
  });

  it('空查找内容原样返回', () => {
    expect(replaceAll('abc', '', 'x')).toEqual({ ok: true, value: 'abc' });
  });

  it('命中被截断时拒绝全部替换', () => {
    const result = replaceAll('a'.repeat(MAX_MATCHES + 1), 'a', 'b');
    expect(result).toEqual({ ok: false, error: 'TOO_MANY_MATCHES' });
  });
});

describe('stepIndex', () => {
  it('循环推进并处理未选中状态', () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
    expect(stepIndex(-1, 3, 1)).toBe(0);
    expect(stepIndex(-1, 3, -1)).toBe(2);
    expect(stepIndex(0, 0, 1)).toBe(0);
  });
});
