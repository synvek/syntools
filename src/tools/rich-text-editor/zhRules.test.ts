import { describe, expect, it } from 'vitest';
import { checkChinese } from './zhRules';

/**
 * Chinese proofreading rules (P1-3): half-width punctuation, doubled function words, curated typos.
 * The negative cases matter as much as the positive ones — a false underline in a word processor is
 * worse than a missed typo, so every rule is pinned on both sides.
 */

const words = (text: string, ignore?: string[]) =>
  checkChinese(text, ignore).map((issue) => issue.word);
const kinds = (text: string, ignore?: string[]) =>
  checkChinese(text, ignore).map((issue) => issue.kind);

describe('half-width punctuation inside Chinese text', () => {
  it('flags a half-width mark between two Chinese characters and suggests the full-width one', () => {
    const [issue] = checkChinese('我们,明天见');
    expect(issue).toMatchObject({
      word: ',',
      start: 2,
      end: 3,
      kind: 'punctuation',
      suggestion: '，',
    });
  });

  it('covers every half-width mark that Chinese text should not use', () => {
    expect(words('甲,乙;丙:丁?戊!己。')).toEqual([',', ';', ':', '?', '!']);
    expect(checkChinese('甲.乙')[0]?.suggestion).toBe('。');
  });

  it('leaves Latin context alone: numbers, versions, English words', () => {
    expect(words('版本 1.2 发布于 2026,03')).toEqual([]);
    expect(words('见 github.com 与 user@example.com')).toEqual([]);
    expect(words('用 A,B 表示区间')).toEqual([]);
  });

  it('needs Chinese on both sides, not just one', () => {
    expect(words('我们在A, B之间')).toEqual([]);
  });
});

describe('repeated punctuation', () => {
  it('flags doubled commas and periods', () => {
    expect(words('好的，，我们走。')).toEqual(['，，']);
    expect(words('结束。。')).toEqual(['。。']);
  });

  it('does not touch ellipsis or em dashes', () => {
    expect(words('等等……还有——另外')).toEqual([]);
  });

  it('treats doubled exclamation marks as style, not a typo', () => {
    expect(words('太好了！！')).toEqual([]);
  });
});

describe('doubled function words', () => {
  it('flags a doubled particle and suggests the single form', () => {
    const [issue] = checkChinese('我们们出发');
    expect(issue).toMatchObject({
      word: '们们',
      start: 1,
      end: 3,
      kind: 'duplicate',
      suggestion: '们',
    });
    expect(words('是的的')).toEqual(['的的']);
  });

  it('leaves legitimate reduplication alone', () => {
    expect(words('人人都有天天练习的习惯')).toEqual([]);
    expect(words('高高兴兴常常来来往往')).toEqual([]);
    // Idioms that start with a doubled function word are whitelisted
    expect(words('的的确确如此')).toEqual([]);
    expect(words('是是非非说不清')).toEqual([]);
  });
});

describe('curated homophone typos', () => {
  it('flags a known wrong form and offers the correct one', () => {
    const [issue] = checkChinese('请帮忙按装软件');
    expect(issue).toMatchObject({
      word: '按装',
      start: 3,
      end: 5,
      kind: 'typo',
      suggestion: '安装',
    });
  });

  it('prefers the longest entry when two would overlap', () => {
    expect(words('他装模做样')).toEqual(['装模做样']);
    expect(checkChinese('他装模做样')[0]?.suggestion).toBe('装模作样');
  });

  it('finds several typos in one text in document order', () => {
    expect(words('必竟这是部份工作')).toEqual(['必竟', '部份']);
  });

  it('accepts words the user already added to the dictionary', () => {
    expect(words('请帮忙按装软件', ['按装'])).toEqual([]);
  });
});

describe('word-level repetition', () => {
  it('flags a noun repeated twice in a row and suggests the single copy', () => {
    const [issue] = checkChinese('请把文档文档发给客户');
    expect(issue).toMatchObject({
      word: '文档文档',
      start: 2,
      end: 6,
      kind: 'duplicate',
      suggestion: '文档',
    });
  });

  it('flags longer units without a word-class check', () => {
    expect(words('说明书说明书丢了')).toEqual(['说明书说明书']);
  });

  it('collapses a run longer than two copies into one issue', () => {
    const issues = checkChinese('文档文档文档');
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ word: '文档文档文档', start: 0, end: 6, suggestion: '文档' });
  });

  it('leaves legitimate ABAB reduplication and quantifier repetition alone', () => {
    // Verb reduplication is correct Chinese, and content verbs are not in the noun watch list
    expect(words('我们研究研究再定')).toEqual([]);
    expect(words('大家商量商量')).toEqual([]);
    // Quantifier / numeral units repeat legitimately
    expect(words('一个一个来，一件一件办')).toEqual([]);
    // Colloquial emphasis
    expect(words('怎么样怎么样，服不服')).toEqual([]);
    expect(words('欢迎欢迎')).toEqual([]);
    // Idioms that look like a repeated unit
    expect(words('的的确确如此')).toEqual([]);
    expect(words('是是非非说不清')).toEqual([]);
  });

  it('respects the custom dictionary for the whole repeated run', () => {
    expect(words('文档文档', ['文档文档'])).toEqual([]);
  });
});

describe('result shape', () => {
  it('returns every issue sorted by position, with no duplicates', () => {
    const issues = checkChinese('我们,明天,,按装好');
    const starts = issues.map((issue) => issue.start);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(new Set(issues.map((issue) => `${issue.start}:${issue.end}:${issue.kind}`)).size).toBe(
      issues.length,
    );
    expect(kinds('我们,明天,,按装好')).toEqual(['punctuation', 'punctuation', 'typo']);
  });

  it('handles empty and pure-Latin text', () => {
    expect(checkChinese('')).toEqual([]);
    expect(checkChinese('hello world')).toEqual([]);
  });
});
