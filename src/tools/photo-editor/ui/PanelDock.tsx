import { Fragment, useCallback, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { PANEL_GROUPS } from '../panels';
import type { PanelGroupId, PanelId } from '../panels';
import { usePhotoStore } from '../store';

/** Minimum height each panel keeps while dragging a splitter (title bar + one row of content) */
const MIN_PANEL_PX = 84;
/** Nudge step for the ← → keys */
const KEYBOARD_STEP_PX = 24;

/**
 * Panels that need a fixed header with a self-scrolling list.
 *
 * Other panels can scroll as a whole, but the top row of the layers panel (blend-mode dropdown + opacity
 * slider) is the layer list's control strip and must stay visible when scrolling; the panel splits fixed / scrolling areas.
 */
const SELF_SCROLL_PANELS: ReadonlySet<PanelId> = new Set<PanelId>(['layers']);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Panel dock: three fixed panels stacked top to bottom (color / layers / info), each with its own set of sub-tabs.
 *
 * The three panels fill the sidebar height (1/3 each by default) and the splitters between them can be dragged;
 * panels no longer scroll as a whole — only their content area scrolls — so the sidebar never gets one crowded scrollbar.
 * Each panel remembers only its own selected sub-tab (switching away and back restores it).
 */
export function PanelDock({ content }: { content: Record<PanelId, ReactNode> }) {
  const { t } = useTranslation();
  const panels = usePhotoStore((s) => s.panels);
  const setPanelTab = usePhotoStore((s) => s.setPanelTab);

  // Height weights (flex-grow): 1/1/1 by default; dragging a splitter only changes the ratio of the two neighbours
  const [sizes, setSizes] = useState<number[]>(() => PANEL_GROUPS.map(() => 1));
  const [dragging, setDragging] = useState(false);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const drag = useRef<{ index: number; startY: number; startA: number; pairPx: number } | null>(
    null,
  );

  const groupLabels: Record<PanelGroupId, string> = {
    color: t('tools.photo.tabGroupColor'),
    layers: t('tools.photo.tabGroupLayers'),
    info: t('tools.photo.tabGroupInfo'),
  };
  // Titles reuse the existing tab labels so they match the Window menu and the e2e selectors
  const titles: Record<PanelId, string> = {
    color: t('tools.photo.tabColor'),
    layers: t('tools.photo.tabLayers'),
    style: t('tools.photo.tabStyle'),
    text: t('tools.photo.tabText'),
    channels: t('tools.photo.tabChannels'),
    property: t('tools.photo.tabProperty'),
    adjust: t('tools.photo.tabAdjust'),
    filter: t('tools.photo.tabFilter'),
    history: t('tools.photo.tabHistory'),
  };

  /** Turn the heights of two neighbouring panels into weights: their sum is preserved, only the ratio changes */
  const resizePair = useCallback((index: number, aPx: number, pairPx: number) => {
    setSizes((prev) => {
      const total = prev[index] + prev[index + 1];
      const next = [...prev];
      next[index] = (total * aPx) / pairPx;
      next[index + 1] = (total * (pairPx - aPx)) / pairPx;
      return next;
    });
  }, []);

  const measurePair = (index: number) => {
    const first = sectionRefs.current[index]?.getBoundingClientRect().height ?? 0;
    const second = sectionRefs.current[index + 1]?.getBoundingClientRect().height ?? 0;
    return { first, pairPx: first + second };
  };

  const handlePointerDown = (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
    const { first, pairPx } = measurePair(index);
    if (pairPx <= MIN_PANEL_PX * 2) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { index, startY: event.clientY, startA: first, pairPx };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const aPx = clamp(
      state.startA + (event.clientY - state.startY),
      MIN_PANEL_PX,
      state.pairPx - MIN_PANEL_PX,
    );
    resizePair(state.index, aPx, state.pairPx);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (index: number) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const { first, pairPx } = measurePair(index);
    if (pairPx <= MIN_PANEL_PX * 2) return;
    const delta = event.key === 'ArrowUp' ? -KEYBOARD_STEP_PX : KEYBOARD_STEP_PX;
    resizePair(index, clamp(first + delta, MIN_PANEL_PX, pairPx - MIN_PANEL_PX), pairPx);
  };

  return (
    <div
      className={`flex h-full min-h-0 flex-col ${dragging ? 'select-none' : ''}`}
      data-testid="panel-dock"
    >
      {PANEL_GROUPS.map((group, index) => {
        const active = panels.tabs[group.id];
        return (
          <Fragment key={group.id}>
            {index > 0 ? (
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label={t('tools.photo.panelResize')}
                tabIndex={0}
                data-testid={`panel-divider-${index}`}
                onPointerDown={handlePointerDown(index - 1)}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={handleKeyDown(index - 1)}
                className="group relative flex h-2 shrink-0 cursor-row-resize touch-none items-center focus:outline-none"
              >
                <span className="h-px w-full bg-gray-200 transition-colors group-hover:bg-blue-400 group-focus-visible:bg-blue-500 dark:bg-gray-800 dark:group-hover:bg-blue-500" />
              </div>
            ) : null}
            <section
              ref={(node) => {
                sectionRefs.current[index] = node;
              }}
              data-testid={`panel-group-${group.id}`}
              style={{ flexGrow: sizes[index], flexBasis: 0 }}
              className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800"
            >
              <div
                role="tablist"
                aria-label={groupLabels[group.id]}
                className="flex shrink-0 gap-0.5 border-b border-gray-200 bg-gray-100/80 p-1 dark:border-gray-800 dark:bg-gray-800/50"
              >
                {group.panels.map((id) => {
                  const selected = active === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      data-testid={`panel-tab-${id}`}
                      onClick={() => setPanelTab(group.id, id)}
                      className={`min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-[11px] font-medium transition-colors ${
                        selected
                          ? 'bg-white text-gray-700 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                      }`}
                    >
                      {titles[id]}
                    </button>
                  );
                })}
              </div>
              <div
                className={`min-h-0 flex-1 px-1.5 py-2 ${
                  SELF_SCROLL_PANELS.has(active)
                    ? 'flex flex-col overflow-hidden'
                    : 'overflow-y-auto'
                }`}
              >
                {content[active]}
              </div>
            </section>
          </Fragment>
        );
      })}
    </div>
  );
}
