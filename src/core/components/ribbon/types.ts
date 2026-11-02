/**
 * Data model of the shared Office-style ribbon.
 *
 * Presentation only: no business logic, no editor imports. A tool describes its commands as data
 * (tabs → groups → items) and the ribbon renders them. This keeps the component testable in jsdom and
 * lets the same registry drive the kept `EditorMenuBar` as well.
 */

import type { ReactNode } from 'react';

/** Large = icon above text (primary command); small = icon only (secondary command) */
export type RibbonItemSize = 'large' | 'small';

export interface RibbonMenuItem {
  id: string;
  label: string;
  /** Office glyph name (ribbonIcons) or a regular Icon name */
  icon?: string;
  disabled?: boolean;
  /** Renders a leading check mark — used by the "current value" item of a split button */
  checked?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

interface RibbonItemBase {
  id: string;
  /** Accessible name. Small buttons show it as a tooltip only */
  label: string;
  /** Office glyph name (see ribbonIcons) or an existing Icon name */
  icon?: string;
  size?: RibbonItemSize;
  disabled?: boolean;
  /** Tooltip override — e.g. the reason a command is greyed out */
  hint?: string;
}

/** Plain command */
export interface RibbonCommandItem extends RibbonItemBase {
  kind: 'button';
  active?: boolean;
  onSelect: () => void;
}

/** Toggle: `active` paints the accent fill and sets aria-pressed (bold / align / gridlines…) */
export interface RibbonToggleItem extends RibbonItemBase {
  kind: 'toggle';
  active?: boolean;
  onSelect: () => void;
}

/** Dropdown-only entry: the visible button opens the menu instead of running a command */
export interface RibbonMenuCommandItem extends RibbonItemBase {
  kind: 'menu';
  menu: RibbonMenuItem[];
}

/** Split button: clicking the icon runs the command, clicking the arrow opens the menu */
export interface RibbonSplitItem extends RibbonItemBase {
  kind: 'split';
  active?: boolean;
  onSelect: () => void;
  menu: RibbonMenuItem[];
}

/** Compact native select (font family / size / number format) */
export interface RibbonSelectItem extends RibbonItemBase {
  kind: 'select';
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  width?: 'xs' | 'sm' | 'md';
}

/** Color swatch button: preset palette popover plus a native picker fallback */
export interface RibbonColorItem extends RibbonItemBase {
  kind: 'color';
  value: string | null;
  onPick: (color: string) => void;
  /** Optional "clear the color" entry */
  onReset?: () => void;
  resetLabel?: string;
}

export type RibbonItem =
  | RibbonCommandItem
  | RibbonToggleItem
  | RibbonMenuCommandItem
  | RibbonSplitItem
  | RibbonSelectItem
  | RibbonColorItem;

export interface RibbonGroup {
  id: string;
  label: string;
  items: RibbonItem[];
  /** Dialog launcher (bottom-right arrow) — opens the group's full settings surface */
  onLauncher?: () => void;
  /** Higher priority groups are dropped last when the panel gets too narrow (default 0) */
  priority?: number;
  /**
   * Free-floating surface anchored to the group (shape gallery, presets…).
   *
   * A ribbon menu cannot host a visual picker, so tools hand the popover in as a node and keep
   * owning its open state; the group only supplies the `relative` anchor.
   */
  overlay?: ReactNode;
}

export interface RibbonTab {
  id: string;
  label: string;
  groups: RibbonGroup[];
}

/** Accent theme: keeps three editors visually distinct while sharing one component */
export type RibbonAccent = 'blue' | 'green' | 'orange';
