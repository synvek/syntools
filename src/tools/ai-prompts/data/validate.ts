import type { PromptCategoryMeta, PromptItem } from '../types';

/**
 * 提示词数据一致性校验（纯函数，无副作用）。
 *
 * 同时服务于两处：
 * - 开发环境：`./index.ts` 在模块加载时断言，脏数据直接快速失败；
 * - 测试：`../data.test.ts` 断言返回空数组。
 */

export interface ValidateOptions {
  /**
   * 每个分类要求的最少条数。
   * 默认 0 —— 允许新增分类先建空文件，逐步补齐内容；
   * 测试中传入 10 以守住内容底线。
   */
  minPerCategory?: number;
}

/** kebab-case：小写字母/数字，单词间单连字符 */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 编译期必填的语种 */
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
