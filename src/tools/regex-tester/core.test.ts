import { describe, expect, it } from 'vitest';
import { compileRegex, findMatches, replaceRegex, MAX_MATCHES, MAX_TEXT_LENGTH } from './core';

describe('compileRegex', () => {
  it('空模式报错', () => {
    const r = compileRegex('', 'g');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('EMPTY');
  });

  it('非法模式给出编译错误信息', () => {
    const r = compileRegex('(', '');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('COMPILE');
      expect(r.params?.message).toBeTruthy();
    }
  });

  it('非法 flags 报错', () => {
    expect(compileRegex('a', 'z').ok).toBe(false);
  });

  it('合法模式编译成功', () => {
    const r = compileRegex('\\d+', 'g');
    expect(r.ok).toBe(true);
  });
});

describe('findMatches', () => {
  it('查找多个匹配并给出位置', () => {
    const r = findMatches(/\d+/g, 'a1 b22');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.matches.map((m) => [m.value, m.index])).toEqual([
      ['1', 1],
      ['22', 4],
    ]);
    expect(r.value.truncated).toBe(false);
  });

  it('未带 g 标志时自动全局化', () => {
    // 'foo foo' 中共有 4 个 'o'
    const r = findMatches(/o/, 'foo foo');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.matches).toHaveLength(4);
  });

  it('收集序号捕获组与命名捕获组', () => {
    // 命名组同样占用序号：groups 按捕获组序号依次为 year、月份
    const r = findMatches(/(?<year>\d{4})-(\d{2})/g, 'date: 2026-09');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = r.value.matches[0];
    expect(m.groups).toEqual(['2026', '09']);
    expect(m.named).toEqual({ year: '2026' });
  });

  it('空匹配不会死循环', () => {
    const r = findMatches(/x?/g, 'ab');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.matches).toHaveLength(3); // 位置 0、1、2
  });

  it('多行模式下 ^ 匹配行首', () => {
    const r = findMatches(/^b/gm, 'a\nb');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.matches).toHaveLength(1);
    expect(r.value.matches[0].index).toBe(2);
  });

  it('超过上限时截断并标记', () => {
    const r = findMatches(/./g, 'a'.repeat(MAX_MATCHES + 100));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.matches).toHaveLength(MAX_MATCHES);
    expect(r.value.truncated).toBe(true);
  });

  it('超大文本拒绝匹配（防 ReDoS）', () => {
    const r = findMatches(/./g, 'a'.repeat(MAX_TEXT_LENGTH + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('TEXT_TOO_LONG');
  });
});

describe('replaceRegex', () => {
  it('全局替换与捕获组', () => {
    const r = replaceRegex(/(\d+)/g, 'a1 b22', 'N$1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toBe('aN1 bN22');
  });
});
