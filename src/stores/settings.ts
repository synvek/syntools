import { create } from 'zustand';
import { changeAppLanguage, readStoredLang, type Lang } from '@/core/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';

const SETTINGS_KEY = 'syntools:settings.v1';

function persist(theme: ThemeMode, lang: Lang) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme, lang }));
}

function readStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const theme = raw ? (JSON.parse(raw).theme as ThemeMode) : 'system';
    return theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
  } catch {
    return 'system';
  }
}

/** 与 index.html 内联脚本保持一致的主题应用逻辑（技术设计 §6.3） */
export function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

interface SettingsState {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  /** 按当前实际明暗状态取反 */
  toggleTheme: () => void;
  lang: Lang;
  setLang: (lang: Lang) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    persist(theme, get().lang);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const isDark = document.documentElement.classList.contains('dark');
    get().setTheme(isDark ? 'light' : 'dark');
  },
  lang: readStoredLang(),
  setLang: async (lang) => {
    persist(get().theme, lang);
    await changeAppLanguage(lang);
    set({ lang });
  },
}));

// system 模式下跟随系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useSettingsStore.getState().theme === 'system') applyTheme('system');
});
