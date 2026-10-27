# Prompt Data Maintenance Guide

This directory is the data source for the "AI Prompt Library" tool, **fully separated from the code**: adding or editing prompts only means editing the data files here — no UI code changes required.

## File Structure

| Path              | Purpose                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| `categories.ts`   | The 28-category list (id / display order / localized names / i18n fallback key) |
| `prompts/<id>.ts` | One file per category, exporting that category's array of prompts               |
| `index.ts`        | Aggregates all data into `PROMPTS` and runs consistency checks in development   |
| `validate.ts`     | Validation rules (pure functions), shared by dev-time assertions and unit tests |
| `../types.ts`     | Type definitions (`PromptItem` / `LocalizedText`, etc.)                         |
| `../data.test.ts` | Data integrity tests (counts, unique ids, non-empty zh/en values, …)            |

## Data Format

Example from `prompts/writing.ts`:

```ts
import type { PromptItem } from '../../types';

export const PROMPTS: PromptItem[] = [
  {
    id: 'writing-blog-outline',
    category: 'writing',
    title: { zh: '博客大纲', en: 'Blog outline' },
    prompt: {
      zh: '请围绕主题「{{topic}}」写一篇面向普通读者的博客大纲……',
      en: 'Create a blog outline on "{{topic}}" for general readers……',
    },
  },
];
```

Field reference:

| Field      | Required | Description                                                                                      |
| ---------- | -------- | ------------------------------------------------------------------------------------------------ |
| `id`       | yes      | Globally unique, kebab-case, and must start with `category-`, e.g. `coding-code-review`          |
| `category` | yes      | Must exist in `categories.ts`                                                                    |
| `title`    | yes      | Localized title; `zh` / `en` are required                                                        |
| `prompt`   | yes      | Localized body; `zh` / `en` are required. Use `{{variable}}` placeholders for user-supplied text |

> `zh` and `en` are enforced by TypeScript at compile time; a missing one fails `pnpm typecheck`.

## Adding a Prompt

1. Open the matching category file `prompts/<category>.ts` and append an entry to the array;
2. Make `id` `<category>-<short-english-description>` and keep it globally unique;
3. Fill in both the Chinese and English title and body;
4. Run the checks:

   ```bash
   pnpm test && pnpm typecheck
   ```

## Adding a Category

1. Append an entry to `PROMPT_CATEGORIES` in `categories.ts` (`order` = current max + 1, `i18nKey` is always `tools.aiPrompts.cat.<id>`);
2. Create `prompts/<id>.ts` exporting `PROMPTS: PromptItem[]`;
3. Add the import at the top of `index.ts` (aliased as `PROMPTS as XXX_PROMPTS`) and add it to the `PROMPTS` array;
4. Aim for at least 10 prompts per category.

## Adding a Language

1. Add the language key to `title` / `prompt` in `prompts/<category>.ts` (optional; a missing entry does not break compilation);
2. Add that language's `name` in `categories.ts`;
3. Language codes are defined by `Lang` in `@/core/i18n/types` (`zh` / `zh-TW` / `en` / `ja` / `fr` / `de` / `it` / `es` / `pt`).

## Fallback Rules

**Titles and bodies**: exact match → base language (`zh-TW` → `zh`) → `en` → the first non-empty value.

**Category names**: the language's entry in the data → an existing i18n translation `tools.aiPrompts.cat.<id>` → the base language in the data → `en` in the data.

> Of the 28 categories, six legacy ones — `writing` / `coding` / `translate` / `marketing` / `learning` / `career` — already have names in all 9 locale files and are reused automatically; the rest currently fall back to English in other languages and take effect as soon as a `name` is added.

## Validation Rules

`validate.ts` checks the following; any failure throws a readable error in development and fails `../data.test.ts`:

- Categories: `id` valid and unique, `order` unique, `i18nKey` follows the convention, Chinese and English names non-empty;
- Prompts: `id` valid and globally unique, `id` prefixed with its category, `category` exists, Chinese and English title and body non-empty;
- Content floor (test assertion only): at least 10 prompts per category.

## Notes

- Medical, legal and financial prompts must state in their body that the output is for reference only and does not constitute professional advice;
- Do not introduce React or UI dependencies into this directory — the data layer stays pure so it can later be exported or fed into a translation pipeline;
- Do not edit `src/core/i18n/locales/*.ts` by hand: those files are governed by the i18n system, and this directory cooperates through category `name` plus the i18n fallback key without touching locale files.
