import type { Lang } from '@/core/i18n/types';

/**
 * Core types for the AI prompt library.
 *
 * Design notes:
 * - `zh` / `en` are required (enforced at compile time); other locales are optional and resolved through the fallback chain;
 * - Locale keys accept any string, so locales can be added incrementally without touching the types;
 * - See `./data/README.md` for the data spec and contribution flow.
 */

/** Localized text: zh / en required, other locales added as needed */
export type LocalizedText = {
  zh: string;
  en: string;
} & Partial<Record<Lang, string>> & {
    [lang: string]: string | undefined;
  };

/** A single prompt */
export interface PromptItem {
  /** Globally unique; by convention `<category>-<slug>` (kebab-case) */
  id: string;
  /** Owning category id; must exist in `PROMPT_CATEGORIES` */
  category: string;
  /** Localized title */
  title: LocalizedText;
  /** Localized body; may contain `{{variable}}` placeholders */
  prompt: LocalizedText;
}

/** Category metadata */
export interface PromptCategoryMeta {
  /** Category id, kebab-case; also used as the prompt id prefix */
  id: string;
  /** Display order, unique across all categories (1-based) */
  order: number;
  /** Localized category name */
  name: LocalizedText;
  /** i18n fallback key, always `tools.aiPrompts.cat.<id>` */
  i18nKey: string;
}
