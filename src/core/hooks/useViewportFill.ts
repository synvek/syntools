import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface ViewportFillOptions {
  /** 首屏不足时的兜底高度（px）：宁可让页面滚动，也不把工作区压扁 */
  min: number;
  /**
   * 额外的重算信号：工作区节点是条件渲染（例如切换视图后才挂载）时，
   * 用当前视图标识触发一次重算。
   */
  signature?: string;
}

/**
 * 工作区「撑满首屏」高度：让工具工作区正好用掉视口剩余空间。
 *
 * 返回高度 = 视口高度 − 工作区顶部偏移 − 工作区下方仍在文档流里的内容
 * （底部状态栏、查找条等）。因此底部状态栏刚好留在首屏内，更下面的「相关工具」
 * 被推到首屏之外：默认不可见（工作区拿到最大高度），向下滚动即可看到相关工具。
 *
 * 不用 `calc(100vh - Npx)` 常量：工作区上方的行数会随提示条 / 面板开合变化，
 * 写死常量要么把底部内容挤出首屏，要么在工作区下方留出一条空白带。
 *
 * 各工具根节点需标记 `data-tool-root`，用来界定「工作区下方」的边界 ——
 * 越过它之后的「相关工具」属于页面内容，不参与预留。
 */
export function useViewportFill(
  ref: RefObject<HTMLElement | null>,
  { min, signature = '' }: ViewportFillOptions,
): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = el.closest<HTMLElement>('[data-tool-root]');

    const compute = () => {
      // 文档内偏移用 offsetTop 链：不受当前滚动位置影响，滚动时高度不抖动
      let top = 0;
      let node: HTMLElement | null = el;
      while (node) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }

      // 工作区之后、仍在文档流里的兄弟内容要留在首屏内；弹层（fixed / absolute）不算
      const rect = el.getBoundingClientRect();
      let below = rect.bottom;
      let cursor: HTMLElement | null = el;
      while (cursor && cursor !== root && cursor !== document.body) {
        let sibling = cursor.nextElementSibling as HTMLElement | null;
        while (sibling) {
          const position = getComputedStyle(sibling).position;
          if (position !== 'fixed' && position !== 'absolute') {
            below = Math.max(below, sibling.getBoundingClientRect().bottom);
          }
          sibling = sibling.nextElementSibling as HTMLElement | null;
        }
        cursor = cursor.parentElement;
      }

      const reserved = Math.max(0, below - rect.bottom);
      // 向下取整：宁可少 1px，也不让底部状态栏探出首屏
      const available = window.innerHeight - top - reserved;
      setHeight(Math.max(min, Math.floor(available)));
    };

    compute();
    const observer = new ResizeObserver(compute);
    if (el.parentElement) observer.observe(el.parentElement);
    // 工作区上方的提示条 / 面板开合会改变页面偏移，但不会改变父元素尺寸，故连根节点一起观察
    if (root && root !== el.parentElement) observer.observe(root);
    window.addEventListener('resize', compute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [ref, min, signature]);

  return height;
}
