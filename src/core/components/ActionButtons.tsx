import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';

interface SwapButtonProps {
  onSwap: () => void;
  label?: string;
  disabled?: boolean;
}

/** 交换输入输出（编解码类工具） */
export function SwapButton({ onSwap, label, disabled = false }: SwapButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onSwap}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      <Icon name="swap" className="h-3.5 w-3.5" />
      {label ?? t('common.swap')}
    </button>
  );
}

interface DownloadButtonProps {
  content: string;
  filename: string;
  label?: string;
}

/** 结果下载为文件 */
export function DownloadButton({ content, filename, label }: DownloadButtonProps) {
  const { t } = useTranslation();
  const download = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={download}
      disabled={content.length === 0}
      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      <Icon name="download" className="h-3.5 w-3.5" />
      {label ?? t('common.download')}
    </button>
  );
}

/** 参数区容器：单选/开关等选项的统一布局 */
export function OptionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

interface ClearButtonProps {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}

/** 清空输入（交互规范：工具需提供复制/清空/交换） */
export function ClearButton({ onClick, label, disabled = false }: ClearButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      <Icon name="close" className="h-3.5 w-3.5" />
      {label ?? t('common.clear')}
    </button>
  );
}
