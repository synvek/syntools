import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import type { DocComment, TrackedChange } from './docs';

interface ReviewPanelProps {
  comments: DocComment[];
  changes: TrackedChange[];
  onAddComment: () => void;
  onRemoveComment: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}

/** 批注与修订侧栏（纯本地数据，无协作依赖） */
export function ReviewPanel({
  comments,
  changes,
  onAddComment,
  onRemoveComment,
  onAcceptAll,
  onRejectAll,
  onClose,
}: ReviewPanelProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="rich-text-review"
      className="rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.review')}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAddComment}
            className="h-7 rounded-md border border-gray-300 px-2 text-xs transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            {t('tools.richText.addComment')}
          </button>
          <button
            type="button"
            aria-label={t('tools.richText.reviewClose')}
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {changes.length > 0 ? (
        <div className="mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.trackedChanges')} ({changes.length})
          </span>
          <div className="mt-1 flex gap-1">
            <button
              type="button"
              onClick={onAcceptAll}
              className="h-7 rounded-md border border-gray-300 px-2 text-xs transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {t('tools.richText.acceptAll')}
            </button>
            <button
              type="button"
              onClick={onRejectAll}
              className="h-7 rounded-md border border-gray-300 px-2 text-xs transition-colors hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {t('tools.richText.rejectAll')}
            </button>
          </div>
          <ul className="mt-1 max-h-28 overflow-auto">
            {changes.slice(0, 20).map((change) => (
              <li
                key={change.id}
                className="truncate py-0.5 text-xs text-gray-600 dark:text-gray-300"
              >
                <span className={change.kind === 'insert' ? 'text-green-600' : 'text-red-600'}>
                  {change.kind === 'insert' ? '+' : '-'}
                </span>{' '}
                {change.text.slice(0, 60)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {comments.length === 0 ? (
        <p className="px-1 py-2 text-xs text-gray-400 dark:text-gray-500">
          {t('tools.richText.noComments')}
        </p>
      ) : (
        <ul className="max-h-48 overflow-auto">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md px-2 py-1.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-gray-400 dark:text-gray-500">
                    {comment.quote.slice(0, 40)}
                  </p>
                  <p className="text-gray-800 dark:text-gray-100">{comment.text}</p>
                </div>
                <button
                  type="button"
                  aria-label={t('tools.richText.removeComment')}
                  onClick={() => onRemoveComment(comment.id)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
