import type { ReactNode } from 'react';

/**
 * 文档类编辑器统一的底部状态栏（footbar）。
 * 左侧放文档统计信息，右侧放内存等次要信息；与桌面编辑器的状态栏一致。
 */
export function EditorStatusBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 font-mono text-[11px] text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">{left}</div>
      {right ? <div className="ml-auto flex items-center gap-3">{right}</div> : null}
    </div>
  );
}
