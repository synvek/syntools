import { useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { RibbonAccent, RibbonTab } from './types';
import { RIBBON_ACCENT, RIBBON_ICON_BUTTON, RIBBON_TAB_IDLE, RIBBON_TABSTRIP } from './ribbonTheme';
import { RibbonIcon } from './ribbonIcons';

/**
 * Tab strip: quick access toolbar (left) → tabs (middle) → collapse toggle (right).
 *
 * Keyboard follows the WAI-ARIA tabs pattern with automatic activation: ←/→ move and select,
 * Home/End jump to the ends, Enter/Space re-select (used by tests and by collapsed mode). Double-click
 * a tab collapses / pins the ribbon, exactly like Office.
 */
export function RibbonTabStrip({
  tabs,
  activeId,
  accent,
  collapsed,
  quickAccess,
  collapseLabel,
  expandLabel,
  onSelect,
  onToggleCollapsed,
  idPrefix,
  ariaLabel,
  onAnyClick,
}: {
  tabs: RibbonTab[];
  activeId: string;
  accent: RibbonAccent;
  collapsed: boolean;
  quickAccess?: ReactNode;
  collapseLabel: string;
  expandLabel: string;
  onSelect: (tabId: string) => void;
  onToggleCollapsed: () => void;
  idPrefix: string;
  ariaLabel: string;
  /** Collapsed mode closes its flyout when the user interacts with the strip */
  onAnyClick?: () => void;
}) {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (from: number, delta: number) => {
    if (tabs.length === 0) return;
    const next = (from + delta + tabs.length) % tabs.length;
    const target = tabs[next];
    if (!target) return;
    onSelect(target.id);
    buttonsRef.current[next]?.focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        move(index, 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        move(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        move(index, -index);
        break;
      case 'End':
        event.preventDefault();
        move(index, tabs.length - 1 - index);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        onSelect(tabs[index]?.id ?? activeId);
        break;
      default:
        break;
    }
  };

  return (
    <div className={RIBBON_TABSTRIP}>
      {quickAccess ? (
        <>
          <div className="flex shrink-0 items-center gap-0.5">{quickAccess}</div>
          <span className="mx-0.5 h-4 w-px bg-gray-300 dark:bg-[#4a4a4a]" />
        </>
      ) : null}

      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto"
      >
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                buttonsRef.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              data-testid={`ribbon-tab-${tab.id}`}
              onClick={() => {
                onAnyClick?.();
                onSelect(tab.id);
              }}
              onKeyDown={(event) => onKeyDown(event, index)}
              onDoubleClick={onToggleCollapsed}
              className={`flex h-full shrink-0 items-center border-b-2 px-2.5 text-[12px] font-medium transition-colors ${
                selected
                  ? `${RIBBON_ACCENT[accent].tab} bg-white dark:bg-[#1f1f1f]`
                  : `${RIBBON_TAB_IDLE} border-transparent`
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label={collapsed ? expandLabel : collapseLabel}
        title={collapsed ? expandLabel : collapseLabel}
        aria-expanded={!collapsed}
        data-testid="ribbon-collapse-toggle"
        onClick={onToggleCollapsed}
        className={RIBBON_ICON_BUTTON}
      >
        <RibbonIcon
          name="chevron"
          className={`h-3.5 w-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  );
}
