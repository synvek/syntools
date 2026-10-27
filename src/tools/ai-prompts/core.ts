import { normalizeLang } from '@/core/i18n/types';
import { PROMPT_CATEGORIES, PROMPTS } from './data';
import type { LocalizedText, PromptCategoryMeta, PromptItem } from './types';

/**
 * Core pure functions for the AI prompt library: locale fallback, cross-language search, category aggregation.
 *
 * This module depends on neither React nor an i18next instance (i18n is injected via `TranslateFn`), which keeps it testable and reusable.
 * No function throws: invalid input yields an empty result instead of an error.
 */

/** Minimal signature of an i18n translate function (a compatible subset of `t`) */
export type TranslateFn = (key: string) => string;

/** Sentinel value for "all categories", kept in sync with the `c` share-link param */
export const ALL_CATEGORY = 'all';

const REGION_SEPARATOR = '-';

/** Per-prompt lowercase haystack cache: data is static, so the object itself is the key */
const ITEM_HAYSTACK = new WeakMap<PromptItem, string>();

function firstFilled(text: LocalizedText, langs: readonly string[]): string | undefined {
  for (const lang of langs) {
    const value = text[lang];
    if (value && value.trim()) return value;
  }
  return undefined;
}

/** Any non-empty usable value (fallback so malformed data never yields an empty string) */
function anyFilled(text: LocalizedText): string | undefined {
  return Object.values(text).find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}

/**
 * Resolve localized text: exact match → base language (`zh-TW` → `zh`) → `en` → first non-empty value.
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
 * Resolve a category display name with a four-step fallback:
 * that locale in the data → existing i18n translation → base language in the data → `en` in the data.
 *
 * The i18n fallback reuses translations of legacy categories already present in all 9 locales;
 * `t()` returns the key verbatim when a key is missing, so such results count as a miss.
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

/** Sort categories by ascending `order` (does not mutate the input) */
export function sortCategories(categories: readonly PromptCategoryMeta[]): PromptCategoryMeta[] {
  return [...categories].sort((a, b) => a.order - b.order);
}

/** Count prompts per category */
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

/** Category haystack (id, i18n key, and names in every language); the category list is small and fixed, so rebuilding it per call is fine */
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
 * Filter prompts by category and keyword.
 *
 * - `category === ALL_CATEGORY` disables category filtering;
 * - Keyword matching is language-agnostic: it hits titles, bodies, category names, and ids in any language;
 * - Complexity is O(N), where N is the total prompt count (a few hundred, i.e. microseconds).
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
