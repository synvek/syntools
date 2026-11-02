import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject, RefObject } from 'react';

/**
 * Responsive behavior of the ribbon, kept out of the presentation components so it can be reasoned
 * about (and unit tested) separately.
 *
 * Two independent mechanisms, exactly like Office:
 * 1. **Overall collapse** — under `autoCollapseWidth` (or when the user double-clicks a tab) only the
 *    tab strip stays visible and clicking a tab opens a flyout panel.
 * 2. **Progressive group hiding** — before collapsing altogether, the cheapest groups are dropped so
 *    the most important commands stay reachable without horizontal scrolling.
 */

export function useRibbonCollapse({
  autoCollapseWidth = 640,
  collapsed,
  onCollapsedChange,
}: {
  autoCollapseWidth?: number;
  /** Controlled collapse state; omit to let the ribbon own it */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}): {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (next: boolean) => void;
  containerRef: MutableRefObject<HTMLDivElement | null>;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [tooNarrow, setTooNarrow] = useState(false);
  const controlled = collapsed !== undefined;
  const effective = controlled ? collapsed : userCollapsed || tooNarrow;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.getBoundingClientRect().width;
      // jsdom / display:none yields 0 — never collapse on an unmeasurable container
      setTooNarrow(width > 0 && width < autoCollapseWidth);
    };
    measure();
    // jsdom has no ResizeObserver; the window resize listener still covers real browsers' fallback
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [autoCollapseWidth]);

  const setCollapsed = useCallback(
    (next: boolean) => {
      if (!controlled) setUserCollapsed(next);
      onCollapsedChange?.(next);
    },
    [controlled, onCollapsedChange],
  );

  const toggle = useCallback(() => setCollapsed(!effective), [effective, setCollapsed]);

  return { collapsed: effective, toggle, setCollapsed, containerRef };
}

/** Approximate width of the divider + padding between two groups */
const GROUP_GAP_PX = 8;

interface GroupPriority {
  id: string;
  priority?: number;
}

/**
 * Hides the lowest-priority groups until the command panel fits its own width.
 *
 * Widths are measured from the DOM and cached per `tabId:groupId`: hidden groups report 0, so the
 * cache is what makes repeated measurements stable instead of collapsing everything at once.
 */
export function useGroupOverflow({
  panelRef,
  tabId,
  groups,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  tabId: string;
  groups: GroupPriority[];
}): Set<string> {
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const widthsRef = useRef(new Map<string, number>());
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  // Identity of the group list: the arrays themselves are rebuilt on every render
  const groupKey = groups.map((group) => group.id).join(',');

  useEffect(() => {
    setHiddenIds([]);
  }, [tabId, groupKey]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const recompute = () => {
      const available = panel.clientWidth;
      if (!available) return;

      let measured = 0;
      for (const node of Array.from(panel.querySelectorAll<HTMLElement>('[data-ribbon-group]'))) {
        const id = node.dataset.ribbonGroup;
        if (!id || node.dataset.hidden === 'true') continue;
        const width = node.getBoundingClientRect().width;
        if (width > 0) {
          widthsRef.current.set(`${tabId}:${id}`, width);
          measured += 1;
        }
      }
      // Nothing measurable (jsdom / collapsed) — leave the layout alone
      if (measured === 0) return;

      const list = groupsRef.current;
      const known = list.filter((group) => widthsRef.current.has(`${tabId}:${group.id}`));
      if (known.length === 0) return;

      let total = known.reduce(
        (sum, group) => sum + (widthsRef.current.get(`${tabId}:${group.id}`) ?? 0),
        0,
      );
      total += Math.max(0, list.length - 1) * GROUP_GAP_PX;

      const byPriority = [...known].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      const next: string[] = [];
      for (const group of byPriority) {
        if (total <= available) break;
        total -= (widthsRef.current.get(`${tabId}:${group.id}`) ?? 0) + GROUP_GAP_PX;
        next.push(group.id);
      }

      setHiddenIds((current) => (current.join('|') === next.join('|') ? current : next));
    };

    recompute();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(recompute);
    observer?.observe(panel);
    return () => observer?.disconnect();
  }, [panelRef, tabId, groupKey]);

  return new Set(hiddenIds);
}
