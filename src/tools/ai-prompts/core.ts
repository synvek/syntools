import { normalizeLang } from '@/core/i18n/types';
import { PROMPT_CATEGORIES, PROMPTS } from './data';
import type { LocalizedText, PromptCategoryMeta, PromptItem } from './types';

/**
 * AI 提示词库核心纯函数：多语言回退、跨语言检索、分类聚合。
 *
 * 本模块不依赖 React / i18next 实例（i18n 仅通过 `TranslateFn` 注入），便于测试与复用。
 * 所有函数不抛异常：输入异常时返回空结果而非报错。
 */

/** i18n 翻译函数的最小签名（`t` 的兼容子集） */
export type TranslateFn = (key: string) => string;

/** 「全部分类」哨兵值，与分享链接参数 `c` 保持一致 */
export const ALL_CATEGORY = 'all';

const REGION_SEPARATOR = '-';

/** 每个提示词的小写检索串缓存：数据为静态常量，缓存键即对象本身 */
const ITEM_HAYSTACK = new WeakMap<PromptItem, string>();

function firstFilled(text: LocalizedText, langs: readonly string[]): string | undefined {
  for (const lang of langs) {
    const value = text[lang];
    if (value && value.trim()) return value;
  }
  return undefined;
}

/** 任意非空的可用值（兜底，避免数据异常时返回空串） */
function anyFilled(text: LocalizedText): string | undefined {
  return Object.values(text).find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}

/**
 * 取多语言文本：精确匹配 → 基础语言（`zh-TW` → `zh`）→ `en` → 第一个非空值。
 */
export function pickText(text: LocalizedText, lang: string): string {
  const normalized = normalizeLang(lang);
  const exact = normalized ? firstFilled(text, [normalized]) : undefined;
  if (exact) return exact;

  if (normalized) {
    const base = normalized.split(REGION_SEPARATOR)[0];
    if (base !== normalized) {
      const fromBase = firstFilled(text, [base]);
      if (fromBase) return fromBase;
    }
  }

  return firstFilled(text, ['en']) ?? anyFilled(text) ?? '';
}

/**
 * 取分类显示名，四段回退：
 * 数据中该语种 → i18n 既有译文 → 数据中基础语言 → 数据中 `en`。
 *
 * i18n 兜底可复用 9 个 locale 中历史分类的既有译名；
 * `t()` 在缺少键时会原样返回键名，此类结果视为未命中。
 */
export function pickCategoryName(
  meta: PromptCategoryMeta,
  lang: string,
  translate?: TranslateFn,
): string {
  const normalized = normalizeLang(lang);
  const exact = normalized ? firstFilled(meta.name, [normalized]) : undefined;
  if (exact) return exact;

  if (translate) {
    const translated = translate(meta.i18nKey);
    if (translated && translated !== meta.i18nKey) return translated;
  }

  if (normalized) {
    const base = normalized.split(REGION_SEPARATOR)[0];
    if (base !== normalized) {
      const fromBase = firstFilled(meta.name, [base]);
      if (fromBase) return fromBase;
    }
  }

  return meta.name.en;
}

/** 按 `order` 升序排列分类（不修改入参） */
export function sortCategories(categories: readonly PromptCategoryMeta[]): PromptCategoryMeta[] {
  return [...categories].sort((a, b) => a.order - b.order);
}

/** 统计各分类的提示词条数 */
export function countByCategory(items: readonly PromptItem[] = PROMPTS): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

function itemHaystack(item: PromptItem): string {
  const cached = ITEM_HAYSTACK.get(item);
  if (cached !== undefined) return cached;

  const parts: string[] = [item.id, item.category];
  for (const value of Object.values(item.title)) {
    if (typeof value === 'string') parts.push(value);
  }
  for (const value of Object.values(item.prompt)) {
    if (typeof value === 'string') parts.push(value);
  }

  const haystack = parts.join('\n').toLowerCase();
  ITEM_HAYSTACK.set(item, haystack);
  return haystack;
}

/** 分类维度的检索串（分类 id、i18n 键与各语言名称），分类数量固定且很小，按次构建即可 */
function categoryHaystack(categories: readonly PromptCategoryMeta[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const meta of categories) {
    const names = Object.values(meta.name).filter(
      (value): value is string => typeof value === 'string',
    );
    map.set(meta.id, [meta.id, meta.i18nKey, ...names].join('\n').toLowerCase());
  }
  return map;
}

/**
 * 按分类与关键词筛选提示词。
 *
 * - `category` 为 `ALL_CATEGORY` 时不过滤分类；
 * - 关键词匹配与语言无关，可命中任意语种的标题、正文、分类名与 id；
 * - 复杂度 O(N)，N 为提示词总数（数百条量级，微秒级）。
 */
export function filterPrompts(
  query: string,
  category: string = ALL_CATEGORY,
  items: readonly PromptItem[] = PROMPTS,
  categories: readonly PromptCategoryMeta[] = PROMPT_CATEGORIES,
): PromptItem[] {
  const keyword = query.trim().toLowerCase();
  const categoryIndex = keyword ? categoryHaystack(categories) : null;

  return items.filter((item) => {
    if (category !== ALL_CATEGORY && item.category !== category) return false;
    if (!keyword || !categoryIndex) return true;
    if (itemHaystack(item).includes(keyword)) return true;
    return categoryIndex.get(item.category)?.includes(keyword) ?? false;
  });
}
