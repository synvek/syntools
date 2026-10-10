import { useEffect, useState } from 'react';

/**
 * 订阅媒体查询（SSR / 无 matchMedia 环境下降级为 false）。
 * 用于窄屏抽屉布局与触控相关的响应式分支。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** 触控 / 手写笔等粗指针设备：放大命中区域、启用触控手势 */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** 窄屏断点（与 Tailwind 的 lg 对齐）：三栏改为抽屉 */
export const NARROW_QUERY = '(max-width: 1023px)';
