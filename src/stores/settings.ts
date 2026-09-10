import { create } from 'zustand';
import { changeAppLanguage, readStoredLang, type Lang } from '@/core/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';

const SETTINGS_KEY = 'syntools:settings.v1';

type SettingsBlob = {
  theme?: ThemeMode;
  lang?: Lang;
  /** 用户是否在 UI 中显式选择过语言（未设置则每次按系统/浏览器检测） */
  langExplicit?: boolean;
};

function readSettingsBlob(): SettingsBlob {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SettingsBlob;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeSettingsBlob(patch: SettingsBlob) {
  const prev = readSettingsBlob();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...prev, ...patch }));
}

function readStoredTheme(): ThemeMode {
  const theme = readSettingsBlob().theme;
  return theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system';
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
    // 只写 theme，不把当前检测语言误标为「用户选择」
    writeSettingsBlob({ theme });
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const isDark = document.documentElement.classList.contains('dark');
    get().setTheme(isDark ? 'light' : 'dark');
  },
  lang: readStoredLang(),
  setLang: async (lang) => {
    writeSettingsBlob({ theme: get().theme, lang, langExplicit: true });
    await changeAppLanguage(lang);
    set({ lang });
  },
}));

// system 模式下跟随系统主题变化
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useSettingsStore.getState().theme === 'system') applyTheme('system');
});
