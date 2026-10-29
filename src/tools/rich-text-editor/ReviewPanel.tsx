import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/core/components/Icon';
import type { DocComment, TrackedChange } from './docs';

interface ReviewPanelProps {
  comments: DocComment[];
  changes: TrackedChange[];
  /** Quote for the comment being written (null when not composing) */
  pendingQuote: string | null;
  /** Comment/change author name (a local preference saved with the draft) */
  author: string;
  onAuthorChange: (author: string) => void;
  onSubmitComment: (text: string) => void;
  onCancelComment: () => void;
  onAddComment: () => void;
  onRemoveComment: (id: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
  /** Reply to an existing thread (P1-2) */
  onReplyComment: (id: string, text: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  /** Accept / reject one tracked change by id (P2-3: per-change review) */
  onAcceptChange: (id: string) => void;
  onRejectChange: (id: string) => void;
  /** Jump the editor selection to a revision (prev/next navigation and row clicks) */
  onFocusChange: (id: string) => void;
  onClose: () => void;
}

const buttonBase =
  'h-7 rounded-md border border-gray-300 px-2 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800';

/**
 * Comments and tracked-changes sidebar:
 * - New comments are edited inline in the panel (no native browser dialog), Enter submits / Esc cancels
 * - Comment entries support "mark resolved" and delete
 * - Change entries are color-coded by insert/delete, with accept-all / reject-all
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
  onReplyComment,
  onAcceptAll,
  onRejectAll,
  onAcceptChange,
  onRejectChange,
  onFocusChange,
  onClose,
}: ReviewPanelProps) {
  const { t } = useTranslation();
  const [draftText, setDraftText] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  /** Author filter (`''` = all). Reviewers pile up revisions, and a long list is unusable without it */
  const [authorFilter, setAuthorFilter] = useState('');
  /** Cursor of prev/next navigation, as an index into `visibleChanges` */
  const [cursor, setCursor] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const authors = useMemo(
    () => Array.from(new Set(changes.map((change) => change.author).filter(Boolean))),
    [changes],
  );
  const visibleChanges = useMemo(
    () => (authorFilter ? changes.filter((change) => change.author === authorFilter) : changes),
    [changes, authorFilter],
  );

  /** Only the first N rows are rendered: a comparison of two long documents can produce hundreds */
  const shownChanges = visibleChanges.slice(0, 20);

  /** Prev/next wraps around: the reviewer usually walks the list from wherever they stopped */
  const step = (delta: number) => {
    if (!visibleChanges.length) return;
    const next = (cursor + delta + visibleChanges.length) % visibleChanges.length;
    setCursor(next);
    onFocusChange(visibleChanges[next].id);
  };

  const submitReply = (id: string) => {
    const text = (replyDrafts[id] ?? '').trim();
    if (!text) return;
    onReplyComment(id, text);
    setReplyDrafts((current) => ({ ...current, [id]: '' }));
  };

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
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('tools.richText.trackedChanges')} ({changes.length})
            </span>
            <span className="flex items-center gap-0.5">
              <button
                type="button"
                title={t('tools.richText.prevChange')}
                aria-label={t('tools.richText.prevChange')}
                disabled={visibleChanges.length === 0}
                onClick={() => step(-1)}
                className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Icon name="chevronLeft" className="h-3 w-3" />
              </button>
              <span
                data-testid="rich-text-change-position"
                className="min-w-8 text-center text-[10px] tabular-nums text-gray-400 dark:text-gray-500"
              >
                {visibleChanges.length
                  ? `${Math.min(cursor + 1, visibleChanges.length)}/${visibleChanges.length}`
                  : '0/0'}
              </span>
              <button
                type="button"
                title={t('tools.richText.nextChange')}
                aria-label={t('tools.richText.nextChange')}
                disabled={visibleChanges.length === 0}
                onClick={() => step(1)}
                className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Icon name="chevronRight" className="h-3 w-3" />
              </button>
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <button type="button" onClick={onAcceptAll} className={buttonBase}>
              {t('tools.richText.acceptAll')}
            </button>
            <button type="button" onClick={onRejectAll} className={buttonBase}>
              {t('tools.richText.rejectAll')}
            </button>
            {authors.length > 1 ? (
              <select
                value={authorFilter}
                aria-label={t('tools.richText.authorFilter')}
                onChange={(event) => {
                  setAuthorFilter(event.target.value);
                  setCursor(0);
                }}
                className="ml-auto h-7 min-w-0 rounded-md border border-gray-300 bg-white px-1 text-xs text-gray-700 outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              >
                <option value="">{t('tools.richText.authorFilterAll')}</option>
                {authors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <ul className="mt-1 max-h-28 overflow-auto">
            {shownChanges.map((change, index) => (
              <li
                key={change.id}
                data-current={index === cursor ? 'true' : undefined}
                className={`flex items-baseline gap-1 rounded px-0.5 py-0.5 text-xs text-gray-600 dark:text-gray-300 ${
                  index === cursor ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setCursor(index);
                    onFocusChange(change.id);
                  }}
                  aria-label={`${t('tools.richText.focusChange')} ${change.text.slice(0, 20)}`}
                  className="flex min-w-0 flex-1 items-baseline gap-1 text-left"
                >
                  <span
                    className={`shrink-0 font-medium ${
                      change.kind === 'insert'
                        ? 'text-green-600'
                        : change.kind === 'format'
                          ? 'text-blue-600'
                          : 'text-red-600'
                    }`}
                  >
                    {change.kind === 'insert' ? '+' : change.kind === 'format' ? '±' : '−'}
                  </span>
                  <span className="truncate">{change.text.slice(0, 60)}</span>
                </button>
                <span className="ml-auto flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    title={t('tools.richText.acceptOne')}
                    aria-label={`${t('tools.richText.acceptOne')} ${change.text.slice(0, 20)}`}
                    onClick={() => onAcceptChange(change.id)}
                    className="flex h-5 w-5 items-center justify-center rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40"
                  >
                    <Icon name="check" className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title={t('tools.richText.rejectOne')}
                    aria-label={`${t('tools.richText.rejectOne')} ${change.text.slice(0, 20)}`}
                    onClick={() => onRejectChange(change.id)}
                    className="flex h-5 w-5 items-center justify-center rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Icon name="close" className="h-3 w-3" />
                  </button>
                  {change.author ? (
                    <span className="text-gray-400 dark:text-gray-500">{change.author}</span>
                  ) : null}
                </span>
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
              className={`rounded-md px-2 py-1.5 ${
                comment.resolved || comment.orphaned ? 'opacity-60' : ''
              }`}
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
                    {comment.orphaned ? (
                      <span
                        data-testid="rich-text-comment-orphaned"
                        className="text-amber-600 dark:text-amber-400"
                      >
                        {t('tools.richText.commentAnchorLost')}
                      </span>
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

              {(comment.replies ?? []).map((reply) => (
                <div
                  key={reply.id}
                  className="mt-1 border-l-2 border-gray-200 pl-2 dark:border-gray-700"
                >
                  <p className="break-words text-xs text-gray-700 dark:text-gray-200">
                    {reply.body}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {reply.author}
                    {reply.createdAt > 0 ? ` · ${new Date(reply.createdAt).toLocaleString()}` : ''}
                  </p>
                </div>
              ))}

              <div className="mt-1 flex items-center gap-1">
                <input
                  type="text"
                  value={replyDrafts[comment.id] ?? ''}
                  onChange={(event) =>
                    setReplyDrafts((current) => ({ ...current, [comment.id]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    submitReply(comment.id);
                  }}
                  placeholder={t('tools.richText.commentReplyPlaceholder')}
                  aria-label={t('tools.richText.commentReplyPlaceholder')}
                  className="h-6 min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-700 outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                />
                <button
                  type="button"
                  disabled={!(replyDrafts[comment.id] ?? '').trim()}
                  onClick={() => submitReply(comment.id)}
                  className="h-6 shrink-0 rounded-md bg-blue-600 px-1.5 text-[10px] text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('tools.richText.commentReply')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
