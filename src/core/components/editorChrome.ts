/**
 * 文档类编辑器统一外壳的纯数据 / 工具（不含组件）。
 *
 * 单独成文件是为了满足 `react-refresh/only-export-components`：
 * 组件文件只导出组件，常量 / 类型 / 工厂函数放这里，热更新才不会整页刷新。
 */

/** 标题输入框：各编辑器统一宽度与外观 */
export const EDITOR_TITLE_INPUT_CLASS =
  'w-full max-w-[240px] rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/** 工具栏图标按钮：与菜单高度对齐 */
export const EDITOR_ICON_BUTTON_CLASS =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200';

export type EditorMenuEntry =
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

export interface EditorMenu {
  id: string;
  label: string;
  entries: EditorMenuEntry[];
}

/** 便捷构造：菜单项（省去 `type: 'item'` 样板） */
export function editorMenuItem(
  id: string,
  label: string,
  onSelect: () => void,
  options: { shortcut?: string; disabled?: boolean; danger?: boolean } = {},
): EditorMenuEntry {
  return { type: 'item', id, label, onSelect, ...options };
}

/** 人类可读的字节数（与照片编辑器状态栏保持一致的格式） */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 粗略估算文档体积：按 JSON 序列化后的字节数，用于状态栏的内存提示 */
export function estimateJsonBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}
