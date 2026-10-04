import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import type { DocComment, TrackedChange } from './docs';

interface ReviewPanelProps {
  comments: DocComment[];
  changes: TrackedChange[];
  /** 正在撰写的新批注引文（null 表示未在撰写） */
  pendingQuote: string | null;
  /** 批注/修订署名（本地偏好，随草稿一起保存） */
  author: string;
  onAuthorChange: (author: string) => void;
  onSubmitComment: (text: string) => void;
  onCancelComment: () => void;
  onAddComment: () => void;
  onRemoveComment: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}

const buttonBase =
  'h-7 rounded-md border border-gray-300 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * 批注与修订侧栏：
 * - 批注新增改为面板内联编辑（不再弹出浏览器原生对话框），支持回车提交 / Esc 取消
 * - 批注条目支持「标记已解决」与删除
 * - 修订条目按插入/删除分色，保留全部接受 / 全部拒绝
 */
export function ReviewPanel({
  comments,
  changes,
  pendingQuote,
  author,
  onAuthorChange,
  onSubmitComment,
  onCancelComment,
  onAddComment,
  onRemoveComment,
  onToggleResolved,
  onAcceptAll,
  onRejectAll,
  onClose,
}: ReviewPanelProps) {
  const { t } = useTranslation();
  const [draftText, setDraftText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (pendingQuote === null) {
      setDraftText('');
      return;
    }
    textareaRef.current?.focus();
  }, [pendingQuote]);

  const submit = () => {
    const text = draftText.trim();
    if (!text) return;
    onSubmitComment(text);
    setDraftText('');
  };

  const unresolved = comments.filter((comment) => !comment.resolved).length;

  return (
    <div
      data-testid="rich-text-review"
      className="rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-gray-700 dark:text-gray-200">
          {t('tools.richText.review')}
          {unresolved > 0 ? (
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              {unresolved}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onAddComment} className={buttonBase}>
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

      <label className="mb-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="shrink-0">{t('tools.richText.authorLabel')}</span>
        <input
          type="text"
          value={author}
          maxLength={40}
          onChange={(event) => onAuthorChange(event.target.value)}
          placeholder={t('tools.richText.authorPlaceholder')}
          className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        />
      </label>

      {changes.length > 0 ? (
        <div className="mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('tools.richText.trackedChanges')} ({changes.length})
          </span>
          <div className="mt-1 flex gap-1">
            <button type="button" onClick={onAcceptAll} className={buttonBase}>
              {t('tools.richText.acceptAll')}
            </button>
            <button type="button" onClick={onRejectAll} className={buttonBase}>
              {t('tools.richText.rejectAll')}
            </button>
          </div>
          <ul className="mt-1 max-h-28 overflow-auto">
            {changes.slice(0, 20).map((change) => (
              <li
                key={change.id}
                className="flex items-baseline gap-1 py-0.5 text-xs text-gray-600 dark:text-gray-300"
              >
                <span
                  className={`shrink-0 font-medium ${
                    change.kind === 'insert' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {change.kind === 'insert' ? '+' : '−'}
                </span>
                <span className="truncate">{change.text.slice(0, 60)}</span>
                {change.author ? (
                  <span className="ml-auto shrink-0 text-gray-400 dark:text-gray-500">
                    {change.author}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pendingQuote !== null ? (
        <div className="mb-2 rounded-md border border-blue-300 bg-blue-50/60 p-2 dark:border-blue-700 dark:bg-blue-950/30">
          <p className="mb-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {pendingQuote || t('tools.richText.commentNoQuote')}
          </p>
          <textarea
            ref={textareaRef}
            value={draftText}
            rows={2}
            onChange={(event) => setDraftText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                submit();
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                onCancelComment();
              }
            }}
            placeholder={t('tools.richText.commentPlaceholder')}
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
          />
          <div className="mt-1 flex justify-end gap-1">
            <button type="button" onClick={onCancelComment} className={buttonBase}>
              {t('tools.richText.commentCancel')}
            </button>
            <button
              type="button"
              disabled={!draftText.trim()}
              onClick={submit}
              className="h-7 rounded-md bg-blue-600 px-2 text-xs text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('tools.richText.commentSubmit')}
            </button>
          </div>
        </div>
      ) : null}

      {comments.length === 0 ? (
        <p className="px-1 py-2 text-xs text-gray-400 dark:text-gray-500">
          {t('tools.richText.noComments')}
        </p>
      ) : (
        <ul className="max-h-48 overflow-auto">
          {comments.map((comment) => (
            <li
              key={comment.id}
              className={`rounded-md px-2 py-1.5 ${comment.resolved ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {comment.quote ? (
                    <p
                      className={`truncate text-xs text-gray-400 dark:text-gray-500 ${
                        comment.resolved ? 'line-through' : ''
                      }`}
                    >
                      {comment.quote.slice(0, 40)}
                    </p>
                  ) : null}
                  <p className="break-words text-gray-800 dark:text-gray-100">
                    {comment.text || t('tools.richText.commentEmpty')}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-400 dark:text-gray-500">
                    {comment.author ? <span>{comment.author}</span> : null}
                    {comment.createdAt > 0 ? (
                      <span>{new Date(comment.createdAt).toLocaleString()}</span>
                    ) : null}
                    {comment.resolved ? (
                      <span>{t('tools.richText.commentResolvedTag')}</span>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    title={
                      comment.resolved
                        ? t('tools.richText.commentReopen')
                        : t('tools.richText.commentResolve')
                    }
                    aria-label={
                      comment.resolved
                        ? t('tools.richText.commentReopen')
                        : t('tools.richText.commentResolve')
                    }
                    aria-pressed={comment.resolved}
                    onClick={() => onToggleResolved(comment.id, !comment.resolved)}
                    className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                      comment.resolved
                        ? 'text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                        : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon name="check" className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title={t('tools.richText.removeComment')}
                    aria-label={t('tools.richText.removeComment')}
                    onClick={() => onRemoveComment(comment.id)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
