import { useEffect, useState } from 'react';

/** 防抖值：输入变化后延迟 delay 毫秒才更新返回值（默认 150ms，技术设计 §8.2） */
export function useDebouncedValue<T>(value: T, delay = 150): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
