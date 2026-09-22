import type { ReactNode } from 'react';
import { Icon } from '@/core/components/Icon';
import { ClearButton, OptionBar } from '@/core/components/ActionButtons';

/**
 * 办公工具（文字处理器 / 电子表格 / 幻灯片 / 流程图 / 脑图）的统一文档头部。
 *
 * 行结构（自上而下）：
 * 1. 文档标题（输入框宽度固定 200px）+ 新建该类型文档按钮 + 导入 / 导出相关按钮（io 插槽，置于行尾）；
 * 2. 左侧文档统计信息（stats 插槽），右侧文档状态（status 插槽）+ 清空内容按钮；
 * 3. 之后由各工具自行渲染工具栏行（必要时可扩展到下一行）。
 *
 * 标题即导出文件名来源，由各工具传入的 onTitleChange 落到文档模型上。
 * 行内不放大段说明文字，改为 `HintTip` 气泡提示，避免挤占空间。
 */

/** 标题输入框：宽度固定 200px，避免不同工具宽度不一致 */
export const DOC_TITLE_INPUT_CLASS =
  'w-[200px] shrink-0 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none transition-colors focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

/** 说明文字气泡：默认只显示一个 ⓘ 图标，悬停 / 聚焦时才展示完整文案 */
export function HintTip({ text, label }: { text: string; label?: string }) {
  return (
    <span
      role="img"
      tabIndex={0}
      title={text}
      aria-label={label ?? text}
      className="inline-flex h-8 w-8 shrink-0 cursor-help items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
    >
      <Icon name="info" className="h-4 w-4" />
    </span>
  );
}

interface DocumentHeaderProps {
  titleLabel: string;
  titlePlaceholder: string;
  title: string;
  onTitleChange: (value: string) => void;
  /** 新建该类型文档按钮文案 */
  newLabel: string;
  /** 新建按钮图标（Icon 名称） */
  newIcon: string;
  onNew: () => void;
  /** 新建按钮之后、io 之前插入的按钮（如放映） */
  afterNew?: ReactNode;
  /** 第一行尾部：导入 / 导出相关按钮 */
  io?: ReactNode;
  /** 第二行左侧：文档统计信息 */
  stats?: ReactNode;
  /** 第二行右侧：文档状态，如「已保存到本地草稿」 */
  status?: ReactNode;
  /** 清空内容 */
  onClear?: () => void;
  clearDisabled?: boolean;
}

export function DocumentHeader({
  titleLabel,
  titlePlaceholder,
  title,
  onTitleChange,
  newLabel,
  newIcon,
  onNew,
  afterNew,
  io,
  stats,
  status,
  onClear,
  clearDisabled,
}: DocumentHeaderProps) {
  return (
    <>
      <OptionBar>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="shrink-0">{titleLabel}</span>
          <input
            type="text"
            value={title}
            aria-label={titleLabel}
            placeholder={titlePlaceholder}
            onChange={(event) => onTitleChange(event.target.value)}
            className={DOC_TITLE_INPUT_CLASS}
          />
        </label>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Icon name={newIcon} className="h-4 w-4" />
          {newLabel}
        </button>

        {afterNew}

        {io ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{io}</div>
        ) : null}
      </OptionBar>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex flex-wrap items-center gap-3">{stats}</div>
        <div className="flex items-center gap-2">
          {status}
          {onClear ? <ClearButton onClick={onClear} disabled={clearDisabled} /> : null}
        </div>
      </div>
    </>
  );
}
