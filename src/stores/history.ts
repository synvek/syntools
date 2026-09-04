import { create } from 'zustand';

const HISTORY_KEY = 'syntools:history.v1';
const FAVORITES_KEY = 'syntools:favorites.v1';
const RECENT_LIMIT = 8;

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

interface HistoryState {
  /** 最近使用的工具 id，最新在前，上限 8 */
  recent: string[];
  favorites: string[];
  recordUse: (id: string) => void;
  toggleFavorite: (id: string) => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  recent: readIds(HISTORY_KEY),
  favorites: readIds(FAVORITES_KEY),
  recordUse: (id) => {
    const recent = [id, ...get().recent.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
    writeIds(HISTORY_KEY, recent);
    set({ recent });
  },
  toggleFavorite: (id) => {
    const current = get().favorites;
    const favorites = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    writeIds(FAVORITES_KEY, favorites);
    set({ favorites });
  },
}));
