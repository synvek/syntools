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
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
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

  // 精确或前缀匹配已支持代码（如 pt-br → pt）
  if (isLang(raw)) return raw;
  const primary = raw.split('-')[0] ?? '';
  if (primary === 'zh') {
    // zh-Hant* / zh-TW / zh-HK / zh-MO → 繁体
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
  if (isLang(primary)) return primary;
  return null;
}

/** 按 navigator.languages 优先序检测；全无匹配时返回 English */
export function detectBrowserLang(
  languages: readonly string[] = typeof navigator !== 'undefined'
    ? navigator.languages?.length
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : []
    : [],
): Lang {
  for (const tag of languages) {
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
