import { PROMPTS, type PromptCategory, type PromptItem } from './prompts';

/**
 * AI 提示词筛选（纯函数）。
 */

export function filterPrompts(
  query: string,
  category: PromptCategory | 'all',
  items: PromptItem[] = PROMPTS,
): PromptItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (!q) return true;
    const hay = [
      item.id,
      item.category,
      item.titleZh,
      item.titleEn,
      item.promptZh,
      item.promptEn,
    ]
      .join('\n')
      .toLowerCase();
    return hay.includes(q);
  });
}

export function getPromptText(item: PromptItem, lang: 'zh' | 'en'): string {
  return lang === 'zh' ? item.promptZh : item.promptEn;
}

export function getPromptTitle(item: PromptItem, lang: 'zh' | 'en'): string {
  return lang === 'zh' ? item.titleZh : item.titleEn;
}
