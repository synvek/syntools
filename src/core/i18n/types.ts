/**
 * Types only: no runtime imports.
 *
 * Locale resources are deliberately split in two:
 * - `locales/<lang>`: shell (nav / home / search / errors) + `toolsMeta.*`, in the first-load bundle;
 * - `locales/<lang>.tools`: per-tool UI copy `tools.*`, loaded on demand with tool pages.
 * Together they form the full resource, hence the intersection type.
 */
import type zh from '@/core/i18n/locales/zh';
import type zhTools from '@/core/i18n/locales/zh.tools';

/** Supported language codes (add new ones here together with LANG_META / loaders) */
export const LANGS = ['zh', 'zh-TW', 'en', 'ja', 'fr', 'de', 'it', 'es', 'pt'] as const;

export type Lang = (typeof LANGS)[number];

/** Languages bundled into the first load (the rest are lazy-loaded) */
export const SYNC_LANGS = ['zh', 'en'] as const satisfies readonly Lang[];

export const LANG_META: Record<Lang, { nativeLabel: string }> = {
  zh: { nativeLabel: '简体中文' },
  'zh-TW': { nativeLabel: '繁體中文' },
  en: { nativeLabel: 'English' },
  ja: { nativeLabel: '日本語' },
  fr: { nativeLabel: 'Français' },
  de: { nativeLabel: 'Deutsch' },
  it: { nativeLabel: 'Italiano' },
  es: { nativeLabel: 'Español' },
  pt: { nativeLabel: 'Português' },
};

export function isLang(value: unknown): value is Lang {
  if (typeof value !== 'string') return false;
  return (LANGS as readonly string[]).some((l) => l.toLowerCase() === value.toLowerCase());
}

/** Normalize to a canonical Lang code (e.g. zh-tw → zh-TW) */
export function normalizeLang(value: string): Lang | null {
  const lower = value.trim().toLowerCase();
  const found = LANGS.find((l) => l.toLowerCase() === lower);
  return found ?? null;
}

export function isSyncLang(lang: Lang): boolean {
  return (SYNC_LANGS as readonly string[]).includes(lang);
}

/**
 * Map a BCP 47 / navigator language tag to an app Lang.
 * Traditional (Hant / TW / HK / MO) → zh-TW; Simplified and other zh* → zh; no match → null.
 */
export function mapBrowserLocale(tag: string): Lang | null {
  const raw = tag.trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return null;

  const exact = normalizeLang(raw);
  if (exact) return exact;

  const primary = raw.split('-')[0] ?? '';
  if (primary === 'zh') {
    if (
      raw.includes('hant') ||
      raw.endsWith('-tw') ||
      raw.endsWith('-hk') ||
      raw.endsWith('-mo') ||
      raw.includes('-tw-') ||
      raw.includes('-hk-') ||
      raw.includes('-mo-')
    ) {
      return 'zh-TW';
    }
    return 'zh';
  }
  return normalizeLang(primary);
}

/** Collect locales for detection: system locale first, then browser preferences */
export function collectBrowserLocales(
  languages?: readonly string[],
  systemLocale?: string | null,
): string[] {
  const out: string[] = [];
  const push = (tag: string | null | undefined) => {
    if (!tag) return;
    const t = tag.trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  };

  if (systemLocale !== undefined) {
    push(systemLocale);
  } else {
    try {
      push(Intl.DateTimeFormat().resolvedOptions().locale);
    } catch {
      // ignore
    }
  }

  if (languages !== undefined) {
    for (const tag of languages) push(tag);
  } else if (typeof navigator !== 'undefined') {
    if (navigator.languages?.length) {
      for (const tag of navigator.languages) push(tag);
    } else {
      push(navigator.language);
    }
  }

  return out;
}

/**
 * Detect in locale order; English when nothing matches.
 * The system locale (Intl) precedes the browser UI language, so "Chinese system + English Chrome" is not read as English.
 */
export function detectBrowserLang(
  languages?: readonly string[],
  systemLocale?: string | null,
): Lang {
  for (const tag of collectBrowserLocales(languages, systemLocale)) {
    const mapped = mapBrowserLocale(tag);
    if (mapped) return mapped;
  }
  return 'en';
}

/** Widen every string leaf to string so locale files can be maintained independently */
type DeepStringRecord<T> = T extends string
  ? string
  : T extends readonly string[]
    ? string[]
    : T extends object
      ? { [K in keyof T]: DeepStringRecord<T[K]> }
      : T;

/** Shell resource shape (schema taken from zh's keys): nav / home / search / tool metadata */
export type ShellResources = DeepStringRecord<typeof zh>;

/** Tool UI copy shape (schema taken from zh.tools' keys): `tools.*` */
export type ToolStringsResources = DeepStringRecord<typeof zhTools>;

/** Full resource = shell + tool copy (what i18next sees at runtime) */
export type TranslationResources = ShellResources & ToolStringsResources;

/** For new locale files: const xx = { ... } satisfies ShellResources / ToolStringsResources */
export type LocaleResource = TranslationResources;
