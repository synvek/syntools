import { useEffect, type ReactNode } from 'react';
import { Icon } from '@/core/components/Icon';

/**
 * 办公工具通用的「放映」全屏层（幻灯片工具是最早的实现，这里抽成公共组件）。
 *
 * 约定：
 * - 整屏深色背景 + 居中内容，内容自身决定底色（如白底 A4 / 白底表格）；
 * - `Esc` 退出，右上角同时提供退出按钮；
 * - 内容生成可能是异步的（截图 / 合成），用 `loading` 与 `failed` 呈现中间态；
 * - 底部 `footer` 放工具自定义操作（翻页、切换工作表等）。
 */

export interface PresentOverlayProps {
  /** 左上角标题（通常为文档名） */
  title: string;
  onClose: () => void;
  /** 退出按钮文案（含 Esc 提示） */
  exitLabel: string;
  /** 内容生成中的提示 */
  loadingLabel?: string;
  /** 内容生成失败的提示 */
  failedLabel?: string;
  /** 失败时的补充说明（如建议降低画布尺寸） */
  failedHint?: string;
  loading?: boolean;
  failed?: boolean;
  /** 内容对齐：文档类居顶更像「一页纸」，图形类居中更像投影（默认居中） */
  align?: 'center' | 'top';
  /** 底部操作区 */
  footer?: ReactNode;
  children?: ReactNode;
}

export function PresentOverlay({
  title,
  onClose,
  exitLabel,
  loadingLabel,
  failedLabel,
  failedHint,
  loading = false,
  failed = false,
  align = 'center',
  footer,
  children,
}: PresentOverlayProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      data-testid="present-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-[#0b1220]"
    >
      <header className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-gray-300">
        <span className="truncate">{title}</span>
        <button
          type="button"
          data-testid="present-exit"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-600 px-2.5 py-1 text-[12px] transition-colors hover:bg-gray-800"
        >
          <Icon name="close" className="h-4 w-4" />
          {exitLabel}
        </button>
      </header>

      <div
        className={`flex min-h-0 flex-1 justify-center overflow-auto px-6 pb-6 ${
          align === 'top' ? 'items-start' : 'items-center'
        }`}
      >
        {loading ? <p className="text-sm text-gray-400">{loadingLabel}</p> : null}
        {failed ? (
          <div className="max-w-md text-center text-sm text-gray-400">
            <p>{failedLabel}</p>
            {failedHint ? <p className="mt-1 text-xs text-gray-500">{failedHint}</p> : null}
          </div>
        ) : null}
        {!loading && !failed ? children : null}
      </div>

      {footer ? (
        <footer className="flex items-center justify-center gap-3 pb-4 text-[12px] text-gray-400">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
