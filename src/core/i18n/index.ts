import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { localeResources } from '@/core/i18n/locales';
import type { Lang } from '@/core/i18n/types';

export type { Lang } from '@/core/i18n/types';

const SETTINGS_KEY = 'syntools:settings.v1';

export function readStoredLang(): Lang {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const lang = raw ? JSON.parse(raw).lang : undefined;
    return lang === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

// 资源内联，初始化即同步可用（无加载态、无网络请求，符合零数据外发）
void i18n.use(initReactI18next).init({
  resources: localeResources,
  lng: readStoredLang(),
  fallbackLng: 'zh',
  interpolation: { escapeValue: false }, // React 默认转义
});

export { i18n };
