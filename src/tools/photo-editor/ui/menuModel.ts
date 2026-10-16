/**
 * 菜单数据模型（纯数据 + 构造工具，不含组件）。
 *
 * 单独成文件是为了满足 `react-refresh/only-export-components`：
 * 组件文件只导出组件，常量 / 工厂函数放这里，热更新才不会整页刷新。
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

/** 便捷构造：菜单项（省去 `type: 'item'` 样板） */
export function menuItem(
  id: string,
  label: string,
  onSelect: () => void,
  options: { shortcut?: string; disabled?: boolean; danger?: boolean } = {},
): MenuEntry {
  return { type: 'item', id, label, onSelect, ...options };
}

/** 空态占位：某菜单暂无可用项时给出提示（禁用态） */
export function menuPlaceholder(id: string, label: string): MenuEntry {
  return { type: 'item', id, label, disabled: true, onSelect: () => undefined };
}
