import type { ReactNode } from 'react';
import { Icon } from '@/core/components/Icon';

/**
 * 可停靠面板的单个卡片：标题栏（展开 / 折叠 + 上移 / 下移）+ 内容区。
 *
 * 标题文字本身也是一个按钮，语义是「显示该面板」——点击时只展开、不折叠，
 * 这样「点标题找面板」的行为符合直觉，也兼容既有 e2e（点「属性」后属性面板可见）。
 * 折叠统一由标题左侧的折叠箭头负责。
 */
export function Panel({
  title,
  collapsed,
  onToggle,
  onReveal,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  moveUpLabel,
  moveDownLabel,
  collapseLabel,
  expandLabel,
  testId,
  children,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  onReveal: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  moveUpLabel: string;
  moveDownLabel: string;
  collapseLabel: string;
  expandLabel: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      data-collapsed={collapsed ? 'true' : undefined}
      className="flex flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <header className="flex items-center gap-1 px-1.5 py-1">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? expandLabel : collapseLabel}
          title={collapsed ? expandLabel : collapseLabel}
          onClick={onToggle}
          className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevron'} className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onReveal}
          className="min-w-0 flex-1 truncate text-left text-xs font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {title}
        </button>
        <button
          type="button"
          aria-label={moveUpLabel}
          title={moveUpLabel}
          disabled={!canMoveUp}
          onClick={onMoveUp}
          className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <Icon name="chevron" className="h-3 w-3 rotate-180" />
        </button>
        <button
          type="button"
          aria-label={moveDownLabel}
          title={moveDownLabel}
          disabled={!canMoveDown}
          onClick={onMoveDown}
          className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <Icon name="chevron" className="h-3 w-3" />
        </button>
      </header>
      {collapsed ? null : <div className="min-h-0 flex-1 px-1.5 pb-2">{children}</div>}
    </section>
  );
}
