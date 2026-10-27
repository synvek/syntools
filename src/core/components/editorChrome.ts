/**
 * Data and helpers for the shared document-editor chrome (no components).
 *
 * Kept in its own file to satisfy `react-refresh/only-export-components`:
 * component files export only components; constants, types and factories live here so HMR stays scoped.
 */

/** Title input: consistent width and look across editors */
export const EDITOR_TITLE_INPUT_CLASS =
  'w-full max-w-[240px] rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/** Toolbar icon button: aligned with the menu height */
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

/** Convenience builder for menu items (skips the `type: 'item'` boilerplate) */
export function editorMenuItem(
  id: string,
  label: string,
  onSelect: () => void,
  options: { shortcut?: string; disabled?: boolean; danger?: boolean } = {},
): EditorMenuEntry {
  return { type: 'item', id, label, onSelect, ...options };
}

/** Human-readable byte size (same format as the photo editor status bar) */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Rough document size from JSON bytes, used for the status bar memory hint */
export function estimateJsonBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}
