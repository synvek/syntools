import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

interface ViewportFillOptions {
  /** Fallback height (px) when the first screen is short: let the page scroll rather than squash the workspace */
  min: number;
  /**
   * Extra recompute trigger: when the workspace node renders conditionally (mounted only after a view switch),
   * pass the active view id to force one recompute.
   */
  signature?: string;
}

/**
 * Workspace "fill the first screen" height, so a tool workspace uses exactly the leftover viewport space.
 *
 * Height = viewport height − workspace top offset − in-flow content below the workspace
 * (bottom status bar, find bar, etc.). The status bar therefore stays on the first screen while
 * "related tools" below is pushed off-screen: hidden by default (the workspace gets max height), reachable by scrolling.
 *
 * No `calc(100vh - Npx)` constant: rows above the workspace change as banners / panels open,
 * and a fixed constant either pushes the footer off-screen or leaves a blank band below.
 *
 * Each tool root must carry `data-tool-root` to mark the "below the workspace" boundary —
 * anything past it (related tools) is page content and gets no reservation.
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
      // Measure offsets via the offsetTop chain: independent of scroll, so the height does not jitter
      let top = 0;
      let node: HTMLElement | null = el;
      while (node) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }

      // In-flow siblings after the workspace stay on the first screen; overlays (fixed / absolute) do not count
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
      // Round down: give up a pixel rather than let the status bar slip below the fold
      const available = window.innerHeight - top - reserved;
      setHeight(Math.max(min, Math.floor(available)));
    };

    compute();
    const observer = new ResizeObserver(compute);
    if (el.parentElement) observer.observe(el.parentElement);
    // Banners / panels above shift the page offset without resizing the parent, so observe the root too
    if (root && root !== el.parentElement) observer.observe(root);
    window.addEventListener('resize', compute);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [ref, min, signature]);

  return height;
}
