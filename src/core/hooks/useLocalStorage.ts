import { useCallback, useState } from 'react';

/** localStorage 同步的 state，读写失败时降级为纯内存 */
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
        /* 存储不可用时忽略 */
      }
    },
    [key],
  );

  return [value, setAndPersist] as const;
}
