import { describe, expect, it } from 'vitest';
import {
  ALL_CATEGORY,
  countByCategory,
  filterPrompts,
  pickCategoryName,
  pickText,
  sortCategories,
} from './core';
import { PROMPT_CATEGORIES, PROMPTS } from './data';
import type { PromptCategoryMeta } from './types';

describe('filterPrompts', () => {
  it('按分类筛选时只返回该分类', () => {
    const list = filterPrompts('', 'coding');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.category === 'coding')).toBe(true);
  });

  it('默认为全部分类', () => {
    expect(filterPrompts('')).toHaveLength(PROMPTS.length);
    expect(filterPrompts('', ALL_CATEGORY)).toHaveLength(PROMPTS.length);
  });

  it('按英文关键词跨语种命中', () => {
    const list = filterPrompts('refactor', ALL_CATEGORY);
    expect(list.some((p) => p.id === 'coding-refactor-suggestions')).toBe(true);
  });

  it('按中文关键词跨语种命中', () => {
    const list = filterPrompts('博客', ALL_CATEGORY);
    expect(list.some((p) => p.id === 'writing-blog-outline')).toBe(true);
  });

  it('按分类名关键词命中该分类全部条目', () => {
    const list = filterPrompts('写作创作', ALL_CATEGORY);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.category === 'writing')).toBe(true);
  });

  it('分类与关键词为交集关系', () => {
    const list = filterPrompts('博客', 'writing');
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.category === 'writing')).toBe(true);
    expect(filterPrompts('博客', 'coding')).toHaveLength(0);
  });

  it('无命中时返回空数组而非报错', () => {
    expect(filterPrompts('不存在的关键词-zzz', ALL_CATEGORY)).toEqual([]);
  });

  it('关键词忽略大小写与首尾空白', () => {
    expect(filterPrompts('  REFACTOR  ', ALL_CATEGORY)).toEqual(
      filterPrompts('refactor', ALL_CATEGORY),
    );
  });

  it('支持注入自定义数据集', () => {
    expect(filterPrompts('', ALL_CATEGORY, [])).toEqual([]);
  });
});

describe('pickText', () => {
  const text = { zh: '中文正文', en: 'English body' };

  it('精确命中目标语言', () => {
    expect(pickText(text, 'zh')).toBe('中文正文');
    expect(pickText(text, 'en')).toBe('English body');
  });

  it('区域语言回退到基础语言', () => {
    expect(pickText(text, 'zh-TW')).toBe('中文正文');
  });

  it('未知语言回退到英文', () => {
    expect(pickText(text, 'ko')).toBe('English body');
    expect(pickText(text, '')).toBe('English body');
  });

  it('优先使用精确语种而非英文', () => {
    expect(pickText({ zh: '中', en: 'en', ja: '日本語' }, 'ja')).toBe('日本語');
  });

  it('数据异常时兜底返回第一个非空值', () => {
    expect(pickText({ zh: '', en: '', ja: '日本語' }, 'ko')).toBe('日本語');
    expect(pickText({ zh: '', en: '' }, 'ko')).toBe('');
  });
});

describe('pickCategoryName', () => {
  const meta: PromptCategoryMeta = {
    id: 'writing',
    order: 1,
    name: { zh: '写作创作', en: 'Writing' },
    i18nKey: 'tools.aiPrompts.cat.writing',
  };

  it('优先使用数据中该语种的名称', () => {
    expect(pickCategoryName(meta, 'zh', () => '不应命中')).toBe('写作创作');
  });

  it('i18n 既有译文优先于基础语言回退', () => {
    expect(pickCategoryName(meta, 'zh-TW', () => '寫作')).toBe('寫作');
  });

  it('i18n 未命中（返回键名）时回退基础语言', () => {
    expect(pickCategoryName(meta, 'zh-TW', (key) => key)).toBe('写作创作');
    expect(pickCategoryName(meta, 'zh-TW')).toBe('写作创作');
  });

  it('非区域语言无数据时回退英文', () => {
    expect(pickCategoryName(meta, 'ja', (key) => key)).toBe('Writing');
    expect(pickCategoryName(meta, 'ko')).toBe('Writing');
  });
});

describe('分类工具函数', () => {
  it('sortCategories 按 order 升序且不修改入参', () => {
    const input = [...PROMPT_CATEGORIES];
    const sorted = sortCategories(input);
    expect(input).toEqual(PROMPT_CATEGORIES);
    expect(sorted.map((meta) => meta.order)).toEqual(
      [...sorted.map((m) => m.order)].sort((a, b) => a - b),
    );
  });

  it('countByCategory 汇总条数与总数一致', () => {
    const counts = countByCategory();
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    expect(total).toBe(PROMPTS.length);
    expect(counts.coding).toBeGreaterThanOrEqual(3);
  });
});
