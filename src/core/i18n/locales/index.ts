import en from '@/core/i18n/locales/en';
import zh from '@/core/i18n/locales/zh';
import type { Lang } from '@/core/i18n/types';

/**
 * 所有已注册语言的翻译资源。
 * 扩展新语言：在 locales/ 下新增文件并在 localeResources 中注册即可。
 */
export const localeResources: Record<Lang, { translation: typeof zh }> = {
  zh: { translation: zh },
  en: { translation: en },
};

export { en, zh };
