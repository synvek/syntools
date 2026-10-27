import { useEffect, useState } from 'react';

/** Debounced value: updates delay ms after the input changes (default 150ms, tech design §8.2) */
export function useDebouncedValue<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
