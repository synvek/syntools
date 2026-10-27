import { useCallback, useState } from 'react';

/** State synced to localStorage, degrading to memory when reads or writes fail */
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setAndPersist = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Ignore when storage is unavailable */
      }
    },
    [key],
  );

  return [value, setAndPersist] as const;
}
