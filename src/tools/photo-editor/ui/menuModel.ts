/**
 * Menu data model (plain data + builders, no components).
 *
 * A separate file to satisfy `react-refresh/only-export-components`:
 * component files export only components, while constants / factories live here, so hot reload does not refresh the whole page.
 */

export type MenuEntry =
  | { type: 'separator' }
  | {
      type: 'item';
      id: string;
      label: string;
      shortcut?: string;
      disabled?: boolean;
      danger?: boolean;
      onSelect: () => void;
    };

export interface MenuBarMenu {
  id: string;
  label: string;
  entries: MenuEntry[];
}

/** Convenience builder: a menu item (skips the `type: 'item'` boilerplate) */
export function menuItem(
  id: string,
  label: string,
  onSelect: () => void,
  options: { shortcut?: string; disabled?: boolean; danger?: boolean } = {},
): MenuEntry {
  return { type: 'item', id, label, onSelect, ...options };
}

/** Empty-state placeholder: a hint when a menu has no available items (disabled) */
export function menuPlaceholder(id: string, label: string): MenuEntry {
  return { type: 'item', id, label, disabled: true, onSelect: () => undefined };
}
