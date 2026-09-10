import zh from '@/core/i18n/locales/zh';

/** 已支持的语言代码（扩展新语言时在此与 LANG_META / loaders 同步追加） */
export const LANGS = [
  'zh',
  'zh-TW',
  'en',
  'ja',
  'fr',
  'de',
  'it',
  'es',
  'pt',
] as const;

export type Lang = (typeof LANGS)[number];

/** 可同步打进首屏的语言（其余按需懒加载） */
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

/** 归一化为规范 Lang 码（如 zh-tw → zh-TW） */
export function normalizeLang(value: string): Lang | null {
  const lower = value.trim().toLowerCase();
  const found = LANGS.find((l) => l.toLowerCase() === lower);
  return found ?? null;
}

export function isSyncLang(lang: Lang): boolean {
  return (SYNC_LANGS as readonly string[]).includes(lang);
}

/**
 * 将 BCP 47 / navigator 语言标签映射到应用 Lang。
 * 繁体（Hant / TW / HK / MO）→ zh-TW；简体及其他 zh* → zh；无匹配返回 null。
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

/** 收集检测用的 locale 列表：系统区域优先，再浏览器语言偏好 */
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
 * 按 locale 列表优先序检测；全无匹配时返回 English。
 * 系统区域（Intl）排在浏览器 UI 语言之前，避免「中文系统 + 英文 Chrome」误选 English。
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

/** 将翻译对象的所有字符串叶子节点宽化为 string，便于各语言文件独立维护 */
type DeepStringRecord<T> = T extends string
  ? string
  : T extends readonly string[]
    ? string[]
    : T extends object
      ? { [K in keyof T]: DeepStringRecord<T[K]> }
      : T;

/** 翻译资源结构（以 zh 的键结构为 schema 源） */
export type TranslationResources = DeepStringRecord<typeof zh>;

/** 新增语言文件时使用：const xx = { ... } satisfies TranslationResources */
export type LocaleResource = TranslationResources;
