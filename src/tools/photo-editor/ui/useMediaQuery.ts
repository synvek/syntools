import { useEffect, useState } from 'react';

/**
 * 订阅媒体查询（SSR / 无 matchMedia 环境下降级为 false）。
 * 与 flowchart-editor 同约定：窄屏断点对齐 Tailwind `lg`。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    // 同时听 resize：部分嵌入浏览器 / 设备模拟改视口时不一定派发 MediaQueryList change
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mql.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, [query]);

  return matches;
}

/** 窄屏：三栏改为纵向堆叠，避免画布被挤成一条缝 */
export const NARROW_QUERY = '(max-width: 1023px)';
