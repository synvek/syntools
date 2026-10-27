import { create } from 'zustand';
import { changeAppLanguage, resolveBootLang, type Lang } from '@/core/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';

const SETTINGS_KEY = 'syntools:settings.v1';

type SettingsBlob = {
  theme?: ThemeMode;
  lang?: Lang;
  /** Whether the user picked a language in the UI (otherwise detect from system/browser each time) */
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

/** Theme application kept in sync with the inline script in index.html (tech design §6.3) */
export function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

interface SettingsState {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  /** Flip the actual current light/dark state */
  toggleTheme: () => void;
  lang: Lang;
  setLang: (lang: Lang) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    // Write theme only; never mark the detected language as a user choice
    writeSettingsBlob({ theme });
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const isDark = document.documentElement.classList.contains('dark');
    get().setTheme(isDark ? 'light' : 'dark');
  },
  lang: resolveBootLang(),
  setLang: async (lang) => {
    // Write langExplicit only: a path prefix must not be persisted as a user choice,
    // or visitors entering from /zh/ stay pinned to Chinese and later visits to / do nothing
    writeSettingsBlob({ theme: get().theme, lang, langExplicit: true });
    await changeAppLanguage(lang);
    set({ lang });
  },
}));

// In system mode, follow OS theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useSettingsStore.getState().theme === 'system') applyTheme('system');
});
