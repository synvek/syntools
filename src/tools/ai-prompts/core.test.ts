import { describe, expect, it } from 'vitest';
import { filterPrompts, getPromptText } from './core';
import { PROMPTS } from './prompts';

describe('ai-prompts', () => {
  it('按分类筛选', () => {
    const list = filterPrompts('', 'coding');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.category === 'coding')).toBe(true);
  });

  it('按关键词搜索', () => {
    const list = filterPrompts('refactor', 'all');
    expect(list.some((p) => p.id === 'code-refactor')).toBe(true);
  });

  it('分类 + 搜索交集', () => {
    const list = filterPrompts('博客', 'writing');
    expect(list.every((p) => p.category === 'writing')).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('getPromptText', () => {
    const item = PROMPTS[0];
    expect(getPromptText(item, 'zh')).toBe(item.promptZh);
    expect(getPromptText(item, 'en')).toBe(item.promptEn);
  });
});
