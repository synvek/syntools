import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import {
  SHARE_LIMIT,
  buildShareUrlWithLimit,
  encodeShareState,
  type ShareState,
} from '@/core/lib/share';

interface ShareButtonProps {
  /** Reads the tool's shareable state (input / options) on click */
  getState: () => ShareState;
  label?: string;
  /**
   * Custom param encoding (added in phase 7): base64url by default (`encodeShareState`);
   * tools that need compaction can supply one (e.g. code-editor's deflate).
   */
  encodeParam?: (state: ShareState) => string;
  /** Max param length; defaults to `SHARE_LIMIT` (2048) */
  maxLength?: number;
  /** Over-length message; generic by default (tools can be more specific) */
  tooLongHint?: string;
}

/**
 * Share the current tool state (Tasks T28):
 * build the ?s= link → copy to clipboard → sync the address bar (history.replaceState).
 * Over the limit it degrades to an inline notice with no link.
 */
export function ShareButton({
  getState,
  label,
  encodeParam,
  maxLength,
  tooLongHint,
}: ShareButtonProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number>();

  const share = async () => {
    const param = encodeParam ? encodeParam(getState()) : encodeShareState(getState());
    const result = buildShareUrlWithLimit(
      window.location.pathname,
      param,
      maxLength ?? SHARE_LIMIT,
    );
    if (!result.ok) {
      setError(
        result.error === 'TOO_LONG' ? (tooLongHint ?? t('common.shareTooLong')) : result.error,
      );
      return;
    }
    setError(null);
    try {
      await navigator.clipboard.writeText(result.value);
    } catch {
      /* A failed copy is not fatal: the address bar is updated and users can copy manually */
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
