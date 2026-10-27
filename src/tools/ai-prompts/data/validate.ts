import type { PromptCategoryMeta, PromptItem } from '../types';

/**
 * Prompt data consistency checks (pure functions, no side effects).
 *
 * Serves two call sites:
 * - Development: `./index.ts` asserts at module load so bad data fails fast;
 * - Tests: `../data.test.ts` asserts an empty array is returned.
 */

export interface ValidateOptions {
  /**
   * Minimum number of prompts required per category.
   * Defaults to 0 so a new category can start with an empty file and fill in gradually;
   * Tests pass 10 to enforce the content baseline.
   */
  minPerCategory?: number;
}

/** kebab-case: lowercase letters/digits, single hyphen between words */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Languages required at compile time */
const REQUIRED_LANGS: readonly string[] = ['zh', 'en'];

export function validatePromptData(
  prompts: readonly PromptItem[],
  categories: readonly PromptCategoryMeta[],
  options: ValidateOptions = {},
): string[] {
  const issues: string[] = [];
  const minPerCategory = options.minPerCategory ?? 0;

  if (categories.length === 0) issues.push('分类清单为空');

  const categoryIds = new Set<string>();
  const orderOwners = new Map<number, string>();

  for (const meta of categories) {
    if (!KEBAB_CASE.test(meta.id)) issues.push(`分类 id 非法（需 kebab-case）：${meta.id}`);
    if (categoryIds.has(meta.id)) issues.push(`分类 id 重复：${meta.id}`);
    categoryIds.add(meta.id);

    const owner = orderOwners.get(meta.order);
    if (owner) issues.push(`分类 order 重复：${meta.order} 同时用于 ${owner} 与 ${meta.id}`);
    else orderOwners.set(meta.order, meta.id);

    for (const lang of REQUIRED_LANGS) {
      if (!meta.name[lang]?.trim()) issues.push(`分类缺少 ${lang} 名称：${meta.id}`);
    }
    if (meta.i18nKey !== `tools.aiPrompts.cat.${meta.id}`) {
      issues.push(`分类 i18nKey 不符合约定（应为 tools.aiPrompts.cat.${meta.id}）：${meta.id}`);
    }
  }

  const promptIds = new Set<string>();
  const countByCategory = new Map<string, number>();

  prompts.forEach((item, index) => {
    const where = `第 ${index + 1} 条 ${item.id || '(缺少 id)'}`;

    if (!KEBAB_CASE.test(item.id)) issues.push(`提示词 id 非法（需 kebab-case）：${where}`);
    if (promptIds.has(item.id)) issues.push(`提示词 id 重复：${item.id}`);
    promptIds.add(item.id);

    if (!categoryIds.has(item.category)) {
      issues.push(`提示词分类不存在：${where} -> ${item.category}`);
    } else if (!item.id.startsWith(`${item.category}-`)) {
      issues.push(`提示词 id 未以分类前缀开头：${where}（应为 ${item.category}-...）`);
    }
    countByCategory.set(item.category, (countByCategory.get(item.category) ?? 0) + 1);

    for (const lang of REQUIRED_LANGS) {
      if (!item.title[lang]?.trim()) issues.push(`缺少 ${lang} 标题：${where}`);
      if (!item.prompt[lang]?.trim()) issues.push(`缺少 ${lang} 正文：${where}`);
    }
  });

  if (minPerCategory > 0) {
    for (const meta of categories) {
      const count = countByCategory.get(meta.id) ?? 0;
      if (count < minPerCategory) {
        issues.push(`分类条数不足：${meta.id} 仅 ${count} 条，要求至少 ${minPerCategory} 条`);
      }
    }
  }

  return issues;
}
