import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useOverlayStack } from '@/core/hooks/useOverlayStack';
import type { EditorMenu } from '../editorChrome';
import type {
  RibbonAccent,
  RibbonColorItem,
  RibbonGroup,
  RibbonMenuItem,
  RibbonSelectItem,
  RibbonTab,
} from './types';
import { RIBBON_FLYOUT, RIBBON_PANEL, RIBBON_SHELL, Z_PANEL } from './ribbonTheme';
import { ItemView, RibbonGroupView } from './RibbonGroup';
import { RibbonMoreMenu } from './RibbonMoreMenu';
import { RibbonMenuButton } from './RibbonSplitButton';
import { RibbonTabStrip } from './RibbonTabStrip';
import { useGroupOverflow, useRibbonCollapse } from './useRibbonCollapse';

interface OverflowControl {
  id: string;
  groupId: string;
  item: RibbonSelectItem | RibbonColorItem;
}

/**
 * Flattens a dropped group into menu entries so its commands stay reachable.
 *
 * A flat `menuitem` list cannot host a combo box or a colour palette, so those two kinds used to be
 * skipped — which made font / size / colour / zoom unreachable whenever their group was trimmed
 * (P0-4.5). They now open a small control panel hosting the real ribbon control instead.
 */
function groupMenuItems(group: RibbonGroup, onOpenControl: (id: string) => void): RibbonMenuItem[] {
  // Row-major groups keep their commands in `rows`; flatten so the overflow menu stays complete
  const items = group.rows ? group.rows.flat() : group.items;
  return items.flatMap((item) => {
    if (item.kind === 'menu' || item.kind === 'split') {
      return item.menu.map((entry) => ({ ...entry, id: `${group.id}-${item.id}-${entry.id}` }));
    }
    const id = `${group.id}-${item.id}`;
    if (item.kind === 'select' || item.kind === 'color') {
      return [
        {
          id,
          label: item.label,
          icon: item.icon,
          disabled: item.disabled,
          control: true,
          onSelect: () => onOpenControl(id),
        },
      ];
    }
    return [
      {
        id,
        label: item.label,
        icon: item.icon,
        disabled: item.disabled,
        checked: item.active,
        onSelect: item.onSelect,
      },
    ];
  });
}

/** Select / colour commands of the trimmed groups, kept as data so the panel reuses `ItemView`. */
function overflowControlsOf(groups: RibbonGroup[], hidden: Set<string>): OverflowControl[] {
  return groups
    .filter((group) => hidden.has(group.id))
    .flatMap((group) => {
      const items = group.rows ? group.rows.flat() : group.items;
      return items
        .filter(
          (item): item is RibbonSelectItem | RibbonColorItem =>
            item.kind === 'select' || item.kind === 'color',
        )
        .map((item) => ({ id: `${group.id}-${item.id}`, groupId: group.id, item }));
    });
}

export interface RibbonProps {
  /** Accessible name of the tab list */
  ariaLabel: string;
  tabs: RibbonTab[];
  accent?: RibbonAccent;
  /**
   * Commands with no ribbon counterpart (import / export / print …), reached through one ⋯ dropdown
   * left of the first tab. Everything the ribbon already exposes belongs on a tab, not in here.
   */
  menu?: EditorMenu;
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
 * executed command closes it. Between full width and that mode, trimmed groups keep their commands
 * in one "more" dropdown; their select / colour controls live in a panel next to it.
 */
export function Ribbon({
  ariaLabel,
  tabs,
  accent = 'blue',
  menu,
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
  const [activeControlId, setActiveControlId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const controlPanelRef = useRef<HTMLDivElement | null>(null);
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
    setActiveControlId(null);
  };

  // Groups trimmed by the width still expose their commands through one "more" dropdown
  const overflowItems = useMemo(() => {
    if (!activeTab || collapsed) return [];
    return activeTab.groups
      .filter((group) => hiddenGroups.has(group.id))
      .flatMap((group) => groupMenuItems(group, setActiveControlId));
  }, [activeTab, hiddenGroups, collapsed]);

  const overflowControls = useMemo(
    () => (activeTab && !collapsed ? overflowControlsOf(activeTab.groups, hiddenGroups) : []),
    [activeTab, hiddenGroups, collapsed],
  );
  const activeControl = activeControlId
    ? (overflowControls.find((control) => control.id === activeControlId) ?? null)
    : null;
  const controlPanelOpen = activeControl !== null;
  useOverlayStack(controlPanelOpen, () => setActiveControlId(null));

  useEffect(() => {
    if (activeControlId && !activeControl) setActiveControlId(null);
  }, [activeControlId, activeControl]);

  useEffect(() => {
    if (!controlPanelOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (controlPanelRef.current?.contains(event.target as Node)) return;
      setActiveControlId(null);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [controlPanelOpen]);

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
        menu={menu ? <RibbonMoreMenu menu={menu} /> : null}
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
            <div className="relative ml-auto flex h-14 shrink-0 items-start pl-1">
              <RibbonMenuButton
                label={moreLabel}
                icon="more"
                size="small"
                menu={overflowItems}
                testId={testId ? `${testId}-overflow` : undefined}
              />
              {activeControl ? (
                <div
                  ref={controlPanelRef}
                  role="group"
                  aria-label={moreLabel}
                  data-testid={testId ? `${testId}-controls` : undefined}
                  className={`absolute right-0 top-full ${Z_PANEL} mt-0.5 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-[#3a3a3a] dark:bg-[#252525]`}
                >
                  <span className="whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                    {activeControl.item.label}
                  </span>
                  <ItemView
                    item={activeControl.item}
                    accent={accent}
                    groupId={`${activeControl.groupId}-overflow`}
                    onInvoked={() => setActiveControlId(null)}
                  />
                </div>
              ) : null}
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
