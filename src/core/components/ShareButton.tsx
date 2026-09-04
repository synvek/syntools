import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import { buildShareUrl, type ShareState } from '@/core/lib/share';

interface ShareButtonProps {
  /** 点击时读取工具当前可分享状态（输入/参数） */
  getState: () => ShareState;
  label?: string;
}

/**
 * 分享当前工具状态（Tasks T28）：
 * 生成 ?s= 链接 → 复制到剪贴板 → 地址栏同步（history.replaceState）。
 * 内容超过 2KB 时降级：就近提示，不生成链接。
 */
export function ShareButton({ getState, label }: ShareButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number>();

  const share = async () => {
    const result = buildShareUrl(window.location.pathname, getState());
    if (!result.ok) {
      setError(result.error === 'TOO_LONG' ? t('common.shareTooLong') : result.error);
      return;
    }
    setError(null);
    try {
      await navigator.clipboard.writeText(result.value);
    } catch {
      /* 复制失败不阻断：地址栏已更新，用户可手动复制 */
    }
    window.history.replaceState(null, '', result.value);
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Icon name={copied ? 'check' : 'share'} className="h-3.5 w-3.5" />
        {copied ? t('common.copied') : (label ?? t('common.share'))}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
