import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { EditorMenu } from '../editorChrome';
import type { RibbonAccent, RibbonGroup, RibbonMenuItem, RibbonTab } from './types';
import { RIBBON_FLYOUT, RIBBON_PANEL, RIBBON_SHELL } from './ribbonTheme';
import { RibbonGroupView } from './RibbonGroup';
import { RibbonMenuBar } from './RibbonMenuBar';
import { RibbonMenuButton } from './RibbonSplitButton';
import { RibbonTabStrip } from './RibbonTabStrip';
import { useGroupOverflow, useRibbonCollapse } from './useRibbonCollapse';

/**
 * Flattens a dropped group into menu entries so its commands stay reachable.
 *
 * Selects and colour pickers cannot live in a flat menu: they either keep their own tab or the
 * editor's panel, so they are skipped instead of being rendered with a wrong control.
 */
function groupMenuItems(group: RibbonGroup): RibbonMenuItem[] {
  return group.items.flatMap((item) => {
    if (item.kind === 'select' || item.kind === 'color') return [];
    if (item.kind === 'menu' || item.kind === 'split') {
      return item.menu.map((entry) => ({ ...entry, id: `${group.id}-${item.id}-${entry.id}` }));
    }
    return [
      {
        id: `${group.id}-${item.id}`,
        label: item.label,
        icon: item.icon,
        disabled: item.disabled,
        checked: item.active,
        onSelect: item.onSelect,
      },
    ];
  });
}

export interface RibbonProps {
  /** Accessible name of the tab list */
  ariaLabel: string;
  tabs: RibbonTab[];
  accent?: RibbonAccent;
  /** File / edit / insert / view menus, shown as icon dropdowns left of the first tab */
  menus?: EditorMenu[];
  /** Accessible name of the menu group (e.g. "菜单栏") */
  menuAriaLabel?: string;
  /** Quick access toolbar contents (undo/redo, print…) right of the menus */
  quickAccess?: ReactNode;
  /** Document chrome (save state, title, new, present…) between the tabs and the collapse toggle */
  headerRight?: ReactNode;
  defaultTabId?: string;
  /**
   * Controlled active tab. Used by editors that switch tabs on their own — e.g. activating the
   * contextual 形状格式 tab as soon as a shape gets selected.
   */
  activeTabId?: string;
  onActiveTabChange?: (tabId: string) => void;
  /** Controlled collapse; omit to let the ribbon decide from its own width */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseLabel: string;
  expandLabel: string;
  /** Accessible name of the overflow button that holds commands of groups trimmed by the width */
  moreLabel?: string;
  autoCollapseWidth?: number;
  testId?: string;
  className?: string;
}

/**
 * Office-style ribbon.
 *
 * Structure: tab strip (quick access → tabs → collapse toggle) on top of a command panel whose groups
 * carry a caption and a dialog launcher. Fully data driven — the editors only build the `tabs` array,
 * so the spreadsheet, the word processor and the slide editor share one visual language.
 *
 * Collapsed mode mirrors Office: only the strip remains, clicking a tab opens a flyout panel and any
 * executed command closes it.
 */
export function Ribbon({
  ariaLabel,
  tabs,
  accent = 'blue',
  menus,
  menuAriaLabel = 'Menu',
  quickAccess,
  headerRight,
  defaultTabId,
  activeTabId,
  onActiveTabChange,
  collapsed: collapsedProp,
  onCollapsedChange,
  collapseLabel,
  expandLabel,
  moreLabel = 'More',
  autoCollapseWidth,
  testId,
  className = '',
}: RibbonProps) {
  const { collapsed, toggle, containerRef } = useRibbonCollapse({
    autoCollapseWidth,
    collapsed: collapsedProp,
    onCollapsedChange,
  });
  const [ownTabId, setOwnTabId] = useState(() => defaultTabId ?? tabs[0]?.id ?? '');
  const activeId = activeTabId ?? ownTabId;
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const rawId = useId();
  const idPrefix = `${(testId ?? 'ribbon').replace(/[^a-zA-Z0-9-]/g, '')}-${rawId.replace(/[^a-zA-Z0-9-]/g, '')}`;

  // A tab that disappears (feature flags / conditional tabs) must not leave the panel empty
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeId) ?? tabs[0] ?? null,
    [tabs, activeId],
  );
  const hiddenGroups = useGroupOverflow({
    panelRef,
    tabId: activeTab?.id ?? '',
    groups: activeTab?.groups ?? [],
  });

  // Leaving collapsed mode must drop any flyout, otherwise two panels stay mounted
  useEffect(() => {
    if (!collapsed) setFlyoutOpen(false);
  }, [collapsed]);

  useEffect(() => {
    if (!flyoutOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFlyoutOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flyoutOpen]);

  const selectTab = (tabId: string) => {
    setOwnTabId(tabId);
    onActiveTabChange?.(tabId);
    // In collapsed mode a tab click reveals its commands below the strip
    setFlyoutOpen(collapsed);
  };

  // Groups trimmed by the width still expose their commands through one "more" dropdown
  const overflowItems = useMemo(() => {
    if (!activeTab || collapsed) return [];
    return activeTab.groups.filter((group) => hiddenGroups.has(group.id)).flatMap(groupMenuItems);
  }, [activeTab, hiddenGroups, collapsed]);

  const groups = activeTab
    ? activeTab.groups.map((group, index) => (
        <RibbonGroupView
          key={group.id}
          group={group}
          accent={accent}
          divider={index > 0}
          hidden={!collapsed && hiddenGroups.has(group.id)}
          onInvoked={collapsed ? () => setFlyoutOpen(false) : undefined}
        />
      ))
    : null;

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className={`${RIBBON_SHELL} relative ${className}`}
    >
      <RibbonTabStrip
        tabs={tabs}
        activeId={activeTab?.id ?? ''}
        accent={accent}
        collapsed={collapsed}
        menus={
          menus && menus.length > 0 ? (
            <RibbonMenuBar menus={menus} ariaLabel={menuAriaLabel} />
          ) : null
        }
        quickAccess={quickAccess}
        headerRight={headerRight}
        collapseLabel={collapseLabel}
        expandLabel={expandLabel}
        onSelect={selectTab}
        onToggleCollapsed={toggle}
        idPrefix={idPrefix}
        ariaLabel={ariaLabel}
        onAnyClick={() => setFlyoutOpen(false)}
      />

      {activeTab && !collapsed ? (
        <div
          ref={panelRef}
          role="tabpanel"
          id={`${idPrefix}-panel-${activeTab.id}`}
          aria-labelledby={`${idPrefix}-tab-${activeTab.id}`}
          className={RIBBON_PANEL}
        >
          {groups}
          {overflowItems.length > 0 ? (
            <div className="ml-auto flex h-14 shrink-0 items-start pl-1">
              <RibbonMenuButton
                label={moreLabel}
                icon="more"
                size="small"
                menu={overflowItems}
                testId={testId ? `${testId}-overflow` : undefined}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab && collapsed && flyoutOpen ? (
        <div
          role="tabpanel"
          id={`${idPrefix}-panel-${activeTab.id}`}
          aria-labelledby={`${idPrefix}-tab-${activeTab.id}`}
          className={RIBBON_FLYOUT}
        >
          {groups}
        </div>
      ) : null}
    </div>
  );
}
