import { useEffect, useState } from 'react';

/**
 * 窄屏判定（P2-8）。
 *
 * 为什么不用 CSS 媒体查询：移动端要做的三件事——收起对象浮层、把画布高度上限从 460 降到 320、
 * 换一条底部工具条——两件是 DOM 结构决定的（少渲染一层浮层 = 少一层挡触摸的 `absolute` 节点），
 * 纯 CSS 只能"看不见"，挡不住点击。所以这里给 React 一个布尔值，CSS 只管视觉。
 *
 * 768px 与 `sheet.css` 里既有的断点一致；Ribbon 自带的自动折叠是 640px（`useRibbonCollapse`），
 * 两者不冲突：640–768 之间是"Ribbon 已折叠 + 底部工具条仍在"，属于过渡带。
 */
export const NARROW_VIEWPORT_QUERY = '(max-width: 768px)';

function queryMatches(query: string): boolean {
  // SSR / 预渲染 / 老环境：没有 matchMedia 就当宽屏（宁可多渲染，也不要一上来就砍功能）
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

export function useNarrowViewport(query: string = NARROW_VIEWPORT_QUERY): boolean {
  const [narrow, setNarrow] = useState(() => queryMatches(query));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const update = () => setNarrow(list.matches);
    // 先同步一次：窗口在首帧之后立刻变化（平板旋转）时，state 不能停在初始值上
    update();
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', update);
      return () => list.removeEventListener('change', update);
    }
    // Safari < 14 只有 addListener / removeListener
    list.addListener?.(update);
    return () => list.removeListener?.(update);
  }, [query]);

  return narrow;
}
