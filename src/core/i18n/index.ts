import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { ensureLangLoaded, localeResources } from '@/core/i18n/locales';
import { isLang, type Lang } from '@/core/i18n/types';

export type { Lang } from '@/core/i18n/types';
export { LANGS, LANG_META, isLang } from '@/core/i18n/types';
export { ensureLangLoaded } from '@/core/i18n/locales';

const SETTINGS_KEY = 'syntools:settings.v1';

export function readStoredLang(): Lang {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const lang = raw ? JSON.parse(raw).lang : undefined;
    return isLang(lang) ? lang : 'zh';
  } catch {
    return 'zh';
  }
}

const storedLang = readStoredLang();
/** 懒加载语言启动时先用 zh，避免首屏等待 chunk */
const initialLng: Lang = storedLang === 'zh' || storedLang === 'en' ? storedLang : 'zh';

void i18n.use(initReactI18next).init({
  resources: localeResources,
  lng: initialLng,
  fallbackLng: ['en', 'zh'],
  interpolation: { escapeValue: false },
  partialBundledLanguages: true,
});

/** 切换语言：先确保资源已加载，再 changeLanguage */
export async function changeAppLanguage(lang: Lang): Promise<void> {
  await ensureLangLoaded(lang, (lng, ns, resources) => {
    i18n.addResourceBundle(lng, ns, resources, true, true);
  });
  await i18n.changeLanguage(lang);
}

// 若用户上次选择的是懒加载语言，启动后再异步切过去
if (storedLang !== initialLng) {
  void changeAppLanguage(storedLang);
}

export { i18n };
