import { describe, expect, it } from 'vitest';
import { countByCategory } from './core';
import { PROMPT_CATEGORIES, PROMPTS, validatePromptData } from './data';

/** 内容底线：每个分类至少 10 条 */
const MIN_PER_CATEGORY = 10;

/** 需要携带免责声明的领域 */
const DISCLAIMER_CATEGORIES = ['finance', 'legal', 'health'];

describe('提示词数据完整性', () => {
  it('通过全部校验规则（含每类条数底线）', () => {
    const issues = validatePromptData(PROMPTS, PROMPT_CATEGORIES, {
      minPerCategory: MIN_PER_CATEGORY,
    });
    expect(issues).toEqual([]);
  });

  it('分类数量落在 20-30 之间', () => {
    expect(PROMPT_CATEGORIES.length).toBeGreaterThanOrEqual(20);
    expect(PROMPT_CATEGORIES.length).toBeLessThanOrEqual(30);
  });

  it('提示词 id 全局唯一', () => {
    const ids = PROMPTS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('每个分类都有内容且条数达标', () => {
    const counts = countByCategory(PROMPTS);
    for (const meta of PROMPT_CATEGORIES) {
      expect(counts[meta.id] ?? 0, `分类 ${meta.id} 条数不足`).toBeGreaterThanOrEqual(
        MIN_PER_CATEGORY,
      );
    }
    expect(Object.keys(counts).sort()).toEqual(PROMPT_CATEGORIES.map((meta) => meta.id).sort());
  });

  it('每条提示词的中英文标题与正文均非空', () => {
    for (const item of PROMPTS) {
      for (const value of [item.title.zh, item.title.en, item.prompt.zh, item.prompt.en]) {
        expect(value.trim().length, `${item.id} 存在空文本`).toBeGreaterThan(0);
      }
    }
  });

  it('正文中的 {{占位符}} 成对出现', () => {
    for (const item of PROMPTS) {
      for (const text of [item.prompt.zh, item.prompt.en]) {
        const open = (text.match(/\{\{/g) ?? []).length;
        const close = (text.match(/\}\}/g) ?? []).length;
        expect(open, `${item.id} 占位符未闭合`).toBe(close);
      }
    }
  });

  it('法律 / 财务 / 健康类提示词均含免责声明', () => {
    const risky = PROMPTS.filter((item) => DISCLAIMER_CATEGORIES.includes(item.category));
    expect(risky.length).toBeGreaterThan(0);
    for (const item of risky) {
      expect(item.prompt.zh, `${item.id} 缺少中文免责声明`).toContain('仅供参考');
      expect(item.prompt.en, `${item.id} 缺少英文免责声明`).toMatch(
        /not (financial|investment|legal|medical)/,
      );
    }
  });

  it('分类 order 唯一且从 1 连续编号', () => {
    const orders = PROMPT_CATEGORIES.map((meta) => meta.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: orders.length }, (_, index) => index + 1));
  });
});
