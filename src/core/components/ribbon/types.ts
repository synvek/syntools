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

/**
 * Rendering hints for one option of a combo box.
 *
 * Office previews the *result*, not the label: the font list is set in each font, the style list is set
 * in each style, the number format list shows a formatted sample. `hint` is the grey sample on the right
 * (e.g. "AaBbCc" for fonts, "12 pt" for sizes).
 */
export interface RibbonSelectPreview {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: 'normal' | 'bold' | number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: string;
  letterSpacing?: string;
  color?: string;
  /** Right-aligned sample text, styled with the same preview */
  hint?: string;
}

export interface RibbonSelectOption {
  value: string;
  label: string;
  preview?: RibbonSelectPreview;
  /** Renders as a non-selectable section title inside the list */
  heading?: boolean;
}

/**
 * Combo box (font family / font size / style / number format).
 *
 * Not a native `<select>`: the browser cannot paint options in their own font, which is exactly what
 * makes Office's lists readable. See `RibbonComboBox`.
 */
export interface RibbonSelectItem extends RibbonItemBase {
  kind: 'select';
  value: string;
  options: RibbonSelectOption[];
  onChange: (value: string) => void;
  width?: 'xxs' | 'xs' | 'sm' | 'md';
  /** Accept free text (Word's font size box); the preset list still opens from the arrow */
  editable?: boolean;
  /**
   * What the trigger shows when the value is not in the list (falls back to the raw value).
   * Editable boxes also use it as the placeholder when nothing is set yet (e.g. the default 11pt).
   */
  display?: string;
  /** Editable only: stored value → the text in the input (`'15px'` → `'15'`) */
  toDraft?: (value: string) => string;
  /** Editable only: typed text → the stored value (`'18'` → `'18px'`) */
  fromDraft?: (draft: string) => string;
  /**
   * `wide` gives the list room for long labels so the right-aligned samples line up (font lists, style
   * galleries); `auto` hugs the content (numbers, zooms).
   */
  listWidth?: 'auto' | 'wide';
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
  /**
   * Column-major packing (Office's default): large buttons own a column, small ones stack two high.
   * Leave empty when `rows` describes the group instead.
   */
  items: RibbonItem[];
  /**
   * Row-major layout, one inner array per visual row.
   *
   * Word uses this for 字体 / 段落: a wide combo box and a narrow one sit side by side on the first
   * row, the icon buttons fill the second. Column packing cannot express that — a narrow control
   * under a wide one leaves a visible hole to its right.
   */
  rows?: RibbonItem[][];
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
